# Page Builder Workbench

## 1. Scope

This file is the stable design and implementation direction for the page-builder workbench.

Use this file to answer:

- what the workbench should look like
- what kind of generated project should exist on disk
- how preview should work in a way that remains compatible with AI-generated Vue files
- what technical direction should now be treated as the default path
- what the phased implementation plan is

Do not use this file as the recent task handoff log.
Use `docs/page-builder-context.md` for recent debugging context.

## 2. Core Product Direction

The first real page builder should be:

`a full-screen generated-page IDE-like workbench backed by a real runnable Vue project`

That means:

- the left side behaves like a real project explorer
- the center is the dominant work surface
- generated output is a real project, not a fake preview representation
- AI is allowed to generate and later edit real Vue project files
- preview must come from the same real project files shown in the left tree

The first real page builder should not be:

- a fake card-based generator
- a separate hidden runtime that only imitates the shown files
- a custom mini Vue compiler that tries to emulate Vite
- a system where preview and file tree can drift apart

## 3. Why The Current Preview Direction Is Being Replaced

The previous preview direction attempted:

`project.files -> backend custom preview compiler -> iframe srcdoc`

This direction is no longer the preferred architecture.

Reason:

- it is too fragile even for fallback-generated Vue files
- it becomes much more fragile once AI can freely generate arbitrary Vue SFC structure
- the system would need to keep re-implementing behavior that Vite and Vue already solve:
  - SFC compilation
  - import resolution
  - CSS handling
  - TS transpilation details
  - runtime mounting behavior
  - asset handling
  - Vite-specific expectations

Conclusion:

`if AI is expected to freely generate Vue files, preview must use the real Vue/Vite toolchain, not a custom srcdoc compiler path`

## 4. New Runtime Strategy

The workbench should now move to:

`real project files on disk -> real Vite preview server -> iframe loads real preview URL`

This is now the preferred runtime architecture.

### 4.1 Required Contract

The center preview must render from the exact same generated project files shown in the left file tree.

Accepted behavior:

- AI generates files
- those files are written to a real project directory
- those exact files appear in the left tree
- preview loads the running Vite project from those exact files

Rejected behavior:

- left tree shows one thing while preview uses hidden synthetic HTML
- preview depends on a custom simplified Vue interpreter
- fallback code is displayed as files but preview is produced by unrelated runtime content

## 5. High-Level Architecture

The new page-builder runtime should contain four layers.

### 5.1 Generation Layer

Input:

- selected data table
- page goal / prompt
- style preset
- page type
- prior generated project if editing

Output:

- a set of real project files

In the first version, AI should not own the whole toolchain boilerplate.
The system should provide a stable project scaffold and AI should mainly generate editable application files.

### 5.2 Project Materialization Layer

The generated files must be written to a real local directory.

Recommended root:

```text
generated-projects/
  <project-id>/
```

This directory should contain the actual runnable Vue page project.

### 5.3 Preview Server Layer

Each generated project should be previewed by a real Vite dev server.

That means:

- the backend manages the preview process
- the backend knows which port belongs to which project
- the backend can return the preview URL
- the backend can surface preview startup failure or runtime failure

### 5.4 Frontend Workbench Layer

The frontend should:

- show the real generated files in the left tree
- show the preview via `iframe src="<real local preview URL>"`
- keep code and preview tied to the same project id
- display preview startup and runtime errors visibly

## 6. Generated Project Model

The generated output should now be understood as a real Vue mini-project, not a synthetic file set for an iframe compiler.

### 6.1 Project Root

Recommended structure:

```text
generated-projects/
  <project-id>/
    index.html
    package.json
    vite.config.ts
    tsconfig.json
    src/
      main.ts
      App.vue
      components/
      data/
      styles/
      spec/
```

### 6.2 Stable System-Owned Files

These should be provided by the system template and remain stable unless there is a deliberate migration:

- `index.html`
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `src/main.ts`

These files should not be regenerated casually by AI in the first implementation.

### 6.3 AI-Editable Files

In the first practical version, AI should mainly generate and edit:

- `src/App.vue`
- `src/components/**/*.vue`
- `src/data/*.ts`
- `src/styles/*.css`
- `src/spec/*.json`

This still allows AI to create a whole page project while keeping the runtime scaffold stable.

## 7. Preview Contract

The new preview contract should be:

`the iframe loads a real URL served by the generated project's Vite server`

Example:

```text
http://127.0.0.1:5178/
```

The iframe should no longer depend on `srcdoc` for Vue project execution.

### 7.1 Why This Is Better

Benefits:

- real Vue compilation
- real import resolution
- real CSS behavior
- real runtime errors
- easier support for arbitrary AI-generated Vue structure
- preview behavior matches what a user would get in a normal Vue project

Tradeoff:

- more infrastructure work in backend process management
- local project directories must be managed
- Vite server lifecycle must be managed

This tradeoff is acceptable because it removes the much worse long-term cost of maintaining a custom Vue preview compiler.

## 8. File Explorer Direction

The left side must remain a real IDE-style explorer.

Required qualities:

- collapsible folders
- nested files
- active file highlight
- stable project-root mental model
- file tree is backed by the real generated project directory

Reference mental model:

- VS Code explorer
- normal code workspace explorers

Important rule:

`the left tree should reflect the real generated project files, not a derived display-only model`

## 9. Center Surface Direction

The center work area should continue to support:

- `Preview`
- `Code`
- `Data`

But the meaning of `Preview` changes:

- old meaning: srcdoc preview from a custom compiler
- new meaning: iframe pointed at a real local Vite preview URL

The center remains dominant.
The workbench is not a dashboard.

## 10. Code Surface Direction

The code area should feel like a real editor over real generated files.

Required qualities:

- active file tabs
- dark editor styling
- readable code
- real file contents from disk-backed generated project state

Preferred long-term choice:

- `Monaco Editor`

Short-term custom rendering is acceptable if it reads from the real file model.

## 11. Data Surface Direction

The data panel should continue to show the currently selected table payload.

Purpose:

- keep the generated page grounded in extracted data
- make crawler -> table -> page explicit
- help the user inspect what the generated page is expected to bind against

## 12. Setup Drawer Direction

The setup drawer remains the AI and generation entry point.

It should still preserve:

- data table selection
- page type
- style preset
- page title / goal / density

Later it should evolve into:

- multi-turn AI dialogue
- regeneration requests
- AI edits against existing project files

## 13. Preview Infrastructure Design

The backend should gain a dedicated preview-project manager.

Suggested responsibility:

- create project directories
- write generated files
- ensure template files exist
- start preview servers
- reuse running preview servers where possible
- return preview URL and status
- stop and clean up preview processes when needed

Suggested service name:

- `PageBuilderProjectManager`
- or `PageBuilderPreviewManager`

### 13.1 Suggested Backend Capabilities

Core operations:

- `ensureProject(projectId)`
- `writeProjectFiles(projectId, files)`
- `startPreview(projectId)`
- `getPreviewUrl(projectId)`
- `getPreviewStatus(projectId)`
- `stopPreview(projectId)`

### 13.2 Suggested Backend State

For each project:

- project id
- absolute directory path
- assigned port
- child process handle
- status
- last startup error
- last known preview URL

## 14. Preview Project Template

The system should provide a stable Vue + Vite template for generated projects.

Recommended template location:

```text
backend/templates/page-builder-vite/
```

Example contents:

- `index.html`
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `src/main.ts`

This template should be copied or initialized into each generated project directory.

## 15. AI Generation Boundary

The first production version should not ask AI to invent everything.

Instead:

- system owns scaffold and preview runtime contract
- AI owns page-level application files

This is the right balance because:

- it gives AI enough freedom to generate a meaningful Vue page
- it prevents repeated failures from broken scaffold files
- it keeps preview predictable

Later, broader AI control can be considered if needed.

## 16. Fallback Generation Direction

Fallback generation should still exist.

But fallback generation should now produce:

- real Vue project application files compatible with the stable template
- files that are written to the real project directory
- files that the real Vite preview server can run

That means fallback generation is no longer a special preview path.

It becomes:

`a guaranteed valid Vue page project written into the same real runtime environment as AI output`

This is important because it makes fallback a real production-safe baseline, not a separate simulation path.

## 17. Error Surface Requirements

The workbench must no longer allow black-screen-without-explanation behavior.

Required error surfaces:

- project write failure
- preview server start failure
- port conflict
- dependency/template missing
- Vite compile error
- browser runtime error inside the generated project

The user should see a visible error state in the preview area or adjacent banner.

## 18. Phased Implementation Plan

Implementation should happen in stages.

### Phase 1: Replace Custom Preview With Real Preview Infrastructure

Goal:

- remove the dependency on the custom srcdoc Vue execution path for the main page-builder preview flow

Tasks:

- create generated project root
- create stable Vite template
- implement backend preview manager
- write fallback-generated files into a real project directory
- start a real Vite preview server
- load preview via iframe URL

Success criteria:

- fallback-generated Vue project renders in iframe through real Vite
- left tree matches the real project files used by preview

### Phase 2: Keep AI Disabled, Prove Real Runtime Loop First

Goal:

- validate the end-to-end project pipeline without AI instability

Tasks:

- keep generate action on fallback-only mode
- verify file write -> Vite refresh -> iframe preview flow
- surface startup/runtime errors cleanly

Success criteria:

- clicking generate reliably produces a visible page or a visible real error

### Phase 3: Re-enable AI For App-Level Files Only

Goal:

- let AI generate Vue page files inside the stable project scaffold

Tasks:

- AI outputs editable app files
- backend writes them into the existing project directory
- Vite refreshes automatically
- iframe reflects the updated real project

Success criteria:

- AI-generated Vue files render through the same real project runtime path

### Phase 4: Add Incremental AI Editing

Goal:

- allow AI to modify existing files instead of always replacing the whole project

Tasks:

- pass previous project files into AI context
- support targeted file updates
- keep spec / memory files stable

Success criteria:

- AI can refine a project over multiple turns without replacing everything

## 19. Immediate MVP To Build Next

The immediate next MVP should be intentionally narrow.

Build this first:

1. A single generated preview project directory
2. A fixed local Vite port
3. Stable system template files
4. Fallback-generated `src/App.vue` and companion files
5. Backend start/reuse of the Vite preview server
6. Frontend iframe pointing to the real preview URL
7. Left file tree reading from the same generated project file model

Do not build multi-project process orchestration first.
Do not build arbitrary scaffold generation first.
Do not re-enable AI preview first.

## 20. What To Avoid

The workbench should avoid:

- continuing to invest heavily in the custom srcdoc Vue compiler path as the primary preview architecture
- asking AI to generate the full Vite scaffold from scratch in the first practical version
- mixing synthetic preview-only files with user-facing project files
- building a second editing model that fights with code generation

## 21. Summary

The page-builder workbench should now be understood as:

`a full-screen IDE-like generated page workspace where the left tree shows a real generated Vue project, the center preview loads that same project through a real local Vite runtime, and AI generation is constrained to real application files inside a stable system-owned scaffold`

The key strategic decision is:

`to support AI-generated Vue files reliably, the workbench must stop simulating Vue preview through srcdoc and instead run real generated projects through the actual Vue/Vite toolchain`
