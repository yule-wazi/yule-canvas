<template>
  <header class="page-builder-topbar">
    <div class="topbar-left">
      <router-link to="/" class="nav-back" title="Back to home">&#8592;</router-link>

      <button class="workspace-switcher" type="button" @click="$emit('open-workspaces')">
        <span class="workspace-switcher-label">{{ workspaceName }}</span>
      </button>

      <div class="save-status-chip" :class="{ 'is-unsaved': hasUnsavedChanges }">
        <span class="save-status-dot">{{ hasUnsavedChanges ? '•' : '✓' }}</span>
        <span class="save-status-text">{{ hasUnsavedChanges ? '保存中' : '已保存' }}</span>
      </div>
    </div>

    <div class="topbar-right">
      <div v-if="generationSummary" class="summary-chip">
        <span class="summary-label">AI Summary</span>
        <strong>{{ generationSummary }}</strong>
      </div>

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
import type { PageBuilderCenterMode } from '../../types/pageBuilder';

defineProps<{
  workspaceName: string;
  centerMode: PageBuilderCenterMode;
  setupOpen: boolean;
  isGenerating: boolean;
  hasUnsavedChanges: boolean;
  generationSummary?: string;
}>();

defineEmits<{
  'change-mode': [mode: PageBuilderCenterMode];
  'generate-local': [];
  'generate-ai': [];
  'toggle-setup': [];
  'open-workspaces': [];
}>();

const modes: Array<{ label: string; value: PageBuilderCenterMode }> = [
  { label: 'Preview', value: 'preview' },
  { label: 'Code', value: 'code' },
  { label: 'Data', value: 'data' }
];
</script>

<style scoped>
.page-builder-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  background: linear-gradient(180deg, rgba(8, 8, 8, 0.98) 0%, rgba(0, 0, 0, 0.98) 100%);
  border-bottom: 1px solid var(--color-border-default);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.topbar-right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.nav-back,
.workspace-switcher,
.ghost-btn,
.generate-btn,
.mode-btn {
  min-height: 42px;
  border-radius: 2px;
  font-size: var(--text-link);
  font-weight: 700;
}

.nav-back,
.workspace-switcher,
.ghost-btn,
.mode-btn {
  border: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-text-primary);
}

.nav-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 0 14px;
  text-decoration: none;
  flex: 0 0 auto;
}

.workspace-switcher {
  display: inline-flex;
  align-items: center;
  min-width: 220px;
  max-width: 420px;
  padding: 0 18px;
  text-align: left;
  cursor: pointer;
}

.workspace-switcher-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(118, 185, 0, 0.32);
  border-radius: 2px;
  background: rgba(118, 185, 0, 0.08);
  color: #ffffff;
  flex: 0 0 auto;
}

.save-status-chip.is-unsaved {
  border-color: rgba(223, 101, 0, 0.44);
  background: rgba(223, 101, 0, 0.08);
}

.save-status-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(118, 185, 0, 0.14);
  color: #76b900;
  font-size: 14px;
}

.save-status-chip.is-unsaved .save-status-dot {
  background: rgba(223, 101, 0, 0.14);
  color: #ef9100;
}

.save-status-text {
  font-size: 14px;
}

.summary-chip {
  display: grid;
  gap: 2px;
  max-width: 320px;
  padding: 10px 12px;
  border: 1px solid var(--color-border-default);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.02);
}

.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.summary-chip strong {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ghost-btn,
.mode-btn {
  padding: 10px 14px;
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

.mode-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border-default);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.02);
}

.mode-btn {
  min-width: 72px;
  border-color: transparent;
}

.generate-btn:hover,
.ghost-btn:hover,
.mode-btn:hover,
.mode-btn.is-active,
.nav-back:hover,
.workspace-switcher:hover {
  border-color: var(--color-brand-accent);
  background: rgba(118, 185, 0, 0.06);
}

@media (max-width: 1560px) {
  .page-builder-topbar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .page-builder-topbar {
    padding: 16px;
  }

  .topbar-left,
  .topbar-right {
    flex-wrap: wrap;
  }

  .workspace-switcher {
    min-width: 180px;
    max-width: none;
    flex: 1 1 auto;
  }
}
</style>
