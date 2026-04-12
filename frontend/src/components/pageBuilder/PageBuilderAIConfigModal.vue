<template>
  <div v-if="open" class="config-overlay" @click.self="$emit('close')">
    <section class="config-dialog">
      <div class="dialog-header">
        <div>
          <p class="eyebrow">AI Config</p>
          <h3>配置生成模型</h3>
        </div>
        <button class="close-btn" type="button" @click="$emit('close')">关闭</button>
      </div>

      <div class="dialog-body">
        <label class="field">
          <span>Provider</span>
          <select :value="provider" @change="$emit('update:provider', ($event.target as HTMLSelectElement).value as any)">
            <option value="openrouter">OpenRouter</option>
            <option value="qwen">Qwen</option>
            <option value="siliconflow">SiliconFlow</option>
          </select>
        </label>

        <label class="field">
          <span>Model</span>
          <input :value="model" type="text" placeholder="例如 openai/gpt-4.1-mini" @input="$emit('update:model', ($event.target as HTMLInputElement).value)" />
        </label>

        <label class="field">
          <span>API Key</span>
          <input :value="apiKey" type="password" placeholder="输入当前 provider 的 API Key" @input="$emit('update:apiKey', ($event.target as HTMLInputElement).value)" />
        </label>

        <p class="helper-text">这里的配置会随当前页面生成请求一起发送，不需要重启后端。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  provider: 'openrouter' | 'qwen' | 'siliconflow';
  model: string;
  apiKey: string;
}>();

defineEmits<{
  close: [];
  'update:provider': [value: 'openrouter' | 'qwen' | 'siliconflow'];
  'update:model': [value: string];
  'update:apiKey': [value: string];
}>();
</script>

<style scoped>
.config-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(6px);
}

.config-dialog {
  width: min(420px, calc(100vw - 32px));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(18, 18, 18, 0.98) 0%, rgba(9, 9, 9, 0.98) 100%);
  box-shadow: rgba(0, 0, 0, 0.45) 0 24px 60px;
}

.dialog-header,
.dialog-body {
  padding: 18px 20px;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.eyebrow {
  margin: 0 0 4px;
  color: #78b900;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.dialog-header h3 {
  margin: 0;
  color: #f5f7fb;
  font-size: 22px;
}

.close-btn {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #f5f7fb;
  font-weight: 700;
  cursor: pointer;
}

.dialog-body {
  display: grid;
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span,
.helper-text {
  color: #97a1b2;
  font-size: 13px;
}

.field input,
.field select {
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: #f5f7fb;
}

.helper-text {
  margin: 0;
  line-height: 1.6;
}
</style>
