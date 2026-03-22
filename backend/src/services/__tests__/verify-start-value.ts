import { BlockCompiler } from '../BlockCompiler';

console.log('=== 测试循环变量起始值功能 ===\n');

const compiler = new BlockCompiler();

// 测试 1: 使用全局变量作为起始值
console.log('测试 1: 使用全局变量作为起始值\n');

const blocks1 = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: 3,
      variableName: 'num',
      startValueType: 'variable',
      startValue: '{{index}}'
    }
  },
  {
    id: 'log-1',
    type: 'log',
    label: '日志',
    category: 'browser',
    position: { x: 300, y: 100 },
    data: {
      message: '当前 num = {{num}}'
    }
  }
];

const connections1 = [
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

const variables1 = {
  index: { value: '3', description: '起始索引' }
};

const code1 = compiler.compile(blocks1, connections1, variables1);

console.log('生成的代码片段：');
console.log('---');
const lines1 = code1.split('\n');
const loopStart1 = lines1.findIndex(line => line.includes('开始循环'));
if (loopStart1 >= 0) {
  console.log(lines1.slice(loopStart1, Math.min(loopStart1 + 6, lines1.length)).join('\n'));
}
console.log('---\n');

if (code1.includes('const num = __loopIndex + 3;')) {
  console.log('✅ 通过：循环变量从全局变量的值（3）开始');
} else {
  console.log('❌ 失败：循环变量没有使用全局变量的值');
  console.log('查找: const num = __loopIndex + 3;');
}

// 测试 2: 使用自定义数值作为起始值
console.log('\n测试 2: 使用自定义数值作为起始值\n');

const blocks2 = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: 3,
      variableName: 'num',
      startValueType: 'custom',
      startValue: 5
    }
  },
  {
    id: 'log-1',
    type: 'log',
    label: '日志',
    category: 'browser',
    position: { x: 300, y: 100 },
    data: {
      message: '当前 num = {{num}}'
    }
  }
];

const connections2 = connections1;

const code2 = compiler.compile(blocks2, connections2);

console.log('生成的代码片段：');
console.log('---');
const lines2 = code2.split('\n');
const loopStart2 = lines2.findIndex(line => line.includes('开始循环'));
if (loopStart2 >= 0) {
  console.log(lines2.slice(loopStart2, Math.min(loopStart2 + 6, lines2.length)).join('\n'));
}
console.log('---\n');

if (code2.includes('const num = __loopIndex + 5;')) {
  console.log('✅ 通过：循环变量从自定义值（5）开始');
} else {
  console.log('❌ 失败：循环变量没有使用自定义值');
}

// 测试 3: 不创建循环变量
console.log('\n测试 3: 不创建循环变量（变量名为空）\n');

const blocks3 = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: 3,
      variableName: '', // 空字符串
      startValueType: 'default',
      startValue: 1
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

const connections3 = connections1;

const code3 = compiler.compile(blocks3, connections3);

console.log('生成的代码片段：');
console.log('---');
const lines3 = code3.split('\n');
const loopStart3 = lines3.findIndex(line => line.includes('开始循环'));
if (loopStart3 >= 0) {
  console.log(lines3.slice(loopStart3, Math.min(loopStart3 + 6, lines3.length)).join('\n'));
}
console.log('---\n');

if (!code3.includes('const num') && !code3.includes('const i') && !code3.includes('const index')) {
  console.log('✅ 通过：没有创建循环变量');
} else {
  console.log('❌ 失败：不应该创建循环变量');
  console.log('代码中包含的 const 声明：');
  const constLines = lines3.filter(line => line.includes('const '));
  constLines.forEach(line => console.log('  ' + line.trim()));
}

// 测试 4: 默认行为（从1开始）
console.log('\n测试 4: 默认行为（从1开始）\n');

const blocks4 = [
  {
    id: 'loop-1',
    type: 'loop',
    label: '循环',
    category: 'logic',
    position: { x: 100, y: 100 },
    data: {
      mode: 'count',
      count: 3,
      variableName: 'i',
      startValueType: 'default',
      startValue: 1
    }
  },
  {
    id: 'log-1',
    type: 'log',
    label: '日志',
    category: 'browser',
    position: { x: 300, y: 100 },
    data: {
      message: '当前 i = {{i}}'
    }
  }
];

const connections4 = connections1;

const code4 = compiler.compile(blocks4, connections4);

console.log('生成的代码片段：');
console.log('---');
const lines4 = code4.split('\n');
const loopStart4 = lines4.findIndex(line => line.includes('开始循环'));
if (loopStart4 >= 0) {
  console.log(lines4.slice(loopStart4, Math.min(loopStart4 + 6, lines4.length)).join('\n'));
}
console.log('---\n');

if (code4.includes('const i = __loopIndex + 1;')) {
  console.log('✅ 通过：循环变量从默认值（1）开始');
} else {
  console.log('❌ 失败：循环变量没有使用默认值');
}

console.log('\n=== 测试完成 ===');
