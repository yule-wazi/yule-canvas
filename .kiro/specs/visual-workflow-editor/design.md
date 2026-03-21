# 可视化工作流编辑器 - 设计文档

## 1. 系统架构

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Vue3)                           │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 可视化编辑器  │  │  Block库     │  │  代码编辑器  │  │
│  │  (Vue Flow)  │  │  (组件)      │  │  (Textarea)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │          工作流管理 (Pinia Store)                 │  │
│  └──────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    后端 (Express)                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 脚本解析器    │  │  Block编译器 │  │  执行引擎    │  │
│  │  (Parser)    │  │  (Compiler)  │  │ (Playwright) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选择

#### 前端
- **Vue Flow**: 可视化流程图库，支持拖拽、连线
- **Pinia**: 状态管理，存储工作流数据
- **TypeScript**: 类型安全

#### 后端
- **AST解析**: 使用acorn或@babel/parser解析JavaScript
- **模板引擎**: 生成Playwright代码

## 2. 数据模型

### 2.1 Block数据结构
```typescript
interface Block {
  id: string;                    // 唯一标识
  type: BlockType;               // block类型
  label: string;                 // 显示名称
  position: { x: number; y: number }; // 画布位置
  data: BlockData;               // block配置数据
  inputs: BlockPort[];           // 输入端口
  outputs: BlockPort[];          // 输出端口
}

interface BlockPort {
  id: string;
  name: string;
  type: 'flow' | 'data';        // 控制流或数据流
}

interface BlockData {
  [key: string]: any;            // 根据block类型不同
}
```

### 2.2 Connection数据结构
```typescript
interface Connection {
  id: string;
  source: string;                // 源block ID
  sourceHandle: string;          // 源端口ID
  target: string;                // 目标block ID
  targetHandle: string;          // 目标端口ID
}
```

### 2.3 Workflow数据结构
```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  blocks: Block[];
  connections: Connection[];
  variables: Record<string, any>; // 全局变量
  createdAt: number;
  updatedAt: number;
}
```

## 3. Block类型定义

### 3.1 浏览器控制类

#### Navigate Block
```typescript
{
  type: 'navigate',
  label: '访问页面',
  data: {
    url: string;
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle';
    timeout: number;
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [{ id: 'out', name: '输出', type: 'flow' }]
}
```

#### Scroll Block
```typescript
{
  type: 'scroll',
  label: '滚动页面',
  data: {
    mode: 'smart' | 'fixed';
    maxScrolls: number;
    delay: number;
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [{ id: 'out', name: '输出', type: 'flow' }]
}
```

#### Wait Block
```typescript
{
  type: 'wait',
  label: '等待',
  data: {
    duration: number;
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [{ id: 'out', name: '输出', type: 'flow' }]
}
```

### 3.2 页面交互类

#### Click Block
```typescript
{
  type: 'click',
  label: '点击元素',
  data: {
    selector: string;
    waitForElement: boolean;
    timeout: number;
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [{ id: 'out', name: '输出', type: 'flow' }]
}
```

#### Type Block
```typescript
{
  type: 'type',
  label: '输入文本',
  data: {
    selector: string;
    text: string;
    delay: number;
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [{ id: 'out', name: '输出', type: 'flow' }]
}
```

### 3.3 数据提取类

#### Extract Block
```typescript
{
  type: 'extract',
  label: '提取数据',
  data: {
    selector: string;
    attribute: 'text' | 'src' | 'href' | 'value';
    multiple: boolean;
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [
    { id: 'out', name: '输出', type: 'flow' },
    { id: 'data', name: '数据', type: 'data' }
  ]
}
```

#### Extract Images Block
```typescript
{
  type: 'extract-images',
  label: '提取图片',
  data: {
    filterInvalid: boolean;
    attributes: string[];
  },
  inputs: [{ id: 'in', name: '输入', type: 'flow' }],
  outputs: [
    { id: 'out', name: '输出', type: 'flow' },
    { id: 'data', name: '图片列表', type: 'data' }
  ]
}
```

### 3.4 逻辑控制类

#### Condition Block
```typescript
{
  type: 'condition',
  label: '条件判断',
  data: {
    condition: string;
  },
  inputs: [
    { id: 'in', name: '输入', type: 'flow' },
    { id: 'data', name: '数据', type: 'data' }
  ],
  outputs: [
    { id: 'true', name: '真', type: 'flow' },
    { id: 'false', name: '假', type: 'flow' }
  ]
}
```

#### Loop Block
```typescript
{
  type: 'loop',
  label: '循环',
  data: {
    mode: 'count' | 'array';
    count: number;
    arraySource: string;
  },
  inputs: [
    { id: 'in', name: '输入', type: 'flow' },
    { id: 'data', name: '数据', type: 'data' }
  ],
  outputs: [
    { id: 'loop', name: '循环体', type: 'flow' },
    { id: 'out', name: '完成', type: 'flow' }
  ]
}
```

### 3.5 数据处理类

#### Transform Block
```typescript
{
  type: 'transform',
  label: '数据转换',
  data: {
    script: string;  // JavaScript表达式
  },
  inputs: [
    { id: 'in', name: '输入', type: 'flow' },
    { id: 'data', name: '数据', type: 'data' }
  ],
  outputs: [
    { id: 'out', name: '输出', type: 'flow' },
    { id: 'result', name: '结果', type: 'data' }
  ]
}
```

## 4. 核心功能设计

### 4.1 脚本解析器 (Parser)

#### 功能
将Playwright JavaScript代码解析为Block数组

#### 实现思路
```typescript
class ScriptParser {
  parse(code: string): Workflow {
    // 1. 使用AST解析器解析代码
    const ast = parseScript(code);
    
    // 2. 遍历AST节点，识别模式
    const blocks: Block[] = [];
    const connections: Connection[] = [];
    
    // 3. 识别常见模式
    // - page.goto() -> Navigate Block
    // - page.click() -> Click Block
    // - page.evaluate() -> Extract Block
    // - for/while -> Loop Block
    
    // 4. 构建连接关系
    // 按代码顺序连接blocks
    
    return { blocks, connections };
  }
  
  private identifyBlockType(node: ASTNode): BlockType {
    // 模式匹配逻辑
  }
}
```

### 4.2 Block编译器 (Compiler)

#### 功能
将Block数组编译为可执行的Playwright代码

#### 实现思路
```typescript
class BlockCompiler {
  compile(workflow: Workflow): string {
    // 1. 验证工作流完整性
    this.validate(workflow);
    
    // 2. 拓扑排序确定执行顺序
    const sortedBlocks = this.topologicalSort(workflow);
    
    // 3. 为每个block生成代码片段
    const codeFragments = sortedBlocks.map(block => 
      this.generateBlockCode(block)
    );
    
    // 4. 组装完整代码
    return this.assembleCode(codeFragments);
  }
  
  private generateBlockCode(block: Block): string {
    switch (block.type) {
      case 'navigate':
        return `await page.goto('${block.data.url}', { 
          waitUntil: '${block.data.waitUntil}', 
          timeout: ${block.data.timeout} 
        });`;
      case 'scroll':
        return this.generateScrollCode(block);
      case 'extract-images':
        return this.generateExtractImagesCode(block);
      // ... 其他block类型
    }
  }
}
```

### 4.3 可视化编辑器

#### 使用Vue Flow
```vue
<template>
  <div class="workflow-editor">
    <VueFlow
      v-model="elements"
      @connect="onConnect"
      @node-drag-stop="onNodeDragStop"
    >
      <Background />
      <Controls />
      <MiniMap />
      
      <!-- 自定义Block组件 -->
      <template #node-navigate="{ data }">
        <NavigateBlock :data="data" @update="updateBlock" />
      </template>
      
      <template #node-extract-images="{ data }">
        <ExtractImagesBlock :data="data" @update="updateBlock" />
      </template>
      
      <!-- 更多block类型... -->
    </VueFlow>
    
    <!-- Block工具栏 -->
    <BlockPalette @add-block="addBlock" />
  </div>
</template>

<script setup lang="ts">
import { VueFlow } from '@vue-flow/core';
import { useWorkflowStore } from '@/stores/workflow';

const workflowStore = useWorkflowStore();
const elements = computed(() => workflowStore.elements);

const onConnect = (connection: Connection) => {
  workflowStore.addConnection(connection);
};

const addBlock = (blockType: BlockType) => {
  workflowStore.addBlock(blockType);
};
</script>
```

### 4.4 Block组件设计

#### 通用Block组件
```vue
<template>
  <div class="block" :class="`block-${type}`">
    <div class="block-header">
      <span class="block-icon">{{ icon }}</span>
      <span class="block-label">{{ label }}</span>
      <button @click="$emit('delete')" class="block-delete">×</button>
    </div>
    
    <div class="block-body">
      <slot name="config" />
    </div>
    
    <div class="block-ports">
      <div v-for="input in inputs" :key="input.id" class="port input">
        {{ input.name }}
      </div>
      <div v-for="output in outputs" :key="output.id" class="port output">
        {{ output.name }}
      </div>
    </div>
  </div>
</template>
```

## 5. API设计

### 5.1 工作流管理API

```typescript
// 解析脚本为工作流
POST /api/workflow/parse
Request: { code: string }
Response: { workflow: Workflow }

// 编译工作流为脚本
POST /api/workflow/compile
Request: { workflow: Workflow }
Response: { code: string }

// 执行工作流
POST /api/workflow/execute
Request: { workflow: Workflow }
Response: { success: boolean, data: any }

// 保存工作流
POST /api/workflow/save
Request: { workflow: Workflow }
Response: { id: string }

// 加载工作流
GET /api/workflow/:id
Response: { workflow: Workflow }
```

## 6. 状态管理

### 6.1 Workflow Store
```typescript
export const useWorkflowStore = defineStore('workflow', {
  state: () => ({
    currentWorkflow: null as Workflow | null,
    blocks: [] as Block[],
    connections: [] as Connection[],
    selectedBlock: null as Block | null,
    history: [] as Workflow[],
    historyIndex: 0
  }),
  
  actions: {
    addBlock(type: BlockType, position: Position) {
      // 添加block
    },
    
    removeBlock(id: string) {
      // 删除block及相关连接
    },
    
    updateBlock(id: string, data: Partial<BlockData>) {
      // 更新block配置
    },
    
    addConnection(connection: Connection) {
      // 添加连接
    },
    
    removeConnection(id: string) {
      // 删除连接
    },
    
    undo() {
      // 撤销操作
    },
    
    redo() {
      // 重做操作
    },
    
    parseScript(code: string) {
      // 解析脚本
    },
    
    compileWorkflow() {
      // 编译工作流
    }
  }
});
```

## 7. UI/UX设计

### 7.1 布局
```
┌─────────────────────────────────────────────────────────┐
│  顶部工具栏: [保存] [执行] [撤销] [重做] [代码视图]      │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  Block   │           画布区域                            │
│  工具栏  │        (可拖拽、缩放)                         │
│          │                                              │
│  [导航]  │                                              │
│  [交互]  │                                              │
│  [提取]  │                                              │
│  [逻辑]  │                                              │
│  [数据]  │                                              │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│  属性面板: 显示选中block的配置                           │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Block样式
- 不同类型使用不同颜色
- 浏览器控制: 蓝色
- 页面交互: 绿色
- 数据提取: 橙色
- 逻辑控制: 紫色
- 数据处理: 灰色

### 7.3 连接线样式
- 控制流: 实线
- 数据流: 虚线
- 悬停高亮
- 可点击删除

## 8. 性能优化

### 8.1 前端优化
- 虚拟滚动（大量blocks时）
- 防抖处理（拖拽、输入）
- 懒加载block组件
- Canvas渲染优化

### 8.2 后端优化
- 缓存编译结果
- 异步解析大型脚本
- 流式返回执行日志

## 9. 扩展性设计

### 9.1 自定义Block
```typescript
interface CustomBlockDefinition {
  type: string;
  label: string;
  icon: string;
  category: string;
  inputs: BlockPort[];
  outputs: BlockPort[];
  configSchema: JSONSchema;
  codeGenerator: (data: BlockData) => string;
}

// 注册自定义block
blockRegistry.register(customBlockDef);
```

### 9.2 插件系统
```typescript
interface WorkflowPlugin {
  name: string;
  version: string;
  blocks: CustomBlockDefinition[];
  hooks: {
    beforeCompile?: (workflow: Workflow) => Workflow;
    afterExecute?: (result: any) => any;
  };
}
```

## 10. 测试策略

### 10.1 单元测试
- Block组件测试
- Parser测试
- Compiler测试
- Store actions测试

### 10.2 集成测试
- 脚本解析 -> 编译 -> 执行流程
- 工作流保存和加载
- 拖拽和连接操作

### 10.3 E2E测试
- 创建简单工作流
- 执行工作流
- 编辑和修改工作流
