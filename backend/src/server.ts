import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/api';
import workflowRoutes from './routes/workflow';
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

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

app.use('/api', apiRoutes);
app.use('/api/workflow', workflowRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const workflowExecutors = new Map<string, WorkflowExecutor>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('execute-workflow', async ({ workflowId, workflow }) => {
    console.log('Received workflow execution request:', workflowId);

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
      socket.emit('log', { timestamp: Date.now(), message: '开始执行工作流...' });
      const result = await executor.executeWorkflow(workflow);
      socket.emit('complete', result);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    } finally {
      workflowExecutors.delete(socket.id);
    }
  });

  socket.on('stop-execution', async () => {
    const workflowExecutor = workflowExecutors.get(socket.id);
    if (workflowExecutor) {
      await workflowExecutor.stop();
      workflowExecutors.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const workflowExecutor = workflowExecutors.get(socket.id);
    if (workflowExecutor) {
      workflowExecutor.stop();
      workflowExecutors.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
