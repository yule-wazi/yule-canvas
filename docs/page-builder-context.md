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

The page builder is no longer just in preview stabilization mode.

It has now entered the first practical AI generation stage described in `docs/page-builder-workbench.md`.

That current stage is:

`Phase A: direct multi-file workspace generation`

Meaning:

- the user provides a page goal
- the user chooses a data table
- AI directly generates a multi-file Vue workspace response
- the system parses that output into workspace files
- the left file tree, code panel, and Sandpack preview all use those exact generated files

The system is **not** yet doing:

- AI reading the existing workspace first
- AI selectively editing existing files
- AI fixing preview/runtime errors autonomously
- true agentic tool use inside the product

## 3. What Was Completed In The Latest Session

### 3.1 Page Builder AI Route Was Added

A new backend route now exists for page-builder generation:

- `POST /api/ai/generate-page-workspace`

This route now accepts:

- selected table metadata
- sample rows only
- page-builder request context
- provider/model/apiKey options

And returns:

- `summary`
- `files[]`

Important file:

- `backend/src/routes/api.ts`

### 3.2 Dedicated Page Builder AI Service Was Added

The backend now has a dedicated page-builder AI service that:

- builds the page-builder generation prompt
- asks the provider for structured JSON output
- parses `summary + files[]`
- allow-lists generated file paths
- ensures required core files exist

Important file:

- `backend/src/services/PageBuilderAI.ts`

### 3.3 AI Output Now Enters The Real Workspace

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

### 3.4 AI Controls Were Added To The Page Builder UI

The page builder now includes:

- `Local Draft` button
- `Generate with AI` button
- AI summary display in the top bar

This lets the user compare local fallback generation and AI generation.

Important files:

- `frontend/src/components/pageBuilder/PageBuilderTopBar.vue`
- `frontend/src/views/PageBuilderView.vue`

### 3.5 AI Provider Configuration Was Added As A Modal

AI configuration is no longer assumed to come only from backend `.env`.

The page builder now has an `AI Config` modal in the setup drawer header.

Current configurable fields:

- provider
- apiKey
- model

These values are saved locally in browser storage and survive refresh.

Important files:

- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/stores/pageBuilder.ts`

### 3.6 Code Editor Integration From Earlier Work Remains Active

The code panel is already using CodeMirror rather than a plain textarea.

This is important because AI-generated files are now intended to be inspected directly in the code panel.

Relevant files:

- `frontend/src/components/pageBuilder/CodeEditor.vue`
- `frontend/src/components/pageBuilder/PageBuilderCodeTabs.vue`

## 4. Important Corrections Made During This Session

### 4.1 AI Request No Longer Sends Full Table Rows

This was an important correction.

The initial page-builder AI request incorrectly passed the full `rows` array to the model.

This was explicitly rejected because:

- some tables are very large
- this does not scale
- this is not the long-term product direction

The request now passes:

- `columns`
- `rowCount`
- `sampleRows`

And `sampleRows` is currently capped to a small sample on the frontend.

Current practical behavior:

- send first 5 rows only

Relevant files:

- `frontend/src/services/pageBuilder.ts`
- `backend/src/services/PageBuilderAI.ts`

### 4.2 Frontend Timeout Was Too Short And Was Fixed

Another important correction:

The frontend API client default timeout was 30 seconds, while the backend/provider path for AI generation allowed much longer execution.

This caused a misleading failure mode:

- backend/provider might still be working
- but the frontend timed out first
- making it look like the backend did not respond correctly

The page-builder AI request now overrides timeout to a much longer value for this specific route.

Relevant file:

- `frontend/src/services/pageBuilder.ts`

### 4.3 OpenRouter Request Context Was Improved

For OpenRouter usage, the frontend now sends additional request metadata:

- `httpReferer`
- `appTitle`

This makes the OpenRouter request path more correct and easier to diagnose.

Relevant file:

- `frontend/src/services/pageBuilder.ts`

### 4.4 Provider Errors Are Now More Visible

Provider errors were initially too opaque.

The backend now tries to forward more useful provider information, including upstream provider metadata when available.

This helped reveal real issues such as:

- provider rate limiting
- upstream model restrictions

Relevant file:

- `backend/src/services/AIAdapter.ts`

## 5. Current Practical Working State

At the moment, the following is true:

- Sandpack preview is working for generated Vue workspace files
- the page builder can still create a local fallback draft
- the page builder can now also generate via AI
- AI-generated files appear in the file tree and code editor
- AI provider configuration can be edited in-product
- AI configuration persists across refresh through local storage
- the request no longer sends full table rows

In short:

`Phase A direct AI workspace generation is now working in practice`

## 6. Known Issues Already Encountered

The following issues were hit and are now known:

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

This is normal for the current stage and is part of what the product is now testing.

## 7. What Is Fixed For Now

These points should now be treated as fixed unless explicitly changed.

1. The page builder has entered Phase A direct AI workspace generation.
2. AI direct generation is now enabled in practice.
3. The page builder remains workspace-centered.
4. Sandpack remains the active preview runtime.
5. The current practical preview path still prefers Sandpack `vue`.
6. AI config should be editable from inside the page builder, not only through backend env.
7. AI config should persist locally across refresh.
8. Full table rows should not be sent to the model.
9. Current AI context should use schema + rowCount + small sampleRows.
10. The current stage is still about direct generation, not workspace editing or autonomous repair.

## 8. Files Most Relevant For The Next Session

Open these first:

- `docs/page-builder-workbench.md`
- `docs/page-builder-context.md`
- `frontend/src/services/pageBuilder.ts`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/components/pageBuilder/PageBuilderTopBar.vue`
- `frontend/src/views/PageBuilderView.vue`
- `backend/src/services/PageBuilderAI.ts`
- `backend/src/services/AIAdapter.ts`
- `backend/src/routes/api.ts`

## 9. Main Remaining Gaps

The following are still unresolved:

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

`make direct AI workspace generation reliable enough to learn from real outputs`

## 11. Short Resume Prompt

`The page builder is now in Phase A direct AI workspace generation. The product can already ask AI to generate a structured multi-file Vue workspace, parse those files into the visible file tree, inspect them in the CodeMirror editor, and run them in Sandpack preview. AI configuration is now handled inside the page builder through a modal and persists in local storage. The system no longer sends full table rows to the model; it sends schema, rowCount, and a very small sampleRows set. A major recent bug was that the frontend timed out before the backend/provider request finished; that page-builder AI request now uses a much longer timeout. The next priority is not tool use yet, but improving the reliability and quality of direct AI-generated workspace files.`  
