import * as acorn from 'acorn';

export class ScriptParser {
  parse(code: string): any {
    try {
      const blocks: any[] = [];
      const connections: any[] = [];
      let xPosition = 100; // 改为水平位置

      // 检查是否包含循环
      const hasLoop = /log\('开始循环，共 (\d+) 次'\);|log\('开始条件循环'\);/.test(code);
      
      if (hasLoop) {
        // 解析包含循环的代码
        return this.parseWithLoop(code);
      }

      // 使用正则表达式和代码模式匹配来解析
      // 这比AST解析更适合我们生成的特定格式的代码

      // 1. 解析 navigate (访问页面)
      const navigatePattern = /await page\.goto\('([^']+)',\s*\{[^}]*waitUntil:\s*'([^']+)'[^}]*timeout:\s*(\d+)[^}]*\}\);/g;
      let match;
      while ((match = navigatePattern.exec(code)) !== null) {
        blocks.push(this.createNavigateBlock(match[1], match[2], parseInt(match[3]), xPosition));
        xPosition += 250; // 水平间距
      }

      // 2. 解析 waitForSelector + click (点击元素)
      const clickPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
      while ((match = clickPattern.exec(code)) !== null) {
        blocks.push(this.createClickBlock(match[1], parseInt(match[2]), xPosition));
        xPosition += 250;
      }

      // 3. 解析 waitForTimeout (等待)
      const waitPattern = /await page\.waitForTimeout\((\d+)\);/g;
      while ((match = waitPattern.exec(code)) !== null) {
        blocks.push(this.createWaitBlock(parseInt(match[1]), xPosition));
        xPosition += 250;
      }

      // 4. 解析 scroll (滚动) - 分别匹配页面滚动和元素滚动
      
      // 4a. 元素滚动 - 有 waitForSelector 和 log
      const elementScrollPattern = /log\('等待元素出现:\s*([^']+)'\);[\s\S]*?await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?log\('滚动元素\s+(\d+)\s+次:\s*([^']+)'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = elementScrollPattern.exec(code)) !== null) {
        const selector = match[2];
        const timeout = parseInt(match[3]);
        const maxScrolls = parseInt(match[7]);
        const distance = parseInt(match[8]);
        const delay = parseInt(match[9]);
        
        blocks.push(this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, xPosition));
        xPosition += 250;
      }

      // 4b. 页面滚动 - 没有 waitForSelector
      const pageScrollPattern = /log\('滚动页面\s+(\d+)\s+次'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = pageScrollPattern.exec(code)) !== null) {
        const maxScrolls = parseInt(match[2]);
        const distance = parseInt(match[3]);
        const delay = parseInt(match[4]);
        
        blocks.push(this.createScrollBlock('page', '', 5000, maxScrolls, distance, delay, xPosition));
        xPosition += 250;
      }

      // 5. 解析 extract (提取数据) - 匹配新的多提取项格式
      const extractPattern = /log\('开始提取数据，共 (\d+) 个提取项'\);[\s\S]*?const extractedData = await page\.evaluate\(\(\{ extractions, multiple \}\)[^{]*\{[\s\S]*?\}, \{\s*extractions:\s*\[([\s\S]*?)\],\s*multiple:\s*(true|false)\s*\}\);[\s\S]*?_table:\s*'([^']+)'[\s\S]*?_rowData:\s*\{([\s\S]*?)\}/g;
      while ((match = extractPattern.exec(code)) !== null) {
        const extractionCount = parseInt(match[1]);
        const extractionsStr = match[2];
        const multiple = match[3] === 'true';
        const saveToTable = match[4];
        const rowDataStr = match[5];

        // 解析 extractions 数组
        const extractions = this.parseExtractions(extractionsStr);
        
        blocks.push(this.createExtractBlock(extractions, multiple, saveToTable, xPosition));
        xPosition += 250;
      }

      // 6. 解析 extract-images (提取图片)
      const extractImagesPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*log\('提取图片'\);[\s\S]*?const images = await page\.evaluate[\s\S]*?attrs:\s*\[([^\]]+)\][^}]*filter:\s*(true|false)[^}]*\}\);/g;
      while ((match = extractImagesPattern.exec(code)) !== null) {
        const selector = match[1];
        const timeout = parseInt(match[2]);
        const attrsStr = match[3];
        const filterInvalid = match[4] === 'true';
        
        const attributes = attrsStr.split(',').map(s => s.trim().replace(/'/g, ''));
        
        blocks.push(this.createExtractImagesBlock(selector, timeout, attributes, filterInvalid, xPosition));
        xPosition += 250;
      }

      // 创建顺序连接
      for (let i = 0; i < blocks.length - 1; i++) {
        connections.push({
          id: `conn-${i}`,
          source: blocks[i].id,
          sourceHandle: 'source-right', // 使用新的 handle ID
          target: blocks[i + 1].id,
          targetHandle: 'target-left' // 使用新的 handle ID
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

  private parseWithLoop(code: string): any {
    const blocks: any[] = [];
    const connections: any[] = [];
    let xPosition = 100;

    // 解析循环模块
    let loopMode = 'count';
    let loopCount = 10;
    let loopCondition = '';
    let maxIterations = 1000;

    // 匹配固定次数循环 - 更宽松的匹配
    const countLoopPattern = /log\('开始循环，共 (\d+) 次'\);[\s\S]*?for \(let __loopIndex = 0; __loopIndex < (\d+); __loopIndex\+\+\) \{([\s\S]*?)\n\}[\s\S]*?log\('循环完成'\);/;
    const countMatch = countLoopPattern.exec(code);
    
    // 匹配条件循环
    const conditionLoopPattern = /log\('开始条件循环'\);[\s\S]*?let __loopIndex = 0;[\s\S]*?while \((.+?) && __loopIndex < (\d+)\) \{([\s\S]*?)__loopIndex\+\+;[\s\S]*?\n\}[\s\S]*?log\('循环完成，共执行 ' \+ __loopIndex \+ ' 次'\);/;
    const conditionMatch = conditionLoopPattern.exec(code);

    let loopBodyCode = '';
    let beforeLoopCode = '';
    
    if (countMatch) {
      loopMode = 'count';
      loopCount = parseInt(countMatch[2]);
      loopBodyCode = countMatch[3];
      // 提取循环之前的代码
      beforeLoopCode = code.substring(0, countMatch.index);
      console.log('解析到固定次数循环，循环体代码长度:', loopBodyCode.length);
    } else if (conditionMatch) {
      loopMode = 'condition';
      loopCondition = conditionMatch[1];
      maxIterations = parseInt(conditionMatch[2]);
      loopBodyCode = conditionMatch[3];
      // 提取循环之前的代码
      beforeLoopCode = code.substring(0, conditionMatch.index);
      console.log('解析到条件循环，循环体代码长度:', loopBodyCode.length);
    } else {
      console.log('未能匹配到循环模式');
    }

    // 解析循环之前的模块
    if (beforeLoopCode) {
      const beforeBlocks = this.parseNormalBlocks(beforeLoopCode, xPosition);
      console.log('解析到循环前模块数量:', beforeBlocks.length);
      blocks.push(...beforeBlocks);
      xPosition += beforeBlocks.length * 250;
    }

    // 创建循环模块
    const loopBlock = {
      id: `block-loop-${Date.now()}`,
      type: 'loop',
      label: '循环',
      category: 'logic',
      position: { x: xPosition + 250, y: 200 },
      data: {
        mode: loopMode,
        count: loopCount,
        condition: loopCondition,
        maxIterations: maxIterations
      },
      inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
      outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
    };

    // 解析循环体内的模块
    let bodyBlocks: any[] = [];
    if (loopBodyCode) {
      bodyBlocks = this.parseLoopBody(loopBodyCode, xPosition);
      console.log('解析到循环体内模块数量:', bodyBlocks.length);
    }

    // 组装所有模块
    // 1. 循环前的模块
    // 2. 循环体内的模块
    // 3. 循环模块

    // 如果有循环前的模块，创建它们之间的连接
    if (blocks.length > 0) {
      for (let i = 0; i < blocks.length - 1; i++) {
        connections.push({
          id: `conn-before-${i}`,
          source: blocks[i].id,
          sourceHandle: 'source-right',
          target: blocks[i + 1].id,
          targetHandle: 'target-left'
        });
      }
    }

    // 添加循环体内的模块
    blocks.push(...bodyBlocks);
    
    // 添加循环模块
    blocks.push(loopBlock);

    // 创建循环相关的连接
    if (bodyBlocks.length > 0) {
      // 如果有循环前的模块，最后一个循环前模块连接到第一个循环体模块
      if (blocks.length > bodyBlocks.length + 1) {
        const lastBeforeLoopBlock = blocks[blocks.length - bodyBlocks.length - 2];
        connections.push({
          id: 'conn-to-loop-body',
          source: lastBeforeLoopBlock.id,
          sourceHandle: 'source-right',
          target: bodyBlocks[0].id,
          targetHandle: 'target-left'
        });
      }

      // 循环模块的 loop-start 连接到第一个循环体模块
      connections.push({
        id: 'conn-loop-start',
        source: loopBlock.id,
        sourceHandle: 'loop-start',
        target: bodyBlocks[0].id,
        targetHandle: 'target-left'
      });

      // 循环体内模块之间的连接
      for (let i = 0; i < bodyBlocks.length - 1; i++) {
        connections.push({
          id: `conn-body-${i}`,
          source: bodyBlocks[i].id,
          sourceHandle: 'source-right',
          target: bodyBlocks[i + 1].id,
          targetHandle: 'target-left'
        });
      }

      // 最后一个循环体模块连接回循环模块
      connections.push({
        id: 'conn-loop-end',
        source: bodyBlocks[bodyBlocks.length - 1].id,
        sourceHandle: 'source-right',
        target: loopBlock.id,
        targetHandle: 'loop-end'
      });
    }

    return {
      id: Date.now().toString(),
      name: '解析的循环工作流',
      description: '',
      blocks,
      connections,
      variables: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  private parseNormalBlocks(code: string, startX: number): any[] {
    const blocks: any[] = [];
    let xPosition = startX;

    // 解析各种模块（复用现有的解析逻辑）
    // 1. 解析 navigate
    const navigatePattern = /await page\.goto\('([^']+)',\s*\{[^}]*waitUntil:\s*'([^']+)'[^}]*timeout:\s*(\d+)[^}]*\}\);/g;
    let match;
    while ((match = navigatePattern.exec(code)) !== null) {
      blocks.push(this.createNavigateBlock(match[1], match[2], parseInt(match[3]), xPosition));
      xPosition += 250;
    }

    // 2. 解析 wait
    const waitPattern = /await page\.waitForTimeout\((\d+)\);/g;
    while ((match = waitPattern.exec(code)) !== null) {
      blocks.push(this.createWaitBlock(parseInt(match[1]), xPosition));
      xPosition += 250;
    }

    // 3. 解析 click
    const clickPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
    while ((match = clickPattern.exec(code)) !== null) {
      blocks.push(this.createClickBlock(match[1], parseInt(match[2]), xPosition));
      xPosition += 250;
    }

    // 4. 解析 scroll - 元素滚动
    const elementScrollPattern = /await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    while ((match = elementScrollPattern.exec(code)) !== null) {
      const selector = match[1];
      const timeout = parseInt(match[2]);
      const maxScrolls = parseInt(match[4]);
      const distance = parseInt(match[5]);
      const delay = parseInt(match[6]);
      
      blocks.push(this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, xPosition));
      xPosition += 250;
    }

    return blocks;
  }

  private parseLoopBody(bodyCode: string, startX: number): any[] {
    const blocks: any[] = [];
    let xPosition = startX;

    console.log('开始解析循环体，代码片段:', bodyCode.substring(0, 200));

    // 解析循环体内的各种模块
    // 1. 解析 navigate
    const navigatePattern = /await page\.goto\('([^']+)',\s*\{[^}]*waitUntil:\s*'([^']+)'[^}]*timeout:\s*(\d+)[^}]*\}\);/g;
    let match;
    let navigateCount = 0;
    while ((match = navigatePattern.exec(bodyCode)) !== null) {
      blocks.push(this.createNavigateBlock(match[1], match[2], parseInt(match[3]), xPosition));
      xPosition += 250;
      navigateCount++;
    }
    console.log('解析到 navigate 模块:', navigateCount);

    // 2. 解析 wait
    const waitPattern = /await page\.waitForTimeout\((\d+)\);/g;
    let waitCount = 0;
    while ((match = waitPattern.exec(bodyCode)) !== null) {
      blocks.push(this.createWaitBlock(parseInt(match[1]), xPosition));
      xPosition += 250;
      waitCount++;
    }
    console.log('解析到 wait 模块:', waitCount);

    // 3. 解析 click
    const clickPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
    let clickCount = 0;
    while ((match = clickPattern.exec(bodyCode)) !== null) {
      blocks.push(this.createClickBlock(match[1], parseInt(match[2]), xPosition));
      xPosition += 250;
      clickCount++;
    }
    console.log('解析到 click 模块:', clickCount);

    // 4. 解析 scroll - 元素滚动（简化正则）
    const elementScrollPattern = /await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    let scrollCount = 0;
    while ((match = elementScrollPattern.exec(bodyCode)) !== null) {
      const selector = match[1];
      const timeout = parseInt(match[2]);
      const maxScrolls = parseInt(match[4]);
      const distance = parseInt(match[5]);
      const delay = parseInt(match[6]);
      
      blocks.push(this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, xPosition));
      xPosition += 250;
      scrollCount++;
    }
    console.log('解析到 scroll 模块:', scrollCount);

    // 5. 解析 log（排除系统日志）
    const logPattern = /^\s*log\('(?!循环第|等待元素|滚动)([^']+)'\);/gm;
    let logCount = 0;
    while ((match = logPattern.exec(bodyCode)) !== null) {
      blocks.push(this.createLogBlock(match[1], xPosition));
      xPosition += 250;
      logCount++;
    }
    console.log('解析到 log 模块:', logCount);

    console.log('循环体解析完成，总模块数:', blocks.length);
    return blocks;
  }

  private createLogBlock(message: string, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'log',
      label: '日志输出',
      category: 'logic',
      position: { x: xPosition, y: 200 },
      data: {
        message
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private parseExtractions(extractionsStr: string): any[] {
    const extractions: any[] = [];
    
    // 匹配每个提取项对象
    const extractionPattern = /\{\s*selector:\s*'([^']+)',\s*attribute:\s*'([^']+)',\s*saveToColumn:\s*'([^']*)'\s*\}/g;
    let match;
    
    while ((match = extractionPattern.exec(extractionsStr)) !== null) {
      extractions.push({
        selector: match[1],
        attribute: match[2],
        customAttribute: '',
        saveToColumn: match[3]
      });
    }
    
    return extractions;
  }

  private createNavigateBlock(url: string, waitUntil: string, timeout: number, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'navigate',
      label: '访问页面',
      category: 'browser',
      position: { x: xPosition, y: 200 }, // 水平布局
      data: {
        url,
        waitUntil,
        timeout
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createWaitBlock(duration: number, xPosition: number): any {
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

  private createClickBlock(selector: string, timeout: number, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'click',
      label: '点击元素',
      category: 'interaction',
      position: { x: xPosition, y: 200 },
      data: {
        selector,
        waitForElement: true,
        timeout
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createScrollBlock(target: string, selector: string, timeout: number, maxScrolls: number, distance: number, delay: number, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'scroll',
      label: '滚动页面',
      category: 'browser',
      position: { x: xPosition, y: 200 },
      data: {
        target,
        selector,
        timeout,
        mode: 'fixed',
        maxScrolls,
        scrollDistance: distance,
        delay
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createExtractBlock(extractions: any[], multiple: boolean, saveToTable: string, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'extract',
      label: '提取数据',
      category: 'extraction',
      position: { x: xPosition, y: 200 },
      data: {
        extractions,
        multiple,
        timeout: 5000,
        saveToTable
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [
        { id: 'out', name: '输出', type: 'flow' },
        { id: 'data', name: '数据', type: 'data' }
      ]
    };
  }

  private createExtractImagesBlock(selector: string, timeout: number, attributes: string[], filterInvalid: boolean, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'extract-images',
      label: '提取图片',
      category: 'extraction',
      position: { x: xPosition, y: 200 },
      data: {
        selector,
        timeout,
        attributes,
        filterInvalid,
        saveToTable: '',
        saveToColumn: ''
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [
        { id: 'out', name: '输出', type: 'flow' },
        { id: 'data', name: '图片列表', type: 'data' }
      ]
    };
  }
}
