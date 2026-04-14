# Page Builder Context

## 1. Scope

This file is the current handoff log for the page-builder workbench.

It should capture:

- what was changed in the latest session
- what the user now expects to remain fixed
- which blockers are still unresolved
- what the next session must debug first

This file can be fully rewritten when the active context changes.

## 2. Current User Requirement

The user requirement is now explicit and should not drift:

`the page builder must eventually support AI freely generating Vue files, and those generated pages must dynamically request crawler-backed data rather than rely on permanently baked-in static rows`

This immediately implies:

- the preview path must be compatible with free-form Vue files
- the generated app must be designed around a stable data adapter contract
- static sample rows are temporary fallback/development aids, not the final data strategy

## 3. Current Architectural Decision

The official current-stage refactor direction has now been decided:

`Sandpack is the official preview execution layer for the current refactor stage`

This means:

- the old custom `srcdoc` preview compiler path is abandoned
- the temporary local disk + spawned Vite preview path is not the official main refactor direction
- the workbench should now be refactored around:
  - workspace files
  - Sandpack preview
  - future AI file edits
  - stable dynamic data adapter files

## 4. What Was Clarified In The Latest Discussion

### 4.1 Dynamic Data Is Hard Requirement

The user explicitly clarified that the actual product goal is:

- crawler runs daily or on demand
- latest data is fetched
- generated pages render that latest data dynamically

So the product cannot be designed around permanently static injected rows.

### 4.2 AI Free Vue Generation Remains Non-Negotiable

The user explicitly reconfirmed:

`free-form Vue generation is a hard goal`

That means architecture choices must preserve this future capability.

### 4.3 Sandpack Was Elevated From Candidate To Official Refactor Direction

Sandpack had previously only been discussed as a candidate preview engine.

It is now the official current-stage refactor choice because it is a better fit than:

- the old custom preview compiler
- the currently awkward disk-preview experiment

for the immediate goal of stabilizing:

- file workspace behavior
- preview behavior
- future AI file edits

## 5. Current Practical State

At the moment:

- fallback generation is still the only active generation path
- AI is still disabled
- the repo has already moved away from the old `srcdoc` custom-preview architecture
- some local runtime experimentation has already happened

But the next major implementation step is now different:

`the main page-builder preview should be refactored to Sandpack`

## 6. Current Main Blockers

### 6.1 Sandpack Refactor Has Not Been Implemented Yet

The decision has been made, but the codebase has not yet been fully migrated to Sandpack as the preview execution layer.

### 6.2 Dynamic Data Adapter Contract Is Still Not Formalized

The generated app still needs a clear contract such as:

- `src/data/tableAdapter.ts`
- `src/data/apiClient.ts`
- methods for fetching latest table data

Until this is defined, AI generation would remain unstable even if preview is improved.

### 6.3 Workspace Model Still Needs To Be Tightened

The codebase still needs to continue moving toward:

`workspaceId -> files -> preview -> data interface`

This is the product-level shape that should survive future backend/server changes.

## 7. What Has Been Decided

These decisions should now be treated as fixed.

1. AI must eventually be able to freely generate Vue files.
2. Dynamic data is a hard requirement.
3. Sandpack is the official current-stage preview solution.
4. The old custom `srcdoc` preview compiler path is abandoned.
5. Static injected rows are not the final runtime strategy.
6. The generated app should consume data through a stable adapter contract.
7. AI should remain disabled until fallback + Sandpack + data contract are stable.

## 8. Files Most Relevant For The Next Session

Open these first:

- `docs/page-builder-context.md`
- `docs/page-builder-workbench.md`
- `frontend/src/services/pageBuilder.ts`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`
- `frontend/src/views/PageBuilderView.vue`
- any new Sandpack integration files once added

## 9. Recommended Next Step

Do not re-enable AI yet.

The next implementation step should focus only on:

1. integrating Sandpack into the preview pane
2. making fallback-generated Vue files render through Sandpack
3. defining the first stable dynamic data adapter contract
4. keeping the left file tree and code area tied to the same workspace file records

## 10. Short Resume Prompt

`The page builder has moved off the old srcdoc custom-preview direction. The user has now explicitly confirmed two hard requirements: (1) AI must eventually freely generate Vue files, and (2) generated pages must dynamically request crawler-backed data rather than rely on static injected rows. Sandpack is now the official current-stage preview execution layer. The next priority is to refactor the preview pane to Sandpack and define the generated app's stable dynamic data adapter contract before re-enabling AI.`
