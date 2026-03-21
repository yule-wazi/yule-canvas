<template>
  <div class="property-form">
    <div class="form-group">
      <label>图片选择器</label>
      <input
        v-model="localData.selector"
        type="text"
        placeholder="默认: img"
        @input="emitUpdate"
      />
      <small>CSS选择器，用于定位图片元素</small>
    </div>

    <div class="form-group">
      <label>
        <input
          v-model="localData.filterInvalid"
          type="checkbox"
          @change="emitUpdate"
        />
        过滤无效图片
      </label>
    </div>

    <div class="form-group">
      <label>提取属性</label>
      <div class="checkbox-group">
        <label>
          <input
            type="checkbox"
            value="src"
            :checked="localData.attributes.includes('src')"
            @change="toggleAttribute('src')"
          />
          src
        </label>
        <label>
          <input
            type="checkbox"
            value="data-src"
            :checked="localData.attributes.includes('data-src')"
            @change="toggleAttribute('data-src')"
          />
          data-src
        </label>
        <label>
          <input
            type="checkbox"
            value="data-lazy-src"
            :checked="localData.attributes.includes('data-lazy-src')"
            @change="toggleAttribute('data-lazy-src')"
          />
          data-lazy-src
        </label>
      </div>
    </div>

    <div class="form-group">
      <label>等待超时 (毫秒)</label>
      <input
        v-model.number="localData.timeout"
        type="number"
        min="1000"
        step="1000"
        @input="emitUpdate"
      />
      <small>等待图片元素出现的最长时间</small>
    </div>

    <div class="form-group">
      <label>保存到数据表</label>
      <select v-model="localData.saveToTable" @change="emitUpdate">
        <option value="">不保存</option>
        <option v-for="table in dataTables" :key="table.id" :value="table.id">
          {{ table.name }}
        </option>
      </select>
      <small>选择要保存图片的数据表</small>
    </div>

    <div class="form-group" v-if="localData.saveToTable">
      <label>保存到列</label>
      <select v-model="localData.saveToColumn" @change="emitUpdate">
        <option value="">选择列</option>
        <option v-for="column in selectedTableColumns" :key="column.key" :value="column.key">
          {{ column.key }} ({{ column.type }})
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import type { Block } from '../../../types/block';
import { useDataTableStore } from '../../../stores/dataTable';

const dataTableStore = useDataTableStore();

// 初始化数据表 store
onMounted(() => {
  dataTableStore.init();
});

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  update: [data: any];
}>();

// 初始化 localData，确保所有字段都有默认值
const defaultData = {
  selector: 'img',
  filterInvalid: true,
  attributes: ['src', 'data-src'],
  timeout: 5000,
  saveToTable: '',
  saveToColumn: ''
};

const localData = ref({ ...defaultData, ...props.block.data });

watch(() => props.block.data, (newData) => {
  localData.value = { ...defaultData, ...newData };
}, { deep: true });

const dataTables = computed(() => dataTableStore.tables);

const selectedTableColumns = computed(() => {
  if (!localData.value.saveToTable) return [];
  const table = dataTableStore.getTableById(localData.value.saveToTable);
  return table ? table.columns : [];
});

function toggleAttribute(attr: string) {
  const index = localData.value.attributes.indexOf(attr);
  if (index > -1) {
    localData.value.attributes.splice(index, 1);
  } else {
    localData.value.attributes.push(attr);
  }
  emitUpdate();
}

function emitUpdate() {
  emit('update', localData.value);
}
</script>

<style scoped>
.property-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  color: #8b949e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0.5rem;
}

.checkbox-group label {
  font-size: 0.85rem;
}

input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

input[type="text"],
input[type="number"] {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

input[type="text"]:focus,
input[type="number"]:focus {
  outline: none;
  border-color: #58a6ff;
}

small {
  font-size: 0.8rem;
  color: #6e7681;
  margin-top: -0.25rem;
}
</style>
