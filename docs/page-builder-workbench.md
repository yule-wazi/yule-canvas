# Page Builder Workbench

## 1. Scope

This file is the stable design and official refactor direction for the page-builder workbench.

Use this file to answer:

- what the page-builder product must become
- which preview/runtime architecture is now officially chosen
- how AI-generated Vue files should be supported
- how crawler data should enter generated pages
- what the refactor phases are
- what the implementation checklist is

Do not use this file as the recent handoff log.
Use `docs/page-builder-context.md` for current session state.

## 2. Core Product Goal

The page builder must support:

`AI freely generating and editing real Vue project files that render pages from dynamically requested crawler-backed data`

This means the product is not a static demo generator.

It is intended to become:

`a data-driven Vue page workspace where generated files, preview, and crawler-backed runtime data are all part of the same editing loop`

## 3. Official Architecture Decision

The official current-stage refactor direction is now:

`workspace files in app state -> Sandpack preview runtime -> generated Vue app -> dynamic data adapter -> crawler-backed API`

This replaces the old direction:

`project.files -> custom preview compiler -> iframe srcdoc`

The old custom preview compiler path should now be treated as abandoned for the main page-builder architecture.

## 4. Why Sandpack Is Now The Chosen Refactor Direction

Sandpack is now the official current-stage preview execution layer because it gives the project the best path to the real product goal while avoiding the fragility of the previous custom preview system.

### 4.1 Why The Old `srcdoc` Direction Was Rejected

The old custom preview path was rejected because:

- it was too fragile even for fallback-generated Vue files
- it would become much more fragile once AI is allowed to freely generate Vue SFC files
- it forced the repo to re-implement behavior already solved by real frontend toolchains

### 4.2 Why The Temporary Disk-Based Vite Preview Experiment Is Not The Main Refactor Path

The local `generated-projects/... + spawned Vite` experiment was valuable as a validation step, but it should not remain the current main refactor path.

Reason:

- it introduces local-process and filesystem complexity too early
- it is awkward for fast iteration inside the current app
- it complicates the current stage before the workspace model and data contract are stable
- it is still not the deployed multi-user answer

### 4.3 Why Sandpack Fits The Current Stage Better

Sandpack is now preferred for the current stage because:

- it can run a virtual file workspace directly in the browser
- it supports fast feedback for file changes
- it is far more suitable than the old custom compiler for iterating on Vue-like app preview
- it lets the product settle the workspace and file-editing model before server runtime concerns dominate the implementation

Important limitation:

Sandpack is the chosen current-stage refactor path, not the guaranteed final server-side runtime architecture.

That is acceptable.

The current stage needs:

- a stable workspace editing model
- a stable preview execution model
- a stable data adapter contract

Sandpack is now the official tool for that stage.

## 5. Product Contract

The product contract is now:

`the left file tree, code surface, and center preview must all stay aligned to the same workspace files, and those generated Vue files must be written against a stable dynamic data adapter contract`

Accepted behavior:

- AI or fallback generates files into the workspace
- left tree shows those exact files
- code view edits those exact files
- Sandpack preview runs those exact files
- generated Vue code can request data through the stable page-builder data interface

Rejected behavior:

- preview depending on hidden synthetic HTML not represented in the file tree
- static preview row files being treated as the final data strategy
- generated code directly depending on crawler internals

## 6. Runtime Model

The runtime model should now be split into four explicit layers.

### 6.1 Workspace Layer

The workspace layer owns:

- `workspaceId`
- file records
- active file
- project metadata
- page type / style preset / selected table

At the current stage, the workspace may still be local and in-app, but the abstraction should already be workspace-first.

### 6.2 Preview Execution Layer

The preview execution layer is now officially:

- `Sandpack`

Responsibilities:

- run the current workspace file set
- re-render when files change
- surface runtime/compile errors
- keep preview tightly coupled to the workspace files

### 6.3 Data Access Layer

The generated page must depend on a stable adapter contract, not raw crawler implementation details.

Suggested generated files:

```text
src/data/
  bindings.ts
  tableAdapter.ts
  apiClient.ts
```

The generated app should call this layer instead of inventing arbitrary crawler fetch logic.

### 6.4 Generation Layer

Generation remains split into:

- fallback generation
- later AI generation

Both must output files that follow the same workspace contract.

## 7. Dynamic Data Requirement

Dynamic data is a hard requirement.

The generated page must eventually support:

- latest crawler results being fetched at runtime
- user-triggered or scheduled crawler runs updating page content
- page rendering that is not permanently tied to static embedded rows

Static sample data may still exist temporarily for fallback, development, or preview safety, but it is not the final runtime model.

## 8. Generated App Data Contract

The generated Vue app should eventually be guided toward a stable runtime contract such as:

- `getTableRows(tableId)`
- `getTableSnapshot(tableId)`
- `getPageBuilderDataSource(config)`

This should be exposed through generated app files, not through direct crawler internals.

### 8.1 AI Contract

AI should generate Vue code against the adapter contract, not against raw crawler service details.

That means AI context should include:

- selected table id
- available fields
- sample rows
- allowed adapter methods
- binding expectations

### 8.2 Why This Matters

This keeps the product maintainable while still allowing free-form Vue generation.

## 9. File Structure Direction

The workspace should represent a real Vue mini-project shape.

Recommended structure:

```text
workspace
  /src
    App.vue
    main.ts
    /app
      PageView.vue
    /components
      /sections
    /data
      bindings.ts
      tableAdapter.ts
      apiClient.ts
    /spec
      page-spec.json
    /styles
      page.css
```

### 9.1 Stable System-Owned Files

These should remain system-owned in the first practical version:

- `src/main.ts`
- minimal runtime scaffold files needed by Sandpack

### 9.2 AI-Editable Files

AI should mainly generate and edit:

- `src/App.vue`
- `src/app/PageView.vue`
- `src/components/**/*.vue`
- `src/data/*.ts`
- `src/styles/*.css`
- `src/spec/*.json`

## 10. Current Stage

The project is now in:

`official Sandpack refactor stage`

Meaning:

- the old `srcdoc` custom compiler path is no longer relevant
- the temporary real-disk Vite preview experiment is not the official current refactor path
- the codebase should now move toward a Sandpack-backed workspace preview architecture
- AI remains disabled until fallback + Sandpack + dynamic-data contract are stable

## 11. Decisions Already Made

These decisions are now fixed unless explicitly changed.

1. AI must eventually be able to freely generate Vue files.
2. Dynamic data fetching is a hard requirement.
3. Sandpack is now the official preview execution layer for the current refactor stage.
4. The old custom preview compiler path is abandoned.
5. Static preview rows are not the final data strategy.
6. Generated pages must consume data through a stable adapter contract.
7. The product should remain workspace-centered.

## 12. Official Refactor Plan

The refactor should now happen in phases.

### Phase 1: Sandpack Preview Replacement

Goal:

- replace the remaining preview-path assumptions with a Sandpack-backed workspace preview

Tasks:

- introduce a Sandpack preview component into the center preview surface
- map existing `project.files` / workspace files into Sandpack file objects
- keep the left file tree as the source-of-truth UI
- make fallback generation output the file set Sandpack consumes
- remove dependency on the old disk-preview path from the main page-builder flow

Success criteria:

- fallback-generated Vue workspace files render through Sandpack in the center preview
- changing files in state causes preview updates

### Phase 2: Workspace Normalization

Goal:

- formalize the workspace model around `workspaceId`

Tasks:

- introduce explicit workspace metadata
- decouple preview state from one-off generation result state
- ensure left tree, code view, and preview all read the same workspace data

Success criteria:

- the product can clearly refer to a current workspace instead of just a current generated result

### Phase 3: Dynamic Data Adapter Contract

Goal:

- formalize how generated Vue pages request crawler-backed data

Tasks:

- define `tableAdapter.ts` and `apiClient.ts` contract
- define what methods generated pages are allowed to call
- ensure fallback generation uses the same contract
- ensure preview can use a safe development implementation of the contract

Success criteria:

- generated pages no longer depend on static rows as their long-term model
- AI later can be instructed to use the stable adapter contract

### Phase 4: AI Re-enable

Goal:

- allow AI to generate and edit Vue files against the Sandpack workspace and adapter contract

Tasks:

- pass the workspace file set into AI context
- constrain AI to the allowed project structure and data contract
- update workspace files from AI output
- confirm preview updates after file changes

Success criteria:

- AI can generate and revise Vue files that run in preview and use the expected data layer

## 13. Official Implementation Checklist

The current implementation checklist is:

1. Add Sandpack dependency and choose the Vue-capable setup path.
2. Introduce a Sandpack-backed preview component.
3. Convert the current fallback file model into the Sandpack file format.
4. Keep the left file tree and code area driven by the same file records.
5. Remove the main UI dependency on the current disk-preview path.
6. Define the initial generated data adapter contract.
7. Make fallback generation produce files that already use that contract.
8. Verify preview errors are visible and understandable.
9. Only after the above, re-enable AI generation.

## 14. Immediate Next Task List

The next concrete tasks should now be:

1. integrate Sandpack into the preview pane
2. make fallback-generated Vue files render through Sandpack
3. define the first stable dynamic data adapter API shape
4. stop treating static preview rows as the final runtime contract
5. keep AI disabled until those three pieces are stable

## 15. What To Avoid

The workbench should avoid:

- continuing to invest in the abandoned `srcdoc` custom compiler path
- treating the temporary disk-preview experiment as the final current-stage solution
- coupling generated Vue files directly to crawler internals
- designing the generated app around static injected row files as the final runtime path

## 16. Summary

The page-builder workbench should now be understood as:

`a workspace-centered Vue page builder where AI will eventually freely generate Vue files, Sandpack is the official current-stage preview engine, and generated pages must be designed from the start to consume crawler-backed data through a stable adapter contract`
