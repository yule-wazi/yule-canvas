<template>
  <aside class="setup-drawer" :class="{ 'is-open': open }">
    <div class="drawer-topbar">
      <div class="topbar-meta">
        <p class="eyebrow">Workspace Setup</p>
        <strong>Build the first editable workspace</strong>
      </div>
      <button class="config-trigger" type="button" @click="isAIConfigOpen = true">
        AI Config
      </button>
    </div>

    <div class="drawer-body">
      <section class="panel">
        <label class="field">
          <span>Data table</span>
          <select :value="selectedTableId || ''" @change="$emit('update:selectedTableId', ($event.target as HTMLSelectElement).value)">
            <option value="" disabled>Select a table</option>
            <option v-for="table in tables" :key="table.id" :value="table.id">
              {{ table.name }}
            </option>
          </select>
        </label>

        <div class="inline-meta">
          <span>Detected fields</span>
          <strong>{{ Object.keys(fieldRoleMap).length }}</strong>
        </div>

        <div v-if="Object.keys(fieldRoleMap).length" class="field-chip-list">
          <span v-for="(role, field) in fieldRoleMap" :key="field" class="field-chip">{{ field }} / {{ role }}</span>
        </div>
      </section>

      <section class="panel">
        <div class="inline-meta">
          <span>Goal</span>
          <strong>{{ selectedTableLabel }}</strong>
        </div>

        <textarea
          :value="goal"
          rows="8"
          class="composer-input"
          placeholder="Describe the page direction, visual tone, and content emphasis."
          @input="$emit('update:goal', ($event.target as HTMLTextAreaElement).value)"
        />

        <p class="helper-text">
          Ask AI to generate a multi-file workspace that appears directly in the file tree.
        </p>
      </section>
    </div>

    <div class="drawer-footer">
      <button class="submit-btn submit-btn--icon" type="button" :disabled="isGenerating" @click="$emit('generate-ai')" :title="isGenerating ? 'Generating...' : 'Generate with AI'">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5V19" />
          <path d="M5 12L12 5L19 12" />
        </svg>
      </button>
    </div>

    <div v-if="isAIConfigOpen" class="config-modal-backdrop" @click.self="isAIConfigOpen = false">
      <div class="config-modal">
        <div class="config-header">
          <div class="config-header-meta">
            <span>AI Provider</span>
            <strong>{{ providerLabel }}</strong>
          </div>
          <button class="config-close" type="button" @click="isAIConfigOpen = false">Close</button>
        </div>

        <div class="config-body">
          <label class="field">
            <span>Provider</span>
            <select :value="aiProvider" @change="$emit('update:aiProvider', ($event.target as HTMLSelectElement).value)">
              <option value="siliconflow">SiliconFlow</option>
              <option value="openrouter">OpenRouter</option>
              <option value="qwen">Qwen</option>
            </select>
          </label>

          <label class="field">
            <span>API Key</span>
            <input
              :value="aiApiKey"
              type="password"
              class="text-input"
              placeholder="Paste your provider API key"
              @input="$emit('update:aiApiKey', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="field">
            <span>Model</span>
            <input
              :value="aiModel"
              type="text"
              class="text-input"
              placeholder="Optional model override"
              @input="$emit('update:aiModel', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <p class="helper-text">
            These values are saved locally on this browser, so refreshes will not clear them.
          </p>
        </div>

        <div class="config-footer">
          <button class="submit-btn" type="button" @click="isAIConfigOpen = false">Done</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DataTable } from '../../stores/dataTable';
import type { PageBuilderAIProvider } from '../../types/pageBuilder';

const props = defineProps<{
  open: boolean;
  tables: DataTable[];
  selectedTableId: string | null;
  goal: string;
  fieldRoleMap: Record<string, string>;
  isGenerating: boolean;
  aiProvider: PageBuilderAIProvider;
  aiApiKey: string;
  aiModel: string;
}>();

defineEmits<{
  'generate-ai': [];
  'update:selectedTableId': [value: string];
  'update:goal': [value: string];
  'update:aiProvider': [value: string];
  'update:aiApiKey': [value: string];
  'update:aiModel': [value: string];
}>();

const selectedTableLabel = computed(() => {
  return props.tables.find((item) => item.id === props.selectedTableId)?.name || 'No table selected';
});

const isAIConfigOpen = ref(false);

const providerLabel = computed(() => {
  if (props.aiProvider === 'openrouter') {
    return 'OpenRouter';
  }

  if (props.aiProvider === 'qwen') {
    return 'Qwen';
  }

  return 'SiliconFlow';
});
</script>

<style scoped>
.setup-drawer {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(460px, 100%);
  height: 100%;
  transform: translateX(100%);
  transition: transform 0.24s ease;
  background: linear-gradient(180deg, rgba(11, 11, 11, 0.985) 0%, rgba(6, 6, 6, 0.99) 100%);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: rgba(0, 0, 0, 0.48) -18px 0 38px;
  overflow: hidden;
}

.setup-drawer.is-open {
  transform: translateX(0);
}

.drawer-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.topbar-meta {
  display: grid;
  gap: 4px;
}

.eyebrow {
  margin: 0;
  color: #78b900;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.topbar-meta strong {
  color: #f5f7fb;
  font-size: 18px;
}

.config-trigger,
.config-close {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  color: #f5f7fb;
  cursor: pointer;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 18px;
}

.panel {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
}

.field {
  display: grid;
  gap: 8px;
}

.field span,
.helper-text {
  color: #97a1b2;
  font-size: 13px;
}

.field select,
.composer-input,
.submit-btn,
.text-input {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #f5f7fb;
  outline: none;
}

.field select {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
}

.text-input {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
}

.inline-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #9ba5b4;
  font-size: 13px;
}

.inline-meta strong {
  color: #f5f7fb;
}

.field-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.field-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: #d9e0ea;
  font-size: 12px;
}

.composer-input {
  width: 100%;
  min-height: 180px;
  padding: 14px 16px;
  border-radius: 18px;
  resize: none;
  line-height: 1.7;
  font-size: 15px;
}

.helper-text {
  margin: 0;
  line-height: 1.6;
}

.drawer-footer {
  padding: 16px 18px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: flex-end;
}

.submit-btn {
  min-height: 48px;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.submit-btn--icon {
  width: 48px;
  min-width: 48px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.submit-btn--icon svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.config-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(6px);
}

.config-modal {
  width: min(640px, 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(14, 14, 14, 0.99) 0%, rgba(9, 9, 9, 0.99) 100%);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
  overflow: hidden;
}

.config-header,
.config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
}

.config-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.config-header-meta {
  display: grid;
  gap: 6px;
}

.config-header-meta span {
  color: #97a1b2;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.config-header-meta strong {
  color: #f5f7fb;
  font-size: 16px;
}

.config-body {
  display: grid;
  gap: 16px;
  padding: 22px;
}

.config-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

@media (max-width: 980px) {
  .setup-drawer {
    width: 100%;
    border-left: 0;
  }
}
</style>
