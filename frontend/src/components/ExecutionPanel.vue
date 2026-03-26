<template>
  <div class="execution-panel">
    <div class="controls">
      <button 
        @click="execute" 
        :disabled="executing || (!code && !workflow)"
        class="execute-btn"
      >
        {{ executing ? '执行中...' : (workflow ? '执行工作流' : '执行脚本') }}
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
      
      <div class="save-toggle">
        <label class="toggle-label">
          <input 
            type="checkbox" 
            v-model="autoSaveData"
            class="toggle-checkbox"
          />
          <span class="toggle-text">自动保存数据</span>
        </label>
      </div>
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
  code?: string;
  workflow?: any;
  scriptId?: string;
  workflowId?: string;
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
const getExecutionPayload = (res: any) => res?.data ?? res?.result ?? null;
const autoSaveData = ref(false); // 默认关闭自动保存

const execute = () => {
  if (!props.code && !props.workflow) return;

  executing.value = true;
  logs.value = [];
  result.value = null;
  progress.value = 0;
  progressMessage.value = '';

  // 连接Socket
  socketClient.connect();
  socketClient.offAll();

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
    result.value = getExecutionPayload(res);
    
    if (res.success) {
      logs.value.push({
        timestamp: Date.now(),
        message: `✅ 执行成功${res.duration ? `，耗时 ${(res.duration / 1000).toFixed(2)}秒` : ''}`
      });
      
      // 根据开关决定是否保存执行结果
      if (autoSaveData.value) {
        saveExecutionResult(res);
        logs.value.push({
          timestamp: Date.now(),
          message: '💾 数据已保存到本地存储'
        });
      }
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
  if (props.workflow) {
    // 执行工作流 JSON
    socketClient.executeWorkflow(props.workflowId || 'temp', props.workflow);
  } else if (props.code) {
    // 执行代码字符串
    socketClient.executeScript(props.scriptId || 'temp', props.code);
  }
};

const stop = () => {
  socketClient.stopExecution();
  socketClient.offAll();
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
    scriptId: props.scriptId || props.workflowId || 'temp',
    data: getExecutionPayload(res),
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

.save-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #238636;
}

.toggle-text {
  color: #c9d1d9;
  font-size: 0.9rem;
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
