<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import Layout from './components/Layout.vue';

const route = useRoute();
const isPreviewHostRoute = computed(() => route.name === 'page-builder-preview-host');
</script>

<template>
  <RouterView v-if="isPreviewHostRoute" />
  <Layout v-else />
</template>

<style>
body {
  font-family: var(--font-family-sans);
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

#app {
  min-height: 100vh;
  background: var(--color-bg-page);
}
</style>
