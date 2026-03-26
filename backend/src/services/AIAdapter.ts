import axios from 'axios';
import { WorkflowValidator } from './WorkflowValidator';

export interface AIModelAdapter {
  id: string;
  name: string;
  formatWorkflowRequest(prompt: string, options?: any): any;
  parseResponse(response: any): string;
  getApiEndpoint(): string;
  getApiKey(): string;
}

const WORKFLOW_JSON_SYSTEM_PROMPT = `你是一个 Playwright 自动化工作流生成助手。

用户会用自然语言描述他们想要自动化的任务，你需要生成一个 Workflow JSON 格式的工作流。

输出必须严格是 JSON，对象包含：
1. blocks
2. connections
3. variables

可用模块：
- navigate
- click
- type
- select
- scroll
- wait
- extract
- extract-links
- back
- forward
- log
- loop

连接规则：
- 普通流转：sourceHandle 使用 out 或 source-right，targetHandle 使用 in 或 target-left
- 循环开始：sourceHandle 使用 loop-start
- 循环结束：targetHandle 使用 loop-end

要求：
1. 只输出 JSON，不要输出解释
2. 所有 id 必须唯一
3. 模块从左到右布局
4. 如果涉及循环变量，使用 {{variableName}} 引用
5. extract 模块使用 data.extractions 数组
6. 如果要保存数据表，填写 saveToTable
`;

export class QwenAdapter implements AIModelAdapter {
  id = 'qwen';
  name = '阿里千问';

  formatWorkflowRequest(prompt: string, options: any = {}) {
    return {
      model: options.model || 'qwen-turbo',
      input: {
        messages: [
          {
            role: 'system',
            content: WORKFLOW_JSON_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
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
}

export class SiliconFlowAdapter implements AIModelAdapter {
  id = 'siliconflow';
  name = '硅基流动';

  formatWorkflowRequest(prompt: string, options: any = {}) {
    return {
      model: options.model || 'Qwen/Qwen2.5-7B-Instruct',
      messages: [
        {
          role: 'system',
          content: WORKFLOW_JSON_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4000,
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

  async generateWorkflow(modelId: string, prompt: string, options?: any): Promise<any> {
    const adapter = this.getAdapter(modelId);
    if (!adapter) {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    const apiKey = adapter.getApiKey();
    if (!apiKey) {
      throw new Error(`${adapter.name} API密钥未配置`);
    }

    const requestData = adapter.formatWorkflowRequest(prompt, options);
    const endpoint = adapter.getApiEndpoint();

    try {
      const response = await axios.post(endpoint, requestData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const content = adapter.parseResponse(response.data);
      let cleanJson = content.trim();

      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let workflow: any;
      try {
        workflow = JSON.parse(cleanJson);
      } catch (parseError: any) {
        console.error('JSON 解析失败:', cleanJson);
        throw new Error(`AI 返回的 JSON 格式无效: ${parseError.message}`);
      }

      const validation = WorkflowValidator.validate(workflow);
      if (!validation.valid) {
        throw new Error(`生成的工作流格式无效: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('Workflow validation warnings:', validation.warnings);
      }

      return workflow;
    } catch (error: any) {
      console.error('AI API 调用失败:', error.response?.data || error.message);
      throw new Error(`AI生成失败: ${error.response?.data?.message || error.message}`);
    }
  }
}
