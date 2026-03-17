import { Router } from 'express';
import { AIAdapterManager } from '../services/AIAdapter';

const router = Router();
const aiManager = new AIAdapterManager();

// 获取可用的AI模型列表
router.get('/ai/models', (req, res) => {
  const models = aiManager.getAllAdapters().map(adapter => ({
    id: adapter.id,
    name: adapter.name
  }));
  res.json({ success: true, models });
});

// AI脚本生成接口
router.post('/ai/generate', async (req, res) => {
  try {
    const { prompt, model = 'qwen', options = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        code: null,
        error: '请提供需求描述'
      });
    }

    const code = await aiManager.generateScript(model, prompt, options);
    
    res.json({
      success: true,
      code,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      code: null,
      error: error.message
    });
  }
});

export default router;
