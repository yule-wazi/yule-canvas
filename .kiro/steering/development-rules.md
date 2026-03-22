# 开发规范

## 代码提交规则

1. **禁止自主创建文档**: 除非用户明确要求，AI助手不允许擅自创建说明文档
2. **禁止自主提交代码**: 除非用户明确要求，AI助手不允许自主提交代码修改

## 代码与解析同步规则

当修改任何功能模块的代码逻辑时，必须同步更新相应的解析功能，确保：

- **双向一致性**: 代码生成器（BlockCompiler）和代码解析器（ScriptParser）必须保持100%同步
- **完整性保证**: 生成的代码必须能够被解析器完整还原为相同的模块链（workflow blocks）
- **测试验证**: 每次修改后需验证 代码→解析→代码 的往返转换结果一致

### 关键文件

需要同步维护的文件对：

**Frontend**:
- `frontend/src/services/BlockCompiler.ts` - 将workflow blocks编译为Playwright代码
- `frontend/src/services/ScriptParser.ts` - 将Playwright代码解析回workflow blocks

**Backend**:
- `backend/src/services/BlockCompiler.ts` - 后端编译器
- `backend/src/services/ScriptParser.ts` - 后端解析器

### 验证要求

修改编译或解析逻辑后，必须确保：

```
Workflow Blocks → BlockCompiler → Code → ScriptParser → Workflow Blocks
```

这个循环转换后，最终的 Workflow Blocks 与初始的完全一致。
