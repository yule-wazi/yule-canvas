<template>
  <aside class="page-builder-rightpanel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Inspector</p>
        <h2>{{ panelTitle }}</h2>
      </div>
      <span class="panel-state">{{ selectedSection ? 'Section' : activeFile ? 'File' : 'Idle' }}</span>
    </div>

    <div v-if="selectedSection" class="inspector-card">
      <div class="info-row">
        <span>Type</span>
        <strong>{{ selectedSection.type }}</strong>
      </div>
      <div class="info-row">
        <span>Repeat</span>
        <strong>{{ selectedSection.repeat ? 'Yes' : 'No' }}</strong>
      </div>
      <div class="info-group">
        <p class="group-title">Bindings</p>
        <div v-if="Object.keys(selectedSection.bindings).length" class="binding-list">
          <div v-for="(field, key) in selectedSection.bindings" :key="key" class="binding-row">
            <span>{{ key }}</span>
            <strong>{{ field }}</strong>
          </div>
        </div>
        <p v-else class="hint">No bindings assigned yet.</p>
      </div>
      <p v-if="selectedSection.description" class="hint">{{ selectedSection.description }}</p>
    </div>

    <div v-else-if="activeFile" class="inspector-card">
      <div class="info-row">
        <span>File</span>
        <strong>{{ activeFile.name }}</strong>
      </div>
      <div class="info-row">
        <span>Role</span>
        <strong>{{ activeFile.role }}</strong>
      </div>
      <div class="info-row">
        <span>Editable</span>
        <strong>{{ activeFile.editable ? 'Yes' : 'Read-only' }}</strong>
      </div>
      <div class="info-group">
        <p class="group-title">Source Sections</p>
        <div v-if="activeFile.sourceSectionIds?.length" class="chip-list">
          <button
            v-for="sectionId in activeFile.sourceSectionIds"
            :key="sectionId"
            class="section-chip"
            type="button"
            @click="$emit('selectSection', sectionId)"
          >
            {{ sectionId }}
          </button>
        </div>
        <p v-else class="hint">No section mapping metadata yet.</p>
      </div>
    </div>

    <div v-else class="inspector-card inspector-card--empty">
      <p>Select a file or generated section to inspect bindings and context.</p>
    </div>

    <div class="section-list">
      <p class="group-title">Generated Sections</p>
      <button
        v-for="section in sections"
        :key="section.id"
        class="section-item"
        :class="{ 'is-active': section.id === selectedSectionId }"
        type="button"
        @click="$emit('selectSection', section.id)"
      >
        <strong>{{ section.title }}</strong>
        <span>{{ section.type }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PageBuilderFile, PageBuilderSectionSummary } from '../../types/pageBuilder';

const props = defineProps<{
  activeFile: PageBuilderFile | null;
  sections: PageBuilderSectionSummary[];
  selectedSectionId: string | null;
}>();

defineEmits<{
  selectSection: [sectionId: string];
}>();

const selectedSection = computed(
  () => props.sections.find((section) => section.id === props.selectedSectionId) || null
);

const panelTitle = computed(() => {
  if (selectedSection.value) {
    return selectedSection.value.title;
  }

  if (props.activeFile) {
    return props.activeFile.name;
  }

  return 'Nothing Selected';
});
</script>

<style scoped>
.page-builder-rightpanel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 18px;
  background: linear-gradient(180deg, rgba(12, 12, 12, 0.98) 0%, rgba(6, 6, 6, 0.98) 100%);
  border-left: 1px solid var(--color-border-default);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
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

.inspector-card,
.section-item {
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.inspector-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
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
.hint {
  color: var(--color-text-secondary);
}

.info-group {
  display: grid;
  gap: 10px;
}

.binding-list,
.section-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.section-chip,
.section-item {
  color: var(--color-text-primary);
  cursor: pointer;
}

.section-chip {
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-default);
  border-radius: 999px;
  background: transparent;
}

.section-item {
  display: grid;
  gap: 6px;
  padding: 12px;
  text-align: left;
}

.section-item span {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.section-item.is-active,
.section-chip:hover,
.section-item:hover {
  border-color: var(--color-border-strong);
}
</style>
