export type PageBuilderPageType = 'news-list' | 'article-detail' | 'gallery' | 'catalog';

export type PageBuilderStylePreset = 'nvidia-tech' | 'editorial-dark' | 'clean-catalog';

export type PageBuilderCenterMode = 'preview' | 'code' | 'split';

export type PageBuilderFileType = 'html' | 'css' | 'js' | 'ts' | 'json' | 'vue';

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
  name: string;
  type: PageBuilderFileType;
  role: string;
  editable: boolean;
  content: string;
  sourceSectionIds?: string[];
}

export interface PageBuilderSectionSummary {
  id: string;
  title: string;
  type: PageSectionSpec['kind'];
  description?: string;
  bindings: Record<string, string>;
  repeat: boolean;
}
