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

export interface ProviderRequestPreview {
  endpoint: string;
  headers: Record<string, string>;
  body: any;
  systemPrompt: string;
  userPrompt: string;
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

const WORKFLOW_JSON_SYSTEM_PROMPT = `You generate executable Workflow JSON only.
Output rules:
1. Output JSON only. No markdown, no code fences, no explanation.
2. Root keys must be blocks, connections, variables.
3. All block ids and connection ids must be unique.
4. Reuse selectors and URLs from the input evidence whenever possible.
5. If the recording contains marked fields, prefer converting them into extract.data.extractions.
${createWorkflowCapabilityPromptCompact()}`;

const RECORDING_TO_WORKFLOW_SYSTEM_PROMPT = `${WORKFLOW_JSON_SYSTEM_PROMPT}

The input is a semantic recording package, not a natural language request.
Infer the smallest executable workflow from the evidence.
Prefer marked fields, navigation chains, and high-signal steps.
Do not invent unsupported loop/dataflow behavior.
Do not invent URLs, selectors, or field names outside the evidence.`;

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

function buildRecordingWorkflowPrompt(
  semanticRecording: RecordingSemanticPackage,
  harness: ReturnType<typeof WorkflowGenerationHarnessBuilder.build>,
  options: Record<string, any> = {}
) {
  const promptRecording = buildPromptSemanticRecording(semanticRecording);
  const promptHarness = buildPromptHarness(harness);
  const taskHint = options.taskHint ? `\n补充业务提示：${String(options.taskHint).trim()}` : '';

  return {
    systemPrompt: RECORDING_TO_WORKFLOW_SYSTEM_PROMPT,
    userPrompt: `请根据下面的语义化录制包，生成最合理的 Workflow JSON。${taskHint}

注意：
- 重点关注 markedFields、navigationChains、semanticSteps 中 signal=high 的步骤。
- 在证据不足时，优先生成最小可执行 workflow。
- 绝不能虚构 URL、selector、字段名、变量流转或循环能力。

语义化录制包：
${JSON.stringify(promptRecording, null, 2)}

生成约束 harness：
${JSON.stringify(promptHarness, null, 2)}`
  };
}

function createProviderRequest(
  adapter: AIModelAdapter,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  options: Record<string, any> = {}
): ProviderRequestPreview {
  return {
    endpoint: adapter.getApiEndpoint(),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(adapter.getHeaders?.(options) || {})
    },
    body: adapter.formatChatRequest(systemPrompt, userPrompt, options),
    systemPrompt,
    userPrompt
  };
}

function sanitizeJsonResponse(content: string): string {
  let cleanJson = String(content || '').trim();

  cleanJson = cleanJson.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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
    console.error('AI raw content parse failed:', cleanJson);
    throw new WorkflowGenerationError({
      message: `AI 返回的 JSON 格式无效: ${parseError.message}`,
      stage: 'parse',
      errors: ['模型返回了非 JSON 内容，或在 JSON 前混入了解释文本。'],
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
    console.error('Tool call arguments parse failed:', argumentsText);
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
    const prompts = buildRecordingWorkflowPrompt(semanticRecording, harness, options);

    const workflow = await this.generateWorkflowFromMessages(
      modelId,
      prompts.systemPrompt,
      prompts.userPrompt,
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

  previewWorkflowFromRecordingRequest(
    modelId: string,
    payload: { events?: RecordingInputEvent[]; mode?: string; status?: string; recorder?: { mode?: string; status?: string } } | RecordingInputEvent[],
    options: Record<string, any> = {}
  ) {
    const semanticRecording = this.buildSemanticRecording(payload);
    const harness = WorkflowGenerationHarnessBuilder.build(semanticRecording);
    const prompts = buildRecordingWorkflowPrompt(semanticRecording, harness, options);
    const providerRequest = this.buildProviderRequest(modelId, prompts.systemPrompt, prompts.userPrompt, {
      ...options,
      maxTokens: options.maxTokens ?? 2200,
      harness
    });

    return {
      semanticRecording,
      harness,
      providerRequest
    };
  }

  private async generateWorkflowFromMessages(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    const providerRequest = this.buildProviderRequest(modelId, systemPrompt, userPrompt, options);
    const adapter = this.getAdapter(modelId);

    if (!adapter) {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    try {
      const response = await axios.post(providerRequest.endpoint, providerRequest.body, {
        headers: providerRequest.headers,
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

      console.error('AI API call failed:', error.response?.data || error.message);
      throw new WorkflowGenerationError({
        message: `AI 生成失败: ${error.response?.data?.error?.message || error.response?.data?.message || error.message}`,
        stage: 'provider',
        statusCode: 502
      });
    }
  }

  private buildProviderRequest(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    options: Record<string, any> = {}
  ): ProviderRequestPreview {
    const adapter = this.getAdapter(modelId);
    if (!adapter) {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    const apiKey = adapter.getApiKey(options);
    if (!apiKey) {
      throw new Error(`${adapter.name} API 密钥未配置`);
    }

    return createProviderRequest(adapter, apiKey, systemPrompt, userPrompt, options);
  }
}
