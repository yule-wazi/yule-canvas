import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import workflowRoutes from './routes/workflow';
import { PlaywrightExecutor } from './services/PlaywrightExecutor';
import { WorkflowExecutor } from './services/WorkflowExecutor';

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173'
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 中间件
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// API路由
app.use('/api', apiRoutes);
app.use('/api/workflow', workflowRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Socket.io连接处理
const executors = new Map<string, PlaywrightExecutor>();
const workflowExecutors = new Map<string, WorkflowExecutor>();

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);

  // 处理工作流执行请求（新方法）
  socket.on('execute-workflow', async ({ workflowId, workflow }) => {
    console.log('收到工作流执行请求:', workflowId);
    
    const executor = new WorkflowExecutor({
      onLog: (entry) => {
        socket.emit('log', entry);
      },
      onSaveData: (data) => {
        socket.emit('saveData', data);
      }
    });
    workflowExecutors.set(socket.id, executor);

    try {
      // 发送开始事件
      socket.emit('log', { timestamp: Date.now(), message: '开始执行工作流...' });

      // 执行工作流
      const result = await executor.executeWorkflow(workflow);

      // 发送完成事件
      socket.emit('complete', result);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    } finally {
      workflowExecutors.delete(socket.id);
    }
  });

  // 处理脚本执行请求（旧方法，保持向后兼容）
  socket.on('execute-script', async ({ scriptId, code }) => {
    console.log('收到执行请求:', scriptId);
    
    const executor = new PlaywrightExecutor(socket.id, io);
    executors.set(socket.id, executor);

    try {
      const result = await executor.execute(code);
      socket.emit('complete', result);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    } finally {
      executors.delete(socket.id);
    }
  });

  // 处理停止执行请求
  socket.on('stop-execution', async () => {
    // 停止旧的执行器
    const executor = executors.get(socket.id);
    if (executor) {
      await executor.stop();
      executors.delete(socket.id);
    }

    // 停止新的工作流执行器
    const workflowExecutor = workflowExecutors.get(socket.id);
    if (workflowExecutor) {
      await workflowExecutor.stop();
      workflowExecutors.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('客户端断开:', socket.id);
    
    const executor = executors.get(socket.id);
    if (executor) {
      executor.stop();
      executors.delete(socket.id);
    }

    const workflowExecutor = workflowExecutors.get(socket.id);
    if (workflowExecutor) {
      workflowExecutor.stop();
      workflowExecutors.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
