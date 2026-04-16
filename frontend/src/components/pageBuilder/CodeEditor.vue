<template>
  <div ref="editorHost" class="code-editor-host"></div>
</template>

<script setup lang="ts">
import { Compartment, EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view';
import { bracketMatching, defaultHighlightStyle, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PageBuilderFileType } from '../../types/pageBuilder';

const props = defineProps<{
  modelValue: string;
  language: PageBuilderFileType;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editorHost = ref<HTMLDivElement | null>(null);
const editorView = ref<EditorView | null>(null);
const languageCompartment = new Compartment();
const editableCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const languageExtension = computed(() => getLanguageExtension(props.language));

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#0f1115',
    color: '#d9dee7',
    fontSize: '13px'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-family-mono)'
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '16px 18px 24px'
  },
  '.cm-gutters': {
    backgroundColor: '#12151b',
    color: '#697180',
    borderRight: '1px solid #1f1f1f'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#171b22',
    color: '#9ca4b3'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(118, 185, 0, 0.24)'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#76b900'
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#171a20',
    border: '1px solid #2a2f38',
    color: '#9ca4b3'
  }
});

onMounted(() => {
  if (!editorHost.value) {
    return;
  }

  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...lintKeymap
    ]),
    oneDark,
    editorTheme,
    EditorView.lineWrapping,
    languageCompartment.of(languageExtension.value),
    editableCompartment.of(EditorView.editable.of(!props.readonly)),
    readOnlyCompartment.of(EditorState.readOnly.of(Boolean(props.readonly))),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }

      const nextValue = update.state.doc.toString();
      if (nextValue !== props.modelValue) {
        emit('update:modelValue', nextValue);
      }
    })
  ];

  editorView.value = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions
    }),
    parent: editorHost.value
  });
});

watch(languageExtension, (extension) => {
  if (!editorView.value) {
    return;
  }

  editorView.value.dispatch({
    effects: languageCompartment.reconfigure(extension)
  });
});

watch(
  () => props.readonly,
  (readonly) => {
    if (!editorView.value) {
      return;
    }

    editorView.value.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(!readonly)),
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(Boolean(readonly)))
      ]
    });
  }
);

watch(
  () => props.modelValue,
  (value) => {
    const view = editorView.value;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value
      }
    });
  }
);

onBeforeUnmount(() => {
  editorView.value?.destroy();
  editorView.value = null;
});

function getLanguageExtension(type: PageBuilderFileType): Extension {
  switch (type) {
    case 'css':
      return css();
    case 'json':
      return json();
    case 'js':
      return javascript({ jsx: false, typescript: false });
    case 'ts':
      return javascript({ typescript: true });
    case 'html':
    case 'vue':
      return html();
    default:
      return javascript();
  }
}
</script>

<style scoped>
.code-editor-host {
  min-height: 0;
  height: 100%;
}
</style>
