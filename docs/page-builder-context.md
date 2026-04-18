# Page Builder Context

## 1. Scope

This file is the current handoff log for the page-builder workbench.

It should capture:

- what was changed in the latest session
- what is now working in practice
- which recent product decisions are now fixed
- which blockers are still unresolved
- what the next session should continue from first

This file can be fully rewritten when the active context changes.

## 2. Current Product Reality

The page builder is in:

`Phase A: direct multi-file workspace generation`

Meaning:

- the user provides a goal in natural language
- the user chooses a data table
- AI directly generates a multi-file Vue workspace response
- the system parses that output into workspace files
- the left file tree, code panel, and Sandpack preview all use those exact generated files

The system is still **not** doing:

- AI reading the existing workspace first
- AI selectively editing existing files
- AI fixing preview/runtime errors autonomously
- true agentic tool use inside the product

## 3. What Was Completed In The Latest Sessions

### 3.1 Page Builder AI Route And Service Are In Place

The backend page-builder generation route is active:

- `POST /api/ai/generate-page-workspace`

It accepts:

- selected table metadata
- `rowCount`
- small `sampleRows`
- page-builder request context
- provider/model/apiKey options

And returns:

- `summary`
- `files[]`

Important files:

- `backend/src/routes/api.ts`
- `backend/src/services/PageBuilderAI.ts`
- `backend/src/services/AIAdapter.ts`

### 3.2 AI Output Enters The Real Workspace

The frontend page-builder flow now:

- sends the request to the backend AI route
- receives structured generated files
- normalizes those files into workspace file records
- renders them in the left file tree
- opens them in the code editor
- runs them in Sandpack preview

Important files:

- `frontend/src/services/pageBuilder.ts`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/views/PageBuilderView.vue`

### 3.3 Local Page Builder Workspaces Now Exist

The page builder now has a real local workspace concept.

Current behavior:

- workspaces are saved locally in browser storage
- refresh no longer clears the current generated workspace
- the user can create, switch, rename, and delete local workspaces
- the current workspace is restored on reload
- file edits inside the code area are persisted to the current local workspace

Important files:

- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderTopBar.vue`
- `frontend/src/components/pageBuilder/PageBuilderWorkspaceManager.vue`

### 3.4 The UI Was Reshaped Around Workspace-First Usage

Recent UI changes:

- top-left now centers on workspace switching rather than one-shot generation controls
- the workspace manager now follows the workflow-manager interaction pattern
- hover actions exist for rename and delete in the workspace manager
- the center workspace toolbar now owns the `Preview / Code / Data` switch
- the old `Sandpack preview` text label was removed
- top-right no longer includes the AI submit arrow button

Important files:

- `frontend/src/components/pageBuilder/PageBuilderTopBar.vue`
- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
- `frontend/src/components/pageBuilder/PageBuilderWorkspaceManager.vue`

### 3.5 AI Triggering Is Now AI-Only

The old local fallback generation path has been removed from the page-builder UI flow.

Current behavior:

- the setup drawer keeps the AI submit arrow button
- the top bar no longer exposes fallback or AI submit buttons
- the page builder is now treated as AI-first for generation

Relevant files:

- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/components/pageBuilder/PageBuilderTopBar.vue`
- `frontend/src/views/PageBuilderView.vue`
- `frontend/src/stores/pageBuilder.ts`

## 4. Important Corrections Made During This Session

### 4.1 AI Request No Longer Sends Full Table Rows

The request still sends:

- `columns`
- `rowCount`
- `sampleRows`

Current practical behavior:

- send first 5 rows only

Relevant files:

- `frontend/src/services/pageBuilder.ts`
- `backend/src/services/PageBuilderAI.ts`

### 4.2 AI Request No Longer Injects Default Type/Style/Density Hints

This is now an important fixed product decision.

The page-builder AI request no longer sends default:

- `pageType`
- `stylePreset`
- `density`

These were removed so that:

- page type should be inferred from the user's `goal`
- style direction should be inferred from the user's `goal`
- the system no longer silently biases output toward `news-list` or `nvidia-tech`

This means the AI request context is now more minimal and user-driven.

Relevant files:

- `frontend/src/types/pageBuilder.ts`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/services/pageBuilder.ts`
- `backend/src/services/PageBuilderAI.ts`

### 4.3 AI Provider Configuration Still Persists Locally

AI provider configuration remains editable in-product and persists in local browser storage:

- provider
- apiKey
- model

Relevant files:

- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/stores/pageBuilder.ts`

## 5. Current Practical Working State

At the moment, the following is true:

- Sandpack preview is working for generated Vue workspace files
- AI-generated files appear in the file tree and code editor
- the current workspace persists across refresh
- local workspace switching is working in product
- AI provider configuration can be edited in-product
- AI configuration persists across refresh
- the request no longer sends full table rows
- the request no longer sends default `pageType`, `stylePreset`, or `density`
- generation is now AI-only in the page builder flow

In short:

`Phase A direct AI workspace generation is working, and the workbench is now workspace-persistent rather than refresh-ephemeral`

## 6. Known Issues Already Encountered

### 6.1 OpenRouter Free Models Can Fail Due To Upstream Limits

One observed real error was:

- `Provider returned error | provider=Venice | ... temporarily rate-limited upstream`

This means:

- request wiring was functioning
- the failure was upstream provider/model availability
- this is not the same as product-side request wiring failure

### 6.2 AI Can Still Return Invalid Or Fragile Code

This remains a core expected failure mode of the current stage.

Likely failure categories:

- invalid JSON output
- valid JSON but invalid Vue code
- valid Vue files but broken imports
- structurally valid code that still fails in Sandpack

This is still normal for the current stage and remains one of the main areas to improve.

### 6.3 The Prompt Contract Is Now Leaner, So Goal Quality Matters More

Because the system no longer injects default `pageType` or `stylePreset`, weak user goals are now more likely to produce:

- ambiguous layout choices
- inconsistent styling
- under-specified page structure

This is a deliberate tradeoff, but it means prompt quality matters more than before.

## 7. What Is Fixed For Now

These points should now be treated as fixed unless explicitly changed.

1. The page builder remains in Phase A direct AI workspace generation.
2. The page builder remains workspace-centered.
3. Sandpack remains the active preview runtime.
4. AI config is editable from inside the page builder and persists locally.
5. Full table rows should not be sent to the model.
6. Current AI context should use schema + rowCount + small sampleRows.
7. Page-builder workspaces should persist locally across refresh.
8. The user should be able to create, switch, rename, and delete local page-builder workspaces.
9. The page-builder UI should be AI-first rather than fallback-first.
10. Default `pageType`, `stylePreset`, and `density` should not be silently injected into the AI request.

## 8. Files Most Relevant For The Next Session

Open these first:

- `docs/page-builder-workbench.md`
- `docs/page-builder-context.md`
- `frontend/src/services/pageBuilder.ts`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/components/pageBuilder/PageBuilderTopBar.vue`
- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`
- `frontend/src/components/pageBuilder/PageBuilderWorkspaceManager.vue`
- `frontend/src/views/PageBuilderView.vue`
- `backend/src/services/PageBuilderAI.ts`
- `backend/src/services/AIAdapter.ts`
- `backend/src/routes/api.ts`

## 9. Main Remaining Gaps

### 9.1 AI Direct Generation Quality Is Not Yet Stabilized

The system can now generate through AI, but generated code quality is not yet stabilized.

This includes:

- file structure quality
- component structure quality
- import correctness
- Sandpack compatibility quality
- output JSON consistency

### 9.2 There Is Still No AI Workspace Editing Stage

The current implementation is direct generation only.

The next larger product milestone after stabilizing output quality is still:

`AI reads current workspace and selectively updates or adds files`

That work has not started yet.

### 9.3 The Long-Term Dynamic Data Contract Is Still Not Final

Even though the AI request now uses sample rows and generated projects get a small data adapter file, the final runtime data contract is still not formally complete.

The long-term goal still requires:

- stable generated data access boundary
- later non-sample runtime data behavior
- eventual crawler-backed live data path

## 10. Recommended Next Step

The next session should continue from here:

1. exercise more AI generations across different prompts and providers
2. inspect what kinds of invalid files the model most often returns
3. tighten prompt/output constraints based on real failures
4. decide whether certain foundation files should remain system-owned rather than AI-authored
5. only after direct generation quality becomes predictable, move toward workspace editing

Do **not** jump straight to agentic file editing yet.

The current correct focus is still:

`make direct AI workspace generation reliable enough to learn from real outputs, while keeping the workspace model persistent and user-driven`

## 11. Short Resume Prompt

`The page builder is in Phase A direct AI workspace generation. It can ask AI to generate a structured multi-file Vue workspace, parse those files into the visible file tree, inspect them in the editor, and run them in Sandpack preview. The page builder now has persistent local workspaces, so refresh no longer clears the current generated project, and the user can create, switch, rename, and delete workspaces locally. AI provider configuration is handled in-product and persists in local storage. The AI request sends schema, rowCount, and a very small sampleRows set, but no longer injects default pageType, stylePreset, or density; those choices are now expected to come from the user's goal. The next priority is still improving the reliability and quality of direct AI-generated workspace files rather than moving to tool-using workspace editing.`  
