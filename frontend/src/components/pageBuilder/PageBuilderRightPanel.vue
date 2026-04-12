<template>
  <aside class="page-builder-rightpanel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Element Inspector</p>
        <h2>{{ selection?.elementLabel || 'No element selected' }}</h2>
      </div>
      <span class="panel-state">{{ selection ? 'Selected' : 'Waiting' }}</span>
    </div>

    <div v-if="selection" class="inspector-card">
      <div class="info-row">
        <span>Section</span>
        <strong>{{ selection.sectionTitle }}</strong>
      </div>

      <div v-if="selection.componentPath" class="info-row">
        <span>Component</span>
        <strong>{{ selection.componentPath }}</strong>
      </div>

      <div v-if="selection.textValue" class="info-group">
        <p class="group-title">Preview text</p>
        <div class="text-preview">{{ selection.textValue }}</div>
      </div>

      <div class="info-group">
        <p class="group-title">Field bindings</p>
        <div v-if="selection.bindings.length" class="binding-list">
          <div v-for="binding in selection.bindings" :key="`${binding.prop}:${binding.fieldKey}`" class="binding-row">
            <div class="binding-meta">
              <span>{{ binding.prop }}</span>
              <small>{{ binding.fieldRole || 'field' }}</small>
            </div>
            <strong>{{ binding.fieldKey }}</strong>
          </div>
        </div>
        <p v-else class="hint">This element does not expose any field binding yet.</p>
      </div>

      <div v-if="selection.relatedFilePaths.length" class="info-group">
        <p class="group-title">Related files</p>
        <div class="file-chip-list">
          <button
            v-for="filePath in selection.relatedFilePaths"
            :key="filePath"
            class="file-chip"
            type="button"
            @click="$emit('selectFileByPath', filePath)"
          >
            {{ filePath }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="inspector-card inspector-card--empty">
      <p>Click an element in the preview to inspect its bindings, section context, and related source files.</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { PageBuilderPreviewSelection } from '../../types/pageBuilder';

defineProps<{
  selection: PageBuilderPreviewSelection | null;
}>();

defineEmits<{
  selectFileByPath: [filePath: string];
}>();
</script>

<style scoped>
.page-builder-rightpanel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  padding: 18px;
  background: linear-gradient(180deg, rgba(12, 12, 12, 0.98) 0%, rgba(6, 6, 6, 0.98) 100%);
  border-left: 1px solid var(--color-border-default);
  overflow: auto;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 22px;
}

.eyebrow,
.group-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-brand-accent);
}

.eyebrow {
  margin-bottom: 6px;
}

.panel-state {
  padding: 6px 10px;
  border: 1px solid var(--color-border-default);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.inspector-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.inspector-card--empty {
  color: var(--color-text-secondary);
}

.info-row,
.binding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.info-row span,
.binding-row span,
.hint,
.binding-meta small {
  color: var(--color-text-secondary);
}

.info-group {
  display: grid;
  gap: 10px;
}

.binding-list,
.file-chip-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.binding-row {
  align-items: flex-start;
}

.binding-meta {
  display: grid;
  gap: 4px;
}

.text-preview {
  padding: 10px 12px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.file-chip {
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}

.file-chip:hover {
  border-color: var(--color-border-strong);
}
</style>
