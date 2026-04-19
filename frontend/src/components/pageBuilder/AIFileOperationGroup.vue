<template>
  <section class="operation-group" :class="{ 'is-running': group.status === 'running' }">
    <button
      class="operation-toggle"
      type="button"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      <div class="operation-heading">
        <div class="operation-kicker">
          <span class="operation-dot" :class="`tone-${group.tone}`" />
          <p class="operation-title">{{ displayTitle }}</p>
        </div>
        <p class="operation-subtitle">{{ displaySubtitle }}</p>
      </div>

      <div class="operation-meta">
        <span class="operation-count">{{ group.items.length }}</span>
        <span class="operation-chevron" :class="{ 'is-open': isExpanded }" aria-hidden="true">⌄</span>
      </div>
    </button>

    <div v-if="isExpanded" class="operation-list-shell">
      <div class="operation-list">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="operation-row"
        >
          <span class="operation-label">{{ labelFor(item.action) }}</span>
          <span class="operation-path">{{ item.path }}</span>
        </div>

        <p v-if="!group.items.length" class="operation-empty">
          正在整理这轮操作，马上会展示实际查看或变更的文件。
        </p>
      </div>
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

const displayTitle = computed(() => {
  if (props.group.status !== 'done') {
    return props.group.title;
  }

  if (props.group.title !== '处理中') {
    return props.group.title;
  }

  if (props.group.tone === 'inspect') {
    return '已查看当前工作区';
  }

  if (props.group.items.length && props.group.items.every((item) => item.action === 'create')) {
    return '已生成首版工作区';
  }

  return '已整理改动结果';
});

const displaySubtitle = computed(() => {
  if (props.group.status !== 'done') {
    return props.group.subtitle;
  }

  if (props.group.subtitle !== '正在整理当前操作') {
    return props.group.subtitle;
  }

  if (props.group.tone === 'inspect') {
    return '需要的上下文已经整理好，开始落结果';
  }

  if (props.group.items.length && props.group.items.every((item) => item.action === 'create')) {
    return '工作区已经准备好，可以继续对话微调了';
  }

  return '这轮结果已经同步到工作区和预览';
});

watch(
  () => props.group.status,
  (status) => {
    if (status === 'running') {
      isExpanded.value = true;
    }
  }
);

function labelFor(action: PageBuilderFileOperationAction) {
  switch (action) {
    case 'read':
      return '读取';
    case 'update':
      return '更新';
    case 'create':
    default:
      return '新增';
  }
}
</script>

<style scoped>
.operation-group {
  flex: 0 0 auto;
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.015);
}

.operation-group.is-running {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015));
}

.operation-toggle {
  width: 100%;
  padding: 14px 4px;
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
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  gap: 4px;
}

.operation-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
}

.operation-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
}

.operation-dot.tone-inspect {
  background: #89b6ff;
}

.operation-dot.tone-write {
  background: #78b900;
}

.operation-dot.tone-neutral {
  background: #b6becb;
}

.operation-title {
  margin: 0;
  color: #edf2fa;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.operation-subtitle {
  margin: 0;
  color: #8f9aac;
  font-size: 12px;
  line-height: 1.5;
}

.operation-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #8c97a8;
  font-size: 12px;
  flex: 0 0 auto;
}

.operation-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.operation-chevron {
  display: inline-flex;
  font-size: 14px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.operation-chevron.is-open {
  transform: rotate(180deg);
}

.operation-list-shell {
  padding: 0 4px 14px;
}

.operation-list {
  display: grid;
  gap: 8px;
  max-height: min(34vh, 320px);
  overflow-y: auto;
  padding-right: 6px;
}

.operation-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.operation-label {
  color: #dbe4f2;
  font-size: 12px;
  line-height: 1.4;
}

.operation-path {
  min-width: 0;
  color: #9aa8bb;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.operation-empty {
  margin: 0;
  color: #8d99aa;
  font-size: 12px;
  line-height: 1.6;
}
</style>
