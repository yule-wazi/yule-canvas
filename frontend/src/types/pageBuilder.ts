export type PageBuilderCenterMode = 'preview' | 'code' | 'data';

export type PageBuilderFileType = 'html' | 'css' | 'js' | 'ts' | 'json' | 'vue';

export type PageBuilderAIProvider = 'siliconflow' | 'openrouter' | 'qwen';

export type PageBuilderDrawerMode = 'setup' | 'conversation';

export type PageBuilderFileOperationAction = 'create' | 'read' | 'update';
export type PageBuilderConversationOperationTone = 'neutral' | 'inspect' | 'write';
export type PageBuilderConversationIntent = 'chat' | 'update' | 'create' | 'mixed';

export interface PageBuilderConversationMessage {
  id: string;
  kind: 'message';
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface PageBuilderFileOperationItem {
  id: string;
  action: PageBuilderFileOperationAction;
  path: string;
  createdAt: number;
}

export interface PageBuilderConversationOperationGroup {
  id: string;
  kind: 'file_operation_group';
  status: 'running' | 'done';
  createdAt: number;
  title: string;
  subtitle: string;
  tone: PageBuilderConversationOperationTone;
  items: PageBuilderFileOperationItem[];
}

export interface PageBuilderConversationStatus {
  id: string;
  kind: 'status';
  tone: 'info' | 'thinking';
  label: string;
  detail?: string;
  createdAt: number;
}

export type PageBuilderConversationItem =
  | PageBuilderConversationMessage
  | PageBuilderConversationStatus
  | PageBuilderConversationOperationGroup;

export interface PageBuilderStreamFileDoneEvent {
  type: 'file_done';
  file: PageBuilderGeneratedFile;
}

export interface PageBuilderStreamDoneEvent {
  type: 'done';
  summary: string;
  files: PageBuilderGeneratedFile[];
}

export interface PageBuildRequest {
  tableId: string;
  goal?: string;
  title?: string;
  sectionHints?: string[];
  fieldHints?: Record<string, string>;
}

export interface PageBuilderGeneratedFile {
  path: string;
  role: string;
  content: string;
}

export interface PageBuilderPreviewTableSnapshot {
  table: {
    id: string;
    name: string;
    columns: Array<{ key: string; type: string }>;
    rowCount: number;
    updatedAt?: number;
  };
  rows: Record<string, any>[];
}

export interface PageBuilderPreviewRuntimeFile {
  path: string;
  content: string;
  editable: boolean;
  visibility: 'project' | 'internal';
  type?: string;
}

export interface PageBuilderPreviewSessionSnapshot {
  files: PageBuilderPreviewRuntimeFile[];
  updatedAt: number;
}

export interface PageBuilderAIResponse {
  summary: string;
  files: PageBuilderGeneratedFile[];
}

export interface PageBuilderConversationHistoryItem {
  kind: PageBuilderConversationItem['kind'];
  role?: 'user' | 'assistant';
  content?: string;
  tone?: 'info' | 'thinking';
  label?: string;
  detail?: string;
  status?: 'running' | 'done';
  actions?: Array<{
    action: PageBuilderFileOperationAction;
    path: string;
  }>;
}

export interface PageBuilderConversationWorkspaceInput {
  workspaceId: string | null;
  selectedFilePath?: string | null;
  files: Array<{
    path: string;
    role: string;
    content: string;
    visibility: 'project' | 'internal';
    editable: boolean;
  }>;
}

export interface PageBuilderConversationStatusEvent {
  type: 'status';
  phase: 'inspect' | 'write';
  tone: 'info' | 'thinking';
  label: string;
  detail?: string;
}

export interface PageBuilderConversationFileOperationEvent {
  type: 'file_operation';
  action: PageBuilderFileOperationAction;
  path: string;
}

export interface PageBuilderConversationAssistantEvent {
  type: 'assistant';
  message: string;
}

export interface PageBuilderConversationDoneEvent {
  type: 'done';
  intent: PageBuilderConversationIntent;
  summary: string;
  message: string;
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
    pageType?: string;
    stylePreset?: string;
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
  pageTitle: string;
  goal: string;
  drawerMode?: PageBuilderDrawerMode;
  conversationDraft?: string;
  conversationMessages?: PageBuilderConversationItem[];
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
