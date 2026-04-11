<template>
  <aside class="page-builder-rightpanel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">检查面板</p>
        <h2>{{ panelTitle }}</h2>
      </div>
      <span class="panel-state">{{ selectedSection ? '区块' : activeFile ? '文件' : '空闲' }}</span>
    </div>

    <div v-if="selectedSection" class="inspector-card">
      <div class="info-row">
        <span>类型</span>
        <strong>{{ sectionTypeLabel(selectedSection.type) }}</strong>
      </div>
      <div class="info-row">
        <span>是否重复</span>
        <strong>{{ selectedSection.repeat ? '是' : '否' }}</strong>
      </div>
      <div class="info-group">
        <p class="group-title">字段绑定</p>
        <div v-if="Object.keys(selectedSection.bindings).length" class="binding-list">
          <div v-for="(field, key) in selectedSection.bindings" :key="key" class="binding-row">
            <span>{{ key }}</span>
            <strong>{{ field }}</strong>
          </div>
        </div>
        <p v-else class="hint">还没有分配绑定字段。</p>
      </div>
      <p v-if="selectedSection.description" class="hint">{{ selectedSection.description }}</p>
    </div>

    <div v-else-if="activeFile" class="inspector-card">
      <div class="info-row">
        <span>文件</span>
        <strong>{{ activeFile.name }}</strong>
      </div>
      <div class="info-row">
        <span>作用</span>
        <strong>{{ activeFile.role }}</strong>
      </div>
      <div class="info-row">
        <span>是否可编辑</span>
        <strong>{{ activeFile.editable ? '可编辑' : '只读' }}</strong>
      </div>
      <div class="info-group">
        <p class="group-title">来源区块</p>
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
        <p v-else class="hint">暂时没有区块映射信息。</p>
      </div>
    </div>

    <div v-else class="inspector-card inspector-card--empty">
      <p>选择一个文件或生成区块后，这里会显示绑定关系和上下文信息。</p>
    </div>

    <div class="section-list">
      <p class="group-title">已生成区块</p>
      <button
        v-for="section in sections"
        :key="section.id"
        class="section-item"
        :class="{ 'is-active': section.id === selectedSectionId }"
        type="button"
        @click="$emit('selectSection', section.id)"
      >
        <strong>{{ section.title }}</strong>
        <span>{{ sectionTypeLabel(section.type) }}</span>
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

  return '未选择内容';
});

function sectionTypeLabel(type: PageBuilderSectionSummary['type']) {
  const map: Record<PageBuilderSectionSummary['type'], string> = {
    hero: '首屏',
    list: '列表',
    grid: '网格',
    'featured-card': '重点卡片',
    content: '正文',
    media: '媒体',
    footer: '页脚'
  };

  return map[type];
}
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
