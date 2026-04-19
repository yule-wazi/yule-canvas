<template>
  <div class="preview-shell">
    <div class="preview-stage" :class="`is-${viewport}`">
      <div v-if="!files.length" class="preview-placeholder">
        Create a workspace to start the live preview.
      </div>

      <iframe
        v-else
        :key="frameKey"
        class="preview-frame"
        :src="previewUrl"
        title="Page Builder Preview"
        loading="eager"
        referrerpolicy="no-referrer"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import api from '../../services/api';
import type { PageBuilderFile, PageBuilderPreviewTableSnapshot } from '../../types/pageBuilder';

const props = defineProps<{
  files: PageBuilderFile[];
  tableSnapshot: PageBuilderPreviewTableSnapshot | null;
  reloadKey: number;
  viewport: 'desktop' | 'tablet' | 'mobile';
  workspaceId: string | null;
}>();

const draftSessionId = createDraftPreviewSessionId();
const frameKey = ref(0);
const syncNonce = ref(0);
let syncSerial = 0;

const sessionId = computed(() => props.workspaceId || draftSessionId);

const previewUrl = computed(() => {
  const url = new URL(`/page-builder-preview-host/${encodeURIComponent(sessionId.value)}`, window.location.origin);
  url.searchParams.set('v', String(syncNonce.value));
  return url.toString();
});

watch(
  () => [props.files, props.tableSnapshot],
  () => {
    void syncPreviewSession(false);
  },
  { deep: true, immediate: true }
);

watch(
  () => props.reloadKey,
  () => {
    void syncPreviewSession(true);
  }
);

async function syncPreviewSession(forceReload: boolean) {
  if (!props.files.length) {
    return;
  }

  const currentSerial = ++syncSerial;

  try {
    await api.post(`/page-builder/preview-sessions/${encodeURIComponent(sessionId.value)}`, {
      files: buildRuntimeFiles(props.files, props.tableSnapshot),
      updatedAt: Date.now()
    });

    if (currentSerial !== syncSerial) {
      return;
    }

    syncNonce.value = Date.now();
    if (forceReload) {
      frameKey.value += 1;
    }
  } catch (error) {
    console.error('Failed to sync preview session:', error);
  }
}

function buildRuntimeFiles(files: PageBuilderFile[], tableSnapshot: PageBuilderPreviewTableSnapshot | null) {
  const runtimeFiles = files.map((file) => ({
    path: file.path,
    content: file.content,
    editable: file.editable,
    visibility: file.visibility === 'internal' ? 'internal' : 'project',
    type: file.type
  }));

  runtimeFiles.push({
    path: 'src/data/__runtimeTableData.js',
    content: createRuntimeTableDataModule(tableSnapshot),
    editable: false,
    visibility: 'internal' as const,
    type: 'js'
  });

  return runtimeFiles;
}

function createRuntimeTableDataModule(snapshot: PageBuilderPreviewTableSnapshot | null) {
  const payload = JSON.stringify(
    snapshot || {
      table: {
        id: '',
        name: 'Selected Table',
        columns: [],
        rowCount: 0
      },
      rows: []
    },
    null,
    2
  );

  return `const RAW_TABLE_SNAPSHOT_JSON = ${JSON.stringify(payload)};

export function readRuntimeTableSnapshot() {
  return JSON.parse(RAW_TABLE_SNAPSHOT_JSON);
}
`;
}

function createDraftPreviewSessionId() {
  if (typeof window === 'undefined') {
    return 'draft-preview';
  }

  const storageKey = 'page-builder:preview-session-id';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const nextId = `draft-${window.crypto?.randomUUID?.() || Date.now().toString(36)}`;
  window.sessionStorage.setItem(storageKey, nextId);
  return nextId;
}
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

.preview-stage.is-desktop .preview-frame {
  width: 100%;
}

.preview-stage.is-tablet .preview-frame {
  width: 960px;
  max-width: 100%;
}

.preview-stage.is-mobile .preview-frame {
  width: 440px;
  max-width: 100%;
}

.preview-frame {
  width: 100%;
  height: 100%;
  min-height: 100%;
  border: 0;
  background: #fff;
}

.preview-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 100%;
  color: var(--color-text-secondary);
}
</style>
