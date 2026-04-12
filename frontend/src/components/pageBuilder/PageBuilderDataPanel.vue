<template>
  <div class="data-shell">
    <div class="data-meta">
      <div>
        <strong>{{ title }}</strong>
        <span>{{ description }}</span>
      </div>
      <span class="data-badge">JSON</span>
    </div>

    <pre class="data-content" v-html="highlightedJson"></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type HighlightRule = {
  pattern: RegExp;
  className: string;
};

const props = defineProps<{
  title: string;
  description: string;
  content: string;
}>();

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

const highlightedJson = computed(() =>
  renderWithRules(props.content, [
    { pattern: /"(?:[^"\\]|\\.)*"(?=\s*:)/, className: 'token-key' },
    { pattern: /"(?:[^"\\]|\\.)*"/, className: 'token-string' },
    { pattern: /\b(true|false|null)\b/, className: 'token-keyword' },
    { pattern: /-?\b\d+(?:\.\d+)?\b/, className: 'token-number' }
  ])
);
</script>

<style scoped>
.data-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #0f1115;
}

.data-meta {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #1f1f1f;
  background: #12151b;
}

.data-meta div {
  display: grid;
  gap: 4px;
}

.data-meta strong {
  color: #f4f7fb;
  font-size: 13px;
}

.data-meta span {
  color: #8e96a4;
  font-size: 12px;
}

.data-badge {
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

.data-content {
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
</style>
