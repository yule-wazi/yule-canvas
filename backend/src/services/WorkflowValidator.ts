/**
 * Workflow JSON 验证器
 * 用于验证 Workflow JSON 的格式和连接正确性
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class WorkflowValidator {
  /**
   * 验证 Workflow JSON 格式
   */
  static validate(workflow: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 验证基本结构
    if (!workflow) {
      errors.push('Workflow 不能为空');
      return { valid: false, errors, warnings };
    }

    if (!workflow.blocks || !Array.isArray(workflow.blocks)) {
      errors.push('缺少 blocks 数组');
    }

    if (!workflow.connections || !Array.isArray(workflow.connections)) {
      errors.push('缺少 connections 数组');
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // 2. 验证 blocks
    const blockIds = new Set<string>();
    workflow.blocks.forEach((block: any, index: number) => {
      if (!block.id) {
        errors.push(`Block[${index}] 缺少 id`);
      } else {
        if (blockIds.has(block.id)) {
          errors.push(`Block id "${block.id}" 重复`);
        }
        blockIds.add(block.id);
      }

      if (!block.type) {
        errors.push(`Block[${index}] 缺少 type`);
      }

      if (!block.data) {
        errors.push(`Block[${index}] 缺少 data`);
      }
    });

    // 3. 验证 connections
    workflow.connections.forEach((conn: any, index: number) => {
      if (!conn.source) {
        errors.push(`Connection[${index}] 缺少 source`);
      } else if (!blockIds.has(conn.source)) {
        errors.push(`Connection[${index}] source "${conn.source}" 不存在`);
      }

      if (!conn.target) {
        errors.push(`Connection[${index}] 缺少 target`);
      } else if (!blockIds.has(conn.target)) {
        errors.push(`Connection[${index}] target "${conn.target}" 不存在`);
      }

      if (!conn.sourceHandle) {
        errors.push(`Connection[${index}] 缺少 sourceHandle`);
      }

      if (!conn.targetHandle) {
        errors.push(`Connection[${index}] 缺少 targetHandle`);
      }
    });

    // 4. 验证循环连接
    const loopBlocks = workflow.blocks.filter((b: any) => b.type === 'loop');
    loopBlocks.forEach((loop: any) => {
      const loopStartConns = workflow.connections.filter(
        (c: any) => c.source === loop.id && c.sourceHandle === 'loop-start'
      );
      const loopEndConns = workflow.connections.filter(
        (c: any) => c.target === loop.id && c.targetHandle === 'loop-end'
      );

      if (loopStartConns.length === 0) {
        warnings.push(`循环 "${loop.label || loop.id}" 没有 loop-start 连接（循环体为空）`);
      }

      if (loopEndConns.length === 0) {
        warnings.push(`循环 "${loop.label || loop.id}" 没有 loop-end 连接（循环体为空）`);
      }
    });

    // 5. 检测循环依赖（非循环模块之间）
    const normalBlocks = workflow.blocks.filter((b: any) => b.type !== 'loop');
    const normalConnections = workflow.connections.filter(
      (c: any) => c.sourceHandle !== 'loop-start' && c.targetHandle !== 'loop-end'
    );

    if (this.hasCycle(normalBlocks, normalConnections)) {
      errors.push('检测到循环依赖（非循环模块之间不应该有环）');
    }

    // 6. 检测孤立的模块
    const connectedBlocks = new Set<string>();
    workflow.connections.forEach((conn: any) => {
      connectedBlocks.add(conn.source);
      connectedBlocks.add(conn.target);
    });

    workflow.blocks.forEach((block: any) => {
      if (!connectedBlocks.has(block.id) && workflow.blocks.length > 1) {
        warnings.push(`模块 "${block.label || block.id}" 没有连接到其他模块`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 检测是否有循环依赖（使用 DFS）
   */
  private static hasCycle(blocks: any[], connections: any[]): boolean {
    const graph = new Map<string, string[]>();
    
    blocks.forEach(block => {
      graph.set(block.id, []);
    });

    connections.forEach(conn => {
      const neighbors = graph.get(conn.source) || [];
      neighbors.push(conn.target);
      graph.set(conn.source, neighbors);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // 发现环
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const block of blocks) {
      if (!visited.has(block.id)) {
        if (dfs(block.id)) return true;
      }
    }

    return false;
  }

  /**
   * 验证并返回友好的错误信息
   */
  static validateAndFormat(workflow: any): string {
    const result = this.validate(workflow);

    if (result.valid) {
      let message = '✅ Workflow JSON 验证通过';
      if (result.warnings.length > 0) {
        message += '\n\n⚠️ 警告：\n' + result.warnings.map(w => `  - ${w}`).join('\n');
      }
      return message;
    } else {
      let message = '❌ Workflow JSON 验证失败\n\n错误：\n';
      message += result.errors.map(e => `  - ${e}`).join('\n');
      
      if (result.warnings.length > 0) {
        message += '\n\n⚠️ 警告：\n' + result.warnings.map(w => `  - ${w}`).join('\n');
      }
      
      return message;
    }
  }
}
