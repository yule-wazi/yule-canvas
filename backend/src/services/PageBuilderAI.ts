import { AIAdapterManager } from './AIAdapter';

export interface PageBuilderAITable {
  id: string;
  name: string;
  columns: Array<{ key: string; type: string }>;
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export interface PageBuilderAIInput {
  table: PageBuilderAITable;
  request: {
    tableId: string;
    goal?: string;
    title?: string;
    sectionHints?: string[];
    fieldHints?: Record<string, string>;
  };
  model?: string;
  options?: Record<string, any>;
}

export interface PageBuilderAIGeneratedFile {
  path: string;
  role: string;
  content: string;
}

export interface PageBuilderAIResult {
  summary: string;
  files: PageBuilderAIGeneratedFile[];
}

const PAGE_BUILDER_SYSTEM_PROMPT = `You generate files for a Vue page-builder workspace.
Output rules:
1. Output JSON only. No markdown or explanation.
2. Return shape: {"summary": string, "files": Array<{ "path": string, "role": string, "content": string }>}
3. Every file path must be inside public/ or src/.
4. Required files that should always exist in the result: public/index.html, src/main.js, src/App.vue, src/styles.css.
5. Additional files may be created under src/components/, src/data/, or src/spec/.
6. All Vue files must use standard SFC structure with <template> and <script setup>.
7. Use only Vue. Do not add third-party dependencies.
8. The output must be runnable inside a Sandpack Vue environment.
9. Keep imports explicit and local.
10. The generated page should visibly use the provided table data.

Data access contract:
- src/data/tableData.js must export:
  - tableMeta
  - getTableRows()
  - getTableSnapshot()
- Generated code should import from that file instead of inventing backend calls.
`;

function buildPrompt(input: PageBuilderAIInput) {
  return `Generate a Vue workspace for the current page-builder.

User request:
${JSON.stringify(input.request, null, 2)}

Selected data table:
${JSON.stringify(
    {
      id: input.table.id,
      name: input.table.name,
      columns: input.table.columns,
      rowCount: input.table.rowCount,
      sampleRows: input.table.sampleRows
    },
    null,
    2
  )}

Additional requirements:
- Create a visually intentional page, not a placeholder.
- Use the selected data table in the UI.
- Keep the file set practical and inspectable.
- Favor valid runnable code over ambitious but fragile code.
- Output JSON only.`;
}

function sanitizeJsonBlock(content: string) {
  return String(content || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseGeneratedPayload(content: string): PageBuilderAIResult {
  const parsed = JSON.parse(sanitizeJsonBlock(content));
  const files = normalizeFiles(parsed?.files);

  if (!files.length) {
    throw new Error('AI returned no usable files.');
  }

  return {
    summary: typeof parsed?.summary === 'string' ? parsed.summary.trim() : '',
    files
  };
}

function normalizeFiles(files: any): PageBuilderAIGeneratedFile[] {
  if (!Array.isArray(files)) {
    return [];
  }

  const deduped = new Map<string, PageBuilderAIGeneratedFile>();

  for (const file of files) {
    const path = typeof file?.path === 'string' ? file.path.trim().replace(/^\/+/, '') : '';
    const role = typeof file?.role === 'string' ? file.role.trim() : 'Generated file.';
    const content = typeof file?.content === 'string' ? file.content : '';

    if (!path || !content) {
      continue;
    }

    if (!isAllowedPath(path)) {
      continue;
    }

    deduped.set(path, {
      path,
      role,
      content
    });
  }

  return Array.from(deduped.values());
}

function isAllowedPath(path: string) {
  return path === 'public/index.html'
    || path === 'src/main.js'
    || path === 'src/App.vue'
    || path === 'src/styles.css'
    || path.startsWith('src/components/')
    || path.startsWith('src/data/')
    || path.startsWith('src/spec/');
}

function ensureCoreFiles(input: PageBuilderAIInput, files: PageBuilderAIGeneratedFile[]) {
  const result = new Map<string, PageBuilderAIGeneratedFile>();

  for (const file of files) {
    result.set(file.path, file);
  }

  if (!result.has('public/index.html')) {
    result.set('public/index.html', {
      path: 'public/index.html',
      role: 'HTML entry file.',
      content: createIndexHtml(input.request.title || `${input.table.name} Page`)
    });
  }

  if (!result.has('src/main.js')) {
    result.set('src/main.js', {
      path: 'src/main.js',
      role: 'Vue app bootstrap.',
      content: createMainJs()
    });
  }

  if (!result.has('src/data/tableData.js')) {
    result.set('src/data/tableData.js', {
      path: 'src/data/tableData.js',
      role: 'Table data adapter.',
      content: createTableDataJs(input.table)
    });
  }

  return Array.from(result.values());
}

function createIndexHtml(title: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
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

function createTableDataJs(table: PageBuilderAITable) {
  const tableMeta = {
    id: table.id,
    name: table.name,
    columns: table.columns,
    rowCount: table.rowCount
  };
  const rows = table.sampleRows;

  return `export const tableMeta = ${JSON.stringify(tableMeta, null, 2)};

const tableRows = ${JSON.stringify(rows, null, 2)};

export function getTableRows() {
  return tableRows;
}

export function getTableSnapshot() {
  return {
    table: tableMeta,
    rows: tableRows
  };
}
`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function generatePageWorkspace(
  aiManager: AIAdapterManager,
  input: PageBuilderAIInput
): Promise<PageBuilderAIResult> {
  const model = input.model || 'openrouter';
  const content = await aiManager.generateText(
    model,
    PAGE_BUILDER_SYSTEM_PROMPT,
    buildPrompt(input),
    {
      ...(input.options || {}),
      temperature: input.options?.temperature ?? 0.3,
      maxTokens: input.options?.maxTokens ?? 7000,
      timeoutMs: input.options?.timeoutMs ?? 120000
    }
  );

  const result = parseGeneratedPayload(content);

  return {
    summary: result.summary || 'AI generated a workspace draft.',
    files: ensureCoreFiles(input, result.files)
  };
}
