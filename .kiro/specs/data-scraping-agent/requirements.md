# 数据爬取Agent - 需求文档

## 1. 项目概述

开发一个AI驱动的网站搭建平台，核心包含两个智能体：
- **数据爬取Agent**：在生产环境中通过Playwright爬取外部平台数据
- **网站搭建Agent**：基于预设组件框架，根据用户需求生成网站

本需求文档聚焦于**第一阶段：数据爬取Agent及其基础支持**。

## 2. 技术栈

- **前端框架**: Vue 3 + Vite
- **后端框架**: Express (Node.js)
- **爬虫库**: Playwright (后端执行)
- **AI模型**: 
  - 阿里千问 (Qwen)
  - 硅基流动 (SiliconFlow)
  - 支持多模型扩展
- **数据存储**: LocalStorage (前端临时存储)

## 3. 用户故事

### 3.1 作为用户，我希望能够通过AI生成Playwright爬虫脚本
**验收标准**:
- 用户可以通过自然语言描述需要爬取的数据
- AI（大模型）能够理解需求并生成有效的Playwright脚本
- 生成的脚本符合Playwright语法规范

### 3.2 作为用户，我希望能够在网页端触发并执行Playwright脚本
**验收标准**:
- 网页提供脚本执行界面
- 用户可以在前端插入和编辑脚本
- 用户点击执行按钮后，脚本发送到后端Express服务器执行
- 后端使用Playwright执行脚本并返回结果
- 执行过程有可视化反馈（进度、状态、日志）

### 3.3 作为用户，我希望爬取的数据能够被临时存储在本地
**验收标准**:
- 爬取完成的数据保存到LocalStorage
- 数据格式结构化（JSON格式）
- 数据可以被后续的搭建Agent访问和使用
- 提供数据预览功能
- 支持数据的编辑和删除操作

### 3.4 作为用户，我希望能够管理我的爬虫脚本
**验收标准**:
- 可以查看历史生成的脚本列表（存储在LocalStorage）
- 可以在前端编辑已有脚本代码
- 可以删除不需要的脚本
- 可以重新执行历史脚本
- 脚本有命名和描述功能
- 所有操作立即同步到LocalStorage

### 3.5 作为开发者，我希望系统支持多种AI模型
**验收标准**:
- 默认集成阿里千问(Qwen)和硅基流动(SiliconFlow)模型
- 提供AI模型选择器界面
- 系统能够适配不同模型的API参数格式
- 系统能够统一处理不同模型的输出格式
- 支持后续扩展其他模型（OpenAI、Claude等）

## 4. 功能需求

### 4.1 AI脚本生成模块
- 集成阿里千问(Qwen)和硅基流动(SiliconFlow)模型API
- 设计AI模型适配器架构，支持多模型扩展
- 统一不同模型的请求参数格式（temperature、max_tokens等）
- 统一不同模型的响应格式解析
- 提供Prompt模板，引导AI生成Playwright脚本
- 脚本验证机制（语法检查）
- 脚本优化建议
- 模型选择器UI组件

### 4.2 后端Playwright执行引擎
- Express服务器搭建
- 接收前端发送的Playwright脚本
- 在Node.js环境中执行Playwright脚本
- 实时返回执行日志和进度
- 返回爬取的数据结果
- 错误捕获和异常处理
- 脚本执行超时控制
- 并发执行管理

### 4.3 前端脚本管理模块
- 脚本编辑器（支持JavaScript代码高亮）
- 脚本插入和编辑功能
- 脚本列表展示（从LocalStorage读取）
- 脚本CRUD操作（创建、读取、更新、删除）
- 脚本元数据管理（名称、描述、创建时间、执行次数）
- LocalStorage数据持久化

### 4.4 数据存储模块
- LocalStorage封装工具类
- 脚本数据结构设计
- 爬取结果数据结构设计
- 数据序列化和反序列化
- 数据容量监控（LocalStorage限制约5-10MB）
- 数据清理和过期机制
- 数据导出功能（JSON下载）

### 4.5 用户界面
- 脚本生成界面（输入需求描述）
- AI模型选择下拉框
- 脚本编辑器（Monaco Editor或CodeMirror）
- 执行控制面板（开始/停止/查看日志）
- 实时日志显示区域
- 数据预览界面（表格或JSON树形展示）
- 脚本管理列表（卡片或表格形式）

## 5. 非功能需求

### 5.1 性能
- 脚本执行响应时间 < 3秒启动
- 支持并发执行多个爬虫任务
- 大数据量爬取时不阻塞UI

### 5.2 安全性
- 脚本执行沙箱隔离
- 防止恶意脚本注入
- 用户数据隐私保护
- CORS和CSP策略配置

### 5.3 可用性
- 界面简洁直观
- 错误提示清晰友好
- 支持中文界面
- 移动端响应式设计

### 5.4 可维护性
- 代码模块化设计
- 完善的错误日志
- 单元测试覆盖率 > 70%

## 6. 技术约束

### 6.1 前后端架构
- 前端Vue3负责UI和脚本管理
- 后端Express负责Playwright脚本执行
- 前后端通过HTTP API通信
- 需要处理跨域问题（CORS配置）

### 6.2 LocalStorage限制
- 存储容量限制（通常5-10MB）
- 需要监控存储使用情况
- 大数据量时需要提示用户清理
- 数据仅存储在客户端，换设备或清除缓存会丢失

### 6.3 AI模型适配
- 不同模型API格式差异（请求/响应结构）
- 不同模型的token计费方式
- 需要设计统一的适配器接口
- 错误处理需要兼容各模型的错误格式

### 6.4 Playwright执行限制
- 后端需要安装Playwright浏览器
- 执行时间可能较长，需要异步处理
- 资源消耗较大，需要限制并发数
- 需要处理脚本执行失败的情况

## 7. 里程碑

### 阶段1: 基础框架搭建（当前阶段）
- [ ] Vite + Vue3 前端项目初始化
- [ ] Express 后端项目初始化
- [ ] 基础UI框架搭建
- [ ] 前后端通信API设计

### 阶段2: AI模型集成
- [ ] 阿里千问API集成
- [ ] AI模型适配器架构设计
- [ ] 统一请求/响应格式处理
- [ ] 模型选择器UI实现

### 阶段3: 脚本管理功能
- [ ] LocalStorage封装工具
- [ ] 脚本CRUD功能实现
- [ ] 脚本编辑器集成（Monaco/CodeMirror）
- [ ] 脚本列表UI实现

### 阶段4: Playwright执行引擎
- [ ] Express后端Playwright执行接口
- [ ] 前端脚本提交和执行触发
- [ ] 实时日志传输（WebSocket或轮询）
- [ ] 执行结果返回和展示

### 阶段5: 数据管理
- [ ] 爬取数据存储到LocalStorage
- [ ] 数据预览界面
- [ ] 数据编辑和删除功能
- [ ] 数据导出功能

### 阶段6: 完善和优化
- [ ] 错误处理和用户提示
- [ ] 性能优化
- [ ] 单元测试
- [ ] 文档编写

### 阶段7: 网站搭建Agent（后续）
- [ ] 组件库开发
- [ ] 搭建引擎实现
- [ ] 与爬取Agent数据对接

## 8. 待确认问题

1. ~~**Playwright浏览器端执行方案**~~：✅ 已确认使用Express后端执行
2. ~~**大模型选择**~~：✅ 已确认使用阿里千问(Qwen)，支持多模型扩展
3. ~~**数据存储方案**~~：✅ 已确认使用LocalStorage
4. **实时日志传输方案**：使用WebSocket还是HTTP轮询？
5. **脚本编辑器选择**：Monaco Editor（VS Code同款）还是CodeMirror？
6. **后端部署方案**：本地开发环境 vs 云服务器部署
7. **AI模型扩展优先级**：除了千问，下一个要支持哪个模型？

## 9. 数据结构设计

### 9.1 脚本对象结构（LocalStorage）
```javascript
{
  id: string,              // 唯一标识
  name: string,            // 脚本名称
  description: string,     // 脚本描述
  code: string,            // Playwright脚本代码
  aiModel: string,         // 使用的AI模型
  createdAt: timestamp,    // 创建时间
  updatedAt: timestamp,    // 更新时间
  executionCount: number,  // 执行次数
  lastExecutedAt: timestamp // 最后执行时间
}
```

### 9.2 爬取数据结构（LocalStorage）
```javascript
{
  id: string,              // 唯一标识
  scriptId: string,        // 关联的脚本ID
  data: any,               // 爬取的数据（JSON格式）
  status: string,          // 状态：success/failed
  executedAt: timestamp,   // 执行时间
  duration: number,        // 执行耗时（毫秒）
  logs: string[]           // 执行日志
}
```

### 9.3 AI模型配置结构
```javascript
{
  id: string,              // 模型标识（qwen/siliconflow/gpt-4等）
  name: string,            // 显示名称
  provider: string,        // 提供商（阿里云/硅基流动等）
  apiEndpoint: string,     // API端点
  apiKey: string,          // API密钥
  models: string[],        // 可用模型列表
  requestAdapter: function, // 请求格式适配器
  responseAdapter: function // 响应格式适配器
}
```

## 10. API接口设计

### 10.1 后端Express API

#### POST /api/execute-script
执行Playwright脚本
- 请求体：`{ code: string, scriptId: string }`
- 响应：`{ success: boolean, data: any, logs: string[], error?: string }`

#### GET /api/execution-status/:executionId
查询执行状态（用于长时间运行的脚本）
- 响应：`{ status: string, progress: number, logs: string[] }`

#### POST /api/ai/generate-script
调用AI生成脚本
- 请求体：`{ prompt: string, model: string }`
- 响应：`{ success: boolean, code: string, error?: string }`

## 11. 参考资料

- [Playwright官方文档](https://playwright.dev/)
- [Vue 3官方文档](https://vuejs.org/)
- [Vite官方文档](https://vitejs.dev/)
- [Express官方文档](https://expressjs.com/)
- [阿里千问API文档](https://help.aliyun.com/zh/dashscope/)
- [硅基流动API文档](https://siliconflow.cn/zh-cn/siliconcloud)
- [LocalStorage使用指南](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage)
