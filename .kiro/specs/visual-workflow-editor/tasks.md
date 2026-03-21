# 可视化工作流编辑器 - 任务列表

## 阶段1: 基础架构搭建

### 1.1 安装依赖和配置
- [ ] 1.1.1 安装Vue Flow库 (`@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`)
- [ ] 1.1.2 安装AST解析库 (`acorn` 或 `@babel/parser`)
- [ ] 1.1.3 配置TypeScript类型定义
- [ ] 1.1.4 创建基础目录结构

### 1.2 数据模型定义
- [ ] 1.2.1 创建Block类型定义 (`types/block.ts`)
- [ ] 1.2.2 创建Connection类型定义 (`types/connection.ts`)
- [ ] 1.2.3 创建Workflow类型定义 (`types/workflow.ts`)
- [ ] 1.2.4 创建BlockData类型定义（各种block的配置）

### 1.3 状态管理
- [ ] 1.3.1 创建Workflow Store (`stores/workflow.ts`)
- [ ] 1.3.2 实现基础actions（addBlock, removeBlock, updateBlock）
- [ ] 1.3.3 实现连接管理actions（addConnection, removeConnection）
- [ ] 1.3.4 实现历史记录（undo/redo）

## 阶段2: Block库开发

### 2.1 Block基础组件
- [ ] 2.1.1 创建通用Block组件 (`components/blocks/BaseBlock.vue`)
- [ ] 2.1.2 实现Block端口渲染
- [ ] 2.1.3 实现Block配置面板
- [ ] 2.1.4 实现Block样式系统（不同类型不同颜色）

### 2.2 浏览器控制类Block
- [ ] 2.2.1 实现Navigate Block（访问页面）
- [ ] 2.2.2 实现Scroll Block（滚动页面）
- [ ] 2.2.3 实现Wait Block（等待）

### 2.3 页面交互类Block
- [ ] 2.3.1 实现Click Block（点击元素）
- [ ] 2.3.2 实现Type Block（输入文本）
- [ ] 2.3.3 实现Select Block（选择下拉框）

### 2.4 数据提取类Block
- [ ] 2.4.1 实现Extract Block（提取数据）
- [ ] 2.4.2 实现Extract Images Block（提取图片）
- [ ] 2.4.3 实现Extract Links Block（提取链接）

### 2.5 逻辑控制类Block
- [ ] 2.5.1 实现Condition Block（条件判断）
- [ ] 2.5.2 实现Loop Block（循环）
- [ ] 2.5.3 实现Log Block（日志输出）

### 2.6 数据处理类Block
- [ ] 2.6.1 实现Transform Block（数据转换）
- [ ] 2.6.2 实现Filter Block（数据过滤）

## 阶段3: 可视化编辑器

### 3.1 编辑器核心功能
- [ ] 3.1.1 创建WorkflowEditor组件 (`components/WorkflowEditor.vue`)
- [ ] 3.1.2 集成Vue Flow
- [ ] 3.1.3 实现画布拖拽和缩放
- [ ] 3.1.4 实现网格对齐

### 3.2 Block工具栏
- [ ] 3.2.1 创建BlockPalette组件 (`components/BlockPalette.vue`)
- [ ] 3.2.2 实现Block分类显示
- [ ] 3.2.3 实现拖拽添加Block
- [ ] 3.2.4 实现Block搜索功能

### 3.3 连接管理
- [ ] 3.3.1 实现拖拽创建连接
- [ ] 3.3.2 实现连接验证（类型匹配）
- [ ] 3.3.3 实现连接删除
- [ ] 3.3.4 实现连接样式（控制流/数据流）

### 3.4 属性面板
- [ ] 3.4.1 创建PropertyPanel组件 (`components/PropertyPanel.vue`)
- [ ] 3.4.2 实现Block配置编辑
- [ ] 3.4.3 实现表单验证
- [ ] 3.4.4 实现实时预览

### 3.5 工具栏
- [ ] 3.5.1 创建Toolbar组件 (`components/Toolbar.vue`)
- [ ] 3.5.2 实现保存/加载功能
- [ ] 3.5.3 实现撤销/重做按钮
- [ ] 3.5.4 实现代码视图切换

## 阶段4: 脚本转换

### 4.1 脚本解析器
- [ ] 4.1.1 创建ScriptParser类 (`services/ScriptParser.ts`)
- [ ] 4.1.2 实现AST解析
- [ ] 4.1.3 实现模式识别（goto, click, evaluate等）
- [ ] 4.1.4 实现Block生成
- [ ] 4.1.5 实现连接关系构建

### 4.2 Block编译器
- [ ] 4.2.1 创建BlockCompiler类 (`services/BlockCompiler.ts`)
- [ ] 4.2.2 实现工作流验证
- [ ] 4.2.3 实现拓扑排序
- [ ] 4.2.4 实现代码生成（各种Block类型）
- [ ] 4.2.5 实现代码组装

### 4.3 代码模板
- [ ] 4.3.1 创建代码模板系统 (`templates/`)
- [ ] 4.3.2 实现Navigate模板
- [ ] 4.3.3 实现Scroll模板
- [ ] 4.3.4 实现Extract模板
- [ ] 4.3.5 实现其他Block模板

## 阶段5: 后端集成

### 5.1 API开发
- [ ] 5.1.1 创建workflow路由 (`backend/src/routes/workflow.ts`)
- [ ] 5.1.2 实现解析API (`POST /api/workflow/parse`)
- [ ] 5.1.3 实现编译API (`POST /api/workflow/compile`)
- [ ] 5.1.4 实现执行API (`POST /api/workflow/execute`)
- [ ] 5.1.5 实现保存/加载API

### 5.2 存储管理
- [ ] 5.2.1 扩展StorageManager支持工作流
- [ ] 5.2.2 实现工作流CRUD操作
- [ ] 5.2.3 实现工作流导入/导出

### 5.3 执行引擎
- [ ] 5.3.1 创建WorkflowExecutor类 (`backend/src/services/WorkflowExecutor.ts`)
- [ ] 5.3.2 实现Block执行器
- [ ] 5.3.3 实现数据流传递
- [ ] 5.3.4 实现错误处理

## 阶段6: UI/UX优化

### 6.1 界面美化
- [ ] 6.1.1 设计Block图标
- [ ] 6.1.2 优化Block样式
- [ ] 6.1.3 优化连接线样式
- [ ] 6.1.4 添加动画效果

### 6.2 交互优化
- [ ] 6.2.1 添加快捷键支持
- [ ] 6.2.2 添加右键菜单
- [ ] 6.2.3 添加多选功能
- [ ] 6.2.4 添加复制/粘贴功能

### 6.3 提示和帮助
- [ ] 6.3.1 添加Block使用说明
- [ ] 6.3.2 添加操作提示
- [ ] 6.3.3 添加示例工作流
- [ ] 6.3.4 创建用户指南

## 阶段7: 集成和测试

### 7.1 与现有系统集成
- [ ] 7.1.1 在ScriptManagement页面添加"可视化编辑"按钮
- [ ] 7.1.2 实现脚本和工作流的双向切换
- [ ] 7.1.3 保持数据格式兼容性
- [ ] 7.1.4 更新AI生成脚本的流程

### 7.2 测试
- [ ] 7.2.1 编写Block组件单元测试
- [ ] 7.2.2 编写Parser和Compiler测试
- [ ] 7.2.3 编写Store测试
- [ ] 7.2.4 编写E2E测试

### 7.3 性能优化
- [ ] 7.3.1 优化大型工作流渲染
- [ ] 7.3.2 优化拖拽性能
- [ ] 7.3.3 添加加载状态
- [ ] 7.3.4 优化编译速度

## 阶段8: 高级功能

### 8.1 模板系统
- [ ] 8.1.1* 创建工作流模板库
- [ ] 8.1.2* 实现模板保存和加载
- [ ] 8.1.3* 实现模板分享功能

### 8.2 变量系统
- [ ] 8.2.1* 实现全局变量管理
- [ ] 8.2.2* 实现变量在Block间传递
- [ ] 8.2.3* 实现变量编辑器

### 8.3 调试功能
- [ ] 8.3.1* 实现断点功能
- [ ] 8.3.2* 实现单步执行
- [ ] 8.3.3* 实现变量查看器

### 8.4 扩展性
- [ ] 8.4.1* 实现自定义Block注册
- [ ] 8.4.2* 实现插件系统
- [ ] 8.4.3* 创建Block开发文档

## 里程碑

### M1: 基础框架 (阶段1-2)
- 完成数据模型和状态管理
- 完成基础Block库
- 预计时间: 3-4天

### M2: 可视化编辑器 (阶段3)
- 完成编辑器核心功能
- 完成Block工具栏和属性面板
- 预计时间: 3-4天

### M3: 脚本转换 (阶段4-5)
- 完成解析器和编译器
- 完成后端API
- 预计时间: 3-4天

### M4: 集成和优化 (阶段6-7)
- 完成UI/UX优化
- 完成系统集成和测试
- 预计时间: 2-3天

### M5: 高级功能 (阶段8, 可选)
- 完成模板、变量、调试等高级功能
- 预计时间: 3-5天

## 注意事项

1. 标记为 `*` 的任务为可选任务，可以在后续迭代中实现
2. 每个阶段完成后需要进行代码审查和测试
3. 优先实现核心功能，确保基本可用性
4. 保持与现有系统的兼容性
5. 注意性能优化，特别是大型工作流的处理
