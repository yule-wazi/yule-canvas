<template>
  <div class="loop-node" :style="nodeStyle">
    <Handle
      type="source"
      :position="Position.Left"
      id="loop-start"
      :connectable="true"
      :style="{ left: '-6px', top: '50%', transform: 'translateY(-50%)' }"
    />

    <div class="node-content">
      <div class="node-icon">↻</div>
      <div class="node-label">{{ data.label }}</div>
      <div class="node-info">{{ getLoopInfo() }}</div>
    </div>

    <Handle
      type="target"
      :position="Position.Right"
      id="loop-end"
      :connectable="true"
      :style="{ right: '-6px', left: 'auto', top: '50%', transform: 'translateY(-50%)' }"
    />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

interface Props {
  data: any;
  nodeStyle?: any;
}

const { data, nodeStyle } = defineProps<Props>();

function getLoopInfo() {
  if (data.mode === 'count') {
    return `循环 ${data.count || 10} 次`;
  }

  if (data.mode === 'condition') {
    return '条件循环';
  }

  return '循环';
}
</script>

<style scoped>
.loop-node {
  border-radius: 2px;
  border: 2px solid #b780ff;
  min-width: 180px;
  text-align: center;
  position: relative;
  background: linear-gradient(180deg, #34184a 0%, #21102f 100%);
  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;
}

.node-content {
  padding: 12px 20px;
}

.node-icon {
  font-size: 24px;
  margin-bottom: 4px;
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.node-label {
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  user-select: none;
  margin-bottom: 4px;
  line-height: 1.25;
  font-family: Arial, Helvetica, sans-serif;
}

.node-info {
  color: #d9c2ff;
  font-size: 12px;
  user-select: none;
  font-weight: 700;
  text-transform: uppercase;
}
</style>
