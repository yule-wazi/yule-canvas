import { defineStore } from 'pinia';
import type { DataTable } from './dataTable';
import {
  buildMockPageProject,
  buildProjectFromGeneratedFiles,
  generatePageProjectWithAI,
  inferFieldRoles,
  renderProjectPreview
} from '../services/pageBuilder';
import type {
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
  previewStatus: 'idle' | 'building' | 'ready' | 'error';
  previewHtml: string;
  error: string | null;
  isSetupDrawerOpen: boolean;
  isAIConfigOpen: boolean;
  sectionSummaries: PageBuilderSectionSummary[];
  assistantMessage: string;
  aiProvider: 'openrouter' | 'qwen' | 'siliconflow';
  aiModel: string;
  aiApiKey: string;
}

const AI_CONFIG_STORAGE_KEY = 'page_builder_ai_config';

function readPersistedAIConfig() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Partial<Pick<PageBuilderState, 'aiProvider' | 'aiModel' | 'aiApiKey'>> : null;
  } catch {
    return null;
  }
}

function persistAIConfig(config: Partial<Pick<PageBuilderState, 'aiProvider' | 'aiModel' | 'aiApiKey'>>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore local storage write failures
  }
}

const persistedAIConfig = readPersistedAIConfig();

export const usePageBuilderStore = defineStore('pageBuilder', {
  state: (): PageBuilderState => ({
    selectedTableId: null,
    pageType: 'news-list',
    stylePreset: 'nvidia-tech',
    pageTitle: '',
    goal: '',
    density: 'comfortable',
    fieldRoleMap: {},
    spec: null,
    project: null,
    activeFileId: null,
    selectedSectionId: null,
    selectedPreviewElement: null,
    centerMode: 'preview',
    previewStatus: 'idle',
    previewHtml: '',
    error: null,
    isSetupDrawerOpen: true,
    isAIConfigOpen: false,
    sectionSummaries: [],
    assistantMessage: '',
    aiProvider: persistedAIConfig?.aiProvider || 'openrouter',
    aiModel: persistedAIConfig?.aiModel || 'openai/gpt-4.1-mini',
    aiApiKey: persistedAIConfig?.aiApiKey || ''
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
      if (!tables.length) {
        this.selectedTableId = null;
        this.fieldRoleMap = {};
        this.project = null;
        this.activeFileId = null;
        this.previewHtml = '';
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
      if (message) {
        this.previewStatus = 'error';
      }
    },

    toggleSetupDrawer(force?: boolean) {
      this.isSetupDrawerOpen = typeof force === 'boolean' ? force : !this.isSetupDrawerOpen;
    },

    toggleAIConfig(force?: boolean) {
      this.isAIConfigOpen = typeof force === 'boolean' ? force : !this.isAIConfigOpen;
    },

    updateAIConfig(payload: {
      provider?: 'openrouter' | 'qwen' | 'siliconflow';
      model?: string;
      apiKey?: string;
    }) {
      if (payload.provider) {
        this.aiProvider = payload.provider;
      }

      if (typeof payload.model === 'string') {
        this.aiModel = payload.model;
      }

      if (typeof payload.apiKey === 'string') {
        this.aiApiKey = payload.apiKey;
      }

      persistAIConfig({
        aiProvider: this.aiProvider,
        aiModel: this.aiModel,
        aiApiKey: this.aiApiKey
      });
    },

    async generateFromTable(tables: DataTable[]) {
      const table = tables.find((item) => item.id === this.selectedTableId);

      if (!table) {
        this.error = 'Select a data table before generating the page.';
        this.previewStatus = 'error';
        return;
      }

      this.previewStatus = 'building';
      this.error = null;
      this.selectedPreviewElement = null;

      const request: PageBuildRequest = {
        tableId: table.id,
        pageType: this.pageType,
        title: this.pageTitle || `${table.name} Page`,
        goal: this.goal || undefined,
        stylePreset: this.stylePreset,
        density: this.density
      };

      try {
        const aiProject = await generatePageProjectWithAI({
          table,
          prompt: this.goal || this.pageTitle || `${table.name} page`,
          provider: this.aiProvider,
          model: this.aiModel,
          apiKey: this.aiApiKey || undefined
        });
        const output = buildProjectFromGeneratedFiles({
          table,
          files: aiProject.files,
          assistantMessage: aiProject.assistantMessage
        });

        const previewHtml = await renderProjectPreview(output.project.files, {
          entryPath: 'app/PageView.vue',
          title: output.spec.meta.title
        });

        this.fieldRoleMap = output.fieldRoleMap;
        this.spec = output.spec;
        this.project = output.project;
        this.activeFileId = output.project.files.find((file) => file.visibility === 'project')?.id || null;
        this.previewHtml = previewHtml;
        this.sectionSummaries = output.sectionSummaries;
        this.assistantMessage = output.assistantMessage;
        this.previewStatus = 'ready';
        this.selectedSectionId = output.sectionSummaries[0]?.id || null;
        this.isSetupDrawerOpen = false;
      } catch (error: any) {
        const fallback = buildMockPageProject(table, request);

        try {
          const previewHtml = await renderProjectPreview(fallback.project.files, {
            entryPath: 'app/PageView.vue',
            title: fallback.spec.meta.title
          });

          this.fieldRoleMap = fallback.fieldRoleMap;
          this.spec = fallback.spec;
          this.project = fallback.project;
          this.activeFileId = fallback.project.files.find((file) => file.visibility === 'project')?.id || null;
          this.previewHtml = previewHtml;
          this.sectionSummaries = fallback.sectionSummaries;
          this.assistantMessage = `AI 生成失败，当前展示的是本地回退生成结果。${error.message ? ` 原因：${error.message}` : ''}`;
          this.previewStatus = 'ready';
          this.selectedSectionId = fallback.sectionSummaries[0]?.id || null;
          this.error = error.message || 'AI generation failed.';
        } catch (previewError: any) {
          this.previewStatus = 'error';
          this.error = previewError.message || error.message || 'Failed to generate page preview.';
        }
      }
    }
  }
});
