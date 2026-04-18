<template>
  <section class="operation-group" :class="{ 'is-running': group.status === 'running' }">
    <button
      class="operation-toggle"
      type="button"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      <div class="operation-heading">
        <p class="operation-title">{{ title }}</p>
        <p class="operation-subtitle">{{ subtitle }}</p>
      </div>

      <div class="operation-meta">
        <span class="operation-time">{{ formatTime(group.createdAt) }}</span>
        <span class="operation-chevron" :class="{ 'is-open': isExpanded }">⌃</span>
      </div>
    </button>

    <div v-if="isExpanded" class="operation-list">
      <div
        v-for="item in group.items"
        :key="item.id"
        class="operation-row"
      >
        <span class="operation-icon">{{ iconFor(item.action) }}</span>
        <strong>{{ labelFor(item.action) }}</strong>
        <span class="operation-path">{{ item.path }}</span>
      </div>

      <p v-if="!group.items.length" class="operation-empty">
        正在等待首个文件完成…
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  PageBuilderConversationOperationGroup,
  PageBuilderFileOperationAction
} from '../../types/pageBuilder';

const props = defineProps<{
  group: PageBuilderConversationOperationGroup;
}>();

const isExpanded = ref(props.group.status === 'running');

watch(
  () => props.group.status,
  (status) => {
    if (status === 'running') {
      isExpanded.value = true;
    }
  }
);

const title = computed(() => (
  props.group.status === 'running' ? '正在处理文件' : `已执行 ${props.group.items.length} 个任务`
));

const subtitle = computed(() => {
  if (!props.group.items.length) {
    return '等待返回第一个文件';
  }

  const latest = props.group.items[props.group.items.length - 1];
  return `${labelFor(latest.action)} ${latest.path}`;
});

function labelFor(action: PageBuilderFileOperationAction) {
  switch (action) {
    case 'read':
      return '读取内容';
    case 'update':
      return '更新内容';
    case 'create':
    default:
      return '新增内容';
  }
}

function iconFor(action: PageBuilderFileOperationAction) {
  switch (action) {
    case 'read':
      return '○';
    case 'update':
      return '↺';
    case 'create':
    default:
      return '+';
  }
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<style scoped>
.operation-group {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.operation-group.is-running {
  border-color: rgba(118, 185, 0, 0.24);
  background: linear-gradient(180deg, rgba(118, 185, 0, 0.08), rgba(255, 255, 255, 0.03));
}

.operation-toggle {
  width: 100%;
  padding: 16px;
  border: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
  cursor: pointer;
}

.operation-heading {
  display: grid;
  gap: 6px;
}

.operation-title {
  margin: 0;
  color: #f5f7fb;
  font-size: 16px;
  font-weight: 700;
}

.operation-subtitle {
  margin: 0;
  color: #9fb08a;
  font-size: 13px;
}

.operation-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #97a1b2;
  font-size: 12px;
}

.operation-chevron {
  display: inline-flex;
  transition: transform 0.2s ease;
}

.operation-chevron.is-open {
  transform: rotate(180deg);
}

.operation-list {
  display: grid;
  gap: 10px;
  padding: 0 16px 16px;
}

.operation-row {
  display: grid;
  grid-template-columns: 18px auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.22);
  color: #dce5f2;
}

.operation-row strong {
  color: #f5f7fb;
  font-size: 14px;
}

.operation-icon {
  color: #b7d98b;
  font-weight: 700;
  text-align: center;
}

.operation-path {
  min-width: 0;
  color: #a9b5c7;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.operation-empty {
  margin: 0;
  padding: 10px 12px 2px;
  color: #97a1b2;
  font-size: 13px;
}
</style>
