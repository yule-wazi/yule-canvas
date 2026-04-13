import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import http from 'http';

type PreviewFileType = 'html' | 'css' | 'js' | 'ts' | 'json' | 'vue';

export interface PageBuilderPreviewFileInput {
  path: string;
  type: PreviewFileType;
  content: string;
}

interface PreviewProcessState {
  process: ChildProcessWithoutNullStreams | null;
  port: number;
  readyUrl: string | null;
  lastError: string | null;
}

const PREVIEW_PROJECT_ID = 'page-preview';
const PREVIEW_PORT = 4173;
const PREVIEW_HOST = '127.0.0.1';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestUrl(url: string) {
  return new Promise<void>((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      if ((res.statusCode || 500) >= 400) {
        reject(new Error(`Preview server responded with status ${res.statusCode}.`));
        return;
      }
      resolve();
    });

    req.on('error', reject);
    req.setTimeout(1500, () => {
      req.destroy(new Error('Preview server request timed out.'));
    });
  });
}

export class PageBuilderPreviewManager {
  private workspaceRoot = path.resolve(__dirname, '../../..');

  private frontendRoot = path.join(this.workspaceRoot, 'frontend');

  private previewRoot = path.join(this.workspaceRoot, 'generated-projects', PREVIEW_PROJECT_ID);

  private viteBinPath = path.join(this.frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');

  private state: PreviewProcessState = {
    process: null,
    port: PREVIEW_PORT,
    readyUrl: null,
    lastError: null
  };

  async preparePreview(files: PageBuilderPreviewFileInput[]) {
    if (!files.length) {
      throw new Error('Preview preparation requires generated project files.');
    }

    if (this.state.process) {
      await this.stopServer();
    }

    this.writeProject(files);
    const previewUrl = await this.ensureServer();

    return {
      projectId: PREVIEW_PROJECT_ID,
      previewUrl
    };
  }

  private writeProject(files: PageBuilderPreviewFileInput[]) {
    fs.mkdirSync(this.previewRoot, { recursive: true });

    const templateFiles = this.buildTemplateFiles();
    for (const file of [...templateFiles, ...files]) {
      const targetPath = path.join(this.previewRoot, ...file.path.split('/'));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, file.content, 'utf8');
    }
  }

  private buildTemplateFiles(): Array<{ path: string; content: string }> {
    return [
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page Builder Preview</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
      },
      {
        path: 'vite.config.mjs',
        content: `import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '../../frontend/node_modules/vite/dist/node/index.js';
import vue from '../../frontend/node_modules/@vitejs/plugin-vue/dist/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../../frontend');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: path.resolve(frontendRoot, 'node_modules/vue/dist/vue.runtime.esm-bundler.js')
    }
  },
  server: {
    host: '${PREVIEW_HOST}',
    port: ${PREVIEW_PORT},
    strictPort: true
  }
});
`
      },
      {
        path: 'tsconfig.json',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.json"]
}
`
      },
      {
        path: 'src/main.ts',
        content: `import { createApp } from 'vue';
import App from './App.vue';
import './styles/page.css';

createApp(App).mount('#app');
`
      },
      {
        path: 'src/App.vue',
        content: `<template>
  <PageView />
</template>

<script setup lang="ts">
import PageView from './app/PageView.vue';
</script>
`
      }
    ];
  }

  private async ensureServer() {
    const existingUrl = this.state.readyUrl;
    if (this.state.process && existingUrl) {
      try {
        await requestUrl(existingUrl);
        return existingUrl;
      } catch {
        await this.stopServer();
      }
    }

    if (!fs.existsSync(this.viteBinPath)) {
      throw new Error(`Vite executable was not found at ${this.viteBinPath}.`);
    }

    this.state.lastError = null;
    this.state.readyUrl = null;

    const child = spawn(process.execPath, [this.viteBinPath, '--host', PREVIEW_HOST, '--port', String(this.state.port), '--strictPort'], {
      cwd: this.previewRoot,
      env: {
        ...process.env,
        BROWSER: 'none',
        NO_COLOR: '1'
      },
      stdio: 'pipe'
    });

    this.state.process = child;

    child.stdout.on('data', () => {
      // ignore normal preview logs in API mode
    });

    child.stderr.on('data', (chunk) => {
      const message = String(chunk || '').trim();
      if (message) {
        this.state.lastError = message;
      }
    });

    child.on('exit', (code) => {
      if (this.state.process === child) {
        if (!this.state.readyUrl) {
          this.state.lastError ||= `Preview server exited before becoming ready (code ${code ?? 'unknown'}).`;
        }
        this.state.process = null;
      }
    });

    const previewUrl = `http://${PREVIEW_HOST}:${this.state.port}/`;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        await requestUrl(previewUrl);
        this.state.readyUrl = previewUrl;
        return previewUrl;
      } catch {
        if (!this.state.process) {
          break;
        }
        await wait(250);
      }
    }

    const error = this.state.lastError || 'Preview server failed to start.';
    await this.stopServer();
    throw new Error(error);
  }

  private async stopServer() {
    const child = this.state.process;
    this.state.process = null;
    this.state.readyUrl = null;

    if (!child) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      child.once('exit', finish);

      try {
        child.kill();
      } catch {
        finish();
        return;
      }

      setTimeout(() => {
        try {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        } catch {
          // ignore force-kill failures
        }
        finish();
      }, 1500);
    });
  }
}
