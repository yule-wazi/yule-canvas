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

`workspace files in app state -> code surface + file tree + Sandpack preview -> AI-generated Vue files -> later stable dynamic data adapter`

This still means:

- the old custom `srcdoc` preview path is abandoned
- the workbench remains workspace-first
- Sandpack remains the official preview runtime for the current stage
- the current practical Vue preview path still prefers Sandpack `vue` over `vite-vue`

## 5. What Has Changed In Product Direction

The previous assumption was:

`finish preview stabilization and data adapter formalization first, then re-enable AI`

That is no longer the most useful framing for the next major stage.

The new practical product plan is:

`use the current workspace preview foundation to begin AI generation earlier, but start with the simplest controlled AI generation mode first`

That first controlled AI mode is:

`AI direct multi-file workspace generation from prompt, without yet reading and editing the current workspace`

## 6. Core Implementation Philosophy

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

## 7. Current AI Stage Definition

The current official AI stage is:

`Phase A: direct workspace generation`

Meaning:

- AI does not yet need to read the current workspace files
- AI does not yet need true tool use
- AI does not yet need autonomous debugging
- AI is first asked to generate a valid set of Vue workspace files from prompt
- the system then parses that output into the left file tree and code editor
- the user can inspect the generated files directly in the center code area

This stage exists to answer one core question first:

`can the model generate code that is structurally suitable for the page-builder workspace at all`

## 8. Why This Stage Comes First

This stage is intentionally simpler than a full agent workflow.

Reason:

- it is the fastest path to validating AI page generation quality
- it avoids prematurely building a full in-product file agent
- it lets the user inspect generated code immediately
- it reduces system complexity while the output format is still being learned
- it gives a practical baseline before later adding file-reading, error-fixing, and multi-turn revision

In other words:

`first validate raw generation quality, then validate editing intelligence`

## 9. Product Contract

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

## 10. Preview Runtime Decision

Sandpack remains the official preview layer.

Current practical guidance remains:

- prefer Sandpack `vue`
- avoid reintroducing Sandpack `vite-vue` into the main flow until runtime behavior is acceptable
- preserve preview runtime across tab switching
- keep generated files compatible with the current preview-safe constraints

This part of the architecture is already chosen and should remain stable for the near term.

## 11. Vue Generation Rules

Generated Vue code should continue to follow these practical rules:

1. Prefer standard SFC structure.
2. Prefer `template + script setup`.
3. Use optional `style scoped` only when useful.
4. Avoid template-only SFC output as the default.
5. Keep imports and file paths explicit and simple.
6. Keep generated code runnable inside the current Sandpack Vue environment.

These rules are not abstract preferences.
They are current product constraints for runtime stability.

## 12. Workspace Shape For The Current Stage

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

But for the current AI generation stage, not every file needs to be AI-authored.

The system may still keep certain foundation files stable while AI generates the main page files.

## 13. How Template Should Be Understood Now

The word `template` needs a precise meaning.

At the current stage, `template` does **not** primarily mean:

`a fixed scaffold that AI must first read and then minimally edit`

At the current stage, `template` more practically means:

`the system's baseline workspace shape and file conventions, which define what kind of project AI should generate into`

That means:

- the system can still create a baseline workspace
- but the first AI experiment does not need to read that workspace first
- instead, AI can directly generate a multi-file result that matches the expected workspace conventions

Later stages may shift back toward:

`AI reads the existing workspace and selectively modifies or adds files`

But that is not the current first milestone.

## 14. Official AI Generation Model For The Current Stage

The official current AI mode should be:

`prompt -> structured multi-file output -> workspace parsing -> file tree + code view + preview`

Not:

- prompt -> hidden HTML
- prompt -> opaque backend project blob with no visible files
- prompt -> autonomous tool-using coding agent

The user should be able to immediately see:

- what files AI created
- what code is inside them
- whether the generated code is structurally acceptable

## 15. Output Strategy Decision

For the current stage, AI output should be controlled through:

`strong prompt + structured JSON output`

This is preferred over true tool use for now.

Reason:

- easier to stabilize
- easier to inspect
- lower implementation complexity
- enough for direct generation validation
- does not require building a full agent orchestration layer yet

This means the current AI should return a structure similar to:

```json
{
  "summary": "One-sentence description of the generated page",
  "files": [
    {
      "path": "src/App.vue",
      "role": "App root component",
      "content": "..."
    },
    {
      "path": "src/styles.css",
      "role": "Shared styles",
      "content": "..."
    },
    {
      "path": "src/components/HeroSection.vue",
      "role": "Hero section component",
      "content": "..."
    }
  ]
}
```

This stage is for direct file generation, not file operations.

Later stages may move toward:

```json
{
  "operations": [
    { "type": "update", "path": "...", "content": "..." },
    { "type": "create", "path": "...", "content": "..." }
  ]
}
```

But that is more suitable for workspace editing than for the first direct-generation milestone.

## 16. Why True Tool Use Is Deferred

True tool use is not the current main path.

It should be deferred because it would require:

- file read tools
- file write tools
- planning and orchestration logic
- retry and repair loops
- stronger safety boundaries
- error-aware multi-step execution

Those are important later, but they are not needed to answer the current milestone question:

`can AI generate a valid workspace draft that fits this product at all`

## 17. Data Contract Position For The Current Stage

Dynamic data is still a long-term hard requirement.

That has not changed.

But the current AI milestone does **not** need to solve the final live crawler-backed runtime contract first.

For now:

- the system can provide selected table schema
- the system can provide sample rows
- generated code can initially target a simpler development data contract
- later stages should evolve this into the full stable runtime adapter

So the rule is:

`do not block initial AI workspace generation on completing the final dynamic data architecture`

However:

- generated code should still be guided toward a clean data access boundary
- generated files should not tightly couple themselves to crawler internals

## 18. Current Long-Horizon Plan

The page-builder should now evolve through these major phases.

### Phase A: Direct AI Workspace Generation

Goal:

- AI generates a first-draft multi-file Vue workspace from user intent and table context

What this phase includes:

- define prompt shape
- define structured `files` output schema
- parse returned files into workspace records
- show generated files in the left tree
- inspect generated code in the center code area
- run those files in Sandpack preview

What this phase does not include:

- AI reading the current workspace first
- AI modifying files across multiple turns
- AI repairing errors automatically
- AI autonomous tool use

Success criteria:

- the model can repeatedly generate files that are structurally compatible with the page-builder workspace

### Phase B: AI Workspace Editing

Goal:

- AI reads the current workspace and selectively updates or adds files based on user follow-up requests

What this phase includes:

- pass current file tree and selected file contents into AI context
- move from full-file generation to constrained file editing
- likely shift from `files[]` output toward `operations[]`

Success criteria:

- user can say things like “change the hero layout” or “add a card grid component” and AI updates the existing workspace rather than regenerating everything blindly

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

- AI can not only generate first drafts, but also revise and recover more autonomously inside product boundaries

## 19. Immediate Task Focus

The next concrete tasks should now be:

1. define the first AI prompt contract for direct workspace generation
2. define the `files[]` JSON output schema
3. define file path allow-lists and parsing rules
4. connect AI output into the current workspace file tree
5. let the user inspect generated code in the code panel
6. verify Sandpack preview can run the generated files
7. identify what kinds of invalid code the model most often produces

These are now higher priority than building full workspace-editing intelligence.

## 20. Current Non-Goals

The workbench should **not** treat these as current-phase requirements:

- full autonomous coding-agent behavior
- arbitrary tool use
- self-directed bug fixing
- fully stable live crawler-backed runtime integration
- perfect file editing semantics
- unrestricted file deletion or rename logic

Those belong to later phases.

## 21. Stable Decisions

These decisions should now be treated as fixed unless explicitly changed.

1. The final product still aims for AI-generated and AI-editable real Vue files.
2. The workbench remains workspace-centered.
3. Sandpack remains the official preview runtime.
4. The practical current preview path still prefers Sandpack `vue`.
5. The old custom `srcdoc` preview path remains abandoned.
6. The first AI milestone is direct multi-file generation, not agentic editing.
7. The first AI milestone should use strong prompt + structured JSON output, not true tool use.
8. The user must be able to inspect generated files directly in the workspace.
9. Dynamic data remains a long-term requirement, but it should not block the first AI generation milestone.
10. Later stages may move from direct generation toward workspace editing and then repair loops.

## 22. What To Avoid

The workbench should avoid:

- overengineering a full agent loop before validating generation quality
- requiring AI to solve the entire final architecture in the first release
- hiding AI output from the workspace file tree
- treating direct generation and workspace editing as the same implementation problem
- blocking AI experiments on finishing every later-stage subsystem first
- reintroducing abandoned preview strategies

## 23. Summary

The page-builder workbench should now be understood as:

`a workspace-centered Vue page builder that already has a working preview foundation and is now entering its first practical AI stage: direct multi-file workspace generation from prompt, parsed into the visible file tree and code editor, before later evolving into true workspace editing, repair, and more agentic behavior`
