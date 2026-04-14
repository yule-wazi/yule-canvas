import { defineStore } from 'pinia';
import type { DataTable } from './dataTable';
import {
  createPageBuilderWorkspace,
  inferFieldRoles
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
    }
  }
});
