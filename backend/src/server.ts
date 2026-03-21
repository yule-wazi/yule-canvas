import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import workflowRoutes from './routes/workflow';
import { PlaywrightExecutor } from './services/PlaywrightExecutor';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors());
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

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);

  // 处理脚本执行请求
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
    const executor = executors.get(socket.id);
    if (executor) {
      await executor.stop();
      executors.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('客户端断开:', socket.id);
    const executor = executors.get(socket.id);
    if (executor) {
      executor.stop();
      executors.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
