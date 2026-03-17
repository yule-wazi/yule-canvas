import { chromium, Page, BrowserContext } from 'playwright';
import { Server } from 'socket.io';
import * as fs from 'fs';

interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export class PlaywrightExecutor {
  private browser: BrowserContext | null = null;
  private io: Server;
  private socketId: string;
  private executionTimeout: number = 5 * 60 * 1000; // 5分钟

  constructor(socketId: string, io: Server) {
    this.socketId = socketId;
    this.io = io;
  }

  private log(message: string) {
    this.io.to(this.socketId).emit('log', {
      timestamp: Date.now(),
      message
    });
  }

  private sendProgress(percent: number, message: string) {
    this.io.to(this.socketId).emit('progress', {
      percent,
      message
    });
  }

  async execute(code: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.log('正在启动浏览器...');
      this.sendProgress(10, '启动浏览器');
      
      // Windows系统常见的Chrome安装路径
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH || ''
      ];
      
      let executablePath = '';
      
      // 查找可用的Chrome路径
      for (const path of chromePaths) {
        if (path && fs.existsSync(path)) {
          executablePath = path;
          this.log(`找到Chrome: ${path}`);
          break;
        }
      }
      
      let browser;
      
      if (executablePath) {
        // 使用系统Chrome
        this.log('使用系统Chrome浏览器');
        browser = await chromium.launchPersistentContext(
          process.env.CHROME_USER_DATA || './chrome-data',
          {
            headless: false,
            executablePath: executablePath,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage'
            ]
          }
        );
      } else {
        // 尝试使用channel方式
        this.log('尝试使用系统Chrome (channel)');
        try {
          browser = await chromium.launchPersistentContext(
            process.env.CHROME_USER_DATA || './chrome-data',
            {
              headless: false,
              channel: 'chrome'
            }
          );
        } catch (e) {
          throw new Error('未找到Chrome浏览器。请安装Chrome或在.env中配置CHROME_PATH');
        }
      }
      
      this.browser = browser as any;

      this.log('浏览器启动成功');
      this.sendProgress(20, '创建页面');

      const page = browser.pages()[0] || await browser.newPage();

      this.log('开始执行脚本...');
      this.sendProgress(30, '执行脚本');

      // 创建脚本执行环境
      const result = await this.runScript(code, page);

      this.log('脚本执行完成');
      this.sendProgress(90, '清理资源');

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.sendProgress(100, '完成');

      const duration = Date.now() - startTime;
      return {
        success: true,
        data: result,
        duration
      };

    } catch (error: any) {
      this.log(`执行失败: ${error.message}`);
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  private async runScript(code: string, page: Page): Promise<any> {
    // 创建日志函数供脚本使用
    const log = (message: string) => {
      this.log(message);
    };

    // 使用AsyncFunction构造器执行代码
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const scriptFunction = new AsyncFunction('page', 'log', code);

    // 设置超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('脚本执行超时')), this.executionTimeout);
    });

    // 执行脚本
    const result = await Promise.race([
      scriptFunction(page, log),
      timeoutPromise
    ]);

    return result;
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.log('执行已停止');
    }
  }
}
