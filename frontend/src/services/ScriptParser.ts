import * as acorn from 'acorn';
import type { Block, BlockType } from '../types/block';
import type { Connection } from '../types/connection';
import type { Workflow } from '../types/workflow';

export class ScriptParser {
  parse(code: string): { blocks: Block[]; connections: Connection[] } {
    try {
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

      // 检测图片提取
      if (bodyStr.includes('querySelectorAll') && bodyStr.includes('img')) {
        return {
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'extract-images',
          label: '提取图片',
          category: 'extraction',
          position: { x: 200, y: yPosition },
          data: {
            filterInvalid: true,
            attributes: ['src', 'data-src']
          },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [
            { id: 'out', name: '输出', type: 'flow' },
            { id: 'data', name: '图片列表', type: 'data' }
          ]
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
