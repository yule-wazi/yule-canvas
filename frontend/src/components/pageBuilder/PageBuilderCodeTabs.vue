<template>
  <div class="code-shell">
    <div class="code-tabs">
      <button
        v-for="file in files"
        :key="file.id"
        class="code-tab"
        :class="{ 'is-active': file.id === activeFileId }"
        type="button"
        @click="$emit('selectFile', file.id)"
      >
        {{ file.name }}
      </button>
    </div>

    <div v-if="activeFile" class="code-viewer">
      <div class="code-meta">
        <div>
          <strong>{{ activeFile.name }}</strong>
          <span>{{ activeFile.role }}</span>
        </div>
        <span class="code-lang">{{ activeFile.type }}</span>
      </div>
      <pre>{{ activeFile.content }}</pre>
    </div>

    <div v-else class="code-empty">
      Select a generated file to inspect its contents.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PageBuilderFile } from '../../types/pageBuilder';

const props = defineProps<{
  files: PageBuilderFile[];
  activeFileId: string | null;
}>();

defineEmits<{
  selectFile: [fileId: string];
}>();

const activeFile = computed(() => props.files.find((file) => file.id === props.activeFileId) || null);
</script>

<style scoped>
.code-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #080808;
}

.code-tabs {
  display: flex;
  gap: 1px;
  padding: 10px 10px 0;
  border-bottom: 1px solid var(--color-border-default);
  background: rgba(255, 255, 255, 0.02);
  overflow-x: auto;
}

.code-tab {
  min-height: 38px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.code-tab.is-active {
  border-color: var(--color-border-default);
  background: #080808;
  color: var(--color-text-primary);
}

.code-viewer {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.code-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(94, 94, 94, 0.5);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.code-meta strong,
.code-lang {
  color: var(--color-text-primary);
}

.code-meta div {
  display: grid;
  gap: 4px;
}

pre {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 18px;
  overflow: auto;
  font-family: var(--font-family-mono);
  font-size: 13px;
  line-height: 1.7;
  color: #d8ded3;
}

.code-empty {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: var(--color-text-secondary);
}
</style>
