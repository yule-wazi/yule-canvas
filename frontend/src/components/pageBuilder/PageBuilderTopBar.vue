<template>
  <header class="page-builder-topbar">
    <div class="topbar-left">
      <router-link to="/" class="nav-back" title="Back to home">&#8592;</router-link>

      <button class="workspace-switcher" type="button" @click="$emit('open-workspaces')">
        <span class="workspace-switcher-label">{{ workspaceName }}</span>
      </button>

      <div class="save-status-chip" :class="{ 'is-unsaved': hasUnsavedChanges }">
        <span class="save-status-dot">{{ hasUnsavedChanges ? '!' : 'OK' }}</span>
        <span class="save-status-text">{{ hasUnsavedChanges ? 'Unsaved' : 'Saved' }}</span>
      </div>
    </div>

    <div class="topbar-right">
      <button class="ghost-btn" type="button" @click="$emit('toggle-setup')">
        {{ setupOpen ? hideLabel : showLabel }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PageBuilderDrawerMode } from '../../types/pageBuilder';

const props = defineProps<{
  workspaceName: string;
  setupOpen: boolean;
  drawerMode: PageBuilderDrawerMode;
  hasUnsavedChanges: boolean;
}>();

defineEmits<{
  'toggle-setup': [];
  'open-workspaces': [];
}>();

const showLabel = computed(() => props.drawerMode === 'setup' ? 'Show setup' : 'Show chat');
const hideLabel = computed(() => props.drawerMode === 'setup' ? 'Hide setup' : 'Hide chat');
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
.ghost-btn {
  min-height: 42px;
  border-radius: 2px;
  font-size: var(--text-link);
  font-weight: 700;
}

.nav-back,
.workspace-switcher,
.ghost-btn {
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
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(118, 185, 0, 0.14);
  color: #76b900;
  font-size: 11px;
  font-weight: 700;
}

.save-status-chip.is-unsaved .save-status-dot {
  background: rgba(223, 101, 0, 0.14);
  color: #ef9100;
}

.save-status-text {
  font-size: 14px;
}

.ghost-btn {
  padding: 10px 14px;
  cursor: pointer;
}

.ghost-btn:hover,
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
