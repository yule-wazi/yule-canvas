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

But the interaction model has now advanced from a single opaque request into:

`setup -> real streaming file progress -> final workspace commit`

Meaning:

- the user first sees the setup drawer
- the user clicks send once to start generation
- the drawer immediately switches into conversation mode
- AI generation is now streamed in real time at the file level
- the conversation only shows files after each file is fully generated
- the real workspace and Sandpack preview are updated only after the whole generation finishes

The system is still **not** doing:

- AI reading the existing workspace first
- AI selectively editing existing files
- AI fixing preview/runtime errors autonomously
- true agentic tool use inside the product
- partial live writes into Sandpack while code is still incomplete

## 3. What Was Completed In The Latest Session

### 3.1 The Drawer Now Has A True Setup-To-Conversation Flow

This is now an important product behavior change.

Current behavior:

- the setup UI is shown only before the first send
- when the user clicks the send button, the drawer immediately switches to conversation mode
- after that point, the same drawer is used as the main AI conversation surface
- follow-up prompts are sent from the conversation input area instead of returning to the setup form

Important files:

- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/views/PageBuilderView.vue`
- `frontend/src/stores/pageBuilder.ts`

### 3.2 Page Builder Streaming Route Is Now In Place

The backend now has a dedicated streaming generation route:

- `POST /api/ai/generate-page-workspace-stream`

Current behavior:

- backend requests the model with real streaming enabled
- backend parses streamed model output using file block delimiters
- backend emits `file_done` events only after one full file block is complete
- backend emits a final `done` event only after all files are complete

Important files:

- `backend/src/routes/api.ts`
- `backend/src/services/PageBuilderAI.ts`
- `backend/src/services/AIAdapter.ts`

### 3.3 The AI Output Contract Was Changed From One JSON Blob To A Streamable File Protocol

This is a major implementation decision made in this session.

Previous practical contract:

- AI returns one final JSON object containing `summary` and `files[]`

Current practical contract for streaming:

- AI outputs file blocks such as:
  - `<file path="..." role="..."> ... </file>`
- AI outputs one final summary block:
  - `<summary>...</summary>`

Why this was changed:

- final JSON is awkward for real file-level progress reporting
- file blocks let the backend know exactly when a file is complete
- this makes it possible to show real progress without pushing partial code into Sandpack

Important files:

- `backend/src/services/PageBuilderAI.ts`

### 3.4 The Frontend Now Consumes File-Level Streaming Progress

Current behavior:

- frontend opens a streaming request instead of waiting for one final JSON response
- frontend appends a conversation item only when one file has fully completed
- the UI does not render token chunks or half-finished code
- the file progress UI should not be treated as ordinary chat bubbles
- file progress should be rendered inside a collapsible drawer-style operation component
- this operation UI should be reusable for similar AI file actions, not hardcoded only for first-generation flow

Important files:

- `frontend/src/services/pageBuilder.ts`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`

### 3.5 File Operation Naming Was Standardized

This was explicitly decided during the session.

Unified file operation labels should now use:

- `新增内容`
- `读取内容`
- `更新内容`

Do **not** prefer wording like:

- `AI generated`
- `AI updated`
- `已生成`

The product should describe the file operation itself rather than foregrounding the AI actor in every row.

This means the preferred UX direction is closer to:

- `新增内容 src/App.vue`
- `更新内容 src/styles.css`
- `读取内容 src/data/tableData.js`

Not:

- `AI 已生成 src/App.vue`

### 3.6 The File Progress UI Should Become A Reusable Collapsible Operation Component

Another explicit product decision made in this session:

- do not treat each completed file as its own standalone assistant message card
- group similar file operations into one collapsible drawer-like component
- this component should be abstract enough to support multiple AI file workflows later

The intended design direction is:

- one grouped operation surface
- collapsed / expanded behavior
- a count header such as `瀹稿弶澧界悰?3 娑擃亙鎹㈤崝顡?- rows that list normalized file operations with file paths

This should be implemented as a dedicated reusable component for AI file operations, rather than embedding the whole rendering logic directly in the page-builder drawer.

### 3.5 Sandpack Update Timing Is Deliberately Deferred Until The End

This is now a fixed near-term product decision.

Current behavior:

- generated files are **not** written into the real page-builder workspace while the model is still streaming
- generated files are buffered during streaming
- only when the stream reaches final completion does the system normalize files into the real workspace
- only then do the file tree, code panel, and Sandpack preview update

Why:

- partial Vue files can break preview immediately
- imports and dependent files may not exist yet mid-stream
- the user still gets live progress, but the runtime remains stable

Important files:

- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/services/pageBuilder.ts`

## 4. Important Corrections Made During This Session

### 4.1 Streaming Is Real At The Model Level, Not Fake Replay

This was clarified explicitly during the session.

The intended behavior is **not**:

- wait for the full AI result
- split files afterward
- pretend to stream file completion

The current intended behavior is:

- request the provider with streaming enabled
- parse the stream while it is arriving
- emit a file completion event only when one file block truly finishes

### 4.2 Frontend Streaming Feedback Must Stay Minimal

The user explicitly asked to avoid noisy progress UI.

Current practical behavior:

- do not show token-by-token text
- do not show partial code chunks
- do not show half-generated file contents
- only show completed files as they become available
- prefer grouped operation rows over repeated assistant message cards

### 4.3 Setup Is First-Run Only

The setup form is no longer treated as a recurring screen during the same generation flow.

Current behavior:

- setup is the pre-send view
- conversation is the post-send view
- the product direction is moving toward continued work from the conversation surface rather than bouncing back into setup every turn

### 4.4 Avoid Referring To The Progress UI As "Reference To Figure 2 / Figure 3"

The intended implementation should be described in product terms, not as:

- "make it like figure 2"
- "refer to figure 3"

The correct wording for continuation is:

- implement the streamed file feedback inside a collapsible drawer-style operation component
- use normalized file operation naming
- keep it inside the post-send conversation surface

## 5. Current Practical Working State

At the moment, the following is true:

- Sandpack preview still works for finalized generated Vue workspace files
- AI-generated files still appear in the file tree and code editor after final commit
- local workspace switching and persistence are still working
- AI provider configuration still persists locally
- the request still sends schema + rowCount + a small sampleRows set
- the request still does not inject default `pageType`, `stylePreset`, or `density`
- the drawer now switches to conversation mode immediately when the user sends the first prompt
- page-builder generation now has a real streaming route
- the frontend now receives file completion updates during generation
- the streamed file feedback direction is now a grouped collapsible operation component rather than repeated assistant message bubbles
- Sandpack still waits for final completion before updating

In short:

`Phase A direct AI workspace generation is now paired with real file-level streaming progress in the conversation drawer, while runtime updates remain final-commit only`

## 6. Known Issues Already Encountered

### 6.1 Stream Parsing Depends On The Model Following The File Block Contract

The new streaming approach is only reliable when the model obeys the file block format.

Likely failure categories:

- model emits explanatory text outside the expected file blocks
- file tags are malformed
- summary block is missing
- generated file order is strange or unstable

This means prompt/output discipline is now even more important than before.

### 6.2 Provider Streaming Support Is Not Uniform

The current streaming path is aimed at OpenAI-compatible provider behavior.

Current practical state:

- the page-builder streaming path is designed for OpenRouter / SiliconFlow style streaming responses
- Qwen was not fully adapted for this file-stream protocol path in this session

This should be treated as a current limitation, not a completed cross-provider solution.

### 6.3 AI Output Quality Is Still A Core Risk

Even with improved progress visibility, the underlying generation quality is still not stabilized.

This still includes:

- invalid Vue code
- broken imports
- fragile structure choices
- Sandpack-incompatible output

Streaming progress improves UX, but it does not by itself solve code quality.

## 7. What Is Fixed For Now

These points should now be treated as fixed unless explicitly changed.

1. The page builder remains in Phase A direct AI workspace generation.
2. The page builder remains workspace-centered.
3. Sandpack remains the official preview runtime.
4. AI config remains editable in-product and persists locally.
5. Full table rows should not be sent to the model.
6. Current AI context should use schema + rowCount + small sampleRows.
7. Page-builder workspaces should persist locally across refresh.
8. The setup drawer should switch to conversation mode immediately on first send.
9. Streaming progress should be shown at the file-complete level, not token-by-token.
10. Sandpack and the real workspace should update only after the whole streamed generation completes.
11. File operation naming should use `閺傛澘顤冮崘鍛啇 / 鐠囪褰囬崘鍛啇 / 閺囧瓨鏌婇崘鍛啇`.
12. Streamed file feedback should be grouped into a reusable collapsible operation component.
13. Default `pageType`, `stylePreset`, and `density` should not be silently injected into the AI request.

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

### 9.1 The Conversation UI Is Still Functionally Correct But Visually Minimal

The current chat UI now reflects file completion progress, but it is still visually simple.

Likely next improvements:

- replace repeated assistant file bubbles with one reusable collapsible operation component
- use the new normalized operation labels: `閺傛澘顤冮崘鍛啇 / 鐠囪褰囬崘鍛啇 / 閺囧瓨鏌婇崘鍛啇`
- improve the bottom input area so it feels more like a dedicated AI chat control

### 9.2 The New File Streaming Contract Needs More Real-World Validation

The streaming file protocol has been implemented, but it still needs exercise across real prompts and models.

The next practical questions are:

- how often does the model follow the block protocol cleanly
- which providers behave best under this contract
- whether additional guardrails are needed for malformed stream segments

### 9.3 Workspace Editing Still Has Not Started

Even though the drawer is now conversational, the product is still in direct generation mode.

This means:

- follow-up prompts still drive another generation pass
- there is still no selective in-place file editing stage
- there is still no autonomous repair stage

## 10. Recommended Next Step

The next session should continue from here:

1. test the streaming route across multiple real prompts and providers
2. observe whether the model reliably emits valid file block boundaries
3. tighten the output contract if malformed stream segments appear
4. build the reusable collapsible AI file-operation component and wire streamed file completion rows into it
5. only after the file streaming contract is reliable, consider moving toward selective workspace editing

Do **not** jump straight to agentic file editing yet.

The current correct focus is still:

`make direct AI workspace generation reliable, stream progress to the user at the file-complete level, and keep Sandpack updates deferred until the final generation commit`

## 11. Short Resume Prompt

`The page builder is still in Phase A direct AI workspace generation, but its interaction model has changed. The user first sees a setup drawer, then the drawer switches immediately into conversation mode on first send. Generation is now streamed in real time at the file level using a file block output contract rather than one final JSON blob. The frontend should present streamed file completion through a reusable collapsible operation component inside the drawer, not repeated assistant message bubbles. File operation naming is now standardized as 閺傛澘顤冮崘鍛啇 / 鐠囪褰囬崘鍛啇 / 閺囧瓨鏌婇崘鍛啇. The real workspace and Sandpack preview are still updated only after the full generation finishes. Workspaces and AI config still persist locally, schema + rowCount + small sampleRows remain the core model context, and default pageType/stylePreset/density are still intentionally not injected.`  
