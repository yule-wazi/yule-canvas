# AIBrowser Agent Context

## 1. Project Summary

This project is building a two-agent product around data-driven web creation.

Long-term goal:

1. A `data extraction agent`
   Understand a user's target site and build reusable scraping workflows from user actions, recordings, or later natural-language intent.

2. A `page building agent`
   Generate webpages that are powered by extracted data and, later, by user intent or sketches.

Current reality:

- The crawler side is the mature part of the product.
- The page-building side has not started implementation yet.
- The crawler side is now usable enough to act as the data-source foundation for the next phase.

## 2. Current Stage

The project already has a working foundation for:

- browser recording
- field annotation / marking
- recording event management
- mapping recordings into workflow JSON
- visual workflow editing
- executing workflows with Playwright
- storing extracted results into local data tables

This means the project is currently a `workflow-based scraping platform` with a usable data layer.

## 3. Current Main Task

The current main task is shifting.

Previous focus:

- crawler workflow capability
- recorder / mapper correctness
- frontend workbench styling

Current planning focus:

1. Keep the crawler workflow in a practical, usable state.
2. Treat the current crawler output as the input source for the next stage.
3. Design the first phase of the `page building agent`.
4. Prioritize `data table -> page spec -> generated page` over free-form page generation.

Not in scope right now:

- sketch-to-page implementation
- full free-form autonomous website generation
- full orchestration between crawler agent and page agent

## 4. Product Direction

The intended future product loop is:

1. User describes a wanted webpage or desired content.
2. The data agent obtains structured data from target websites.
3. The page agent builds a webpage using that data.
4. The two parts combine into a complete generated webpage.

Important:

- The mature code today still belongs mostly to step 2.
- The next product planning focus is step 3.

## 5. Important Architecture

### Backend

Main backend responsibility today:

- record browser behavior
- map recordings to workflows
- validate and execute workflows
- optionally use AI to generate workflow JSON

Important files:

- [server.ts](D:/网页学习/AIBrowser/backend/src/server.ts)
  Socket.io entry for workflow execution and recording lifecycle.
- [api.ts](D:/网页学习/AIBrowser/backend/src/routes/api.ts)
  AI workflow generation, recording normalization, workflow mapping, preview endpoints.
- [BrowserRecorder.ts](D:/网页学习/AIBrowser/backend/src/services/BrowserRecorder.ts)
  Core recording logic, action mode, mark mode, loop capture support.
- [RecordingWorkflowMapper.ts](D:/网页学习/AIBrowser/backend/src/services/RecordingWorkflowMapper.ts)
  Deterministic mapping from recording payloads to workflow JSON.
- [WorkflowInterpreter.ts](D:/网页学习/AIBrowser/backend/src/services/WorkflowInterpreter.ts)
  Actual workflow execution engine.
- [WorkflowSemanticValidator.ts](D:/网页学习/AIBrowser/backend/src/services/WorkflowSemanticValidator.ts)
  Prevents generated workflows from exceeding current engine capability.
- [AIAdapter.ts](D:/网页学习/AIBrowser/backend/src/services/AIAdapter.ts)
  AI provider abstraction and workflow generation logic.

### Frontend

Main frontend responsibility today:

- workflow editing
- recording control
- data table management
- execution logs and results
- current visual style migration

Important files:

- [WorkflowEditor.vue](D:/网页学习/AIBrowser/frontend/src/components/workflow/WorkflowEditor.vue)
  The main workflow workbench.
- [workflow.ts](D:/网页学习/AIBrowser/frontend/src/stores/workflow.ts)
  Workflow state, block config, history, condition block normalization.
- [DataTableManager.vue](D:/网页学习/AIBrowser/frontend/src/components/DataTableManager.vue)
  Local table management UI for extracted content.
- [Home.vue](D:/网页学习/AIBrowser/frontend/src/views/Home.vue)
  Landing page and current product-facing overview page.
- [tokens.css](D:/网页学习/AIBrowser/frontend/src/styles/tokens.css)
  Shared design tokens used by the frontend.

### New Planning Docs

- [page-builder-plan.md](D:/网页学习/AIBrowser/docs/page-builder-plan.md)
  Planning doc for the first page-builder phase.
- [page-style-guide.md](D:/网页学习/AIBrowser/docs/ai/page-style-guide.md)
  Visual reference and style constraints.

## 6. Current Constraints

These constraints matter when continuing work:

1. The crawler side should remain usable and stable.
2. New work should not assume the page-building agent already exists in code.
3. The first page-builder version should be data-driven, not fully free-form.
4. Workflow generation must stay inside current engine capability.
5. Prefer deterministic mapping when recording evidence is available.
6. AI-generated workflow output must be validated before use.
7. Avoid replacing working crawler behavior with unstable AI-first behavior.

## 7. Known Gaps

These are the main current gaps in the project:

- no real page-building agent yet
- no page spec pipeline yet
- no generated page preview pipeline yet
- data output is usable, but not yet fully shaped as a stable page-builder contract
- some files contain garbled Chinese text / encoding issues

## 8. Recommended Reading Order For A New Conversation

If a new AI conversation needs to resume work quickly, read files in this order:

1. [agent.md](D:/网页学习/AIBrowser/docs/agent.md)
2. [page-builder-plan.md](D:/网页学习/AIBrowser/docs/page-builder-plan.md)
3. [README.md](D:/网页学习/AIBrowser/README.md)
4. [WorkflowEditor.vue](D:/网页学习/AIBrowser/frontend/src/components/workflow/WorkflowEditor.vue)
5. [DataTableManager.vue](D:/网页学习/AIBrowser/frontend/src/components/DataTableManager.vue)
6. [workflow.ts](D:/网页学习/AIBrowser/frontend/src/stores/workflow.ts)
7. [server.ts](D:/网页学习/AIBrowser/backend/src/server.ts)
8. [BrowserRecorder.ts](D:/网页学习/AIBrowser/backend/src/services/BrowserRecorder.ts)
9. [RecordingWorkflowMapper.ts](D:/网页学习/AIBrowser/backend/src/services/RecordingWorkflowMapper.ts)
10. [WorkflowInterpreter.ts](D:/网页学习/AIBrowser/backend/src/services/WorkflowInterpreter.ts)

## 9. How Future AI Should Continue

When continuing this project in a new conversation:

- first identify whether the task belongs to:
  - workflow engine
  - recorder / mapper
  - data tables
  - page builder planning / implementation
- if the task is ambiguous, assume the crawler side should stay stable and usable
- if the task is ambiguous, prefer moving the product toward `data table -> page generation`
- treat sketch-to-page and free-form page agent work as later phases unless the user explicitly starts there
- be careful not to overwrite user changes in already-modified frontend components

## 10. Short Resume Prompt

If needed, this is the shortest accurate project resume:

`AIBrowser is currently a workflow-based browser data extraction platform that is planned to evolve into a dual-agent system: one agent for extracting website data and one for generating webpages from that data. The crawler workflow stack is already usable: recording, marking, mapping, editing, executing, and storing data. The next product planning focus is the first phase of the page builder: generating usable pages from extracted data tables through a page-spec-driven pipeline.`
