<template>
  <div class="property-form">
    <div class="form-group">
      <label>兜底分支</label>
      <label class="checkbox-row">
        <input v-model="localData.fallbackEnabled" type="checkbox" @change="emitUpdate" />
        启用兜底出口
      </label>
      <small>当前面的分支都不命中时，走兜底出口。</small>
    </div>

    <div class="branch-section">
      <div
        v-for="(branch, branchIndex) in localData.branches"
        :key="branch.id"
        class="branch-card"
      >
        <div class="branch-header">
          <div class="branch-title-group">
            <input
              v-model="branch.name"
              class="branch-name-input"
              type="text"
              placeholder="分支名称"
              @input="emitUpdate"
            />
            <select v-model="branch.matchType" @change="emitUpdate">
              <option value="all">满足全部条件</option>
              <option value="any">满足任一条件</option>
            </select>
          </div>
          <button
            class="btn-icon-small"
            :disabled="localData.branches.length <= 1"
            @click="removeBranch(branchIndex)"
          >
            ×
          </button>
        </div>

        <div
          v-for="(rule, ruleIndex) in branch.rules"
          :key="rule.id"
          class="rule-card"
        >
          <div class="rule-head">
            <span>条件 {{ ruleIndex + 1 }}</span>
            <button
              class="btn-icon-small"
              :disabled="branch.rules.length <= 1"
              @click="removeRule(branchIndex, ruleIndex)"
            >
              ×
            </button>
          </div>

          <div class="form-group">
            <label>判断来源</label>
            <select v-model="rule.sourceType" @change="emitUpdate">
              <option value="variable">全局变量</option>
              <option value="element">页面元素</option>
            </select>
          </div>

          <div v-if="rule.sourceType === 'variable'" class="form-group">
            <label>变量名</label>
            <select v-model="rule.variableName" @change="emitUpdate">
              <option value="">请选择变量</option>
              <option v-for="variable in workflowVariables" :key="variable.name" :value="variable.name">
                {{ variable.name }}
              </option>
            </select>
          </div>

          <template v-else>
            <div class="form-group">
              <label>CSS 选择器</label>
              <textarea
                v-model="rule.selector"
                rows="3"
                placeholder="例如: .status-tag"
                @input="emitUpdate"
              ></textarea>
            </div>

            <div class="form-group">
              <label>取值方式</label>
              <select v-model="rule.elementValueType" @change="emitUpdate">
                <option value="text">文本内容</option>
                <option value="innerText">可见文本</option>
                <option value="attribute">属性值</option>
              </select>
            </div>

            <div v-if="rule.elementValueType === 'attribute'" class="form-group">
              <label>属性名</label>
              <input
                v-model="rule.attributeName"
                type="text"
                placeholder="例如: href"
                @input="emitUpdate"
              />
            </div>

            <div class="form-group">
              <label>等待超时（毫秒）</label>
              <input
                v-model.number="rule.timeout"
                type="number"
                min="0"
                step="500"
                @input="emitUpdate"
              />
            </div>
          </template>

          <div class="form-group">
            <label>判断方式</label>
            <select v-model="rule.operator" @change="emitUpdate">
              <option value="equals">等于</option>
              <option value="notEquals">不等于</option>
              <option value="contains">包含</option>
              <option value="notContains">不包含</option>
              <option value="greaterThan">大于</option>
              <option value="greaterThanOrEqual">大于等于</option>
              <option value="lessThan">小于</option>
              <option value="lessThanOrEqual">小于等于</option>
              <option value="isEmpty">为空</option>
              <option value="isNotEmpty">不为空</option>
              <option value="isOdd">是奇数</option>
              <option value="isEven">是偶数</option>
            </select>
          </div>

          <div v-if="requiresCompareValue(rule.operator)" class="form-group">
            <label>比较值</label>
            <input
              v-model="rule.value"
              type="text"
              placeholder="支持 {{变量名}} 模板"
              @input="emitUpdate"
            />
          </div>
        </div>

        <button class="btn-add-secondary" @click="addRule(branchIndex)">+ 添加条件</button>
      </div>

      <button class="btn-add-primary" @click="addBranch">+ 添加分支</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Block } from '../../../types/block';
import { useWorkflowStore } from '../../../stores/workflow';
import { DEFAULT_SELECTOR_TIMEOUT } from '../../../constants/workflow';

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  update: [data: any];
}>();

const workflowStore = useWorkflowStore();

function createRule() {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: 'variable',
    variableName: '',
    selector: '',
    elementValueType: 'text',
    attributeName: '',
    timeout: DEFAULT_SELECTOR_TIMEOUT,
    operator: 'equals',
    value: ''
  };
}

function createBranch(index: number) {
  return {
    id: `path-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: `路径 ${index + 1}`,
    matchType: 'all',
    rules: [createRule()]
  };
}

function normalizeData(data: any) {
  const branches = Array.isArray(data?.branches) && data.branches.length > 0
    ? data.branches.map((branch: any, index: number) => ({
      id: branch.id || `path-${index + 1}`,
      name: branch.name || `路径 ${index + 1}`,
      matchType: branch.matchType === 'any' ? 'any' : 'all',
      rules: Array.isArray(branch.rules) && branch.rules.length > 0
        ? branch.rules.map((rule: any) => ({
          ...createRule(),
          ...rule
        }))
        : [createRule()]
    }))
    : [createBranch(0), createBranch(1)];

  return {
    branches,
    fallbackEnabled: data?.fallbackEnabled !== false
  };
}

const localData = ref(normalizeData(props.block.data));

watch(
  () => props.block.data,
  (newData) => {
    localData.value = normalizeData(newData);
  },
  { deep: true }
);

const workflowVariables = computed(() =>
  Object.entries(workflowStore.variables).map(([name, value]: [string, any]) => ({
    name,
    value
  }))
);

function emitUpdate() {
  localData.value.branches = localData.value.branches.map((branch: any, index: number) => ({
    ...branch,
    name: branch.name?.trim() ? branch.name : `路径 ${index + 1}`
  }));
  emit('update', JSON.parse(JSON.stringify(localData.value)));
}

function addBranch() {
  localData.value.branches.push(createBranch(localData.value.branches.length));
  emitUpdate();
}

function removeBranch(branchIndex: number) {
  if (localData.value.branches.length <= 1) {
    return;
  }
  localData.value.branches.splice(branchIndex, 1);
  emitUpdate();
}

function addRule(branchIndex: number) {
  localData.value.branches[branchIndex].rules.push(createRule());
  emitUpdate();
}

function removeRule(branchIndex: number, ruleIndex: number) {
  const rules = localData.value.branches[branchIndex].rules;
  if (rules.length <= 1) {
    return;
  }
  rules.splice(ruleIndex, 1);
  emitUpdate();
}

function requiresCompareValue(operator: string) {
  return !['isEmpty', 'isNotEmpty', 'isOdd', 'isEven'].includes(operator);
}
</script>

<style scoped>
.property-form,
.branch-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label,
.rule-head span {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.branch-card,
.rule-card {
  padding: 1rem;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-bg-surface);
}

.branch-header,
.rule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.branch-title-group {
  display: flex;
  flex: 1;
  gap: 0.75rem;
}

.branch-name-input {
  flex: 1;
}

.form-group input[type='text'],
.form-group input[type='number'],
.form-group textarea,
.form-group select,
.branch-name-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-bg-page-elevated);
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 84px;
  min-width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus,
.branch-name-input:focus {
  outline: none;
  border-color: var(--color-brand-link-hover);
}

.btn-icon-small,
.btn-add-secondary,
.btn-add-primary {
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.btn-icon-small {
  width: 28px;
  height: 28px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 18px;
}

.btn-icon-small:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-add-secondary,
.btn-add-primary {
  padding: 0.65rem 0.8rem;
  background: transparent;
  color: var(--color-brand-link-hover);
}

.btn-add-primary {
  border-style: dashed;
}

.form-group small {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
</style>
