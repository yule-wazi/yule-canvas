# 数据爬取Agent

一个AI驱动的网页数据爬取工具，支持通过AI自动生成Playwright爬虫脚本。

## 技术栈

### 前端
- Vue 3 + Vite
- TypeScript
- Vue Router
- Pinia (状态管理)
- Monaco Editor (代码编辑器)
- Socket.io-client (实时通信)
- Axios (HTTP客户端)

### 后端
- Express
- TypeScript
- Socket.io (WebSocket服务)
- Playwright (浏览器自动化)
- 阿里千问 & 硅基流动 (AI模型)

## 项目结构

```
.
├── frontend/          # Vue3前端项目
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── views/        # 页面
│   │   ├── router/       # 路由配置
│   │   ├── stores/       # Pinia状态管理
│   │   ├── services/     # 服务层(API, Socket, Storage)
│   │   └── main.ts       # 入口文件
│   └── package.json
│
└── backend/           # Express后端项目
    ├── src/
    │   ├── routes/       # API路由
    │   ├── services/     # 业务服务
    │   └── server.ts     # 服务器入口
    └── package.json
```

## 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install
```

### 2. 配置环境变量

编辑 `backend/.env` 文件，填入你的AI API密钥：

```env
QWEN_API_KEY=your_qwen_api_key_here
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```

### 3. 启动项目

```bash
# 启动后端 (在backend目录)
npm run dev

# 启动前端 (在frontend目录，新开一个终端)
npm run dev
```

### 4. 访问应用

打开浏览器访问: http://localhost:5173

## 功能特性

- ✅ 基础框架搭建完成
- ✅ 前后端通信配置
- ✅ Socket.io实时通信
- ✅ LocalStorage数据管理
- ✅ AI脚本生成（阿里千问 & 硅基流动）
- ✅ Monaco代码编辑器
- ✅ Playwright执行引擎
- ✅ 实时日志显示
- ✅ 脚本管理（CRUD）
- ✅ 数据预览和管理
- 🚧 脚本模板库（计划中）
- 🚧 定时任务（计划中）

## 使用指南

### 1. 生成脚本

1. 进入"脚本管理"页面
2. 在左侧"AI生成脚本"区域：
   - 选择AI模型（阿里千问或硅基流动）
   - 输入需求描述，例如："爬取百度首页的标题"
   - 点击"生成脚本"
3. 等待AI生成代码
4. 查看生成的代码，可以手动编辑
5. 点击"保存脚本"

### 2. 执行脚本

1. 在脚本列表中选择一个脚本，或使用刚生成的脚本
2. 代码会显示在右侧编辑器中
3. 点击"执行脚本"按钮
4. 实时查看执行日志
5. 执行完成后查看结果

### 3. 管理数据

1. 进入"数据管理"页面
2. 查看所有爬取记录
3. 点击记录查看详细数据
4. 支持JSON和表格两种视图
5. 可以导出数据为JSON文件

### 4. 配置API密钥

编辑 `backend/.env` 文件：

```env
# 阿里千问
QWEN_API_KEY=sk-your-qwen-key-here

# 硅基流动
SILICONFLOW_API_KEY=sk-your-siliconflow-key-here
```

## 脚本编写指南

生成的Playwright脚本可以使用以下API：

```javascript
// page对象 - Playwright页面实例
await page.goto('https://example.com');
await page.waitForLoadState('networkidle');
const title = await page.title();

// log函数 - 输出日志
log('开始执行');
log('访问页面成功');

// 返回数据
return { title, data: [...] };
```

### 示例脚本

```javascript
log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(`获取到标题: ${title}`);
return { title };
```

## 开发进度

查看 `.kiro/specs/data-scraping-agent/tasks.md` 了解详细的开发任务列表。

## License

MIT
