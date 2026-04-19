import * as VueRuntime from 'vue';
import { compileScript, compileStyle, compileTemplate, parse, rewriteDefault } from '@vue/compiler-sfc';
import type { PageBuilderPreviewSessionSnapshot } from '../types/pageBuilder';

type RuntimeFile = PageBuilderPreviewSessionSnapshot['files'][number];

const BABEL_STANDALONE_SRC = '/preview-runtime/babel-7.21.8.min.js';
const VUE_VENDOR_ID = '__page_builder_vue__.mjs';
const PREVIEW_ROOT_ID = '__page_builder_preview_root__';

declare global {
  interface Window {
    Babel?: {
      transform(code: string, options?: Record<string, unknown>): { code?: string | null };
    };
    __AIBROWSER_VUE__?: Record<string, unknown>;
  }
}

export async function mountPageBuilderPreviewRuntime(
  container: HTMLElement,
  snapshot: PageBuilderPreviewSessionSnapshot
) {
  const runtime = new PageBuilderPreviewRuntime(snapshot);
  await runtime.mount(container);
  return () => runtime.destroy();
}

class PageBuilderPreviewRuntime {
  private readonly files = new Map<string, RuntimeFile>();
  private readonly moduleCache = new Map<string, Promise<string>>();
  private readonly objectUrls = new Set<string>();
  private readonly styleIds = new Set<string>();

  constructor(private readonly snapshot: PageBuilderPreviewSessionSnapshot) {
    for (const file of snapshot.files) {
      this.files.set(normalizeFilePath(file.path), file);
    }
  }

  async mount(container: HTMLElement) {
    window.__AIBROWSER_VUE__ = VueRuntime as unknown as Record<string, unknown>;

    container.innerHTML = `<div id="${PREVIEW_ROOT_ID}"></div>`;
    const entryPath = this.resolveEntryPath();
    const entryUrl = await this.getModuleUrl(entryPath);

    if (getFileExtension(entryPath) === 'vue') {
      const module = await import(/* @vite-ignore */ entryUrl);
      VueRuntime.createApp(module.default || module).mount(`#${PREVIEW_ROOT_ID}`);
      return;
    }

    await import(/* @vite-ignore */ entryUrl);
  }

  destroy() {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }

    for (const styleId of this.styleIds) {
      document.getElementById(styleId)?.remove();
    }

    this.objectUrls.clear();
    this.styleIds.clear();
    this.moduleCache.clear();
  }

  private resolveEntryPath() {
    const packageJsonFile = this.files.get('package.json');

    if (packageJsonFile) {
      try {
        const pkg = JSON.parse(packageJsonFile.content);
        const main = typeof pkg?.main === 'string' ? normalizeFilePath(pkg.main) : null;
        if (main && this.files.has(main)) {
          return main;
        }
      } catch {
        // Ignore invalid package.json and fall back to common entry paths.
      }
    }

    const candidates = [
      'src/main.js',
      'src/main.ts',
      'src/main.mjs',
      'src/main.jsx',
      'src/main.tsx',
      'main.js',
      'main.ts',
      'src/App.vue',
      'App.vue'
    ];

    for (const candidate of candidates) {
      if (this.files.has(candidate)) {
        return candidate;
      }
    }

    throw new Error('No preview entry file was found. Expected src/main.js, src/main.ts, or src/App.vue.');
  }

  private async getModuleUrl(filePath: string): Promise<string> {
    if (!this.moduleCache.has(filePath)) {
      this.moduleCache.set(filePath, this.buildModuleUrl(filePath));
    }

    return this.moduleCache.get(filePath)!;
  }

  private async buildModuleUrl(filePath: string): Promise<string> {
    if (filePath === VUE_VENDOR_ID) {
      const url = createObjectUrl(buildVueVendorModule());
      this.objectUrls.add(url);
      return url;
    }

    const file = this.files.get(filePath);
    if (!file) {
      throw new Error(`Preview file not found: ${filePath}`);
    }

    const extension = getFileExtension(filePath);
    let code = '';

    if (extension === 'vue') {
      code = await this.compileVueSfc(filePath, file.content);
    } else if (extension === 'css') {
      code = this.compileCssModule(filePath, file.content);
    } else if (extension === 'json') {
      code = `export default ${file.content.trim() || 'null'};`;
    } else if (isScriptExtension(extension)) {
      code = await this.compileScriptModule(filePath, file.content, extension === 'ts' || extension === 'tsx');
    } else {
      code = `export default ${JSON.stringify(file.content)};`;
    }

    const url = createObjectUrl(code);
    this.objectUrls.add(url);
    return url;
  }

  private async compileVueSfc(filePath: string, source: string) {
    const scopeId = `data-v-${hashString(filePath)}`;
    const { descriptor, errors } = parse(source, { filename: filePath });

    if (errors.length) {
      throw new Error(`Failed to parse ${filePath}: ${errors[0]}`);
    }

    if (descriptor.script?.src || descriptor.scriptSetup?.src) {
      throw new Error(`External <script src> is not supported in ${filePath}.`);
    }

    if (descriptor.styles.some((style) => style.src)) {
      throw new Error(`External <style src> is not supported in ${filePath}.`);
    }

    let scriptCode = 'const __sfc__ = {};';
    const usesTs = descriptor.script?.lang === 'ts' || descriptor.scriptSetup?.lang === 'ts';
    const compiledScript = descriptor.script || descriptor.scriptSetup
      ? compileScript(descriptor, {
          id: scopeId,
          inlineTemplate: false
        })
      : null;

    if (compiledScript) {
      scriptCode = rewriteDefault(compiledScript.content, '__sfc__');
    }

    let templateCode = '';
    if (descriptor.template) {
      const compiledTemplate = compileTemplate({
        id: scopeId,
        filename: filePath,
        source: descriptor.template.content,
        scoped: descriptor.styles.some((style) => style.scoped),
        compilerOptions: {
          bindingMetadata: compiledScript?.bindings
        }
      });

      if (compiledTemplate.errors.length) {
        throw new Error(`Failed to compile template in ${filePath}: ${compiledTemplate.errors[0]}`);
      }

      templateCode = `${compiledTemplate.code}\n__sfc__.render = render;`;
    }

    const styleCode = descriptor.styles
      .map((style, index) => {
        const compiledStyle = compileStyle({
          filename: filePath,
          id: scopeId,
          source: style.content,
          scoped: style.scoped
        });

        if (compiledStyle.errors.length) {
          throw new Error(`Failed to compile style ${index + 1} in ${filePath}: ${compiledStyle.errors[0]}`);
        }

        return this.createStyleInjectionCode(`${scopeId}-${index}`, compiledStyle.code);
      })
      .join('\n');

    const scopeCode = descriptor.styles.some((style) => style.scoped)
      ? `__sfc__.__scopeId = ${JSON.stringify(scopeId)};`
      : '';

    let combined = [scriptCode, templateCode, styleCode, scopeCode, 'export default __sfc__;']
      .filter(Boolean)
      .join('\n\n');

    combined = await this.rewriteModuleSpecifiers(combined, filePath);

    if (usesTs) {
      combined = await transpileTypeScript(combined, filePath);
    }

    return rewriteMountTarget(combined);
  }

  private async compileScriptModule(filePath: string, source: string, isTypeScript: boolean) {
    let code = await this.rewriteModuleSpecifiers(source, filePath);

    if (isTypeScript) {
      code = await transpileTypeScript(code, filePath);
    }

    return rewriteMountTarget(code);
  }

  private compileCssModule(filePath: string, source: string) {
    return this.createStyleInjectionCode(filePath, source) + `\nexport default ${JSON.stringify(source)};`;
  }

  private createStyleInjectionCode(seed: string, cssText: string) {
    const styleId = `page-builder-preview-style-${hashString(seed)}`;
    this.styleIds.add(styleId);

    return `const __styleId = ${JSON.stringify(styleId)};
if (!document.getElementById(__styleId)) {
  const __style = document.createElement('style');
  __style.id = __styleId;
  __style.textContent = ${JSON.stringify(cssText)};
  document.head.appendChild(__style);
}`;
  }

  private async rewriteModuleSpecifiers(code: string, fromPath: string) {
    let rewritten = code;

    rewritten = await replaceAsync(
      rewritten,
      /((?:import|export)\s+[^'"]*?\sfrom\s*)(['"])([^'"]+)\2/g,
      async (_match, prefix: string, quote: string, specifier: string) => {
        const target = await this.resolveImportSpecifier(fromPath, specifier);
        return `${prefix}${quote}${target}${quote}`;
      }
    );

    rewritten = await replaceAsync(
      rewritten,
      /(import\s*)(['"])([^'"]+)\2/g,
      async (_match, prefix: string, quote: string, specifier: string) => {
        const target = await this.resolveImportSpecifier(fromPath, specifier);
        return `${prefix}${quote}${target}${quote}`;
      }
    );

    rewritten = await replaceAsync(
      rewritten,
      /(import\(\s*)(['"])([^'"]+)\2(\s*\))/g,
      async (_match, prefix: string, quote: string, specifier: string, suffix: string) => {
        const target = await this.resolveImportSpecifier(fromPath, specifier);
        return `${prefix}${quote}${target}${quote}${suffix}`;
      }
    );

    return rewritten;
  }

  private async resolveImportSpecifier(fromPath: string, specifier: string) {
    if (specifier === 'vue') {
      return this.getModuleUrl(VUE_VENDOR_ID);
    }

    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const resolvedPath = resolveRelativePath(fromPath, specifier);
      return this.getModuleUrl(resolvedPath);
    }

    throw new Error(`Unsupported import "${specifier}" in ${fromPath}. Only relative imports and "vue" are supported.`);
  }
}

async function transpileTypeScript(code: string, filePath: string) {
  await ensureBabelStandalone();

  const result = window.Babel?.transform(code, {
    filename: filePath,
    presets: [['typescript', { allExtensions: true, isTSX: filePath.endsWith('.tsx') }]]
  });

  return result?.code || code;
}

let babelLoader: Promise<void> | null = null;

function ensureBabelStandalone() {
  if (window.Babel) {
    return Promise.resolve();
  }

  if (babelLoader) {
    return babelLoader;
  }

  babelLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = BABEL_STANDALONE_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Babel standalone runtime for preview transpilation.'));
    document.head.appendChild(script);
  });

  return babelLoader;
}

function buildVueVendorModule() {
  const exportLines = Object.keys(VueRuntime)
    .filter(isValidIdentifier)
    .map((key) => `export const ${key} = window.__AIBROWSER_VUE__[${JSON.stringify(key)}];`);

  return [
    'const __vue__ = window.__AIBROWSER_VUE__;',
    'export default __vue__;',
    ...exportLines
  ].join('\n');
}

function isValidIdentifier(value: string) {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(value);
}

function createObjectUrl(code: string) {
  return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
}

function rewriteMountTarget(code: string) {
  return code
    .replace(/mount\((['"])#app\1\)/g, `mount(document.getElementById('${PREVIEW_ROOT_ID}'))`)
    .replace(/mount\((['"])app\1\)/g, `mount(document.getElementById('${PREVIEW_ROOT_ID}'))`);
}

function normalizeFilePath(filePath: string) {
  return filePath.replace(/^\/+/, '').replace(/\\/g, '/');
}

function resolveRelativePath(fromPath: string, specifier: string) {
  if (specifier.startsWith('/')) {
    return normalizeFilePath(specifier);
  }

  const segments = normalizeFilePath(fromPath).split('/');
  segments.pop();

  for (const part of specifier.split('/')) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      segments.pop();
      continue;
    }

    segments.push(part);
  }

  return segments.join('/');
}

function getFileExtension(filePath: string) {
  const fileName = filePath.split('/').pop() || '';
  const extension = fileName.split('.').pop() || '';
  return extension.toLowerCase();
}

function isScriptExtension(extension: string) {
  return ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(extension);
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (...args: any[]) => Promise<string>
) {
  const matches = Array.from(input.matchAll(pattern));
  if (!matches.length) {
    return input;
  }

  const replacements = await Promise.all(matches.map((match) => replacer(...match, match.index, match.input, match.groups)));
  let output = '';
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const matchIndex = match.index ?? 0;
    output += input.slice(lastIndex, matchIndex);
    output += replacements[index];
    lastIndex = matchIndex + match[0].length;
  });

  output += input.slice(lastIndex);
  return output;
}
