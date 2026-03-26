<template>
  <div class="json-test-page">
    <div class="test-header">
      <h2>🧪 工作流 JSON 测试</h2>
      <p>直接输入 Workflow JSON 格式进行测试</p>
    </div>

    <div class="test-content">
      <div class="json-editor">
        <div class="editor-header">
          <h3>Workflow JSON</h3>
          <div class="editor-actions">
            <button @click="loadExample" class="btn-secondary">📋 加载示例</button>
            <button @click="formatJson" class="btn-secondary">✨ 格式化</button>
            <button @click="clearJson" class="btn-secondary">🗑️ 清空</button>
          </div>
        </div>
        <textarea 
          v-model="jsonInput" 
          placeholder="粘贴 Workflow JSON..."
          class="json-textarea"
        ></textarea>
        <div v-if="jsonError" class="json-error">
          ❌ JSON 格式错误: {{ jsonError }}
        </div>
      </div>

      <div class="execution-section">
        <button 
          @click="executeJson" 
          :disabled="executing || !jsonInput.trim()"
          class="btn-execute"
        >
          {{ executing ? '执行中...' : '▶️ 执行工作流' }}
        </button>

        <div class="logs-container">
          <h4>执行日志</h4>
          <div class="logs" ref="logsRef">
            <div 
              v-for="(log, index) in logs" 
              :key="index"
              class="log-entry"
            >
              {{ log }}
            </div>
            <div v-if="logs.length === 0" class="no-logs">
              暂无日志
            </div>
          </div>
        </div>

        <div v-if="result" class="result-container">
          <h4>执行结果</h4>
          <pre class="result-content">{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import socketClient from '../services/socket';

const jsonInput = ref('');
const jsonError = ref('');
const executing = ref(false);
const logs = ref<string[]>([]);
const result = ref<any>(null);
const logsRef = ref<HTMLElement | null>(null);

const loadExample = () => {
  jsonInput.value = JSON.stringify({
    blocks: [
      {
        id: 'block-1',
        type: 'navigate',
        label: '访问页面',
        category: 'browser',
        position: { x: 100, y: 200 },
        data: {
          url: 'https://example.com',
          waitUntil: 'domcontentloaded',
          timeout: 60000
        },
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [{ id: 'out', name: '输出', type: 'flow' }]
      },
      {
        id: 'loop-1',
        type: 'loop',
        label: '循环',
        category: 'logic',
        position: { x: 350, y: 350 },
        data: {
          mode: 'count',
          count: 3,
          useVariable: true,
          variableName: 'index'
        },
        inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
        outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
      },
      {
        id: 'block-2',
        type: 'log',
        label: '日志输出',
        category: 'browser',
        position: { x: 600, y: 200 },
        data: {
          message: '循环第 {{index}} 次'
        },
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [{ id: 'out', name: '输出', type: 'flow' }]
      }
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'block-1',
        sourceHandle: 'out',
        target: 'loop-1',
        targetHandle: 'loop-end'
      },
      {
        id: 'conn-2',
        source: 'loop-1',
        sourceHandle: 'loop-start',
        target: 'block-2',
        targetHandle: 'in'
      },
      {
        id: 'conn-3',
        source: 'block-2',
        sourceHandle: 'out',
        target: 'loop-1',
        targetHandle: 'loop-end'
      }
    ],
    variables: {}
  }, null, 2);
  jsonError.value = '';
};

const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonInput.value);
    jsonInput.value = JSON.stringify(parsed, null, 2);
    jsonError.value = '';
  } catch (error: any) {
    jsonError.value = error.message;
  }
};

const clearJson = () => {
  jsonInput.value = '';
  jsonError.value = '';
  logs.value = [];
  result.value = null;
};

const executeJson = () => {
  try {
    // 验证 JSON 格式
    const workflow = JSON.parse(jsonInput.value);
    jsonError.value = '';

    // 清空日志和结果
    logs.value = [];
    result.value = null;
    executing.value = true;

    // 连接 Socket
    socketClient.connect();
    socketClient.offAll();

    // 监听日志
    socketClient.onLog((log) => {
      logs.value.push(log.message);
      scrollToBottom();
    });

    // 监听完成
    socketClient.onComplete((res) => {
      executing.value = false;
      result.value = res.data;
      
      if (res.success) {
        logs.value.push('✅ 执行成功');
      } else {
        logs.value.push(`❌ 执行失败: ${res.error}`);
      }

      socketClient.offAll();
      scrollToBottom();
    });

    // 监听错误
    socketClient.onError((error) => {
      executing.value = false;
      logs.value.push(`❌ 错误: ${error.message}`);
      socketClient.offAll();
      scrollToBottom();
    });

    // 发送执行请求
    socketClient.executeWorkflow('json-test', workflow);
  } catch (error: any) {
    jsonError.value = error.message;
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (logsRef.value) {
    logsRef.value.scrollTop = logsRef.value.scrollHeight;
  }
};
</script>

<style scoped>
.json-test-page {
  padding: 2rem;
  background: #0d1117;
  min-height: 100vh;
  color: #c9d1d9;
}

.test-header {
  margin-bottom: 2rem;
}

.test-header h2 {
  margin: 0 0 0.5rem 0;
  color: #58a6ff;
}

.test-header p {
  margin: 0;
  color: #8b949e;
}

.test-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.json-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-header h3 {
  margin: 0;
  color: #58a6ff;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.json-textarea {
  width: 100%;
  height: 500px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  color: #c9d1d9;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  resize: vertical;
}

.json-textarea:focus {
  outline: none;
  border-color: #58a6ff;
}

.json-error {
  padding: 0.75rem;
  background: #da3633;
  color: white;
  border-radius: 6px;
  font-size: 0.9rem;
}

.execution-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-execute {
  padding: 1rem 2rem;
  background: #238636;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-execute:hover:not(:disabled) {
  background: #2ea043;
}

.btn-execute:disabled {
  background: #21262d;
  cursor: not-allowed;
  color: #8b949e;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-secondary:hover {
  background: #30363d;
}

.logs-container {
  flex: 1;
}

.logs-container h4 {
  margin: 0 0 0.5rem 0;
  color: #58a6ff;
}

.logs {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
}

.log-entry {
  margin-bottom: 0.5rem;
  line-height: 1.5;
  color: #c9d1d9;
}

.no-logs {
  color: #8b949e;
  text-align: center;
  padding: 2rem;
}

.result-container {
  margin-top: 1rem;
}

.result-container h4 {
  margin: 0 0 0.5rem 0;
  color: #58a6ff;
}

.result-content {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  max-height: 300px;
  overflow: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  color: #c9d1d9;
  margin: 0;
}
</style>
