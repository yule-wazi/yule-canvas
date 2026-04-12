<template>
  <aside class="page-builder-filetree">
    <div class="explorer-title">Page Project</div>

    <ul v-if="nodes.length" class="tree-list tree-list--root">
      <TreeBranch
        :nodes="nodes"
        :depth="0"
        :active-file-id="activeFileId"
        :open-folders="openFolders"
        @toggle-folder="toggleFolder"
        @select-file="$emit('selectFile', $event)"
      />
    </ul>

    <div v-else class="empty-state">
      <p>No generated project yet.</p>
      <span>Generate a page to populate the explorer.</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { defineComponent, h, reactive } from 'vue';
import type { PageBuilderTreeNode } from '../../types/pageBuilder';

const props = defineProps<{
  nodes: PageBuilderTreeNode[];
  fileCount: number;
  activeFileId: string | null;
}>();

defineEmits<{
  selectFile: [fileId: string];
}>();

const openFolders = reactive<Record<string, boolean>>({
  app: true,
  components: true,
  'components/sections': true,
  data: true,
  spec: true,
  styles: true
});

function toggleFolder(path: string) {
  openFolders[path] = !isFolderOpen(path);
}

function isFolderOpen(path: string) {
  return openFolders[path] ?? true;
}

function caretIcon(open: boolean) {
  return h(
    'span',
    {
      class: ['tree-caret', { 'is-open': open }]
    },
    [
      h(
        'svg',
        { viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        [
          h('path', {
            d: 'M6 3l5 5-5 5',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '1.5'
          })
        ]
      )
    ]
  );
}

function folderIcon() {
  return h(
    'span',
    { class: 'tree-icon folder-icon' },
    [
      h(
        'svg',
        { viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        [
          h('path', {
            d: 'M1.75 4.25h4.1l1.35 1.5h7.05v6.5H1.75z',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-linejoin': 'round',
            'stroke-width': '1.2'
          })
        ]
      )
    ]
  );
}

function fileIcon() {
  return h(
    'span',
    { class: 'tree-icon file-icon' },
    [
      h(
        'svg',
        { viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        [
          h('path', {
            d: 'M4.25 1.75h5.5l2.5 2.5v10H4.25z',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-linejoin': 'round',
            'stroke-width': '1.2'
          }),
          h('path', {
            d: 'M9.75 1.75v2.5h2.5',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-linejoin': 'round',
            'stroke-width': '1.2'
          })
        ]
      )
    ]
  );
}

const TreeBranch = defineComponent({
  name: 'TreeBranch',
  props: {
    nodes: {
      type: Array as () => PageBuilderTreeNode[],
      required: true
    },
    depth: {
      type: Number,
      required: true
    },
    activeFileId: {
      type: String,
      default: null
    },
    openFolders: {
      type: Object as () => Record<string, boolean>,
      required: true
    }
  },
  emits: ['toggle-folder', 'select-file'],
  setup(branchProps, { emit }) {
    const isOpen = (path: string) => branchProps.openFolders[path] ?? true;

    const renderNode = (node: PageBuilderTreeNode) => {
      if (node.kind === 'folder') {
        const open = isOpen(node.path);

        return h('li', { class: 'tree-item', key: node.id }, [
          h(
            'div',
            {
              class: 'tree-row tree-row--folder',
              style: { paddingLeft: `${8 + branchProps.depth * 16}px` },
              onClick: () => emit('toggle-folder', node.path)
            },
            [
              caretIcon(open),
              folderIcon(),
              h('span', { class: 'tree-name' }, node.name)
            ]
          ),
          open && node.children?.length
            ? h(
                'ul',
                { class: 'tree-list' },
                h(TreeBranch, {
                  nodes: node.children,
                  depth: branchProps.depth + 1,
                  activeFileId: branchProps.activeFileId,
                  openFolders: branchProps.openFolders,
                  onToggleFolder: (path: string) => emit('toggle-folder', path),
                  onSelectFile: (fileId: string) => emit('select-file', fileId)
                })
              )
            : null
        ]);
      }

      return h('li', { class: 'tree-item', key: node.id }, [
        h(
          'div',
          {
            class: ['tree-row', 'tree-row--file', { 'is-active': node.fileId === branchProps.activeFileId }],
            style: { paddingLeft: `${8 + branchProps.depth * 16}px` },
            onClick: () => node.fileId && emit('select-file', node.fileId)
          },
          [
            h('span', { class: 'tree-caret tree-caret--empty' }),
            fileIcon(),
            h('span', { class: 'tree-name' }, node.name)
          ]
        )
      ]);
    };

    return () => branchProps.nodes.map(renderNode);
  }
});
</script>

<style>
.page-builder-filetree {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 8px 0 10px;
  background: #111;
  border-right: 1px solid #222;
  overflow: auto;
}

.explorer-title {
  padding: 6px 12px 10px;
  color: #f3f3f3;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.tree-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tree-list--root {
  padding-right: 0;
}

.tree-item {
  margin: 0;
  padding: 0;
}

.tree-row {
  display: grid;
  grid-template-columns: 16px 16px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding-right: 12px;
  color: #d4d4d4;
  user-select: none;
  cursor: pointer;
}

.tree-row:hover {
  background: #1a1a1a;
}

.tree-row.is-active {
  background: #37373d;
}

.tree-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #c5c5c5;
  transform: rotate(0deg);
  transition: transform 120ms ease;
}

.tree-caret.is-open {
  transform: rotate(90deg);
}

.tree-caret--empty {
  opacity: 0;
}

.tree-caret svg,
.tree-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}

.tree-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.folder-icon {
  color: #d7ba7d;
}

.file-icon {
  color: #c5c5c5;
}

.tree-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1.4;
}

.empty-state {
  margin: 8px 12px 0;
  padding: 12px;
  border: 1px dashed #2a2a2a;
  border-radius: 6px;
  color: #989898;
}

.empty-state p {
  margin: 0 0 6px;
  color: #e8e8e8;
}
</style>
