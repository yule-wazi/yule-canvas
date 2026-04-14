<template>
  <div class="preview-shell">
    <div class="preview-toolbar">
      <div class="device-toggle">
        <button
          v-for="option in options"
          :key="option.value"
          class="device-btn"
          :class="{ 'is-active': option.value === viewport }"
          type="button"
          @click="$emit('changeViewport', option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <span class="preview-status">{{ files.length ? 'Sandpack preview' : 'No workspace' }}</span>
    </div>

    <div class="preview-stage" :class="`is-${viewport}`">
      <div v-if="!files.length" class="preview-placeholder">
        Create a workspace to start the live preview.
      </div>

      <div v-else ref="mountRef" class="preview-mount"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider
} from '@codesandbox/sandpack-react';
import type { SandpackFiles } from '@codesandbox/sandpack-react';
import type { PageBuilderFile } from '../../types/pageBuilder';

const props = defineProps<{
  files: PageBuilderFile[];
  viewport: 'desktop' | 'tablet' | 'mobile';
}>();

defineEmits<{
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
}>();

const mountRef = ref<HTMLDivElement | null>(null);
let reactRoot: Root | null = null;

const options = [
  { label: 'Desktop', value: 'desktop' as const },
  { label: 'Tablet', value: 'tablet' as const },
  { label: 'Mobile', value: 'mobile' as const }
];

const sandpackFiles = computed<SandpackFiles>(() => {
  return props.files.reduce<SandpackFiles>((result, file) => {
    result[`/${file.path}`] = {
      code: file.content,
      readOnly: !file.editable,
      hidden: file.visibility !== 'project'
    };
    return result;
  }, {
    '/package.json': JSON.stringify({
      name: 'page-builder-demo',
      private: true,
      main: '/src/main.js',
      scripts: {
        serve: 'vue-cli-service serve',
        build: 'vue-cli-service build'
      },
      dependencies: {
        'core-js': '^3.26.1',
        vue: '^3.2.45'
      },
      devDependencies: {
        '@vue/cli-plugin-babel': '^5.0.8',
        '@vue/cli-service': '^5.0.8'
      }
    }, null, 2)
  });
});

async function renderReactPreview() {
  await nextTick();

  if (!mountRef.value) {
    return;
  }

  if (!reactRoot) {
    reactRoot = createRoot(mountRef.value);
  }

  const element = React.createElement(
    SandpackProvider,
    {
      template: 'vue',
      files: sandpackFiles.value,
      options: {
        autorun: true,
        autoReload: true,
        recompileMode: 'immediate',
        recompileDelay: 0,
        logLevel: 10,
        showNavigator: false,
        showRefreshButton: false,
        showOpenInCodeSandbox: false,
        showLineNumbers: false,
        showTabs: false
      }
    },
    React.createElement(
      SandpackLayout,
      {
        style: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '0',
          overflow: 'hidden',
          background: '#050505'
        }
      },
      React.createElement(SandpackPreview, {
        showNavigator: false,
        showOpenInCodeSandbox: false,
        showRefreshButton: false,
        showRestartButton: false,
        style: {
          width: '100%',
          height: '100%'
        }
      })
    )
  );

  reactRoot.render(element);
}

watch(
  () => props.files,
  async () => {
    await renderReactPreview();
  },
  { deep: true, flush: 'post' }
);

onMounted(() => {
  void renderReactPreview();
});

onBeforeUnmount(() => {
  reactRoot?.unmount();
  reactRoot = null;
});
</script>

<style scoped>
.preview-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #050505;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-default);
  background: rgba(10, 10, 10, 0.98);
}

.device-toggle {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.device-btn {
  min-height: 34px;
  min-width: 76px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.device-btn.is-active {
  background: rgba(118, 185, 0, 0.14);
  color: var(--color-text-primary);
}

.preview-status {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.preview-stage {
  display: flex;
  flex: 1;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  padding: 0;
  background: #050505;
}

.preview-stage.is-desktop .preview-mount {
  width: 100%;
}

.preview-stage.is-tablet .preview-mount {
  width: 960px;
  max-width: 100%;
}

.preview-stage.is-mobile .preview-mount {
  width: 440px;
  max-width: 100%;
}

.preview-mount {
  width: 100%;
  height: 100%;
  min-height: 100%;
  background: #050505;
}

.preview-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 100%;
  color: var(--color-text-secondary);
}

:deep(.sp-wrapper),
:deep(.sp-layout),
:deep(.sp-stack) {
  height: 100%;
}

:deep(.sp-preview-container) {
  height: 100%;
  border: 0;
}
</style>
