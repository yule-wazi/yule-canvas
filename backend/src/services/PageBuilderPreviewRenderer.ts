import fs from 'fs';
import path from 'path';
import ts from 'typescript';

type PreviewFileType = 'html' | 'css' | 'js' | 'ts' | 'json' | 'vue';

export interface PageBuilderPreviewFileInput {
  path: string;
  type: PreviewFileType;
  content: string;
}

export interface PageBuilderPreviewRenderRequest {
  files: PageBuilderPreviewFileInput[];
  entryPath?: string;
  title?: string;
}

interface CompiledModule {
  code: string;
  dependencies: string[];
}

interface PreviewFileRecord extends PageBuilderPreviewFileInput {
  normalizedPath: string;
}

type CompilerSfcModule = {
  parse: (source: string, options?: { filename?: string }) => {
    descriptor: {
      script?: { content: string; lang?: string } | null;
      scriptSetup?: { content: string; lang?: string } | null;
      template?: { content: string } | null;
    };
    errors: Array<{ message?: string } | string>;
  };
  compileScript: (
    descriptor: {
      script?: { content: string; lang?: string } | null;
      scriptSetup?: { content: string; lang?: string } | null;
      template?: { content: string } | null;
    },
    options: { id: string }
  ) => { content: string };
};

let compilerSfc: CompilerSfcModule | null = null;

function loadCompilerSfc(): CompilerSfcModule {
  if (compilerSfc) {
    return compilerSfc;
  }

  const modulePath = path.resolve(
    process.cwd(),
    '../frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js'
  );

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  compilerSfc = require(modulePath) as CompilerSfcModule;
  return compilerSfc;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeScript(value: string) {
  return value.replace(/<\/script>/gi, '<\\/script>');
}

function escapeStyle(value: string) {
  return value.replace(/<\/style>/gi, '<\\/style>');
}

function normalizeFilePath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function removeExtension(filePath: string) {
  return filePath.replace(/\.[^/.]+$/, '');
}

function normalizeNamedImportClause(clause: string) {
  return clause.replace(/\bas\b/g, ':');
}

function dirname(filePath: string) {
  const normalized = normalizeFilePath(path.posix.dirname(filePath));
  return normalized === '.' ? '' : normalized;
}

function resolveImportPath(fromPath: string, request: string, files: Map<string, PreviewFileRecord>) {
  if (!request.startsWith('.')) {
    return request;
  }

  const baseDir = dirname(fromPath);
  const direct = normalizeFilePath(path.posix.normalize(path.posix.join(baseDir, request)));
  const candidates = [
    direct,
    `${direct}.ts`,
    `${direct}.js`,
    `${direct}.vue`,
    `${direct}.json`,
    `${direct}.css`,
    `${removeExtension(direct)}.ts`,
    `${removeExtension(direct)}.js`,
    `${removeExtension(direct)}.vue`,
    `${removeExtension(direct)}.json`,
    `${removeExtension(direct)}.css`
  ];

  const matched = candidates.find((candidate) => files.has(candidate));
  if (!matched) {
    throw new Error(`Missing dependency "${request}" imported from "${fromPath}".`);
  }

  return matched;
}

function extractImportSpecifiers(importClause: string) {
  const trimmed = importClause.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('{')) {
    return `const ${trimmed} = __require`;
  }

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    const defaultImport = parts[0].trim();
    const namedImport = parts.slice(1).join(',').trim();
    const statements: string[] = [];

    if (defaultImport) {
      statements.push(`const ${defaultImport} = __importDefault(__require`);
    }

    if (namedImport) {
      statements.push(`const ${namedImport} = __require`);
    }

    return statements.join('\n');
  }

  return `const ${trimmed} = __importDefault(__require`;
}

function replaceImports(code: string, filePath: string, files: Map<string, PreviewFileRecord>, dependencies: string[]) {
  const importRegex = /^\s*import\s+([^'";]+?)\s+from\s+['"]([^'"]+)['"];?/gm;
  let nextCode = code.replace(importRegex, (_match, clause, source) => {
    const resolved = resolveImportPath(filePath, source, files);
    dependencies.push(resolved);

    if (source === 'vue') {
      const vueBinding = clause.trim();
      if (vueBinding.startsWith('{')) {
        return `const ${normalizeNamedImportClause(vueBinding)} = Vue;`;
      }

      return `const ${vueBinding} = Vue;`;
    }

    if (clause.includes(',')) {
      const parts = clause.split(',');
      const defaultImport = parts[0].trim();
      const namedImport = parts.slice(1).join(',').trim();
      const statements: string[] = [];

      if (defaultImport) {
        statements.push(`const ${defaultImport} = __importDefault(__require(${JSON.stringify(resolved)})).default;`);
      }

      if (namedImport) {
        statements.push(`const ${normalizeNamedImportClause(namedImport)} = __require(${JSON.stringify(resolved)});`);
      }

      return statements.join('\n');
    }

    if (clause.trim().startsWith('{')) {
      return `const ${normalizeNamedImportClause(clause.trim())} = __require(${JSON.stringify(resolved)});`;
    }

    return `const ${clause.trim()} = __importDefault(__require(${JSON.stringify(resolved)})).default;`;
  });

  const sideEffectImportRegex = /^\s*import\s+['"]([^'"]+)['"];?/gm;
  nextCode = nextCode.replace(sideEffectImportRegex, (_match, source) => {
    const resolved = resolveImportPath(filePath, source, files);
    dependencies.push(resolved);

    if (source === 'vue') {
      return '';
    }

    return `__require(${JSON.stringify(resolved)});`;
  });

  return nextCode;
}

function replaceExports(code: string) {
  let nextCode = code;

  nextCode = nextCode.replace(/export default\s+/g, 'const __default__ = ');
  nextCode = nextCode.replace(/export function\s+([A-Za-z0-9_$]+)\s*\(/g, 'function $1(');
  nextCode = nextCode.replace(/export const\s+([A-Za-z0-9_$]+)\s*=/g, 'const $1 =');
  nextCode = nextCode.replace(/export let\s+([A-Za-z0-9_$]+)\s*=/g, 'let $1 =');
  nextCode = nextCode.replace(/export var\s+([A-Za-z0-9_$]+)\s*=/g, 'var $1 =');

  const exportedNames = Array.from(nextCode.matchAll(/\b(function|const|let|var)\s+([A-Za-z0-9_$]+)/g))
    .map((match) => match[2])
    .filter((name) => name !== '__default__');

  return {
    code: nextCode,
    exportedNames
  };
}

function transpileScript(code: string, filePath: string) {
  return ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2019,
      jsx: ts.JsxEmit.Preserve
    },
    fileName: filePath
  }).outputText;
}

function compileTsModule(file: PreviewFileRecord, files: Map<string, PreviewFileRecord>): CompiledModule {
  const dependencies: string[] = [];
  const transpiled = transpileScript(file.content, file.normalizedPath);
  const imported = replaceImports(transpiled, file.normalizedPath, files, dependencies);
  const exported = replaceExports(imported);
  const footer = exported.exportedNames.map((name) => `module.exports.${name} = ${name};`).join('\n');

  return {
    dependencies,
    code: `${exported.code}\n${footer}${footer ? '\n' : ''}if (typeof __default__ !== 'undefined') { module.exports.default = __default__; }\n`
  };
}

function compileJsonModule(file: PreviewFileRecord): CompiledModule {
  return {
    dependencies: [],
    code: `module.exports.default = ${file.content.trim() || '{}'};\n`
  };
}

function compileCssModule(file: PreviewFileRecord): CompiledModule {
  return {
    dependencies: [],
    code: `module.exports.default = ${JSON.stringify(file.content)};\n`
  };
}

function compileVueModule(file: PreviewFileRecord, files: Map<string, PreviewFileRecord>): CompiledModule {
  const sfc = loadCompilerSfc();
  const parsed = sfc.parse(file.content, { filename: file.normalizedPath });

  if (parsed.errors.length) {
    throw new Error(`Failed to parse ${file.normalizedPath}: ${parsed.errors.map((error) => typeof error === 'string' ? error : error.message || 'SFC parse error').join('; ')}`);
  }

  const descriptor = parsed.descriptor;
  let scriptContent = '';

  if (descriptor.scriptSetup) {
    scriptContent = sfc.compileScript(descriptor, {
      id: file.normalizedPath.replace(/[^A-Za-z0-9_]/g, '_')
    }).content;
  } else if (descriptor.script?.content) {
    scriptContent = descriptor.script.content;
  } else {
    scriptContent = 'export default {};';
  }

  const template = descriptor.template?.content?.trim() || '<div></div>';
  const transpiled = transpileScript(scriptContent, file.normalizedPath);
  const dependencies: string[] = [];
  const imported = replaceImports(transpiled, file.normalizedPath, files, dependencies);
  const exported = replaceExports(imported);
  const footer = exported.exportedNames.map((name) => `module.exports.${name} = ${name};`).join('\n');

  return {
    dependencies,
    code: `${exported.code}\nif (typeof __default__ === 'undefined') { throw new Error(${JSON.stringify(`Missing default export in ${file.normalizedPath}`)}); }\n__default__.template = ${JSON.stringify(template)};\nmodule.exports.default = __default__;\n${footer}\n`
  };
}

function compileModule(file: PreviewFileRecord, files: Map<string, PreviewFileRecord>) {
  if (file.type === 'vue') {
    return compileVueModule(file, files);
  }

  if (file.type === 'ts' || file.type === 'js' || file.type === 'html') {
    return compileTsModule(file, files);
  }

  if (file.type === 'json') {
    return compileJsonModule(file);
  }

  if (file.type === 'css') {
    return compileCssModule(file);
  }

  throw new Error(`Unsupported file type "${file.type}" for ${file.normalizedPath}.`);
}

function loadVueRuntime() {
  const runtimePath = path.resolve(process.cwd(), '../frontend/node_modules/vue/dist/vue.global.js');
  return fs.readFileSync(runtimePath, 'utf8');
}

function collectModules(
  entryPath: string,
  files: Map<string, PreviewFileRecord>,
  compiled: Map<string, CompiledModule>,
  cssChunks: Map<string, string>
) {
  if (compiled.has(entryPath)) {
    return;
  }

  const file = files.get(entryPath);
  if (!file) {
    throw new Error(`Preview entry "${entryPath}" was not found in generated files.`);
  }

  const output = compileModule(file, files);
  compiled.set(entryPath, output);

  if (file.type === 'css') {
    cssChunks.set(entryPath, file.content);
  }

  output.dependencies.forEach((dependency) => {
    if (dependency === 'vue') {
      return;
    }

    collectModules(dependency, files, compiled, cssChunks);

    const dependencyFile = files.get(dependency);
    if (dependencyFile?.type === 'css') {
      cssChunks.set(dependency, dependencyFile.content);
    }
  });
}

function buildHtmlDocument(params: {
  title: string;
  entryPath: string;
  compiled: Map<string, CompiledModule>;
  cssChunks: Map<string, string>;
}) {
  const runtime = loadVueRuntime();
  const modulesSource = Array.from(params.compiled.entries())
    .map(([modulePath, output]) => `${JSON.stringify(modulePath)}: function(module, exports, __require, __importDefault, Vue) {\n${output.code}\n}`)
    .join(',\n');
  const styles = Array.from(params.cssChunks.values()).join('\n\n');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.title)}</title>
    <style>
      html, body, #app { margin: 0; min-height: 100%; }
      body { background: #050505; }
    </style>
    ${styles ? `<style>${escapeStyle(styles)}</style>` : ''}
    <script>
      window.addEventListener('error', function(event) {
        const message = event.error && event.error.stack
          ? event.error.stack
          : String(event.message || 'Preview runtime error.');
        document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:20px;margin:0;color:#ffb4b4;background:#120808;">' + message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            source: 'page-builder-preview-error',
            payload: { message: message }
          }, '*');
        }
      });
      window.addEventListener('unhandledrejection', function(event) {
        const message = event.reason && event.reason.stack
          ? event.reason.stack
          : String(event.reason || 'Unhandled preview rejection.');
        document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:20px;margin:0;color:#ffb4b4;background:#120808;">' + message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            source: 'page-builder-preview-error',
            payload: { message: message }
          }, '*');
        }
      });
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script>${escapeScript(runtime)}</script>
    <script>
      (function () {
        const __modules = {
${modulesSource}
        };
        const __cache = {};

        function __importDefault(value) {
          return value && Object.prototype.hasOwnProperty.call(value, 'default')
            ? value
            : { default: value };
        }

        function __require(modulePath) {
          if (__cache[modulePath]) {
            return __cache[modulePath].exports;
          }

          const factory = __modules[modulePath];
          if (!factory) {
            throw new Error('Unknown preview module: ' + modulePath);
          }

          const module = { exports: {} };
          __cache[modulePath] = module;
          factory(module, module.exports, __require, __importDefault, Vue);
          return module.exports;
        }

        try {
          const entryModule = __require(${JSON.stringify(params.entryPath)});
          const App = entryModule.default || entryModule;
          Vue.createApp(App).mount('#app');
          setTimeout(function() {
            const app = document.getElementById('app');
            if (app && !app.innerHTML.trim()) {
              const message = 'Preview mounted but rendered no visible content.';
              document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:20px;margin:0;color:#ffd4a8;background:#1a1108;">' + message + '</pre>';
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  source: 'page-builder-preview-error',
                  payload: { message: message }
                }, '*');
              }
            }
          }, 300);
        } catch (error) {
          const shell = document.createElement('pre');
          shell.style.whiteSpace = 'pre-wrap';
          shell.style.padding = '20px';
          shell.style.margin = '0';
          shell.style.color = '#ffb4b4';
          shell.style.background = '#120808';
          shell.textContent = error instanceof Error ? error.stack || error.message : String(error);
          document.body.innerHTML = '';
          document.body.appendChild(shell);
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              source: 'page-builder-preview-error',
              payload: {
                message: error instanceof Error ? error.stack || error.message : String(error)
              }
            }, '*');
          }
        }
      })();
    </script>
  </body>
</html>`;
}

export class PageBuilderPreviewRenderer {
  static renderErrorDocument(message: string, title = 'Page Builder Preview Error') {
    const safeMessage = escapeHtml(message || 'Unknown preview error.');
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      html, body { margin: 0; min-height: 100%; background: #090909; }
      body { font-family: Arial, Helvetica, sans-serif; color: #f5f7fb; }
      .shell { padding: 24px; }
      .card {
        max-width: 960px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        overflow: hidden;
      }
      .head {
        padding: 16px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: #ffb4b4;
        font-weight: 700;
      }
      pre {
        margin: 0;
        padding: 18px;
        white-space: pre-wrap;
        word-break: break-word;
        color: #ffd0d0;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="head">Preview Error</div>
        <pre>${safeMessage}</pre>
      </div>
    </div>
  </body>
</html>`;
  }

  static render(request: PageBuilderPreviewRenderRequest) {
    if (!Array.isArray(request.files) || !request.files.length) {
      throw new Error('Preview render request must include generated files.');
    }

    const files = new Map<string, PreviewFileRecord>();
    request.files.forEach((file) => {
      files.set(normalizeFilePath(file.path), {
        ...file,
        normalizedPath: normalizeFilePath(file.path)
      });
    });

    const entryPath = normalizeFilePath(request.entryPath || 'app/PageView.vue');
    const compiled = new Map<string, CompiledModule>();
    const cssChunks = new Map<string, string>();
    collectModules(entryPath, files, compiled, cssChunks);

    return buildHtmlDocument({
      title: request.title || 'Page Builder Preview',
      entryPath,
      compiled,
      cssChunks
    });
  }
}
