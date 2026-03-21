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

      // 创建一个数组来存储所有匹配项及其位置
      const matches: Array<{ index: number; block: any }> = [];

      // 1. 解析 navigate (访问页面)
      const navigatePattern = /await page\.goto\('([^']+)',\s*\{[^}]*waitUntil:\s*'([^']+)'[^}]*timeout:\s*(\d+)[^}]*\}\);/g;
      let match;
      while ((match = navigatePattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createNavigateBlock(match[1], match[2], parseInt(match[3]), 0)
        });
      }

      // 1b. 解析 back (返回)
      const backPattern = /await page\.goBack\(\);/g;
      while ((match = backPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createBackBlock(0)
        });
      }

      // 1c. 解析 forward (前进)
      const forwardPattern = /await page\.goForward\(\);/g;
      while ((match = forwardPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createForwardBlock(0)
        });
      }

      // 2. 解析 waitForSelector + click (点击元素)
      const clickPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
      while ((match = clickPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createClickBlock(match[1], parseInt(match[2]), 0)
        });
      }

      // 3. 解析 waitForTimeout (等待)
      const waitPattern = /await page\.waitForTimeout\((\d+)\);/g;
      while ((match = waitPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createWaitBlock(parseInt(match[1]), 0)
        });
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
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0)
        });
      }

      // 4b. 页面滚动 - 没有 waitForSelector
      const pageScrollPattern = /log\('滚动页面\s+(\d+)\s+次'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = pageScrollPattern.exec(code)) !== null) {
        const maxScrolls = parseInt(match[2]);
        const distance = parseInt(match[3]);
        const delay = parseInt(match[4]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('page', '', 5000, maxScrolls, distance, delay, 0)
        });
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
        
        matches.push({
          index: match.index,
          block: this.createExtractBlock(extractions, multiple, saveToTable, 0)
        });
      }

      // 6. 解析 extract-images (提取图片)
      const extractImagesPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*log\('提取图片'\);[\s\S]*?const images = await page\.evaluate[\s\S]*?attrs:\s*\[([^\]]+)\][^}]*filter:\s*(true|false)[^}]*\}\);/g;
      while ((match = extractImagesPattern.exec(code)) !== null) {
        const selector = match[1];
        const timeout = parseInt(match[2]);
        const attrsStr = match[3];
        const filterInvalid = match[4] === 'true';
        
        const attributes = attrsStr.split(',').map(s => s.trim().replace(/'/g, ''));
        
        matches.push({
          index: match.index,
          block: this.createExtractImagesBlock(selector, timeout, attributes, filterInvalid, 0)
        });
      }

      // 7. 解析 logUser（用户日志）
      const logUserPattern = /logUser\('([^']+)'\);/g;
      while ((match = logUserPattern.exec(code)) !== null) {
        const message = match[1].replace(/\\'/g, "'"); // 反转义单引号
        matches.push({
          index: match.index,
          block: this.createLogBlock(message, 0)
        });
      }

      // 按照代码中的位置排序
      matches.sort((a, b) => a.index - b.index);

      // 设置正确的 x 位置并添加到 blocks 数组
      matches.forEach((item, idx) => {
        item.block.position.x = 100 + idx * 250;
        blocks.push(item.block);
      });

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

    // 查找所有循环（支持多个循环）
    const loopMatches: Array<{
      mode: string;
      count?: number;
      condition?: string;
      maxIterations?: number;
      bodyCode: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    // 匹配所有固定次数循环
    const countLoopPattern = /log\('开始循环，共 (\d+) 次'\);[\s\S]*?for \(let __loopIndex = 0; __loopIndex < (\d+); __loopIndex\+\+\) \{([\s\S]*?)\n\}[\s\S]*?log\('循环完成'\);/g;
    let match;
    while ((match = countLoopPattern.exec(code)) !== null) {
      loopMatches.push({
        mode: 'count',
        count: parseInt(match[2]),
        bodyCode: match[3],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // 匹配所有条件循环
    const conditionLoopPattern = /log\('开始条件循环'\);[\s\S]*?let __loopIndex = 0;[\s\S]*?while \((.+?) && __loopIndex < (\d+)\) \{([\s\S]*?)__loopIndex\+\+;[\s\S]*?\n\}[\s\S]*?log\('循环完成，共执行 ' \+ __loopIndex \+ ' 次'\);/g;
    while ((match = conditionLoopPattern.exec(code)) !== null) {
      loopMatches.push({
        mode: 'condition',
        condition: match[1],
        maxIterations: parseInt(match[2]),
        bodyCode: match[3],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // 按照出现顺序排序
    loopMatches.sort((a, b) => a.startIndex - b.startIndex);

    // 如果没有找到循环，返回空
    if (loopMatches.length === 0) {
      return {
        id: Date.now().toString(),
        name: '解析的工作流',
        description: '',
        blocks: [],
        connections: [],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    // 提取代码段：循环前、循环体、循环间、循环后
    const codeSegments: Array<{ type: 'code' | 'loop'; content: string; loopInfo?: any }> = [];
    let lastIndex = 0;

    loopMatches.forEach((loopMatch, idx) => {
      // 添加循环前的代码
      if (loopMatch.startIndex > lastIndex) {
        codeSegments.push({
          type: 'code',
          content: code.substring(lastIndex, loopMatch.startIndex)
        });
      }

      // 添加循环
      codeSegments.push({
        type: 'loop',
        content: loopMatch.bodyCode,
        loopInfo: loopMatch
      });

      lastIndex = loopMatch.endIndex;
    });

    // 添加最后一个循环后的代码
    if (lastIndex < code.length) {
      const afterCode = code.substring(lastIndex);
      if (afterCode.trim() && !afterCode.trim().startsWith('// 返回统一数据格式')) {
        codeSegments.push({
          type: 'code',
          content: afterCode
        });
      }
    }

    // 解析每个代码段
    const allBlockGroups: Array<{ blocks: any[]; type: 'code' | 'loop'; loopInfo?: any }> = [];

    codeSegments.forEach(segment => {
      if (segment.type === 'code') {
        const parsed = this.parseNormalBlocks(segment.content, xPosition);
        if (parsed.length > 0) {
          allBlockGroups.push({ blocks: parsed, type: 'code' });
          xPosition += parsed.length * 250;
        }
      } else if (segment.type === 'loop') {
        // 解析循环体
        const bodyBlocks = this.parseLoopBody(segment.content, xPosition);
        xPosition += bodyBlocks.length * 250;

        // 创建循环模块
        const loopBlock = {
          id: `block-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'loop',
          label: '循环',
          category: 'logic',
          position: { x: xPosition, y: 350 },
          data: {
            mode: segment.loopInfo.mode,
            count: segment.loopInfo.count || 10,
            condition: segment.loopInfo.condition || '',
            maxIterations: segment.loopInfo.maxIterations || 1000
          },
          inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
          outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
        };

        allBlockGroups.push({
          blocks: [...bodyBlocks, loopBlock],
          type: 'loop',
          loopInfo: { bodyBlocks, loopBlock }
        });

        xPosition += 250;
      }
    });

    // 组装所有模块和连接
    allBlockGroups.forEach((group, groupIdx) => {
      blocks.push(...group.blocks);

      if (group.type === 'code') {
        // 普通代码块之间的连接
        for (let i = 0; i < group.blocks.length - 1; i++) {
          connections.push({
            id: `conn-group${groupIdx}-${i}`,
            source: group.blocks[i].id,
            sourceHandle: 'source-right',
            target: group.blocks[i + 1].id,
            targetHandle: 'target-left'
          });
        }
      } else if (group.type === 'loop' && group.loopInfo) {
        const { bodyBlocks, loopBlock } = group.loopInfo;

        // 循环体内模块之间的连接
        for (let i = 0; i < bodyBlocks.length - 1; i++) {
          connections.push({
            id: `conn-loop-body-${groupIdx}-${i}`,
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
            id: `conn-loop-start-${groupIdx}`,
            source: loopBlock.id,
            sourceHandle: 'loop-start',
            target: bodyBlocks[0].id,
            targetHandle: 'target-left'
          });

          // 最后一个循环体模块 -> loop-end
          connections.push({
            id: `conn-loop-end-${groupIdx}`,
            source: bodyBlocks[bodyBlocks.length - 1].id,
            sourceHandle: 'source-right',
            target: loopBlock.id,
            targetHandle: 'loop-end'
          });
        }
      }

      // 连接不同组之间的模块
      if (groupIdx > 0) {
        const prevGroup = allBlockGroups[groupIdx - 1];
        const currentGroup = group;

        let prevLastBlock;
        if (prevGroup.type === 'code') {
          prevLastBlock = prevGroup.blocks[prevGroup.blocks.length - 1];
        } else if (prevGroup.type === 'loop' && prevGroup.loopInfo) {
          // 从循环体的最后一个模块连接到下一组
          prevLastBlock = prevGroup.loopInfo.bodyBlocks[prevGroup.loopInfo.bodyBlocks.length - 1];
        }

        let currentFirstBlock;
        if (currentGroup.type === 'code') {
          currentFirstBlock = currentGroup.blocks[0];
        } else if (currentGroup.type === 'loop' && currentGroup.loopInfo) {
          currentFirstBlock = currentGroup.loopInfo.bodyBlocks[0];
        }

        if (prevLastBlock && currentFirstBlock) {
          connections.push({
            id: `conn-between-groups-${groupIdx}`,
            source: prevLastBlock.id,
            sourceHandle: 'source-right',
            target: currentFirstBlock.id,
            targetHandle: 'target-left'
          });
        }
      }
    });

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

    // 1b. 解析 back (返回)
    const backPattern = /await page\.goBack\(\);/g;
    while ((match = backPattern.exec(code)) !== null) {
      blocks.push(this.createBackBlock(xPosition));
      xPosition += 250;
    }

    // 1c. 解析 forward (前进)
    const forwardPattern = /await page\.goForward\(\);/g;
    while ((match = forwardPattern.exec(code)) !== null) {
      blocks.push(this.createForwardBlock(xPosition));
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

    // 5. 解析 log（用户日志）
    const logPattern = /logUser\('([^']+)'\);/g;
    while ((match = logPattern.exec(code)) !== null) {
      const message = match[1].replace(/\\'/g, "'"); // 反转义单引号
      blocks.push(this.createLogBlock(message, xPosition));
      xPosition += 250;
    }

    return blocks;
  }

  private parseLoopBody(bodyCode: string, startX: number): any[] {
    const blocks: any[] = [];
    const matches: Array<{ index: number; block: any }> = [];

    // 解析循环体内的各种模块
    let match;
    
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
    const waitPattern = /await page\.waitForTimeout\((\d+)\);/g;
    while ((match = waitPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createWaitBlock(parseInt(match[1]), 0)
      });
    }

    // 3. 解析 click
    const clickPattern = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
    while ((match = clickPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createClickBlock(match[1], parseInt(match[2]), 0)
      });
    }

    // 4. 解析 scroll - 元素滚动
    const elementScrollPattern = /await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    while ((match = elementScrollPattern.exec(bodyCode)) !== null) {
      const selector = match[1];
      const timeout = parseInt(match[2]);
      const maxScrolls = parseInt(match[4]);
      const distance = parseInt(match[5]);
      const delay = parseInt(match[6]);
      
      matches.push({
        index: match.index,
        block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0)
      });
    }

    // 4b. 解析页面滚动（智能滚动和固定滚动）
    const pageScrollPattern = /await page\.evaluate\(async \(\{ maxScrolls, distance, delay \}\)[\s\S]*?\},\s*\{\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    while ((match = pageScrollPattern.exec(bodyCode)) !== null) {
      const maxScrolls = parseInt(match[1]);
      const distance = parseInt(match[2]);
      const delay = parseInt(match[3]);
      
      matches.push({
        index: match.index,
        block: this.createScrollBlock('page', '', 5000, maxScrolls, distance, delay, 0)
      });
    }

    // 5. 解析 extract (提取数据)
    const extractPattern = /const extractedData = await page\.evaluate\(\(\{ extractions, multiple \}\)[\s\S]*?\},\s*\{\s*extractions:\s*\[([\s\S]*?)\],\s*multiple:\s*(true|false)\s*\}\);/g;
    while ((match = extractPattern.exec(bodyCode)) !== null) {
      const extractionsStr = match[1];
      const multiple = match[2] === 'true';
      
      // 查找 saveToTable
      const tableMatch = /_table:\s*'([^']+)'/.exec(bodyCode.substring(match.index));
      const saveToTable = tableMatch ? tableMatch[1] : '';
      
      // 解析 extractions 数组
      const extractions = this.parseExtractions(extractionsStr);
      
      matches.push({
        index: match.index,
        block: this.createExtractBlock(extractions, multiple, saveToTable, 0)
      });
    }

    // 6. 解析 log（用户日志）
    const logPattern = /logUser\('([^']+)'\);/g;
    while ((match = logPattern.exec(bodyCode)) !== null) {
      const message = match[1].replace(/\\'/g, "'");
      matches.push({
        index: match.index,
        block: this.createLogBlock(message, 0)
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

  private createLogBlock(message: string, xPosition: number): any {
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'log',
      label: '日志输出',
      category: 'browser',
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
    
    // 匹配每个提取项对象（包含 customAttribute 字段）
    const extractionPattern = /\{\s*selector:\s*'([^']+)',\s*attribute:\s*'([^']+)',\s*customAttribute:\s*'([^']*)',\s*saveToColumn:\s*'([^']*)'\s*\}/g;
    let match;
    
    while ((match = extractionPattern.exec(extractionsStr)) !== null) {
      const attribute = match[2];
      const customAttribute = match[3];
      
      // 如果 customAttribute 有值，说明原始的 attribute 是 'data-*'
      // 否则，attribute 就是标准属性
      const finalAttribute = customAttribute ? 'data-*' : attribute;
      
      extractions.push({
        selector: match[1],
        attribute: finalAttribute,
        customAttribute: customAttribute,
        saveToColumn: match[4]
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

  private createBackBlock(xPosition: number): any {
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

  private createForwardBlock(xPosition: number): any {
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
