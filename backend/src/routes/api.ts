import { Router } from 'express';
import axios from 'axios';
import { AIAdapterManager, WorkflowGenerationError } from '../services/AIAdapter';
import { PageBuilderPreviewRenderer } from '../services/PageBuilderPreviewRenderer';
import { RecordingWorkflowMapper } from '../services/RecordingWorkflowMapper';

const router = Router();
const aiManager = new AIAdapterManager();

const PAGE_BUILDER_SYSTEM_PROMPT = `You generate page-builder project files for a constrained Vue page workspace.
Output rules:
1. Output JSON only. No markdown, no code fences, no explanation outside JSON.
2. Root keys must be assistantMessage, entryPath, files.
3. assistantMessage is a short natural-language summary for the user.
4. entryPath must be "app/PageView.vue".
5. files must contain only these project paths:
   - app/PageView.vue
   - components/sections/HeroSection.vue
   - components/sections/FeedSection.vue
   - components/sections/FooterSection.vue
   - data/bindings.ts
   - data/tableAdapter.ts
   - spec/page-spec.json
   - styles/page.css
6. Use Vue 3 <script setup lang="ts"> for .vue files.
7. Do not import any third-party packages.
8. Generated code must stay compatible with a simple in-browser preview runtime.
9. tableAdapter.ts must expose stable helper functions for reading row fields and a documented fetch placeholder for future API integration.
10. The page should be complete and visually intentional, not a placeholder.`;

function sanitizeGeneratedPagePayload(payload: any) {
  const allowedPaths = new Set([
    'app/PageView.vue',
    'components/sections/HeroSection.vue',
    'components/sections/FeedSection.vue',
    'components/sections/FooterSection.vue',
    'data/bindings.ts',
    'data/tableAdapter.ts',
    'spec/page-spec.json',
    'styles/page.css'
  ]);

  const files = Array.isArray(payload?.files)
    ? payload.files
        .filter((file: any) => allowedPaths.has(file?.path))
        .map((file: any) => ({
          path: String(file.path),
          content: String(file.content || '')
        }))
    : [];

  if (!files.length) {
    throw new Error('AI did not return any usable page files.');
  }

  return {
    assistantMessage: typeof payload?.assistantMessage === 'string' ? payload.assistantMessage : '',
    entryPath: 'app/PageView.vue',
    files
  };
}

router.get('/ai/models', (_req, res) => {
  const models = aiManager.getAllAdapters().map(adapter => ({
    id: adapter.id,
    name: adapter.name
  }));

  res.json({ success: true, models });
});

router.post('/ai/normalize-recording', (req, res) => {
  try {
    const semanticRecording = aiManager.buildSemanticRecording(req.body);
    res.json({
      success: true,
      semanticRecording,
      error: null
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      semanticRecording: null,
      error: error.message
    });
  }
});

router.post('/recording/map-workflow', (req, res) => {
  try {
    const { recording } = req.body;

    if (!recording) {
      return res.status(400).json({
        success: false,
        workflow: null,
        error: '请提供录制记录'
      });
    }

    const workflow = RecordingWorkflowMapper.map(recording);

    return res.json({
      success: true,
      workflow,
      error: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      workflow: null,
      error: error.message
    });
  }
});

router.post('/ai/generate-workflow', async (req, res) => {
  try {
    const { prompt, model = 'openrouter', options = {} } = req.body;

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        workflow: null,
        error: '请提供需求描述'
      });
    }

    const workflow = await aiManager.generateWorkflow(model, String(prompt), options);

    return res.json({
      success: true,
      workflow,
      error: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      workflow: null,
      error: error.message
    });
  }
});

router.post('/ai/generate-workflow-from-recording', async (req, res) => {
  try {
    const { recording, model = 'openrouter', options = {} } = req.body;

    if (!recording) {
      return res.status(400).json({
        success: false,
        workflow: null,
        semanticRecording: null,
        error: '请提供录制记录'
      });
    }

    const providerTimeoutMs = Math.min(Number(options.timeoutMs) || 90000, 90000);

    const result = await aiManager.generateWorkflowFromRecording(model, recording, {
      ...options,
      useTools: model === 'openrouter',
      timeoutMs: providerTimeoutMs
    });

    return res.json({
      success: true,
      workflow: result.workflow,
      semanticRecording: result.semanticRecording,
      error: null
    });
  } catch (error: any) {
    const statusCode = error instanceof WorkflowGenerationError ? error.statusCode : 500;
    return res.status(statusCode).json({
      success: false,
      workflow: null,
      semanticRecording: null,
      error: error.message,
      stage: error instanceof WorkflowGenerationError ? error.stage : 'provider',
      errors: error instanceof WorkflowGenerationError ? error.errors : [],
      warnings: error instanceof WorkflowGenerationError ? error.warnings : [],
      rawPreview: error instanceof WorkflowGenerationError ? error.rawPreview || null : null
    });
  }
});

router.post('/ai/preview-generate-workflow-from-recording', (req, res) => {
  try {
    const { recording, model = 'openrouter', options = {} } = req.body;

    if (!recording) {
      return res.status(400).json({
        success: false,
        preview: null,
        error: '璇锋彁渚涘綍鍒惰褰?'
      });
    }

    const preview = aiManager.previewWorkflowFromRecordingRequest(model, recording, {
      ...options,
      useTools: model === 'openrouter'
    });

    return res.json({
      success: true,
      preview,
      error: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      preview: null,
      error: error.message
    });
  }
});

router.post('/ai/generate-default', async (req, res) => {
  try {
    const { prompt, model = 'openrouter', options = {} } = req.body;

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        workflow: null,
        error: '请提供需求描述'
      });
    }

    const workflow = await aiManager.generateWorkflow(model, String(prompt), options);

    return res.json({
      success: true,
      workflow,
      error: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      workflow: null,
      error: error.message
    });
  }
});

router.post('/page-builder/render-preview', (req, res) => {
  try {
    const { files, entryPath, title } = req.body || {};

    const html = PageBuilderPreviewRenderer.render({
      files: Array.isArray(files) ? files : [],
      entryPath: typeof entryPath === 'string' ? entryPath : undefined,
      title: typeof title === 'string' ? title : undefined
    });

    return res.json({
      success: true,
      html,
      error: null
    });
  } catch (error: any) {
    return res.json({
      success: false,
      html: PageBuilderPreviewRenderer.renderErrorDocument(error.message || 'Failed to render page builder preview.'),
      error: error.message || 'Failed to render page builder preview.'
    });
  }
});

router.post('/page-builder/generate', async (req, res) => {
  try {
    const {
      prompt,
      table,
      model = 'openrouter',
      options = {}
    } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        project: null,
        error: 'Prompt is required.'
      });
    }

    if (!table || !Array.isArray(table.columns)) {
      return res.status(400).json({
        success: false,
        project: null,
        error: 'Table schema is required.'
      });
    }

    const userPrompt = `User request:
${String(prompt).trim()}

Data source:
${JSON.stringify(
  {
    id: table.id,
    name: table.name,
    columns: table.columns,
    sampleRows: Array.isArray(table.rows) ? table.rows.slice(0, 6) : []
  },
  null,
  2
)}

Generate the complete project files for this page-builder workspace.`;

    const raw = await aiManager.generateText(model, PAGE_BUILDER_SYSTEM_PROMPT, userPrompt, {
      ...options,
      maxTokens: options.maxTokens ?? 5000,
      temperature: options.temperature ?? 0.4
    });

    const payload = sanitizeGeneratedPagePayload(JSON.parse(raw));

    return res.json({
      success: true,
      project: payload,
      error: null
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      project: null,
      error: error.message || 'Failed to generate page project.'
    });
  }
});

router.get('/proxy/video', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: '请提供视频 URL'
      });
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: new URL(url).origin,
        Accept: 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Range: req.headers.range || 'bytes=0-'
      },
      timeout: 30000
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
      res.status(206);
    }

    response.data.pipe(res);
  } catch (error: any) {
    console.error('视频代理错误:', error.message);
    return res.status(500).json({
      success: false,
      error: `视频加载失败: ${error.message}`
    });
  }
});

export default router;
