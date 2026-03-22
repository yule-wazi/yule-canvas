import * as acorn from 'acorn';
import type { Block, BlockType } from '../types/block';
import type { Connection } from '../types/connection';
import type { Workflow } from '../types/workflow';

export class ScriptParser {
  parse(code: string): { blocks: Block[]; connections: Connection[] } {
    try {
      // 检查是否包含循环
      const hasLoop = /log\('开始循环，共 (\d+) 次'\);|log\('开始条件循环'\);/.test(code);
      
      if (hasLoop) {
        // 解析包含循环的代码
        return this.parseWithLoop(code);
      }

      // 原有的 AST 解析逻辑（用于不包含循环的简单脚本）
      const ast = acorn.parse(code, {
        ecmaVersion: 2020,
        sourceType: 'module'
      });

      const blocks: Block[] = [];
      const connections: Connection[] = [];
      let yPosition = 100;

      // 遍历AST查找await表达式
      this.traverseAST(ast, (node: any) => {
        if (node.type === 'AwaitExpression' && node.argument.type === 'CallExpression') {
          const block = this.parseCallExpression(node.argument, yPosition);
          if (block) {
            blocks.push(block);
            yPosition += 120;
          }
        }
      });

      // 创建顺序连接
      for (let i = 0; i < blocks.length - 1; i++) {
        connections.push({
          id: `conn-${i}`,
          source: blocks[i].id,
          sourceHandle: 'out',
          target: blocks[i + 1].id,
          targetHandle: 'in'
        });
      }

      return { blocks, connections };
    } catch (error) {
      console.error('解析脚本失败:', error);
      return { blocks: [], connections: [] };
    }
  }

  private parseWithLoop(code: string): { blocks: Block[]; connections: Connection[] } {
    const blocks: Block[] = [];
    const connections: Connection[] = [];
    let xPosition = 100;

    // 查找所有循环（支持多个循环）
    const loopMatches: Array<{
      mode: string;
      count?: number;
      condition?: string;
      maxIterations?: number;
      variableName?: string;
      startValue?: number;
      startValueType?: string;
      bodyCode: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    // 匹配所有固定次数循环（包含变量名和起始值）
    const countLoopPattern = /log\('开始循环，共 (\d+) 次'\);[\s\S]*?for \(let __loopIndex = 0; __loopIndex < (\d+); __loopIndex\+\+\) \{\s*const (\w+) = __loopIndex \+ (\d+);[\s\S]*?([\s\S]*?)\n\}[\s\S]*?log\('循环完成'\);/g;
    let match: RegExpExecArray | null;
    while ((match = countLoopPattern.exec(code)) !== null) {
      const startValue = parseInt(match[4]);
      loopMatches.push({
        mode: 'count',
        count: parseInt(match[2]),
        variableName: match[3],
        startValue: startValue,
        startValueType: 'variable',
        bodyCode: match[5],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // 匹配所有固定次数循环（不带变量名）
    const countLoopNoVarPattern = /log\('开始循环，共 (\d+) 次'\);[\s\S]*?for \(let __loopIndex = 0; __loopIndex < (\d+); __loopIndex\+\+\) \{\s*log\('循环第[\s\S]*?([\s\S]*?)\n\}[\s\S]*?log\('循环完成'\);/g;
    while ((match = countLoopNoVarPattern.exec(code)) !== null) {
      const matchIndex = match.index;
      const matchLength = match[0].length;
      const alreadyMatched = loopMatches.some(m => 
        m.startIndex <= matchIndex && m.endIndex >= matchIndex + matchLength
      );
      
      if (!alreadyMatched) {
        loopMatches.push({
          mode: 'count',
          count: parseInt(match[2]),
          variableName: '',
          startValue: undefined,
          startValueType: undefined,
          bodyCode: match[3],
          startIndex: matchIndex,
          endIndex: matchIndex + matchLength
        });
      }
    }

    // 匹配所有条件循环（包含变量名和起始值）
    const conditionLoopPattern = /log\('开始条件循环'\);[\s\S]*?let __loopIndex = 0;[\s\S]*?while \((.+?) && __loopIndex < (\d+)\) \{\s*const (\w+) = __loopIndex \+ (\d+);[\s\S]*?([\s\S]*?)__loopIndex\+\+;[\s\S]*?\n\}[\s\S]*?log\('循环完成，共执行 ' \+ __loopIndex \+ ' 次'\);/g;
    let conditionMatch: RegExpExecArray | null;
    while ((conditionMatch = conditionLoopPattern.exec(code)) !== null) {
      const startValue = parseInt(conditionMatch[4]);
      loopMatches.push({
        mode: 'condition',
        condition: conditionMatch[1],
        maxIterations: parseInt(conditionMatch[2]),
        variableName: conditionMatch[3],
        startValue: startValue,
        startValueType: 'variable',
        bodyCode: conditionMatch[5],
        startIndex: conditionMatch.index,
        endIndex: conditionMatch.index + conditionMatch[0].length
      });
    }
    
    // 匹配所有条件循环（不带变量名）
    const conditionLoopNoVarPattern = /log\('开始条件循环'\);[\s\S]*?let __loopIndex = 0;[\s\S]*?while \((.+?) && __loopIndex < (\d+)\) \{\s*log\('循环第[\s\S]*?([\s\S]*?)__loopIndex\+\+;[\s\S]*?\n\}[\s\S]*?log\('循环完成，共执行 ' \+ __loopIndex \+ ' 次'\);/g;
    let conditionNoVarMatch: RegExpExecArray | null;
    while ((conditionNoVarMatch = conditionLoopNoVarPattern.exec(code)) !== null) {
      const alreadyMatched = loopMatches.some(m => 
        m.startIndex <= conditionNoVarMatch!.index && m.endIndex >= conditionNoVarMatch!.index + conditionNoVarMatch![0].length
      );
      
      if (!alreadyMatched) {
        loopMatches.push({
          mode: 'condition',
          condition: conditionNoVarMatch[1],
          maxIterations: parseInt(conditionNoVarMatch[2]),
          variableName: '',
          startValue: undefined,
          startValueType: undefined,
          bodyCode: conditionNoVarMatch[3],
          startIndex: conditionNoVarMatch.index,
          endIndex: conditionNoVarMatch.index + conditionNoVarMatch[0].length
        });
      }
    }

    // 按照出现顺序排序
    loopMatches.sort((a, b) => a.startIndex - b.startIndex);

    // 如果没有找到循环，返回空
    if (loopMatches.length === 0) {
      return { blocks: [], connections: [] };
    }

    // 简化处理：只处理单个循环的情况
    const loopMatch = loopMatches[0];
    
    // 解析循环体内的模块
    const bodyBlocks = this.parseLoopBody(loopMatch.bodyCode, xPosition);
    xPosition += bodyBlocks.length * 250;

    // 创建循环模块
    const loopBlock: Block = {
      id: `block-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'loop',
      label: '循环',
      category: 'logic',
      position: { x: xPosition, y: 350 },
      data: {
        mode: loopMatch.mode,
        count: loopMatch.count || 10,
        condition: loopMatch.condition || '',
        maxIterations: loopMatch.maxIterations || 1000,
        useVariable: !!loopMatch.variableName,
        variableName: loopMatch.variableName || '',
        startValueType: loopMatch.startValueType || 'variable',
        startValue: loopMatch.startValue && loopMatch.variableName 
          ? `{{${loopMatch.variableName}}}` 
          : ''
      },
      inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
      outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
    };

    blocks.push(...bodyBlocks, loopBlock);

    // 循环体内模块之间的连接
    for (let i = 0; i < bodyBlocks.length - 1; i++) {
      connections.push({
        id: `conn-loop-body-${i}`,
        source: bodyBlocks[i].id,
        sourceHandle: 'source-right',
        target: bodyBlocks[i + 1].id,
        targetHandle: 'target-left'
      });
    }

    // 循环模块的连接
    if (bodyBlocks.length > 0) {
      // loop-start -> 第一个循环体模块
      connections.push({
        id: `conn-loop-start`,
        source: loopBlock.id,
        sourceHandle: 'loop-start',
        target: bodyBlocks[0].id,
        targetHandle: 'target-left'
      });

      // 最后一个循环体模块 -> loop-end
      connections.push({
        id: `conn-loop-end`,
        source: bodyBlocks[bodyBlocks.length - 1].id,
        sourceHandle: 'source-right',
        target: loopBlock.id,
        targetHandle: 'loop-end'
      });
    }

    return { blocks, connections };
  }

  private parseLoopBody(bodyCode: string, startX: number): Block[] {
    const blocks: Block[] = [];
    const matches: Array<{ index: number; block: Block }> = [];

    // 解析循环体内的各种模块
    let match: RegExpExecArray | null;
    
    // 1. 解析 navigate
    const navigatePattern = /await page\.goto\('([^']+)',\s*\{[^}]*waitUntil:\s*'([^']+)'[^}]*timeout:\s*(\d+)[^}]*\}\);/g;
    while ((match = navigatePattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createNavigateBlock(match[1], match[2], parseInt(match[3]), 0)
      });
    }

    // 1b. 解析 back (返回)
    const backPattern = /await page\.goBack\(\);/g;
    while ((match = backPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createBackBlock(0)
      });
    }

    // 1c. 解析 forward (前进)
    const forwardPattern = /await page\.goForward\(\);/g;
    while ((match = forwardPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createForwardBlock(0)
      });
    }

    // 2. 解析 wait
    const waitPattern = /log\('【等待模块】等待 (\d+)ms'\);[\s\S]*?await page\.waitForTimeout\((\d+)\);[\s\S]*?log\('【等待模块】等待完成'\);/g;
    while ((match = waitPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createWaitBlock(parseInt(match[1]), 0)
      });
    }

    // 3. 解析 click - 支持模板字符串
    const clickPattern = /await page\.waitForSelector\(`([^`]+)`,\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\(`([^`]+)`\);/g;
    while ((match = clickPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createClickBlock(match[1], parseInt(match[2]), 0)
      });
    }
    
    // 3b. 解析 click - 单引号版本
    const clickPatternSingle = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
    while ((match = clickPatternSingle.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createClickBlock(match[1], parseInt(match[2]), 0)
      });
    }

    // 按照代码中的位置排序
    matches.sort((a, b) => a.index - b.index);

    // 设置正确的 x 位置并添加到 blocks 数组
    matches.forEach((item, idx) => {
      item.block.position.x = startX + idx * 250;
      blocks.push(item.block);
    });

    return blocks;
  }

  private createNavigateBlock(url: string, waitUntil: string, timeout: number, xPosition: number): Block {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'navigate',
      label: '访问页面',
      category: 'browser',
      position: { x: xPosition, y: 200 },
      data: {
        url,
        waitUntil,
        timeout
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createBackBlock(xPosition: number): Block {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'back',
      label: '返回',
      category: 'browser',
      position: { x: xPosition, y: 200 },
      data: {},
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createForwardBlock(xPosition: number): Block {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'forward',
      label: '前进',
      category: 'browser',
      position: { x: xPosition, y: 200 },
      data: {},
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createWaitBlock(duration: number, xPosition: number): Block {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'wait',
      label: '等待',
      category: 'browser',
      position: { x: xPosition, y: 200 },
      data: {
        duration
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createClickBlock(selector: string, timeout: number, xPosition: number): Block {
    // 将模板字符串变量 ${variableName} 转换回 {{variableName}}
    const convertedSelector = selector.replace(/\$\{(\w+)\}/g, '{{$1}}');
    
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'click',
      label: '点击元素',
      category: 'interaction',
      position: { x: xPosition, y: 200 },
      data: {
        selector: convertedSelector,
        waitForElement: true,
        timeout
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private traverseAST(node: any, callback: (node: any) => void) {
    callback(node);
    
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach((child: any) => {
            if (child && typeof child === 'object') {
              this.traverseAST(child, callback);
            }
          });
        } else {
          this.traverseAST(node[key], callback);
        }
      }
    }
  }

  private parseCallExpression(node: any, yPosition: number): Block | null {
    if (node.callee.type !== 'MemberExpression') return null;

    const object = node.callee.object;
    const property = node.callee.property;

    // 检查是否是page.xxx()调用
    if (object.name !== 'page') return null;

    const methodName = property.name;
    const args = node.arguments;

    switch (methodName) {
      case 'goto':
        return this.createNavigateBlock(args, yPosition);
      case 'waitForTimeout':
        return this.createWaitBlock(args, yPosition);
      case 'click':
        return this.createClickBlock(args, yPosition);
      case 'type':
        return this.createTypeBlock(args, yPosition);
      case 'evaluate':
        return this.parseEvaluateBlock(args, yPosition);
      default:
        return null;
    }
  }

  private createNavigateBlock(args: any[], yPosition: number): Block {
    const url = this.extractStringValue(args[0]);
    const options = this.extractObjectValue(args[1]);

    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'navigate',
      label: '访问页面',
      category: 'browser',
      position: { x: 200, y: yPosition },
      data: {
        url: url || '',
        waitUntil: options?.waitUntil || 'domcontentloaded',
        timeout: options?.timeout || 60000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createWaitBlock(args: any[], yPosition: number): Block {
    const duration = this.extractNumberValue(args[0]);

    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'wait',
      label: '等待',
      category: 'browser',
      position: { x: 200, y: yPosition },
      data: {
        duration: duration || 3000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createClickBlock(args: any[], yPosition: number): Block {
    const selector = this.extractStringValue(args[0]);

    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'click',
      label: '点击元素',
      category: 'interaction',
      position: { x: 200, y: yPosition },
      data: {
        selector: selector || '',
        waitForElement: true,
        timeout: 30000
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createTypeBlock(args: any[], yPosition: number): Block {
    const selector = this.extractStringValue(args[0]);
    const text = this.extractStringValue(args[1]);

    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'type',
      label: '输入文本',
      category: 'interaction',
      position: { x: 200, y: yPosition },
      data: {
        selector: selector || '',
        text: text || '',
        delay: 100
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private parseEvaluateBlock(args: any[], yPosition: number): Block | null {
    // 检查evaluate内容，判断是滚动还是提取数据
    const funcArg = args[0];
    
    if (funcArg && funcArg.type === 'ArrowFunctionExpression') {
      const body = funcArg.body;
      const bodyStr = this.nodeToString(body);

      // 检测滚动逻辑
      if (bodyStr.includes('scrollBy') || bodyStr.includes('scrollHeight')) {
        return {
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'scroll',
          label: '滚动页面',
          category: 'browser',
          position: { x: 200, y: yPosition },
          data: {
            mode: 'smart',
            maxScrolls: 15,
            delay: 800
          },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        };
      }
    }

    return null;
  }

  private extractStringValue(node: any): string | null {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      return node.value;
    }
    if (node.type === 'TemplateLiteral' && node.quasis.length > 0) {
      return node.quasis[0].value.raw;
    }
    return null;
  }

  private extractNumberValue(node: any): number | null {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'number') {
      return node.value;
    }
    return null;
  }

  private extractObjectValue(node: any): any {
    if (!node || node.type !== 'ObjectExpression') return null;

    const obj: any = {};
    node.properties.forEach((prop: any) => {
      if (prop.type === 'Property') {
        const key = prop.key.name || prop.key.value;
        const value = this.extractValue(prop.value);
        obj[key] = value;
      }
    });

    return obj;
  }

  private extractValue(node: any): any {
    if (node.type === 'Literal') {
      return node.value;
    }
    if (node.type === 'Identifier') {
      return node.name;
    }
    return null;
  }

  private nodeToString(node: any): string {
    // 简单的节点转字符串，用于模式匹配
    return JSON.stringify(node);
  }
}
