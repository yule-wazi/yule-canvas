# Page Builder Workbench

## 1. Scope

This file is the stable product plan and implementation direction for the page-builder workbench.

Use this file to answer:

- what the page-builder product is ultimately trying to become
- what the current AI stage is
- how the page-builder should evolve over the next long period
- which architecture choices are already fixed
- which tasks are current, next, and later

Do not use this file as the recent handoff log.
Use `docs/page-builder-context.md` for current session state.

## 2. Final Product Goal

The long-term goal remains:

`a workspace-centered Vue page builder where AI can generate, revise, and eventually repair real project files that render data-driven pages from crawler-backed data`

This means the final product is not:

- a static page mockup generator
- a single-shot HTML demo tool
- a hidden-code preview system

It is intended to become:

`an editable Vue workspace where the file tree, code editor, preview runtime, data contract, and AI generation loop all operate on the same project files`

## 3. Current Strategic Reality

The project already has a usable crawler / workflow side.

The active product focus is now the page-builder side.

But the page-builder side is still in staged construction.

The immediate priority is not to build a full autonomous coding agent inside the product.

The immediate priority is:

`make AI produce workable multi-file Vue workspace code inside the current page-builder workbench`

## 4. Official Current Direction

The official page-builder direction is now:

`workspace files in app state -> code surface + file tree + Sandpack preview -> AI-generated Vue files -> host-bridged runtime table data -> later stable data service`

This still means:

- the old custom `srcdoc` preview path is abandoned
- the workbench remains workspace-first
- Sandpack remains the official preview runtime for the current stage
- the current practical Vue preview path still prefers Sandpack `vue` over `vite-vue`

## 5. Core Implementation Philosophy

The workbench should be built in layers, not all at once.

The final agent-like behavior is a later-stage capability.

The product should grow through these levels:

1. `direct generation`
   AI generates a first draft workspace from user intent and data context.

2. `workspace editing`
   AI reads current workspace files and selectively updates or adds files.

3. `error-aware revision`
   AI sees preview / compile failures and repairs files.

4. `agentic repair and iteration`
   AI behaves more like a constrained coding agent inside the page-builder loop.

The current stage should target only level 1.

## 6. Current AI Stage Definition

The current official AI stage is:

`Phase A: direct workspace generation`

Meaning:

- AI does not yet need to read the current workspace files
- AI does not yet need true tool use
- AI does not yet need autonomous debugging
- AI is asked to generate a valid set of Vue workspace files from prompt
- the system parses that output into the visible workspace
- the user can inspect generated files directly in the code surface

This stage exists to answer one core question first:

`can the model generate code that is structurally suitable for the page-builder workspace at all`

## 7. Product Contract

The core product contract remains:

`the left file tree, code surface, and preview must all stay aligned to the same workspace files`

Accepted behavior:

- AI generates files
- the system parses them into workspace file records
- the left tree shows those exact files
- the code view edits those exact files
- Sandpack preview runs those exact files
- the user can inspect AI output file-by-file

Rejected behavior:

- preview depending on hidden synthetic output not represented in the file tree
- AI generating code that only exists in opaque backend memory
- hidden transformation steps that make the workspace differ from the rendered project

Important clarification:

- host-injected runtime support files are allowed when they are clearly internal runtime infrastructure
- those internal files must not be treated as ordinary user-authored workspace files

## 8. Preview Runtime Decision

Sandpack remains the official preview layer.

Current practical guidance remains:

- prefer Sandpack `vue`
- preserve preview runtime across normal editing
- allow explicit forced remount when Sandpack lifecycle behavior is unreliable
- keep generated files compatible with the current preview-safe constraints

This part of the architecture is already chosen and should remain stable for the near term.

## 9. Vue Generation Rules

Generated Vue code should continue to follow these practical rules:

1. Prefer standard SFC structure.
2. Prefer `template + script setup`.
3. Use optional `style scoped` only when useful.
4. Avoid template-only SFC output as the default.
5. Keep imports and file paths explicit and simple.
6. Keep generated code runnable inside the current Sandpack Vue environment.
7. Read runtime table data through `src/data/tableData.js`, not through ad hoc direct fetches.

These rules are current product constraints for runtime stability.

## 10. Workspace Shape For The Current Stage

The workspace should continue to look like a real mini Vue project.

Current practical structure:

```text
workspace
  /public
    index.html
  /src
    App.vue
    main.js
    styles.css
    /components
    /data
    /spec
```

But not every file needs to be AI-authored.

The system should reserve ownership of some runtime infrastructure files.

Current practical examples:

- `src/data/tableData.js`
  system-controlled runtime data adapter
- `src/data/__runtimeTableData.js`
  host-injected hidden bridge file for current table data

## 11. Output Strategy Decision

For the current stage, AI output should be controlled through:

`strong prompt + streamable file-block protocol`

Current practical contract:

- AI emits `<file path="..." role="...">...</file>` blocks
- AI emits one final `<summary>...</summary>` block

This is preferred over true tool use for now.

Reason:

- easier to stabilize
- easier to inspect
- supports real file-level streaming progress
- lower implementation complexity than true tools
- enough for direct generation validation

## 12. Data Contract Position For The Current Stage

Dynamic data is still a long-term hard requirement.

That has not changed.

But the current AI milestone does **not** require a final permanent backend data service first.

For now:

- the model receives selected table schema
- the model receives `rowCount`
- the model receives a small `sampleRows` subset for shape understanding
- the preview runtime receives real current table data through a host bridge

So the rule is:

`do not block initial AI workspace generation on finishing the final live data architecture`

At the same time:

- generated components must not hardcode sample rows as the real dataset
- generated components must use `src/data/tableData.js`
- AI must not generate `src/data/__runtimeTableData.js`

## 13. Current Long-Horizon Plan

The page-builder should evolve through these major phases.

### Phase A: Direct AI Workspace Generation

Goal:

- AI generates a first-draft multi-file Vue workspace from user intent and table context

What this phase includes:

- define prompt shape
- define streamed file-block output rules
- parse returned files into workspace records
- show generated files in the left tree
- inspect generated code in the center code area
- run those files in Sandpack preview
- bridge current runtime table data into preview

What this phase does not include:

- AI reading the current workspace first
- AI modifying files across multiple turns with precise patches
- AI repairing errors automatically
- AI autonomous tool use

Success criteria:

- the model can repeatedly generate files structurally compatible with the workbench
- generated pages read data through the shared adapter
- Sandpack preview behavior is predictable enough for normal iteration

### Phase B0: Conversational Workspace Revision

Goal:

- let the user continue the same page-builder conversation after first generation, while AI can answer questions, inspect the current workspace on demand, and perform constrained follow-up file changes

Why this phase exists:

- it is the smallest practical step between one-shot generation and full workspace editing
- it matches how AI IDEs actually work more closely than blind full-context regeneration
- it keeps the product conversational without requiring true unrestricted agent loops
- it improves hit rate by letting the model ask for the exact files it needs before answering or changing code

Official product definition:

`persistent conversation memory + current workspace tree + on-demand workspace reads + final whole-file replacement updates`

This phase is intentionally **not** full agentic editing.

It is a controlled multi-step interaction model:

1. user sends a follow-up message
2. AI first decides whether current context is sufficient
3. if not sufficient, AI requests `search_workspace` or `read_files`
4. the system executes that internal action
5. AI receives the gathered context in a second call
6. AI then either answers or returns final file updates
7. the workspace is still committed only after the full operation finishes

Supported user intents in this phase:

1. `chat`
   answer, explain, summarize, or recommend without changing files
2. `update`
   replace the full contents of one or more existing files
3. `create`
   add one or more files, plus limited entry-point wiring updates
4. `mixed`
   explain first, then perform `update` or `create`

Explicit non-goals for this phase:

- arbitrary file deletion
- arbitrary file rename
- autonomous repair loops
- unrestricted repeated tool calling
- compile-error-driven self-healing
- patch-level editing semantics

### Phase B0.1 Persistent Context Model

To maximize accuracy, the system should not rely on the model passively remembering previous turns.

Instead, every call should rebuild the minimal needed context from product state.

The context model should be split into:

1. `session memory`
   compact standing summary of current page goal, style direction, user constraints, and unresolved items
2. `recent turn history`
   structured records of the last few turns, including which files were read and changed
3. `workspace tree`
   current file paths plus lightweight role summaries, but not full file contents by default
4. `turn working context`
   per-request temporary state for this in-flight user message, including selected file, search results, and files read during this turn

Important rule:

`conversation memory is persistent, but source code is fetched on demand from the current real workspace`

This avoids stale-code drift after user edits or later AI revisions.

### Phase B0.2 Internal Action Model

The user sees one conversation surface, but the backend should treat each turn as a small state machine.

The internal actions should be:

1. `respond`
   answer immediately with no file changes
2. `search_workspace`
   search by file path, component name, identifier, or text before deciding what to read
3. `read_files`
   read one or more concrete files from the current workspace
4. `plan_changes`
   optional structured planning step before file generation for higher-confidence multi-file changes
5. `apply_changes`
   return final create/update file results

First implementation guidance:

- `plan_changes` may be implicit at first
- the minimum useful internal actions are `respond`, `search_workspace`, `read_files`, and `apply_changes`
- do not allow open-ended recursive loops in the first implementation
- keep each user turn to at most:
  - one decision call
  - one internal gather step
  - one final AI call

### Phase B0.3 Multi-Call Turn Structure

This phase should be implemented as bounded multi-call orchestration, not one giant prompt.

The turn flow should be:

#### Step 1: Decision Call

Input should include:

- system rules
- session memory
- recent turn history
- current workspace tree
- current selected file if any
- the raw user message

The AI must return a structured decision, not free-form prose.

It should choose one of:

- `respond`
- `search_workspace`
- `read_files`
- `apply_changes`

If it requests more information, the decision call should end there.

#### Step 2: Internal Gather Step

The product executes the requested search or file read internally.

This is not a user-visible AI answer.

Gather results should be attached to the active turn context, not committed as final history yet.

#### Step 3: Final AI Call

The second AI call receives:

- everything from the decision call
- the decision result
- the gathered search/file-read results

The AI then produces one of:

- final natural-language answer
- final file changes
- explanation plus final file changes

Important implementation rule:

the original user request must be preserved and resent in the final call so the model does not answer the gather result in isolation.

### Phase B0.4 File Editing Semantics

To keep the first implementation reliable, follow-up edits should start with whole-file replacement, not patch editing.

This means:

- `update` reads the target files first
- AI returns the full new contents for each updated file
- the system replaces those file contents atomically at final commit

This is simpler than:

- line patches
- AST edits
- unrestricted diff merging

And it is acceptable because the page builder already treats generated files as inspectable workspace files.

The first implementation should allow:

- updating one or more existing files by full replacement
- creating one or more new files
- limited entry wiring such as updating `src/App.vue` to import and render a new component

The first implementation should avoid:

- partial text patch application
- delete semantics
- rename semantics
- wide refactors with uncertain file selection

### Phase B0.5 Accuracy Rules

To maximize hit rate, the system should prefer under-reaching over overreaching.

Rules:

1. do not inject the entire workspace source into every turn
2. always provide the current workspace tree
3. only read source files when the user asks about them or the model explicitly requests them
4. prefer `search_workspace` before `read_files` when the target location is ambiguous
5. always read the current real file contents before `update`
6. do not let the model infer stale code from earlier turns when current files are available
7. preserve system-owned file restrictions during every create/update step
8. keep turn history short and structured rather than replaying long free-form chat transcripts
9. preserve the original user request across all calls in the same turn
10. keep the maximum step count bounded so the orchestration remains predictable

### Phase B0.6 Required Turn State

Each in-flight user request should have a temporary turn object that survives across the multi-call sequence.

The implementation should maintain at least:

- `turnId`
- `userMessage`
- `intent`
- `phase`
- `selectedFile`
- `workspaceTree`
- `sessionMemory`
- `recentTurns`
- `searchResults`
- `readFiles`
- `finalAnswer`
- `pendingFileChanges`

This object should exist before the turn is finalized into persistent history.

### Phase B0.7 Required Persistent History

After the turn completes, the system should store a compact structured record.

Each completed turn should capture:

- `turnId`
- `intent`
- `userRequest`
- `actionsUsed`
- `filesRead`
- `filesCreated`
- `filesUpdated`
- `assistantSummary`

This is the authoritative record of what AI actually did.

The next turn should use this history rather than trusting the model to remember past actions.

### Phase B: AI Workspace Editing

Goal:

- AI reads the current workspace and selectively updates or adds files based on user follow-up requests

What this phase includes:

- pass current file tree and selected file contents into AI context
- move from full-file generation toward constrained file editing
- likely shift from pure file generation toward operation-style output

Success criteria:

- user can request targeted changes without full blind regeneration

### Phase C: Error-Aware Repair

Goal:

- AI can revise files using preview or compile feedback

What this phase includes:

- pass preview compile/runtime errors to AI
- allow AI to patch workspace files after failed output

Success criteria:

- failed first drafts can be iteratively repaired inside the workbench

### Phase D: Agentic Page Builder

Goal:

- AI behaves more like a constrained in-product coding agent

What this phase includes:

- limited file tools
- multi-step reasoning
- stronger revision loops
- eventual bug-fix behavior inside the workbench

Success criteria:

- AI can generate, revise, and recover more autonomously inside product boundaries

## 14. Immediate Task Focus

The next concrete tasks should now be:

1. keep the file-stream contract reliable across prompts and providers
2. improve the grouped file-operation UI
3. keep Sandpack preview remount behavior predictable
4. keep the runtime data bridge stable and invisible to normal project files
5. identify what kinds of invalid code the model most often produces

These are still higher priority than building full workspace-editing intelligence.

At the same time, the next design-and-implementation checkpoint for follow-up conversation should be:

`Phase B0: bounded conversational workspace revision with on-demand reads and whole-file updates`

### 14.1 Detailed Execution Checklist For Phase B0

The execution order should be:

1. define the `decision call` output contract
   the model must return structured next actions instead of ambiguous prose
2. define the `final call` output contract
   the model must return either a final answer or final file results
3. define the in-flight turn state object
   one user request may span multiple AI calls and must preserve shared state
4. define session memory fields
   keep them short, structured, and stable across turns
5. define recent-turn history fields
   store actions used, files read, files created, and files updated
6. define workspace tree summaries
   include file paths plus short roles, but not full source by default
7. implement bounded internal actions
   first ship `search_workspace`, `read_files`, and final `apply_changes`
8. keep maximum orchestration depth bounded
   first version should allow only one gather step before the final AI call
9. implement `chat` first
   make sure AI can ask to read files before answering
10. implement `update` second
   use whole-file replacement after reading current file contents
11. implement `create` third
   allow new files plus limited entry-point wiring updates
12. implement `mixed` last
   combine explanation with the same create/update machinery
13. continue using final-commit-only workspace writes
   do not live-write partial file updates during the gather stage
14. keep system-owned file restrictions enforced in every step
   especially `src/data/__runtimeTableData.js`
15. log each turn in structured form for later prompt reuse and debugging

### 14.2 First Shipping Scope

The first shipped follow-up conversation version should stop at:

- multi-call turn orchestration
- persistent session memory
- structured recent-turn history
- workspace tree awareness
- on-demand search and file reads
- `chat`
- `update` with whole-file replacement
- `create` with limited wiring changes
- `mixed`

It should explicitly exclude:

- delete
- rename
- auto-repair
- compile-error fixing loops
- unbounded tool recursion
- patch-level editing

### 14.3 Success Criteria For Phase B0

This phase should be considered successful when:

1. the user can ask follow-up questions and receive answers grounded in the current workspace rather than stale prior outputs
2. the AI can request additional file context before answering instead of hallucinating
3. follow-up edits can target existing files without blind full-workspace regeneration
4. the final commit behavior remains predictable and preview-safe
5. the prompt orchestration remains bounded, debuggable, and inspectable

## 15. Current Non-Goals

The workbench should **not** treat these as current-phase requirements:

- full autonomous coding-agent behavior
- arbitrary tool use
- self-directed bug fixing
- fully stable live crawler-backed backend data service
- perfect file editing semantics
- unrestricted file deletion or rename logic

Those belong to later phases.

## 16. Stable Decisions

These decisions should now be treated as fixed unless explicitly changed.

1. The final product still aims for AI-generated and AI-editable real Vue files.
2. The workbench remains workspace-centered.
3. Sandpack remains the official preview runtime.
4. The practical current preview path still prefers Sandpack `vue`.
5. The old custom `srcdoc` preview path remains abandoned.
6. The first AI milestone is direct multi-file generation, not agentic editing.
7. The first AI milestone should use a streamable file-block protocol, not true tool use.
8. The user must be able to inspect generated files directly in the workspace.
9. Runtime preview data currently comes from a host bridge, not a permanent backend data service.
10. `src/data/tableData.js` is a system-controlled adapter.
11. `src/data/__runtimeTableData.js` is internal runtime infrastructure and must not be AI-authored.
12. Later stages may move from direct generation toward workspace editing and then repair loops.

## 17. What To Avoid

The workbench should avoid:

- overengineering a full agent loop before validating generation quality
- requiring AI to solve the entire final architecture in the first release
- letting AI hardcode sample rows as live runtime data
- exposing internal runtime bridge files as ordinary project files
- treating direct generation and workspace editing as the same implementation problem
- reintroducing abandoned preview strategies

## 18. Summary

The page-builder workbench should now be understood as:

`a workspace-centered Vue page builder that already has a working Sandpack preview foundation and is in its first practical AI stage: direct streamed multi-file workspace generation from prompt, parsed into the visible file tree and code editor, with current runtime table data bridged into preview through a hidden host-injected adapter layer, before later evolving into selective editing, repair, and more agentic behavior`
