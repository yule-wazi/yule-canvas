import * as acorn from 'acorn';

export class ScriptParser {
  parse(code: string): any {
    try {
      // 如果代码包含 await，需要包装成 async 函数
      let codeToparse = code;
      if (code.includes('await') && !code.includes('async function')) {
        codeToparse = `(async function() {\n${code}\n})();`;
      }

      const ast = acorn.parse(codeToparse, {
        ecmaVersion: 2020,
        sourceType: 'module'
      });

      const blocks: any[] = [];
      const connections: any[] = [];
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

      return {
        id: Date.now().toString(),
        name: '解析的工作流',
        description: '',
        blocks,
        connections,
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    } catch (error) {
      console.error('解析脚本失败:', error);
      throw error;
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

  private parseCallExpression(node: any, yPosition: number): any | null {
    if (node.callee.type !== 'MemberExpression') return null;

    const object = node.callee.object;
    const property = node.callee.property;

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
      default:
        return null;
    }
  }

  private createNavigateBlock(args: any[], yPosition: number): any {
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

  private createWaitBlock(args: any[], yPosition: number): any {
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

  private createClickBlock(args: any[], yPosition: number): any {
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

  private createTypeBlock(args: any[], yPosition: number): any {
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

  private extractStringValue(node: any): string | null {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      return node.value;
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
}
