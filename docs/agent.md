# AIBrowser Agent Context

## 1. Project Summary

This project is building a two-agent product around data-driven web creation.

Long-term goal:

1. A `data extraction agent`
   Understand a user's target site and build reusable scraping workflows from user actions, recordings, or later natural-language intent.

2. A `page building agent`
   Understand a user's description or sketch and generate a webpage that is powered by the extracted data.

Current reality:

- The project is still mainly in the `data extraction agent` stage.
- The `page building agent` has not started yet.
- The current main work is:
  - improving crawler / recording / workflow capabilities
  - refining recording-to-workflow mapping
  - adjusting the frontend visual style according to the style guide

## 2. Current Stage

The project is already beyond a simple demo. It has a working foundation for:

- browser recording
- field annotation / marking
- recording event management
- mapping recordings into workflow JSON
- visual workflow editing
- executing workflows with Playwright
- storing extracted results into local data tables

This means the project is currently a `workflow-based scraping platform`, not yet a full dual-agent product.

## 3. Current Main Task

The current task focus is:

1. Continue building and stabilizing the `crawler workflow`.
2. Support both:
   - manually building workflows
   - recording user behavior and mapping it into workflows
3. Keep improving loop capture / repeated extraction scenarios.
4. Continue refining the frontend workbench without putting page-generation work ahead of crawler workflow stability.

Not in scope right now:

- full AI webpage generation
- sketch-to-page implementation
- final orchestration between page agent and crawler agent

## 4. Product Direction

The intended future product loop is:

1. User describes a wanted webpage or desired content.
2. The data agent obtains structured data from target websites.
3. The page agent builds a webpage using that data.
4. The two parts combine into a complete generated webpage.

Important: the current codebase is only partially prepared for step 4. Most mature code today belongs to step 2.

## 5. Important Architecture

### Backend

Main backend responsibility:

- record browser behavior
- map recordings to workflows
- validate and execute workflows
- optionally use AI to generate workflow JSON

Important files:

- [server.ts](/D:/网页学习/AIBrowser/backend/src/server.ts)
  Socket.io entry for workflow execution and recording lifecycle.
- [api.ts](/D:/网页学习/AIBrowser/backend/src/routes/api.ts)
  AI workflow generation, recording normalization, workflow mapping, preview endpoints.
- [BrowserRecorder.ts](/D:/网页学习/AIBrowser/backend/src/services/BrowserRecorder.ts)
  Core recording logic, action mode, mark mode, loop capture support.
- [RecordingWorkflowMapper.ts](/D:/网页学习/AIBrowser/backend/src/services/RecordingWorkflowMapper.ts)
  Deterministic mapping from recording payloads to workflow JSON.
- [WorkflowInterpreter.ts](/D:/网页学习/AIBrowser/backend/src/services/WorkflowInterpreter.ts)
  Actual workflow execution engine.
- [WorkflowSemanticValidator.ts](/D:/网页学习/AIBrowser/backend/src/services/WorkflowSemanticValidator.ts)
  Prevents generated workflows from exceeding current engine capability.
- [AIAdapter.ts](/D:/网页学习/AIBrowser/backend/src/services/AIAdapter.ts)
  AI provider abstraction and workflow generation logic.

### Frontend

Main frontend responsibility:

- workflow editing
- recording control
- data table management
- execution logs and results
- current visual style migration

Important files:

- [WorkflowEditor.vue](/D:/网页学习/AIBrowser/frontend/src/components/workflow/WorkflowEditor.vue)
  The main workbench. Most current product activity happens here.
- [workflow.ts](/D:/网页学习/AIBrowser/frontend/src/stores/workflow.ts)
  Workflow state, block config, history, condition block normalization.
- [DataTableManager.vue](/D:/网页学习/AIBrowser/frontend/src/components/DataTableManager.vue)
  Local table management UI for extracted content.
- [Home.vue](/D:/网页学习/AIBrowser/frontend/src/views/Home.vue)
  Landing page and current product-facing overview page.
- [tokens.css](/D:/网页学习/AIBrowser/frontend/src/styles/tokens.css)
  Shared design tokens used by the frontend.

## 6. Current Constraints

These constraints matter when continuing work:

1. The current core product is the `data extraction workflow`, not the page generator.
2. New work should not assume the page-building agent already exists.
3. Workflow generation must stay inside current engine capability.
4. Prefer deterministic mapping when recording evidence is available.
5. AI-generated workflow output must be validated before use.
6. Do not casually replace working workflow behavior with purely AI-driven behavior.

## 7. Known Gaps

These are the main current gaps in the project:

- no real page-building agent yet
- no unified orchestration layer for the future two-agent system
- data output is usable, but not yet fully shaped as a stable contract for page generation
- some files contain garbled Chinese text / encoding issues

## 8. Recommended Reading Order For A New Conversation

If a new AI conversation needs to resume work quickly, read files in this order:

1. [agent.md](/D:/网页学习/AIBrowser/docs/agent.md)
2. [README.md](/D:/网页学习/AIBrowser/README.md)
3. [WorkflowEditor.vue](/D:/网页学习/AIBrowser/frontend/src/components/workflow/WorkflowEditor.vue)
4. [workflow.ts](/D:/网页学习/AIBrowser/frontend/src/stores/workflow.ts)
5. [server.ts](/D:/网页学习/AIBrowser/backend/src/server.ts)
6. [BrowserRecorder.ts](/D:/网页学习/AIBrowser/backend/src/services/BrowserRecorder.ts)
7. [RecordingWorkflowMapper.ts](/D:/网页学习/AIBrowser/backend/src/services/RecordingWorkflowMapper.ts)
8. [WorkflowInterpreter.ts](/D:/网页学习/AIBrowser/backend/src/services/WorkflowInterpreter.ts)
9. [AIAdapter.ts](/D:/网页学习/AIBrowser/backend/src/services/AIAdapter.ts)

## 9. How Future AI Should Continue

When continuing this project in a new conversation:

- first identify whether the task belongs to:
  - workflow engine
  - recorder / mapper
  - data tables
  - future page-agent planning
- if the task is ambiguous, assume the current priority is still the crawler workflow and style integration
- if the task is ambiguous, assume the current priority is still the crawler workflow
- treat the page agent as future work unless the user explicitly starts that implementation
- be careful not to overwrite user changes in already-modified frontend components

## 10. Short Resume Prompt

If needed, this is the shortest accurate project resume:

`AIBrowser is currently a workflow-based browser data extraction platform that is planned to evolve into a dual-agent system: one agent for extracting website data and one for generating webpages from user intent or sketches. Right now the mature part is the crawler workflow stack: recording, marking, mapping, editing, executing, and storing data. The page-generation agent has not started yet. Current work is focused on crawler workflow improvements.`
