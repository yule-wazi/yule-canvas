<template>
  <div class="layout">
    <header v-if="showHeader" class="header">
      <div class="brand">
        <span class="brand-kicker">YULECANVAS</span>
        <h1>数据抓取 Agent</h1>
      </div>
      <nav>
        <router-link to="/">首页</router-link>
        <router-link to="/workflow">可视化编辑器</router-link>
        <router-link to="/data">数据管理</router-link>
        <router-link to="/page-builder">Page Builder</router-link>
      </nav>
    </header>
    <main
      :class="[
        'main',
        {
          'main--workflow': route.name === 'workflow',
          'main--page-builder': route.name === 'page-builder'
        }
      ]"
    >
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const showHeader = computed(() => route.name !== 'page-builder');
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 32px;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border-default);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-kicker {
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-brand-accent);
}

.header h1 {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: 700;
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
}

nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

nav a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 11px 13px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: var(--text-link);
  font-weight: 700;
  text-transform: uppercase;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

nav a:hover {
  color: var(--color-brand-link-hover);
  border-bottom-color: var(--color-brand-accent);
}

nav a.router-link-active {
  background: transparent;
  border: 2px solid var(--color-brand-accent);
  color: var(--color-text-primary);
}

.main {
  flex: 1;
  min-height: 0;
  padding: 32px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 1) 100%);
}

.main--workflow,
.main--page-builder {
  padding: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }

  nav {
    width: 100%;
    flex-wrap: wrap;
  }

  .main {
    padding: 20px 16px;
  }

  .main--workflow,
  .main--page-builder {
    padding: 0;
  }
}
</style>
