export interface WorkflowCapabilitySpec {
  version: string;
  outputRules: {
    rootKeys: string[];
    normalSourceHandles: string[];
    normalTargetHandles: string[];
    loopSourceHandle: string;
    loopTargetHandle: string;
  };
  supportedBlockTypes: Record<string, {
    category: string;
    description: string;
    requiredData: string[];
    optionalData: string[];
    forbiddenData?: string[];
    notes?: string[];
  }>;
  unsupportedPatterns: string[];
}

export const WORKFLOW_CAPABILITY_SPEC: WorkflowCapabilitySpec = {
  version: 'workflow-capability.v1',
  outputRules: {
    rootKeys: ['blocks', 'connections', 'variables'],
    normalSourceHandles: ['out', 'source-right'],
    normalTargetHandles: ['in', 'target-left'],
    loopSourceHandle: 'loop-start',
    loopTargetHandle: 'loop-end'
  },
  supportedBlockTypes: {
    navigate: {
      category: 'browser',
      description: '访问指定 URL。',
      requiredData: ['url'],
      optionalData: ['waitUntil', 'timeout'],
      notes: ['url 必须是非空字符串，允许使用 {{variableName}} 引用变量。', 'waitUntil 仅允许 load、domcontentloaded、networkidle。']
    },
    back: {
      category: 'browser',
      description: '返回上一页或关闭当前详情标签页返回上一个页面。',
      requiredData: [],
      optionalData: []
    },
    forward: {
      category: 'browser',
      description: '前进下一页。',
      requiredData: [],
      optionalData: []
    },
    click: {
      category: 'interaction',
      description: '点击指定元素。',
      requiredData: ['selector'],
      optionalData: ['waitForElement', 'timeout', 'openInNewTab', 'runInBackground', 'waitUntil'],
      notes: ['openInNewTab 仅表示根据 selector 对应链接打开新页。', 'runInBackground 只在已设计后台标签页链路时才可使用。']
    },
    type: {
      category: 'interaction',
      description: '在输入框中输入文本。',
      requiredData: ['selector', 'text'],
      optionalData: ['delay', 'timeout']
    },
    select: {
      category: 'interaction',
      description: '在下拉框中选择值。',
      requiredData: ['selector', 'value'],
      optionalData: ['timeout']
    },
    scroll: {
      category: 'browser',
      description: '滚动页面或指定容器。',
      requiredData: [],
      optionalData: ['target', 'selector', 'timeout', 'mode', 'maxScrolls', 'scrollDistance', 'delay'],
      notes: ['target 仅允许 page 或 element。', '当 target=element 时 selector 必填。', 'mode 仅允许 smart 或 fixed。']
    },
    wait: {
      category: 'browser',
      description: '等待指定毫秒数。',
      requiredData: ['duration'],
      optionalData: []
    },
    extract: {
      category: 'extraction',
      description: '提取页面数据。',
      requiredData: ['extractions'],
      optionalData: ['multiple', 'timeout', 'saveToTable', 'mergeKey', 'selector', 'attribute', 'customAttribute', 'saveToColumn'],
      notes: [
        '推荐使用 data.extractions 数组。',
        'data.extractions[*] 支持 selector、attribute、customAttribute、saveToColumn。',
        'attribute 支持 text、innerText、html、innerHTML、backgroundImage、href、src、value、data-* 或任意 DOM attribute。'
      ]
    },
    'extract-links': {
      category: 'extraction',
      description: '提取当前页面所有 a[href] 链接，可选按 filterPattern 过滤。',
      requiredData: [],
      optionalData: ['filterPattern'],
      forbiddenData: ['selector', 'attribute', 'source', 'variable', 'arraySource'],
      notes: ['当前引擎不会根据 selector 提取链接，永远提取页面全部 a[href]。']
    },
    condition: {
      category: 'logic',
      description: '根据变量或元素值走不同分支。',
      requiredData: ['branches'],
      optionalData: ['fallbackEnabled'],
      notes: ['branches[*] 需要包含 id、name、matchType、rules。', 'rules[*].sourceType 仅允许 variable 或 element。']
    },
    loop: {
      category: 'logic',
      description: '执行次数循环或条件循环。',
      requiredData: ['mode'],
      optionalData: ['count', 'condition', 'maxIterations', 'variableName', 'useVariable', 'startValueType', 'startValue'],
      forbiddenData: ['source', 'variable', 'arraySource', 'items', 'list', 'collection'],
      notes: ['mode 仅允许 count 或 condition。', '当前引擎不支持数组遍历循环。']
    },
    log: {
      category: 'browser',
      description: '输出日志。',
      requiredData: ['message'],
      optionalData: []
    }
  },
  unsupportedPatterns: [
    '禁止生成 transform 或 filter block，这两个类型当前 AI 生成链路不支持。',
    '禁止假设 extract-links 的输出会自动写入 variables 或被 loop 遍历。',
    '禁止生成数组遍历 loop，例如 source/currentLink、arraySource/items/list 等结构。',
    '禁止生成空 navigate.url。',
    '禁止引用未定义变量。',
    '禁止输出 capability spec 未列出的 data 字段。'
  ]
};

export function createWorkflowCapabilityPrompt(): string {
  return [
    '下面是当前工作流引擎唯一可信的能力规范。你必须严格遵守，不能猜测不存在的能力。',
    JSON.stringify(WORKFLOW_CAPABILITY_SPEC, null, 2)
  ].join('\n');
}
