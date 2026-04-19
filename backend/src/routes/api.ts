import { Router } from 'express';
import axios from 'axios';
import { AIAdapterManager, WorkflowGenerationError } from '../services/AIAdapter';
import { generatePageWorkspace, generatePageWorkspaceStream } from '../services/PageBuilderAI';
import { runPageBuilderConversation } from '../services/PageBuilderConversationAI';
import { RecordingWorkflowMapper } from '../services/RecordingWorkflowMapper';

const router = Router();
const aiManager = new AIAdapterManager();
const pageBuilderTableSnapshots = new Map<string, {
  table: {
    id: string;
    name: string;
    columns: Array<{ key: string; type: string }>;
    rowCount: number;
    updatedAt?: number;
  };
  rows: Record<string, unknown>[];
  updatedAt: number;
}>();

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

router.post('/ai/generate-page-workspace', async (req, res) => {
  try {
    const { table, request, model = 'openrouter', options = {} } = req.body;

    if (!table || !request) {
      return res.status(400).json({
        success: false,
        summary: '',
        files: [],
        error: 'table and request are required.'
      });
    }

    const result = await generatePageWorkspace(aiManager, {
      table,
      request,
      model,
      options
    });

    return res.json({
      success: true,
      summary: result.summary,
      files: result.files,
      error: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      summary: '',
      files: [],
      error: error.message || 'AI page workspace generation failed.'
    });
  }
});

router.post('/ai/generate-page-workspace-stream', async (req, res) => {
  try {
    const { table, request, model = 'openrouter', options = {} } = req.body;

    if (!table || !request) {
      return res.status(400).json({
        success: false,
        error: 'table and request are required.'
      });
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    res.write(`${JSON.stringify({ type: 'start' })}\n`);

    const result = await generatePageWorkspaceStream(aiManager, {
      table,
      request,
      model,
      options
    }, {
      onFileDone: (file) => {
        res.write(`${JSON.stringify({ type: 'file_done', file })}\n`);
      }
    });

    res.write(`${JSON.stringify({
      type: 'done',
      summary: result.summary,
      files: result.files
    })}\n`);

    return res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error.message || 'AI page workspace generation failed.'
      });
    }

    res.write(`${JSON.stringify({
      type: 'error',
      error: error.message || 'AI page workspace generation failed.'
    })}\n`);
    return res.end();
  }
});

router.post('/ai/page-builder/conversation-stream', async (req, res) => {
  try {
    const {
      table,
      request,
      conversation,
      workspace,
      model = 'openrouter',
      options = {}
    } = req.body || {};

    if (!table || !request || !conversation || !workspace) {
      return res.status(400).json({
        success: false,
        error: 'table, request, conversation, and workspace are required.'
      });
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`${JSON.stringify({ type: 'start' })}\n`);

    const result = await runPageBuilderConversation(aiManager, {
      table,
      request,
      conversation,
      workspace,
      model,
      options
    }, {
      onStatus: (status) => {
        res.write(`${JSON.stringify({
          type: 'status',
          ...status
        })}\n`);
      },
      onFileOperation: (operation) => {
        res.write(`${JSON.stringify({
          type: 'file_operation',
          ...operation
        })}\n`);
      },
      onAssistant: (message) => {
        res.write(`${JSON.stringify({
          type: 'assistant',
          message
        })}\n`);
      }
    });

    res.write(`${JSON.stringify({
      type: 'done',
      intent: result.intent,
      summary: result.summary,
      message: result.message,
      files: result.files
    })}\n`);

    return res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error.message || 'AI page conversation failed.'
      });
    }

    res.write(`${JSON.stringify({
      type: 'error',
      error: error.message || 'AI page conversation failed.'
    })}\n`);
    return res.end();
  }
});

router.post('/page-builder/table-snapshots', (req, res) => {
  try {
    const { tableId, snapshot } = req.body || {};

    if (!tableId || typeof tableId !== 'string' || !snapshot || typeof snapshot !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'tableId and snapshot are required.'
      });
    }

    const table = (snapshot as any).table || {};
    const rows = Array.isArray((snapshot as any).rows) ? (snapshot as any).rows : [];

    pageBuilderTableSnapshots.set(tableId, {
      table: {
        id: typeof table.id === 'string' ? table.id : tableId,
        name: typeof table.name === 'string' ? table.name : 'Selected Table',
        columns: Array.isArray(table.columns) ? table.columns : [],
        rowCount: typeof table.rowCount === 'number' ? table.rowCount : rows.length,
        updatedAt: typeof table.updatedAt === 'number' ? table.updatedAt : Date.now()
      },
      rows,
      updatedAt: Date.now()
    });

    return res.json({
      success: true,
      updatedAt: Date.now(),
      error: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cache table snapshot.'
    });
  }
});

router.get('/page-builder/table-snapshots/:tableId', (req, res) => {
  const snapshot = pageBuilderTableSnapshots.get(req.params.tableId);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (!snapshot) {
    return res.status(404).json({
      success: false,
      error: 'Table snapshot not found.'
    });
  }

  return res.json({
    table: snapshot.table,
    rows: snapshot.rows,
    updatedAt: snapshot.updatedAt
  });
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
