<template>
  <div class="loop-node" :style="nodeStyle">
    <!-- 左侧：发送连线（source）- 循环体开始 -->
    <Handle 
      type="source" 
      :position="Position.Left" 
      id="loop-start"
      :connectable="true"
      :style="{ left: '-6px', top: '50%', transform: 'translateY(-50%)' }"
    />
    
    <div class="node-content">
      <div class="node-icon">🔄</div>
      <div class="node-label">{{ data.label }}</div>
      <div class="node-info">{{ getLoopInfo() }}</div>
    </div>
    
    <!-- 右侧：接收连线（target）- 循环体结束 -->
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

const props = defineProps<Props>();

function getLoopInfo() {
  if (props.data.mode === 'count') {
    return `循环 ${props.data.count || 10} 次`;
  } else if (props.data.mode === 'condition') {
    return '条件循环';
  }
  return '循环';
}
</script>

<style scoped>
.loop-node {
  border-radius: 8px;
  border: 2px solid #8957e5;
  min-width: 180px;
  text-align: center;
  position: relative;
  background: linear-gradient(135deg, #8957e5 0%, #6e40c9 100%);
  box-shadow: 0 4px 12px rgba(137, 87, 229, 0.3);
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
  font-weight: 600;
  user-select: none;
  margin-bottom: 4px;
}

.node-info {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  user-select: none;
}
</style>
