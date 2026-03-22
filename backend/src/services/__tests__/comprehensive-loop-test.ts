import { BlockCompiler } from '../BlockCompiler';
import { ScriptParser } from '../ScriptParser';

console.log('=== 综合循环测试：生成 → 解析 → 验证 ===\n');

const compiler = new BlockCompiler();
const parser = new ScriptParser();

let passedTests = 0;
let totalTests = 0;

function runTest(testName: string, blocks: any[], connections: any[], variables: any = {}) {
  totalTests++;
  console.log(`\n测试 ${totalTests}: ${testName}`);
  console.log('---');
  
  try {
    // 1. 生成代码
    const generatedCode = compiler.compile(blocks, connections, variables);
    console.log('✓ 代码生成成功');
    
    // 2. 解析代码
    const parsed = parser.parse(generatedCode);
    console.log('✓ 代码解析成功');
    
    // 3. 验证结果
    const loopBlock = parsed.blocks.find((b: any) => b.type === 'loop');
    const originalLoop = blocks.find(b => b.type === 'loop');
    
    if (!loopBlock) {
      console.log('❌ 失败：未找到循环模块');
      return;
    }
    
    // 验证循环模式
    if (loopBlock.data.mode !== originalLoop.data.mode) {
      console.log(`❌ 失败：循环模式不匹配 (期望: ${originalLoop.data.mode}, 实际: ${loopBlock.data.mode})`);
      return;
    }
    
    // 验证循环次数
    if (originalLoop.data.mode === 'count' && loopBlock.data.count !== originalLoop.data.count) {
      console.log(`❌ 失败：循环次数不匹配 (期望: ${originalLoop.data.count}, 实际: ${loopBlock.data.count})`);
      return;
    }
    
    // 验证变量名
    if (loopBlock.data.variableName !== (originalLoop.data.variableName || '')) {
      console.log(`❌ 失败：变量名不匹配 (期望: "${originalLoop.data.variableName || ''}", 实际: "${loopBlock.data.variableName}")`);
      return;
    }
    
    // 验证 useVariable
    if (loopBlock.data.useVariable !== (originalLoop.data.useVariable || false)) {
      console.log(`❌ 失败：useVariable不匹配 (期望: ${originalLoop.data.useVariable}, 实际: ${loopBlock.data.useVariable})`);
      return;
    }
    
    console.log('✅ 通过：所有验证成功');
    passedTests++;
    
  } catch (error: any) {
    console.log(`❌ 失败：${error.message}`);
  }
}

// 测试 1: 不使用循环变量
runTest(
  '不使用循环变量',
  [
    {
      id: 'loop-1',
      type: 'loop',
      data: {
        mode: 'count',
        count: 10,
        useVariable: false,
        variableName: '',
        maxIterations: 1000
      }
    },
    {
      id: 'click-1',
      type: 'click',
      data: {
        selector: '#app > div',
        waitForElement: true,
        timeout: 5000
      }
    }
  ],
  [
    { id: 'c1', source: 'loop-1', sourceHandle: 'loop-start', target: 'click-1', targetHandle: 'target-left' },
    { id: 'c2', source: 'click-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'loop-end' }
  ]
);

// 测试 2: 使用循环变量，从全局变量获取起始值
runTest(
  '使用循环变量，从全局变量获取起始值',
  [
    {
      id: 'loop-1',
      type: 'loop',
      data: {
        mode: 'count',
        count: 5,
        useVariable: true,
        variableName: 'num',
        startValueType: 'variable',
        startValue: '{{num}}',
        maxIterations: 1000
      }
    },
    {
      id: 'click-1',
      type: 'click',
      data: {
        selector: 'div:nth-child({{num}})',
        waitForElement: true,
        timeout: 5000
      }
    }
  ],
  [
    { id: 'c1', source: 'loop-1', sourceHandle: 'loop-start', target: 'click-1', targetHandle: 'target-left' },
    { id: 'c2', source: 'click-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'loop-end' }
  ],
  {
    num: { value: '3', description: '起始索引' }
  }
);

// 测试 3: 使用循环变量，从全局变量获取起始值（不同变量名）
runTest(
  '使用循环变量 index，从全局变量获取起始值',
  [
    {
      id: 'loop-1',
      type: 'loop',
      data: {
        mode: 'count',
        count: 8,
        useVariable: true,
        variableName: 'index',
        startValueType: 'variable',
        startValue: '{{index}}',
        maxIterations: 1000
      }
    },
    {
      id: 'click-1',
      type: 'click',
      data: {
        selector: '.item-{{index}}',
        waitForElement: true,
        timeout: 5000
      }
    }
  ],
  [
    { id: 'c1', source: 'loop-1', sourceHandle: 'loop-start', target: 'click-1', targetHandle: 'target-left' },
    { id: 'c2', source: 'click-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'loop-end' }
  ],
  {
    index: { value: '1', description: '起始索引' }
  }
);

// 测试 4: 条件循环，不使用变量
runTest(
  '条件循环，不使用变量',
  [
    {
      id: 'loop-1',
      type: 'loop',
      data: {
        mode: 'condition',
        condition: 'true',
        useVariable: false,
        variableName: '',
        maxIterations: 100
      }
    },
    {
      id: 'wait-1',
      type: 'wait',
      data: {
        duration: 1000
      }
    }
  ],
  [
    { id: 'c1', source: 'loop-1', sourceHandle: 'loop-start', target: 'wait-1', targetHandle: 'target-left' },
    { id: 'c2', source: 'wait-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'loop-end' }
  ]
);

// 测试 5: 条件循环，使用变量
runTest(
  '条件循环，使用变量',
  [
    {
      id: 'loop-1',
      type: 'loop',
      data: {
        mode: 'condition',
        condition: 'i < 10',
        useVariable: true,
        variableName: 'i',
        startValueType: 'variable',
        startValue: '{{i}}',
        maxIterations: 100
      }
    },
    {
      id: 'log-1',
      type: 'log',
      data: {
        message: '当前 i = {{i}}'
      }
    }
  ],
  [
    { id: 'c1', source: 'loop-1', sourceHandle: 'loop-start', target: 'log-1', targetHandle: 'target-left' },
    { id: 'c2', source: 'log-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'loop-end' }
  ],
  {
    i: { value: '0', description: '计数器' }
  }
);

// 测试 6: 复杂场景 - 循环前后有其他模块
runTest(
  '复杂场景：循环前后有其他模块',
  [
    {
      id: 'nav-1',
      type: 'navigate',
      data: {
        url: 'https://example.com',
        waitUntil: 'domcontentloaded',
        timeout: 60000
      }
    },
    {
      id: 'loop-1',
      type: 'loop',
      data: {
        mode: 'count',
        count: 3,
        useVariable: true,
        variableName: 'pageNum',
        startValueType: 'variable',
        startValue: '{{pageNum}}',
        maxIterations: 1000
      }
    },
    {
      id: 'click-1',
      type: 'click',
      data: {
        selector: 'a[data-page="{{pageNum}}"]',
        waitForElement: true,
        timeout: 5000
      }
    },
    {
      id: 'wait-1',
      type: 'wait',
      data: {
        duration: 2000
      }
    }
  ],
  [
    { id: 'c0', source: 'nav-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'target-left' },
    { id: 'c1', source: 'loop-1', sourceHandle: 'loop-start', target: 'click-1', targetHandle: 'target-left' },
    { id: 'c2', source: 'click-1', sourceHandle: 'source-right', target: 'loop-1', targetHandle: 'loop-end' },
    { id: 'c3', source: 'loop-1', sourceHandle: 'source-right', target: 'wait-1', targetHandle: 'target-left' }
  ],
  {
    pageNum: { value: '1', description: '页码' }
  }
);

// 总结
console.log('\n\n=== 测试总结 ===');
console.log(`总测试数: ${totalTests}`);
console.log(`通过: ${passedTests}`);
console.log(`失败: ${totalTests - passedTests}`);
console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 所有测试通过！');
} else {
  console.log('\n⚠️  部分测试失败，请检查');
  process.exit(1);
}
