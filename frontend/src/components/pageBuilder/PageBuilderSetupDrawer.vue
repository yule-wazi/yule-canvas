<template>
  <aside class="setup-drawer" :class="{ 'is-open': open }">
    <div class="drawer-topbar">
      <div class="topbar-meta">
        <p class="eyebrow">AI Workbench</p>
        <strong>页面生成对话区</strong>
      </div>

      <div class="topbar-actions">
        <label class="table-pocket">
          <span>数据表</span>
          <select :value="selectedTableId || ''" @change="$emit('update:selectedTableId', ($event.target as HTMLSelectElement).value)">
            <option value="" disabled>选择数据表</option>
            <option v-for="table in tables" :key="table.id" :value="table.id">
              {{ table.name }}
            </option>
          </select>
        </label>

        <button class="config-btn" type="button" @click="$emit('openConfig')">AI 配置</button>
      </div>
    </div>

    <div class="drawer-body">
      <div class="conversation-feed">
        <article class="message message--assistant">
          <p>把首次需求一次说清楚。我会围绕当前数据表生成完整页面代码，并同步到左侧文件区和预览区。</p>
        </article>

        <article v-if="assistantMessage" class="message message--assistant">
          <p>{{ assistantMessage }}</p>
        </article>

        <article class="message message--assistant message--soft">
          <div class="inline-meta">
            <span>当前数据源</span>
            <strong>{{ selectedTableLabel }}</strong>
          </div>
          <p>推荐直接描述页面目标、视觉方向、内容层级、阅读节奏和信息密度，不必再单独描述文件结构。</p>
        </article>

        <article class="message message--assistant message--soft">
          <div class="inline-meta">
            <span>已识别字段</span>
            <strong>{{ Object.keys(fieldRoleMap).length }}</strong>
          </div>
          <div v-if="Object.keys(fieldRoleMap).length" class="field-chip-list">
            <span v-for="(role, field) in fieldRoleMap" :key="field" class="field-chip">{{ field }} / {{ role }}</span>
          </div>
          <p v-else>选择数据表后，这里会展示系统推断的字段角色。</p>
        </article>

        <article v-if="goal.trim()" class="message message--user">
          <p>{{ goal }}</p>
        </article>
      </div>
    </div>

    <div class="drawer-footer">
      <div class="composer-shell">
        <textarea
          :value="goal"
          rows="6"
          class="composer-input"
          placeholder="请输入首次页面需求，例如：做一个偏科技媒体风格的内容首页，顶部要有强标题区和数据感摘要，中间是内容卡片流，整体黑底高对比，突出封面图、标题和发布时间。"
          @input="$emit('update:goal', ($event.target as HTMLTextAreaElement).value)"
        />

        <div class="composer-toolbar">
          <button class="send-btn" type="button" @click="$emit('generate')">
            <span class="send-icon">↑</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DataTable } from '../../stores/dataTable';

const props = defineProps<{
  open: boolean;
  tables: DataTable[];
  selectedTableId: string | null;
  goal: string;
  fieldRoleMap: Record<string, string>;
  assistantMessage: string;
}>();

defineEmits<{
  openConfig: [];
  generate: [];
  'update:selectedTableId': [value: string];
  'update:goal': [value: string];
}>();

const selectedTableLabel = computed(() => {
  return props.tables.find((item) => item.id === props.selectedTableId)?.name || '未选择数据表';
});
</script>

<style scoped>
.setup-drawer {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
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
  gap: 14px;
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

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-pocket {
  display: grid;
  gap: 5px;
  min-width: 164px;
}

.table-pocket span {
  color: #8b96a7;
  font-size: 11px;
}

.table-pocket select,
.config-btn,
.composer-input {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #f5f7fb;
  outline: none;
}

.table-pocket select,
.config-btn {
  min-height: 40px;
  border-radius: 14px;
}

.table-pocket select {
  padding: 0 14px;
}

.config-btn {
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.conversation-feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
}

.message {
  max-width: 92%;
  padding: 16px 18px;
  border-radius: 24px;
  line-height: 1.8;
  font-size: 15px;
}

.message p {
  margin: 0;
}

.message--assistant {
  align-self: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #eff3fa;
}

.message--assistant.message--soft {
  background: rgba(255, 255, 255, 0.02);
  color: #d8dee8;
}

.message--user {
  align-self: flex-end;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.inline-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
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
  margin-bottom: 10px;
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

.drawer-footer {
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(10, 10, 10, 0.4) 0%, rgba(10, 10, 10, 0.96) 100%);
}

.composer-shell {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.03);
}

.composer-input {
  width: 100%;
  min-height: 132px;
  padding: 14px 16px;
  border-radius: 18px;
  resize: none;
  line-height: 1.8;
  font-size: 15px;
}

.composer-toolbar {
  display: flex;
  justify-content: flex-end;
}

.send-btn {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: #f1f5fb;
  color: #0d1117;
  cursor: pointer;
}

.send-icon {
  font-size: 18px;
  line-height: 1;
}

@media (max-width: 980px) {
  .setup-drawer {
    width: 100%;
    border-left: 0;
  }
}

@media (max-width: 680px) {
  .drawer-topbar,
  .conversation-feed,
  .drawer-footer {
    padding-left: 14px;
    padding-right: 14px;
  }

  .drawer-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .topbar-actions {
    flex-wrap: wrap;
  }

  .message {
    max-width: 100%;
  }
}
</style>
