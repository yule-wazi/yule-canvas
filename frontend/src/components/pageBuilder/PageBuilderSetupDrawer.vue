<template>
  <aside class="setup-drawer" :class="{ 'is-open': open }">
    <div class="drawer-header">
      <div>
        <p class="eyebrow">生成配置</p>
        <h2>配置输入项</h2>
      </div>
      <button class="close-btn" type="button" @click="$emit('close')">关闭</button>
    </div>

    <div class="drawer-body">
      <label class="field">
        <span>数据表</span>
        <select :value="selectedTableId || ''" @change="$emit('update:selectedTableId', ($event.target as HTMLSelectElement).value)">
          <option value="" disabled>请选择数据表</option>
          <option v-for="table in tables" :key="table.id" :value="table.id">
            {{ table.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>页面类型</span>
        <select :value="pageType" @change="$emit('update:pageType', ($event.target as HTMLSelectElement).value as any)">
          <option value="news-list">新闻列表</option>
          <option value="article-detail">文章详情</option>
          <option value="gallery">图片画廊</option>
          <option value="catalog">卡片目录</option>
        </select>
      </label>

      <label class="field">
        <span>风格预设</span>
        <select :value="stylePreset" @change="$emit('update:stylePreset', ($event.target as HTMLSelectElement).value as any)">
          <option value="nvidia-tech">英伟达科技风</option>
          <option value="editorial-dark">编辑部深色风</option>
          <option value="clean-catalog">清爽目录风</option>
        </select>
      </label>

      <label class="field">
        <span>页面标题</span>
        <input :value="pageTitle" type="text" @input="$emit('update:pageTitle', ($event.target as HTMLInputElement).value)" />
      </label>

      <label class="field">
        <span>页面目标</span>
        <textarea :value="goal" rows="4" @input="$emit('update:goal', ($event.target as HTMLTextAreaElement).value)" />
      </label>

      <label class="field">
        <span>布局密度</span>
        <select :value="density" @change="$emit('update:density', ($event.target as HTMLSelectElement).value as any)">
          <option value="comfortable">舒展</option>
          <option value="compact">紧凑</option>
        </select>
      </label>

      <div class="field-role-panel">
        <div class="field-role-header">
          <span>推断字段角色</span>
          <strong>{{ Object.keys(fieldRoleMap).length }}</strong>
        </div>
        <div v-if="Object.keys(fieldRoleMap).length" class="field-role-list">
          <div v-for="(role, field) in fieldRoleMap" :key="field" class="field-role-item">
            <span>{{ field }}</span>
            <strong>{{ role }}</strong>
          </div>
        </div>
        <p v-else class="field-role-empty">选择数据表后，这里会显示字段角色推断结果。</p>
      </div>
    </div>

    <div class="drawer-footer">
      <button class="secondary-btn" type="button" @click="$emit('close')">收起</button>
      <button class="primary-btn" type="button" @click="$emit('generate')">生成页面</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { DataTable } from '../../stores/dataTable';
import type { PageBuilderPageType, PageBuilderStylePreset } from '../../types/pageBuilder';

defineProps<{
  open: boolean;
  tables: DataTable[];
  selectedTableId: string | null;
  pageType: PageBuilderPageType;
  stylePreset: PageBuilderStylePreset;
  pageTitle: string;
  goal: string;
  density: 'compact' | 'comfortable';
  fieldRoleMap: Record<string, string>;
}>();

defineEmits<{
  close: [];
  generate: [];
  'update:selectedTableId': [value: string];
  'update:pageType': [value: PageBuilderPageType];
  'update:stylePreset': [value: PageBuilderStylePreset];
  'update:pageTitle': [value: string];
  'update:goal': [value: string];
  'update:density': [value: 'compact' | 'comfortable'];
}>();
</script>

<style scoped>
.setup-drawer {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(420px, 100%);
  max-width: 100%;
  height: 100%;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  background: linear-gradient(180deg, rgba(12, 12, 12, 0.98) 0%, rgba(3, 3, 3, 0.98) 100%);
  border-left: 1px solid var(--color-border-default);
  box-shadow: rgba(0, 0, 0, 0.4) -12px 0 24px;
  overflow: hidden;
}

.setup-drawer.is-open {
  transform: translateX(0);
}

.drawer-header,
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border-default);
}

.drawer-footer {
  border-top: 1px solid var(--color-border-default);
  border-bottom: 0;
  margin-top: auto;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-brand-accent);
}

.drawer-header h2 {
  margin: 0;
  font-size: 20px;
}

.close-btn,
.primary-btn,
.secondary-btn {
  min-height: 42px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.close-btn,
.secondary-btn {
  border: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-text-primary);
}

.close-btn {
  min-width: 64px;
}

.primary-btn {
  border: 2px solid var(--color-brand-accent);
  background: transparent;
  color: var(--color-text-primary);
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 18px 20px 24px;
  overflow: auto;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-primary);
}

.field textarea {
  resize: vertical;
  min-height: 96px;
}

.field-role-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.field-role-header,
.field-role-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.field-role-header span,
.field-role-empty,
.field-role-item span {
  color: var(--color-text-secondary);
}

.field-role-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 980px) {
  .setup-drawer {
    width: 100%;
    border-left: 0;
  }
}
</style>
