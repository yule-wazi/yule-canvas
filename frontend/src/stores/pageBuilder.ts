import { defineStore } from 'pinia';
import type { DataTable } from './dataTable';
import {
  createProjectFromGeneratedFiles,
  inferFieldRoles,
  mergeGeneratedFilesIntoProject,
  streamAIPageBuilderConversation,
  streamAIPageBuilderWorkspace
} from '../services/pageBuilder';
import type {
  PageBuilderAIConfig,
  PageBuilderAIProvider,
  PageBindingContract,
  PageBuildRequest,
  PageBuilderCenterMode,
  PageBuilderConversationHistoryItem,
  PageBuilderConversationItem,
  PageBuilderConversationMessage,
  PageBuilderConversationOperationTone,
  PageBuilderDrawerMode,
  PageBuilderFile,
  PageBuilderFileOperationAction,
  PageBuilderGeneratedFile,
  PageBuilderPreviewSelection,
  PageBuilderProject,
  PageBuilderSectionSummary,
  PageBuilderTreeNode,
  PageBuilderWorkspaceMeta,
  PageSpec,
  SavedPageBuilderWorkspace
} from '../types/pageBuilder';

interface PageBuilderState {
  currentWorkspaceId: string | null;
  previewReloadKey: number;
  workspaceName: string;
  selectedTableId: string | null;
  pageTitle: string;
  goal: string;
  fieldRoleMap: Record<string, string>;
  spec: PageSpec | null;
  project: PageBuilderProject | null;
  activeFileId: string | null;
  selectedSectionId: string | null;
  selectedPreviewElement: PageBuilderPreviewSelection | null;
  centerMode: PageBuilderCenterMode;
  error: string | null;
  isGenerating: boolean;
  lastGenerationSummary: string;
  aiProvider: PageBuilderAIProvider;
  aiApiKey: string;
  aiModel: string;
  isSetupDrawerOpen: boolean;
  drawerMode: PageBuilderDrawerMode;
  conversationDraft: string;
  conversationMessages: PageBuilderConversationItem[];
  activeOperationGroupId: string | null;
  sectionSummaries: PageBuilderSectionSummary[];
  savedWorkspaces: PageBuilderWorkspaceMeta[];
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
  hasHydratedWorkspace: boolean;
}

const PAGE_BUILDER_AI_STORAGE_KEY = 'page_builder_ai_config';
const PAGE_BUILDER_WORKSPACES_KEY = 'page_builder_workspaces';
const CURRENT_PAGE_BUILDER_WORKSPACE_ID_KEY = 'current_page_builder_workspace_id';
const DEFAULT_PAGE_BUILDER_GOAL = '帮我生成一个可滚动展示图片卡片的网站';
const DEFAULT_WORKSPACE_NAME = 'Untitled Workspace';
const DEFAULT_PAGE_BUILDER_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function createWorkspaceId() {
  return `page-builder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createConversationMessage(role: 'user' | 'assistant', content: string): PageBuilderConversationMessage {
  return {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'message',
    role,
    content: content.trim(),
    createdAt: Date.now()
  };
}

function createStatusItem(label: string, detail?: string, tone: 'info' | 'thinking' = 'info') {
  return {
    id: `status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'status' as const,
    tone,
    label: label.trim(),
    detail: detail?.trim() || undefined,
    createdAt: Date.now()
  };
}

function createOperationGroup(
  title = '处理中',
  subtitle = '正在整理当前操作',
  tone: PageBuilderConversationOperationTone = 'neutral'
) {
  return {
    id: `operation-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'file_operation_group' as const,
    status: 'running' as const,
    createdAt: Date.now(),
    title,
    subtitle,
    tone,
    items: []
  };
}

function normalizeConversationItems(items: unknown): PageBuilderConversationItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const candidate = item as Record<string, any>;

    if (candidate.kind === 'status' && typeof candidate.label === 'string') {
      return [{
        id: typeof candidate.id === 'string' ? candidate.id : createStatusItem(candidate.label, candidate.detail, candidate.tone === 'thinking' ? 'thinking' : 'info').id,
        kind: 'status' as const,
        tone: candidate.tone === 'thinking' ? 'thinking' : 'info',
        label: candidate.label.trim(),
        detail: typeof candidate.detail === 'string' ? candidate.detail.trim() || undefined : undefined,
        createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now()
      }];
    }

    if (candidate.kind === 'file_operation_group') {
      return [{
        id: typeof candidate.id === 'string' ? candidate.id : createOperationGroup().id,
        kind: 'file_operation_group' as const,
        status: candidate.status === 'done' ? 'done' : 'running',
        createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
        title: typeof candidate.title === 'string' ? candidate.title : '处理中',
        subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle : '正在整理当前操作',
        tone: candidate.tone === 'inspect' || candidate.tone === 'write' ? candidate.tone : 'neutral',
        items: Array.isArray(candidate.items)
          ? candidate.items
              .filter((entry) => entry && typeof entry === 'object')
              .map((entry: any, index: number) => ({
                id: typeof entry.id === 'string' ? entry.id : `operation-${Date.now()}-${index}`,
                action: entry.action === 'read' || entry.action === 'update' ? entry.action : 'create',
                path: typeof entry.path === 'string' ? entry.path : '',
                createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now()
              }))
              .filter((entry: { path: string }) => entry.path)
          : []
      }];
    }

    if (typeof candidate.role === 'string' && typeof candidate.content === 'string') {
      return [{
        id: typeof candidate.id === 'string' ? candidate.id : `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'message' as const,
        role: candidate.role === 'assistant' ? 'assistant' : 'user',
        content: candidate.content.trim(),
        createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now()
      }];
    }

    return [];
  });
}

function normalizeWorkspaceName(name: string) {
  return name.trim() || DEFAULT_WORKSPACE_NAME;
}

function readSavedWorkspaces(): SavedPageBuilderWorkspace[] {
  const raw = localStorage.getItem(PAGE_BUILDER_WORKSPACES_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedWorkspaces(workspaces: SavedPageBuilderWorkspace[]) {
  localStorage.setItem(PAGE_BUILDER_WORKSPACES_KEY, JSON.stringify(workspaces));
}

function toWorkspaceMeta(workspace: SavedPageBuilderWorkspace): PageBuilderWorkspaceMeta {
  return {
    id: workspace.id,
    name: workspace.name,
    selectedTableId: workspace.selectedTableId,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}

function sortWorkspaceMeta(workspaces: PageBuilderWorkspaceMeta[]) {
  return [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const usePageBuilderStore = defineStore('pageBuilder', {
  state: (): PageBuilderState => ({
    currentWorkspaceId: null,
    previewReloadKey: 0,
    workspaceName: DEFAULT_WORKSPACE_NAME,
    selectedTableId: null,
    pageTitle: '',
    goal: DEFAULT_PAGE_BUILDER_GOAL,
    fieldRoleMap: {},
    spec: null,
    project: null,
    activeFileId: null,
    selectedSectionId: null,
    selectedPreviewElement: null,
    centerMode: 'preview',
    error: null,
    isGenerating: false,
    lastGenerationSummary: '',
    aiProvider: 'siliconflow',
    aiApiKey: '',
    aiModel: '',
    isSetupDrawerOpen: true,
    drawerMode: 'setup',
    conversationDraft: '',
    conversationMessages: [],
    activeOperationGroupId: null,
    sectionSummaries: [],
    savedWorkspaces: [],
    hasUnsavedChanges: false,
    lastSavedAt: null,
    hasHydratedWorkspace: false
  }),

  getters: {
    files(state): PageBuilderFile[] {
      return state.project?.files.filter((file) => file.visibility === 'project') || [];
    },
    tree(state): PageBuilderTreeNode[] {
      return state.project?.tree || [];
    },
    bindingContract(state): PageBindingContract | null {
      return state.project?.bindingContract || null;
    },
    activeFile(state) {
      return state.project?.files.find((file) => file.id === state.activeFileId) || null;
    }
  },

  actions: {
    bumpPreviewReload() {
      this.previewReloadKey += 1;
    },

    initialize(tables: DataTable[]) {
      this.loadAIConfig();

      if (!this.hasHydratedWorkspace) {
        this.hydrateWorkspaceState(tables);
        this.hasHydratedWorkspace = true;
        return;
      }

      this.syncWithTables(tables);
    },

    syncWithTables(tables: DataTable[]) {
      if (!tables.length) {
        this.selectedTableId = null;
        this.fieldRoleMap = {};
        return;
      }

      if (!this.selectedTableId || !tables.some((table) => table.id === this.selectedTableId)) {
        this.selectedTableId = tables[0].id;
      }

      const table = tables.find((item) => item.id === this.selectedTableId) || null;
      this.fieldRoleMap = inferFieldRoles(table);

      if (!this.pageTitle) {
        this.pageTitle = this.workspaceName !== DEFAULT_WORKSPACE_NAME
          ? this.workspaceName
          : `${table?.name || 'Page'} Page`;
      }
    },

    hydrateWorkspaceState(tables: DataTable[]) {
      const savedWorkspaces = readSavedWorkspaces();
      this.savedWorkspaces = sortWorkspaceMeta(savedWorkspaces.map(toWorkspaceMeta));

      const currentWorkspaceId = localStorage.getItem(CURRENT_PAGE_BUILDER_WORKSPACE_ID_KEY);
      const currentWorkspace = savedWorkspaces.find((workspace) => workspace.id === currentWorkspaceId)
        || savedWorkspaces[0];

      if (currentWorkspace) {
        this.loadWorkspaceSnapshot(currentWorkspace, tables);
        return;
      }

      this.createWorkspace(tables);
    },

    loadWorkspaceSnapshot(snapshot: SavedPageBuilderWorkspace, tables: DataTable[]) {
      this.currentWorkspaceId = snapshot.id;
      this.workspaceName = normalizeWorkspaceName(snapshot.name);
      this.selectedTableId = snapshot.selectedTableId;
      this.pageTitle = snapshot.pageTitle;
      this.goal = snapshot.goal || DEFAULT_PAGE_BUILDER_GOAL;
      this.fieldRoleMap = snapshot.fieldRoleMap || {};
      this.spec = snapshot.spec;
      this.project = snapshot.project;
      this.activeFileId = snapshot.activeFileId;
      this.selectedSectionId = snapshot.selectedSectionId;
      this.selectedPreviewElement = null;
      this.centerMode = snapshot.centerMode || 'preview';
      this.lastGenerationSummary = snapshot.lastGenerationSummary || '';
      this.drawerMode = snapshot.drawerMode || (snapshot.project ? 'conversation' : 'setup');
      this.conversationDraft = snapshot.conversationDraft || '';
      this.conversationMessages = normalizeConversationItems(snapshot.conversationMessages);
      this.activeOperationGroupId = null;
      this.sectionSummaries = snapshot.sectionSummaries || [];
      this.error = null;
      this.hasUnsavedChanges = false;
      this.lastSavedAt = snapshot.updatedAt;
      this.isSetupDrawerOpen = true;

      localStorage.setItem(CURRENT_PAGE_BUILDER_WORKSPACE_ID_KEY, snapshot.id);
      this.syncWithTables(tables);
      this.bumpPreviewReload();
    },

    createSnapshot(): SavedPageBuilderWorkspace | null {
      if (!this.currentWorkspaceId) {
        return null;
      }

      const now = Date.now();
      const previous = readSavedWorkspaces().find((workspace) => workspace.id === this.currentWorkspaceId);

      return {
        id: this.currentWorkspaceId,
        name: normalizeWorkspaceName(this.workspaceName),
        selectedTableId: this.selectedTableId,
        pageTitle: this.pageTitle,
        goal: this.goal,
        drawerMode: this.drawerMode,
        conversationDraft: this.conversationDraft,
        conversationMessages: this.conversationMessages,
        fieldRoleMap: this.fieldRoleMap,
        spec: this.spec,
        project: this.project,
        activeFileId: this.activeFileId,
        selectedSectionId: this.selectedSectionId,
        centerMode: this.centerMode,
        lastGenerationSummary: this.lastGenerationSummary,
        sectionSummaries: this.sectionSummaries,
        createdAt: previous?.createdAt || now,
        updatedAt: now
      };
    },

    persistCurrentWorkspace() {
      const snapshot = this.createSnapshot();

      if (!snapshot) {
        return;
      }

      const savedWorkspaces = readSavedWorkspaces();
      const nextWorkspaces = savedWorkspaces.filter((workspace) => workspace.id !== snapshot.id);
      nextWorkspaces.unshift(snapshot);

      writeSavedWorkspaces(nextWorkspaces);
      localStorage.setItem(CURRENT_PAGE_BUILDER_WORKSPACE_ID_KEY, snapshot.id);

      this.savedWorkspaces = sortWorkspaceMeta(nextWorkspaces.map(toWorkspaceMeta));
      this.hasUnsavedChanges = false;
      this.lastSavedAt = snapshot.updatedAt;
    },

    schedulePersist(markDirty = true) {
      if (!this.currentWorkspaceId) {
        return;
      }

      if (markDirty) {
        this.hasUnsavedChanges = true;
      }

      if (persistTimer) {
        clearTimeout(persistTimer);
      }

      persistTimer = setTimeout(() => {
        this.persistCurrentWorkspace();
        persistTimer = null;
      }, markDirty ? 450 : 120);
    },

    setSelectedTable(tableId: string, tables: DataTable[]) {
      this.selectedTableId = tableId;
      const table = tables.find((item) => item.id === tableId) || null;
      this.fieldRoleMap = inferFieldRoles(table);

      if (!this.pageTitle || this.pageTitle === `${table?.name || 'Page'} Page`) {
        this.pageTitle = `${table?.name || 'Page'} Page`;
      }

      this.schedulePersist(true);
    },

    setWorkspaceName(value: string) {
      const previousName = this.workspaceName;
      const nextName = normalizeWorkspaceName(value);
      this.workspaceName = nextName;

      if (!this.pageTitle || this.pageTitle === previousName) {
        this.pageTitle = nextName;
      }

      this.schedulePersist(true);
    },

    renameWorkspace(workspaceId: string, value: string) {
      const nextName = normalizeWorkspaceName(value);

      if (this.currentWorkspaceId === workspaceId) {
        this.setWorkspaceName(nextName);
        return;
      }

      const savedWorkspaces = readSavedWorkspaces();
      const target = savedWorkspaces.find((workspace) => workspace.id === workspaceId);

      if (!target) {
        this.error = 'Workspace not found in local storage.';
        return;
      }

      target.name = nextName;
      target.updatedAt = Date.now();

      writeSavedWorkspaces(savedWorkspaces);
      this.savedWorkspaces = sortWorkspaceMeta(savedWorkspaces.map(toWorkspaceMeta));
    },

    setGoal(value: string) {
      this.goal = value;
      this.schedulePersist(true);
    },

    setConversationDraft(value: string) {
      this.conversationDraft = value;
      this.schedulePersist(false);
    },

    setCenterMode(mode: PageBuilderCenterMode) {
      this.centerMode = mode;
      this.schedulePersist(false);
    },

    setActiveFile(fileId: string) {
      this.activeFileId = fileId;
      this.schedulePersist(false);
    },

    updateActiveFileContent(content: string) {
      const project = this.project;
      const activeFileId = this.activeFileId;

      if (!project || !activeFileId) {
        return;
      }

      project.files = project.files.map((file) => (
        file.id === activeFileId
          ? { ...file, content }
          : file
      ));

      this.schedulePersist(true);
    },

    selectSection(sectionId: string) {
      this.selectedSectionId = sectionId;
      this.schedulePersist(false);
    },

    selectPreviewElement(selection: PageBuilderPreviewSelection) {
      this.selectedPreviewElement = selection;
      this.selectedSectionId = selection.sectionId;
      const relatedFile = this.project?.files.find((file) => selection.relatedFilePaths.includes(file.path));

      if (relatedFile) {
        this.activeFileId = relatedFile.id;
      }

      this.schedulePersist(false);
    },

    clearPreviewSelection() {
      this.selectedPreviewElement = null;
      this.schedulePersist(false);
    },

    setError(message: string | null) {
      this.error = message;
    },

    pushConversationMessage(role: 'user' | 'assistant', content: string) {
      const normalized = content.trim();

      if (!normalized) {
        return;
      }

      this.conversationMessages = [
        ...this.conversationMessages,
        createConversationMessage(role, normalized)
      ];
      this.schedulePersist(false);
    },

    pushConversationStatus(label: string, detail?: string, tone: 'info' | 'thinking' = 'info') {
      const normalizedLabel = label.trim();

      if (!normalizedLabel) {
        return;
      }

      this.conversationMessages = [
        ...this.conversationMessages,
        createStatusItem(normalizedLabel, detail, tone)
      ];
      this.schedulePersist(false);
    },

    startFileOperationGroup(
      title = '处理中',
      subtitle = '正在整理当前操作',
      tone: PageBuilderConversationOperationTone = 'neutral'
    ) {
      const group = createOperationGroup(title, subtitle, tone);
      this.activeOperationGroupId = group.id;
      this.conversationMessages = [
        ...this.conversationMessages,
        group
      ];
      this.schedulePersist(false);
    },

    updateActiveOperationGroup(details: {
      title?: string;
      subtitle?: string;
      tone?: PageBuilderConversationOperationTone;
    }) {
      if (!this.activeOperationGroupId) {
        return;
      }

      this.conversationMessages = this.conversationMessages.map((item) => {
        if (item.kind !== 'file_operation_group' || item.id !== this.activeOperationGroupId) {
          return item;
        }

        return {
          ...item,
          title: details.title ?? item.title,
          subtitle: details.subtitle ?? item.subtitle,
          tone: details.tone ?? item.tone
        };
      });
      this.schedulePersist(false);
    },

    appendFileOperation(action: PageBuilderFileOperationAction, path: string) {
      const normalizedPath = path.trim();

      if (!this.activeOperationGroupId || !normalizedPath) {
        return;
      }

      this.conversationMessages = this.conversationMessages.map((item) => {
        if (item.kind !== 'file_operation_group' || item.id !== this.activeOperationGroupId) {
          return item;
        }

        return {
          ...item,
          items: [
            ...item.items,
            {
              id: `operation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              action,
              path: normalizedPath,
              createdAt: Date.now()
            }
          ]
        };
      });
      this.schedulePersist(false);
    },

    finishFileOperationGroup(finalSubtitle?: string, finalTitle?: string) {
      if (!this.activeOperationGroupId) {
        return;
      }

      this.conversationMessages = this.conversationMessages.map((item) => {
        if (item.kind !== 'file_operation_group' || item.id !== this.activeOperationGroupId) {
          return item;
        }

        return {
          ...item,
          status: 'done',
          title: finalTitle ?? item.title,
          subtitle: finalSubtitle ?? item.subtitle
        };
      });
      this.activeOperationGroupId = null;
      this.schedulePersist(false);
    },

    buildConversationHistory(): PageBuilderConversationHistoryItem[] {
      return this.conversationMessages.slice(-12).flatMap((item) => {
        if (item.kind === 'message') {
          return [{
            kind: item.kind,
            role: item.role,
            content: item.content
          }];
        }

        if (item.kind === 'status') {
          return [{
            kind: item.kind,
            tone: item.tone,
            label: item.label,
            detail: item.detail
          }];
        }

        return [{
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle,
          status: item.status,
          actions: item.items.map((entry) => ({
            action: entry.action,
            path: entry.path
          }))
        }];
      });
    },

    buildConversationWorkspace() {
      return {
        workspaceId: this.currentWorkspaceId,
        selectedFilePath: this.activeFile?.path || null,
        files: (this.project?.files || []).map((file) => ({
          path: file.path,
          role: file.role,
          content: file.content,
          visibility: file.visibility,
          editable: file.editable
        }))
      };
    },

    applyConversationFileChanges(files: PageBuilderGeneratedFile[]) {
      if (!this.project || !files.length) {
        return;
      }

      const previousPaths = new Set(this.project.files.map((file) => file.path));
      const nextProject = mergeGeneratedFilesIntoProject(this.project, files);
      const firstChangedFile = files
        .map((file) => nextProject.files.find((entry) => entry.path === file.path))
        .find(Boolean);

      this.project = nextProject;
      this.activeFileId = firstChangedFile?.id || this.activeFileId;
      this.centerMode = 'preview';
      this.selectedPreviewElement = null;
      this.selectedSectionId = this.selectedSectionId;
      this.bumpPreviewReload();
      this.schedulePersist(true);

      return previousPaths;
    },

    buildConversationGoal() {
      const messages = this.conversationMessages
        .filter((message): message is PageBuilderConversationMessage => (
          message.kind === 'message' && message.role === 'user'
        ))
        .map((message) => message.content.trim())
        .filter(Boolean);

      return messages.length ? messages.join('\n\n') : this.goal;
    },

    getAIConfig(): PageBuilderAIConfig {
      return {
        provider: this.aiProvider,
        apiKey: this.aiApiKey.trim(),
        model: this.aiModel.trim()
      };
    },

    loadAIConfig() {
      const saved = localStorage.getItem(PAGE_BUILDER_AI_STORAGE_KEY);

      if (!saved) {
        if (!this.aiModel) {
          this.aiModel = DEFAULT_PAGE_BUILDER_MODEL;
        }
        return;
      }

      try {
        const parsed = JSON.parse(saved) as Partial<PageBuilderAIConfig>;
        this.aiProvider = parsed.provider === 'openrouter' || parsed.provider === 'qwen' || parsed.provider === 'siliconflow'
          ? parsed.provider
          : 'siliconflow';
        this.aiApiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
        this.aiModel = typeof parsed.model === 'string' ? parsed.model : '';
      } catch {
        this.aiProvider = 'siliconflow';
        this.aiApiKey = '';
        this.aiModel = '';
      }

      if (!this.aiModel) {
        this.aiModel = this.getDefaultModelForProvider(this.aiProvider);
      }
    },

    saveAIConfig() {
      localStorage.setItem(
        PAGE_BUILDER_AI_STORAGE_KEY,
        JSON.stringify({
          provider: this.aiProvider,
          apiKey: this.aiApiKey,
          model: this.aiModel
        } satisfies PageBuilderAIConfig)
      );
    },

    getDefaultModelForProvider(provider: PageBuilderAIProvider) {
      switch (provider) {
        case 'openrouter':
          return 'openai/gpt-4.1-mini';
        case 'qwen':
          return 'qwen-turbo';
        case 'siliconflow':
        default:
          return DEFAULT_PAGE_BUILDER_MODEL;
      }
    },

    setAIProvider(provider: PageBuilderAIProvider) {
      this.aiProvider = provider;

      if (!this.aiModel || this.aiModel === this.getDefaultModelForProvider('siliconflow') || this.aiModel === this.getDefaultModelForProvider('openrouter') || this.aiModel === this.getDefaultModelForProvider('qwen')) {
        this.aiModel = this.getDefaultModelForProvider(provider);
      }

      this.saveAIConfig();
    },

    setAIApiKey(value: string) {
      this.aiApiKey = value;
      this.saveAIConfig();
    },

    setAIModel(value: string) {
      this.aiModel = value;
      this.saveAIConfig();
    },

    applyWorkspaceResult(
      nextWorkspace: {
        fieldRoleMap: Record<string, string>;
        spec: PageSpec;
        project: PageBuilderProject;
        sectionSummaries: PageBuilderSectionSummary[];
      },
      summary = ''
    ) {
      const shouldForcePreviewReload = !this.project;

      this.error = null;
      this.fieldRoleMap = nextWorkspace.fieldRoleMap;
      this.spec = nextWorkspace.spec;
      this.project = nextWorkspace.project;
      this.activeFileId = nextWorkspace.project.files.find((file) => file.visibility === 'project')?.id || null;
      this.sectionSummaries = nextWorkspace.sectionSummaries;
      this.selectedSectionId = nextWorkspace.sectionSummaries[0]?.id || null;
      this.selectedPreviewElement = null;
      this.centerMode = 'preview';
      this.isSetupDrawerOpen = true;
      this.drawerMode = 'conversation';
      this.lastGenerationSummary = summary;

      if (!this.workspaceName || this.workspaceName === DEFAULT_WORKSPACE_NAME) {
        this.workspaceName = this.pageTitle || DEFAULT_WORKSPACE_NAME;
      }

      if (shouldForcePreviewReload) {
        this.bumpPreviewReload();
      }

      this.persistCurrentWorkspace();
    },

    toggleSetupDrawer(force?: boolean) {
      this.isSetupDrawerOpen = typeof force === 'boolean' ? force : !this.isSetupDrawerOpen;
    },

    createWorkspace(tables: DataTable[], name?: string) {
      const table = tables.find((item) => item.id === this.selectedTableId) || tables[0] || null;
      const workspaceName = normalizeWorkspaceName(name || (table ? `${table.name} Workspace` : DEFAULT_WORKSPACE_NAME));

      this.currentWorkspaceId = createWorkspaceId();
      this.workspaceName = workspaceName;
      this.selectedTableId = table?.id || null;
      this.pageTitle = table ? `${table.name} Page` : workspaceName;
      this.goal = DEFAULT_PAGE_BUILDER_GOAL;
      this.fieldRoleMap = inferFieldRoles(table);
      this.spec = null;
      this.project = null;
      this.activeFileId = null;
      this.selectedSectionId = null;
      this.selectedPreviewElement = null;
      this.centerMode = 'preview';
      this.error = null;
      this.isGenerating = false;
      this.lastGenerationSummary = '';
      this.isSetupDrawerOpen = true;
      this.drawerMode = 'setup';
      this.conversationDraft = '';
      this.conversationMessages = [];
      this.activeOperationGroupId = null;
      this.sectionSummaries = [];
      this.hasUnsavedChanges = false;

      this.persistCurrentWorkspace();
    },

    switchWorkspace(workspaceId: string, tables: DataTable[]) {
      const snapshot = readSavedWorkspaces().find((workspace) => workspace.id === workspaceId);

      if (!snapshot) {
        this.error = 'Workspace not found in local storage.';
        return;
      }

      this.loadWorkspaceSnapshot(snapshot, tables);
    },

    deleteWorkspace(workspaceId: string, tables: DataTable[]) {
      const savedWorkspaces = readSavedWorkspaces().filter((workspace) => workspace.id !== workspaceId);
      writeSavedWorkspaces(savedWorkspaces);
      this.savedWorkspaces = sortWorkspaceMeta(savedWorkspaces.map(toWorkspaceMeta));

      if (this.currentWorkspaceId !== workspaceId) {
        return;
      }

      const nextWorkspace = savedWorkspaces[0];

      if (nextWorkspace) {
        this.loadWorkspaceSnapshot(nextWorkspace, tables);
        return;
      }

      localStorage.removeItem(CURRENT_PAGE_BUILDER_WORKSPACE_ID_KEY);
      this.createWorkspace(tables);
    },

    async createWorkspaceFromAI(tables: DataTable[]) {
      const table = tables.find((item) => item.id === this.selectedTableId);

      if (!table) {
        this.error = 'Select a data table before generating with AI.';
        return;
      }

      const userGoal = this.goal.trim();
      const request: PageBuildRequest = {
        tableId: table.id,
        title: this.pageTitle || this.workspaceName || `${table.name} Page`,
        goal: userGoal || undefined
      };

      this.isGenerating = true;
      this.error = null;
      this.drawerMode = 'conversation';
      this.isSetupDrawerOpen = true;
      this.conversationMessages = [];
      this.activeOperationGroupId = null;
      this.conversationDraft = '';

      if (userGoal) {
        this.pushConversationMessage('user', userGoal);
      }

      try {
        const aiConfig = this.getAIConfig();

        if (!aiConfig.apiKey) {
          this.error = 'Enter an AI API key before generating with AI.';
          return;
        }

        const existingPaths = new Set(this.files.map((file) => file.path));
        this.startFileOperationGroup('正在生成首版工作区', '先搭好第一批可预览文件', 'write');

        await streamAIPageBuilderWorkspace(table, request, aiConfig, {
          onFileDone: ({ file }) => {
            const normalizedPath = file.path.replace(/^\/+/, '');
            const action: PageBuilderFileOperationAction = existingPaths.has(normalizedPath) ? 'update' : 'create';
            this.appendFileOperation(action, normalizedPath);
            existingPaths.add(normalizedPath);
          },
          onDone: ({ summary, files }) => {
            this.finishFileOperationGroup('工作区已经准备好，可以继续对话微调了', '已生成首版工作区');
            const nextWorkspace = createProjectFromGeneratedFiles(table, request, files);
            this.applyWorkspaceResult(nextWorkspace, summary);
          }
        });
      } catch (error: any) {
        this.error = error?.message || 'AI page generation failed.';
        this.finishFileOperationGroup('这次生成没有走完，稍后可以直接继续重试', '生成中断');
      } finally {
        this.isGenerating = false;
      }
    },

    async sendConversationMessage(tables: DataTable[]) {
      const message = this.conversationDraft.trim();

      if (!message) {
        return;
      }

      const table = tables.find((item) => item.id === this.selectedTableId);

      if (!table) {
        this.error = 'Select a data table before sending a message.';
        return;
      }

      this.pushConversationMessage('user', message);
      this.conversationDraft = '';
      this.isGenerating = true;
      this.error = null;
      this.drawerMode = 'conversation';
      this.isSetupDrawerOpen = true;
      this.activeOperationGroupId = null;

      const request: PageBuildRequest = {
        tableId: table.id,
        title: this.pageTitle || this.workspaceName || `${table.name} Page`,
        goal: this.goal.trim() || undefined
      };

      try {
        const aiConfig = this.getAIConfig();

        if (!aiConfig.apiKey) {
          this.error = 'Enter an AI API key before sending a message.';
          return;
        }

        await streamAIPageBuilderConversation(
          table,
          request,
          message,
          this.buildConversationHistory(),
          this.buildConversationWorkspace(),
          aiConfig,
          {
            onStatus: ({ detail, phase }) => {
              if (phase === 'inspect') {
                if (!this.activeOperationGroupId) {
                  this.startFileOperationGroup('正在查看当前工作区', detail || '先确认这轮对话需要哪些上下文', 'inspect');
                } else {
                  this.updateActiveOperationGroup({
                    title: '正在查看当前工作区',
                    subtitle: detail || '先确认这轮对话需要哪些上下文',
                    tone: 'inspect'
                  });
                }
                return;
              }

              if (this.activeOperationGroupId) {
                this.finishFileOperationGroup('需要的上下文已经整理好，开始落结果', '已查看当前工作区');
              }

              this.startFileOperationGroup('正在整理改动结果', detail || '把这一轮的改动收敛成最终文件', 'write');
            },
            onFileOperation: ({ action, path }) => {
              if (!this.activeOperationGroupId) {
                this.startFileOperationGroup(
                  action === 'read' ? '正在查看当前工作区' : '正在整理改动结果',
                  action === 'read' ? '先读清当前文件，再继续回答或修改' : '把这轮结果落成可预览文件',
                  action === 'read' ? 'inspect' : 'write'
                );
              }

              this.appendFileOperation(action, path);
            },
            onAssistant: ({ message: assistantMessage }) => {
              this.pushConversationMessage('assistant', assistantMessage);
            },
            onDone: ({ summary, message: assistantMessage, files }) => {
              if (files.length) {
                this.applyConversationFileChanges(files);
              }

              const lastAssistantMessage = [...this.conversationMessages]
                .reverse()
                .find((item): item is PageBuilderConversationMessage => item.kind === 'message' && item.role === 'assistant');

              if (!assistantMessage.trim() || lastAssistantMessage?.content !== assistantMessage.trim()) {
                this.pushConversationMessage('assistant', assistantMessage || summary);
              }

              if (this.activeOperationGroupId) {
                this.finishFileOperationGroup(
                  files.length ? '这轮结果已经同步到工作区和预览' : '这轮主要是说明和建议，没有改动文件',
                  files.length ? '已整理改动结果' : '已完成本轮说明'
                );
              }

              this.lastGenerationSummary = summary;
              this.schedulePersist(true);
            }
          }
        );
      } catch (error: any) {
        this.error = error?.message || 'AI page conversation failed.';

        if (this.activeOperationGroupId) {
          this.finishFileOperationGroup('这轮操作中断了，可以直接继续补充说明或重试', '处理中断');
        }
      } finally {
        this.isGenerating = false;
      }
    }
  }
});

