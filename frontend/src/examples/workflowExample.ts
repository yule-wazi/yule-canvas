// 工作流示例 - 淘宝图片抓取
export const taobaoWorkflowExample = {
  id: 'example-taobao-images',
  name: '淘宝图片抓取示例',
  description: '访问淘宝搜索页面，滚动加载，提取图片',
  blocks: [
    {
      id: 'block-1',
      type: 'navigate',
      label: '访问页面',
      category: 'browser',
      position: { x: 100, y: 100 },
      data: {
        url: 'https://www.taobao.com',
        waitUntil: 'domcontentloaded',
        timeout: 60000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    },
    {
      id: 'block-2',
      type: 'wait',
      label: '等待',
      category: 'browser',
      position: { x: 100, y: 200 },
      data: {
        duration: 3000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    },
    {
      id: 'block-3',
      type: 'scroll',
      label: '滚动页面',
      category: 'browser',
      position: { x: 100, y: 300 },
      data: {
        target: 'page',
        selector: '',
        timeout: 30000,
        mode: 'smart',
        maxScrolls: 10,
        delay: 800
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    },
    {
      id: 'block-4',
      type: 'extract-images',
      label: '提取图片',
      category: 'extraction',
      position: { x: 100, y: 400 },
      data: {
        filterInvalid: true,
        attributes: ['src', 'data-src']
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [
        { id: 'out', name: '输出', type: 'flow' },
        { id: 'data', name: '图片列表', type: 'data' }
      ]
    },
    {
      id: 'block-5',
      type: 'log',
      label: '日志输出',
      category: 'logic',
      position: { x: 100, y: 500 },
      data: {
        message: '图片提取完成'
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    }
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'block-1',
      sourceHandle: 'out',
      target: 'block-2',
      targetHandle: 'in',
      type: 'flow'
    },
    {
      id: 'conn-2',
      source: 'block-2',
      sourceHandle: 'out',
      target: 'block-3',
      targetHandle: 'in',
      type: 'flow'
    },
    {
      id: 'conn-3',
      source: 'block-3',
      sourceHandle: 'out',
      target: 'block-4',
      targetHandle: 'in',
      type: 'flow'
    },
    {
      id: 'conn-4',
      source: 'block-4',
      sourceHandle: 'out',
      target: 'block-5',
      targetHandle: 'in',
      type: 'flow'
    }
  ],
  variables: {},
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// 简单的日志测试工作流
export const simpleLogWorkflow = {
  id: 'example-simple-log',
  name: '简单日志测试',
  description: '测试基本的日志输出功能',
  blocks: [
    {
      id: 'block-1',
      type: 'navigate',
      label: '访问页面',
      category: 'browser',
      position: { x: 100, y: 100 },
      data: {
        url: 'https://www.baidu.com',
        waitUntil: 'domcontentloaded',
        timeout: 60000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    },
    {
      id: 'block-2',
      type: 'log',
      label: '日志输出',
      category: 'logic',
      position: { x: 100, y: 200 },
      data: {
        message: '页面加载完成'
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    }
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'block-1',
      sourceHandle: 'out',
      target: 'block-2',
      targetHandle: 'in',
      type: 'flow'
    }
  ],
  variables: {},
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// 循环示例工作流
export const loopWorkflowExample = {
  id: 'example-loop',
  name: '循环示例',
  description: '演示循环模块的使用 - 循环访问多个页面',
  blocks: [
    {
      id: 'block-loop',
      type: 'loop',
      label: '循环',
      category: 'logic',
      position: { x: 100, y: 200 },
      data: {
        mode: 'count',
        count: 3,
        condition: '',
        maxIterations: 1000
      },
      inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
      outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
    },
    {
      id: 'block-1',
      type: 'navigate',
      label: '访问页面',
      category: 'browser',
      position: { x: 350, y: 200 },
      data: {
        url: 'https://www.baidu.com',
        waitUntil: 'domcontentloaded',
        timeout: 60000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    },
    {
      id: 'block-2',
      type: 'wait',
      label: '等待',
      category: 'browser',
      position: { x: 600, y: 200 },
      data: {
        duration: 2000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    },
    {
      id: 'block-3',
      type: 'log',
      label: '日志输出',
      category: 'logic',
      position: { x: 850, y: 200 },
      data: {
        message: '完成一次循环'
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    }
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'block-loop',
      sourceHandle: 'loop-start',
      target: 'block-1',
      targetHandle: 'target-left',
      type: 'flow'
    },
    {
      id: 'conn-2',
      source: 'block-1',
      sourceHandle: 'source-right',
      target: 'block-2',
      targetHandle: 'target-left',
      type: 'flow'
    },
    {
      id: 'conn-3',
      source: 'block-2',
      sourceHandle: 'source-right',
      target: 'block-3',
      targetHandle: 'target-left',
      type: 'flow'
    },
    {
      id: 'conn-4',
      source: 'block-3',
      sourceHandle: 'source-right',
      target: 'block-loop',
      targetHandle: 'loop-end',
      type: 'flow'
    }
  ],
  variables: {},
  createdAt: Date.now(),
  updatedAt: Date.now()
};
