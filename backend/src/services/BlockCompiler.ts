export class BlockCompiler {
  // 默认超时时间常量（毫秒）
  private readonly DEFAULT_TIMEOUT = 5000;
  
  // 全局变量
  private globalVariables: Record<string, any> = {};

  compile(blocks: any[], connections: any[], variables: Record<string, any> = {}): string {
    // 保存全局变量
    this.globalVariables = variables;
    
    if (blocks.length === 0) {
      return '// 工作流为空\nreturn { success: false, message: "工作流为空" };';
    }

    // 检查是否有循环模块
    const loopBlocks = blocks.filter(b => b.type === 'loop');
    
    if (loopBlocks.length > 0) {
      // 有循环模块，使用特殊的循环编译逻辑
      return this.compileWithLoops(blocks, connections);
    }

    // 没有循环模块，使用普通的拓扑排序
    const sortedBlocks = this.topologicalSort(blocks, connections);

    // 生成代码片段
    const codeFragments: string[] = [];
    
    sortedBlocks.forEach(block => {
      const code = this.generateBlockCode(block);
      if (code) {
        codeFragments.push(code);
      }
    });

    // 组装完整代码
    return this.assembleCode(codeFragments);
  }

  private compileWithLoops(blocks: any[], connections: any[]): string {
    // 处理多个循环模块
    const loopBlocks = blocks.filter(b => b.type === 'loop');
    
    // 为每个循环模块找到其循环体
    const loopInfoMap = new Map<string, any>();
    loopBlocks.forEach(loopBlock => {
      const loopStartConn = connections.find(c => 
        c.source === loopBlock.id && c.sourceHandle === 'loop-start'
      );
      const loopEndConn = connections.find(c => 
        c.target === loopBlock.id && c.targetHandle === 'loop-end'
      );
      
      if (loopStartConn && loopEndConn) {
        const loopBodyBlocks = this.findLoopBodyBlocks(
          blocks,
          connections,
          loopStartConn.target,
          loopEndConn.source
        );
        
        loopInfoMap.set(loopBlock.id, {
          loopBlock,
          loopBodyBlocks,
          loopBodyBlockIds: new Set(loopBodyBlocks.map(b => b.id)),
          loopStartTarget: loopStartConn.target,
          loopEndSource: loopEndConn.source,
          variableName: loopBlock.data.variableName || 'index'
        });
      }
    });
    
    // 找到所有循环体内的块ID
    const allLoopBodyIds = new Set<string>();
    loopInfoMap.forEach(info => {
      info.loopBodyBlockIds.forEach((id: string) => allLoopBodyIds.add(id));
    });
    
    // 创建映射：循环体块ID -> 循环模块ID
    const blockToLoopMap = new Map<string, string>();
    loopInfoMap.forEach((info, loopId) => {
      info.loopBodyBlockIds.forEach((blockId: string) => {
        blockToLoopMap.set(blockId, loopId);
      });
    });
    
    // 构建一个虚拟图：将循环体折叠成循环模块
    // 1. 收集所有非循环体内的块和循环模块
    const virtualBlocks = blocks.filter(b => 
      !allLoopBodyIds.has(b.id) || b.type === 'loop'
    );
    
    // 2. 构建虚拟连接
    const virtualConnections: any[] = [];
    const processedConnections = new Set<string>();
    
    connections.forEach(conn => {
      // 跳过循环的特殊连接
      if (conn.sourceHandle === 'loop-start' || conn.targetHandle === 'loop-end') {
        return;
      }
      
      const sourceInLoop = allLoopBodyIds.has(conn.source);
      const targetInLoop = allLoopBodyIds.has(conn.target);
      
      // 情况1: 两个都在循环体内
      if (sourceInLoop && targetInLoop) {
        const sourceLoopId = blockToLoopMap.get(conn.source);
        const targetLoopId = blockToLoopMap.get(conn.target);
        
        // 如果在同一个循环体内，跳过
        if (sourceLoopId === targetLoopId) {
          return;
        }
        
        // 如果在不同循环体内，创建循环到循环的连接
        const sourceLoopInfo = loopInfoMap.get(sourceLoopId!);
        const targetLoopInfo = loopInfoMap.get(targetLoopId!);
        
        // 只有当源是其循环体的最后一个块，且目标是其循环体的第一个块时，才创建连接
        if (conn.source === sourceLoopInfo.loopEndSource && 
            conn.target === targetLoopInfo.loopStartTarget) {
          const connKey = `${sourceLoopId}->${targetLoopId}`;
          if (!processedConnections.has(connKey)) {
            virtualConnections.push({
              id: `virtual-loop-${connKey}`,
              source: sourceLoopId,
              sourceHandle: 'source-right',
              target: targetLoopId,
              targetHandle: 'target-left'
            });
            processedConnections.add(connKey);
          }
        }
        return;
      }
      
      // 情况2: 源在循环体内，目标在外面
      if (sourceInLoop && !targetInLoop) {
        const sourceLoopId = blockToLoopMap.get(conn.source);
        const sourceLoopInfo = loopInfoMap.get(sourceLoopId!);
        
        // 只有当源是循环体的最后一个块时，才创建连接
        if (conn.source === sourceLoopInfo.loopEndSource) {
          virtualConnections.push({
            ...conn,
            source: sourceLoopId
          });
        }
        return;
      }
      
      // 情况3: 源在外面，目标在循环体内
      if (!sourceInLoop && targetInLoop) {
        const targetLoopId = blockToLoopMap.get(conn.target);
        const targetLoopInfo = loopInfoMap.get(targetLoopId!);
        
        // 只有当目标是循环体的第一个块时，才创建连接
        if (conn.target === targetLoopInfo.loopStartTarget) {
          virtualConnections.push({
            ...conn,
            target: targetLoopId
          });
        }
        return;
      }
      
      // 情况4: 两个都在外面
      virtualConnections.push(conn);
    });
    
    // 3. 使用拓扑排序对虚拟块进行排序
    const sortedBlocks = this.topologicalSort(virtualBlocks, virtualConnections);
    
    // 4. 生成代码
    const codeFragments: string[] = [];
    
    sortedBlocks.forEach(block => {
      if (block.type === 'loop') {
        const loopInfo = loopInfoMap.get(block.id);
        if (loopInfo) {
          // 生成循环体代码，传入变量名用于替换
          const loopBodyCode = loopInfo.loopBodyBlocks.map((b: any) => 
            this.generateBlockCode(b, loopInfo.variableName)
          ).filter(Boolean).join('\n');
          
          // 生成循环代码
          const loopCode = this.generateLoopCode(block, loopBodyCode);
          codeFragments.push(loopCode);
        }
      } else {
        // 普通模块
        const code = this.generateBlockCode(block);
        if (code) {
          codeFragments.push(code);
        }
      }
    });
    
    return this.assembleCode(codeFragments);
  }



  private findLoopBodyBlocks(
    blocks: any[],
    connections: any[],
    startId: string,
    endId: string
  ): any[] {
    const result: any[] = [];
    const visited = new Set<string>();
    
    // 从起始节点开始，沿着连接找到所有节点，直到结束节点
    let currentId = startId;
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      
      const block = blocks.find(b => b.id === currentId);
      if (block && block.type !== 'loop') {
        result.push(block);
      }
      
      // 如果到达结束节点，停止
      if (currentId === endId) {
        break;
      }
      
      // 找到从当前节点出发的下一个连接（普通模块使用 source-right）
      const nextConn = connections.find(c => 
        c.source === currentId && 
        (c.sourceHandle === 'source-right' || c.sourceHandle === 'out')
      );
      
      if (nextConn) {
        currentId = nextConn.target;
      } else {
        // 没有更多连接，停止
        break;
      }
    }
    
    return result;
  }

  private generateLoopCode(loopBlock: any, bodyCode: string): string {
    const { mode, count, condition, maxIterations, variableName, startValueType, startValue } = loopBlock.data;
    const maxIter = maxIterations || 1000;
    const varName = variableName || '';
    
    if (mode === 'count') {
      // 固定次数循环 - 替换全局变量
      // 注意：此方法已正确处理全局变量替换
      // 当 count 包含 {{variableName}} 时，会自动替换为实际值
      let loopCount = count;
      
      // 检查 count 是否包含变量引用
      if (typeof count === 'string' && count.includes('{{')) {
        // 替换全局变量
        loopCount = this.replaceGlobalVariables(count);
        
        // 尝试转换为数字
        const numCount = parseInt(loopCount);
        if (!isNaN(numCount)) {
          loopCount = numCount;
        }
      }
      
      // 处理循环变量的起始值
      let startVal = 1; // 默认从1开始
      let startValCode = '1';
      
      if (startValueType === 'custom' && startValue !== undefined && startValue !== '') {
        // 自定义数值
        if (typeof startValue === 'number') {
          startVal = startValue;
          startValCode = String(startValue);
        } else if (typeof startValue === 'string') {
          // 如果是字符串，尝试解析
          const numStartValue = parseInt(startValue);
          if (!isNaN(numStartValue)) {
            startVal = numStartValue;
            startValCode = String(numStartValue);
          } else {
            // 如果无法解析，使用默认值
            startValCode = '1';
          }
        }
      } else if (startValueType === 'variable' && startValue) {
        // 使用全局变量
        const processedStartValue = this.replaceGlobalVariables(startValue);
        const numStartValue = parseInt(processedStartValue);
        if (!isNaN(numStartValue)) {
          startVal = numStartValue;
          startValCode = String(numStartValue);
        } else {
          // 如果替换后仍然不是数字，使用默认值1
          startValCode = '1';
        }
      }
      
      // 如果没有定义循环变量名，不创建循环变量
      if (!varName) {
        return `log('开始循环，共 ${loopCount} 次');
for (let __loopIndex = 0; __loopIndex < ${loopCount}; __loopIndex++) {
  log('循环第 ' + (__loopIndex + 1) + ' 次');
  
${bodyCode.split('\n').map(line => '  ' + line).join('\n')}
}
log('循环完成');
`;
      }
      
      // 有循环变量名，创建循环变量
      return `log('开始循环，共 ${loopCount} 次');
for (let __loopIndex = 0; __loopIndex < ${loopCount}; __loopIndex++) {
  const ${varName} = __loopIndex + ${startValCode}; // 循环变量从${startValCode}开始
  log('循环第 ' + (__loopIndex + 1) + ' 次，${varName} = ' + ${varName});
  
${bodyCode.split('\n').map(line => '  ' + line).join('\n')}
}
log('循环完成');
`;
    } else if (mode === 'condition') {
      // 条件循环 - 替换全局变量
      // 注意：此方法已正确处理全局变量替换
      // 当 condition 包含 {{variableName}} 时，会自动替换为实际值
      let loopCondition = condition || 'false';
      
      // 替换全局变量
      if (loopCondition.includes('{{')) {
        loopCondition = this.replaceGlobalVariables(loopCondition);
      }
      
      // 处理循环变量的起始值
      let startVal = 1;
      let startValCode = '1';
      
      if (startValueType === 'custom' && startValue !== undefined && startValue !== '') {
        if (typeof startValue === 'number') {
          startVal = startValue;
          startValCode = String(startValue);
        } else if (typeof startValue === 'string') {
          const numStartValue = parseInt(startValue);
          if (!isNaN(numStartValue)) {
            startVal = numStartValue;
            startValCode = String(numStartValue);
          } else {
            startValCode = '1';
          }
        }
      } else if (startValueType === 'variable' && startValue) {
        const processedStartValue = this.replaceGlobalVariables(startValue);
        const numStartValue = parseInt(processedStartValue);
        if (!isNaN(numStartValue)) {
          startVal = numStartValue;
          startValCode = String(numStartValue);
        } else {
          startValCode = '1';
        }
      }
      
      if (!varName) {
        return `log('开始条件循环');
let __loopIndex = 0;
while (${loopCondition} && __loopIndex < ${maxIter}) {
  log('循环第 ' + (__loopIndex + 1) + ' 次');
  
${bodyCode.split('\n').map(line => '  ' + line).join('\n')}
  
  __loopIndex++;
}
log('循环完成，共执行 ' + __loopIndex + ' 次');
`;
      }
      
      return `log('开始条件循环');
let __loopIndex = 0;
while (${loopCondition} && __loopIndex < ${maxIter}) {
  const ${varName} = __loopIndex + ${startValCode}; // 循环变量从${startValCode}开始
  log('循环第 ' + (__loopIndex + 1) + ' 次，${varName} = ' + ${varName});
  
${bodyCode.split('\n').map(line => '  ' + line).join('\n')}
  
  __loopIndex++;
}
log('循环完成，共执行 ' + __loopIndex + ' 次');
`;
    }
    
    return `// 未知的循环模式: ${mode}\n`;
  }

  private topologicalSort(blocks: any[], connections: any[]): any[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    blocks.forEach(block => {
      graph.set(block.id, []);
      inDegree.set(block.id, 0);
    });

    connections.forEach(conn => {
      const neighbors = graph.get(conn.source) || [];
      neighbors.push(conn.target);
      graph.set(conn.source, neighbors);
      inDegree.set(conn.target, (inDegree.get(conn.target) || 0) + 1);
    });

    const queue: string[] = [];
    const result: any[] = [];

    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const id = queue.shift()!;
      const block = blocks.find(b => b.id === id);
      if (block) {
        result.push(block);
      }

      const neighbors = graph.get(id) || [];
      neighbors.forEach(neighborId => {
        const degree = inDegree.get(neighborId)! - 1;
        inDegree.set(neighborId, degree);
        if (degree === 0) {
          queue.push(neighborId);
        }
      });
    }

    blocks.forEach(block => {
      if (!result.find(b => b.id === block.id)) {
        result.push(block);
      }
    });

    return result;
  }

  private generateBlockCode(block: any, variableName?: string): string {
    switch (block.type) {
      case 'navigate':
        return this.generateNavigateCode(block);
      case 'back':
        return this.generateBackCode(block);
      case 'forward':
        return this.generateForwardCode(block);
      case 'scroll':
        return this.generateScrollCode(block, variableName);
      case 'wait':
        return this.generateWaitCode(block);
      case 'click':
        return this.generateClickCode(block, variableName);
      case 'type':
        return this.generateTypeCode(block, variableName);
      case 'extract':
        return this.generateExtractCode(block, variableName);
      case 'log':
        return this.generateLogCode(block, variableName);
      case 'loop':
        // 循环模块在 compileWithLoop 中处理，这里返回空
        return '';
      default:
        return `// 未知block类型: ${block.type}\n`;
    }
  }

  // 替换选择器中的变量
  private replaceVariables(text: string, variableName?: string): string {
    if (!text) return text;
    
    let result = text;
    
    // 1. 替换循环变量 {{variableName}} 为 ${variableName}
    if (variableName) {
      const regex = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
      result = result.replace(regex, `\${${variableName}}`);
    }
    
    // 2. 替换全局变量 {{globalVar}} 为实际值
    result = this.replaceGlobalVariables(result);
    
    return result;
  }

  // 替换全局变量（不处理循环变量）
  private replaceGlobalVariables(text: string): string {
    if (!text) return text;
    
    let result = text;
    
    Object.entries(this.globalVariables).forEach(([name, data]) => {
      const value = data.value || '';
      const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    
    return result;
  }

  private generateNavigateCode(block: any): string {
    const { url, waitUntil, timeout } = block.data;
    // 替换 URL 中的全局变量
    const processedUrl = this.replaceGlobalVariables(url);
    return `log('访问页面: ${processedUrl}');
await page.goto('${processedUrl}', { 
  waitUntil: '${waitUntil}', 
  timeout: ${timeout} 
});
`;
  }

  private generateBackCode(block: any): string {
    return `log('返回上一页');
await page.goBack();
`;
  }

  private generateForwardCode(block: any): string {
    return `log('前进下一页');
await page.goForward();
`;
  }

  private generateScrollCode(block: any, variableName?: string): string {
    const { target, selector, timeout, mode, maxScrolls, scrollDistance, delay } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    const distance = scrollDistance || 800; // 默认800像素
    
    if (target === 'element') {
      // 元素滚动 - 先等待元素出现
      const processedSelector = this.replaceVariables(selector, variableName);
      const escapedSelector = processedSelector.replace(/'/g, "\\'");
      
      // 检查选择器是否包含模板字符串变量
      const hasTemplateVar = processedSelector.includes('${');
      
      if (mode === 'smart') {
        if (hasTemplateVar) {
          // 使用模板字符串，这样 ${variableName} 会在运行时被求值
          return `log(\`等待元素出现: ${escapedSelector}\`);
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });

log(\`智能滚动元素: ${escapedSelector}\`);
await page.evaluate(async ({ sel, maxScrolls, distance, delay }) => {
  const container = document.querySelector(sel);
  if (!container) {
    throw new Error('找不到元素: ' + sel);
  }
  
  const delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  let lastScrollTop = container.scrollTop;
  let scrollAttempts = 0;
  const scrollAmount = distance || 800;
  
  while (scrollAttempts < maxScrolls) {
    // 直接滚动容器
    container.scrollBy(0, scrollAmount);
    await delayFn(delay);
    
    const newScrollTop = container.scrollTop;
    // 如果滚动位置没有变化，说明已经到底了
    if (newScrollTop === lastScrollTop) {
      console.log('已到达底部，停止滚动');
      break;
    }
    
    lastScrollTop = newScrollTop;
    scrollAttempts++;
  }
  
  console.log('滚动完成，共滚动', scrollAttempts, '次');
}, { sel: \`${escapedSelector}\`, maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
        } else {
          // 使用普通字符串
          return `log('等待元素出现: ${escapedSelector}');
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });

log('智能滚动元素: ${escapedSelector}');
await page.evaluate(async ({ sel, maxScrolls, distance, delay }) => {
  const container = document.querySelector(sel);
  if (!container) {
    throw new Error('找不到元素: ' + sel);
  }
  
  const delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  let lastScrollTop = container.scrollTop;
  let scrollAttempts = 0;
  const scrollAmount = distance || 800;
  
  while (scrollAttempts < maxScrolls) {
    // 直接滚动容器
    container.scrollBy(0, scrollAmount);
    await delayFn(delay);
    
    const newScrollTop = container.scrollTop;
    // 如果滚动位置没有变化，说明已经到底了
    if (newScrollTop === lastScrollTop) {
      console.log('已到达底部，停止滚动');
      break;
    }
    
    lastScrollTop = newScrollTop;
    scrollAttempts++;
  }
  
  console.log('滚动完成，共滚动', scrollAttempts, '次');
}, { sel: \`${escapedSelector}\`, maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
        }
      } else {
        if (hasTemplateVar) {
          // 使用模板字符串，这样 ${variableName} 会在运行时被求值
          return `log(\`等待元素出现: ${escapedSelector}\`);
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });

log(\`滚动元素 ${maxScrolls} 次: ${escapedSelector}\`);
await page.evaluate(async ({ sel, maxScrolls, distance, delay }) => {
  const container = document.querySelector(sel);
  if (!container) {
    throw new Error('找不到元素: ' + sel);
  }
  
  const delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const scrollAmount = distance || 800;
  
  // 直接滚动容器指定次数
  for (let i = 0; i < maxScrolls; i++) {
    container.scrollBy(0, scrollAmount);
    await delayFn(delay);
  }
  
  console.log('滚动完成，共滚动', maxScrolls, '次');
}, { sel: \`${escapedSelector}\`, maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
        } else {
          // 使用普通字符串
          return `log('等待元素出现: ${escapedSelector}');
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });

log('滚动元素 ${maxScrolls} 次: ${escapedSelector}');
await page.evaluate(async ({ sel, maxScrolls, distance, delay }) => {
  const container = document.querySelector(sel);
  if (!container) {
    throw new Error('找不到元素: ' + sel);
  }
  
  const delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const scrollAmount = distance || 800;
  
  // 直接滚动容器指定次数
  for (let i = 0; i < maxScrolls; i++) {
    container.scrollBy(0, scrollAmount);
    await delayFn(delay);
  }
  
  console.log('滚动完成，共滚动', maxScrolls, '次');
}, { sel: \`${escapedSelector}\`, maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
        }
      }
    } else {
      // 页面滚动 - 不涉及选择器，不需要修改
      if (mode === 'smart') {
        return `log('智能滚动页面');
await page.evaluate(async ({ maxScrolls, distance, delay }) => {
  const delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  let lastHeight = document.body.scrollHeight;
  let scrollAttempts = 0;
  const scrollAmount = distance || 800;
  
  while (scrollAttempts < maxScrolls) {
    window.scrollBy(0, scrollAmount);
    await delayFn(delay);
    
    const newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight) {
      break;
    }
    
    lastHeight = newHeight;
    scrollAttempts++;
  }
}, { maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
      } else {
        return `log('滚动页面 ${maxScrolls} 次');
await page.evaluate(async ({ maxScrolls, distance, delay }) => {
  const delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const scrollAmount = distance || 800;
  
  for (let i = 0; i < maxScrolls; i++) {
    window.scrollBy(0, scrollAmount);
    await delayFn(delay);
  }
}, { maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
      }
    }
  }

  private generateWaitCode(block: any): string {
    const { duration } = block.data;
    return `log('【等待模块】等待 ${duration}ms');
await page.waitForTimeout(${duration});
log('【等待模块】等待完成');
`;
  }

  private generateClickCode(block: any, variableName?: string): string {
    const { selector, waitForElement, timeout } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    const processedSelector = this.replaceVariables(selector, variableName);
    const escapedSelector = processedSelector.replace(/'/g, "\\'");
    
    // 检查选择器是否包含模板字符串变量
    const hasTemplateVar = processedSelector.includes('${');
    
    if (waitForElement) {
      if (hasTemplateVar) {
        // 使用模板字符串，这样 ${variableName} 会在运行时被求值
        return `log(\`等待并点击元素: ${escapedSelector}\`);
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });
await page.click(\`${escapedSelector}\`);
`;
      } else {
        // 使用普通字符串
        return `log('等待并点击元素: ${escapedSelector}');
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });
await page.click(\`${escapedSelector}\`);
`;
      }
    } else {
      if (hasTemplateVar) {
        // 使用模板字符串，这样 ${variableName} 会在运行时被求值
        return `log(\`点击元素: ${escapedSelector}\`);
await page.click(\`${escapedSelector}\`);
`;
      } else {
        // 使用普通字符串
        return `log('点击元素: ${escapedSelector}');
await page.click(\`${escapedSelector}\`);
`;
      }
    }
  }

  private generateTypeCode(block: any, variableName?: string): string {
    const { selector, text, delay, timeout } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    const processedSelector = this.replaceVariables(selector, variableName);
    const escapedSelector = processedSelector.replace(/'/g, "\\'");
    // 替换文本中的全局变量
    const processedText = this.replaceGlobalVariables(text);
    const escapedText = processedText.replace(/'/g, "\\'");
    
    // 检查选择器是否包含模板字符串变量
    const hasTemplateVar = processedSelector.includes('${');
    
    if (hasTemplateVar) {
      // 使用模板字符串，这样 ${variableName} 会在运行时被求值
      return `log(\`等待元素出现: ${escapedSelector}\`);
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });

log(\`输入文本到: ${escapedSelector}\`);
await page.type(\`${escapedSelector}\`, '${escapedText}', { delay: ${delay} });
`;
    } else {
      // 使用普通字符串
      return `log('等待元素出现: ${escapedSelector}');
await page.waitForSelector(\`${escapedSelector}\`, { timeout: ${timeoutValue} });

log('输入文本到: ${escapedSelector}');
await page.type(\`${escapedSelector}\`, '${escapedText}', { delay: ${delay} });
`;
    }
  }



  private generateExtractCode(block: any, variableName?: string): string {
    const { extractions, multiple, timeout, saveToTable } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    
    // 如果没有配置提取项，返回空代码
    if (!extractions || extractions.length === 0) {
      return `log('提取数据: 未配置提取项');
`;
    }

    // 过滤掉没有选择器的提取项
    const validExtractions = extractions.filter((e: any) => e.selector);
    
    if (validExtractions.length === 0) {
      return `log('提取数据: 未配置有效的提取项');
`;
    }

    let code = '';
    
    // 生成提取配置
    const extractionsConfig = validExtractions.map((extraction: any, idx: number) => {
      const attr = extraction.attribute === 'data-*' ? extraction.customAttribute : extraction.attribute;
      // 手动转义：只转义单引号，保持反斜杠不变
      const processedSelector = this.replaceVariables(extraction.selector, variableName);
      const escapedSelector = processedSelector.replace(/'/g, "\\'");
      const escapedAttr = attr.replace(/'/g, "\\'");
      const escapedColumn = (extraction.saveToColumn || '').replace(/'/g, "\\'");
      // 只有当 attribute 是 'data-*' 时才输出 customAttribute 的值，否则为空字符串
      const escapedCustomAttr = extraction.attribute === 'data-*' 
        ? (extraction.customAttribute || '').replace(/'/g, "\\'")
        : '';
      return `{
    selector: \`${escapedSelector}\`,
    attribute: '${escapedAttr}',
    customAttribute: '${escapedCustomAttr}',
    saveToColumn: '${escapedColumn}'
  }`;
    }).join(',\n  ');

    const firstProcessedSelector = this.replaceVariables(validExtractions[0].selector, variableName);
    const firstEscapedSelector = firstProcessedSelector.replace(/'/g, "\\'");
    
    // 检查第一个选择器是否包含模板字符串变量
    const hasTemplateVar = firstProcessedSelector.includes('${');

    code += `log('开始提取数据，共 ${validExtractions.length} 个提取项');

// 等待第一个提取项的所有元素加载完成
try {
  const firstSelector = \`${firstEscapedSelector}\`;
  ${hasTemplateVar 
    ? `log(\`等待目标元素加载: \${firstSelector}\`);` 
    : `log('等待目标元素加载: ' + firstSelector);`}
  
  // 等待至少一个元素出现
  await page.waitForSelector(firstSelector, { timeout: ${timeoutValue}, state: 'attached' });
  
  // 如果是多元素提取，等待元素数量稳定
  if (${multiple}) {
    let lastCount = 0;
    let stableCount = 0;
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentCount = await page.locator(firstSelector).count();
      
      if (currentCount === lastCount && currentCount > 0) {
        stableCount++;
        if (stableCount >= 2) {
          log('元素数量已稳定: ' + currentCount + ' 个');
          break;
        }
      } else {
        stableCount = 0;
      }
      
      lastCount = currentCount;
      await page.waitForTimeout(300);
    }
  }
  
  log('目标元素已就绪，开始提取');
} catch (e) {
  log('警告: 等待目标元素超时 - ' + e.message);
}

// 提取所有数据
const extractedData = await page.evaluate(({ extractions, multiple }) => {
  // 获取第一个提取项的元素数量，作为基准
  const firstElements = multiple 
    ? document.querySelectorAll(extractions[0].selector)
    : [document.querySelector(extractions[0].selector)];
  
  const elementCount = firstElements.length;
  const results = [];
  
  // 对每个元素索引
  for (let i = 0; i < elementCount; i++) {
    const rowData = {
      index: i + 1
    };
    
    // 提取每个配置项的数据
    extractions.forEach((config, configIdx) => {
      const elements = multiple 
        ? document.querySelectorAll(config.selector)
        : [document.querySelector(config.selector)];
      
      const el = elements[i];
      let value = null;
      
      if (el) {
        if (config.attribute === 'text') {
          value = el.textContent ? el.textContent.trim() : '';
        } else if (config.attribute === 'innerText') {
          value = el.innerText ? el.innerText.trim() : '';
        } else if (config.attribute === 'innerHTML') {
          value = el.innerHTML;
        } else {
          value = el.getAttribute(config.attribute);
        }
      }
      
      rowData['field_' + configIdx] = value;
      rowData['column_' + configIdx] = config.saveToColumn;
    });
    
    results.push(rowData);
  }
  
  return results;
}, { 
  extractions: [
    ${extractionsConfig}
  ],
  multiple: ${multiple}
});

`;

    // 如果配置了保存到数据表
    if (saveToTable) {
      code += `// 保存到数据表
saveDataImmediately({
  type: 'data',
  tableId: '${saveToTable}',
  rows: extractedData.map(row => {
    const rowData = {};
    ${validExtractions.map((extraction: any, idx: number) => {
      if (extraction.saveToColumn) {
        return `rowData['${extraction.saveToColumn}'] = row.field_${idx};`;
      }
      return '';
    }).filter(Boolean).join('\n    ')}
    return rowData;
  })
});

log('提取完成，共获得 ' + extractedData.length + ' 行数据');
`;
    } else {
      code += `// 保存提取的数据（未配置数据表）
extractedResults.data.push(...extractedData);
log('提取完成，共获得 ' + extractedData.length + ' 条数据');
`;
    }

    return code;
  }

  private generateLogCode(block: any, variableName?: string): string {
    const { message } = block.data;
    // 先替换循环变量，再替换全局变量
    const processedMessage = this.replaceVariables(message, variableName);
    
    // 检查是否包含模板字符串变量（如 ${index}）
    // 注意：此方法已正确处理模板字符串
    // 当消息包含 ${variableName} 时，会使用模板字符串语法以便运行时求值
    const hasTemplateVar = processedMessage.includes('${');
    
    if (hasTemplateVar) {
      // 使用模板字符串，这样 ${variableName} 会在运行时被求值
      const escapedMessage = processedMessage.replace(/'/g, "\\'");
      return `logUser(\`${escapedMessage}\`);
`;
    } else {
      // 使用普通字符串
      const escapedMessage = processedMessage.replace(/'/g, "\\'");
      return `logUser('${escapedMessage}');
`;
    }
  }

  private assembleCode(fragments: string[]): string {
    const header = `// 自动生成的Playwright脚本
// 生成时间: ${new Date().toLocaleString()}

// 用于存储提取的数据
const extractedResults = {
  images: [],
  data: [],
  links: []
};

`;

    const body = fragments.join('\n');

    const footer = `
// 返回统一数据格式
return {
  success: true,
  dataType: 'workflow',
  url: page.url(),
  timestamp: Date.now(),
  count: extractedResults.images.length + extractedResults.data.length + extractedResults.links.length,
  results: extractedResults
};
`;

    return header + body + footer;
  }
}
