import api from './api';
import type { DataTable } from '../stores/dataTable';
import type {
  PageBuilderAIConfig,
  PageBindingContract,
  PageBuildRequest,
  PageBuilderAIResponse,
  PageBuilderFile,
  PageBuilderFileType,
  PageBuilderGeneratedFile,
  PageBuilderProject,
  PageBuilderSectionSummary,
  PageBuilderTreeNode,
  PageSpec
} from '../types/pageBuilder';

export function inferFieldRoles(table: DataTable | null) {
  if (!table) {
    return {};
  }

  return table.columns.reduce<Record<string, string>>((result, column) => {
    result[column.key] = column.type;
    return result;
  }, {});
}

function sortTreeNodes(a: PageBuilderTreeNode, b: PageBuilderTreeNode) {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
}

function buildTreeFromNodes(nodes: PageBuilderTreeNode[]): PageBuilderTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? buildTreeFromNodes(node.children) : undefined
    }))
    .sort(sortTreeNodes);
}

function buildTree(files: PageBuilderFile[]): PageBuilderTreeNode[] {
  const root: PageBuilderTreeNode[] = [];

  for (const file of files.filter((item) => item.visibility === 'project')) {
    const parts = file.path.split('/');
    let level = root;
    let currentPath = '';

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let existing = level.find((node) => node.path === currentPath);

      if (!existing) {
        existing = {
          id: currentPath,
          name: part,
          path: currentPath,
          kind: isFile ? 'file' : 'folder',
          ...(isFile ? { fileId: file.id, fileType: file.type } : { children: [] })
        };
        level.push(existing);
      }

      if (!isFile) {
        existing.children ||= [];
        level = existing.children;
      }
    }
  }

  return buildTreeFromNodes(root);
}

function createIndexHtml(title = 'Workspace Demo') {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <noscript>
      <strong>This preview requires JavaScript to run.</strong>
    </noscript>
    <div id="app"></div>
  </body>
</html>
`;
}

function createMainJs() {
  return `import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

createApp(App).mount('#app');
`;
}

function createAppVue(tableName: string, goal: string) {
  const safeTableName = JSON.stringify(tableName || 'Selected Table');
  const safeGoal = JSON.stringify(goal || 'Edit any Vue file in the workspace and the preview will re-render immediately.');

  return `<template>
  <main class="demo-shell">
    <section class="hero-card">
      <p class="eyebrow">Workspace Demo</p>
      <h1>Hello World</h1>
      <p class="hero-copy">{{ description }}</p>
      <div class="meta-row">
        <span>Source table</span>
        <strong>{{ tableName }}</strong>
      </div>
    </section>

    <HelloWorld />
    <Adder />
  </main>
</template>

<script setup>
import HelloWorld from './components/HelloWorld.vue';
import Adder from './components/Adder.vue';

const tableName = ${safeTableName};
const description = ${safeGoal};
</script>
`;
}

function createHelloWorldVue() {
  return `<template>
  <section class="demo-card">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </section>
</template>

<script setup>
const title = 'Hello World';
const description = 'This block is imported from a separate Vue file and rendered into the page.';
</script>
`;
}

function createAdderVue() {
  return `<template>
  <section class="demo-card">
    <h2>Adder Demo</h2>

    <div class="adder-form">
      <input v-model.number="left" type="number" />
      <input v-model.number="right" type="number" />
      <button type="button" @click="sum = left + right">Add</button>
      <output class="adder-result">{{ sum }}</output>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const left = ref(1);
const right = ref(2);
const sum = ref(3);
</script>
`;
}

function createPageCss() {
  return `:root {
  --bg: #06080b;
  --panel: #11161d;
  --line: rgba(120, 185, 0, 0.22);
  --text: #eef4ff;
  --muted: #9aa8b9;
  --accent: #9be564;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Segoe UI', sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top right, rgba(155, 229, 100, 0.16), transparent 24%),
    linear-gradient(180deg, #030405 0%, #0a0d10 100%);
}

.demo-shell {
  min-height: 100vh;
  padding: 32px;
  display: grid;
  gap: 18px;
}

.hero-card,
.demo-card {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(17, 22, 29, 0.96), rgba(8, 10, 13, 0.98));
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
}

.hero-card {
  padding: 28px;
}

.hero-card h1,
.demo-card h2 {
  margin: 0 0 12px;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.hero-copy,
.meta-row,
.demo-card p {
  color: var(--muted);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
}

.demo-card {
  padding: 22px;
}

.adder-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, auto));
  gap: 12px;
  align-items: center;
}

.adder-form input,
.adder-form button,
.adder-result {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
}

.adder-form button {
  cursor: pointer;
  font-weight: 700;
}

.adder-result {
  display: inline-flex;
  align-items: center;
}
`;
}

function normalizeFileType(path: string): PageBuilderFileType {
  const normalized = path.toLowerCase();

  if (normalized.endsWith('.vue')) {
    return 'vue';
  }
  if (normalized.endsWith('.css')) {
    return 'css';
  }
  if (normalized.endsWith('.json')) {
    return 'json';
  }
  if (normalized.endsWith('.ts')) {
    return 'ts';
  }
  if (normalized.endsWith('.html')) {
    return 'html';
  }

  return 'js';
}

function createBindingContract(table: DataTable, spec: PageSpec): PageBindingContract {
  return {
    tableId: table.id,
    mode: 'collection',
    fields: spec.dataSource.fields,
    sections: []
  };
}

function createBaseSpec(table: DataTable, request: PageBuildRequest): PageSpec {
  return {
    version: 'v1',
    meta: {
      title: request.title || `${table.name} Demo`,
      description: request.goal || 'Vue workspace demo'
    },
    dataSource: {
      tableId: table.id,
      fields: table.columns.map((column) => ({
        key: column.key,
        type: column.type
      }))
    },
    layout: {
      sections: []
    }
  };
}

function mapGeneratedFilesToProjectFiles(generatedFiles: PageBuilderGeneratedFile[]): PageBuilderFile[] {
  return generatedFiles.map((file, index) => {
    const path = file.path.replace(/^\/+/, '');
    const name = path.split('/').pop() || path;

    return {
      id: `generated-${index}-${path}`,
      path,
      name,
      type: normalizeFileType(path),
      role: file.role || 'Generated file.',
      editable: true,
      visibility: 'project',
      content: file.content
    };
  });
}

export function createProjectFromGeneratedFiles(
  table: DataTable,
  request: PageBuildRequest,
  generatedFiles: PageBuilderGeneratedFile[]
) {
  const spec = createBaseSpec(table, request);
  const bindingContract = createBindingContract(table, spec);
  const files = mapGeneratedFilesToProjectFiles(generatedFiles);

  const project: PageBuilderProject = {
    workspaceId: `workspace-${table.id}-${Date.now()}`,
    rootName: 'Page Workspace',
    files,
    tree: buildTree(files),
    bindingContract
  };

  return {
    fieldRoleMap: inferFieldRoles(table),
    spec,
    project,
    sectionSummaries: [] as PageBuilderSectionSummary[]
  };
}

export async function requestAIPageBuilderWorkspace(
  table: DataTable,
  request: PageBuildRequest,
  aiConfig: PageBuilderAIConfig
): Promise<PageBuilderAIResponse> {
  const sampleRows = table.rows.slice(0, 5);
  const openRouterOptions = aiConfig.provider === 'openrouter'
    ? {
        httpReferer: window.location.origin,
        appTitle: 'AIBrowser Page Builder'
      }
    : {};

  const response = await api.post('/ai/generate-page-workspace', {
    table: {
      id: table.id,
      name: table.name,
      columns: table.columns,
      rowCount: table.rows.length,
      sampleRows
    },
    request,
    model: aiConfig.provider,
    options: {
      apiKey: aiConfig.apiKey,
      model: aiConfig.model || undefined,
      timeoutMs: 180000,
      ...openRouterOptions
    }
  }, {
    timeout: 185000
  }) as {
    success: boolean;
    summary: string;
    files: PageBuilderGeneratedFile[];
    error?: string | null;
  };

  if (!response?.success) {
    throw new Error(response?.error || 'AI page generation failed.');
  }

  return {
    summary: response.summary || '',
    files: Array.isArray(response.files) ? response.files : []
  };
}

function createFallbackGeneratedFiles(table: DataTable, request: PageBuildRequest): PageBuilderGeneratedFile[] {
  return [
    {
      path: 'public/index.html',
      role: 'HTML entry file.',
      content: createIndexHtml(request.title || `${table.name} Demo`)
    },
    {
      path: 'src/main.js',
      role: 'Vue app bootstrap.',
      content: createMainJs()
    },
    {
      path: 'src/App.vue',
      role: 'App root component.',
      content: createAppVue(table.name, request.goal || '')
    },
    {
      path: 'src/components/HelloWorld.vue',
      role: 'Hello World component.',
      content: createHelloWorldVue()
    },
    {
      path: 'src/components/Adder.vue',
      role: 'Adder component.',
      content: createAdderVue()
    },
    {
      path: 'src/styles.css',
      role: 'Shared styles.',
      content: createPageCss()
    }
  ];
}

export function createPageBuilderWorkspace(table: DataTable, request: PageBuildRequest) {
  return createProjectFromGeneratedFiles(table, request, createFallbackGeneratedFiles(table, request));
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
