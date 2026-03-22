import { Router } from 'express';
import { AIAdapterManager } from '../services/AIAdapter';
import axios from 'axios';

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

// 视频代理接口 - 绕过防盗链限制
router.get('/proxy/video', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: '请提供视频URL'
      });
    }

    // 发起请求，模拟浏览器访问
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': new URL(url).origin,
        'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Range': req.headers.range || 'bytes=0-'
      },
      timeout: 30000
    });

    // 设置响应头
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
      res.status(206); // Partial Content
    }

    // 流式传输视频数据
    response.data.pipe(res);
  } catch (error: any) {
    console.error('视频代理错误:', error.message);
    res.status(500).json({
      success: false,
      error: '视频加载失败: ' + error.message
    });
  }
});

export default router;
