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
    <link rel="stylesheet" href="/src/styles/page.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
}

function createMainJs() {
  return `import { renderApp } from './app.js';

renderApp(document.getElementById('app'));
`;
}

function createAppJs(tableName: string, goal: string) {
  const safeGoal = JSON.stringify(goal || 'Edit any file in the workspace and the preview will re-render immediately.');
  const safeTableName = JSON.stringify(tableName || 'Selected Table');

  return `import { createHelloWorld } from './components/HelloWorld.js';
import { createAdder } from './components/Adder.js';

export function renderApp(root) {
  if (!root) {
    return;
  }

  root.innerHTML = '';

  const shell = document.createElement('main');
  shell.className = 'demo-shell';

  const hero = document.createElement('section');
  hero.className = 'hero-card';

  const badge = document.createElement('p');
  badge.className = 'eyebrow';
  badge.textContent = 'Workspace Demo';

  const title = document.createElement('h1');
  title.textContent = 'Hello World';

  const summary = document.createElement('p');
  summary.className = 'hero-copy';
  summary.textContent = ${safeGoal};

  const meta = document.createElement('div');
  meta.className = 'meta-row';
  meta.innerHTML = '<span>Source table</span><strong>' + ${safeTableName} + '</strong>';

  hero.append(badge, title, summary, meta);

  const helloBlock = createHelloWorld();
  const adderBlock = createAdder();

  shell.append(hero, helloBlock, adderBlock);
  root.appendChild(shell);
}
`;
}

function createHelloWorldJs() {
  return `export function createHelloWorld() {
  const section = document.createElement('section');
  section.className = 'demo-card';

  const title = document.createElement('h2');
  title.textContent = 'Hello World';

  const body = document.createElement('p');
  body.textContent = 'This block is imported from a separate file and rendered into the page.';

  section.append(title, body);
  return section;
}
`;
}

function createAdderJs() {
  return `export function createAdder() {
  const section = document.createElement('section');
  section.className = 'demo-card';

  const title = document.createElement('h2');
  title.textContent = 'Adder Demo';

  const form = document.createElement('div');
  form.className = 'adder-form';

  const first = document.createElement('input');
  first.type = 'number';
  first.value = '1';

  const second = document.createElement('input');
  second.type = 'number';
  second.value = '2';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Add';

  const result = document.createElement('output');
  result.className = 'adder-result';
  result.textContent = '3';

  button.addEventListener('click', () => {
    const sum = Number(first.value || 0) + Number(second.value || 0);
    result.textContent = String(sum);
  });

  form.append(first, second, button, result);
  section.append(title, form);
  return section;
}
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
      description: request.goal || 'Workspace demo',
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
      role: 'App bootstrap.',
      editable: true,
      visibility: 'project',
      content: createMainJs()
    },
    {
      id: 'app-js',
      path: 'src/app.js',
      name: 'app.js',
      type: 'js',
      role: 'Main app renderer.',
      editable: true,
      visibility: 'project',
      content: createAppJs(table.name, request.goal || '')
    },
    {
      id: 'hello-js',
      path: 'src/components/HelloWorld.js',
      name: 'HelloWorld.js',
      type: 'js',
      role: 'Hello World component.',
      editable: true,
      visibility: 'project',
      content: createHelloWorldJs()
    },
    {
      id: 'adder-js',
      path: 'src/components/Adder.js',
      name: 'Adder.js',
      type: 'js',
      role: 'Adder component.',
      editable: true,
      visibility: 'project',
      content: createAdderJs()
    },
    {
      id: 'page-css',
      path: 'src/styles/page.css',
      name: 'page.css',
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
      description: 'Simple multi-file demo section.',
      bindings: {},
      repeat: false
    },
    {
      id: 'adder',
      title: 'Adder',
      type: 'content',
      description: 'Simple interactive calculator.',
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
