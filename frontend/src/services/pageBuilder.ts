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

interface PreviewSectionDescriptor {
  sectionId: string;
  sectionTitle: string;
  componentPath: string;
  relatedFilePaths: string[];
  bindings: PageBindingEntry[];
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toJsonAttribute(value: unknown): string {
  return escapeHtml(JSON.stringify(value));
}

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
    'app/PageView.vue': 'Generated page entry point.',
    'components/sections/HeroSection.vue': 'Hero section component.',
    'components/sections/FeedSection.vue': 'Repeated collection section component.',
    'components/sections/FooterSection.vue': 'Footer section component.',
    'data/bindings.ts': 'Binding contract between table fields and page sections.',
    'data/tableAdapter.ts': 'Stable data access adapter for generated sections.',
    'spec/page-spec.json': 'Stable page spec used for regeneration.',
    'styles/page.css': 'Generated page stylesheet.'
  };

  return roleMap[filePath] || 'Generated project file.';
}

function buildTreeFromNodes(nodes: PageBuilderTreeNode[]): PageBuilderTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? buildTreeFromNodes(node.children) : undefined
    }))
    .sort(sortTreeNodes);
}

function sortTreeNodes(a: PageBuilderTreeNode, b: PageBuilderTreeNode) {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
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
import items from '../preview/sample-data.json';
import spec from '../spec/page-spec.json';
import '../styles/page.css';
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
        :key="item._id || index"
        class="feed-card"
        :href="read(item, listBindings.href) || '#'"
        target="_blank"
        rel="noreferrer"
      >
        <div v-if="read(item, listBindings.image)" class="card-media">
          <img :src="read(item, listBindings.image)" alt="" />
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
  sampleRows: Record<string, unknown>[],
  previewHtml: string
): PageBuilderFile[] {
  const repeatedSection = contract.sections.find((section) => section.repeat);

  return [
    {
      id: 'app-page-view',
      path: 'app/PageView.vue',
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
      path: 'components/sections/HeroSection.vue',
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
      path: 'components/sections/FeedSection.vue',
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
      path: 'components/sections/FooterSection.vue',
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
      path: 'data/bindings.ts',
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
      path: 'data/tableAdapter.ts',
      name: 'tableAdapter.ts',
      type: 'ts',
      role: 'Stable data access adapter for generated sections.',
      editable: true,
      visibility: 'project',
      content: buildTableAdapterSource(),
      sourceSectionIds: repeatedSection ? [repeatedSection.sectionId] : []
    },
    {
      id: 'spec-page-spec',
      path: 'spec/page-spec.json',
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
      path: 'styles/page.css',
      name: 'page.css',
      type: 'css',
      role: 'Generated page stylesheet.',
      editable: true,
      visibility: 'project',
      content: buildStylesSource(),
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'preview-sample-data',
      path: 'preview/sample-data.json',
      name: 'sample-data.json',
      type: 'json',
      role: 'Preview bootstrap data.',
      editable: false,
      visibility: 'internal',
      content: JSON.stringify(sampleRows, null, 2),
      sourceSectionIds: repeatedSection ? [repeatedSection.sectionId] : []
    },
    {
      id: 'preview-runtime',
      path: 'preview/runtime.html',
      name: 'runtime.html',
      type: 'html',
      role: 'Iframe preview runtime.',
      editable: false,
      visibility: 'internal',
      content: previewHtml,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    }
  ];
}

function buildPreviewSectionDescriptors(contract: PageBindingContract): Record<string, PreviewSectionDescriptor> {
  return contract.sections.reduce<Record<string, PreviewSectionDescriptor>>((result, section) => {
    const componentPath = section.sectionId === 'hero'
      ? 'components/sections/HeroSection.vue'
      : section.sectionId === 'footer'
        ? 'components/sections/FooterSection.vue'
        : 'components/sections/FeedSection.vue';

    result[section.sectionId] = {
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      componentPath,
      relatedFilePaths: [componentPath, 'data/bindings.ts', 'spec/page-spec.json'],
      bindings: section.bindings
    };

    return result;
  }, {});
}

function renderSelectable(params: {
  descriptor: PreviewSectionDescriptor;
  elementId: string;
  elementLabel: string;
  textValue?: unknown;
  className?: string;
  tag?: string;
  body: string;
}) {
  const tag = params.tag || 'div';

  return `<${tag}
  class="${params.className || ''}"
  data-selectable="true"
  data-element-id="${escapeHtml(params.elementId)}"
  data-element-label="${escapeHtml(params.elementLabel)}"
  data-section-id="${escapeHtml(params.descriptor.sectionId)}"
  data-section-title="${escapeHtml(params.descriptor.sectionTitle)}"
  data-component-path="${escapeHtml(params.descriptor.componentPath)}"
  data-related-files="${toJsonAttribute(params.descriptor.relatedFilePaths)}"
  data-bindings="${toJsonAttribute(params.descriptor.bindings)}"
  ${params.textValue !== undefined ? `data-text-value="${escapeHtml(params.textValue)}"` : ''}
>${params.body}</${tag}>`;
}

function createPreviewHtml(
  spec: PageSpec,
  table: DataTable,
  rows: Record<string, unknown>[],
  fieldRoleMap: FieldRoleMap,
  contract: PageBindingContract
) {
  const sections = buildPreviewSectionDescriptors(contract);
  const heroSection = sections.hero;
  const footerSection = sections.footer;
  const repeatedSection = contract.sections.find((section) => section.repeat) || contract.sections[0];
  const listSection = sections[repeatedSection.sectionId];

  const titleField = pickFieldByRole(fieldRoleMap, 'title');
  const summaryField = pickFieldByRole(fieldRoleMap, 'summary');
  const mediaField = pickFieldByRole(fieldRoleMap, 'media');
  const metaField = pickFieldByRole(fieldRoleMap, 'meta');
  const linkField = pickFieldByRole(fieldRoleMap, 'link');

  const cards = rows.map((row, index) => {
    const title = titleField ? row[titleField] : `Preview item ${index + 1}`;
    const summary = summaryField ? row[summaryField] : 'Add a summary-style field to make this card richer.';
    const media = mediaField ? row[mediaField] : '';
    const meta = metaField ? row[metaField] : `Item ${index + 1}`;
    const href = linkField ? row[linkField] : '#';

    return renderSelectable({
      descriptor: listSection,
      tag: 'article',
      className: 'card',
      elementId: `feed-card-${index + 1}`,
      elementLabel: 'Feed card',
      textValue: title,
      body: `
${media ? renderSelectable({
  descriptor: listSection,
  className: 'card-media',
  elementId: `feed-card-media-${index + 1}`,
  elementLabel: 'Card image',
  textValue: media,
  body: `<img src="${escapeHtml(media)}" alt="" />`
}) : ''}
<a class="card-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
  <div class="card-body">
    ${renderSelectable({
      descriptor: listSection,
      tag: 'p',
      className: 'card-meta',
      elementId: `feed-card-meta-${index + 1}`,
      elementLabel: 'Card meta',
      textValue: meta,
      body: escapeHtml(meta)
    })}
    ${renderSelectable({
      descriptor: listSection,
      tag: 'h3',
      elementId: `feed-card-title-${index + 1}`,
      elementLabel: 'Card title',
      textValue: title,
      body: escapeHtml(title)
    })}
    ${renderSelectable({
      descriptor: listSection,
      tag: 'p',
      elementId: `feed-card-summary-${index + 1}`,
      elementLabel: 'Card summary',
      textValue: summary,
      body: escapeHtml(summary)
    })}
  </div>
</a>`
    });
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(spec.meta.title)}</title>
    <style>
      :root { color-scheme: dark; --accent: #76b900; --panel: #111111; --border: #5e5e5e; --text: #ffffff; --muted: #a7a7a7; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at top right, rgba(118,185,0,.12), transparent 24%), linear-gradient(180deg, #030303 0%, #0a0a0a 100%); color: var(--text); }
      .page { min-height: 100vh; padding: 40px 32px 64px; }
      .hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr); gap: 20px; margin-bottom: 24px; }
      .hero-copy, .hero-panel, .card { border: 1px solid var(--border); border-radius: 2px; box-shadow: rgba(0,0,0,.3) 0 0 5px 0; }
      .hero-copy, .hero-panel { position: relative; background: rgba(0,0,0,.86); }
      .hero-copy::before, .hero-panel::before { content: ''; position: absolute; inset: 0; border-top: 2px solid var(--accent); pointer-events: none; }
      .hero-copy { padding: 28px; }
      .hero-panel { padding: 24px; }
      .hero-stat strong { display: block; font-size: 28px; }
      .eyebrow { margin: 0 0 12px; color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 12px; font-size: 36px; }
      .hero-copy p:last-child, .hero-panel span, .list-header p, .card p, footer { color: var(--muted); }
      .list-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
      .card { overflow: hidden; background: linear-gradient(180deg, rgba(17,17,17,.94), rgba(7,7,7,.98)); }
      .card-link { color: inherit; text-decoration: none; }
      .card-media { height: 160px; background: #050505; border-bottom: 1px solid var(--border); }
      .card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .card-body { padding: 16px; }
      .card-meta { color: var(--accent); text-transform: uppercase; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
      .card h3 { font-size: 20px; line-height: 1.25; margin-bottom: 10px; }
      footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 14px; }
      [data-selectable='true'] { cursor: pointer; }
      [data-selectable='true']:hover { outline: 1px solid rgba(118,185,0,.55); outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main class="page">
      ${renderSelectable({
        descriptor: heroSection,
        tag: 'section',
        className: 'hero',
        elementId: 'hero-section',
        elementLabel: 'Hero section',
        textValue: spec.meta.title,
        body: `
${renderSelectable({
  descriptor: heroSection,
  className: 'hero-copy',
  elementId: 'hero-copy',
  elementLabel: 'Hero copy',
  textValue: spec.meta.description,
  body: `<p class="eyebrow">${escapeHtml(spec.meta.pageType)}</p><h1>${escapeHtml(spec.meta.title)}</h1><p>${escapeHtml(spec.meta.description || `Generated from ${table.name}`)}</p>`
})}
${renderSelectable({
  descriptor: heroSection,
  tag: 'aside',
  className: 'hero-panel',
  elementId: 'hero-panel',
  elementLabel: 'Hero metrics',
  body: `<p class="eyebrow">Workbench status</p><div class="hero-stat"><strong>${rows.length}</strong><span>preview rows</span></div><div class="hero-stat"><strong>${table.columns.length}</strong><span>available fields</span></div>`
})}`
      })}
      ${renderSelectable({
        descriptor: listSection,
        tag: 'section',
        elementId: 'feed-section',
        elementLabel: listSection.sectionTitle,
        body: `<div class="list-header"><div><p class="eyebrow">Generated section</p><h2>${escapeHtml(table.name)} collection</h2></div><p>${escapeHtml(spec.meta.stylePreset)}</p></div><div class="grid">${cards || '<article class="card"><div class="card-body"><h3>No rows yet</h3><p>Add rows to the current table and regenerate the page.</p></div></article>'}</div>`
      })}
      ${renderSelectable({
        descriptor: footerSection,
        tag: 'footer',
        elementId: 'footer-section',
        elementLabel: 'Footer',
        textValue: table.name,
        body: `Bound to <strong>${escapeHtml(table.name)}</strong> using the <strong>${escapeHtml(spec.meta.stylePreset)}</strong> preset.`
      })}
    </main>
    <script>
      document.addEventListener('click', function(event) {
        const target = event.target instanceof Element ? event.target.closest('[data-selectable="true"]') : null;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage({
          source: 'page-builder-preview-select',
          payload: {
            elementId: target.getAttribute('data-element-id') || '',
            elementLabel: target.getAttribute('data-element-label') || 'Selected element',
            sectionId: target.getAttribute('data-section-id') || '',
            sectionTitle: target.getAttribute('data-section-title') || '',
            componentPath: target.getAttribute('data-component-path'),
            relatedFilePaths: JSON.parse(target.getAttribute('data-related-files') || '[]'),
            bindings: JSON.parse(target.getAttribute('data-bindings') || '[]'),
            textValue: target.getAttribute('data-text-value') || ''
          }
        }, '*');
      }, true);
    </script>
  </body>
</html>`;
}

export function buildMockPageProject(table: DataTable, request: PageBuildRequest) {
  const fieldRoleMap = inferFieldRoles(table);
  const spec = createPageSpec(table, request, fieldRoleMap);
  const bindingContract = createBindingContract(spec, fieldRoleMap);
  const sampleRows = table.rows.slice(0, 6);
  const previewHtml = createPreviewHtml(spec, table, sampleRows, fieldRoleMap, bindingContract);
  const files = createProjectFiles(spec, bindingContract, sampleRows, previewHtml);
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
    sectionSummaries: createSectionSummaries(spec.layout.sections),
    previewHtml
  };
}

export function buildProjectFromGeneratedFiles(params: {
  table: DataTable;
  files: Array<{ path: string; content: string }>;
  assistantMessage?: string;
}) {
  const specFile = params.files.find((file) => file.path === 'spec/page-spec.json');
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
    editable: file.path !== 'spec/page-spec.json',
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

export async function renderProjectPreview(files: PageBuilderFile[], options?: { entryPath?: string; title?: string }) {
  const response = await api.post('/page-builder/render-preview', {
    files: files.map((file) => ({
      path: file.path,
      type: file.type,
      content: file.content
    })),
    entryPath: options?.entryPath || 'app/PageView.vue',
    title: options?.title
  }) as {
    success: boolean;
    html: string;
    error: string | null;
  };

  if (!response.success) {
    return response.html;
  }

  return response.html;
}
