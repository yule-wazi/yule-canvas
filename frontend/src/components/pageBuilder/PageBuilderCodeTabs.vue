<template>
  <div class="code-shell">
    <div class="code-tabs">
      <button
        v-for="file in files"
        :key="file.id"
        class="code-tab"
        :class="{ 'is-active': file.id === activeFileId }"
        type="button"
        @click="$emit('selectFile', file.id)"
      >
        <span class="tab-dot" :class="`tab-dot--${file.type}`"></span>
        <span class="tab-label">{{ file.name }}</span>
      </button>
    </div>

    <div v-if="activeFile" class="code-viewer">
      <div class="code-meta">
        <div class="code-meta-main">
          <strong>{{ activeFile.path }}</strong>
          <span>{{ activeFile.role }}</span>
        </div>
        <div class="code-meta-side">
          <span class="code-badge">{{ activeFile.type }}</span>
          <span class="code-badge" :class="{ 'is-editable': activeFile.editable }">
            {{ activeFile.editable ? '可编辑' : '只读' }}
          </span>
        </div>
      </div>

      <pre class="code-content" v-html="highlightedContent"></pre>
    </div>

    <div v-else class="code-empty">
      选择一个生成文件后，这里会显示对应代码。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PageBuilderFile } from '../../types/pageBuilder';

type HighlightRule = {
  pattern: RegExp;
  className: string;
};

const props = defineProps<{
  files: PageBuilderFile[];
  activeFileId: string | null;
}>();

defineEmits<{
  selectFile: [fileId: string];
}>();

const activeFile = computed(() => props.files.find((file) => file.id === props.activeFileId) || null);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderWithRules(content: string, rules: HighlightRule[]) {
  const wrappedPatterns = rules.map((rule, index) => `(?<r${index}>${rule.pattern.source})`);
  const regex = new RegExp(wrappedPatterns.join('|'), 'gm');
  let result = '';
  let cursor = 0;

  for (const match of content.matchAll(regex)) {
    const start = match.index ?? 0;
    const matched = match[0];

    if (!matched) {
      continue;
    }

    result += escapeHtml(content.slice(cursor, start));

    let className = 'token-text';
    const groups = match.groups || {};
    for (let i = 0; i < rules.length; i += 1) {
      if (groups[`r${i}`] !== undefined) {
        className = rules[i].className;
        break;
      }
    }
    result += `<span class="token ${className}">${escapeHtml(matched)}</span>`;
    cursor = start + matched.length;
  }

  result += escapeHtml(content.slice(cursor));
  return result;
}

function highlightJson(content: string) {
  return renderWithRules(content, [
    { pattern: /"(?:[^"\\]|\\.)*"(?=\s*:)/, className: 'token-key' },
    { pattern: /"(?:[^"\\]|\\.)*"/, className: 'token-string' },
    { pattern: /\b(true|false|null)\b/, className: 'token-keyword' },
    { pattern: /-?\b\d+(?:\.\d+)?\b/, className: 'token-number' }
  ]);
}

function highlightScript(content: string) {
  return renderWithRules(content, [
    { pattern: /\/\/.*/, className: 'token-comment' },
    { pattern: /\/\*[\s\S]*?\*\//, className: 'token-comment' },
    { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/, className: 'token-string' },
    { pattern: /\b(import|from|const|let|function|return|if|else|export|defineProps|defineEmits|true|false|null)\b/, className: 'token-keyword' },
    { pattern: /-?\b\d+(?:\.\d+)?\b/, className: 'token-number' }
  ]);
}

function highlightCss(content: string) {
  return renderWithRules(content, [
    { pattern: /\/\*[\s\S]*?\*\//, className: 'token-comment' },
    { pattern: /--[A-Za-z0-9-]+(?=\s*:)/, className: 'token-attr' },
    { pattern: /[A-Za-z-]+(?=\s*:)/, className: 'token-attr' },
    { pattern: /#[0-9A-Fa-f]+|rgba?\([^)]+\)|-?\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|deg)?\b/, className: 'token-number' }
  ]);
}

function highlightMarkup(content: string) {
  let rendered = renderWithRules(content, [
    { pattern: /<!--[\s\S]*?-->/, className: 'token-comment' },
    { pattern: /<\/?[A-Za-z][A-Za-z0-9-]*/, className: 'token-tag' },
    { pattern: /[:@A-Za-z0-9_-]+(?==)/, className: 'token-attr' },
    { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, className: 'token-string' },
    { pattern: /\b(import|from|const|defineProps|defineEmits)\b/, className: 'token-keyword' }
  ]);

  rendered = rendered.replace(/(&lt;\/?)([^<>\s]+)(&gt;|\/&gt;)/g, `<span class="token token-tag">$1$2$3</span>`);
  return rendered;
}

const highlightedContent = computed(() => {
  if (!activeFile.value) {
    return '';
  }

  const { content, type } = activeFile.value;

  if (type === 'json') {
    return highlightJson(content);
  }

  if (type === 'ts' || type === 'js') {
    return highlightScript(content);
  }

  if (type === 'css') {
    return highlightCss(content);
  }

  if (type === 'vue' || type === 'html') {
    return highlightMarkup(content);
  }

  return escapeHtml(content);
});
</script>

<style scoped>
.code-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #0f1115;
}

.code-tabs {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  gap: 1px;
  flex: none;
  padding: 0 10px;
  border-bottom: 1px solid #1f1f1f;
  background: #111317;
  overflow-x: auto;
}

.code-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-top: 2px solid transparent;
  background: transparent;
  color: #9197a3;
  cursor: pointer;
  white-space: nowrap;
}

.code-tab:hover {
  background: #171a20;
  color: #cfd4dd;
}

.code-tab.is-active {
  border-top-color: #76b900;
  background: #0f1115;
  color: #f4f7fb;
}

.tab-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: #6d7585;
}

.tab-dot--vue {
  background: #46c488;
}

.tab-dot--ts {
  background: #4f8ef7;
}

.tab-dot--css {
  background: #9860ff;
}

.tab-dot--json {
  background: #8a6871;
}

.tab-dot--html {
  background: #e7884d;
}

.tab-label {
  font-size: 13px;
}

.code-viewer {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.code-meta {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #1f1f1f;
  background: #12151b;
}

.code-meta-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.code-meta-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #f4f7fb;
  font-size: 13px;
}

.code-meta-main span {
  color: #8e96a4;
  font-size: 12px;
}

.code-meta-side {
  display: inline-flex;
  gap: 8px;
}

.code-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid #2a2f38;
  border-radius: 999px;
  color: #9ca4b3;
  font-size: 11px;
  text-transform: uppercase;
}

.code-badge.is-editable {
  border-color: rgba(118, 185, 0, 0.35);
  color: #bddd78;
}

.code-content {
  margin: 0;
  flex: 1;
  min-height: 0;
  padding: 16px 18px 24px;
  overflow: auto;
  color: #d9dee7;
  font-family: var(--font-family-mono);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.code-empty {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: #9098a8;
}

:deep(.token-tag) {
  color: #7ee787;
}

:deep(.token-attr),
:deep(.token-key) {
  color: #79c0ff;
}

:deep(.token-string) {
  color: #a5d6ff;
}

:deep(.token-number) {
  color: #f2cc60;
}

:deep(.token-keyword) {
  color: #ff7b72;
}

:deep(.token-comment) {
  color: #8b949e;
}
</style>
