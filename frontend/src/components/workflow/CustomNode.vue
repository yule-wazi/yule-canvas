<template>
  <div class="custom-node" :style="nodeStyle">
    <!-- 左侧：只能接收连线（target） -->
    <Handle 
      type="target" 
      :position="Position.Left" 
      id="target-left"
      :connectable="true"
      :style="{ left: '-6px', top: '50%', transform: 'translateY(-50%)' }"
    />
    
    <div class="node-label">{{ data.label }}</div>
    
    <!-- 右侧：只能发送连线（source） -->
    <Handle 
      type="source" 
      :position="Position.Right" 
      id="source-right"
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

defineProps<Props>();
</script>

<style scoped>
.custom-node {
  border-radius: 2px;
  border: 1px solid #5e5e5e;
  min-width: 150px;
  text-align: center;
  position: relative;
  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;
}

.node-label {
  color: inherit;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  font-family: Arial, Helvetica, sans-serif;
  user-select: none;
  padding: 10px 20px;
}
</style>
