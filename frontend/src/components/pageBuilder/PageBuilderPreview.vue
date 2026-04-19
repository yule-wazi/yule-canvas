<template>
  <div class="preview-shell">
    <div class="preview-stage" :class="`is-${viewport}`">
      <div v-if="!files.length" class="preview-placeholder">
        Create a workspace to start the live preview.
      </div>

      <div v-else :key="mountVersion" ref="mountRef" class="preview-mount"></div>
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
import type { PageBuilderFile, PageBuilderPreviewTableSnapshot } from '../../types/pageBuilder';

const props = defineProps<{
  files: PageBuilderFile[];
  tableSnapshot: PageBuilderPreviewTableSnapshot | null;
  reloadKey: number;
  viewport: 'desktop' | 'tablet' | 'mobile';
}>();

defineEmits<{
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
}>();

const mountRef = ref<HTMLDivElement | null>(null);
const mountVersion = ref(0);
let reactRoot: Root | null = null;

const sandpackFiles = computed<SandpackFiles>(() => {
  const result = props.files.reduce<SandpackFiles>((files, file) => {
    files[`/${file.path}`] = {
      code: file.content,
      readOnly: !file.editable,
      hidden: file.visibility !== 'project'
    };
    return files;
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

  result['/src/data/__runtimeTableData.js'] = {
    code: createRuntimeTableDataModule(props.tableSnapshot),
    readOnly: true,
    hidden: true
  };

  return result;
});

function createRuntimeTableDataModule(snapshot: PageBuilderPreviewTableSnapshot | null) {
  const payload = JSON.stringify(snapshot || {
    table: {
      id: '',
      name: 'Selected Table',
      columns: [],
      rowCount: 0
    },
    rows: []
  }, null, 2);

  return `const RAW_TABLE_SNAPSHOT_JSON = ${JSON.stringify(payload)};

export function readRuntimeTableSnapshot() {
  return JSON.parse(RAW_TABLE_SNAPSHOT_JSON);
}
`;
}

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
      key: `sandpack-${props.reloadKey}`,
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

async function remountPreview() {
  reactRoot?.unmount();
  reactRoot = null;
  mountVersion.value += 1;
  await nextTick();
  await renderReactPreview();
}

watch(
  () => [props.files, props.tableSnapshot],
  async () => {
    await renderReactPreview();
  },
  { deep: true, flush: 'post' }
);

watch(
  () => props.reloadKey,
  async () => {
    await remountPreview();
  },
  { flush: 'post' }
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
