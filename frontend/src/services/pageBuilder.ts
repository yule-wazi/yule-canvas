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
  { pattern: /(summary|description|desc|excerpt)/i, role: 'summary' },
  { pattern: /(content|body|text|article)/i, role: 'content' },
  { pattern: /(image|img|cover|thumbnail|poster)/i, role: 'media' },
  { pattern: /(url|link|href)/i, role: 'link' },
  { pattern: /(date|time|published|created)/i, role: 'meta' }
];

export function inferFieldRoles(table: DataTable | null): Record<string, string> {
  if (!table) {
    return {};
  }

  return table.columns.reduce<Record<string, string>>((result, column) => {
    const matched = FIELD_ROLE_RULES.find((rule) => rule.pattern.test(column.key));
    result[column.key] = matched?.role || column.type;
    return result;
  }, {});
}

function buildSpecFields(table: DataTable, fieldRoleMap: Record<string, string>): PageSpecField[] {
  return table.columns.map((column) => ({
    key: column.key,
    type: column.type,
    role: fieldRoleMap[column.key]
  }));
}

function pickFieldByRole(fieldRoleMap: Record<string, string>, role: string): string | undefined {
  return Object.entries(fieldRoleMap).find(([, value]) => value === role)?.[0];
}

function buildSections(request: PageBuildRequest, fieldRoleMap: Record<string, string>): PageSectionSpec[] {
  const titleField = pickFieldByRole(fieldRoleMap, 'title');
  const summaryField = pickFieldByRole(fieldRoleMap, 'summary');
  const contentField = pickFieldByRole(fieldRoleMap, 'content');
  const mediaField = pickFieldByRole(fieldRoleMap, 'media');
  const linkField = pickFieldByRole(fieldRoleMap, 'link');
  const metaField = pickFieldByRole(fieldRoleMap, 'meta');

  const heroBindings: Record<string, string> = {};
  if (titleField) heroBindings.heading = titleField;
  if (summaryField) heroBindings.subheading = summaryField;
  if (mediaField) heroBindings.image = mediaField;

  const listBindings: Record<string, string> = {};
  if (titleField) listBindings.title = titleField;
  if (summaryField) listBindings.summary = summaryField;
  if (contentField) listBindings.content = contentField;
  if (mediaField) listBindings.image = mediaField;
  if (linkField) listBindings.href = linkField;
  if (metaField) listBindings.meta = metaField;

  return [
    {
      id: 'hero',
      kind: 'hero',
      title: 'Hero',
      description: 'Top introduction area for the generated page.',
      bindings: heroBindings,
      props: {
        emphasis: request.stylePreset || 'nvidia-tech'
      }
    },
    {
      id: request.pageType === 'gallery' ? 'gallery-grid' : 'content-list',
      kind: request.pageType === 'gallery' ? 'grid' : 'list',
      title: request.pageType === 'gallery' ? 'Media Grid' : 'Content List',
      description: 'Primary repeated section bound to extracted rows.',
      repeat: true,
      bindings: listBindings,
      props: {
        density: request.density || 'comfortable'
      }
    },
    {
      id: 'footer',
      kind: 'footer',
      title: 'Footer',
      description: 'Lightweight metadata and attribution area.',
      bindings: metaField ? { meta: metaField } : {},
      props: {
        note: 'Generated in the page builder sandbox'
      }
    }
  ];
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

function createProjectFiles(spec: PageSpec, previewHtml: string): PageBuilderFile[] {
  const pageSpecJson = JSON.stringify(spec, null, 2);
  const pageViewSource = `<template>
  <div class="generated-page">
    <section v-for="section in spec.layout.sections" :key="section.id">
      <!-- Render generated sections here -->
    </section>
  </div>
</template>

<script setup lang="ts">
import pageSpec from './page-spec.json';

const spec = pageSpec;
</script>
`;

  const styleSource = `:root {
  color-scheme: dark;
  --accent: #76b900;
  --bg: #000000;
  --panel: #111111;
  --border: #5e5e5e;
  --text: #ffffff;
  --muted: #a7a7a7;
}
`;

  return [
    {
      id: 'page-view',
      name: 'PageView.vue',
      type: 'vue',
      role: 'Main generated page entry',
      editable: true,
      content: pageViewSource,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'styles',
      name: 'styles.css',
      type: 'css',
      role: 'Global generated page styling',
      editable: true,
      content: styleSource,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'page-spec',
      name: 'page-spec.json',
      type: 'json',
      role: 'Stable spec used for regeneration and validation',
      editable: false,
      content: pageSpecJson,
      sourceSectionIds: spec.layout.sections.map((section) => section.id)
    },
    {
      id: 'preview',
      name: 'preview.html',
      type: 'html',
      role: 'Sandbox preview payload rendered in iframe',
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
  fieldRoleMap: Record<string, string>
) {
  const titleField = pickFieldByRole(fieldRoleMap, 'title');
  const summaryField = pickFieldByRole(fieldRoleMap, 'summary');
  const mediaField = pickFieldByRole(fieldRoleMap, 'media');
  const metaField = pickFieldByRole(fieldRoleMap, 'meta');

  const cards = rows
    .map((row, index) => {
      const title = titleField ? row[titleField] : `Sample item ${index + 1}`;
      const summary = summaryField ? row[summaryField] : 'Add summary binding to enrich this card.';
      const media = mediaField ? row[mediaField] : '';
      const meta = metaField ? row[metaField] : `Row ${index + 1}`;

      return `<article class="card" data-section-id="content-list">
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
<html lang="en">
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
          <p>${escapeHtml(spec.meta.description || `Generated from ${table.name}`)}</p>
        </div>
        <aside class="hero-panel">
          <p class="eyebrow">Sandbox Status</p>
          <div class="hero-stat">
            <strong>${rows.length}</strong>
            <span>sample rows ready for preview</span>
          </div>
          <div class="hero-stat">
            <strong>${table.columns.length}</strong>
            <span>fields available for binding</span>
          </div>
        </aside>
      </section>
      <section data-section-id="content-list">
        <div class="list-header">
          <div>
            <p class="eyebrow">Generated Section</p>
            <h2>${escapeHtml(table.name)} Feed</h2>
          </div>
          <p>${escapeHtml(spec.meta.stylePreset)} preset</p>
        </div>
        <div class="grid">
          ${cards || '<article class="card"><div class="card-body"><h3>No rows yet</h3><p>Add data to the selected table to see live cards here.</p></div></article>'}
        </div>
      </section>
      <footer data-section-id="footer">
        Generated from table <strong>${escapeHtml(table.name)}</strong> with ${escapeHtml(spec.meta.stylePreset)} styling.
      </footer>
    </main>
  </body>
</html>`;
}

export function buildMockPageProject(table: DataTable, request: PageBuildRequest) {
  const fieldRoleMap = inferFieldRoles(table);
  const sections = buildSections(request, fieldRoleMap);
  const spec: PageSpec = {
    version: 'v1',
    meta: {
      title: request.title || `${table.name} Page`,
      description: request.goal || `Generated ${request.pageType} page for ${table.name}`,
      pageType: request.pageType,
      stylePreset: request.stylePreset || 'nvidia-tech'
    },
    dataSource: {
      tableId: table.id,
      fields: buildSpecFields(table, fieldRoleMap)
    },
    layout: {
      sections
    }
  };

  const previewHtml = createPreviewHtml(spec, table, table.rows.slice(0, 6), fieldRoleMap);

  return {
    fieldRoleMap,
    spec,
    files: createProjectFiles(spec, previewHtml),
    sectionSummaries: createSectionSummaries(sections),
    previewHtml
  };
}
