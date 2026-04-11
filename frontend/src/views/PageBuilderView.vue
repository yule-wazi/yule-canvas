<template>
  <div class="page-builder-view">
    <PageBuilderTopBar
      :title="store.pageTitle || 'Untitled Page Project'"
      :table-name="selectedTable?.name || 'No table selected'"
      :page-type="store.pageType"
      :style-preset="store.stylePreset"
      :center-mode="store.centerMode"
      :setup-open="store.isSetupDrawerOpen"
      @change-mode="store.setCenterMode"
      @generate="generate"
      @toggle-setup="store.toggleSetupDrawer"
    />

    <div class="page-builder-body">
      <PageBuilderFileTree
        :files="store.files"
        :active-file-id="store.activeFileId"
        @select-file="store.setActiveFile"
      />

      <div class="page-builder-center">
        <PageBuilderSandbox
          :mode="store.centerMode"
          :files="store.files"
          :active-file-id="store.activeFileId"
          :preview-html="store.previewHtml"
          :viewport="viewport"
          :status-label="statusLabel"
          @select-file="store.setActiveFile"
          @change-viewport="viewport = $event"
        />

        <div v-if="store.error" class="error-banner">{{ store.error }}</div>
      </div>

      <PageBuilderRightPanel
        :active-file="store.activeFile"
        :sections="store.sectionSummaries"
        :selected-section-id="store.selectedSectionId"
        @select-section="store.selectSection"
      />

      <PageBuilderSetupDrawer
        :open="store.isSetupDrawerOpen"
        :tables="dataTableStore.tables"
        :selected-table-id="store.selectedTableId"
        :page-type="store.pageType"
        :style-preset="store.stylePreset"
        :page-title="store.pageTitle"
        :goal="store.goal"
        :density="store.density"
        :field-role-map="store.fieldRoleMap"
        @close="store.toggleSetupDrawer(false)"
        @generate="generate"
        @update:selected-table-id="store.setSelectedTable($event, dataTableStore.tables)"
        @update:page-type="store.pageType = $event"
        @update:style-preset="store.stylePreset = $event"
        @update:page-title="store.pageTitle = $event"
        @update:goal="store.goal = $event"
        @update:density="store.density = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageBuilderFileTree from '../components/pageBuilder/PageBuilderFileTree.vue';
import PageBuilderRightPanel from '../components/pageBuilder/PageBuilderRightPanel.vue';
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

const statusLabel = computed(() => {
  if (store.previewStatus === 'ready') {
    return 'Preview ready';
  }

  if (store.previewStatus === 'building') {
    return 'Building preview';
  }

  if (store.previewStatus === 'error') {
    return 'Generation blocked';
  }

  return 'Awaiting generation';
});

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

function generate() {
  store.generateFromTable(dataTableStore.tables);
}
</script>

<style scoped>
.page-builder-view {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 83px);
  background:
    radial-gradient(circle at top right, rgba(118, 185, 0, 0.08) 0%, transparent 24%),
    linear-gradient(180deg, rgba(3, 3, 3, 1) 0%, rgba(0, 0, 0, 1) 100%);
}

.page-builder-body {
  position: relative;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  flex: 1;
  min-height: 0;
}

.page-builder-center {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  padding: 18px;
}

.error-banner {
  padding: 12px 14px;
  border: 1px solid var(--color-border-danger);
  border-radius: var(--radius-sm);
  background: rgba(101, 11, 11, 0.4);
  color: #ffb0b0;
}

@media (max-width: 1200px) {
  .page-builder-body {
    grid-template-columns: 240px minmax(0, 1fr) 280px;
  }
}

@media (max-width: 980px) {
  .page-builder-view {
    min-height: auto;
  }

  .page-builder-body {
    grid-template-columns: 1fr;
  }

  .page-builder-center {
    order: 2;
  }
}
</style>
