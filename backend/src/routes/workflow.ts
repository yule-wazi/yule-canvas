import express from 'express';
import { ScriptParser } from '../services/ScriptParser';
import { BlockCompiler } from '../services/BlockCompiler';

const router = express.Router();
const parser = new ScriptParser();
const compiler = new BlockCompiler();

// 解析脚本为工作流
router.post('/parse', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: '缺少代码参数' });
    }

    const workflow = parser.parse(code);
    res.json({ workflow });
  } catch (error: any) {
    console.error('解析脚本失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 编译工作流为脚本
router.post('/compile', async (req, res) => {
  try {
    const { workflow } = req.body;
    
    console.log('收到编译请求:', JSON.stringify(req.body, null, 2));
    
    if (!workflow) {
      return res.status(400).json({ error: '缺少工作流参数' });
    }

    if (!workflow.blocks || !Array.isArray(workflow.blocks)) {
      return res.status(400).json({ error: 'workflow.blocks 必须是数组' });
    }

    if (!workflow.connections || !Array.isArray(workflow.connections)) {
      return res.status(400).json({ error: 'workflow.connections 必须是数组' });
    }

    const code = compiler.compile(workflow.blocks, workflow.connections);
    console.log('编译成功，代码长度:', code.length);
    res.json({ code });
  } catch (error: any) {
    console.error('编译工作流失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 执行工作流
router.post('/execute', async (req, res) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      return res.status(400).json({ error: '缺少工作流参数' });
    }

    // 先编译为代码
    const code = compiler.compile(workflow.blocks, workflow.connections);
    
    // 注意：工作流执行应该通过 Socket.io 进行，这里只返回编译后的代码
    // 实际执行由前端通过 socket 'execute-script' 事件触发
    res.json({ 
      success: true,
      code,
      message: '工作流编译成功，请通过Socket.io执行'
    });
  } catch (error: any) {
    console.error('执行工作流失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 保存工作流
router.post('/save', async (req, res) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      return res.status(400).json({ error: '缺少工作流参数' });
    }

    // 保存到localStorage（前端处理）或数据库
    const id = workflow.id || Date.now().toString();
    
    res.json({ id, message: '工作流保存成功' });
  } catch (error: any) {
    console.error('保存工作流失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 加载工作流
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 从localStorage（前端处理）或数据库加载
    // 这里返回示例数据
    res.json({ 
      workflow: {
        id,
        name: '示例工作流',
        description: '',
        blocks: [],
        connections: [],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
  } catch (error: any) {
    console.error('加载工作流失败:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
