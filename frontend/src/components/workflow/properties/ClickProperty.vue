<template>
  <div class="property-form">
    <div class="form-group">
      <label>CSS 选择器</label>
      <textarea
        v-model="localData.selector"
        placeholder="例如: button.submit"
        rows="3"
        @input="emitUpdate"
      ></textarea>
    </div>

    <div class="form-group">
      <label>
        <input
          v-model="localData.waitForElement"
          type="checkbox"
          @change="emitUpdate"
        />
        等待元素出现
      </label>
    </div>

    <div class="form-group">
      <label>
        <input
          v-model="localData.openInNewTab"
          type="checkbox"
          @change="emitUpdate"
        />
        在新标签页打开
      </label>
      <small>适合列表页点击详情页。后续模块会切到新标签页执行，配合“返回”可关闭当前标签页并回到列表页。</small>
    </div>

    <div v-if="localData.openInNewTab" class="form-group">
      <label>新标签页等待策略</label>
      <select
        v-model="localData.waitUntil"
        @change="emitUpdate"
      >
        <option value="load">load</option>
        <option value="domcontentloaded">domcontentloaded</option>
        <option value="networkidle">networkidle</option>
      </select>
    </div>

    <div v-if="localData.openInNewTab" class="form-group">
      <label>
        <input
          v-model="localData.runInBackground"
          type="checkbox"
          @change="emitUpdate"
        />
        在后台执行子流程
      </label>
      <small>开启后，直到对应“返回”之前的子链会在新标签页中执行，主页面会直接继续返回块之后的主链。</small>
    </div>

    <div class="form-group">
      <label>超时时间（毫秒）</label>
      <input
        v-model.number="localData.timeout"
        type="number"
        min="1000"
        step="1000"
        @input="emitUpdate"
      />
      <small>等待元素或新标签页加载的最长时间。</small>
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

const createDefaultData = () => ({
  selector: '',
  waitForElement: true,
  timeout: 5000,
  openInNewTab: false,
  runInBackground: false,
  waitUntil: 'domcontentloaded'
});

const localData = ref({
  ...createDefaultData(),
  ...props.block.data
});

watch(
  () => props.block.data,
  (newData) => {
    localData.value = {
      ...createDefaultData(),
      ...newData
    };
  },
  { deep: true }
);

function emitUpdate() {
  if (!localData.value.openInNewTab) {
    localData.value.runInBackground = false;
  }

  emit('update', { ...localData.value });
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
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group textarea,
.form-group input[type="number"],
.form-group select {
  background: var(--color-bg-page-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.form-group textarea:focus,
.form-group input[type="number"]:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-brand-link-hover);
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
  color: var(--color-text-muted);
  margin-top: -0.25rem;
}
</style>
