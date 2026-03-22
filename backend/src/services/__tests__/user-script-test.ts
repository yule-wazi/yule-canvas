import { ScriptParser } from '../ScriptParser';
import { BlockCompiler } from '../BlockCompiler';

console.log('=== 用户脚本往返测试 ===\n');

const userScript = `// 自动生成的Playwright脚本
// 生成时间: 2026/3/22 21:25:46

// 用于存储提取的数据
const extractedResults = {
  images: [],
  data: [],
  links: []
};

log('访问页面: https://yule-hub.vercel.app/#/comics/home');
await page.goto('https://yule-hub.vercel.app/#/comics/home', { waitUntil: 'domcontentloaded', timeout: 60000 });

log('开始循环，共 10 次');
for (let __loopIndex = 0; __loopIndex < 10; __loopIndex++) {
  const num = __loopIndex + 3; // 循环变量从3开始
  log('循环第 ' + (__loopIndex + 1) + ' 次，num = ' + num);
  
  log(\`等待并点击元素: #app > div > div > div.home > div.list > div:nth-child(\${num}) > div > div.image > div.myImg\`);
  await page.waitForSelector(\`#app > div > div > div.home > div.list > div:nth-child(\${num}) > div > div.image > div.myImg\`, { timeout: 5000 });
  await page.click(\`#app > div > div > div.home > div.list > div:nth-child(\${num}) > div > div.image > div.myImg\`);
  
  log('【等待模块】等待 1000ms');
  await page.waitForTimeout(1000);
  log('【等待模块】等待完成');
  
  log('返回上一页');
  await page.goBack();
  
  log('【等待模块】等待 1000ms');
  await page.waitForTimeout(1000);
  log('【等待模块】等待完成');
}
log('循环完成');

// 返回统一数据格式
return {
  success: true,
  dataType: 'workflow',
  url: page.url(),
  timestamp: Date.now(),
  count: extractedResults.images.length + extractedResults.data.length + extractedResults.links.length,
  results: extractedResults
};`;

const parser = new ScriptParser();
const compiler = new BlockCompiler();

console.log('步骤 1: 解析用户脚本');
const parsed = parser.parse(userScript);
console.log(`✓ 解析成功: ${parsed.blocks.length} 个模块, ${parsed.connections.length} 个连接`);

// 验证循环模块
const loopBlock = parsed.blocks.find((b: any) => b.type === 'loop');
if (!loopBlock) {
  console.log('❌ 错误: 未找到循环模块');
  process.exit(1);
}

console.log('\n循环模块信息:');
console.log('- 模式:', loopBlock.data.mode);
console.log('- 次数:', loopBlock.data.count);
console.log('- 使用变量:', loopBlock.data.useVariable);
console.log('- 变量名:', loopBlock.data.variableName);
console.log('- 起始值:', loopBlock.data.startValue);

// 验证字段
if (loopBlock.data.mode !== 'count') {
  console.log('❌ 错误: 循环模式不正确');
  process.exit(1);
}
if (loopBlock.data.count !== 10) {
  console.log('❌ 错误: 循环次数不正确');
  process.exit(1);
}
if (!loopBlock.data.useVariable) {
  console.log('❌ 错误: 应该使用变量');
  process.exit(1);
}
if (loopBlock.data.variableName !== 'num') {
  console.log('❌ 错误: 变量名不正确');
  process.exit(1);
}
if (loopBlock.data.startValue !== '{{num}}') {
  console.log('❌ 错误: 起始值不正确');
  process.exit(1);
}

console.log('✓ 所有字段验证通过');

// 验证点击模块的选择器
const clickBlock = parsed.blocks.find((b: any) => b.type === 'click');
if (!clickBlock) {
  console.log('❌ 错误: 未找到点击模块');
  process.exit(1);
}

console.log('\n点击模块选择器:', clickBlock.data.selector);
if (!clickBlock.data.selector.includes('{{num}}')) {
  console.log('❌ 错误: 选择器应该包含 {{num}}');
  process.exit(1);
}
console.log('✓ 选择器包含变量占位符');

console.log('\n步骤 2: 重新生成代码');
// 模拟全局变量（起始值为3）
const variables = {
  num: { value: '3', description: '起始索引' }
};
const regenerated = compiler.compile(parsed.blocks, parsed.connections, variables);
console.log('✓ 代码生成成功');

// 验证生成的代码包含关键部分
if (!regenerated.includes('const num = __loopIndex + 3')) {
  console.log('❌ 错误: 生成的代码应该包含 "const num = __loopIndex + 3"');
  process.exit(1);
}
console.log('✓ 生成的代码包含循环变量声明');

if (!regenerated.includes('${num}')) {
  console.log('❌ 错误: 生成的代码应该使用模板字符串变量');
  process.exit(1);
}
console.log('✓ 生成的代码使用模板字符串变量');

console.log('\n步骤 3: 再次解析生成的代码');
const reparsed = parser.parse(regenerated);
console.log(`✓ 再次解析成功: ${reparsed.blocks.length} 个模块`);

// 验证往返一致性
const loopBlock2 = reparsed.blocks.find((b: any) => b.type === 'loop');
if (!loopBlock2) {
  console.log('❌ 错误: 再次解析后未找到循环模块');
  process.exit(1);
}

if (loopBlock2.data.variableName !== loopBlock.data.variableName) {
  console.log('❌ 错误: 变量名不一致');
  process.exit(1);
}

if (loopBlock2.data.count !== loopBlock.data.count) {
  console.log('❌ 错误: 循环次数不一致');
  process.exit(1);
}

console.log('✓ 往返转换一致');

console.log('\n🎉 用户脚本往返测试通过！');
console.log('✅ 代码 → 解析 → 代码 → 解析 完全一致');
