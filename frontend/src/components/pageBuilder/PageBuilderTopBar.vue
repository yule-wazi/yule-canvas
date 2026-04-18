<template>
  <header class="page-builder-topbar">
    <div class="topbar-left">
      <router-link to="/" class="nav-back" title="Back to home">Back</router-link>
      <div class="title-group">
        <p class="eyebrow">Page Builder</p>
        <h1>{{ title }}</h1>
      </div>
    </div>

    <div class="topbar-center">
      <div class="meta-chip">
        <span class="meta-label">Table</span>
        <strong>{{ tableName }}</strong>
      </div>
      <div class="meta-chip">
        <span class="meta-label">Page Type</span>
        <strong>{{ pageTypeLabel }}</strong>
      </div>
      <div class="meta-chip">
        <span class="meta-label">Style</span>
        <strong>{{ stylePresetLabel }}</strong>
      </div>
      <div v-if="generationSummary" class="meta-chip meta-chip--wide">
        <span class="meta-label">AI Summary</span>
        <strong>{{ generationSummary }}</strong>
      </div>
    </div>

    <div class="topbar-right">
      <button class="ghost-btn" type="button" @click="$emit('toggle-setup')">
        {{ setupOpen ? 'Hide setup' : 'Show setup' }}
      </button>
      <div class="mode-switch">
        <button
          v-for="mode in modes"
          :key="mode.value"
          class="mode-btn"
          :class="{ 'is-active': mode.value === centerMode }"
          type="button"
          @click="$emit('change-mode', mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>
      <button class="ghost-btn" type="button" :disabled="isGenerating" @click="$emit('generate-local')">
        Local Draft
      </button>
      <button class="generate-btn" type="button" :disabled="isGenerating" @click="$emit('generate-ai')">
        {{ isGenerating ? 'Generating...' : 'Generate with AI' }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PageBuilderCenterMode, PageBuilderPageType, PageBuilderStylePreset } from '../../types/pageBuilder';

const props = defineProps<{
  title: string;
  tableName: string;
  pageType: PageBuilderPageType;
  stylePreset: PageBuilderStylePreset;
  centerMode: PageBuilderCenterMode;
  setupOpen: boolean;
  isGenerating: boolean;
  generationSummary?: string;
}>();

defineEmits<{
  'change-mode': [mode: PageBuilderCenterMode];
  'generate-local': [];
  'generate-ai': [];
  'toggle-setup': [];
}>();

const modes: Array<{ label: string; value: PageBuilderCenterMode }> = [
  { label: 'Preview', value: 'preview' },
  { label: 'Code', value: 'code' },
  { label: 'Data', value: 'data' }
];

const pageTypeLabelMap: Record<PageBuilderPageType, string> = {
  'news-list': 'News List',
  'article-detail': 'Article Detail',
  gallery: 'Gallery',
  catalog: 'Catalog'
};

const stylePresetLabelMap: Record<PageBuilderStylePreset, string> = {
  'nvidia-tech': 'Signal Dark',
  'editorial-dark': 'Editorial',
  'clean-catalog': 'Clean Catalog'
};

const pageTypeLabel = computed(() => pageTypeLabelMap[props.pageType]);
const stylePresetLabel = computed(() => stylePresetLabelMap[props.stylePreset]);
</script>

<style scoped>
.page-builder-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  background: linear-gradient(180deg, rgba(8, 8, 8, 0.98) 0%, rgba(0, 0, 0, 0.98) 100%);
  border-bottom: 1px solid var(--color-border-default);
  overflow: hidden;
}

.topbar-left,
.topbar-center,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.topbar-center,
.topbar-right {
  flex-wrap: wrap;
}

.nav-back,
.ghost-btn,
.generate-btn,
.mode-btn {
  min-height: 42px;
  border-radius: var(--radius-sm);
  font-size: var(--text-link);
  font-weight: 700;
}

.nav-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 0 14px;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-page-elevated);
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.title-group {
  min-width: 0;
}

.title-group h1 {
  margin: 0;
  font-size: 22px;
  line-height: var(--line-height-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: var(--text-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-brand-accent);
}

.meta-chip {
  display: grid;
  gap: 2px;
  min-width: 118px;
  max-width: 160px;
  padding: 10px 12px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.meta-chip--wide {
  max-width: 280px;
}

.meta-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.meta-chip strong {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-right {
  justify-content: flex-end;
}

.ghost-btn,
.mode-btn {
  padding: 10px 12px;
  border: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.generate-btn {
  padding: 10px 16px;
  border: 2px solid var(--color-brand-accent);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.ghost-btn:disabled,
.generate-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.generate-btn:hover,
.ghost-btn:hover,
.mode-btn:hover,
.mode-btn.is-active {
  border-color: var(--color-brand-accent);
  color: var(--color-text-primary);
}

.mode-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-bg-page-elevated);
  flex-wrap: wrap;
}

.mode-btn {
  min-width: 72px;
  border-color: transparent;
}

@media (max-width: 1380px) {
  .page-builder-topbar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .page-builder-topbar {
    padding: 16px;
  }

  .topbar-left,
  .topbar-center,
  .topbar-right {
    flex-wrap: wrap;
  }
}
</style>
