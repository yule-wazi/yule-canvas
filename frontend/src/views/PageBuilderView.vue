<template>
  <div class="page-builder-view">
    <PageBuilderTopBar
      :title="store.pageTitle || 'Untitled Workspace'"
      :table-name="selectedTable?.name || 'No table selected'"
      :page-type="store.pageType"
      :style-preset="store.stylePreset"
      :center-mode="store.centerMode"
      :setup-open="store.isSetupDrawerOpen"
      @change-mode="store.setCenterMode"
      @generate="createWorkspace"
      @toggle-setup="store.toggleSetupDrawer"
    />

    <div class="page-builder-body">
      <PageBuilderFileTree
        :nodes="store.tree"
        :file-count="store.files.length"
        :active-file-id="store.activeFileId"
        @select-file="openFile"
      />

      <div class="page-builder-center">
        <PageBuilderSandbox
          :mode="store.centerMode"
          :files="store.files"
          :active-file-id="store.activeFileId"
          :viewport="viewport"
          :data-title="dataTitle"
          :data-description="dataDescription"
          :data-content="dataContent"
          @select-file="openFile"
          @update-content="store.updateActiveFileContent"
          @change-viewport="viewport = $event"
        />

        <div v-if="store.error" class="error-banner">{{ store.error }}</div>
      </div>

      <PageBuilderSetupDrawer
        :open="store.isSetupDrawerOpen"
        :tables="dataTableStore.tables"
        :selected-table-id="store.selectedTableId"
        :goal="store.goal"
        :field-role-map="store.fieldRoleMap"
        @generate="createWorkspace"
        @update:selected-table-id="store.setSelectedTable($event, dataTableStore.tables)"
        @update:goal="store.goal = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageBuilderFileTree from '../components/pageBuilder/PageBuilderFileTree.vue';
import PageBuilderSandbox from '../components/pageBuilder/PageBuilderSandbox.vue';
import PageBuilderSetupDrawer from '../components/pageBuilder/PageBuilderSetupDrawer.vue';
import PageBuilderTopBar from '../components/pageBuilder/PageBuilderTopBar.vue';
import { useDataTableStore } from '../stores/dataTable';
import { usePageBuilderStore } from '../stores/pageBuilder';

const dataTableStore = useDataTableStore();
const store = usePageBuilderStore();
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop');

const selectedTable = computed(() =>
  dataTableStore.tables.find((table) => table.id === store.selectedTableId) || null
);

const dataTitle = computed(() => `${selectedTable.value?.name || 'Current table'} JSON`);

const dataDescription = computed(() => {
  if (!selectedTable.value) {
    return 'No data table selected.';
  }

  return `${selectedTable.value.rows.length} rows, ${selectedTable.value.columns.length} columns`;
});

const dataContent = computed(() =>
  JSON.stringify(
    selectedTable.value
      ? {
          id: selectedTable.value.id,
          name: selectedTable.value.name,
          columns: selectedTable.value.columns,
          rows: selectedTable.value.rows
        }
      : { columns: [], rows: [] },
    null,
    2
  )
);

onMounted(() => {
  dataTableStore.init();
  store.initialize(dataTableStore.tables);
});

watch(
  () => dataTableStore.tables,
  (tables) => {
    store.initialize(tables);
  },
  { deep: true }
);

function createWorkspace() {
  store.createWorkspaceFromTable(dataTableStore.tables);
}

function openFile(fileId: string) {
  store.setActiveFile(fileId);
  store.setCenterMode('code');
}
</script>

<style scoped>
.page-builder-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(118, 185, 0, 0.08) 0%, transparent 24%),
    linear-gradient(180deg, rgba(3, 3, 3, 1) 0%, rgba(0, 0, 0, 1) 100%);
  overflow: hidden;
}

.page-builder-body {
  position: relative;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.page-builder-center {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.error-banner {
  margin: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-danger);
  border-radius: var(--radius-sm);
  background: rgba(101, 11, 11, 0.4);
  color: #ffb0b0;
}

@media (max-width: 1200px) {
  .page-builder-body {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}

@media (max-width: 980px) {
  .page-builder-body {
    grid-template-columns: 1fr;
  }

  .page-builder-center {
    order: 2;
  }
}
</style>
