<template>
  <div ref="rootRef" class="pb-select" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button
      class="pb-select__trigger"
      type="button"
      :disabled="disabled"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggleOpen"
    >
      <span class="pb-select__value" :class="{ 'is-placeholder': !selectedOption }">
        {{ selectedOption?.label || placeholder }}
      </span>
      <svg class="pb-select__icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 6.25L8 10.75L12.5 6.25" />
      </svg>
    </button>

    <div v-if="open" class="pb-select__menu" role="listbox">
      <button
        v-for="option in normalizedOptions"
        :key="option.value"
        class="pb-select__option"
        :class="{
          'is-selected': option.value === modelValue,
          'is-disabled': option.disabled
        }"
        type="button"
        :disabled="option.disabled"
        @click="selectOption(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const props = defineProps<{
  modelValue: string;
  placeholder: string;
  options: SelectOption[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const normalizedOptions = computed(() => props.options);
const selectedOption = computed(() =>
  normalizedOptions.value.find((option) => option.value === props.modelValue) || null
);

function toggleOpen() {
  if (props.disabled) {
    return;
  }

  open.value = !open.value;
}

function closeOpen() {
  open.value = false;
}

function selectOption(value: string) {
  emit('update:modelValue', value);
  closeOpen();
}

function handlePointerDown(event: MouseEvent) {
  if (!open.value || !rootRef.value) {
    return;
  }

  const target = event.target;
  if (target instanceof Node && !rootRef.value.contains(target)) {
    closeOpen();
  }
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      closeOpen();
    }
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('mousedown', handlePointerDown);
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousedown', handlePointerDown);
  }
});
</script>

<style scoped>
.pb-select {
  position: relative;
}

.pb-select__trigger {
  width: 100%;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 2px;
  background: #141414;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.pb-select__trigger:hover {
  border-color: #76b900;
}

.pb-select__trigger:focus-visible {
  outline: 2px solid #000000;
  outline-offset: 2px;
  border-color: #76b900;
}

.pb-select__value {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
}

.pb-select__value.is-placeholder {
  color: #898989;
  font-weight: 400;
}

.pb-select__icon {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.18s ease;
  flex-shrink: 0;
}

.pb-select.is-open .pb-select__icon {
  transform: rotate(180deg);
}

.pb-select__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 40;
  display: grid;
  gap: 0;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid rgba(118, 185, 0, 0.45);
  border-radius: 2px;
  background: #0c0c0c;
  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;
}

.pb-select__option {
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: #ffffff;
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.pb-select__option:last-child {
  border-bottom: 0;
}

.pb-select__option:hover,
.pb-select__option:focus-visible {
  background: rgba(118, 185, 0, 0.12);
  color: #ffffff;
  outline: none;
}

.pb-select__option.is-selected {
  background: #76b900;
  color: #000000;
}

.pb-select__option.is-disabled,
.pb-select.is-disabled .pb-select__trigger {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
