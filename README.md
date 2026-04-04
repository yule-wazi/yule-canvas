# YuleCanvas

Turn imagination into reality with a true what-you-see-is-what-you-get experience.

YuleCanvas is a workflow-based platform for browser automation, structured data extraction, and data-driven page building.

Current focus:
- Record browser actions and field annotations
- Map recordings into executable workflows deterministically
- Extract structured data into local data tables

Planned next stage:
- Use extracted data to power AI-generated and DIY pages

## Core Capabilities

- Visual workflow editor built with drag-and-drop blocks
- Browser recording with action mode and data annotation mode
- Deterministic mapping from recording events to executable workflows
- Data table system for storing extracted results
- Workflow execution engine based on Playwright
- Local-first development flow with frontend and backend separated

## Current Product Direction

YuleCanvas is not just a crawler builder.

The long-term product direction has two connected parts:

1. A data extraction agent
   Record user behavior, annotate fields, and turn that into reusable scraping workflows.

2. A page-building agent
   Build DIY pages or AI-generated pages that are powered by the extracted data.

At the current stage, development is focused on the first part:
recording, annotation, workflow mapping, and execution correctness.

## Tech Stack

### Frontend

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Flow
- Socket.IO Client
- Axios

### Backend

- Node.js
- Express
- TypeScript
- Socket.IO
- Playwright

## Project Structure

```text
.
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ services/
│  │  ├─ stores/
│  │  ├─ types/
│  │  └─ views/
│  └─ vite.config.js
├─ backend/
│  ├─ src/
│  │  ├─ routes/
│  │  └─ services/
│  └─ tsconfig.json
├─ shared/
└─ package.json
```

## Getting Started

### 1. Install dependencies

```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configure environment variables

Create local env files if needed.

Backend example:

```env
QWEN_API_KEY=your_qwen_api_key
SILICONFLOW_API_KEY=your_siliconflow_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_TITLE=YuleCanvas
```

These files are local-only and should not be committed:

- `backend/.env`
- `frontend/.env`

### 3. Start development servers

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

### 4. Open the app

Frontend:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:3000
```

## Main Workflow

### Record and map a workflow

1. Start recording from the visual editor
2. Switch between action mode and annotation mode
3. Annotate elements into a selected data table and field
4. Stop recording
5. Click `映射工作流`
6. Import the generated workflow directly into the workspace
7. Execute the workflow and inspect extracted results in data tables

### Data annotation behavior

In annotation mode:

- Choose a target data table
- Choose an existing field from that table
- Choose the extraction attribute, such as `innerText`, `href`, or `src`

These choices are recorded and mapped into extract blocks automatically.

## Current Status

Implemented:

- Visual workflow editing
- Workflow execution
- Browser recording
- Action and annotation modes
- Recording-to-workflow mapping
- Data table integration
- Edge reconnection in the editor
- Ignoring isolated blocks during execution

In progress:

- Improve recording-to-workflow mapping accuracy
- Improve selector stability
- Improve extraction semantics for repeated annotations

Later:

- AI-assisted workflow optimization
- AI-powered page generation based on extracted data

## Safety Notes

Before publishing the repository, make sure these are not tracked:

- `backend/.env`
- `frontend/.env`
- `backend/chrome-data/`
- `.vscode/`
- `.codex/`
- `.kiro/`

## License

MIT
