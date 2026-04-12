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

The user’s core requirement is now explicit and should not drift:

`the center preview must render strictly from the exact same project files shown in the left file tree`

Accepted behavior:

- AI generates files -> those files appear in the left tree -> preview renders those exact files
- AI fails -> system generates fallback files -> those fallback files appear in the left tree -> preview renders those exact fallback files
- if compile/runtime fails, the preview area itself must visibly show the error

Rejected behavior:

- left side shows files but center preview stays black or blank
- preview depends on a separate hidden HTML representation not tied to the left-side file tree
- failures only appear in console while the preview remains visually blank

## 3. What Was Changed In This Session

### 3.1 AI Panel UI

The right-side AI drawer was reshaped into a more chat-first layout:

- top area now emphasizes conversation context
- data table selector was reduced to a compact control in the top-right area
- bottom composer keeps a large input area
- lower manual controls were removed per user request
- top-right action was changed toward `AI 配置`

New related file:

- `frontend/src/components/pageBuilder/PageBuilderAIConfigModal.vue`

Main updated file:

- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`

### 3.2 AI Config State

AI configuration state was added into the page builder store:

- `aiProvider`
- `aiModel`
- `aiApiKey`
- `isAIConfigOpen`

AI config is now persisted locally via `localStorage`.

Important correction already attempted:

- frontend previously sent the concrete model string as the backend provider id
- this was corrected so:
  - request `model` = provider id like `openrouter`
  - request `options.model` = concrete model string like `openai/gpt-4.1-mini`

### 3.3 Preview Rendering Direction

The preview path was pushed toward:

`project.files -> /api/page-builder/render-preview -> iframe srcdoc`

Meaning:

- preview is intended to be derived from `project.files`
- both AI-generated files and fallback files are supposed to use the same preview compilation path

### 3.4 Preview Error Surfacing Work

Multiple attempts were made to stop silent black screens:

- iframe runtime error `postMessage` path added
- preview error banner path added in frontend
- backend preview renderer error document path added
- global `error` and `unhandledrejection` listeners added inside preview HTML
- empty-mount watchdog added to detect no visible content
- `/render-preview` changed to return HTML error content instead of plain HTTP 400

## 4. Critical Unresolved Problems

These are the two main blockers.
They have already been repaired multiple times in this session and are still not solved.
The next session should treat them as the first priority.

### 4.1 AI Generation Still Fails Through Provider Path

Latest observed result:

- `/api/page-builder/generate` returns:
  - `success: false`
  - `project: null`
  - `error: "Provider returned error"`

Implication:

- real AI generation is still not stable
- the system keeps falling back instead of producing usable AI output

What has already been tried:

- AI config modal added
- AI config persistence added
- provider/model request mapping corrected once
- frontend error propagation improved so backend `error` can surface

Status:

- still unresolved

### 4.2 Fallback File Project Still Does Not Reliably Render Visible Preview

Latest observed result:

- left tree shows fallback files such as:
  - `app/PageView.vue`
  - `components/sections/*.vue`
  - `data/*.ts`
  - `spec/page-spec.json`
  - `styles/page.css`
- `/render-preview` may return `200`
- center preview can still remain fully black / blank
- user reports the fallback code still does not visibly render into the preview area

Implication:

- the “strictly render from left-side files” contract is still not trustworthy

What has already been tried:

- preview compilation path rewritten around `project.files`
- runtime error callbacks added
- backend error-html fallback added
- watchdog for empty render added

Status:

- still unresolved
- this has been fixed multiple times in this session but user testing still shows failure

## 5. Current Practical State

At the moment:

- the UI direction of the AI drawer is closer to user intent
- AI config persistence exists
- the preview architecture has been moved toward `project.files` as the source

But the product is still not in an acceptable state because:

1. real AI generation is failing with provider-side error
2. fallback project files still do not guarantee visible preview rendering

## 6. Files Most Relevant For Next Debug Session

Open these first:

- `docs/page-builder-context.md`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/services/pageBuilder.ts`
- `frontend/src/views/PageBuilderView.vue`
- `frontend/src/components/pageBuilder/PageBuilderSetupDrawer.vue`
- `frontend/src/components/pageBuilder/PageBuilderAIConfigModal.vue`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
- `backend/src/routes/api.ts`
- `backend/src/services/PageBuilderPreviewRenderer.ts`
- `backend/src/services/AIAdapter.ts`

## 7. Recommended Next Step

Do not add more features first.

The next session should focus only on:

1. reproducing the exact provider failure in `/api/page-builder/generate`
2. capturing the exact fallback `project.files`
3. feeding those exact files into `PageBuilderPreviewRenderer` in isolation
4. proving why the preview is still black despite the fallback path
5. making black-screen-without-visible-output impossible

## 8. Short Resume Prompt

`The page-builder drawer has been moved toward a chat-first AI panel and AI config persistence was added, but two blockers remain unresolved after repeated repair attempts: (1) real AI generation still fails through the provider path with "Provider returned error", and (2) fallback project files still do not reliably render visible output in the center preview, even though preview is supposed to compile strictly from the same files shown in the left tree.`
