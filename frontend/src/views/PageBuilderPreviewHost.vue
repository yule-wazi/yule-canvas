<template>
  <div class="preview-host">
    <div v-if="error" class="preview-error">
      <p class="error-title">Preview failed</p>
      <pre class="error-body">{{ error }}</pre>
    </div>

    <div v-else ref="mountRef" class="preview-stage"></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api';
import type { PageBuilderPreviewSessionSnapshot } from '../types/pageBuilder';
import { mountPageBuilderPreviewRuntime } from '../utils/pageBuilderPreviewRuntime';

const route = useRoute();
const mountRef = ref<HTMLElement | null>(null);
const error = ref('');
let cleanup: (() => void) | null = null;

async function loadPreview() {
  const sessionId = String(route.params.sessionId || '').trim();
  if (!sessionId || !mountRef.value) {
    return;
  }

  error.value = '';
  cleanup?.();
  cleanup = null;

  try {
    const snapshot = await api.get(`/page-builder/preview-sessions/${encodeURIComponent(sessionId)}`) as PageBuilderPreviewSessionSnapshot;
    await nextTick();

    if (!mountRef.value) {
      return;
    }

    cleanup = await mountPageBuilderPreviewRuntime(mountRef.value, snapshot);
  } catch (err: any) {
    error.value = err?.message || 'Unable to load preview session.';
  }
}

watch(
  () => [route.params.sessionId, route.query.v],
  () => {
    void loadPreview();
  },
  { immediate: true }
);

onMounted(() => {
  void loadPreview();
});

onBeforeUnmount(() => {
  cleanup?.();
  cleanup = null;
});
</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  margin: 0 !important;
  min-height: 100vh !important;
  background: #fff !important;
  color: initial !important;
}

:global(body) {
  font-family: initial !important;
}

.preview-host {
  min-height: 100vh;
  background: #fff;
  color: #111;
}

.preview-stage {
  min-height: 100vh;
}

.preview-error {
  padding: 24px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.error-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
}

.error-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
