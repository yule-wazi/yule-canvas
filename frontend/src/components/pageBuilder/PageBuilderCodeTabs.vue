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
        <span class="tab-dot" :class="`tab-dot--${file.type}`"></span>
        <span class="tab-label">{{ file.name }}</span>
      </button>
    </div>

    <div v-if="activeFile" class="code-editor">
      <div class="code-meta">
        <div class="code-meta-main">
          <strong>{{ activeFile.path }}</strong>
          <span>{{ activeFile.role }}</span>
        </div>
        <div class="code-meta-side">
          <span class="code-badge">{{ activeFile.type }}</span>
          <span class="code-badge" :class="{ 'is-editable': activeFile.editable }">
            {{ activeFile.editable ? 'editable' : 'read only' }}
          </span>
        </div>
      </div>

      <textarea
        :value="activeFile.content"
        class="code-input"
        :readonly="!activeFile.editable"
        spellcheck="false"
        @input="$emit('updateContent', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <div v-else class="code-empty">
      Select a file to start editing the workspace.
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
  updateContent: [value: string];
}>();

const activeFile = computed(() => props.files.find((file) => file.id === props.activeFileId) || null);
</script>

<style scoped>
.code-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #0f1115;
}

.code-tabs {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  gap: 1px;
  flex: none;
  padding: 0 10px;
  border-bottom: 1px solid #1f1f1f;
  background: #111317;
  overflow-x: auto;
}

.code-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-top: 2px solid transparent;
  background: transparent;
  color: #9197a3;
  cursor: pointer;
  white-space: nowrap;
}

.code-tab:hover {
  background: #171a20;
  color: #cfd4dd;
}

.code-tab.is-active {
  border-top-color: #76b900;
  background: #0f1115;
  color: #f4f7fb;
}

.tab-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: #6d7585;
}

.tab-dot--js {
  background: #f7df1e;
}

.tab-dot--css {
  background: #4ea3ff;
}

.tab-dot--json {
  background: #8a6871;
}

.tab-dot--html {
  background: #ff8b61;
}

.code-editor {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.code-meta {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #1f1f1f;
  background: #12151b;
}

.code-meta-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.code-meta-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #f4f7fb;
  font-size: 13px;
}

.code-meta-main span {
  color: #8e96a4;
  font-size: 12px;
}

.code-meta-side {
  display: inline-flex;
  gap: 8px;
}

.code-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid #2a2f38;
  border-radius: 999px;
  color: #9ca4b3;
  font-size: 11px;
  text-transform: uppercase;
}

.code-badge.is-editable {
  border-color: rgba(118, 185, 0, 0.35);
  color: #bddd78;
}

.code-input {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  padding: 16px 18px 24px;
  border: 0;
  outline: none;
  resize: none;
  background: #0f1115;
  color: #d9dee7;
  font-family: var(--font-family-mono);
  font-size: 13px;
  line-height: 1.7;
}

.code-input[readonly] {
  color: #9ca4b3;
}

.code-empty {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: #9098a8;
}
</style>
