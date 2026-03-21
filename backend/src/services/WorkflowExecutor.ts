import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export class WorkflowExecutor {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async execute(code: string): Promise<any> {
    try {
      // 启动浏览器
      await this.launchBrowser();

      if (!this.page) {
        throw new Error('页面未初始化');
      }

      // 创建日志函数
      const logs: string[] = [];
      const log = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        logs.push(logMessage);
        console.log(logMessage);
      };

      // 创建执行上下文
      const context = {
        page: this.page,
        log
      };

      // 包装代码为异步函数
      const wrappedCode = `
        return (async function() {
          const { page, log } = this;
          ${code}
        }).call(this);
      `;

      // 执行代码
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(wrappedCode);
      const result = await fn.call(context);

      // 如果结果包含提取的数据，处理数据表保存
      if (result && result.results) {
        log('数据提取完成，共 ' + result.count + ' 条');
        
        // 返回结果，包含数据表信息
        result._needsSave = true;
      }

      return {
        success: true,
        result,
        logs
      };
    } catch (error: any) {
      console.error('执行工作流失败:', error);
      return {
        success: false,
        error: error.message,
        logs: []
      };
    } finally {
      await this.cleanup();
    }
  }

  private async launchBrowser(): Promise<void> {
    // 检测Chrome路径
    const chromePath = this.detectChromePath();
    
    // 用户数据目录
    const userDataDir = process.env.CHROME_USER_DATA || path.join(process.cwd(), 'chrome-data');

    // 启动配置
    const launchOptions: any = {
      headless: process.env.HEADLESS === 'true',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    if (chromePath) {
      launchOptions.executablePath = chromePath;
    } else {
      launchOptions.channel = 'chrome';
    }

    // 使用持久化上下文
    const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    
    // 获取或创建页面
    const pages = context.pages();
    this.page = pages.length > 0 ? pages[0] : await context.newPage();

    // 反自动化检测
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      (navigator as any).chrome = {
        runtime: {}
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      });
    });

    // 设置User-Agent
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
  }

  private detectChromePath(): string | null {
    const possiblePaths = [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];

    for (const chromePath of possiblePaths) {
      if (chromePath && fs.existsSync(chromePath)) {
        console.log('找到Chrome:', chromePath);
        return chromePath;
      }
    }

    console.log('未找到Chrome路径，使用默认channel');
    return null;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('清理资源失败:', error);
    }
  }

  async stop(): Promise<void> {
    await this.cleanup();
  }
}
