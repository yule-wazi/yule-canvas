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

The page builder is still in:

`Phase A: direct multi-file workspace generation`

But the practical interaction model is now:

`setup -> streaming file progress -> final workspace commit -> Sandpack preview`

Meaning:

- the user first sees the setup drawer
- the first send moves the drawer into conversation mode
- AI generation streams real file-complete events
- the real workspace is committed only after the stream finishes
- the preview reads runtime data from a host-injected hidden bridge file instead of hardcoded sample rows

The system is still **not** doing:

- AI reading the existing workspace first
- AI selectively editing existing files
- AI fixing preview/runtime errors autonomously
- true agentic tool use inside the product
- partial live writes into Sandpack while code is still incomplete

## 3. What Was Completed In The Latest Session

### 3.1 Runtime Table Data Is Now Bridged From Frontend State Into Sandpack

This is the biggest product correction from the latest session.

Current behavior:

- the selected table snapshot is computed in the host frontend
- the preview injects a hidden runtime file:
  - `src/data/__runtimeTableData.js`
- `src/data/tableData.js` is system-controlled and reads runtime data from that hidden file
- generated Vue components are expected to import from `src/data/tableData.js`
- preview data now reflects current frontend table state rather than stale hardcoded sample rows

Why this changed:

- backend temporary caching added synchronization problems
- the true source of truth is still frontend table state
- host injection is simpler and more reliable for the current product stage

Important files:

- `frontend/src/views/PageBuilderView.vue`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
- `backend/src/services/PageBuilderAI.ts`

### 3.2 The Hidden Runtime Data File Must Not Be AI-Generated

This is now a fixed rule.

Current behavior:

- the host runtime injects `src/data/__runtimeTableData.js`
- AI must not create or modify that file
- backend path validation rejects that file if the model emits it anyway
- frontend also treats it as internal-only and does not expose it as a normal project file

Important files:

- `backend/src/services/PageBuilderAI.ts`
- `frontend/src/services/pageBuilder.ts`

### 3.3 Preview Refresh Is Now Explicitly Controllable

Sandpack refresh is no longer left entirely to incidental file updates.

Current behavior:

- switching workspace now forces a Sandpack remount
- the first successful AI generation for a new workspace forces a Sandpack remount
- there is now a manual refresh button beside the `Preview / Code / Data` mode group
- clicking refresh forces the preview iframe to rebuild

Why:

- Sandpack sometimes failed to start rendering immediately on first workspace creation
- a hard remount is more reliable than hoping internal recompilation logic notices the right state transition

Important files:

- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`

### 3.4 The Refresh Button Now Has Interaction Feedback

The manual refresh control is not purely functional anymore.

Current behavior:

- hover gives the icon a light rotation cue
- click triggers a visible refresh animation state
- the button also triggers the actual preview remount

Important file:

- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`

## 4. Important Product Decisions Now Fixed

These points should now be treated as fixed unless explicitly changed.

1. The page builder remains in Phase A direct workspace generation.
2. The page builder remains workspace-centered.
3. Sandpack remains the official preview runtime.
4. Streaming progress should be shown at the file-complete level, not token-by-token.
5. The real workspace and Sandpack should update only after the full streamed generation finishes.
6. Runtime preview data should currently come from host frontend state through a hidden bridge file.
7. `src/data/tableData.js` is a system-controlled data adapter.
8. `src/data/__runtimeTableData.js` is a host-injected internal file and must not be AI-authored.
9. Sample rows are still sent to the model for shape understanding, but they are not the real runtime dataset.
10. Preview refresh must be explicitly forceable when Sandpack lifecycle behavior is unreliable.

## 5. Current Practical Working State

At the moment, the following is true:

- the setup drawer switches to conversation mode on first send
- page-builder generation has a real streaming route
- frontend receives file completion updates during generation
- the workspace is committed only after the stream completes
- generated files appear in the file tree and code panel after final commit
- workspaces and AI config still persist locally
- the request still sends schema + rowCount + a small `sampleRows` set
- generated pages are now supposed to read runtime data through `src/data/tableData.js`
- the preview injects current table data into a hidden runtime bridge file
- switching workspace can force a full preview remount
- first-time generation for a new workspace can force a full preview remount
- the user has a manual refresh button to force preview rebuild

In short:

`Phase A direct AI workspace generation now includes file-level streaming progress, a host-injected runtime table-data bridge, and explicit Sandpack remount controls for reliability`

## 6. Known Issues Already Encountered

### 6.1 Stream Parsing Still Depends On The Model Following The File Block Contract

Likely failure categories:

- model emits explanatory text outside the expected file blocks
- file tags are malformed
- summary block is missing
- generated file order is unstable

### 6.2 AI Output Quality Is Still A Core Risk

This still includes:

- invalid Vue code
- broken imports
- overly fragile structure choices
- Sandpack-incompatible output

### 6.3 The Conversation Surface Is Still Functionally Ahead Of Its Visual Design

The streaming/file-operation behavior is now more correct than polished.

Remaining UI work likely includes:

- a stronger collapsible operation component
- better grouping visuals
- a better bottom conversation input area

## 7. Files Most Relevant For The Next Session

Open these first:

- `docs/page-builder-workbench.md`
- `docs/page-builder-context.md`
- `frontend/src/views/PageBuilderView.vue`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/services/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`
- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `backend/src/services/PageBuilderAI.ts`
- `backend/src/routes/api.ts`

## 8. Main Remaining Gaps

### 8.1 The Streaming File-Operation UI Still Needs Better Productization

The mechanics now work, but the grouped operation UI can still be improved.

### 8.2 The File-Stream Contract Still Needs More Real-World Validation

The next practical questions are:

- how often the model follows the block protocol cleanly
- which providers behave best under the contract
- what extra guardrails are needed for malformed output

### 8.3 Workspace Editing Still Has Not Started

Even though the drawer is conversational, the product is still in direct generation mode.

This means:

- follow-up prompts still drive another generation pass
- there is still no selective in-place file editing stage
- there is still no autonomous repair stage

## 9. Recommended Next Step

The next session should continue from here:

1. test more prompts against the streaming file protocol
2. tighten output guardrails if malformed stream segments appear
3. improve the reusable file-operation UI
4. verify whether preview refresh logic is sufficient under repeated workspace switching
5. only after direct generation is stable, consider selective workspace editing

Do **not** jump straight to agentic file editing yet.

The correct near-term focus is still:

`make direct AI workspace generation reliable, keep runtime data current through the host bridge, and keep Sandpack preview behavior predictable through explicit remount controls`

## 10. Short Resume Prompt

`The page builder is still in Phase A direct AI workspace generation, but its interaction model now includes real file-level streaming progress and a more reliable preview runtime. The drawer switches from setup to conversation on first send, generation uses a file-block streaming protocol, and the real workspace is committed only after the full stream completes. Runtime table data is no longer fetched from a temporary backend cache; instead, the host frontend injects current table data into a hidden internal file at src/data/__runtimeTableData.js, and src/data/tableData.js is a system-controlled adapter that generated components must use. Sandpack remounts can now be forced when switching workspaces, after the first successful generation for a new workspace, and through a manual refresh button.`
