<template>
  <div class="property-form">
    <div class="form-group">
      <label>
        <input
          v-model="localData.multiple"
          type="checkbox"
          @change="emitUpdate"
        />
        提取多个元素
      </label>
      <small>选中后提取所有匹配元素，否则只提取第一个。</small>
    </div>

    <div class="form-group">
      <label>等待超时（毫秒）</label>
      <input
        v-model.number="localData.timeout"
        type="number"
        min="1000"
        step="1000"
        @input="emitUpdate"
      />
      <small>等待元素出现的最长时间。</small>
    </div>

    <div class="form-group">
      <label>保存到数据表</label>
      <select v-model="localData.saveToTable" @change="emitUpdate">
        <option value="">不保存</option>
        <option v-for="table in dataTables" :key="table.id" :value="table.id">
          {{ table.name }}
        </option>
      </select>
      <small>选择要保存数据的数据表。</small>
    </div>

    <div class="form-group" v-if="localData.saveToTable && !localData.multiple">
      <label>合并键模板（可选）</label>
      <input
        v-model="localData.mergeKey"
        type="text"
        placeholder="例如: {{index}} 或 page-{{page}}-item-{{index}}"
        @input="emitUpdate"
      />
      <small>支持变量模板。系统会自动附加当前循环作用域，避免跨页或外层循环时发生冲突。</small>
    </div>

    <div class="extractions-section">
      <div class="section-header">
        <h4>提取项</h4>
      </div>

      <div v-for="(extraction, index) in localData.extractions" :key="index" class="extraction-item">
        <div class="extraction-header">
          <span class="extraction-number">#{{ index + 1 }}</span>
          <button @click="removeExtraction(index)" class="btn-icon-small">×</button>
        </div>

        <div class="form-group">
          <label>CSS 选择器</label>
          <textarea
            v-model="extraction.selector"
            placeholder="例如: .product-name"
            rows="3"
            @input="emitUpdate"
          ></textarea>
        </div>

        <div class="form-group">
          <label>提取属性</label>
          <select v-model="extraction.attribute" @change="emitUpdate">
            <option value="text">文本内容 (textContent)</option>
            <option value="innerText">显示文本 (innerText)</option>
            <option value="innerHTML">HTML 内容</option>
            <option value="href">链接地址 (href)</option>
            <option value="src">图片/资源地址 (src)</option>
            <option value="backgroundImage">背景图 (background-image)</option>
            <option value="poster">视频封面 (poster)</option>
            <option value="value">表单值 (value)</option>
            <option value="alt">替代文本 (alt)</option>
            <option value="title">标题 (title)</option>
            <option value="data-*">自定义属性</option>
          </select>
        </div>

        <div class="form-group" v-if="extraction.attribute === 'data-*'">
          <label>自定义属性名</label>
          <input
            v-model="extraction.customAttribute"
            type="text"
            placeholder="例如: data-id"
            @input="emitUpdate"
          />
        </div>

        <div class="form-group" v-if="localData.saveToTable">
          <label>保存到列</label>
          <select v-model="extraction.saveToColumn" @change="emitUpdate">
            <option value="">选择列</option>
            <option v-for="column in selectedTableColumns" :key="column.key" :value="column.key">
              {{ column.key }} ({{ column.type }})
            </option>
          </select>
        </div>
      </div>

      <div v-if="localData.extractions.length === 0" class="empty-extractions">
        点击“+ 添加提取项”开始配置。
      </div>

      <button @click="addExtraction" class="btn-add-extraction">+ 添加提取项</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Block } from '../../../types/block';
import { useDataTableStore } from '../../../stores/dataTable';
import { useWorkflowStore } from '../../../stores/workflow';

const dataTableStore = useDataTableStore();
const workflowStore = useWorkflowStore();

onMounted(() => {
  dataTableStore.init();
});

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  update: [data: any];
}>();

const defaultData = {
  multiple: true,
  timeout: 5000,
  saveToTable: '',
  mergeKey: '',
  extractions: [] as Array<{
    selector: string;
    attribute: string;
    customAttribute: string;
    saveToColumn: string;
  }>
};

const localData = ref({ ...defaultData, ...props.block.data });

if (!Array.isArray(localData.value.extractions)) {
  localData.value.extractions = [];
}

watch(
  () => props.block.data,
  (newData) => {
    localData.value = {
      ...defaultData,
      ...newData,
      extractions: Array.isArray(newData.extractions) ? newData.extractions : []
    };
  },
  { deep: true }
);

const dataTables = computed(() => dataTableStore.tables);
const workflowVariables = computed(() => workflowStore.variables);

const selectedTableColumns = computed(() => {
  if (!localData.value.saveToTable) return [];
  const table = dataTableStore.getTableById(localData.value.saveToTable);
  return table ? table.columns : [];
});

function addExtraction() {
  localData.value.extractions.push({
    selector: '',
    attribute: 'text',
    customAttribute: '',
    saveToColumn: ''
  });
  emitUpdate();
}

function removeExtraction(index: number) {
  localData.value.extractions.splice(index, 1);
  emitUpdate();
}

function emitUpdate() {
  emit('update', localData.value);
}

function getDefaultMergeKey(): string {
  const variables = workflowVariables.value || {};

  if (Object.prototype.hasOwnProperty.call(variables, 'index')) {
    return '{{index}}';
  }

  const firstVariableName = Object.keys(variables)[0];
  if (firstVariableName) {
    return `{{${firstVariableName}}}`;
  }

  return '{{index}}';
}

watch(
  () => [localData.value.saveToTable, localData.value.multiple, localData.value.mergeKey] as const,
  ([saveToTable, multiple, mergeKey]) => {
    if (multiple && String(mergeKey || '').trim()) {
      localData.value.mergeKey = '';
      emitUpdate();
      return;
    }

    if (saveToTable && !multiple && !String(mergeKey || '').trim()) {
      localData.value.mergeKey = getDefaultMergeKey();
      emitUpdate();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.property-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  color: #8b949e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group textarea,
.form-group input[type="text"],
.form-group input[type="number"],
.form-group select {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.form-group textarea:focus,
.form-group input[type="text"]:focus,
.form-group input[type="number"]:focus,
.form-group select:focus {
  outline: none;
  border-color: #58a6ff;
}

.form-group textarea {
  resize: vertical;
  min-height: 84px;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.5;
}

.form-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.form-group small {
  font-size: 0.8rem;
  color: #6e7681;
  margin-top: -0.25rem;
}

.extractions-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #30363d;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #c9d1d9;
  font-weight: 600;
}

.extraction-item {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.extraction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #30363d;
}

.extraction-number {
  font-size: 0.9rem;
  font-weight: 600;
  color: #58a6ff;
}

.btn-icon-small {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon-small:hover {
  background: #da3633;
  border-color: #da3633;
  color: white;
}

.empty-extractions {
  text-align: center;
  padding: 2rem;
  color: #6e7681;
  font-size: 0.9rem;
  background: #0d1117;
  border: 1px dashed #30363d;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.btn-add-extraction {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9rem;
  border: 1px dashed #30363d;
  border-radius: 6px;
  background: transparent;
  color: #58a6ff;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-add-extraction:hover {
  background: #238636;
  border-color: #238636;
  color: white;
  border-style: solid;
}
</style>
