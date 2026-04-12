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

    <div v-if="activeFile" class="code-viewer">
      <div class="code-meta">
        <div class="code-meta-main">
          <strong>{{ activeFile.path }}</strong>
          <span>{{ activeFile.role }}</span>
        </div>
        <div class="code-meta-side">
          <span class="code-badge">{{ activeFile.type }}</span>
          <span class="code-badge" :class="{ 'is-editable': activeFile.editable }">
            {{ activeFile.editable ? 'editable' : 'readonly' }}
          </span>
        </div>
      </div>

      <div class="code-editor">
        <div class="code-lines" aria-hidden="true">
          <span v-for="line in lineNumbers" :key="line">{{ line }}</span>
        </div>
        <pre class="code-content">{{ activeFile.content }}</pre>
      </div>
    </div>

    <div v-else class="code-empty">
      Select a generated file to inspect its source.
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

const lineNumbers = computed(() => {
  if (!activeFile.value) {
    return [];
  }

  return activeFile.value.content.split('\n').map((_, index) => index + 1);
});
</script>

<style scoped>
.code-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid #1f1f1f;
  overflow: hidden;
  background: #0f1115;
}

.code-tabs {
  display: flex;
  gap: 1px;
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

.tab-dot--vue {
  background: #46c488;
}

.tab-dot--ts {
  background: #4f8ef7;
}

.tab-dot--css {
  background: #9860ff;
}

.tab-dot--json {
  background: #8a6871;
}

.tab-dot--html {
  background: #e7884d;
}

.tab-label {
  font-size: 13px;
}

.code-viewer {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.code-meta {
  display: flex;
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

.code-editor {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #0f1115;
}

.code-lines {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  padding: 16px 10px 16px 0;
  border-right: 1px solid #1b2029;
  background: #0b0d11;
  color: #5f6877;
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: 1.7;
  user-select: none;
}

.code-content {
  margin: 0;
  min-height: 100%;
  padding: 16px 18px 24px;
  overflow: visible;
  color: #d9dee7;
  font-family: var(--font-family-mono);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre;
}

.code-empty {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: #9098a8;
}
</style>
