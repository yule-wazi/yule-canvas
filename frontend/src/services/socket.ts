import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private url: string;

  constructor() {
    this.url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
  }

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(this.url, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Socket连接成功:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket断开连接');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket连接错误:', error);
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }

  onLog(callback: (log: { timestamp: number; message: string }) => void) {
    this.socket?.on('log', callback);
  }

  onProgress(callback: (progress: { percent: number; message: string }) => void) {
    this.socket?.on('progress', callback);
  }

  onComplete(callback: (result: any) => void) {
    this.socket?.on('complete', callback);
  }

  onError(callback: (error: { message: string }) => void) {
    this.socket?.on('error', callback);
  }

  // 通用的事件监听方法
  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  // 通用的事件取消监听方法
  off(event: string) {
    this.socket?.off(event);
  }

  executeWorkflow(workflowId: string, workflow: any) {
    this.socket?.emit('execute-workflow', { workflowId, workflow });
  }

  stopExecution() {
    this.socket?.emit('stop-execution');
  }

  startRecording(startUrl?: string) {
    this.socket?.emit('start-recording', { startUrl });
  }

  stopRecording() {
    this.socket?.emit('stop-recording');
  }

  setRecordingMode(mode: 'action' | 'mark') {
    this.socket?.emit('set-recording-mode', { mode });
  }

  setRecordingCaptureEnabled(enabled: boolean) {
    this.socket?.emit('set-recording-capture-enabled', { enabled });
  }

  setRecordingMarkConfig(config: {
    selectedTableId: string;
    disableRecordAction?: boolean;
    tables: Array<{
      id: string;
      name: string;
      fields: Array<{ name: string; type: string }>;
    }>;
  }) {
    this.socket?.emit('set-recording-mark-config', config);
  }

  confirmRecordMark(request: any, payload: {
    fieldName: string;
    fieldType: string;
    tableId: string;
    tableName: string;
    attribute: string;
  }) {
    this.socket?.emit('confirm-record-mark', { request, ...payload });
  }

  deleteRecordingEvent(eventId: string) {
    this.socket?.emit('delete-recording-event', { eventId });
  }

  clearRecordingEvents() {
    this.socket?.emit('clear-recording-events');
  }

  appendLoopCaptureEvent(payload: {
    summary: string;
    firstSampleIds: string[];
    lastSampleIds: string[];
    loopCapture: any;
  }) {
    this.socket?.emit('append-loop-capture-event', payload);
  }

  onRecordingStatus(callback: (status: { state: string; message: string; mode?: 'action' | 'mark' }) => void) {
    this.socket?.on('recording-status', callback);
  }

  onRecordingEvent(callback: (event: any) => void) {
    this.socket?.on('recording-event', callback);
  }

  onRecordingEvents(callback: (events: any[]) => void) {
    this.socket?.on('recording-events', callback);
  }

  offAll() {
    this.socket?.off('log');
    this.socket?.off('progress');
    this.socket?.off('complete');
    this.socket?.off('error');
    this.socket?.off('saveData');
    this.socket?.off('recording-status');
    this.socket?.off('recording-event');
    this.socket?.off('recording-events');
  }
}

const socketClient = new SocketClient();

export default socketClient;
export { socketClient as socketService };
