import api from './api';
import type { DataTable } from '../stores/dataTable';
import type {
  PageBindingContract,
  PageBindingContractSection,
  PageBindingEntry,
  PageBuildRequest,
  PageBuilderFile,
  PageBuilderProject,
  PageBuilderSectionSummary,
  PageBuilderTreeNode,
  PageSpec,
  PageSpecField,
  PageSectionSpec
} from '../types/pageBuilder';

const FIELD_ROLE_RULES: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /(title|name|headline)/i, role: 'title' },
  { pattern: /(summary|description|desc|excerpt|subtitle)/i, role: 'summary' },
  { pattern: /(content|body|text|article)/i, role: 'content' },
  { pattern: /(image|img|cover|thumbnail|poster|banner)/i, role: 'media' },
  { pattern: /(url|link|href)/i, role: 'link' },
  { pattern: /(date|time|published|created|updated)/i, role: 'meta' }
];

type FieldRoleMap = Record<string, string>;

function makeBindingEntries(bindings: Record<string, string> | undefined, fieldRoleMap: FieldRoleMap): PageBindingEntry[] {
  return Object.entries(bindings || {}).map(([prop, fieldKey]) => ({
    prop,
    fieldKey,
    fieldRole: fieldRoleMap[fieldKey]
  }));
}

export function inferFieldRoles(table: DataTable | null): FieldRoleMap {
  if (!table) {
    return {};
  }

  return table.columns.reduce<FieldRoleMap>((result, column) => {
    const matched = FIELD_ROLE_RULES.find((rule) => rule.pattern.test(column.key));
    result[column.key] = matched?.role || column.type;
    return result;
  }, {});
}

function pickFieldByRole(fieldRoleMap: FieldRoleMap, role: string): string | undefined {
  return Object.entries(fieldRoleMap).find(([, value]) => value === role)?.[0];
}

function buildSpecFields(table: DataTable, fieldRoleMap: FieldRoleMap): PageSpecField[] {
  return table.columns.map((column) => ({
    key: column.key,
    type: column.type,
    role: fieldRoleMap[column.key]
  }));
}

function buildNewsListSections(fieldRoleMap: FieldRoleMap, request: PageBuildRequest): PageSectionSpec[] {
  const titleField = pickFieldByRole(fieldRoleMap, 'title');
  const summaryField = pickFieldByRole(fieldRoleMap, 'summary');
  const contentField = pickFieldByRole(fieldRoleMap, 'content');
  const mediaField = pickFieldByRole(fieldRoleMap, 'media');
  const linkField = pickFieldByRole(fieldRoleMap, 'link');
  const metaField = pickFieldByRole(fieldRoleMap, 'meta');

  return [
    {
      id: 'hero',
      kind: 'hero',
      title: 'Hero',
      description: 'Top-level overview for the generated page.',
      bindings: {
        ...(titleField ? { heading: titleField } : {}),
        ...(summaryField ? { subheading: summaryField } : {}),
        ...(mediaField ? { image: mediaField } : {})
      },
      props: {
        tone: request.stylePreset || 'nvidia-tech',
        density: request.density || 'comfortable'
      }
    },
    {
      id: 'news-list',
      kind: 'list',
      title: 'Feed',
      description: 'Main repeated collection rendered from table rows.',
      repeat: true,
      bindings: {
        ...(titleField ? { title: titleField } : {}),
        ...(summaryField ? { summary: summaryField } : {}),
        ...(contentField ? { content: contentField } : {}),
        ...(mediaField ? { image: mediaField } : {}),
        ...(linkField ? { href: linkField } : {}),
        ...(metaField ? { meta: metaField } : {})
      }
    },
    {
      id: 'footer',
      kind: 'footer',
      title: 'Footer',
      description: 'Closing metadata and source note.',
      bindings: metaField ? { meta: metaField } : {}
    }
  ];
}

function buildGenericSections(fieldRoleMap: FieldRoleMap, request: PageBuildRequest): PageSectionSpec[] {
  const titleField = pickFieldByRole(fieldRoleMap, 'title');
  const summaryField = pickFieldByRole(fieldRoleMap, 'summary');
  const mediaField = pickFieldByRole(fieldRoleMap, 'media');
  const linkField = pickFieldByRole(fieldRoleMap, 'link');

  return [
    {
      id: 'hero',
      kind: 'hero',
      title: 'Hero',
      description: 'Top-level overview for the generated page.',
      bindings: {
        ...(titleField ? { heading: titleField } : {}),
        ...(summaryField ? { subheading: summaryField } : {}),
        ...(mediaField ? { image: mediaField } : {})
      }
    },
    {
      id: request.pageType === 'gallery' ? 'gallery-grid' : 'content-list',
      kind: request.pageType === 'gallery' ? 'grid' : 'list',
      title: request.pageType === 'gallery' ? 'Gallery' : 'Collection',
      description: 'Main repeated collection rendered from table rows.',
      repeat: true,
      bindings: {
        ...(titleField ? { title: titleField } : {}),
        ...(summaryField ? { summary: summaryField } : {}),
        ...(mediaField ? { image: mediaField } : {}),
        ...(linkField ? { href: linkField } : {})
      }
    },
    {
      id: 'footer',
      kind: 'footer',
      title: 'Footer',
      description: 'Closing metadata and source note.',
      bindings: {}
    }
  ];
}

function buildPageSections(fieldRoleMap: FieldRoleMap, request: PageBuildRequest): PageSectionSpec[] {
  return request.pageType === 'news-list'
    ? buildNewsListSections(fieldRoleMap, request)
    : buildGenericSections(fieldRoleMap, request);
}

function createSectionSummaries(sections: PageSectionSpec[]): PageBuilderSectionSummary[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title || section.id,
    type: section.kind,
    description: section.description,
    bindings: section.bindings || {},
    repeat: Boolean(section.repeat)
  }));
}

function createPageSpec(table: DataTable, request: PageBuildRequest, fieldRoleMap: FieldRoleMap): PageSpec {
  return {
    version: 'v1',
    meta: {
      title: request.title || `${table.name} Page`,
      description: request.goal || `Generated ${request.pageType} page based on ${table.name}.`,
      pageType: request.pageType,
      stylePreset: request.stylePreset || 'nvidia-tech'
    },
    dataSource: {
      tableId: table.id,
      fields: buildSpecFields(table, fieldRoleMap)
    },
    layout: {
      sections: buildPageSections(fieldRoleMap, request)
    }
  };
}

function createBindingContract(spec: PageSpec, fieldRoleMap: FieldRoleMap): PageBindingContract {
  const sections: PageBindingContractSection[] = spec.layout.sections.map((section) => ({
    sectionId: section.id,
    sectionTitle: section.title || section.id,
    repeat: Boolean(section.repeat),
    bindings: makeBindingEntries(section.bindings, fieldRoleMap)
  }));

  return {
    tableId: spec.dataSource.tableId,
    mode: 'collection',
    fields: spec.dataSource.fields,
    sections
  };
}

function sortTreeNodes(a: PageBuilderTreeNode, b: PageBuilderTreeNode) {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
}

function buildTreeFromNodes(nodes: PageBuilderTreeNode[]): PageBuilderTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? buildTreeFromNodes(node.children) : undefined
    }))
    .sort(sortTreeNodes);
}

function buildTree(files: PageBuilderFile[]): PageBuilderTreeNode[] {
  const root: PageBuilderTreeNode[] = [];

  for (const file of files.filter((item) => item.visibility === 'project')) {
    const parts = file.path.split('/');
    let level = root;
    let currentPath = '';

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let existing = level.find((node) => node.path === currentPath);

      if (!existing) {
        existing = {
          id: currentPath,
          name: part,
          path: currentPath,
          kind: isFile ? 'file' : 'folder',
          ...(isFile ? { fileId: file.id, fileType: file.type } : { children: [] })
        };
        level.push(existing);
      }

      if (!isFile) {
        existing.children ||= [];
        level = existing.children;
      }
    }
  }

  return root
    .map((node) => ({
      ...node,
      children: node.children ? buildTreeFromNodes(node.children) : undefined
    }))
    .sort(sortTreeNodes);
}

function inferFileType(filePath: string): PageBuilderFile['type'] {
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.ts')) return 'ts';
  if (filePath.endsWith('.js')) return 'js';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.json')) return 'json';
  return 'html';
}

function inferFileRole(filePath: string) {
  const roleMap: Record<string, string> = {
    'src/app/PageView.vue': 'Generated page entry point.',
    'src/components/sections/HeroSection.vue': 'Hero section component.',
    'src/components/sections/FeedSection.vue': 'Repeated collection section component.',
    'src/components/sections/FooterSection.vue': 'Footer section component.',
    'src/data/bindings.ts': 'Binding contract between table fields and page sections.',
    'src/data/tableAdapter.ts': 'Stable data access adapter for generated sections.',
    'src/data/previewRows.ts': 'Preview data derived from the selected table.',
    'src/spec/page-spec.json': 'Stable page spec used for regeneration.',
    'src/styles/page.css': 'Generated page stylesheet.'
  };

  return roleMap[filePath] || 'Generated project file.';
}

function buildBindingsFileSource(contract: PageBindingContract) {
  return `export const pageBindingContract = ${JSON.stringify(contract, null, 2)} as const;

export function bindingsForSection(sectionId: string) {
  return pageBindingContract.sections.find((section) => section.sectionId === sectionId) || null;
}
`;
}

function buildTableAdapterSource() {
  return `import { pageBindingContract } from './bindings';

export function getTableId() {
  return pageBindingContract.tableId;
}

export function listFieldKeys() {
  return pageBindingContract.fields.map((field) => field.key);
}

export function readField(row: Record<string, unknown>, fieldKey?: string) {
  if (!fieldKey) {
    return '';
  }

  return row?.[fieldKey] ?? '';
}
`;
}

function buildPreviewRowsSource(rows: Record<string, unknown>[]) {
  return `const previewRows = ${JSON.stringify(rows, null, 2)} as Array<Record<string, unknown>>;

export default previewRows;
`;
}

function buildPageViewSource() {
  return `<template>
  <main class="page-root">
    <HeroSection :spec="spec" />
    <FeedSection :spec="spec" :items="items" />
    <FooterSection :spec="spec" :items="items" />
  </main>
</template>

<script setup lang="ts">
import HeroSection from '../components/sections/HeroSection.vue';
import FeedSection from '../components/sections/FeedSection.vue';
import FooterSection from '../components/sections/FooterSection.vue';
import items from '../data/previewRows';
import spec from '../spec/page-spec.json';
</script>
`;
}

function buildHeroSectionSource(spec: PageSpec) {
  const heroBindings = spec.layout.sections.find((section) => section.id === 'hero')?.bindings || {};

  return `<template>
  <section class="hero-section">
    <div class="hero-copy">
      <p class="eyebrow">{{ spec.meta.pageType }}</p>
      <h1>{{ spec.meta.title }}</h1>
      <p class="hero-text">{{ spec.meta.description }}</p>
    </div>
    <aside class="hero-panel">
      <div class="hero-stat">
        <strong>{{ Object.keys(heroBindings).length }}</strong>
        <span>bound props</span>
      </div>
      <div class="hero-stat">
        <strong>{{ spec.dataSource.fields.length }}</strong>
        <span>available fields</span>
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
defineProps<{ spec: any }>();

const heroBindings = ${JSON.stringify(heroBindings, null, 2)};
</script>
`;
}

function buildFeedSectionSource(spec: PageSpec) {
  const listBindings = spec.layout.sections.find((section) => section.repeat)?.bindings || {};

  return `<template>
  <section class="feed-section">
    <header class="section-header">
      <div>
        <p class="eyebrow">Generated Section</p>
        <h2>Collection</h2>
      </div>
      <p class="section-note">{{ spec.dataSource.tableId }}</p>
    </header>
    <div v-if="items.length" class="card-grid">
      <a
        v-for="(item, index) in items"
        :key="String(item._id || index)"
        class="feed-card"
        :href="String(read(item, listBindings.href) || '#')"
        target="_blank"
        rel="noreferrer"
      >
        <div v-if="read(item, listBindings.image)" class="card-media">
          <img :src="String(read(item, listBindings.image))" alt="" />
        </div>
        <div class="card-body">
          <p class="card-meta">{{ read(item, listBindings.meta) || \`Item \${index + 1}\` }}</p>
          <h3>{{ read(item, listBindings.title) || 'Untitled' }}</h3>
          <p>{{ read(item, listBindings.summary) || read(item, listBindings.content) || 'No summary binding yet.' }}</p>
        </div>
      </a>
    </div>
    <div v-else class="empty-block">No preview rows available for this table.</div>
  </section>
</template>

<script setup lang="ts">
import { readField as read } from '../../data/tableAdapter';

defineProps<{ spec: any; items: Record<string, any>[] }>();

const listBindings = ${JSON.stringify(listBindings, null, 2)};
</script>
`;
}

function buildFooterSectionSource(spec: PageSpec) {
  const footerBindings = spec.layout.sections.find((section) => section.id === 'footer')?.bindings || {};

  return `<template>
  <footer class="footer-section">
    <span>{{ footerText }}</span>
  </footer>
</template>

<script setup lang="ts">
const footerBindings = ${JSON.stringify(footerBindings, null, 2)};

const footerText = footerBindings.meta
  ? \`Bound to \${footerBindings.meta}\`
  : 'Generated from the page builder workbench';
</script>
`;
}

function buildStylesSource() {
  return `:root {
  color-scheme: dark;
  --accent: #76b900;
  --panel: #111111;
  --panel-soft: #171717;
  --border: #5e5e5e;
  --text: #ffffff;
  --muted: #a7a7a7;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background:
    radial-gradient(circle at top right, rgba(118, 185, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #030303 0%, #0a0a0a 100%);
  color: var(--text);
}

a { color: inherit; }

.page-root { min-height: 100vh; padding: 40px 32px 64px; }
.hero-section { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr); gap: 20px; margin-bottom: 24px; }
.hero-copy, .hero-panel, .feed-card, .empty-block { border: 1px solid var(--border); border-radius: 2px; box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0; }
.hero-copy, .hero-panel { position: relative; background: rgba(0, 0, 0, 0.86); }
.hero-copy::before, .hero-panel::before { content: ''; position: absolute; inset: 0; border-top: 2px solid var(--accent); pointer-events: none; }
.hero-copy { padding: 28px; }
.hero-panel { display: grid; gap: 16px; align-content: start; padding: 24px; }
.hero-stat strong { display: block; font-size: 28px; margin-bottom: 6px; }
.hero-stat span, .hero-text, .section-note, .card-body p, .footer-section, .empty-block { color: var(--muted); }
.eyebrow { margin: 0 0 12px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.hero-copy h1, .section-header h2, .card-body h3 { margin: 0 0 12px; line-height: 1.25; }
.hero-copy h1 { font-size: 36px; }
.section-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.section-header h2 { font-size: 24px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.feed-card { overflow: hidden; background: linear-gradient(180deg, rgba(17, 17, 17, 0.96), rgba(7, 7, 7, 0.98)); color: inherit; text-decoration: none; }
.card-media { height: 170px; background: #000000; border-bottom: 1px solid var(--border); }
.card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-body { padding: 16px; }
.card-meta { margin: 0 0 8px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.card-body h3 { font-size: 20px; }
.card-body p { margin: 0; line-height: 1.6; }
.empty-block { padding: 18px; background: var(--panel-soft); }
.footer-section { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 14px; }
`;
}

function createProjectFiles(
  spec: PageSpec,
  contract: PageBindingContract,
  sampleRows: Record<string, unknown>[]
): PageBuilderFile[] {
  const repeatedSection = contract.sections.find((section) => section.repeat);

  return [
    {
      id: 'page-view',
      path: 'src/app/PageView.vue',
      name: 'PageView.vue',
      type: 'vue',
      role: 'Generated page entry point.',
      editable: true,
      visibility: 'project',
      content: buildPageViewSource(),
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'section-hero',
      path: 'src/components/sections/HeroSection.vue',
      name: 'HeroSection.vue',
      type: 'vue',
      role: 'Hero section component.',
      editable: true,
      visibility: 'project',
      content: buildHeroSectionSource(spec),
      sourceSectionIds: ['hero'],
      sourceBindingKeys: contract.sections.find((section) => section.sectionId === 'hero')?.bindings.map((entry) => entry.fieldKey)
    },
    {
      id: 'section-feed',
      path: 'src/components/sections/FeedSection.vue',
      name: 'FeedSection.vue',
      type: 'vue',
      role: 'Repeated collection section component.',
      editable: true,
      visibility: 'project',
      content: buildFeedSectionSource(spec),
      sourceSectionIds: repeatedSection ? [repeatedSection.sectionId] : [],
      sourceBindingKeys: repeatedSection?.bindings.map((entry) => entry.fieldKey)
    },
    {
      id: 'section-footer',
      path: 'src/components/sections/FooterSection.vue',
      name: 'FooterSection.vue',
      type: 'vue',
      role: 'Footer section component.',
      editable: true,
      visibility: 'project',
      content: buildFooterSectionSource(spec),
      sourceSectionIds: ['footer'],
      sourceBindingKeys: contract.sections.find((section) => section.sectionId === 'footer')?.bindings.map((entry) => entry.fieldKey)
    },
    {
      id: 'data-bindings',
      path: 'src/data/bindings.ts',
      name: 'bindings.ts',
      type: 'ts',
      role: 'Binding contract between table fields and page sections.',
      editable: true,
      visibility: 'project',
      content: buildBindingsFileSource(contract),
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'data-table-adapter',
      path: 'src/data/tableAdapter.ts',
      name: 'tableAdapter.ts',
      type: 'ts',
      role: 'Stable data access adapter for generated sections.',
      editable: true,
      visibility: 'project',
      content: buildTableAdapterSource(),
      sourceSectionIds: repeatedSection ? [repeatedSection.sectionId] : []
    },
    {
      id: 'data-preview-rows',
      path: 'src/data/previewRows.ts',
      name: 'previewRows.ts',
      type: 'ts',
      role: 'Preview data derived from the selected table.',
      editable: false,
      visibility: 'project',
      content: buildPreviewRowsSource(sampleRows),
      sourceSectionIds: repeatedSection ? [repeatedSection.sectionId] : []
    },
    {
      id: 'spec-page-spec',
      path: 'src/spec/page-spec.json',
      name: 'page-spec.json',
      type: 'json',
      role: 'Stable page spec used for regeneration.',
      editable: false,
      visibility: 'project',
      content: JSON.stringify(spec, null, 2),
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'styles-page',
      path: 'src/styles/page.css',
      name: 'page.css',
      type: 'css',
      role: 'Generated page stylesheet.',
      editable: true,
      visibility: 'project',
      content: buildStylesSource(),
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    }
  ];
}

export function buildMockPageProject(table: DataTable, request: PageBuildRequest) {
  const fieldRoleMap = inferFieldRoles(table);
  const spec = createPageSpec(table, request, fieldRoleMap);
  const bindingContract = createBindingContract(spec, fieldRoleMap);
  const sampleRows = table.rows.slice(0, 6);
  const files = createProjectFiles(spec, bindingContract, sampleRows);
  const project: PageBuilderProject = {
    rootName: 'Page Project',
    files,
    tree: buildTree(files),
    bindingContract
  };

  return {
    fieldRoleMap,
    spec,
    project,
    sectionSummaries: createSectionSummaries(spec.layout.sections)
  };
}

export function buildProjectFromGeneratedFiles(params: {
  table: DataTable;
  files: Array<{ path: string; content: string }>;
  assistantMessage?: string;
}) {
  const specFile = params.files.find((file) => file.path === 'src/spec/page-spec.json');
  const spec = specFile
    ? JSON.parse(specFile.content) as PageSpec
    : createPageSpec(params.table, {
        tableId: params.table.id,
        pageType: 'news-list',
        title: `${params.table.name} Page`
      }, inferFieldRoles(params.table));

  const fieldRoleMap = inferFieldRoles(params.table);
  const bindingContract = createBindingContract(spec, fieldRoleMap);
  const files: PageBuilderFile[] = params.files.map((file, index) => ({
    id: `generated-${index}`,
    path: file.path,
    name: file.path.split('/').pop() || file.path,
    type: inferFileType(file.path),
    role: inferFileRole(file.path),
    editable: file.path !== 'src/spec/page-spec.json' && file.path !== 'src/data/previewRows.ts',
    visibility: 'project',
    content: file.content,
    sourceSectionIds: spec.layout.sections.map((section) => section.id)
  }));

  const project: PageBuilderProject = {
    rootName: 'Page Project',
    files,
    tree: buildTree(files),
    bindingContract
  };

  return {
    assistantMessage: params.assistantMessage || '',
    fieldRoleMap,
    spec,
    project,
    sectionSummaries: createSectionSummaries(spec.layout.sections)
  };
}

export async function generatePageProjectWithAI(params: {
  table: DataTable;
  prompt: string;
  provider?: 'openrouter' | 'qwen' | 'siliconflow';
  model?: string;
  apiKey?: string;
}) {
  let response: {
    success: boolean;
    project: {
      assistantMessage: string;
      entryPath: string;
      files: Array<{ path: string; content: string }>;
    } | null;
    error: string | null;
  };

  try {
    response = await api.post('/page-builder/generate', {
      prompt: params.prompt,
      model: params.provider || 'openrouter',
      options: {
        model: params.model,
        apiKey: params.apiKey
      },
      table: {
        id: params.table.id,
        name: params.table.name,
        columns: params.table.columns,
        rows: params.table.rows.slice(0, 6)
      }
    }) as typeof response;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error?.message || 'Failed to generate project with AI.');
  }

  if (!response.success || !response.project) {
    throw new Error(response.error || 'Failed to generate project with AI.');
  }

  return response.project;
}

export async function prepareProjectPreview(files: PageBuilderFile[], options?: { projectId?: string }) {
  const response = await api.post('/page-builder/prepare-preview', {
    projectId: options?.projectId || 'page-preview',
    files: files.map((file) => ({
      path: file.path,
      type: file.type,
      content: file.content
    }))
  }) as {
    success: boolean;
    previewUrl: string | null;
    error: string | null;
  };

  if (!response.success || !response.previewUrl) {
    throw new Error(response.error || 'Failed to prepare real project preview.');
  }

  return response.previewUrl;
}
