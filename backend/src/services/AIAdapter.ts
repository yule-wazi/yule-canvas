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

示例：
用户需求：爬取百度首页的标题
生成代码：
\`\`\`javascript
log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(\`获取到标题: \${title}\`);
return { title };
\`\`\`

现在请根据用户需求生成代码，只返回代码部分，不要包含\`\`\`标记。`;
  }
}

export class SiliconFlowAdapter implements AIModelAdapter {
  id = 'siliconflow';
  name = '硅基流动';

  formatRequest(prompt: string, options: any = {}) {
    // 硅基流动常用的免费模型
    // Qwen/Qwen2.5-7B-Instruct - 通义千问 2.5
    // Qwen/Qwen3.5-27B - 通义千问 3.5
    // deepseek-ai/DeepSeek-V2.5 - DeepSeek
    // THUDM/glm-4-9b-chat - 智谱GLM
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

示例：
用户需求：爬取百度首页的标题
生成代码：
\`\`\`javascript
log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(\`获取到标题: \${title}\`);
return { title };
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
