import { BlockCompiler } from '../BlockCompiler';

// 测试 1: 循环变量在日志中的显示
console.log('=== 测试 1: 循环变量在日志中的显示 ===\n');

const compiler = new BlockCompiler();

const blocks = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: 3,
      variableName: 'index'
    }
  },
  {
    id: 'click-1',
    type: 'click',
    label: '点击元素',
    category: 'interaction',
    position: { x: 300, y: 100 },
    data: {
      selector: 'div:nth-child({{index}})',
      waitForElement: true,
      timeout: 5000
    }
  }
];

const connections = [
  {
    id: 'conn-1',
    source: 'loop-1',
    sourceHandle: 'loop-start',
    target: 'click-1',
    targetHandle: 'target-left'
  },
  {
    id: 'conn-2',
    source: 'click-1',
    sourceHandle: 'source-right',
    target: 'loop-1',
    targetHandle: 'loop-end'
  }
];

const code1 = compiler.compile(blocks, connections);

console.log('生成的代码片段：');
console.log('---');
// 提取循环部分
const loopMatch = code1.match(/for \(let __loopIndex[\s\S]*?log\('循环完成'\);/);
if (loopMatch) {
  console.log(loopMatch[0]);
}
console.log('---\n');

// 检查是否使用了模板字符串
if (code1.includes('log(`等待并点击元素: div:nth-child(${index})`);')) {
  console.log('✅ 通过：日志使用模板字符串，变量会在运行时求值');
} else if (code1.includes("log('等待并点击元素: div:nth-child(${index})');")) {
  console.log('❌ 失败：日志使用普通字符串，变量不会被求值');
} else {
  console.log('❌ 失败：未找到预期的日志语句');
}

console.log('\n=== 测试 2: 全局变量在循环次数中的使用 ===\n');

const blocks2 = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: '{{loopCount}}',
      variableName: 'index'
    }
  },
  {
    id: 'log-1',
    type: 'log',
    label: '日志',
    category: 'browser',
    position: { x: 300, y: 100 },
    data: {
      message: '循环中'
    }
  }
];

const connections2 = [
  {
    id: 'conn-1',
    source: 'loop-1',
    sourceHandle: 'loop-start',
    target: 'log-1',
    targetHandle: 'target-left'
  },
  {
    id: 'conn-2',
    source: 'log-1',
    sourceHandle: 'source-right',
    target: 'loop-1',
    targetHandle: 'loop-end'
  }
];

const variables = {
  loopCount: { value: '5', description: '循环次数' }
};

const code2 = compiler.compile(blocks2, connections2, variables);

console.log('生成的代码片段：');
console.log('---');
// 查找包含 "开始循环" 的行
const lines = code2.split('\n');
const startIndex = lines.findIndex(line => line.includes('开始循环'));
if (startIndex >= 0) {
  console.log(lines.slice(startIndex, Math.min(startIndex + 3, lines.length)).join('\n'));
} else {
  console.log('未找到循环代码');
}
console.log('---\n');

// 检查是否使用了全局变量的值
if (code2.includes("log('开始循环，共 5 次');") && code2.includes('for (let __loopIndex = 0; __loopIndex < 5;')) {
  console.log('✅ 通过：循环次数使用了全局变量的值');
} else {
  console.log('❌ 失败：循环次数没有使用全局变量的值');
}

console.log('\n=== 测试 3: 完整工作流（循环变量 + 全局变量）===\n');

const blocks3 = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: '{{maxItems}}',
      variableName: 'index'
    }
  },
  {
    id: 'click-1',
    type: 'click',
    label: '点击元素',
    category: 'interaction',
    position: { x: 300, y: 100 },
    data: {
      selector: 'div.item:nth-child({{index}})',
      waitForElement: true,
      timeout: 5000
    }
  },
  {
    id: 'log-1',
    type: 'log',
    label: '日志输出',
    category: 'browser',
    position: { x: 500, y: 100 },
    data: {
      message: '当前处理第 {{index}} 个元素'
    }
  }
];

const connections3 = [
  {
    id: 'conn-1',
    source: 'loop-1',
    sourceHandle: 'loop-start',
    target: 'click-1',
    targetHandle: 'target-left'
  },
  {
    id: 'conn-2',
    source: 'click-1',
    sourceHandle: 'source-right',
    target: 'log-1',
    targetHandle: 'target-left'
  },
  {
    id: 'conn-3',
    source: 'log-1',
    sourceHandle: 'source-right',
    target: 'loop-1',
    targetHandle: 'loop-end'
  }
];

const variables3 = {
  maxItems: { value: '3', description: '最大项目数' }
};

const code3 = compiler.compile(blocks3, connections3, variables3);

console.log('生成的代码片段：');
console.log('---');
// 查找包含 logUser 的行
const lines3 = code3.split('\n');
const logUserIndex = lines3.findIndex(line => line.includes('logUser'));
if (logUserIndex >= 0) {
  console.log(lines3.slice(Math.max(0, logUserIndex - 2), logUserIndex + 2).join('\n'));
}
console.log('---\n');

let allPassed = true;

// 检查循环次数
if (code3.includes("log('开始循环，共 3 次');") && code3.includes('for (let __loopIndex = 0; __loopIndex < 3;')) {
  console.log('✅ 通过：循环次数使用了全局变量的值 (3)');
} else {
  console.log('❌ 失败：循环次数没有使用全局变量的值');
  allPassed = false;
}

// 检查点击模块的日志
if (code3.includes('log(`等待并点击元素: div.item:nth-child(${index})`);')) {
  console.log('✅ 通过：点击模块的日志使用模板字符串');
} else {
  console.log('❌ 失败：点击模块的日志没有使用模板字符串');
  allPassed = false;
}

// 检查日志模块
if (code3.includes('logUser(`当前处理第 ${index} 个元素`);')) {
  console.log('✅ 通过：日志模块使用模板字符串');
} else {
  console.log('❌ 失败：日志模块没有使用模板字符串');
  allPassed = false;
}

// 检查循环变量声明
if (code3.includes('const index = __loopIndex + 1;')) {
  console.log('✅ 通过：循环变量正确声明');
} else {
  console.log('❌ 失败：循环变量声明不正确');
  allPassed = false;
}

console.log('\n=== 总结 ===');
if (allPassed) {
  console.log('✅ 所有测试通过！变量绑定修复成功。');
} else {
  console.log('❌ 部分测试失败，请检查代码。');
}
