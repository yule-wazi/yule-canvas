import axios from 'axios';
import { RecordingInputEvent, RecordingSemanticBuilder, RecordingSemanticPackage } from './RecordingSemanticBuilder';
import { createWorkflowCapabilityPromptCompact } from './WorkflowCapabilityPromptCompact';
import { WorkflowGenerationHarnessBuilder } from './WorkflowGenerationHarness';
import { WorkflowNormalizer } from './WorkflowNormalizer';
import { WorkflowSemanticValidator } from './WorkflowSemanticValidator';
import { WorkflowValidator } from './WorkflowValidator';

export interface AIModelAdapter {
  id: string;
  name: string;
  formatChatRequest(systemPrompt: string, userPrompt: string, options?: Record<string, any>): any;
  parseResponse(response: any): string;
  getApiEndpoint(): string;
  getApiKey(options?: Record<string, any>): string;
  getHeaders?(options?: Record<string, any>): Record<string, string>;
}

export class WorkflowGenerationError extends Error {
  stage: 'parse' | 'shape-validation' | 'semantic-validation' | 'provider';
  errors: string[];
  warnings: string[];
  statusCode: number;
  rawPreview?: string;

  constructor(params: {
    message: string;
    stage: 'parse' | 'shape-validation' | 'semantic-validation' | 'provider';
    errors?: string[];
    warnings?: string[];
    statusCode?: number;
    rawPreview?: string;
  }) {
    super(params.message);
    this.name = 'WorkflowGenerationError';
    this.stage = params.stage;
    this.errors = params.errors || [];
    this.warnings = params.warnings || [];
    this.statusCode = params.statusCode || 422;
    this.rawPreview = params.rawPreview;
  }
}

const WORKFLOW_JSON_SYSTEM_PROMPT = `你是一个网页采集工作流生成助手。

你的唯一任务是根据输入生成合法的 Workflow JSON。

输出要求：
1. 只能输出 JSON，不要输出解释、Markdown、代码块。
2. 顶层对象必须包含 blocks、connections、variables。
3. 所有 block.id 和 connection.id 必须唯一。
4. blocks 需要从左到右布局，position.x 递增，position.y 合理分层。
5. 如果用户录制里出现字段标注，优先把它们转成 extract 节点中的 data.extractions。
6. 如果存在列表页 -> 详情页链路，要尽量生成可复现、可批量执行的工作流，而不是只复现一次手动操作。

可用 block.type：
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
- condition

连接规则：
- 普通流程：sourceHandle 使用 out 或 source-right；targetHandle 使用 in 或 target-left
- 循环开始：sourceHandle 使用 loop-start
- 循环结束：targetHandle 使用 loop-end

额外约束：
- 不要臆造输入中没有证据支持的复杂逻辑。
- 如果录制里已经标注字段，说明目标页面和采集字段优先级最高。
- 如果录制中存在新标签页/详情页跳转，应优先保留该链路。
- selector 应尽量使用输入里已经出现的 selector，不要随意改写。

${createWorkflowCapabilityPromptCompact()}`;

const RECORDING_TO_WORKFLOW_SYSTEM_PROMPT = `${WORKFLOW_JSON_SYSTEM_PROMPT}

当前输入不是自然语言需求，而是“语义化录制包”。
你需要从录制包里推断用户的真实采集意图，并生成最合理的 Workflow JSON。

推断原则：
1. 优先识别目标页面、字段标注、导航链路。
2. 试探性滚动、重复点击、无后续结果的动作可以忽略或降权。
3. 如果录制明显是在“列表页打开详情页并采字段”，优先生成可批量遍历的流程。
4. 如果信息不足，不要捏造复杂逻辑，保持最小可执行工作流。`;

function buildPromptSemanticRecording(recording: RecordingSemanticPackage) {
  return {
    schemaVersion: recording.schemaVersion,
    recorder: recording.recorder,
    summary: recording.summary,
    pages: recording.pages.map(page => ({
      pageId: page.pageId,
      pageIndex: page.pageIndex,
      latestUrl: page.latestUrl,
      latestTitle: page.latestTitle,
      urls: page.urls,
      openedFrom: page.openedFrom,
      markedFields: page.markedFields
    })),
    navigationChains: recording.navigationChains,
    semanticSteps: recording.semanticSteps.map(step => ({
      step: step.step,
      kind: step.kind,
      action: step.action,
      signal: step.signal,
      pageId: step.pageId,
      page: step.page,
      target: {
        selector: step.target?.selector || '',
        href: step.target?.href || '',
        text: step.target?.text || '',
        tagName: step.target?.tagName || ''
      },
      field: step.field,
      opener: step.opener
    }))
  };
}

function buildPromptHarness(harness: ReturnType<typeof WorkflowGenerationHarnessBuilder.build>) {
  return {
    version: harness.version,
    observedUrls: harness.observedUrls,
    clickedSelectors: harness.clickedSelectors,
    clickedHrefTargets: harness.clickedHrefTargets,
    markedFields: harness.markedFields,
    allowedBlockTypes: harness.allowedBlockTypes,
    forbiddenBlockTypes: harness.forbiddenBlockTypes
  };
}

function sanitizeJsonResponse(content: string): string {
  let cleanJson = String(content || '').trim();

  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  return cleanJson.trim();
}

function parseWorkflowJson(content: string): any {
  const cleanJson = sanitizeJsonResponse(content);
  try {
    return JSON.parse(cleanJson);
  } catch (parseError: any) {
    console.error('AI 返回的原始内容解析失败:', cleanJson);
    throw new WorkflowGenerationError({
      message: `AI 返回的 JSON 格式无效: ${parseError.message}`,
      stage: 'parse',
      errors: ['模型返回了非 JSON 内容，或在 JSON 前混入了解释文本/思考内容。'],
      rawPreview: cleanJson.slice(0, 1200)
    });
  }
}

function parseToolWorkflowArguments(response: any): any {
  const toolCalls = response?.choices?.[0]?.message?.tool_calls;
  const firstToolCall = Array.isArray(toolCalls) ? toolCalls[0] : null;
  const argumentsText = firstToolCall?.function?.arguments;

  if (!argumentsText) {
    throw new WorkflowGenerationError({
      message: '模型未返回工具调用参数',
      stage: 'parse',
      errors: ['OpenRouter 返回了响应，但没有 tool_calls.arguments。']
    });
  }

  try {
    return JSON.parse(argumentsText);
  } catch (error: any) {
    console.error('工具调用参数解析失败:', argumentsText);
    throw new WorkflowGenerationError({
      message: `工具调用参数不是合法 JSON: ${error.message}`,
      stage: 'parse',
      errors: ['工具调用返回的 arguments 不是合法 JSON。'],
      rawPreview: String(argumentsText).slice(0, 1200)
    });
  }
}

function parseOpenRouterWorkflowResponse(response: any): any {
  const toolCalls = response?.choices?.[0]?.message?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return parseToolWorkflowArguments(response);
  }

  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) {
    return parseWorkflowJson(content);
  }

  throw new WorkflowGenerationError({
    message: '模型既没有返回工具调用，也没有返回可解析的 JSON 文本',
    stage: 'parse',
    errors: ['模型响应中既没有 tool_calls，也没有 message.content。']
  });
}

function buildWorkflowToolSchema() {
  return [
    {
      type: 'function',
      function: {
        name: 'return_workflow_json',
        description: '返回最终可执行的 Workflow JSON',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['blocks', 'connections', 'variables'],
          properties: {
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
                required: ['id', 'type', 'label', 'category', 'position', 'data', 'inputs', 'outputs'],
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  label: { type: 'string' },
                  category: { type: 'string' },
                  position: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['x', 'y'],
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' }
                    }
                  },
                  data: { type: 'object', additionalProperties: true },
                  inputs: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  outputs: { type: 'array', items: { type: 'object', additionalProperties: true } }
                }
              }
            },
            connections: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'source', 'sourceHandle', 'target', 'targetHandle'],
                properties: {
                  id: { type: 'string' },
                  source: { type: 'string' },
                  sourceHandle: { type: 'string' },
                  target: { type: 'string' },
                  targetHandle: { type: 'string' }
                }
              }
            },
            variables: {
              type: 'object',
              additionalProperties: true
            }
          }
        }
      }
    }
  ];
}

export class QwenAdapter implements AIModelAdapter {
  id = 'qwen';
  name = '阿里千问';

  formatChatRequest(systemPrompt: string, userPrompt: string, options: Record<string, any> = {}) {
    return {
      model: options.model || 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      parameters: {
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4000,
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

  getApiKey(options: Record<string, any> = {}): string {
    return options.apiKey || process.env.QWEN_API_KEY || '';
  }
}

export class SiliconFlowAdapter implements AIModelAdapter {
  id = 'siliconflow';
  name = '硅基流动';

  formatChatRequest(systemPrompt: string, userPrompt: string, options: Record<string, any> = {}) {
    return {
      model: options.model || 'Qwen/Qwen2.5-7B-Instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4000,
      stream: false
    };
  }

  parseResponse(response: any): string {
    return response.choices[0].message.content;
  }

  getApiEndpoint(): string {
    return process.env.SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions';
  }

  getApiKey(options: Record<string, any> = {}): string {
    return options.apiKey || process.env.SILICONFLOW_API_KEY || '';
  }
}

export class OpenRouterAdapter implements AIModelAdapter {
  id = 'openrouter';
  name = 'OpenRouter';

  formatChatRequest(systemPrompt: string, userPrompt: string, options: Record<string, any> = {}) {
    const request: Record<string, any> = {
      model: options.model || 'openai/gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4000
    };

    if (options.useTools) {
      request.tools = buildWorkflowToolSchema();
      request.tool_choice = options.toolChoice || 'auto';
    }

    return request;
  }

  parseResponse(response: any): string {
    return response.choices[0].message.content;
  }

  getApiEndpoint(): string {
    return process.env.OPENROUTER_API_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
  }

  getApiKey(options: Record<string, any> = {}): string {
    return options.apiKey || process.env.OPENROUTER_API_KEY || '';
  }

  getHeaders(options: Record<string, any> = {}): Record<string, string> {
    const headers: Record<string, string> = {};
    const referer = options.httpReferer || process.env.OPENROUTER_HTTP_REFERER;
    const title = options.appTitle || process.env.OPENROUTER_APP_TITLE;

    if (referer) {
      headers['HTTP-Referer'] = String(referer);
    }

    if (title) {
      headers['X-Title'] = String(title);
    }

    return headers;
  }
}

export class AIAdapterManager {
  private adapters: Map<string, AIModelAdapter> = new Map();

  constructor() {
    this.register(new QwenAdapter());
    this.register(new SiliconFlowAdapter());
    this.register(new OpenRouterAdapter());
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

  buildSemanticRecording(payload: { events?: RecordingInputEvent[]; mode?: string; status?: string; recorder?: { mode?: string; status?: string } } | RecordingInputEvent[]): RecordingSemanticPackage {
    return RecordingSemanticBuilder.build(payload);
  }

  async generateWorkflow(modelId: string, prompt: string, options: Record<string, any> = {}): Promise<any> {
    return this.generateWorkflowFromMessages(modelId, WORKFLOW_JSON_SYSTEM_PROMPT, prompt, options);
  }

  async generateWorkflowFromRecording(
    modelId: string,
    payload: { events?: RecordingInputEvent[]; mode?: string; status?: string; recorder?: { mode?: string; status?: string } } | RecordingInputEvent[],
    options: Record<string, any> = {}
  ): Promise<{ workflow: any; semanticRecording: RecordingSemanticPackage }> {
    const semanticRecording = this.buildSemanticRecording(payload);
    const harness = WorkflowGenerationHarnessBuilder.build(semanticRecording);
    const promptRecording = buildPromptSemanticRecording(semanticRecording);
    const promptHarness = buildPromptHarness(harness);
    const taskHint = options.taskHint
      ? `\n补充业务提示：${String(options.taskHint).trim()}`
      : '';
    const prompt = `请根据下面的语义化录制包，生成一个最合理的 Workflow JSON。${taskHint}

注意：
- 重点关注 markedFields、navigationChains、semanticSteps 中 signal=high 的步骤。
- 尽量输出能批量复用的采集工作流，而不是只回放一次用户动作。
- 如果用户明显是在列表页进入详情页采集字段，优先考虑 loop + click/navigate + extract 的结构。
- 但你绝不能生成超出 harness 允许范围的结构，尤其不能虚构 URL、selector、字段名或循环能力。

语义化录制包如下：
${JSON.stringify(promptRecording, null, 2)}

生成约束 harness 如下：
${JSON.stringify(promptHarness, null, 2)}`;

    const workflow = await this.generateWorkflowFromMessages(
      modelId,
      RECORDING_TO_WORKFLOW_SYSTEM_PROMPT,
      prompt,
      {
        ...options,
        maxTokens: options.maxTokens ?? 2200,
        harness
      }
    );

    return {
      workflow,
      semanticRecording
    };
  }

  private async generateWorkflowFromMessages(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    const adapter = this.getAdapter(modelId);
    if (!adapter) {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    const apiKey = adapter.getApiKey(options);
    if (!apiKey) {
      throw new Error(`${adapter.name} API 密钥未配置`);
    }

    const requestData = adapter.formatChatRequest(systemPrompt, userPrompt, options);
    const endpoint = adapter.getApiEndpoint();

    try {
      const response = await axios.post(endpoint, requestData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(adapter.getHeaders?.(options) || {})
        },
        timeout: options.timeoutMs ?? 120000
      });

      const workflowDraft =
        adapter.id === 'openrouter' && options.useTools
          ? parseOpenRouterWorkflowResponse(response.data)
          : parseWorkflowJson(adapter.parseResponse(response.data));
      const workflow = WorkflowNormalizer.normalize(workflowDraft);

      const validation = WorkflowValidator.validate(workflow);
      if (!validation.valid) {
        throw new WorkflowGenerationError({
          message: `生成的工作流格式无效: ${validation.errors.join(', ')}`,
          stage: 'shape-validation',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      const semanticValidation = WorkflowSemanticValidator.validate(workflow, options.harness);
      if (!semanticValidation.valid) {
        throw new WorkflowGenerationError({
          message: `生成的工作流不符合当前引擎能力约束: ${semanticValidation.errors.join(', ')}`,
          stage: 'semantic-validation',
          errors: semanticValidation.errors,
          warnings: semanticValidation.warnings
        });
      }

      if (validation.warnings.length > 0) {
        console.warn('Workflow validation warnings:', validation.warnings);
      }

      if (semanticValidation.warnings.length > 0) {
        console.warn('Workflow semantic validation warnings:', semanticValidation.warnings);
      }

      return workflow;
    } catch (error: any) {
      if (error instanceof WorkflowGenerationError) {
        throw error;
      }
      if (error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''))) {
        throw new WorkflowGenerationError({
          message: 'AI 生成失败: 模型提供方响应超时',
          stage: 'provider',
          statusCode: 504,
          errors: ['模型提供方在限定时间内没有返回结果，后端已主动结束此次请求。']
        });
      }
      console.error('AI API 调用失败:', error.response?.data || error.message);
      throw new WorkflowGenerationError({
        message: `AI 生成失败: ${error.response?.data?.error?.message || error.response?.data?.message || error.message}`,
        stage: 'provider',
        statusCode: 502
      });
    }
  }
}
