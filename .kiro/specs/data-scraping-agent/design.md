# 数据爬取Agent - 设计文档

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue 3)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 脚本生成界面  │  │ 脚本管理界面  │  │ 数据预览界面  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Monaco编辑器 │  │ 执行控制面板  │  │ 实时日志显示  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │AI模型适配器  │  │LocalStorage  │  │Socket.io客户端│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      后端 (Express)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API路由层   │  │Socket.io服务 │  │  CORS中间件  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Playwright执行│  │  AI代理服务  │  │  日志管理器  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    ┌──────────────┐
                    │ 阿里千问API  │
                    └──────────────┘
```

### 1.2 技术栈选型

**前端**:
- Vue 3 (Composition API)
- Vite (构建工具)
- Monaco Editor (代码编辑器)
- Socket.io-client (WebSocket客户端)
- Axios (HTTP请求)
- Pinia (状态管理)

**后端**:
- Express (Web框架)
- Socket.io (WebSocket服务)
- Playwright (浏览器自动化)
- Axios (HTTP客户端，调用AI API)
- CORS (跨域处理)

## 2. 模块设计

### 2.1 前端模块

#### 2.1.1 AI模型适配器模块

**职责**: 统一不同AI模型的请求和响应格式

**接口设计**:
```typescript
interface AIModelAdapter {
  id: string;
  name: string;
  formatRequest(prompt: string, options?: any): any;
  parseResponse(response: any): string;
}

class QwenAdapter implements AIModelAdapter {
  id = 'qwen';
  name = '阿里千问';
  
  formatRequest(prompt: string, options = {}) {
    return {
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: '你是一个Playwright脚本生成专家' },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      }
    };
  }
  
  parseResponse(response: any): string {
    return response.output.choices[0].message.content;
  }
}

class SiliconFlowAdapter implements AIModelAdapter {
  id = 'siliconflow';
  name = '硅基流动';
  
  formatRequest(prompt: string, options = {}) {
    return {
      model: options.model || 'Qwen/Qwen2.5-7B-Instruct',
      messages: [
        { role: 'system', content: '你是一个Playwright脚本生成专家' },
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      stream: false
    };
  }
  
  parseResponse(response: any): string {
    return response.choices[0].message.content;
  }
}
```

**扩展性**: 后续添加新模型只需实现`AIModelAdapter`接口

#### 2.1.2 LocalStorage管理模块

**职责**: 封装脚本和数据的本地存储操作

**接口设计**:
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

interface ScrapedData {
  id: string;
  scriptId: string;
  data: any;
  status: 'success' | 'failed';
  executedAt: number;
  duration: number;
  logs: string[];
}

class StorageManager {
  private SCRIPTS_KEY = 'scraping_scripts';
  private DATA_KEY = 'scraped_data';
  
  // 脚本CRUD
  saveScript(script: Script): void;
  getScript(id: string): Script | null;
  getAllScripts(): Script[];
  updateScript(id: string, updates: Partial<Script>): void;
  deleteScript(id: string): void;
  
  // 数据CRUD
  saveData(data: ScrapedData): void;
  getData(id: string): ScrapedData | null;
  getDataByScriptId(scriptId: string): ScrapedData[];
  deleteData(id: string): void;
  
  // 容量管理
  getStorageUsage(): { used: number; total: number };
  clearOldData(daysOld: number): void;
}
```

#### 2.1.3 Socket.io客户端模块

**职责**: 管理WebSocket连接，接收实时日志

**接口设计**:
```typescript
class SocketClient {
  private socket: Socket;
  
  connect(url: string): void;
  disconnect(): void;
  
  // 监听日志事件
  onLog(callback: (log: string) => void): void;
  
  // 监听执行完成事件
  onComplete(callback: (result: any) => void): void;
  
  // 监听错误事件
  onError(callback: (error: string) => void): void;
  
  // 发送执行请求
  executeScript(scriptId: string, code: string): void;
}
```

### 2.2 后端模块

#### 2.2.1 Playwright执行器模块

**职责**: 安全执行Playwright脚本并返回结果

**接口设计**:
```typescript
class PlaywrightExecutor {
  async execute(code: string, socketId: string): Promise<ExecutionResult> {
    const browser = await playwright.chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // 注入日志函数
      const logFunction = (message: string) => {
        io.to(socketId).emit('log', message);
      };
      
      // 执行脚本
      const result = await this.runScript(code, page, logFunction);
      
      await browser.close();
      return { success: true, data: result };
    } catch (error) {
      await browser.close();
      return { success: false, error: error.message };
    }
  }
  
  private async runScript(code: string, page: Page, log: Function): Promise<any> {
    // 使用 eval 或 Function 构造器执行代码
    // 提供 page 和 log 作为上下文
    const scriptFunction = new Function('page', 'log', code);
    return await scriptFunction(page, log);
  }
}
```

**安全措施**:
- 脚本执行超时限制（默认5分钟）
- 资源使用限制
- 禁止访问文件系统
- 沙箱环境隔离

#### 2.2.2 AI代理服务模块

**职责**: 调用AI模型API生成脚本

**接口设计**:
```typescript
class AIProxyService {
  private adapters: Map<string, AIModelAdapter>;
  
  async generateScript(prompt: string, modelId: string): Promise<string> {
    const adapter = this.adapters.get(modelId);
    if (!adapter) throw new Error('不支持的模型');
    
    const request = adapter.formatRequest(prompt);
    const response = await this.callAPI(adapter.apiEndpoint, request);
    return adapter.parseResponse(response);
  }
  
  private async callAPI(endpoint: string, data: any): Promise<any> {
    // 使用 axios 调用 AI API
  }
}
```

## 3. 数据流程

### 3.1 脚本生成流程

```
用户输入需求描述
    ↓
前端: 选择AI模型
    ↓
前端: 使用适配器格式化请求
    ↓
后端: 调用AI API
    ↓
后端: 解析响应，提取脚本代码
    ↓
前端: 显示生成的脚本
    ↓
前端: 保存到LocalStorage
```

### 3.2 脚本执行流程

```
用户点击执行按钮
    ↓
前端: 建立Socket.io连接
    ↓
前端: 发送脚本代码到后端
    ↓
后端: 启动Playwright浏览器
    ↓
后端: 执行脚本，实时发送日志
    ↓ (WebSocket)
前端: 显示实时日志
    ↓
后端: 执行完成，返回数据
    ↓
前端: 保存数据到LocalStorage
    ↓
前端: 显示执行结果
```

## 4. API接口定义

### 4.1 HTTP接口

#### POST /api/ai/generate
生成Playwright脚本

**请求**:
```json
{
  "prompt": "爬取淘宝商品列表的标题和价格",
  "model": "qwen"
}
```

**响应**:
```json
{
  "success": true,
  "code": "const products = await page.$$eval('.product', ...);",
  "error": null
}
```

#### GET /api/health
健康检查

**响应**:
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

### 4.2 WebSocket事件

#### 客户端 → 服务端

**execute-script**
```json
{
  "scriptId": "uuid",
  "code": "const data = await page.evaluate(...);"
}
```

#### 服务端 → 客户端

**log**
```json
{
  "timestamp": 1234567890,
  "message": "正在访问目标网站..."
}
```

**progress**
```json
{
  "percent": 50,
  "message": "已完成50%"
}
```

**complete**
```json
{
  "success": true,
  "data": { "products": [...] },
  "duration": 5000
}
```

**error**
```json
{
  "message": "执行失败: 超时"
}
```

## 5. 关键技术实现

### 5.1 Monaco Editor集成

使用`@guolao/vue-monaco-editor`库:

```vue
<template>
  <vue-monaco-editor
    v-model:value="code"
    language="javascript"
    theme="vs-dark"
    :options="editorOptions"
  />
</template>

<script setup>
import { ref } from 'vue';

const code = ref('');
const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 14
};
</script>
```

### 5.2 Socket.io实时通信

**后端设置**:
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173' }
});

io.on('connection', (socket) => {
  socket.on('execute-script', async ({ scriptId, code }) => {
    const executor = new PlaywrightExecutor(socket.id, io);
    const result = await executor.execute(code);
    socket.emit('complete', result);
  });
});
```

**前端连接**:
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('log', (log) => {
  console.log(log.message);
});

socket.on('complete', (result) => {
  console.log('执行完成', result);
});

socket.emit('execute-script', { scriptId, code });
```

### 5.3 AI Prompt工程

**系统Prompt模板**:
```
你是一个Playwright脚本生成专家。请根据用户的需求生成可执行的Playwright代码。

要求：
1. 只返回JavaScript代码，不要有任何解释
2. 代码中可以使用 page 对象（已提供）
3. 使用 log() 函数输出执行日志
4. 最后返回爬取的数据对象
5. 处理可能的异常情况

示例：
用户需求：爬取百度首页的标题
生成代码：
```javascript
log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(`获取到标题: ${title}`);
return { title };
```

现在请根据以下需求生成代码：
{用户输入的需求}
```

## 6. 安全性设计

### 6.1 脚本执行安全

- 使用VM2或isolated-vm创建沙箱环境
- 限制可访问的Node.js模块
- 禁止文件系统操作
- 设置执行超时（5分钟）
- 限制内存使用

### 6.2 API安全

- CORS白名单配置
- API请求频率限制
- AI API密钥加密存储
- 输入验证和清理

### 6.3 数据安全

- LocalStorage数据加密（可选）
- 敏感信息脱敏
- 定期清理过期数据

## 7. 性能优化

### 7.1 前端优化

- 虚拟滚动（脚本列表）
- 代码编辑器懒加载
- 防抖处理（搜索、自动保存）
- 组件按需加载

### 7.2 后端优化

- Playwright浏览器实例复用
- 并发执行队列管理
- 日志批量发送（减少WebSocket消息数）
- 响应缓存

## 8. 错误处理

### 8.1 前端错误处理

```typescript
class ErrorHandler {
  handle(error: Error, context: string) {
    console.error(`[${context}]`, error);
    
    // 用户友好的错误提示
    const message = this.getUserMessage(error);
    showNotification(message, 'error');
    
    // 上报错误（可选）
    this.report(error, context);
  }
  
  private getUserMessage(error: Error): string {
    if (error.message.includes('timeout')) {
      return '执行超时，请检查脚本或网络';
    }
    if (error.message.includes('network')) {
      return '网络错误，请检查连接';
    }
    return '操作失败，请重试';
  }
}
```

### 8.2 后端错误处理

```typescript
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? '服务器错误' 
      : err.message
  });
});
```

## 9. 测试策略

### 9.1 单元测试

- AI适配器测试
- StorageManager测试
- PlaywrightExecutor测试

### 9.2 集成测试

- 前后端API通信测试
- WebSocket连接测试
- 完整脚本执行流程测试

### 9.3 E2E测试

- 用户生成脚本流程
- 用户执行脚本流程
- 脚本管理流程

## 10. 部署方案

### 10.1 开发环境

```bash
# 前端
cd frontend
npm install
npm run dev  # http://localhost:5173

# 后端
cd backend
npm install
npm run dev  # http://localhost:3000
```

### 10.2 生产环境

**前端**: 
- 构建: `npm run build`
- 部署到静态服务器（Nginx/Vercel）

**后端**:
- 使用PM2管理进程
- 配置反向代理（Nginx）
- 安装Playwright浏览器依赖

## 11. 项目结构

```
project/
├── frontend/                 # Vue3前端
│   ├── src/
│   │   ├── components/      # 组件
│   │   │   ├── ScriptEditor.vue
│   │   │   ├── ScriptList.vue
│   │   │   ├── ExecutionPanel.vue
│   │   │   └── DataPreview.vue
│   │   ├── services/        # 服务层
│   │   │   ├── aiAdapter.ts
│   │   │   ├── storage.ts
│   │   │   └── socket.ts
│   │   ├── stores/          # Pinia状态管理
│   │   ├── views/           # 页面
│   │   └── App.vue
│   ├── package.json
│   └── vite.config.ts
│
└── backend/                 # Express后端
    ├── src/
    │   ├── routes/          # 路由
    │   │   └── api.ts
    │   ├── services/        # 服务
    │   │   ├── playwright.ts
    │   │   └── aiProxy.ts
    │   ├── socket/          # WebSocket处理
    │   │   └── handlers.ts
    │   └── server.ts        # 入口文件
    ├── package.json
    └── tsconfig.json
```

## 12. 开发优先级

### Phase 1: 基础框架（1-2周）
1. 前后端项目初始化
2. 基础UI布局
3. Express服务器搭建
4. Socket.io集成

### Phase 2: 核心功能（2-3周）
1. Monaco Editor集成
2. LocalStorage管理
3. Playwright执行器
4. 实时日志传输

### Phase 3: AI集成（1-2周）
1. 阿里千问API集成
2. AI适配器架构
3. Prompt优化

### Phase 4: 完善功能（1-2周）
1. 脚本管理CRUD
2. 数据预览
3. 错误处理
4. 性能优化

## 13. 风险与挑战

### 13.1 技术风险

- Playwright在服务器环境的资源消耗
- LocalStorage容量限制
- WebSocket连接稳定性

### 13.2 解决方案

- 实现执行队列，限制并发数
- 提供数据导出和清理功能
- 实现自动重连机制

## 14. 后续扩展

- 支持更多AI模型（GPT-4、Claude）
- 脚本模板库
- 数据可视化
- 定时任务执行
- 团队协作功能
- 云端存储
