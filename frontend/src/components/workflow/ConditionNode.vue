<template>
  <div class="condition-node" :style="nodeStyle">
    <Handle
      type="target"
      :position="Position.Left"
      id="target-left"
      :connectable="true"
      :style="{ left: '-6px', top: '50%', transform: 'translateY(-50%)' }"
    />

    <div class="node-content">
      <div class="node-badge">条件</div>
      <div class="node-title">{{ data.label }}</div>
      <div class="branch-list">
        <div v-for="(output, index) in pathOutputs" :key="output.id" class="branch-row">
          <span class="branch-name">{{ output.name }}</span>
          <Handle
            type="source"
            :position="Position.Right"
            :id="output.id"
            :connectable="true"
            :style="getHandleStyle(index, pathOutputs.length)"
          />
        </div>
      </div>
    </div>

    <div v-if="fallbackOutput" class="fallback-row">
      <span class="fallback-name">{{ fallbackOutput.name }}</span>
      <Handle
        type="source"
        :position="Position.Bottom"
        :id="fallbackOutput.id"
        :connectable="true"
        :style="{ bottom: '-6px', left: '50%', transform: 'translateX(-50%)' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';

interface Props {
  data: any;
  nodeStyle?: any;
}

const { data, nodeStyle } = defineProps<Props>();

const flowOutputs = computed(() =>
  (Array.isArray(data?.outputs) ? data.outputs : []).filter((output: any) => output.type === 'flow')
);

const pathOutputs = computed(() =>
  flowOutputs.value.filter((output: any) => output.id !== 'condition-fallback-bottom')
);

const fallbackOutput = computed(() =>
  flowOutputs.value.find((output: any) => output.id === 'condition-fallback-bottom') || null
);

function getHandleStyle(index: number, total: number) {
  const offset = total <= 1 ? 50 : ((index + 1) / (total + 1)) * 100;
  return {
    right: '-6px',
    left: 'auto',
    top: `${offset}%`,
    transform: 'translateY(-50%)'
  };
}
</script>

<style scoped>
.condition-node {
  position: relative;
  min-width: 220px;
  border: 2px solid #bff230;
  border-radius: 2px;
  background: linear-gradient(180deg, #26310f 0%, #171f0a 100%);
  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;
}

.node-content {
  padding: 14px 20px;
}

.node-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  padding: 6px 12px;
  border-radius: 2px;
  background: transparent;
  border: 1px solid #bff230;
  color: #bff230;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.node-title {
  margin-bottom: 10px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  font-family: Arial, Helvetica, sans-serif;
}

.branch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-row {
  position: relative;
  min-height: 32px;
  display: flex;
  align-items: center;
  padding: 8px 28px 8px 10px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(191, 242, 48, 0.22);
}

.branch-name {
  color: #ffffff;
  font-size: 13px;
  user-select: none;
  font-weight: 700;
}

.fallback-row {
  position: relative;
  padding: 0 20px 14px;
  text-align: center;
}

.fallback-name {
  display: inline-block;
  color: #a7a7a7;
  font-size: 12px;
  user-select: none;
  font-weight: 700;
  text-transform: uppercase;
}
</style>
