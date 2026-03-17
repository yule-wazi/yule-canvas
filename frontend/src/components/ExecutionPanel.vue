<template>
  <div class="execution-panel">
    <div class="controls">
      <button 
        @click="execute" 
        :disabled="executing || !code"
        class="execute-btn"
      >
        {{ executing ? '执行中...' : '执行脚本' }}
      </button>
      <button 
        @click="stop" 
        :disabled="!executing"
        class="stop-btn"
      >
        停止
      </button>
      <button 
        @click="clearLogs" 
        class="clear-btn"
      >
        清空日志
      </button>
    </div>

    <div v-if="progress > 0" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      <span class="progress-text">{{ progressMessage }} ({{ progress }}%)</span>
    </div>

    <div class="logs-container">
      <h4>执行日志</h4>
      <div class="logs" ref="logsRef">
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          class="log-entry"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="no-logs">
          暂无日志
        </div>
      </div>
    </div>

    <div v-if="result" class="result-container">
      <h4>执行结果</h4>
      <div class="result-content">
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import socketClient from '../services/socket';
import storageManager, { type ScrapedData } from '../services/storage';

interface Props {
  code: string;
  scriptId?: string;
}

interface Log {
  timestamp: number;
  message: string;
}

const props = defineProps<Props>();

const executing = ref(false);
const logs = ref<Log[]>([]);
const result = ref<any>(null);
const progress = ref(0);
const progressMessage = ref('');
const logsRef = ref<HTMLElement | null>(null);

const execute = () => {
  if (!props.code) return;

  executing.value = true;
  logs.value = [];
  result.value = null;
  progress.value = 0;
  progressMessage.value = '';

  // 连接Socket
  socketClient.connect();

  // 监听事件
  socketClient.onLog((log) => {
    logs.value.push(log);
    scrollToBottom();
  });

  socketClient.onProgress((prog) => {
    progress.value = prog.percent;
    progressMessage.value = prog.message;
  });

  socketClient.onComplete((res) => {
    executing.value = false;
    result.value = res.data;
    
    if (res.success) {
      logs.value.push({
        timestamp: Date.now(),
        message: `✅ 执行成功，耗时 ${(res.duration / 1000).toFixed(2)}秒`
      });
      
      // 保存执行结果到LocalStorage
      saveExecutionResult(res);
    } else {
      logs.value.push({
        timestamp: Date.now(),
        message: `❌ 执行失败: ${res.error}`
      });
    }
    
    scrollToBottom();
  });

  socketClient.onError((error) => {
    executing.value = false;
    logs.value.push({
      timestamp: Date.now(),
      message: `❌ 错误: ${error.message}`
    });
    scrollToBottom();
  });

  // 发送执行请求
  socketClient.executeScript(props.scriptId || 'temp', props.code);
};

const stop = () => {
  socketClient.disconnect();
  executing.value = false;
  logs.value.push({
    timestamp: Date.now(),
    message: '⚠️ 执行已停止'
  });
};

const clearLogs = () => {
  logs.value = [];
  result.value = null;
  progress.value = 0;
  progressMessage.value = '';
};

const scrollToBottom = async () => {
  await nextTick();
  if (logsRef.value) {
    logsRef.value.scrollTop = logsRef.value.scrollHeight;
  }
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour12: false });
};

const saveExecutionResult = (res: any) => {
  const scrapedData: ScrapedData = {
    id: Date.now().toString(),
    scriptId: props.scriptId || 'temp',
    data: res.data,
    status: res.success ? 'success' : 'failed',
    executedAt: Date.now(),
    duration: res.duration,
    logs: logs.value.map(log => log.message)
  };
  
  storageManager.saveData(scrapedData);
};
</script>

<style scoped>
.execution-panel {
  background: #161b22;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #30363d;
}

.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.execute-btn,
.stop-btn,
.clear-btn {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s;
}

.execute-btn {
  background: #238636;
  color: white;
}

.execute-btn:hover:not(:disabled) {
  background: #2ea043;
}

.execute-btn:disabled {
  background: #21262d;
  cursor: not-allowed;
  color: #8b949e;
}

.stop-btn {
  background: #da3633;
  color: white;
}

.stop-btn:hover:not(:disabled) {
  background: #f85149;
}

.stop-btn:disabled {
  background: #21262d;
  cursor: not-allowed;
  color: #8b949e;
}

.clear-btn {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
}

.clear-btn:hover {
  background: #30363d;
}

.progress-bar {
  position: relative;
  height: 30px;
  background: #21262d;
  border-radius: 6px;
  margin-bottom: 1rem;
  overflow: hidden;
  border: 1px solid #30363d;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636, #2ea043);
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.85rem;
  font-weight: 500;
  color: #c9d1d9;
}

.logs-container {
  margin-top: 1.5rem;
}

h4 {
  margin-bottom: 0.5rem;
  color: #58a6ff;
}

.logs {
  background: #0d1117;
  color: #c9d1d9;
  padding: 1rem;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  border: 1px solid #30363d;
}

.log-entry {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.log-time {
  color: #8b949e;
  margin-right: 0.5rem;
}

.log-message {
  color: #c9d1d9;
}

.no-logs {
  color: #8b949e;
  text-align: center;
  padding: 2rem;
}

.result-container {
  margin-top: 1.5rem;
}

.result-content {
  background: #0d1117;
  padding: 1rem;
  border-radius: 6px;
  max-height: 300px;
  overflow: auto;
  border: 1px solid #30363d;
}

.result-content pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  color: #c9d1d9;
}
</style>
