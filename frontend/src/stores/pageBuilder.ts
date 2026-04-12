import { defineStore } from 'pinia';
import type { DataTable } from './dataTable';
import { buildMockPageProject, inferFieldRoles } from '../services/pageBuilder';
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
    project: null,
    activeFileId: null,
    selectedSectionId: null,
    selectedPreviewElement: null,
    centerMode: 'preview',
    previewStatus: 'idle',
    previewHtml: '',
    error: null,
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

    toggleSetupDrawer(force?: boolean) {
      this.isSetupDrawerOpen = typeof force === 'boolean' ? force : !this.isSetupDrawerOpen;
    },

    generateFromTable(tables: DataTable[]) {
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

      const output = buildMockPageProject(table, request);

      this.fieldRoleMap = output.fieldRoleMap;
      this.spec = output.spec;
      this.project = output.project;
      this.activeFileId = output.project.files.find((file) => file.visibility === 'project')?.id || null;
      this.previewHtml = output.previewHtml;
      this.sectionSummaries = output.sectionSummaries;
      this.previewStatus = 'ready';
      this.selectedSectionId = output.sectionSummaries[0]?.id || null;
      this.isSetupDrawerOpen = false;
    }
  }
});
