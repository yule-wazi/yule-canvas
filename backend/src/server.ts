import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/api';
import workflowRoutes from './routes/workflow';
import { BrowserRecorder } from './services/BrowserRecorder';
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
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRoutes);
app.use('/api/workflow', workflowRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const workflowExecutors = new Map<string, WorkflowExecutor>();
const browserRecorders = new Map<string, BrowserRecorder>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('execute-workflow', async ({ workflowId, workflow }) => {
    console.log('Received workflow execution request:', workflowId);

    if (browserRecorders.has(socket.id)) {
      socket.emit('error', { message: '当前已有录制任务正在进行，请先停止录制后再执行工作流' });
      return;
    }

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

  socket.on('start-recording', async ({ startUrl }) => {
    if (workflowExecutors.has(socket.id)) {
      socket.emit('error', { message: '当前已有工作流正在执行，请先停止执行后再开始录制' });
      return;
    }

    if (browserRecorders.has(socket.id)) {
      socket.emit('recording-status', { state: 'started', message: '录制已在进行中', mode: 'action' });
      return;
    }

    const recorder = new BrowserRecorder({
      onStatus: (status) => {
        socket.emit('recording-status', status);
      },
      onEventsUpdated: (events) => {
        socket.emit('recording-events', events);
      },
      onLoopControl: (payload) => {
        socket.emit('recording-loop-control', payload);
      },
      onStop: () => {
        browserRecorders.delete(socket.id);
      }
    });

    browserRecorders.set(socket.id, recorder);

    try {
      await recorder.start({ startUrl });
    } catch (error: any) {
      browserRecorders.delete(socket.id);
      socket.emit('error', { message: error.message || '启动录制失败' });
    }
  });

  socket.on('stop-recording', async () => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      return;
    }

    await recorder.stop();
    browserRecorders.delete(socket.id);
  });

  socket.on('set-recording-mode', async ({ mode }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      socket.emit('error', { message: '录制尚未开始，无法切换模式' });
      return;
    }

    try {
      await recorder.setMode(mode === 'mark' ? 'mark' : 'action');
    } catch (error: any) {
      socket.emit('error', { message: error.message || '切换录制模式失败' });
    }
  });

  socket.on('set-recording-capture-enabled', async ({ enabled }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      return;
    }

    try {
      await recorder.setCaptureEnabled(Boolean(enabled));
    } catch (error: any) {
      socket.emit('error', { message: error.message || '切换录制采集状态失败' });
    }
  });

  socket.on('set-recording-loop-control', async ({ active, phase, title, hint, visibleEventIds }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      return;
    }

    try {
      await recorder.setLoopControl({
        active: Boolean(active),
        phase: phase === 'recording-first' || phase === 'transition' || phase === 'recording-last' ? phase : 'idle',
        title: typeof title === 'string' ? title : '',
        hint: typeof hint === 'string' ? hint : '',
        visibleEventIds: Array.isArray(visibleEventIds) ? visibleEventIds.filter((id) => typeof id === 'string') : []
      });
    } catch (error: any) {
      socket.emit('error', { message: error.message || '同步循环录制状态失败' });
    }
  });

  socket.on('confirm-record-mark', async ({ request, fieldName, fieldType, tableId, tableName, attribute, recordAction }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      socket.emit('error', { message: '录制尚未开始，无法保存字段标注' });
      return;
    }

    await recorder.confirmMark(request, {
      fieldName,
      fieldType,
      tableId,
      tableName,
      attribute,
      recordAction
    });
  });

  socket.on('set-recording-mark-config', async ({ selectedTableId, tables, disableRecordAction }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      return;
    }

    try {
      await recorder.setMarkConfig({
        selectedTableId: typeof selectedTableId === 'string' ? selectedTableId : '',
        disableRecordAction: Boolean(disableRecordAction),
        tables: Array.isArray(tables)
          ? tables
              .map((table: any) => ({
                id: typeof table?.id === 'string' ? table.id : '',
                name: typeof table?.name === 'string' ? table.name : '',
                fields: Array.isArray(table?.fields)
                  ? table.fields
                      .map((field: any) => ({
                        name: typeof field?.name === 'string' ? field.name : '',
                        type: typeof field?.type === 'string' ? field.type : 'text'
                      }))
                      .filter((field: any) => field.name)
                  : []
              }))
              .filter((table: any) => table.id && table.name)
          : []
      });
    } catch (error: any) {
      socket.emit('error', { message: error.message || '同步标注配置失败' });
    }
  });

  socket.on('delete-recording-event', async ({ eventId }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder || !eventId) {
      return;
    }

    await recorder.deleteEvent(eventId);
  });

  socket.on('clear-recording-events', async () => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      return;
    }

    await recorder.clearEvents();
  });

  socket.on('append-loop-capture-event', async ({ summary, firstSampleIds, lastSampleIds, loopCapture }) => {
    const recorder = browserRecorders.get(socket.id);
    if (!recorder) {
      return;
    }

    try {
      await recorder.appendLoopCaptureEvent({
        summary: typeof summary === 'string' ? summary : '',
        firstSampleIds: Array.isArray(firstSampleIds) ? firstSampleIds : [],
        lastSampleIds: Array.isArray(lastSampleIds) ? lastSampleIds : [],
        loopCapture: loopCapture && typeof loopCapture === 'object' ? loopCapture : null
      });
    } catch (error: any) {
      socket.emit('error', { message: error.message || '写入循环录制结果失败' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const workflowExecutor = workflowExecutors.get(socket.id);
    if (workflowExecutor) {
      workflowExecutor.stop();
      workflowExecutors.delete(socket.id);
    }

    const recorder = browserRecorders.get(socket.id);
    if (recorder) {
      recorder.stop();
      browserRecorders.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
