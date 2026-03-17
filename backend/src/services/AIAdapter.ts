import axios from 'axios';

export interface AIModelAdapter {
  id: string;
  name: string;
  formatRequest(prompt: string, options?: any): any;
  parseResponse(response: any): string;
  getApiEndpoint(): string;
  getApiKey(): string;
}

export class QwenAdapter implements AIModelAdapter {
  id = 'qwen';
  name = '阿里千问';

  formatRequest(prompt: string, options: any = {}) {
    return {
      model: options.model || 'qwen-turbo',
      input: {
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        result_format: 'message'
      }
    };
  }

  parseResponse(response: any): string {
    return response.output.choices[0].message.content;
  }

  getApiEndpoint(): string {
    return process.env.QWEN_API_ENDPOINT || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  }

  getApiKey(): string {
    return process.env.QWEN_API_KEY || '';
  }

  private getSystemPrompt(): string {
    return `你是一个Playwright脚本生成专家。请根据用户的需求生成可执行的Playwright代码。

要求：
1. 只返回JavaScript代码，不要有任何解释文字
2. 代码中可以使用 page 对象（已提供）
3. 使用 log() 函数输出执行日志
4. 最后使用 return 返回爬取的数据对象
5. 处理可能的异常情况
6. 使用 async/await 语法

重要提示：
- 访问页面时使用 { waitUntil: 'domcontentloaded', timeout: 60000 } 加快加载
- 如果需要爬取图片、商品列表等内容，必须先滚动页面触发懒加载
- 滚动15次，每次滚动一个视口高度，间隔800ms
- 收集图片时要检查 src、data-src、data-lazy-src 等多种属性
- 过滤掉无效图片（非http开头、包含data:image等）

示例1：爬取百度首页的标题
\`\`\`javascript
log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(\`获取到标题: \${title}\`);
return { title };
\`\`\`

示例2：爬取页面所有图片（包含懒加载）
\`\`\`javascript
log('访问页面');
await page.goto('https://www.taobao.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
log('等待页面初始加载');
await page.waitForTimeout(3000);
log('开始滚动页面触发懒加载');
await page.evaluate(async () => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const scrollStep = window.innerHeight;
  const maxScrolls = 15;
  for (let i = 0; i < maxScrolls; i++) {
    window.scrollBy(0, scrollStep);
    await delay(800);
  }
  window.scrollTo(0, document.body.scrollHeight);
  await delay(1500);
});
log('滚动完成，等待图片加载');
await page.waitForTimeout(3000);
log('收集页面所有图片');
const images = await page.evaluate(() => {
  const imgElements = document.querySelectorAll('img');
  const imageData = [];
  imgElements.forEach((img, index) => {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (src && src.startsWith('http') && !src.includes('data:image')) {
      imageData.push({
        index: index + 1,
        src: src,
        alt: img.alt || '',
        width: img.width,
        height: img.height
      });
    }
  });
  return imageData;
});
log(\`成功收集到 \${images.length} 张图片\`);
return { images: images, count: images.length };
\`\`\`

现在请根据用户需求生成代码，只返回代码部分，不要包含\`\`\`标记。`;
  }
}

export class SiliconFlowAdapter implements AIModelAdapter {
  id = 'siliconflow';
  name = '硅基流动';

  formatRequest(prompt: string, options: any = {}) {
    const model = options.model || 'Qwen/Qwen2.5-7B-Instruct';
    
    return {
      model: model,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      stream: false
    };
  }

  parseResponse(response: any): string {
    return response.choices[0].message.content;
  }

  getApiEndpoint(): string {
    return process.env.SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions';
  }

  getApiKey(): string {
    return process.env.SILICONFLOW_API_KEY || '';
  }

  private getSystemPrompt(): string {
    return `你是一个Playwright脚本生成专家。请根据用户的需求生成可执行的Playwright代码。

要求：
1. 只返回JavaScript代码，不要有任何解释文字
2. 代码中可以使用 page 对象（已提供）
3. 使用 log() 函数输出执行日志
4. 最后使用 return 返回爬取的数据对象
5. 处理可能的异常情况
6. 使用 async/await 语法

重要提示：
- 访问页面时使用 { waitUntil: 'domcontentloaded', timeout: 60000 } 加快加载
- 如果需要爬取图片、商品列表等内容，必须先滚动页面触发懒加载
- 滚动15次，每次滚动一个视口高度，间隔800ms
- 收集图片时要检查 src、data-src、data-lazy-src 等多种属性
- 过滤掉无效图片（非http开头、包含data:image等）

示例1：爬取百度首页的标题
\`\`\`javascript
log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(\`获取到标题: \${title}\`);
return { title };
\`\`\`

示例2：爬取页面所有图片（包含懒加载）
\`\`\`javascript
log('访问页面');
await page.goto('https://www.taobao.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
log('等待页面初始加载');
await page.waitForTimeout(3000);
log('开始滚动页面触发懒加载');
await page.evaluate(async () => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const scrollStep = window.innerHeight;
  const maxScrolls = 15;
  for (let i = 0; i < maxScrolls; i++) {
    window.scrollBy(0, scrollStep);
    await delay(800);
  }
  window.scrollTo(0, document.body.scrollHeight);
  await delay(1500);
});
log('滚动完成，等待图片加载');
await page.waitForTimeout(3000);
log('收集页面所有图片');
const images = await page.evaluate(() => {
  const imgElements = document.querySelectorAll('img');
  const imageData = [];
  imgElements.forEach((img, index) => {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (src && src.startsWith('http') && !src.includes('data:image')) {
      imageData.push({
        index: index + 1,
        src: src,
        alt: img.alt || '',
        width: img.width,
        height: img.height
      });
    }
  });
  return imageData;
});
log(\`成功收集到 \${images.length} 张图片\`);
return { images: images, count: images.length };
\`\`\`

现在请根据用户需求生成代码，只返回代码部分，不要包含\`\`\`标记。`;
  }
}

export class AIAdapterManager {
  private adapters: Map<string, AIModelAdapter> = new Map();

  constructor() {
    this.register(new QwenAdapter());
    this.register(new SiliconFlowAdapter());
  }

  register(adapter: AIModelAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id: string): AIModelAdapter | undefined {
    return this.adapters.get(id);
  }

  getAllAdapters(): AIModelAdapter[] {
    return Array.from(this.adapters.values());
  }

  async generateScript(modelId: string, prompt: string, options?: any): Promise<string> {
    const adapter = this.getAdapter(modelId);
    if (!adapter) {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    const apiKey = adapter.getApiKey();
    if (!apiKey) {
      throw new Error(`${adapter.name} API密钥未配置`);
    }

    const requestData = adapter.formatRequest(prompt, options);
    const endpoint = adapter.getApiEndpoint();

    try {
      const response = await axios.post(endpoint, requestData, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const code = adapter.parseResponse(response.data);
      
      // 清理代码块标记
      let cleanCode = code.trim();
      if (cleanCode.startsWith('```javascript')) {
        cleanCode = cleanCode.replace(/^```javascript\n/, '').replace(/\n```$/, '');
      } else if (cleanCode.startsWith('```')) {
        cleanCode = cleanCode.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      return cleanCode;
    } catch (error: any) {
      console.error('AI API调用失败:', error.response?.data || error.message);
      throw new Error(`AI生成失败: ${error.response?.data?.message || error.message}`);
    }
  }
}
