# 循环变量功能实现总结

## 概述
成功实现了循环变量功能，支持从全局变量获取起始值，并确保代码生成器（BlockCompiler）和代码解析器（ScriptParser）100%同步。

## 最近修复

### 提取数据重复保存问题（2026/3/22）
**问题**: 提取数据模块会将数据保存两次，导致数据表中出现重复数据
- 第一次：`extractedResults.data.push(rowData)` 
- 第二次：`saveDataImmediately(...)`

**修复**: 移除了 `extractedResults.data.push` 调用，只保留 `saveDataImmediately`
- 文件：`backend/src/services/BlockCompiler.ts`
- 影响：提取数据模块现在只保存一次数据

## 实现的功能

### 1. 循环变量逻辑
- 用户必须先在"🔢 变量"中定义全局变量
- 在循环模块中选择该全局变量作为循环变量
- 循环会创建临时变量，初始值从全局变量获取
- 循环结束后全局变量保持不变

### 2. 支持的场景
1. **不使用循环变量**: 简单的固定次数循环
2. **使用循环变量（固定次数）**: 从全局变量获取起始值
3. **使用循环变量（条件循环）**: 支持条件判断和变量
4. **复杂场景**: 循环前后有其他模块

### 3. 代码生成示例

#### 不使用变量
```javascript
for (let __loopIndex = 0; __loopIndex < 10; __loopIndex++) {
  log('循环第 ' + (__loopIndex + 1) + ' 次');
  // 循环体
}
```

#### 使用变量（从全局变量 num=3 开始）
```javascript
for (let __loopIndex = 0; __loopIndex < 10; __loopIndex++) {
  const num = __loopIndex + 3; // 循环变量从3开始
  log('循环第 ' + (__loopIndex + 1) + ' 次，num = ' + num);
  // 循环体可以使用 ${num}
}
```

### 4. 变量替换机制

#### 在选择器中使用变量
- 用户输入: `div:nth-child({{num}})`
- 生成代码: `` `div:nth-child(${num})` ``（模板字符串）
- 解析回来: `div:nth-child({{num}})`

#### 变量类型
1. **循环变量**: `{{variableName}}` → `${variableName}` （运行时求值）
2. **全局变量**: `{{globalVar}}` → 实际值（编译时替换）

## 修改的文件

### 后端
1. **backend/src/services/BlockCompiler.ts**
   - 支持循环变量的代码生成
   - 支持从全局变量获取起始值
   - 支持模板字符串变量替换

2. **backend/src/services/ScriptParser.ts**
   - 修复条件循环的类型错误
   - 支持解析带变量名的循环
   - 支持解析不带变量名的循环
   - 正确提取 `startValue` 和 `startValueType`

### 前端
1. **frontend/src/services/ScriptParser.ts**
   - 添加完整的循环解析逻辑
   - 支持固定次数循环和条件循环
   - 支持变量名和起始值的解析
   - 模板字符串变量转换

2. **frontend/src/components/workflow/properties/LoopProperty.vue**
   - 移除"循环变量名"输入框
   - 只保留全局变量选择下拉框
   - 选择的全局变量名自动成为循环变量名

## 测试验证

### 综合测试（6个场景）
```bash
npx ts-node backend/src/services/__tests__/comprehensive-loop-test.ts
```
结果: ✅ 6/6 通过 (100%)

### 用户脚本往返测试
```bash
npx ts-node backend/src/services/__tests__/user-script-test.ts
```
结果: ✅ 通过
- 代码 → 解析 → 代码 → 解析 完全一致
- 所有字段验证通过
- 变量占位符正确转换

## 关键技术点

### 1. 正则表达式匹配
- 支持带变量名和不带变量名两种模式
- 使用独立的 `RegExpExecArray` 变量避免类型错误
- 防止重复匹配（通过 `alreadyMatched` 检查）

### 2. 变量替换顺序
1. 先替换循环变量 `{{variableName}}` → `${variableName}`
2. 再替换全局变量 `{{globalVar}}` → 实际值

### 3. 模板字符串处理
- 检测是否包含 `${variableName}`
- 如果包含，使用模板字符串语法
- 如果不包含，使用普通字符串

### 4. 往返转换一致性
```
Workflow Blocks → BlockCompiler → Code → ScriptParser → Workflow Blocks
```
确保最终的 Workflow Blocks 与初始的完全一致。

## 遵循的开发规范

✅ 代码生成器（BlockCompiler）和代码解析器（ScriptParser）保持100%同步
✅ 生成的代码能够被解析器完整还原为相同的模块链
✅ 验证了 代码→解析→代码 的往返转换结果一致
✅ 前后端解析器逻辑一致

## 未来改进建议

1. 支持多个循环嵌套
2. 支持循环变量的数学运算（如 `{{num}} * 2`）
3. 支持更复杂的条件表达式
4. 添加循环变量的作用域检查

## 总结

循环变量功能已完全实现并通过所有测试。代码生成和解析逻辑完全同步，确保了工作流的可靠性和一致性。
