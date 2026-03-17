# 开发文档

## 项目概述

数据爬取Agent是一个AI驱动的网页数据爬取工具，支持通过AI自动生成Playwright爬虫脚本，并在浏览器环境中执行。

## 已完成功能

### Phase 1: 基础框架 ✅
- [x] Vue3 + Vite前端项目
- [x] Express + TypeScript后端项目
- [x] Vue Router路由配置
- [x] Pinia状态管理
- [x] Axios HTTP客户端
- [x] Socket.io实时通信
- [x] CORS跨域配置
- [x] 环境变量管理

### Phase 2: 核心功能 ✅
- [x] LocalStorage管理模块
- [x] Monaco Editor代码编辑器
- [x] Playwright执行引擎
- [x] 实时日志系统
- [x] 执行控制面板
- [x] 脚本CRUD功能
- [x] 脚本列表和搜索

### Phase 3: AI集成 ✅
- [x] AI模型适配器架构
- [x] 阿里千问API集成
- [x] 硅基流动API集成
- [x] 脚本生成界面
- [x] Prompt工程优化

### Phase 4: 数据管理 ✅
- [x] 数据预览组件
- [x] JSON/表格视图切换
- [x] 数据导出功能
- [x] 数据列表管理
- [x] 执行历史记录

### Phase 5: 完善优化 🚧
- [x] 错误处理工具类
- [x] 用户界面优化
- [ ] 性能优化
- [ ] 安全性增强
- [ ] 单元测试

## 技术架构

### 前端技术栈
```
Vue 3.x
├── Vite (构建工具)
├── TypeScript (类型系统)
├── Vue Router (路由)
├── Pinia (状态管理)
├── Monaco Editor (代码编辑器)
├── Socket.io-client (WebSocket)
└── Axios (HTTP客户端)
```

### 后端技术栈
```
Node.js + Express
├── TypeScript
├── Socket.io (WebSocket服务)
├── Playwright (浏览器自动化)
├── Axios (HTTP客户端)
└── dotenv (环境变量)
```

## 目录结构

```
project/
├── frontend/                 # Vue3前端
│   ├── src/
│   │   ├── components/      # 组件
│   │   │   ├── Layout.vue
│   │   │   ├── ScriptEditor.vue
│   │   │   ├── ScriptGenerator.vue
│   │   │   ├── ScriptList.vue
│   │   │   ├── ExecutionPanel.vue
│   │   │   └── DataPreview.vue
│   │   ├── views/           # 页面
│   │   │   ├── Home.vue
│   │   │   ├── ScriptManagement.vue
│   │   │   └── DataManagement.vue
│   │   ├── router/          # 路由
│   │   ├── stores/          # 状态管理
│   │   ├── services/        # 服务层
│   │   │   ├── api.ts
│   │   │   ├── socket.ts
│   │   │   └── storage.ts
│   │   ├── utils/           # 工具类
│   │   └── main.ts
│   └── package.json
│
└── backend/                 # Express后端
    ├── src/
    │   ├── routes/          # 路由
    │   │   └── api.ts
    │   ├── services/        # 服务
    │   │   ├── PlaywrightExecutor.ts
    │   │   └── AIAdapter.ts
    │   └── server.ts
    └── package.json
```

## 核心模块说明

### 1. AI模型适配器 (AIAdapter)

支持多个AI模型的统一接口：

```typescript
interface AIModelAdapter {
  id: string;
  name: string;
  formatRequest(prompt: string, options?: any): any;
  parseResponse(response: any): string;
  getApiEndpoint(): string;
  getApiKey(): string;
}
```

已实现：
- QwenAdapter (阿里千问)
- SiliconFlowAdapter (硅基流动)

### 2. Playwright执行器 (PlaywrightExecutor)

负责在后端执行Playwright脚本：

- 浏览器生命周期管理
- 脚本沙箱执行
- 实时日志推送
- 超时控制
- 错误处理

### 3. LocalStorage管理器 (StorageManager)

管理本地数据存储：

- 脚本CRUD操作
- 数据CRUD操作
- 容量监控
- 数据清理

### 4. Socket.io通信

实时双向通信：

**客户端 → 服务端**:
- `execute-script`: 执行脚本请求
- `stop-execution`: 停止执行

**服务端 → 客户端**:
- `log`: 执行日志
- `progress`: 执行进度
- `complete`: 执行完成
- `error`: 错误信息

## API接口

### HTTP接口

#### GET /api/health
健康检查

#### GET /api/ai/models
获取可用AI模型列表

#### POST /api/ai/generate
生成Playwright脚本

**请求**:
```json
{
  "prompt": "爬取百度首页标题",
  "model": "qwen"
}
```

**响应**:
```json
{
  "success": true,
  "code": "// 生成的代码",
  "error": null
}
```

### WebSocket事件

#### execute-script
```json
{
  "scriptId": "uuid",
  "code": "// Playwright代码"
}
```

#### log
```json
{
  "timestamp": 1234567890,
  "message": "日志信息"
}
```

#### complete
```json
{
  "success": true,
  "data": {},
  "duration": 5000
}
```

## 数据结构

### Script (脚本)
```typescript
interface Script {
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
```

### ScrapedData (爬取数据)
```typescript
interface ScrapedData {
  id: string;
  scriptId: string;
  data: any;
  status: 'success' | 'failed';
  executedAt: number;
  duration: number;
  logs: string[];
}
```

## 开发指南

### 添加新的AI模型

1. 创建适配器类实现 `AIModelAdapter` 接口
2. 在 `AIAdapterManager` 中注册
3. 添加环境变量配置

```typescript
export class NewModelAdapter implements AIModelAdapter {
  id = 'newmodel';
  name = '新模型';
  
  formatRequest(prompt: string, options: any = {}) {
    // 实现请求格式化
  }
  
  parseResponse(response: any): string {
    // 实现响应解析
  }
  
  getApiEndpoint(): string {
    return process.env.NEWMODEL_API_ENDPOINT || '';
  }
  
  getApiKey(): string {
    return process.env.NEWMODEL_API_KEY || '';
  }
}
```

### 扩展脚本功能

在 `PlaywrightExecutor` 中可以注入更多上下文：

```typescript
const scriptFunction = new AsyncFunction('page', 'log', 'utils', code);
const result = await scriptFunction(page, log, customUtils);
```

## 部署说明

### 开发环境

```bash
# 前端
cd frontend
npm run dev

# 后端
cd backend
npm run dev
```

### 生产环境

```bash
# 前端构建
cd frontend
npm run build

# 后端构建
cd backend
npm run build
npm start
```

### 环境变量

**后端 (.env)**:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
QWEN_API_KEY=your_key
SILICONFLOW_API_KEY=your_key
```

**前端 (.env)**:
```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## 性能优化建议

1. **Playwright浏览器复用**: 实现浏览器实例池
2. **并发控制**: 限制同时执行的脚本数量
3. **日志批量发送**: 减少WebSocket消息频率
4. **虚拟滚动**: 优化长列表渲染
5. **代码分割**: 按需加载组件

## 安全性考虑

1. **脚本沙箱**: 限制脚本可访问的API
2. **API密钥加密**: 不在前端暴露密钥
3. **输入验证**: 验证和清理用户输入
4. **CORS配置**: 限制跨域访问
5. **执行超时**: 防止脚本无限执行

## 已知问题

1. LocalStorage容量限制（约5-10MB）
2. 长时间运行的脚本可能超时
3. 某些网站可能有反爬虫机制

## 后续计划

- [ ] 脚本模板库
- [ ] 定时任务执行
- [ ] 数据可视化
- [ ] 云端存储同步
- [ ] 团队协作功能
- [ ] 更多AI模型支持

## 贡献指南

欢迎提交Issue和Pull Request！

## License

MIT
