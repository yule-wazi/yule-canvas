<template>
  <div class="property-group">
    <div class="info-message">
      <span class="info-icon">ℹ️</span>
      <p>前进到浏览器历史记录的下一页，相当于点击浏览器的"前进"按钮。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 前进模块不需要任何配置
</script>

<style scoped>
.property-group {
  margin-bottom: 1rem;
}

.info-message {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.info-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.info-message p {
  margin: 0;
}
</style>
