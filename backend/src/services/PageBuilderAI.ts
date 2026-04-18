import axios from 'axios';
import type { AIAdapterManager, AIModelAdapter } from './AIAdapter';

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
1. Do not output JSON.
2. Output only file blocks and one final summary block.
3. For each completed file, use exactly this shape:
<file path="src/App.vue" role="App root component">
...full file content...
</file>
4. After all files, output exactly one summary block:
<summary>One short summary sentence.</summary>
5. Every file path must be inside public/ or src/.
6. Required files that should always exist in the result: public/index.html, src/main.js, src/App.vue, src/styles.css.
7. Additional files may be created under src/components/, src/data/, or src/spec/.
8. All Vue files must use standard SFC structure with <template> and <script setup>.
9. Use only Vue. Do not add third-party dependencies.
10. Keep imports explicit and local.
11. The generated page should visibly use the provided table data.
12. Never wrap the whole answer in markdown fences.

Data access contract:
- src/data/tableData.js must export:
  - tableMeta
  - fetchTableRows()
  - fetchTableSnapshot()
  - getTableRows()
  - getTableSnapshot()
- Generated code should import from that file instead of inventing backend calls.
- src/data/tableData.js reads runtime data from the hidden internal bridge file src/data/__runtimeTableData.js.
- fetchTableRows() and fetchTableSnapshot() are async and must be used for runtime data loading.
- Do not hardcode sample rows into Vue components.
- Do not treat sampleRows as the real runtime dataset. They are only shape examples for field understanding.
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
- Load table rows at runtime via the shared data adapter.
- Do not call fetch() directly for table data inside Vue components.
- In Vue components, prefer onMounted plus ref/reactive state for fetched rows.
- Keep loading and error states simple but real.
- Finish one whole file before starting the next file block.
- Output only the file blocks and final summary block.`;
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

function normalizeFiles(files: PageBuilderAIGeneratedFile[]): PageBuilderAIGeneratedFile[] {
  const deduped = new Map<string, PageBuilderAIGeneratedFile>();

  for (const file of files) {
    const path = typeof file.path === 'string' ? file.path.trim().replace(/^\/+/, '') : '';
    const role = typeof file.role === 'string' ? file.role.trim() : 'Generated file.';
    const content = typeof file.content === 'string' ? file.content : '';

    if (!path || !content || !isAllowedPath(path)) {
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

  result.set('src/data/tableData.js', {
    path: 'src/data/tableData.js',
    role: 'Table data adapter.',
    content: createTableDataJs(input)
  });

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

function createTableDataJs(input: PageBuilderAIInput) {
  const table = input.table;
  const tableMeta = {
    id: table.id,
    name: table.name,
    columns: table.columns,
    rowCount: table.rowCount
  };
  return `import { readRuntimeTableSnapshot } from './__runtimeTableData.js';

export const tableMeta = ${JSON.stringify(tableMeta, null, 2)};

export async function fetchTableSnapshot() {
  return readRuntimeTableSnapshot();
}

export async function fetchTableRows() {
  const snapshot = await fetchTableSnapshot();
  return Array.isArray(snapshot?.rows) ? snapshot.rows : [];
}

export async function getTableRows() {
  return await fetchTableRows();
}

export async function getTableSnapshot() {
  const snapshot = await fetchTableSnapshot();
  return {
    table: tableMeta,
    ...snapshot,
    rows: Array.isArray(snapshot?.rows) ? snapshot.rows : [],
    table: {
      ...tableMeta,
      ...(snapshot?.table || {})
    }
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

function extractTextDelta(adapterId: string, payload: any): string {
  if (adapterId === 'qwen') {
    return '';
  }

  return String(payload?.choices?.[0]?.delta?.content || '');
}

async function streamProviderText(
  adapter: AIModelAdapter,
  input: PageBuilderAIInput,
  onTextChunk: (chunk: string) => void
) {
  if (adapter.id === 'qwen') {
    throw new Error('Qwen streaming is not supported for page builder yet.');
  }

  const apiKey = adapter.getApiKey(input.options || {});

  if (!apiKey) {
    throw new Error(`${adapter.name} API key is not configured.`);
  }

  const endpoint = adapter.getApiEndpoint();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(adapter.getHeaders?.(input.options || {}) || {})
  };
  const body = adapter.formatChatRequest(
    PAGE_BUILDER_SYSTEM_PROMPT,
    buildPrompt(input),
    {
      ...(input.options || {}),
      temperature: input.options?.temperature ?? 0.3,
      maxTokens: input.options?.maxTokens ?? 7000,
      timeoutMs: input.options?.timeoutMs ?? 120000,
      stream: true
    }
  );

  const response = await axios.post(endpoint, body, {
    headers,
    responseType: 'stream',
    timeout: input.options?.timeoutMs ?? 120000
  });

  await new Promise<void>((resolve, reject) => {
    let buffer = '';

    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const data = trimmed.slice(5).trim();

          if (!data || data === '[DONE]') {
            continue;
          }

          try {
            const payload = JSON.parse(data);
            const text = extractTextDelta(adapter.id, payload);

            if (text) {
              onTextChunk(text);
            }
          } catch {
            // Ignore malformed provider chunks and continue consuming the stream.
          }
        }
      }
    });

    response.data.on('end', () => resolve());
    response.data.on('error', (error: Error) => reject(error));
  });
}

function parseFileAttributes(attributeText: string) {
  const pathMatch = attributeText.match(/path="([^"]+)"/i);
  const roleMatch = attributeText.match(/role="([^"]*)"/i);

  return {
    path: pathMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || 'Generated file.'
  };
}

function extractCompletedFileBlocks(buffer: string) {
  const files: PageBuilderAIGeneratedFile[] = [];
  const fileRegex = /<file\s+([^>]+)>([\s\S]*?)<\/file>/i;
  let remaining = buffer;

  while (true) {
    const match = remaining.match(fileRegex);

    if (!match || match.index == null) {
      break;
    }

    const [fullMatch, attrs, content] = match;
    const { path, role } = parseFileAttributes(attrs);

    if (path && content.trim()) {
      files.push({
        path,
        role,
        content: content.trim()
      });
    }

    remaining = remaining.slice(match.index + fullMatch.length);
  }

  return {
    files,
    remaining
  };
}

function extractSummary(buffer: string) {
  const match = buffer.match(/<summary>([\s\S]*?)<\/summary>/i);
  return match?.[1]?.trim() || '';
}

function parseFinalFileBlocks(content: string) {
  const { files } = extractCompletedFileBlocks(content);
  const normalizedFiles = normalizeFiles(files);

  if (!normalizedFiles.length) {
    throw new Error('AI returned no usable files.');
  }

  return {
    summary: extractSummary(content) || 'AI generated a workspace draft.',
    files: normalizedFiles
  };
}

export async function generatePageWorkspace(
  aiManager: AIAdapterManager,
  input: PageBuilderAIInput
): Promise<PageBuilderAIResult> {
  const model = input.model || 'openrouter';
  const adapter = aiManager.getAdapter(model);

  if (!adapter) {
    throw new Error(`Unsupported model: ${model}`);
  }

  let streamedText = '';

  await streamProviderText(adapter, input, (chunk) => {
    streamedText += chunk;
  });

  const parsed = parseFinalFileBlocks(streamedText);

  return {
    summary: parsed.summary,
    files: ensureCoreFiles(input, parsed.files)
  };
}

export async function generatePageWorkspaceStream(
  aiManager: AIAdapterManager,
  input: PageBuilderAIInput,
  callbacks: {
    onFileDone?: (file: PageBuilderAIGeneratedFile) => void;
  } = {}
): Promise<PageBuilderAIResult> {
  const model = input.model || 'openrouter';
  const adapter = aiManager.getAdapter(model);

  if (!adapter) {
    throw new Error(`Unsupported model: ${model}`);
  }

  let rawText = '';
  let pendingBuffer = '';
  const streamedFiles = new Map<string, PageBuilderAIGeneratedFile>();

  await streamProviderText(adapter, input, (chunk) => {
    rawText += chunk;
    pendingBuffer += chunk;

    const extracted = extractCompletedFileBlocks(pendingBuffer);
    pendingBuffer = extracted.remaining;

    for (const file of normalizeFiles(extracted.files)) {
      if (streamedFiles.has(file.path)) {
        continue;
      }

      streamedFiles.set(file.path, file);
      callbacks.onFileDone?.(file);
    }
  });

  const parsed = parseFinalFileBlocks(rawText);
  const files = ensureCoreFiles(input, parsed.files);

  for (const file of files) {
    if (!streamedFiles.has(file.path)) {
      callbacks.onFileDone?.(file);
    }
  }

  return {
    summary: parsed.summary,
    files
  };
}
