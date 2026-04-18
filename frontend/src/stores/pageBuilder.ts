import { defineStore } from 'pinia';
import type { DataTable } from './dataTable';
import {
  createProjectFromGeneratedFiles,
  createPageBuilderWorkspace,
  inferFieldRoles,
  requestAIPageBuilderWorkspace
} from '../services/pageBuilder';
import type {
  PageBuilderAIConfig,
  PageBuilderAIProvider,
  PageBindingContract,
  PageBuildRequest,
  PageBuilderCenterMode,
  PageBuilderFile,
  PageBuilderPageType,
  PageBuilderProject,
  PageBuilderPreviewSelection,
  PageBuilderSectionSummary,
  PageBuilderStylePreset,
  PageBuilderTreeNode,
  PageSpec
} from '../types/pageBuilder';

interface PageBuilderState {
  selectedTableId: string | null;
  pageType: PageBuilderPageType;
  stylePreset: PageBuilderStylePreset;
  pageTitle: string;
  goal: string;
  density: 'compact' | 'comfortable';
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
  sectionSummaries: PageBuilderSectionSummary[];
}

const PAGE_BUILDER_AI_STORAGE_KEY = 'page_builder_ai_config';
const DEFAULT_PAGE_BUILDER_GOAL = '帮我生成一个可滚动的展示图片的卡片类的网站';

export const usePageBuilderStore = defineStore('pageBuilder', {
  state: (): PageBuilderState => ({
    selectedTableId: null,
    pageType: 'news-list',
    stylePreset: 'nvidia-tech',
    pageTitle: '',
    goal: DEFAULT_PAGE_BUILDER_GOAL,
    density: 'comfortable',
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
    sectionSummaries: []
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
    initialize(tables: DataTable[]) {
      this.loadAIConfig();

      if (!tables.length) {
        this.selectedTableId = null;
        this.fieldRoleMap = {};
        this.project = null;
        this.activeFileId = null;
        this.error = 'No data table is available yet.';
        return;
      }

      if (!this.selectedTableId || !tables.some((table) => table.id === this.selectedTableId)) {
        this.selectedTableId = tables[0].id;
      }

      this.refreshFieldRoles(tables);
    },

    refreshFieldRoles(tables: DataTable[]) {
      const table = tables.find((item) => item.id === this.selectedTableId) || null;
      this.fieldRoleMap = inferFieldRoles(table);

      if (table && !this.pageTitle) {
        this.pageTitle = `${table.name} Page`;
      }

      if (!this.goal.trim()) {
        this.goal = DEFAULT_PAGE_BUILDER_GOAL;
      }
    },

    setSelectedTable(tableId: string, tables: DataTable[]) {
      this.selectedTableId = tableId;
      this.refreshFieldRoles(tables);
    },

    setCenterMode(mode: PageBuilderCenterMode) {
      this.centerMode = mode;
    },

    setActiveFile(fileId: string) {
      this.activeFileId = fileId;
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
    },

    selectSection(sectionId: string) {
      this.selectedSectionId = sectionId;
    },

    selectPreviewElement(selection: PageBuilderPreviewSelection) {
      this.selectedPreviewElement = selection;
      this.selectedSectionId = selection.sectionId;
      const relatedFile = this.project?.files.find((file) => selection.relatedFilePaths.includes(file.path));
      if (relatedFile) {
        this.activeFileId = relatedFile.id;
      }
    },

    clearPreviewSelection() {
      this.selectedPreviewElement = null;
    },

    setError(message: string | null) {
      this.error = message;
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
          this.aiModel = 'Qwen/Qwen2.5-7B-Instruct';
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
          return 'Qwen/Qwen2.5-7B-Instruct';
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

    applyWorkspaceResult(nextWorkspace: ReturnType<typeof createPageBuilderWorkspace>, summary = '') {
      this.error = null;
      this.fieldRoleMap = nextWorkspace.fieldRoleMap;
      this.spec = nextWorkspace.spec;
      this.project = nextWorkspace.project;
      this.activeFileId = nextWorkspace.project.files.find((file) => file.visibility === 'project')?.id || null;
      this.sectionSummaries = nextWorkspace.sectionSummaries;
      this.selectedSectionId = nextWorkspace.sectionSummaries[0]?.id || null;
      this.selectedPreviewElement = null;
      this.centerMode = 'preview';
      this.isSetupDrawerOpen = false;
      this.lastGenerationSummary = summary;
    },

    toggleSetupDrawer(force?: boolean) {
      this.isSetupDrawerOpen = typeof force === 'boolean' ? force : !this.isSetupDrawerOpen;
    },

    createWorkspaceFromTable(tables: DataTable[]) {
      const table = tables.find((item) => item.id === this.selectedTableId);

      if (!table) {
        this.error = 'Select a data table before creating the workspace.';
        return;
      }

      const request: PageBuildRequest = {
        tableId: table.id,
        pageType: this.pageType,
        title: this.pageTitle || `${table.name} Page`,
        goal: this.goal || undefined,
        stylePreset: this.stylePreset,
        density: this.density
      };

      const nextWorkspace = createPageBuilderWorkspace(table, request);
      this.applyWorkspaceResult(nextWorkspace, 'Created local fallback workspace.');
    },

    async createWorkspaceFromAI(tables: DataTable[]) {
      const table = tables.find((item) => item.id === this.selectedTableId);

      if (!table) {
        this.error = 'Select a data table before generating with AI.';
        return;
      }

      const request: PageBuildRequest = {
        tableId: table.id,
        pageType: this.pageType,
        title: this.pageTitle || `${table.name} Page`,
        goal: this.goal || undefined,
        stylePreset: this.stylePreset,
        density: this.density
      };

      this.isGenerating = true;
      this.error = null;

      try {
        const aiConfig = this.getAIConfig();

        if (!aiConfig.apiKey) {
          this.error = 'Enter an AI API key before generating with AI.';
          return;
        }

        const result = await requestAIPageBuilderWorkspace(table, request, aiConfig);
        const nextWorkspace = createProjectFromGeneratedFiles(table, request, result.files);
        this.applyWorkspaceResult(nextWorkspace, result.summary);
      } catch (error: any) {
        if (error?.code === 'ECONNABORTED') {
          this.error = 'AI page generation timed out on the client side. The provider may still be running; try a faster model or retry.';
          return;
        }

        this.error = error?.response?.data?.error || error?.message || 'AI page generation failed.';
      } finally {
        this.isGenerating = false;
      }
    }
  }
});
