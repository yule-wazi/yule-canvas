import { AIAdapterManager } from './AIAdapter';

export interface PageBuilderConversationTable {
  id: string;
  name: string;
  columns: Array<{ key: string; type: string }>;
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export interface PageBuilderConversationFile {
  path: string;
  role: string;
  content: string;
  visibility?: 'project' | 'internal';
  editable?: boolean;
}

export interface PageBuilderConversationHistoryItem {
  kind: 'message' | 'status' | 'file_operation_group';
  role?: 'user' | 'assistant';
  content?: string;
  label?: string;
  detail?: string;
  title?: string;
  subtitle?: string;
  actions?: Array<{
    action: 'create' | 'read' | 'update';
    path: string;
  }>;
}

export interface PageBuilderConversationInput {
  table: PageBuilderConversationTable;
  request: {
    tableId: string;
    goal?: string;
    title?: string;
  };
  conversation: {
    message: string;
    history?: PageBuilderConversationHistoryItem[];
  };
  workspace: {
    workspaceId?: string | null;
    selectedFilePath?: string | null;
    files: PageBuilderConversationFile[];
  };
  model?: string;
  options?: Record<string, any>;
}

export interface PageBuilderConversationGeneratedFile {
  path: string;
  role: string;
  content: string;
}

export interface PageBuilderConversationResult {
  intent: 'chat' | 'update' | 'create' | 'mixed';
  summary: string;
  message: string;
  files: PageBuilderConversationGeneratedFile[];
}

interface ConversationDecision {
  intent: 'chat' | 'update' | 'create' | 'mixed';
  action: 'respond' | 'search_workspace' | 'read_files' | 'apply_changes';
  reason: string;
  response?: string;
  query?: string;
  files?: string[];
}

const PROTECTED_WRITE_PATHS = new Set([
  'src/data/tableData.js',
  'src/data/__runtimeTableData.js'
]);

const DECISION_SYSTEM_PROMPT = `You orchestrate follow-up conversation for a Vue page-builder workspace.
Return JSON only.

Schema:
{
  "intent": "chat" | "update" | "create" | "mixed",
  "action": "respond" | "search_workspace" | "read_files" | "apply_changes",
  "reason": "short reason",
  "response": "only when action=respond",
  "query": "only when action=search_workspace",
  "files": ["path"] // only when action=read_files
}

Rules:
1. Prefer accuracy over speed.
2. Do not guess file contents that have not been read.
3. If the user asks about concrete implementation details, prefer read_files.
4. If the target file is ambiguous, use search_workspace.
5. If the user asks to modify code, prefer read_files before any file changes.
6. Keep file requests small and relevant, at most 4 files.
7. Never request or modify src/data/__runtimeTableData.js.
8. src/data/tableData.js is system-controlled and should not be modified.
9. Use respond only when the workspace tree and history are enough to answer safely.`;

const FINAL_SYSTEM_PROMPT = `You are continuing a Vue page-builder workspace conversation.

Output rules:
1. Do not output JSON.
2. Do not use markdown fences.
3. Always output exactly one <assistant_reply>...</assistant_reply> block.
4. If file changes are needed, output one or more <file path="..." role="...">...</file> blocks after the assistant reply.
5. Always end with exactly one <summary>...</summary> block.
6. Only include files that are new or changed in this turn.
7. Whole-file replacement is required for touched files.
8. Never output src/data/tableData.js or src/data/__runtimeTableData.js.
9. Keep imports explicit and local.
10. Preserve unrelated code in files you rewrite.
11. Keep code runnable inside the current Sandpack Vue environment.
12. Generated Vue code must keep using src/data/tableData.js for table data access.`;

function normalizePath(path: string) {
  return String(path || '').trim().replace(/^\/+/, '');
}

function isAllowedWritePath(path: string) {
  if (PROTECTED_WRITE_PATHS.has(path)) {
    return false;
  }

  return path === 'public/index.html'
    || path === 'src/main.js'
    || path === 'src/App.vue'
    || path === 'src/styles.css'
    || path.startsWith('src/components/')
    || path.startsWith('src/data/')
    || path.startsWith('src/spec/');
}

function buildWorkspaceTree(files: PageBuilderConversationFile[]) {
  return files
    .filter((file) => file.visibility !== 'internal' || file.path === 'src/data/tableData.js')
    .map((file) => ({
      path: normalizePath(file.path),
      role: file.role || 'Workspace file'
    }));
}

function summarizeHistory(history: PageBuilderConversationHistoryItem[] = []) {
  return history.slice(-10).map((item) => {
    if (item.kind === 'message') {
      return `${item.role || 'assistant'}: ${String(item.content || '').trim()}`;
    }

    if (item.kind === 'status') {
      return `status: ${String(item.label || '').trim()}${item.detail ? ` - ${String(item.detail).trim()}` : ''}`;
    }

    const actions = Array.isArray(item.actions)
      ? item.actions.map((action) => `${action.action} ${action.path}`).join(', ')
      : '';

    return `operations: ${String(item.title || '').trim()}${actions ? ` (${actions})` : ''}`;
  });
}

function parseJsonResponse<T>(content: string): T {
  return JSON.parse(String(content || '').trim()) as T;
}

function safeParseDecision(raw: string): ConversationDecision {
  const parsed = parseJsonResponse<Partial<ConversationDecision>>(raw);

  return {
    intent: parsed.intent === 'update' || parsed.intent === 'create' || parsed.intent === 'mixed' ? parsed.intent : 'chat',
    action: parsed.action === 'search_workspace' || parsed.action === 'read_files' || parsed.action === 'apply_changes' ? parsed.action : 'respond',
    reason: String(parsed.reason || '').trim() || 'No reason provided.',
    response: typeof parsed.response === 'string' ? parsed.response.trim() : undefined,
    query: typeof parsed.query === 'string' ? parsed.query.trim() : undefined,
    files: Array.isArray(parsed.files) ? parsed.files.map(normalizePath).filter(Boolean).slice(0, 4) : undefined
  };
}

function createFileLookup(files: PageBuilderConversationFile[]) {
  return new Map(files.map((file) => [normalizePath(file.path), { ...file, path: normalizePath(file.path) }]));
}

function scoreFileAgainstQuery(file: PageBuilderConversationFile, query: string) {
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery.split(/[\s/_.-]+/).filter(Boolean);
  const path = file.path.toLowerCase();
  const role = String(file.role || '').toLowerCase();
  const content = String(file.content || '').toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (path.includes(token)) {
      score += 5;
    }
    if (role.includes(token)) {
      score += 3;
    }
    if (content.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function searchWorkspace(files: PageBuilderConversationFile[], query: string) {
  return files
    .filter((file) => file.visibility !== 'internal')
    .map((file) => ({
      ...file,
      score: scoreFileAgainstQuery(file, query)
    }))
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function readFiles(files: PageBuilderConversationFile[], paths: string[]) {
  const fileLookup = createFileLookup(files);
  return paths
    .map((path) => fileLookup.get(normalizePath(path)))
    .filter((file): file is PageBuilderConversationFile => Boolean(file))
    .filter((file) => file.path !== 'src/data/__runtimeTableData.js')
    .slice(0, 4);
}

function buildDecisionPrompt(input: PageBuilderConversationInput) {
  return `Current user message:
${input.conversation.message}

Current workspace tree:
${JSON.stringify(buildWorkspaceTree(input.workspace.files), null, 2)}

Selected file:
${JSON.stringify(input.workspace.selectedFilePath || null)}

Recent conversation history:
${JSON.stringify(summarizeHistory(input.conversation.history), null, 2)}

Current page goal:
${JSON.stringify(input.request.goal || '')}

Current page title:
${JSON.stringify(input.request.title || '')}

Return only the JSON decision.`;
}

function buildFinalPrompt(
  input: PageBuilderConversationInput,
  decision: ConversationDecision,
  gatheredFiles: PageBuilderConversationFile[],
  searchResults: Array<{ path: string; role: string }>
) {
  return `Latest user message:
${input.conversation.message}

Decision:
${JSON.stringify(decision, null, 2)}

Current page goal:
${JSON.stringify(input.request.goal || '')}

Selected data table:
${JSON.stringify({
    id: input.table.id,
    name: input.table.name,
    columns: input.table.columns,
    rowCount: input.table.rowCount,
    sampleRows: input.table.sampleRows
  }, null, 2)}

Recent conversation history:
${JSON.stringify(summarizeHistory(input.conversation.history), null, 2)}

Workspace tree:
${JSON.stringify(buildWorkspaceTree(input.workspace.files), null, 2)}

Search results:
${JSON.stringify(searchResults, null, 2)}

Gathered file contents:
${JSON.stringify(gatheredFiles.map((file) => ({
    path: file.path,
    role: file.role,
    content: file.content
  })), null, 2)}

Behavior:
- If the user mainly asked a question, answer clearly and do not change files.
- If the user asked for a code change and the gathered files are enough, return only the changed files.
- If the request is still too ambiguous, use the assistant reply to ask a pointed clarification instead of guessing.
- Keep the assistant reply concise and collaborative.
- Never modify protected system-owned data adapter files.`;
}

function parseFileAttributes(attributeText: string) {
  const pathMatch = attributeText.match(/path="([^"]+)"/i);
  const roleMatch = attributeText.match(/role="([^"]*)"/i);

  return {
    path: pathMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || 'Updated file.'
  };
}

function extractCompletedFileBlocks(buffer: string) {
  const files: PageBuilderConversationGeneratedFile[] = [];
  const fileRegex = /<file\s+([^>]+)>([\s\S]*?)<\/file>/gi;
  let match: RegExpExecArray | null;

  match = fileRegex.exec(buffer);
  while (match) {
    const [, attrs, content] = match;
    const { path, role } = parseFileAttributes(attrs);

    if (path && content.trim()) {
      files.push({
        path: normalizePath(path),
        role,
        content: content.trim()
      });
    }

    match = fileRegex.exec(buffer);
  }

  return files;
}

function extractTagContent(buffer: string, tagName: string) {
  const match = buffer.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function normalizeChangedFiles(files: PageBuilderConversationGeneratedFile[]) {
  const deduped = new Map<string, PageBuilderConversationGeneratedFile>();

  for (const file of files) {
    const path = normalizePath(file.path);

    if (!path || !file.content.trim() || !isAllowedWritePath(path)) {
      continue;
    }

    deduped.set(path, {
      path,
      role: String(file.role || 'Updated file.').trim(),
      content: file.content
    });
  }

  return Array.from(deduped.values());
}

function parseFinalResponse(content: string): PageBuilderConversationResult {
  const message = extractTagContent(content, 'assistant_reply') || 'I reviewed the workspace and summarized the next step.';
  const summary = extractTagContent(content, 'summary') || message;
  const files = normalizeChangedFiles(extractCompletedFileBlocks(content));

  return {
    intent: 'chat',
    summary,
    message,
    files
  };
}

export async function runPageBuilderConversation(
  aiManager: AIAdapterManager,
  input: PageBuilderConversationInput,
  callbacks: {
    onStatus?: (status: { phase: 'inspect' | 'write'; tone: 'info' | 'thinking'; label: string; detail?: string }) => void;
    onFileOperation?: (operation: { action: 'create' | 'read' | 'update'; path: string }) => void;
    onAssistant?: (message: string) => void;
  } = {}
): Promise<PageBuilderConversationResult> {
  const model = input.model || 'openrouter';
  callbacks.onStatus?.({
    phase: 'inspect',
    tone: 'thinking',
    label: '正在梳理这轮需求',
    detail: '先判断这轮是解释、补充还是直接改动工作区'
  });

  const rawDecision = await aiManager.generateText(
    model,
    DECISION_SYSTEM_PROMPT,
    buildDecisionPrompt(input),
    {
      ...(input.options || {}),
      temperature: 0.1,
      maxTokens: 900,
      timeoutMs: input.options?.timeoutMs ?? 120000
    }
  );
  const decision = safeParseDecision(rawDecision);
  const searchResults: Array<{ path: string; role: string }> = [];
  let gatheredFiles: PageBuilderConversationFile[] = [];

  if (decision.action === 'respond' && decision.response) {
    callbacks.onAssistant?.(decision.response);

    return {
      intent: decision.intent,
      summary: decision.response,
      message: decision.response,
      files: []
    };
  }

  if (decision.action === 'search_workspace' && decision.query) {
    callbacks.onStatus?.({
      phase: 'inspect',
      tone: 'info',
      label: '正在对照工作区找相关位置',
      detail: decision.query
    });

    const matches = searchWorkspace(input.workspace.files, decision.query);
    searchResults.push(...matches.map((file) => ({
      path: file.path,
      role: file.role
    })));

    const autoReadPaths = matches.slice(0, 3).map((file) => file.path);
    gatheredFiles = readFiles(input.workspace.files, autoReadPaths);

    for (const file of gatheredFiles) {
      callbacks.onFileOperation?.({
        action: 'read',
        path: file.path
      });
    }
  }

  if (decision.action === 'read_files' && Array.isArray(decision.files) && decision.files.length) {
    callbacks.onStatus?.({
      phase: 'inspect',
      tone: 'info',
      label: '正在查看相关文件',
      detail: decision.reason
    });

    gatheredFiles = readFiles(input.workspace.files, decision.files);

    for (const file of gatheredFiles) {
      callbacks.onFileOperation?.({
        action: 'read',
        path: file.path
      });
    }
  }

  if (!gatheredFiles.length && decision.action === 'apply_changes') {
    const fallbackPaths = [
      normalizePath(input.workspace.selectedFilePath || ''),
      'src/App.vue'
    ].filter(Boolean);

    gatheredFiles = readFiles(input.workspace.files, fallbackPaths);

    if (gatheredFiles.length) {
      callbacks.onStatus?.({
        phase: 'inspect',
        tone: 'info',
        label: '先补一眼当前文件',
        detail: '避免直接在过时上下文上改动工作区'
      });

      for (const file of gatheredFiles) {
        callbacks.onFileOperation?.({
          action: 'read',
          path: file.path
        });
      }
    }
  }

  callbacks.onStatus?.({
    phase: decision.intent === 'chat' ? 'inspect' : 'write',
    tone: 'thinking',
    label: decision.intent === 'chat' ? '正在整理回答' : '正在收敛这轮改动',
    detail: decision.reason
  });

  const rawFinal = await aiManager.generateText(
    model,
    FINAL_SYSTEM_PROMPT,
    buildFinalPrompt(input, decision, gatheredFiles, searchResults),
    {
      ...(input.options || {}),
      temperature: 0.2,
      maxTokens: 7000,
      timeoutMs: input.options?.timeoutMs ?? 180000
    }
  );

  const parsed = parseFinalResponse(rawFinal);
  parsed.intent = decision.intent;

  callbacks.onAssistant?.(parsed.message);

  for (const file of parsed.files) {
    callbacks.onFileOperation?.({
      action: createFileLookup(input.workspace.files).has(file.path) ? 'update' : 'create',
      path: file.path
    });
  }

  return parsed;
}
