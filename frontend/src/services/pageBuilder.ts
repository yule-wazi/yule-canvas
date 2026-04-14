import type { DataTable } from '../stores/dataTable';
import type {
  PageBindingContract,
  PageBuildRequest,
  PageBuilderFile,
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

function createIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Workspace Demo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
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
    <h2>Hello World</h2>
    <p>This block is imported from a separate Vue file and rendered into the page.</p>
  </section>
</template>
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

export function createPageBuilderWorkspace(table: DataTable, request: PageBuildRequest) {
  const spec: PageSpec = {
    version: 'v1',
    meta: {
      title: request.title || `${table.name} Demo`,
      description: request.goal || 'Vue workspace demo',
      pageType: request.pageType,
      stylePreset: request.stylePreset || 'nvidia-tech'
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

  const bindingContract: PageBindingContract = {
    tableId: table.id,
    mode: 'collection',
    fields: spec.dataSource.fields,
    sections: []
  };

  const files: PageBuilderFile[] = [
    {
      id: 'index-html',
      path: 'index.html',
      name: 'index.html',
      type: 'html',
      role: 'HTML entry file.',
      editable: true,
      visibility: 'project',
      content: createIndexHtml()
    },
    {
      id: 'main-js',
      path: 'src/main.js',
      name: 'main.js',
      type: 'js',
      role: 'Vue app bootstrap.',
      editable: true,
      visibility: 'project',
      content: createMainJs()
    },
    {
      id: 'app-vue',
      path: 'src/App.vue',
      name: 'App.vue',
      type: 'vue',
      role: 'App root component.',
      editable: true,
      visibility: 'project',
      content: createAppVue(table.name, request.goal || '')
    },
    {
      id: 'hello-vue',
      path: 'src/components/HelloWorld.vue',
      name: 'HelloWorld.vue',
      type: 'vue',
      role: 'Hello World component.',
      editable: true,
      visibility: 'project',
      content: createHelloWorldVue()
    },
    {
      id: 'adder-vue',
      path: 'src/components/Adder.vue',
      name: 'Adder.vue',
      type: 'vue',
      role: 'Adder component.',
      editable: true,
      visibility: 'project',
      content: createAdderVue()
    },
    {
      id: 'page-css',
      path: 'src/styles.css',
      name: 'styles.css',
      type: 'css',
      role: 'Shared styles.',
      editable: true,
      visibility: 'project',
      content: createPageCss()
    }
  ];

  const project: PageBuilderProject = {
    workspaceId: `demo-${table.id}`,
    rootName: 'Page Workspace',
    files,
    tree: buildTree(files),
    bindingContract
  };

  const sectionSummaries: PageBuilderSectionSummary[] = [
    {
      id: 'hello-world',
      title: 'Hello World',
      type: 'content',
      description: 'Simple Vue demo section.',
      bindings: {},
      repeat: false
    },
    {
      id: 'adder',
      title: 'Adder',
      type: 'content',
      description: 'Simple interactive Vue calculator.',
      bindings: {},
      repeat: false
    }
  ];

  return {
    fieldRoleMap: inferFieldRoles(table),
    spec,
    project,
    sectionSummaries
  };
}
