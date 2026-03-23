# Vue to React 迁移计划

## 迁移目标
- 框架：Next.js (React)
- 样式：Tailwind CSS
- 组件库：shadcn/ui 或 Ant Design
- 状态管理：Zustand
- 核心重点：工作流编辑器

## 当前Vue架构分析

### 核心模块

#### 1. 工作流编辑器 (WorkflowEditor.vue)
- 可视化拖拽编辑器
- 支持的模块类型：
  - navigate: 页面导航
  - click: 点击元素
  - input: 输入文本
  - scroll: 滚动页面
  - wait: 等待
  - extract: 提取数据
  - loop: 循环
  - condition: 条件判断
  - back: 后退
  - forward: 前进
- 功能：
  - 模块拖拽排序
  - 循环体嵌套检测
  - 全局变量管理
  - 代码生成和解析

#### 2. 状态管理 (Pinia Stores)
- `workflowStore`: 工作流状态
  - blocks: 模块列表
  - variables: 全局变量
  - connections: 模块连接关系
- `scriptStore`: 脚本管理
- `dataTableStore`: 数据表管理

#### 3. 核心服务
- `BlockCompiler.ts`: 将workflow blocks编译为Playwright代码
- `ScriptParser.ts`: 将Playwright代码解析回workflow blocks
- `WorkflowExecutor.ts`: 执行工作流
- `PlaywrightExecutor.ts`: Playwright脚本执行器

#### 4. 关键功能
- 循环变量：支持全局变量作为循环计数器
- 数据提取：多字段提取，支持单个/多个元素
- 实时执行：Socket.io实时日志
- 数据表管理：支持图片、视频、链接等类型

## React迁移架构设计

### 技术栈
```
Next.js 14 (App Router)
├── Tailwind CSS
├── shadcn/ui (推荐) 或 Ant Design
├── Zustand (状态管理)
├── React DnD (拖拽)
├── Socket.io-client
└── Axios
```

### 目录结构
```
frontend-react/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── workflow/
│   │   └── page.tsx          # 工作流编辑器页面
│   ├── scripts/
│   │   └── page.tsx          # 脚本管理页面
│   └── data/
│       └── page.tsx          # 数据表管理页面
├── components/
│   ├── ui/                   # shadcn/ui组件
│   ├── workflow/
│   │   ├── WorkflowEditor.tsx
│   │   ├── BlockItem.tsx
│   │   ├── BlockProperties.tsx
│   │   └── VariableManager.tsx
│   ├── DataTableManager.tsx
│   └── ExecutionPanel.tsx
├── lib/
│   ├── stores/               # Zustand stores
│   │   ├── workflowStore.ts
│   │   ├── scriptStore.ts
│   │   └── dataTableStore.ts
│   ├── services/
│   │   ├── BlockCompiler.ts  # 复用现有逻辑
│   │   ├── ScriptParser.ts   # 复用现有逻辑
│   │   └── api.ts
│   └── utils/
└── public/
```

## 迁移步骤

### Phase 1: 项目初始化 (1天)
- [ ] 创建Next.js项目
- [ ] 配置Tailwind CSS
- [ ] 安装shadcn/ui
- [ ] 配置TypeScript
- [ ] 设置基础路由

### Phase 2: 核心服务迁移 (1天)
- [ ] 复制BlockCompiler.ts (无需修改)
- [ ] 复制ScriptParser.ts (无需修改)
- [ ] 创建Zustand stores
- [ ] 迁移API服务

### Phase 3: 工作流编辑器 (3-4天)
- [ ] WorkflowEditor主组件
- [ ] BlockItem组件 (拖拽)
- [ ] BlockProperties组件 (属性面板)
- [ ] VariableManager组件
- [ ] 循环体嵌套检测逻辑
- [ ] 代码生成和解析集成

### Phase 4: 其他页面 (2天)
- [ ] 脚本管理页面
- [ ] 数据表管理页面
- [ ] 执行面板

### Phase 5: 测试和优化 (1-2天)
- [ ] 功能测试
- [ ] 性能优化
- [ ] UI/UX优化

## 关键迁移点

### 1. 拖拽功能
Vue: 使用原生HTML5 Drag & Drop
React: 使用react-dnd或dnd-kit

### 2. 状态管理
Vue: Pinia (响应式)
React: Zustand (简单、轻量)

### 3. 表单处理
Vue: v-model双向绑定
React: 受控组件 + useState

### 4. 样式
Vue: Scoped CSS
React: Tailwind CSS + CSS Modules

## 保留的核心逻辑

以下文件可以直接复用（TypeScript纯逻辑）：
- `BlockCompiler.ts`
- `ScriptParser.ts`
- `types/block.ts`
- `types/workflow.ts`

## 注意事项

1. **后端不变**：保持现有Express + Socket.io后端
2. **API兼容**：确保React前端调用相同的API
3. **数据格式**：保持localStorage数据格式一致
4. **测试覆盖**：重点测试代码生成和解析的往返转换

## 推荐组件库选择

### shadcn/ui (推荐)
优点：
- 基于Radix UI，无障碍性好
- 代码直接复制到项目，可定制性强
- 与Tailwind完美集成
- 轻量，按需使用

### Ant Design
优点：
- 组件丰富，开箱即用
- 中文文档完善
- 企业级UI设计

建议：工作流编辑器用shadcn/ui，数据表用Ant Design Table

## 下一步

1. 创建新的frontend-react目录
2. 初始化Next.js项目
3. 开始Phase 1迁移
