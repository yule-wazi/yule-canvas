# Agent

## 1. Scope

This file is the high-level project context for the whole repository.

Use this file to understand:

- what AIBrowser is building overall
- which product half is mature
- which product half is currently active
- which constraints should remain stable across conversations

Do not use this file as the recent task handoff log.
Recent task state should go into `docs/page-builder-context.md`.

## 2. Project Summary

AIBrowser is evolving toward a two-agent product around data-driven web creation.

Long-term goal:

1. `data extraction agent`
   Understand target sites and build reusable scraping workflows from recordings, user actions, and later natural-language intent.

2. `page building agent`
   Generate webpages that are powered by extracted data and later by richer user intent.

## 3. Current Reality

- The crawler / workflow side is the mature side of the product.
- The page-builder side is now the active product focus.
- The crawler side is already usable enough to act as the upstream data source for the page-builder stage.

## 4. Current Product Stage

The project already has a working foundation for:

- browser recording
- field annotation / marking
- recording event management
- recording-to-workflow mapping
- visual workflow editing
- workflow execution with Playwright
- storing extracted results into local data tables

This means the repo is currently a usable workflow-based data extraction platform, while page building is the active new layer being built on top of it.

## 5. Current Main Focus

The current main focus is:

1. keep the crawler workflow practical and stable
2. treat extracted tables as the input source for the next stage
3. build the first practical `page builder workbench`
4. move toward `data table -> generated workspace -> preview -> AI iteration`

Not in scope by default:

- sketch-to-page
- fully free-form website generation
- autonomous end-to-end orchestration between crawler agent and page agent

## 6. Architecture Overview

### Backend

Main backend responsibility today:

- record browser behavior
- map recordings to workflows
- validate and execute workflows
- optionally use AI to generate workflow JSON
- stream page-builder file generation results

Important backend files:

- `backend/src/server.ts`
- `backend/src/routes/api.ts`
- `backend/src/services/BrowserRecorder.ts`
- `backend/src/services/RecordingWorkflowMapper.ts`
- `backend/src/services/WorkflowInterpreter.ts`
- `backend/src/services/WorkflowSemanticValidator.ts`
- `backend/src/services/AIAdapter.ts`
- `backend/src/services/PageBuilderAI.ts`

### Frontend

Main frontend responsibility today:

- workflow editing
- recording control
- data table management
- execution logs and results
- page-builder workbench development
- Sandpack-based runtime preview

Important crawler-side files:

- `frontend/src/components/workflow/WorkflowEditor.vue`
- `frontend/src/stores/workflow.ts`
- `frontend/src/components/DataTableManager.vue`
- `frontend/src/views/Home.vue`

Important page-builder files:

- `frontend/src/views/PageBuilderView.vue`
- `frontend/src/stores/pageBuilder.ts`
- `frontend/src/services/pageBuilder.ts`
- `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
- `frontend/src/components/pageBuilder/PageBuilderSandbox.vue`

Important page-builder docs:

- `docs/page-builder-workbench.md`
- `docs/page-builder-context.md`

## 7. Stable Constraints

These constraints should remain stable unless the user explicitly changes direction:

1. The crawler side should remain usable and stable.
2. New work should not assume the page-building agent is already complete.
3. The first page-builder version should stay data-driven, not fully free-form.
4. Workflow generation must remain inside current engine capability.
5. Prefer deterministic mapping when recording evidence exists.
6. AI-generated workflow output must be validated before use.
7. Avoid replacing working crawler behavior with unstable AI-first behavior.
8. The page builder should remain workspace-centered.
9. Sandpack remains the official preview runtime for the current stage.
10. Runtime table data for preview is currently bridged from host frontend state, not fetched from a permanent backend data service.

## 8. Recommended Reading Order

When resuming the whole project in a new conversation:

1. `docs/agent.md`
2. `docs/page-builder-context.md`
3. `docs/page-builder-workbench.md`
4. `README.md`
5. if task is crawler-related:
   - `frontend/src/components/workflow/WorkflowEditor.vue`
   - `frontend/src/stores/workflow.ts`
   - `backend/src/server.ts`
   - `backend/src/services/BrowserRecorder.ts`
   - `backend/src/services/RecordingWorkflowMapper.ts`
   - `backend/src/services/WorkflowInterpreter.ts`
6. if task is page-builder-related:
   - `frontend/src/views/PageBuilderView.vue`
   - `frontend/src/stores/pageBuilder.ts`
   - `frontend/src/services/pageBuilder.ts`
   - `frontend/src/components/pageBuilder/PageBuilderPreview.vue`
   - `backend/src/services/PageBuilderAI.ts`

## 9. Guidance For Future AI

When continuing this repo:

- first identify whether the task belongs to:
  - workflow engine
  - recorder / mapper
  - data tables
  - page builder / AI generation workbench
- if ambiguous, assume crawler stability should be preserved
- if ambiguous, prefer moving the product toward stable page generation from extracted tables
- treat recent page-builder interaction details as belonging to `docs/page-builder-context.md`, not this file
- do not reintroduce hidden preview paths that bypass the visible workspace
- do not let AI generate or expose `src/data/__runtimeTableData.js` as an ordinary project file

## 10. Short Resume Prompt

`AIBrowser is a workflow-based browser data extraction platform evolving into a dual-agent system: one agent for extracting data and one for generating webpages from that data. The crawler stack is already usable. The current active focus is the page-builder workbench built on top of extracted tables. That workbench now uses streamed file generation, a workspace-first Sandpack preview, and a host-injected runtime table-data bridge so generated pages can render current table data without hardcoding sample rows.`
