<template>
  <div class="property-form">
    <div class="form-group">
      <label>滚动目标</label>
      <select v-model="localData.target" @change="emitUpdate">
        <option value="page">整个页面</option>
        <option value="element">指定元素</option>
      </select>
    </div>

    <div class="form-group" v-if="localData.target === 'element'">
      <label>元素选择器</label>
      <textarea
        v-model="localData.selector"
        placeholder="例如: .scroll-container"
        rows="3"
        @input="emitUpdate"
      ></textarea>
      <small>CSS选择器，用于定位需要滚动的元素</small>
    </div>

    <div class="form-group" v-if="localData.target === 'element'">
      <label>等待超时 (毫秒)</label>
      <input
        v-model.number="localData.timeout"
        type="number"
        min="1000"
        step="1000"
        @input="emitUpdate"
      />
      <small>等待元素出现的最长时间</small>
    </div>

    <div class="form-group">
      <label>滚动模式</label>
      <select v-model="localData.mode" @change="emitUpdate">
        <option value="smart">智能滚动 (检测底部)</option>
        <option value="fixed">固定次数</option>
      </select>
    </div>

    <div class="form-group">
      <label>滚动距离 (像素)</label>
      <input
        v-model.number="localData.scrollDistance"
        type="number"
        min="100"
        step="100"
        @input="emitUpdate"
      />
      <small>每次滚动的距离，默认800像素</small>
    </div>

    <div class="form-group">
      <label>最大滚动次数</label>
      <input
        v-model.number="localData.maxScrolls"
        type="number"
        min="1"
        max="50"
        @input="emitUpdate"
      />
    </div>

    <div class="form-group">
      <label>滚动间隔 (毫秒)</label>
      <input
        v-model.number="localData.delay"
        type="number"
        min="100"
        step="100"
        @input="emitUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Block } from '../../../types/block';

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  update: [data: any];
}>();

const defaultData = {
  target: 'page',
  selector: '',
  timeout: 5000,
  mode: 'smart',
  maxScrolls: 15,
  scrollDistance: 800,
  delay: 800
};

const localData = ref({ ...defaultData, ...props.block.data });

watch(() => props.block.data, (newData) => {
  localData.value = { ...defaultData, ...newData };
}, { deep: true });

function emitUpdate() {
  emit('update', localData.value);
}
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
}

.form-group textarea,
.form-group input,
.form-group select {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.form-group textarea:focus,
.form-group input:focus,
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

.form-group small {
  font-size: 0.8rem;
  color: #6e7681;
  margin-top: -0.25rem;
}
</style>
