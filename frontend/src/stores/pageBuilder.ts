import { defineStore } from 'pinia';
import type { DataTable } from './dataTable';
import { buildMockPageProject, inferFieldRoles } from '../services/pageBuilder';
import type {
  PageBuildRequest,
  PageBuilderCenterMode,
  PageBuilderFile,
  PageBuilderPageType,
  PageBuilderSectionSummary,
  PageBuilderStylePreset,
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
  files: PageBuilderFile[];
  activeFileId: string | null;
  selectedSectionId: string | null;
  centerMode: PageBuilderCenterMode;
  previewStatus: 'idle' | 'building' | 'ready' | 'error';
  previewHtml: string;
  error: string | null;
  isSetupDrawerOpen: boolean;
  sectionSummaries: PageBuilderSectionSummary[];
}

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
    files: [],
    activeFileId: null,
    selectedSectionId: null,
    centerMode: 'preview',
    previewStatus: 'idle',
    previewHtml: '',
    error: null,
    isSetupDrawerOpen: true,
    sectionSummaries: []
  }),

  getters: {
    activeFile(state) {
      return state.files.find((file) => file.id === state.activeFileId) || null;
    }
  },

  actions: {
    initialize(tables: DataTable[]) {
      if (!tables.length) {
        this.selectedTableId = null;
        this.fieldRoleMap = {};
        this.error = '当前还没有可用的数据表。';
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
        this.pageTitle = `${table.name} 页面`;
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
      this.selectedSectionId = null;
    },

    selectSection(sectionId: string) {
      this.selectedSectionId = sectionId;
    },

    toggleSetupDrawer(force?: boolean) {
      this.isSetupDrawerOpen = typeof force === 'boolean' ? force : !this.isSetupDrawerOpen;
    },

    generateFromTable(tables: DataTable[]) {
      const table = tables.find((item) => item.id === this.selectedTableId);

      if (!table) {
        this.error = '请先选择一个数据表，再生成页面。';
        this.previewStatus = 'error';
        return;
      }

      this.previewStatus = 'building';
      this.error = null;

      const request: PageBuildRequest = {
        tableId: table.id,
        pageType: this.pageType,
        title: this.pageTitle || `${table.name} 页面`,
        goal: this.goal || undefined,
        stylePreset: this.stylePreset,
        density: this.density
      };

      const project = buildMockPageProject(table, request);

      this.fieldRoleMap = project.fieldRoleMap;
      this.spec = project.spec;
      this.files = project.files;
      this.activeFileId = project.files[0]?.id || null;
      this.previewHtml = project.previewHtml;
      this.sectionSummaries = project.sectionSummaries;
      this.previewStatus = 'ready';
      this.selectedSectionId = project.sectionSummaries[0]?.id || null;
      this.isSetupDrawerOpen = false;
    }
  }
});
