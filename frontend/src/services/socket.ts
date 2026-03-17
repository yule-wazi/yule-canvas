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

  executeScript(scriptId: string, code: string) {
    this.socket?.emit('execute-script', { scriptId, code });
  }

  offAll() {
    this.socket?.off('log');
    this.socket?.off('progress');
    this.socket?.off('complete');
    this.socket?.off('error');
  }
}

export default new SocketClient();
