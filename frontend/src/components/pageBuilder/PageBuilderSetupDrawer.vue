<template>
  <aside class="setup-drawer" :class="{ 'is-open': open }">
    <template v-if="mode === 'setup'">
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
            <PageBuilderSelect
              :model-value="selectedTableId || ''"
              placeholder="Select a table"
              :options="tableOptions"
              @update:model-value="$emit('update:selectedTableId', $event)"
            />
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
    </template>

    <template v-else>
      <div class="drawer-topbar">
        <div class="topbar-meta">
          <p class="eyebrow">Conversation</p>
          <strong>{{ workspaceName }}</strong>
        </div>
      </div>

      <div class="drawer-body conversation-body">
        <template v-for="message in conversationMessages" :key="message.id">
          <article
            v-if="message.kind === 'message'"
            class="message-row"
            :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
          >
            <div class="message-shell">
              <div class="message-time">{{ formatTime(message.createdAt) }}</div>
              <p class="message-content">{{ message.content }}</p>
            </div>
          </article>

          <AIFileOperationGroup
            v-else-if="message.kind === 'file_operation_group'"
            :group="message"
          />
        </template>
      </div>

      <div class="drawer-footer conversation-footer">
        <textarea
          :value="conversationDraft"
          rows="3"
          class="composer-input composer-input--compact"
          placeholder="Send a follow-up message to AI..."
          @input="$emit('update:conversationDraft', ($event.target as HTMLTextAreaElement).value)"
          @keydown.enter.exact.prevent="$emit('send-message')"
        />

        <button class="submit-btn submit-btn--icon" type="button" :disabled="isGenerating || !conversationDraft.trim()" @click="$emit('send-message')" title="Send message">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12L20 4L14 20L11 13L4 12Z" />
          </svg>
        </button>
      </div>
    </template>

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
            <PageBuilderSelect
              :model-value="aiProvider"
              placeholder="Select provider"
              :options="providerOptions"
              @update:model-value="$emit('update:aiProvider', $event)"
            />
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
import AIFileOperationGroup from './AIFileOperationGroup.vue';
import PageBuilderSelect from './PageBuilderSelect.vue';
import type { DataTable } from '../../stores/dataTable';
import type {
  PageBuilderAIProvider,
  PageBuilderConversationItem,
  PageBuilderDrawerMode
} from '../../types/pageBuilder';

const props = defineProps<{
  open: boolean;
  mode: PageBuilderDrawerMode;
  workspaceName: string;
  tables: DataTable[];
  selectedTableId: string | null;
  goal: string;
  fieldRoleMap: Record<string, string>;
  isGenerating: boolean;
  aiProvider: PageBuilderAIProvider;
  aiApiKey: string;
  aiModel: string;
  conversationDraft: string;
  conversationMessages: PageBuilderConversationItem[];
}>();

defineEmits<{
  'generate-ai': [];
  'send-message': [];
  'update:selectedTableId': [value: string];
  'update:goal': [value: string];
  'update:aiProvider': [value: string];
  'update:aiApiKey': [value: string];
  'update:aiModel': [value: string];
  'update:conversationDraft': [value: string];
}>();

const selectedTableLabel = computed(() => {
  return props.tables.find((item) => item.id === props.selectedTableId)?.name || 'No table selected';
});

const isAIConfigOpen = ref(false);

const tableOptions = computed(() =>
  props.tables.map((table) => ({
    value: table.id,
    label: table.name
  }))
);

const providerOptions = [
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'qwen', label: 'Qwen' }
];

const providerLabel = computed(() => {
  if (props.aiProvider === 'openrouter') {
    return 'OpenRouter';
  }

  if (props.aiProvider === 'qwen') {
    return 'Qwen';
  }

  return 'SiliconFlow';
});

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}
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
  background: #000000;
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
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.topbar-meta strong {
  color: #f5f7fb;
  font-size: 36px;
  line-height: 1.25;
}

.config-trigger,
.config-close {
  min-height: 40px;
  padding: 0 13px;
  border: 2px solid #76b900;
  border-radius: 2px;
  background: transparent;
  color: #f5f7fb;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
}

.config-trigger:hover,
.config-close:hover {
  background: #1eaedb;
  color: #ffffff;
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
  border: 1px solid #5e5e5e;
  border-radius: 2px;
  background: #1a1a1a;
  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span,
.helper-text {
  color: #a7a7a7;
  font-size: 14px;
  line-height: 1.5;
}

.composer-input,
.submit-btn,
.text-input {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #141414;
  color: #f5f7fb;
  outline: none;
}

.text-input {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 2px;
}

.inline-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #a7a7a7;
  font-size: 14px;
  line-height: 1.5;
}

.inline-meta strong {
  color: #ffffff;
  font-weight: 700;
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
  border: 1px solid #5e5e5e;
  border-radius: 2px;
  background: #141414;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.43;
}

.composer-input {
  width: 100%;
  min-height: 180px;
  padding: 14px 16px;
  border-radius: 2px;
  resize: none;
  line-height: 1.67;
  font-size: 15px;
}

.composer-input--compact {
  min-height: 110px;
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
  gap: 12px;
}

.conversation-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.conversation-body > * {
  flex: 0 0 auto;
}

.conversation-footer {
  align-items: flex-end;
}

.message-row {
  display: flex;
  flex: 0 0 auto;
}

.message-row.is-user {
  justify-content: flex-end;
}

.message-row.is-assistant {
  justify-content: flex-start;
}

.message-shell {
  max-width: min(92%, 420px);
  display: grid;
  gap: 8px;
}

.message-row.is-user .message-shell {
  padding: 12px 14px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.message-row.is-assistant .message-shell {
  padding: 4px 0;
}

.message-time {
  color: #7f8b9c;
  font-size: 11px;
  line-height: 1;
}

.message-row.is-user .message-time {
  text-align: right;
}

.message-content {
  margin: 0;
  color: #eef3fb;
  white-space: pre-wrap;
  line-height: 1.72;
  font-size: 14px;
}

.submit-btn {
  min-height: 48px;
  border-radius: 2px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  border: 2px solid #76b900;
}

.submit-btn:hover:not(:disabled) {
  background: #1eaedb;
  color: #ffffff;
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
  border-radius: 2px;
  background: #000000;
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
  color: #a7a7a7;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.config-header-meta strong {
  color: #f5f7fb;
  font-size: 24px;
  line-height: 1.25;
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

  .message-shell {
    max-width: 100%;
  }
}
</style>
