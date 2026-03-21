<template>
  <div class="property-form">
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Block } from '../../../types/block';

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  update: [data: any];
}>();

const localData = ref({ ...props.block.data });

watch(() => props.block.data, (newData) => {
  localData.value = { ...newData };
}, { deep: true });

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
</style>
