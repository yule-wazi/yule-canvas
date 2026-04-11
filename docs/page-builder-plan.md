# Page Builder Plan

## 1. Why Shift Focus Now

The crawler side is no longer a blank prototype.

Current reality:

- recording + mapping can already complete part of real scraping work
- the current workflow editing experience is already usable
- continuing to rebuild AI-assisted crawler generation right now would be:
  - expensive
  - hard to stabilize
  - slow to validate

Because of that, the best next move is to start the `page building` side.

This does **not** mean abandoning the crawler.
It means freezing the crawler at a practical level and using it as the data source for the next product stage.

## 2. Product Positioning

The long-term goal is still a dual-agent product:

1. `data extraction agent`
2. `page building agent`

But the page-building side should not start from the hardest version.

The first version should **not** be:

- free-form AI website generation from any prompt
- sketch-to-page understanding
- full autonomous design agent

The first version should be:

`structured data table -> page schema -> generated page workspace`

That is the shortest path to a real, testable second product half.

## 3. First-Phase Goal

The first phase of the page builder should answer one concrete question:

`Can the product take an extracted data table and quickly generate a usable webpage skeleton with correct data binding?`

If this works, then the project becomes more than a crawler platform.
It becomes a `data-to-page product`.

## 4. Scope Boundary

### In Scope For Phase 1

- choose a data table
- inspect table schema and sample rows
- choose a page type
- choose a style direction
- generate a page spec
- generate page code from the page spec
- bind data fields into generated page sections
- preview the page in the app
- allow light manual editing after generation

### Not In Scope For Phase 1

- sketch upload and sketch interpretation
- multi-page site generation
- advanced responsive editor
- arbitrary visual design generation
- autonomous content planning
- automatic crawler + page builder orchestration

## 5. Recommended Phase 1 Product Shape

The first version should be a `page generator workbench`, not a full visual design editor.

Suggested user flow:

1. User chooses an existing data table
2. User chooses a page type
3. User chooses a style preset
4. System generates a page spec
5. System generates page code from that spec
6. User previews the page
7. User can regenerate or lightly edit sections

This is easier to build and much more stable than direct free-form generation.

## 6. Core Design Principle

Do not generate final page code directly from raw user input whenever possible.

Recommended pipeline:

`data table + user intent -> page spec -> page code -> preview`

The `page spec` is the key stabilizing layer.

Without it:

- generation becomes opaque
- binding errors are harder to debug
- regeneration is harder to control
- later visual editing becomes harder

## 7. Phase 1 Input Model

The page builder should accept these inputs:

### Required

- `tableId`
- `table schema`
- `sample rows`
- `page type`

### Optional

- `page goal`
- `title`
- `style preset`
- `accent preference`
- `layout density`
- `visible sections`
- `field mapping hints`

Suggested input object:

```ts
export interface PageBuildRequest {
  tableId: string;
  pageType: 'news-list' | 'article-detail' | 'gallery' | 'showcase' | 'catalog';
  goal?: string;
  title?: string;
  stylePreset?: 'nvidia-tech' | 'editorial-dark' | 'minimal-grid';
  density?: 'compact' | 'comfortable';
  sectionHints?: string[];
  fieldHints?: Record<string, string>;
}
```

## 8. Page Spec Design

This is the most important part of the first phase.

Suggested shape:

```ts
export interface PageSpec {
  version: 'v1';
  meta: {
    title: string;
    description?: string;
    pageType: string;
    stylePreset: string;
  };
  dataSource: {
    tableId: string;
    primaryKey?: string;
    fields: Array<{
      key: string;
      type: string;
      role?: string;
    }>;
  };
  layout: {
    sections: PageSectionSpec[];
  };
}

export interface PageSectionSpec {
  id: string;
  kind:
    | 'hero'
    | 'list'
    | 'grid'
    | 'featured-card'
    | 'content'
    | 'media'
    | 'footer';
  title?: string;
  description?: string;
  repeat?: boolean;
  bindings?: Record<string, string>;
  props?: Record<string, any>;
}
```

### Why This Matters

The spec gives you:

- stable regeneration
- inspectable output
- easier debugging
- easier future visual editing
- easier future AI refinement

## 9. Recommended Page Types For MVP

Do not support too many types first.

Best initial set:

1. `news-list`
   Good match for your current crawler use case

2. `article-detail`
   Good for title + image + content-style rendering

3. `gallery`
   Good for image-heavy data tables

4. `catalog`
   Good for generic card-based listing data

These four types already cover a large percentage of early testing.

## 10. Style Strategy

The style guide already exists.
The page builder should not invent uncontrolled styles in phase 1.

Recommended approach:

- page generation must consume a `style preset`
- presets should be constrained and coded
- AI can choose between allowed presets, not invent arbitrary design systems

Suggested first preset set:

- `nvidia-tech`
- `editorial-dark`
- `clean-catalog`

The existing style guide should remain the default visual anchor.

## 11. Code Generation Strategy

Phase 1 should prefer deterministic code generation from `PageSpec`.

That means:

- AI may help build the `PageSpec`
- final page code should ideally be generated by templates/components

Recommended pipeline:

1. AI or rules generate `PageSpec`
2. `PageSpecRenderer` turns the spec into Vue page/component code
3. preview renders that output

This is much more stable than:

`prompt -> raw page code`

## 12. Recommended Technical Architecture

### Frontend

Suggested additions:

```text
frontend/src/
  components/
    pageBuilder/
      PageBuilderPanel.vue
      PageTypePicker.vue
      StylePresetPicker.vue
      PageSpecPreview.vue
      PagePreviewFrame.vue
  stores/
    pageBuilder.ts
  services/
    pageBuilder.ts
  types/
    pageBuilder.ts
```

### Backend

Suggested additions:

```text
backend/src/
  routes/
    pageBuilder.ts
  services/
    pageBuilder/
      PageSpecBuilder.ts
      PageSpecValidator.ts
      PageCodeGenerator.ts
```

### Shared

Suggested additions:

```text
shared/
  pageBuilder/
    types.ts
```

## 13. Backend Responsibilities

### PageSpecBuilder

Builds or assists with:

- field-role inference
- section selection
- section binding
- page spec assembly

### PageSpecValidator

Checks:

- missing field bindings
- unsupported section types
- invalid table references
- unsafe or incomplete config

### PageCodeGenerator

Turns spec into:

- Vue SFC page code
- section components if needed
- mock preview structure

## 14. Frontend Responsibilities

### Page Builder Store

Owns:

- selected table
- selected page type
- selected style preset
- generated page spec
- generated code
- preview state

### Page Builder UI

Owns:

- form inputs
- table/schema preview
- generation actions
- spec preview
- rendered preview

## 15. MVP User Experience

Recommended first UX:

1. open a new `Page Builder` panel or route
2. select one data table
3. choose one page type
4. choose one style preset
5. click `generate page`
6. see:
   - inferred field roles
   - generated section structure
   - live preview

Optional advanced controls can come later.

## 16. What The MVP Should Output

The MVP should output these three things:

1. `PageSpec`
2. generated page code
3. previewable page result

If one of these is missing, iteration becomes much harder.

## 17. Recommended Implementation Order

This is the suggested build order.

### Step 1

Define shared types:

- `PageBuildRequest`
- `PageSpec`
- `PageSectionSpec`

### Step 2

Build deterministic field-role inference:

Examples:

- `title` -> title
- `content/body/text` -> content
- `img/image/cover/thumbnail` -> media
- `url/link/href` -> link
- `date/publishedAt/createdAt` -> meta

### Step 3

Build deterministic page-spec generation for 1 page type:

- start with `news-list`

### Step 4

Build spec-to-code renderer

### Step 5

Build preview panel in frontend

### Step 6

Add optional AI assistance for spec improvement, not raw page generation

## 18. Why News List Should Be First

Because your current crawler output is already close to that shape:

- title
- image
- description
- content
- url
- date

This means the first page-builder MVP can use real project data immediately.

That is much better than designing around hypothetical future data.

## 19. Risks

### Risk 1: Overbuilding the generator

If phase 1 tries to support too many page types or too much freedom, it will stall.

### Risk 2: Skipping the spec layer

If code is generated directly without a spec, stability and debugging will be poor.

### Risk 3: Weak data-role inference

If field roles are inferred badly, the generated page will feel random.

### Risk 4: Mixing page builder with crawler refactor at the same time

This will slow both down.

Recommendation:

- freeze crawler core
- build page-builder MVP cleanly

## 20. Clear Decision

The next product milestone should be:

`Generate a usable news-style page from an existing extracted data table.`

That is the first page-builder milestone worth implementing.

## 21. Immediate Next Step

Do not implement UI first.

The next implementation step should be:

1. define shared page-builder types
2. define field-role inference rules
3. define the first `news-list` page spec builder

Only after that should the UI start.
