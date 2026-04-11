import type { DataTable } from '../stores/dataTable';
import type {
  PageBuildRequest,
  PageBuilderFile,
  PageBuilderSectionSummary,
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
      title: '首屏',
      description: '根据数据主题生成的顶部概览区。',
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
      title: '新闻列表',
      description: '绑定提取结果的主列表区块。',
      repeat: true,
      bindings: {
        ...(titleField ? { title: titleField } : {}),
        ...(summaryField ? { summary: summaryField } : {}),
        ...(contentField ? { content: contentField } : {}),
        ...(mediaField ? { image: mediaField } : {}),
        ...(linkField ? { href: linkField } : {}),
        ...(metaField ? { meta: metaField } : {})
      },
      props: {
        cardStyle: request.stylePreset || 'nvidia-tech',
        density: request.density || 'comfortable'
      }
    },
    {
      id: 'footer',
      kind: 'footer',
      title: '页脚',
      description: '用于承载补充说明和元信息的轻量区域。',
      bindings: metaField ? { meta: metaField } : {},
      props: {
        note: '当前内容由页面生成工作台创建'
      }
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
      title: '首屏',
      description: '页面顶部的概览区域。',
      bindings: {
        ...(titleField ? { heading: titleField } : {}),
        ...(summaryField ? { subheading: summaryField } : {}),
        ...(mediaField ? { image: mediaField } : {})
      },
      props: {
        emphasis: request.stylePreset || 'nvidia-tech'
      }
    },
    {
      id: request.pageType === 'gallery' ? 'gallery-grid' : 'content-list',
      kind: request.pageType === 'gallery' ? 'grid' : 'list',
      title: request.pageType === 'gallery' ? '图片网格' : '内容列表',
      description: '绑定提取结果的主要重复区块。',
      repeat: true,
      bindings: {
        ...(titleField ? { title: titleField } : {}),
        ...(summaryField ? { summary: summaryField } : {}),
        ...(mediaField ? { image: mediaField } : {}),
        ...(linkField ? { href: linkField } : {})
      },
      props: {
        density: request.density || 'comfortable'
      }
    }
  ];
}

function buildPageSections(fieldRoleMap: FieldRoleMap, request: PageBuildRequest): PageSectionSpec[] {
  if (request.pageType === 'news-list') {
    return buildNewsListSections(fieldRoleMap, request);
  }

  return buildGenericSections(fieldRoleMap, request);
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
      title: request.title || `${table.name} 页面`,
      description: request.goal || `基于 ${table.name} 数据表生成的 ${request.pageType} 页面`,
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

function getSectionBindings(spec: PageSpec, sectionId: string) {
  return spec.layout.sections.find((section) => section.id === sectionId)?.bindings || {};
}

function buildGeneratedVueSource(spec: PageSpec) {
  const heroBindings = getSectionBindings(spec, 'hero');
  const listSection = spec.layout.sections.find((section) => section.repeat);
  const listBindings = listSection?.bindings || {};
  const footerBindings = getSectionBindings(spec, 'footer');

  return `<template>
  <main class="generated-page">
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow">{{ spec.meta.pageType }}</p>
        <h1>{{ spec.meta.title }}</h1>
        <p class="hero-text">{{ spec.meta.description }}</p>
      </div>

      <div class="hero-panel">
        <div class="hero-stat">
          <strong>{{ items.length }}</strong>
          <span>条样例数据</span>
        </div>
        <div class="hero-stat">
          <strong>{{ spec.dataSource.fields.length }}</strong>
          <span>个可用字段</span>
        </div>
      </div>
    </section>

    <section class="list-section">
      <header class="section-header">
        <div>
          <p class="eyebrow">已生成区块</p>
          <h2>${listSection?.title || '内容列表'}</h2>
        </div>
        <p class="section-note">数据来源：{{ spec.dataSource.tableId }}</p>
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
            <p class="card-meta">{{ read(item, listBindings.meta) || \`第 \${index + 1} 条\` }}</p>
            <h3>{{ read(item, listBindings.title) || '未命名内容' }}</h3>
            <p>{{ read(item, listBindings.summary) || read(item, listBindings.content) || '补充摘要字段后，这里会显示更完整的简介内容。' }}</p>
          </div>
        </a>
      </div>

      <div v-else class="empty-block">
        当前没有样例数据，请先向数据表写入内容。
      </div>
    </section>

    <footer class="footer-section">
      <span>{{ read(firstItem, footerBindings.meta) || '页面生成工作台输出' }}</span>
    </footer>
  </main>
</template>

<script setup lang="ts">
import spec from './page-spec.json';
import items from './sample-data.json';
import './styles.css';

const firstItem = items[0] || {};
const heroBindings = ${JSON.stringify(heroBindings, null, 2)};
const listBindings = ${JSON.stringify(listBindings, null, 2)};
const footerBindings = ${JSON.stringify(footerBindings, null, 2)};

function read(row: Record<string, any>, key?: string) {
  if (!key) {
    return '';
  }

  return row?.[key] ?? '';
}
</script>
`;
}

function buildGeneratedStylesSource() {
  return `:root {
  color-scheme: dark;
  --accent: #76b900;
  --accent-soft: rgba(118, 185, 0, 0.14);
  --bg: #050505;
  --panel: #111111;
  --panel-soft: #171717;
  --border: #5e5e5e;
  --text: #ffffff;
  --muted: #a7a7a7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background:
    radial-gradient(circle at top right, rgba(118, 185, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #030303 0%, #0a0a0a 100%);
  color: var(--text);
}

.generated-page {
  min-height: 100vh;
  padding: 40px 32px 64px;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
  gap: 20px;
  margin-bottom: 24px;
}

.hero-copy,
.hero-panel,
.feed-card,
.empty-block {
  border: 1px solid var(--border);
  border-radius: 2px;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
}

.hero-copy,
.hero-panel {
  position: relative;
  background: rgba(0, 0, 0, 0.86);
}

.hero-copy::before,
.hero-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-top: 2px solid var(--accent);
  pointer-events: none;
}

.hero-copy {
  padding: 28px;
}

.hero-panel {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 24px;
}

.hero-stat strong {
  display: block;
  font-size: 28px;
  margin-bottom: 6px;
}

.hero-stat span,
.hero-text,
.section-note,
.card-body p,
.footer-section,
.empty-block {
  color: var(--muted);
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1,
.section-header h2,
.card-body h3 {
  margin: 0 0 12px;
  line-height: 1.25;
}

.hero-copy h1 {
  font-size: 36px;
}

.section-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 24px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.feed-card {
  overflow: hidden;
  background: linear-gradient(180deg, rgba(17, 17, 17, 0.96), rgba(7, 7, 7, 0.98));
  color: inherit;
  text-decoration: none;
}

.card-media {
  height: 170px;
  background: #000000;
  border-bottom: 1px solid var(--border);
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-body {
  padding: 16px;
}

.card-meta {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.card-body h3 {
  font-size: 20px;
}

.card-body p {
  margin: 0;
  line-height: 1.6;
}

.empty-block {
  padding: 18px;
  background: var(--panel-soft);
}

.footer-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 14px;
}

@media (max-width: 900px) {
  .generated-page {
    padding: 24px 16px 48px;
  }

  .hero-section {
    grid-template-columns: 1fr;
  }

  .hero-copy h1 {
    font-size: 28px;
  }
}
`;
}

function createProjectFiles(
  spec: PageSpec,
  previewHtml: string,
  sampleRows: Record<string, unknown>[]
): PageBuilderFile[] {
  const pageSpecJson = JSON.stringify(spec, null, 2);
  const sampleDataJson = JSON.stringify(sampleRows, null, 2);
  const pageViewSource = buildGeneratedVueSource(spec);
  const styleSource = buildGeneratedStylesSource();

  return [
    {
      id: 'page-view',
      name: 'PageView.vue',
      type: 'vue',
      role: '生成页面的主入口文件',
      editable: true,
      content: pageViewSource,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'styles',
      name: 'styles.css',
      type: 'css',
      role: '生成页面的全局样式文件',
      editable: true,
      content: styleSource,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'sample-data',
      name: 'sample-data.json',
      type: 'json',
      role: '用于本地预览和模板调试的样例数据',
      editable: false,
      content: sampleDataJson,
      sourceSectionIds: spec.layout.sections.filter((section) => section.repeat).map((section) => section.id)
    },
    {
      id: 'page-spec',
      name: 'page-spec.json',
      type: 'json',
      role: '用于重新生成和校验的稳定规格文件',
      editable: false,
      content: pageSpecJson,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'preview',
      name: 'preview.html',
      type: 'html',
      role: '在 iframe 中渲染的预览载荷文件',
      editable: false,
      content: previewHtml,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    }
  ];
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPreviewHtml(
  spec: PageSpec,
  table: DataTable,
  rows: Record<string, unknown>[],
  fieldRoleMap: FieldRoleMap
) {
  const titleField = pickFieldByRole(fieldRoleMap, 'title');
  const summaryField = pickFieldByRole(fieldRoleMap, 'summary');
  const mediaField = pickFieldByRole(fieldRoleMap, 'media');
  const metaField = pickFieldByRole(fieldRoleMap, 'meta');

  const listSectionId = spec.layout.sections.find((section) => section.repeat)?.id || 'news-list';
  const cards = rows
    .map((row, index) => {
      const title = titleField ? row[titleField] : `示例内容 ${index + 1}`;
      const summary = summaryField ? row[summaryField] : '补充摘要字段后，这里会显示更完整的简介内容。';
      const media = mediaField ? row[mediaField] : '';
      const meta = metaField ? row[metaField] : `第 ${index + 1} 条`;

      return `<article class="card" data-section-id="${escapeHtml(listSectionId)}">
  ${media ? `<div class="card-media"><img src="${escapeHtml(media)}" alt="" /></div>` : ''}
  <div class="card-body">
    <p class="card-meta">${escapeHtml(meta)}</p>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(summary)}</p>
  </div>
</article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(spec.meta.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --accent: #76b900;
        --bg: #050505;
        --panel: #111111;
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
      .page {
        min-height: 100vh;
        padding: 40px 32px 64px;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
        gap: 20px;
        margin-bottom: 24px;
      }
      .hero-copy,
      .hero-panel,
      .card {
        border: 1px solid var(--border);
        border-radius: 2px;
        box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
      }
      .hero-copy {
        background: rgba(0, 0, 0, 0.86);
        padding: 28px;
        position: relative;
      }
      .hero-panel {
        background: var(--panel);
        padding: 24px;
        position: relative;
      }
      .hero-copy::before,
      .hero-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        border-top: 2px solid var(--accent);
        pointer-events: none;
      }
      .eyebrow {
        margin: 0 0 12px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 {
        margin-bottom: 12px;
        font-size: 36px;
        line-height: 1.25;
      }
      .hero-copy p:last-child {
        margin-bottom: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .hero-stat {
        display: grid;
        gap: 10px;
      }
      .hero-stat strong {
        font-size: 28px;
      }
      .list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .list-header p {
        margin: 0;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .card {
        overflow: hidden;
        background: linear-gradient(180deg, rgba(17, 17, 17, 0.94), rgba(7, 7, 7, 0.98));
      }
      .card-media {
        height: 160px;
        background: #050505;
        border-bottom: 1px solid var(--border);
      }
      .card-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .card-body {
        padding: 16px;
      }
      .card-meta {
        color: var(--accent);
        text-transform: uppercase;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .card h3 {
        font-size: 20px;
        line-height: 1.25;
        margin-bottom: 10px;
      }
      .card p {
        color: var(--muted);
        line-height: 1.6;
      }
      footer {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
        color: var(--muted);
        font-size: 14px;
      }
      @media (max-width: 900px) {
        .page { padding: 24px 16px 48px; }
        .hero { grid-template-columns: 1fr; }
        h1 { font-size: 28px; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero" data-section-id="hero">
        <div class="hero-copy">
          <p class="eyebrow">${escapeHtml(spec.meta.pageType)}</p>
          <h1>${escapeHtml(spec.meta.title)}</h1>
          <p>${escapeHtml(spec.meta.description || `基于 ${table.name} 数据表生成的页面`)}</p>
        </div>
        <aside class="hero-panel">
          <p class="eyebrow">工作台状态</p>
          <div class="hero-stat">
            <strong>${rows.length}</strong>
            <span>条样例数据可用于预览</span>
          </div>
          <div class="hero-stat">
            <strong>${table.columns.length}</strong>
            <span>个字段可参与绑定</span>
          </div>
        </aside>
      </section>
      <section data-section-id="${escapeHtml(listSectionId)}">
        <div class="list-header">
          <div>
            <p class="eyebrow">已生成区块</p>
            <h2>${escapeHtml(table.name)} 列表</h2>
          </div>
          <p>${escapeHtml(spec.meta.stylePreset)} 预设</p>
        </div>
        <div class="grid">
          ${cards || '<article class="card"><div class="card-body"><h3>还没有数据</h3><p>给当前数据表添加内容后，这里会显示真实卡片预览。</p></div></article>'}
        </div>
      </section>
      <footer data-section-id="footer">
        当前页面基于 <strong>${escapeHtml(table.name)}</strong> 数据表生成，风格预设为 ${escapeHtml(spec.meta.stylePreset)}。
      </footer>
    </main>
  </body>
</html>`;
}

export function buildMockPageProject(table: DataTable, request: PageBuildRequest) {
  const fieldRoleMap = inferFieldRoles(table);
  const spec = createPageSpec(table, request, fieldRoleMap);
  const sampleRows = table.rows.slice(0, 6);
  const previewHtml = createPreviewHtml(spec, table, sampleRows, fieldRoleMap);

  return {
    fieldRoleMap,
    spec,
    files: createProjectFiles(spec, previewHtml, sampleRows),
    sectionSummaries: createSectionSummaries(spec.layout.sections),
    previewHtml
  };
}
