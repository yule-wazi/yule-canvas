import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Script {
  id: string;
  name: string;
  description: string;
  code: string;
  aiModel: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  lastExecutedAt?: number;
}

export const useScriptStore = defineStore('script', () => {
  const scripts = ref<Script[]>([]);
  const currentScript = ref<Script | null>(null);

  return {
    scripts,
    currentScript
  };
});
