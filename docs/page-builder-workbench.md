# Page Builder Workbench

## 1. Purpose

This document defines the shell of the first page builder.

It does **not** focus on:

- long-term product vision
- sketch-to-page
- free-form AI website generation

It focuses on one practical question:

`What kind of interface should the first page builder live in?`

## 2. Core Direction

The first page builder should be:

`a full-screen generated-page sandbox`

This means:

- it should feel closer to a code-generation workspace than a generic settings form
- it should visibly contain generated files
- it should include a live runtime preview
- it should support inspection of generated structure and bindings

The first page builder should **not** be:

- a chat-first interface
- a Figma-like editor
- a second workflow editor
- a hidden code generator with no project structure

## 3. Product Inspiration

The most useful inspiration is:

- `v0` for generated project/file visibility
- a structured workbench for state and tooling

What to borrow from a v0-like direction:

- visible file tree
- generated output as real files
- preview and code as first-class views
- project-like mental model

What not to copy directly:

- React / Next-specific assumptions
- dependency on a separate frontend stack

## 4. Frontend Stack Decision

The page builder should stay inside the current stack:

- Vue 3
- Vite
- Pinia

Reasons:

1. The crawler workbench already exists in Vue.
2. Data tables already exist in Vue.
3. Splitting page generation into a separate React/Next frontend would:
   - fragment the product
   - duplicate state logic
   - complicate preview and data binding
   - increase maintenance cost

Conclusion:

- keep the workbench in Vue
- do not spin up a separate React shell

## 5. Shell Identity

The right identity for phase 1 is:

`a browser-native generated-page sandbox`

This identity implies:

- users see project structure
- users see code output
- users see preview output
- users inspect bindings and section meaning

It is not just a preview screen.
It is not just a config panel.

## 6. High-Level Layout

Recommended layout:

```text
---------------------------------------------------------------------------
| Top Bar                                                                  |
---------------------------------------------------------------------------
| Left File Tree |               Center Sandbox               | Right Panel |
|                |  preview / code tabs / split mode         |             |
---------------------------------------------------------------------------
| Optional Bottom Console / Generation Logs / Validation Info              |
---------------------------------------------------------------------------
```

This is the correct balance for phase 1 because:

- left = structure
- center = core work area
- right = contextual understanding

## 7. Top Bar Responsibilities

The top bar should be lightweight and generation-oriented.

Suggested contents:

### Left

- back button
- current page build name
- saved / unsaved state

### Center

- selected table
- page type
- style preset

### Right

- generate
- regenerate
- preview / code / split switch
- export
- more menu

The top bar should not become a crowded toolbar.

## 8. Left Panel Responsibilities

The left panel should be the `file tree`.

Its purpose is to answer:

`What project files does this generated page currently contain?`

### Recommended contents

- project root
- main page file
- style file
- script file
- spec file
- optional section files later

### Suggested first-phase file structures

#### Option A: Simple multi-file web output

```text
Page Project
  index.html
  styles.css
  app.js
  page-spec.json
```

#### Option B: Vue-oriented output

```text
Page Project
  PageView.vue
  styles.css
  page-spec.json
```

### Recommendation

For phase 1, keep it simple.

The generated file structure should be small enough that users can understand it immediately.

## 9. Center Area Responsibilities

The center area is the main work area.

It should support three primary modes:

### Preview Mode

- live preview
- desktop / tablet / mobile switch
- refresh preview

### Code Mode

- open selected file from the left tree
- file tabs
- editor-grade readable code display

### Split Mode

- preview on one side
- selected code file on the other side

The center should feel like a mini runtime workspace.

## 10. Code Display Quality Is A Hard Requirement

Because this workbench is explicitly moving toward a `v0-like generated-code sandbox`, code cannot be shown as plain text only.

The code surface must feel like a real editor.

This is not optional polish.
It is part of the core product requirement.

### Minimum code display requirements

The first implementation should support:

- syntax highlighting
- line numbers
- file tabs
- dark editor styling
- proper scrolling for long files
- clear active file state
- readable indentation and whitespace

### Minimum supported file types

The first implementation should correctly distinguish and highlight:

- `html`
- `css`
- `js`
- `ts`
- `json`
- `vue`

### File tree requirements

The file tree should also visually indicate file type.

At minimum it should support:

- file extension-based icons or badges
- active file highlighting
- obvious distinction between html/css/js/vue/json

Example:

```text
Page Project
  HTML  index.html
  CSS   styles.css
  JS    app.js
  JSON  page-spec.json
```

That helps users understand the output as a small real project instead of anonymous generated text.

### Recommended editor choice

The first implementation should not hand-roll syntax highlighting.

Preferred choice:

- `Monaco Editor`

Why:

1. it gives editor-grade visual quality immediately
2. it matches user expectations from tools like v0
3. it supports the file types needed in phase 1
4. it works well for code / preview / split workflows

Fallback option:

- `CodeMirror 6`

But the default recommendation for this product direction is still `Monaco`.

## 11. Why The Whole Page Should Feel Like A Sandbox

The whole page builder should feel like:

`a sandbox environment for a generated page project`

This is important because it makes the product feel concrete.

Users should feel:

- the generated page is a real artifact
- the artifact has files
- the artifact can run
- the artifact can be inspected

That is much stronger than a pure form-based builder.

## 12. Right Panel Responsibilities

The right panel should exist, but it should not be the main work area.

Its recommended role is:

`context-aware binding and property panel`

That means it shows information about:

- the currently selected file
- or the currently selected page section in preview

This is the strongest role for the right panel because:

- it is useful
- it is not redundant with the file tree
- it does not compete with the center sandbox

## 13. Right Panel Behavior

The right panel should be dynamic.

### When nothing is selected

It should collapse to a thin rail or compact inactive state.

It should not occupy large space doing nothing.

### When a file is selected

It should show file-level context.

### When a preview section is selected

It should show section-level binding and property context.

### When generation reports problems

It may surface warnings relevant to the current selection.

## 14. File-Level Right Panel Content

When a file is selected, the right panel can show:

- file name
- file type
- file role
- generated source
- related page spec sections
- whether the file is safe to edit manually
- regeneration impact

Example:

```text
File: styles.css
Role: global page styling
Generated from:
- hero
- list cards
- footer
Editable: yes
Regeneration impact: medium
```

## 15. Section-Level Right Panel Content

When the user clicks a section in preview, the right panel should show:

- section id
- section type
- whether it repeats
- bound data fields
- title binding
- image binding
- description binding
- link binding
- layout props

Example:

```text
Section: article-list
Type: list
Repeat: true
Bindings:
- title -> title
- image -> cover
- summary -> desc
- href -> url
```

This is the most useful right-panel mode for phase 1.

## 16. Right Panel Actions

Keep right-panel actions lightweight.

Suggested phase-1 actions:

- remap one binding
- rename a section title
- show / hide one section
- toggle a simple section option
- regenerate current section

Do not turn the right panel into a heavy full editor too early.

## 17. Why The Right Panel Should Not Be The Main Config Area

If the right panel becomes the main generation configuration surface, the workbench drifts back into a dashboard-like tool.

That would weaken the sandbox identity.

The right balance is:

- left = structure
- center = main runtime/code surface
- right = contextual inspector

## 18. Why Preview Should Use iframe

The phase-1 preview should use an `iframe`.

Reasons:

1. style isolation
2. cleaner sandbox mental model
3. easier export path later
4. reduced risk of generated styles affecting the workbench

Without iframe:

- global styles may leak
- preview may break the shell
- debugging becomes noisier

## 19. What The iframe Should Render

The iframe should render generated output from a stable internal payload.

Recommended sequence:

1. build `PageSpec`
2. generate project files
3. render preview payload in iframe

### Phase-1 output strategy

The first phase can choose between:

- simple HTML/CSS/JS output
- Vue-oriented generated file output with a preview adapter

Either is fine as long as:

- files are visible
- preview is deterministic
- export remains possible

## 20. Recommended Frontend Structure

Suggested additions:

```text
frontend/src/
  views/
    PageBuilderView.vue
  components/
    pageBuilder/
      PageBuilderTopBar.vue
      PageBuilderFileTree.vue
      PageBuilderSandbox.vue
      PageBuilderPreview.vue
      PageBuilderCodeTabs.vue
      PageBuilderCodeEditor.vue
      PageBuilderRightPanel.vue
      PageBuilderFileInspector.vue
      PageBuilderSectionInspector.vue
      PageBuilderSetupDrawer.vue
      PageBuilderExportMenu.vue
  stores/
    pageBuilder.ts
  services/
    pageBuilder.ts
  types/
    pageBuilder.ts
```

## 21. Recommended Store Responsibilities

The page builder store should own:

- selected table
- page type
- style preset
- page title
- inferred field roles
- generated page spec
- generated files
- active file
- selected preview section
- center mode
- preview status
- error state

Suggested shape:

```ts
export interface PageBuilderState {
  selectedTableId: string | null;
  pageType: string | null;
  stylePreset: string;
  pageTitle: string;
  fieldRoleMap: Record<string, string>;
  spec: PageSpec | null;
  files: Array<{
    id: string;
    name: string;
    type: 'html' | 'css' | 'js' | 'vue' | 'json';
    content: string;
  }>;
  activeFileId: string | null;
  selectedSectionId: string | null;
  centerMode: 'preview' | 'code' | 'split';
  previewStatus: 'idle' | 'building' | 'ready' | 'error';
  error: string | null;
}
```

## 22. Recommended Generation Flow

The workbench flow should be explicit:

1. choose data table
2. choose page type
3. choose style preset
4. infer field roles
5. build page spec
6. generate files
7. validate generated output
8. render preview in sandbox

This should be visible as product state, not hidden behind one black-box button.

## 23. MVP Interaction Design

Suggested phase-1 interaction:

### Before generation

- left file tree is empty or shows placeholder project
- center shows “select data and generate page”
- right panel stays collapsed

### After generation

- left shows generated files
- center shows preview/code/split with syntax-highlighted code view
- right shows file or section context depending on selection

This creates a clear project-like experience immediately.

## 24. Export Strategy

The workbench must not trap output.

Recommended export targets for phase 1:

- export page spec
- export generated files bundle

Later:

- publish page
- deploy page
- multi-page site output

## 25. What The Workbench Should Not Become Yet

Avoid these traps:

### 25.1 Do not make it a workflow editor clone

The page builder is not another flow canvas.

### 25.2 Do not make it a full drag-and-drop visual editor

That would slow the product too much.

### 25.3 Do not make it chat-first

Structure matters more than conversation in phase 1.

### 25.4 Do not hide generated code completely

That would conflict with the sandbox direction.

### 25.5 Do not let the right panel become a second main work area

It should stay contextual and secondary.

### 25.6 Do not over-fragment file output too early

Too many generated files will make the first version harder to understand.

## 26. First-Phase Visual Direction

The workbench should follow the existing style guide:

- dark shell
- green accent as signal, not large surface fill
- sharp corners
- engineering-tool feeling
- restrained contrast

That means:

- left file tree should feel like a project navigator
- center sandbox chrome should stay minimal
- center code panel should feel like a real editor, not a styled textarea
- right panel highlight states should use green outline / signal treatment
- avoid large blue active fills

## 27. Recommended MVP Build Order

The implementation order should be:

1. create `PageBuilderView.vue`
2. scaffold the top bar
3. scaffold the left file tree
4. scaffold the center sandbox:
   - preview
   - code tabs
   - split mode
5. integrate editor-grade code display:
   - Monaco preferred
   - syntax highlighting for html/css/js/json/vue
6. scaffold the right context panel:
   - file inspector
   - section inspector
7. scaffold the setup drawer for generation inputs
8. connect generated files state
9. connect generation pipeline

This lets the shell exist before the page-generation logic is complete.

## 28. Practical Conclusion

The first page builder should start as:

`a Vue-based, full-screen generated-page sandbox with a file tree on the left, a sandbox workspace in the center, and a contextual inspector on the right`

That is the most practical shell because it:

- fits the current app
- aligns with v0-like expectations
- keeps generated files visible
- keeps preview central
- ensures generated code is readable at editor quality
- gives the right panel a clear non-redundant role
- supports deterministic generation
- avoids overcommitting to a heavy visual editor too early

## 29. Immediate Next Step

Before implementing generation logic, the next implementation step should be:

1. create the page-builder route and shell
2. scaffold the top bar
3. scaffold the left file tree
4. scaffold the center sandbox
5. scaffold the right context panel
6. scaffold the setup drawer for page generation inputs

Only after that should spec generation logic be connected.
