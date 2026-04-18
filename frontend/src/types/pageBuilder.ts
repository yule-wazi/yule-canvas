export type PageBuilderPageType = 'news-list' | 'article-detail' | 'gallery' | 'catalog';

export type PageBuilderStylePreset = 'nvidia-tech' | 'editorial-dark' | 'clean-catalog';

export type PageBuilderCenterMode = 'preview' | 'code' | 'data';

export type PageBuilderFileType = 'html' | 'css' | 'js' | 'ts' | 'json' | 'vue';

export type PageBuilderAIProvider = 'siliconflow' | 'openrouter' | 'qwen';

export interface PageBuildRequest {
  tableId: string;
  pageType: PageBuilderPageType;
  goal?: string;
  title?: string;
  stylePreset?: PageBuilderStylePreset;
  density?: 'compact' | 'comfortable';
  sectionHints?: string[];
  fieldHints?: Record<string, string>;
}

export interface PageBuilderGeneratedFile {
  path: string;
  role: string;
  content: string;
}

export interface PageBuilderAIResponse {
  summary: string;
  files: PageBuilderGeneratedFile[];
}

export interface PageBuilderAIConfig {
  provider: PageBuilderAIProvider;
  apiKey: string;
  model: string;
}

export interface PageSpecField {
  key: string;
  type: string;
  role?: string;
}

export interface PageSectionSpec {
  id: string;
  kind: 'hero' | 'list' | 'grid' | 'featured-card' | 'content' | 'media' | 'footer';
  title?: string;
  description?: string;
  repeat?: boolean;
  bindings?: Record<string, string>;
  props?: Record<string, unknown>;
}

export interface PageSpec {
  version: 'v1';
  meta: {
    title: string;
    description?: string;
    pageType: PageBuilderPageType;
    stylePreset: PageBuilderStylePreset;
  };
  dataSource: {
    tableId: string;
    primaryKey?: string;
    fields: PageSpecField[];
  };
  layout: {
    sections: PageSectionSpec[];
  };
}

export interface PageBuilderFile {
  id: string;
  path: string;
  name: string;
  type: PageBuilderFileType;
  role: string;
  editable: boolean;
  content: string;
  visibility: 'project' | 'internal';
  sourceSectionIds?: string[];
  sourceBindingKeys?: string[];
}

export interface PageBuilderSectionSummary {
  id: string;
  title: string;
  type: PageSectionSpec['kind'];
  description?: string;
  bindings: Record<string, string>;
  repeat: boolean;
}

export interface PageBuilderTreeNode {
  id: string;
  name: string;
  path: string;
  kind: 'folder' | 'file';
  children?: PageBuilderTreeNode[];
  fileId?: string;
  fileType?: PageBuilderFileType;
}

export interface PageBindingEntry {
  prop: string;
  fieldKey: string;
  fieldRole?: string;
}

export interface PageBindingContractSection {
  sectionId: string;
  sectionTitle: string;
  repeat: boolean;
  bindings: PageBindingEntry[];
}

export interface PageBindingContract {
  tableId: string;
  mode: 'collection';
  fields: PageSpecField[];
  sections: PageBindingContractSection[];
}

export interface PageBuilderProject {
  workspaceId: string;
  rootName: string;
  files: PageBuilderFile[];
  tree: PageBuilderTreeNode[];
  bindingContract: PageBindingContract;
}

export interface SavedPageBuilderWorkspace {
  id: string;
  name: string;
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
  centerMode: PageBuilderCenterMode;
  lastGenerationSummary: string;
  sectionSummaries: PageBuilderSectionSummary[];
  createdAt: number;
  updatedAt: number;
}

export interface PageBuilderWorkspaceMeta {
  id: string;
  name: string;
  selectedTableId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PageBuilderPreviewSelection {
  elementId: string;
  sectionId: string;
  sectionTitle: string;
  elementLabel: string;
  componentPath: string | null;
  bindings: PageBindingEntry[];
  relatedFilePaths: string[];
  textValue?: string;
}
