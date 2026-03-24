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

      // 2. 解析 waitForSelector + click (点击元素) - 支持模板字符串
      const clickPattern = /await page\.waitForSelector\(`([^`]+)`,\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\(`([^`]+)`\);/g;
      while ((match = clickPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createClickBlock(match[1], parseInt(match[2]), 0)
        });
      }
      
      // 2b. 解析 waitForSelector + click (点击元素) - 单引号版本
      const clickPatternSingle = /await page\.waitForSelector\('([^']+)',\s*\{[^}]*timeout:\s*(\d+)[^}]*\}\);\s*await page\.click\('([^']+)'\);/g;
      while ((match = clickPatternSingle.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createClickBlock(match[1], parseInt(match[2]), 0)
        });
      }
      
      // 2c. 解析 click without wait (点击元素 - 不等待) - 模板字符串版本
      const clickNoWaitPattern = /log\('点击元素:\s*([^']+)'\);[\s\S]*?await page\.click\(`([^`]+)`\);/g;
      while ((match = clickNoWaitPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createClickBlock(match[2], 5000, 0, false)
        });
      }
      
      // 2d. 解析 click without wait (点击元素 - 不等待) - 单引号版本
      const clickNoWaitPatternSingle = /log\('点击元素:\s*([^']+)'\);[\s\S]*?await page\.click\('([^']+)'\);/g;
      while ((match = clickNoWaitPatternSingle.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createClickBlock(match[2], 5000, 0, false)
        });
      }

      // 3. 解析 waitForTimeout (等待) - 使用特殊标记避免误匹配
      const waitPattern = /log\('【等待模块】等待 (\d+)ms'\);[\s\S]*?await page\.waitForTimeout\((\d+)\);[\s\S]*?log\('【等待模块】等待完成'\);/g;
      while ((match = waitPattern.exec(code)) !== null) {
        matches.push({
          index: match.index,
          block: this.createWaitBlock(parseInt(match[1]), 0)
        });
      }

      // 4. 解析 scroll (滚动) - 分别匹配页面滚动和元素滚动
      
      // 4a. 元素滚动 - 智能滚动 - 模板字符串版本
      const elementSmartScrollPattern = /log\('等待元素出现:\s*([^']+)'\);[\s\S]*?await page\.waitForSelector\(`([^`]+)`,\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?log\('智能滚动元素:\s*([^']+)'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*`([^`]*)`,\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = elementSmartScrollPattern.exec(code)) !== null) {
        const selector = match[2];
        const timeout = parseInt(match[3]);
        const maxScrolls = parseInt(match[6]);
        const distance = parseInt(match[7]);
        const delay = parseInt(match[8]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0, 'smart')
        });
      }
      
      // 4a2. 元素滚动 - 智能滚动 - 单引号版本
      const elementSmartScrollPatternSingle = /log\('等待元素出现:\s*([^']+)'\);[\s\S]*?await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?log\('智能滚动元素:\s*([^']+)'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = elementSmartScrollPatternSingle.exec(code)) !== null) {
        const selector = match[2];
        const timeout = parseInt(match[3]);
        const maxScrolls = parseInt(match[6]);
        const distance = parseInt(match[7]);
        const delay = parseInt(match[8]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0, 'smart')
        });
      }
      
      // 4b. 元素滚动 - 固定次数 - 模板字符串版本
      const elementScrollPattern = /log\('等待元素出现:\s*([^']+)'\);[\s\S]*?await page\.waitForSelector\(`([^`]+)`,\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?log\('滚动元素\s+(\d+)\s+次:\s*([^']+)'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*`([^`]*)`,\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = elementScrollPattern.exec(code)) !== null) {
        const selector = match[2];
        const timeout = parseInt(match[3]);
        const maxScrolls = parseInt(match[7]);
        const distance = parseInt(match[8]);
        const delay = parseInt(match[9]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0, 'fixed')
        });
      }
      
      // 4b2. 元素滚动 - 固定次数 - 单引号版本
      const elementScrollPatternSingle = /log\('等待元素出现:\s*([^']+)'\);[\s\S]*?await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?log\('滚动元素\s+(\d+)\s+次:\s*([^']+)'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = elementScrollPatternSingle.exec(code)) !== null) {
        const selector = match[2];
        const timeout = parseInt(match[3]);
        const maxScrolls = parseInt(match[7]);
        const distance = parseInt(match[8]);
        const delay = parseInt(match[9]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0, 'fixed')
        });
      }

      // 4c. 页面滚动 - 智能滚动
      const pageSmartScrollPattern = /log\('智能滚动页面'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = pageSmartScrollPattern.exec(code)) !== null) {
        const maxScrolls = parseInt(match[1]);
        const distance = parseInt(match[2]);
        const delay = parseInt(match[3]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('page', '', 5000, maxScrolls, distance, delay, 0, 'smart')
        });
      }

      // 4d. 页面滚动 - 固定次数
      const pageScrollPattern = /log\('滚动页面\s+(\d+)\s+次'\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
      while ((match = pageScrollPattern.exec(code)) !== null) {
        const maxScrolls = parseInt(match[2]);
        const distance = parseInt(match[3]);
        const delay = parseInt(match[4]);
        
        matches.push({
          index: match.index,
          block: this.createScrollBlock('page', '', 5000, maxScrolls, distance, delay, 0, 'fixed')
        });
      }

      // 5. 解析 extract (提取数据) - 匹配新的多提取项格式
      const extractPattern = /log\('开始提取数据，共 (\d+) 个提取项'\);[\s\S]*?await page\.waitForSelector\([^,]+,\s*\{\s*timeout:\s*(\d+)[^}]*\}\);[\s\S]*?const extractedData = await page\.evaluate\(\(\{ extractions, multiple \}\)[^{]*\{[\s\S]*?\}, \{\s*extractions:\s*\[([\s\S]*?)\],\s*multiple:\s*(true|false)\s*\}\);/g;
      while ((match = extractPattern.exec(code)) !== null) {
        const extractionCount = parseInt(match[1]);
        const timeout = parseInt(match[2]);
        const extractionsStr = match[3];
        const multiple = match[4] === 'true';

        // 查找 saveToTable - 从 saveDataImmediately 调用中提取
        let saveToTable = '';
        let mergeKey = '';
        const saveDataMatch = /saveDataImmediately\(\{[\s\S]*?tableId:\s*'([^']+)'/.exec(code.substring(match.index));
        if (saveDataMatch) {
          saveToTable = saveDataMatch[1];
          
          // 查找 mergeKey - 从 rowData['_mergeKey'] = xxx 中提取
          const mergeKeyMatch = /rowData\['_mergeKey'\]\s*=\s*([^;]+);/.exec(code.substring(match.index));
          if (mergeKeyMatch) {
            const mergeKeyValue = mergeKeyMatch[1].trim();
            // 如果是变量名（不带引号），直接使用
            if (/^[a-zA-Z_]\w*$/.test(mergeKeyValue)) {
              mergeKey = mergeKeyValue;
            }
            // 如果是字符串字面量，提取变量名（假设是全局变量）
            else if (mergeKeyValue.startsWith("'") || mergeKeyValue.startsWith('"')) {
              // 这种情况下无法确定原始变量名，跳过
              mergeKey = '';
            }
          }
        }

        // 解析 extractions 数组
        const extractions = this.parseExtractions(extractionsStr);
        
        matches.push({
          index: match.index,
          block: this.createExtractBlock(extractions, multiple, saveToTable, 0, timeout, mergeKey)
        });
      }



      // 7. 解析 logUser（用户日志）- 支持转义的单引号
      const logUserPattern = /logUser\('((?:[^'\\]|\\.)*)'\);/g;
      while ((match = logUserPattern.exec(code)) !== null) {
        const message = match[1].replace(/\\'/g, "'"); // 反转义单引号
        matches.push({
          index: match.index,
          block: this.createLogBlock(message, 0)
        });
      }
      
      // 7b. 解析 logUser（用户日志）- 模板字符串版本
      const logUserTemplatePattern = /logUser\(`([^`]*)`\);/g;
      while ((match = logUserTemplatePattern.exec(code)) !== null) {
        // 将模板字符串变量 ${variableName} 转换回 {{variableName}}
        const message = match[1].replace(/\$\{(\w+)\}/g, '{{$1}}');
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
        startValueType: 'variable', // 假设使用全局变量
        bodyCode: match[5],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // 匹配所有固定次数循环（不带变量名）
    const countLoopNoVarPattern = /log\('开始循环，共 (\d+) 次'\);[\s\S]*?for \(let __loopIndex = 0; __loopIndex < (\d+); __loopIndex\+\+\) \{\s*log\('循环第[\s\S]*?([\s\S]*?)\n\}[\s\S]*?log\('循环完成'\);/g;
    while ((match = countLoopNoVarPattern.exec(code)) !== null) {
      // 检查是否已经被带变量的模式匹配过
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
            maxIterations: segment.loopInfo.maxIterations || 1000,
            useVariable: !!segment.loopInfo.variableName,
            variableName: segment.loopInfo.variableName || '',
            startValueType: segment.loopInfo.startValueType || 'variable',
            startValue: segment.loopInfo.startValue && segment.loopInfo.variableName 
              ? `{{${segment.loopInfo.variableName}}}` 
              : ''
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

    // 2. 解析 wait - 使用特殊标记避免误匹配
    const waitPattern = /log\('【等待模块】等待 (\d+)ms'\);[\s\S]*?await page\.waitForTimeout\((\d+)\);[\s\S]*?log\('【等待模块】等待完成'\);/g;
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
      
      // 检查是否为智能滚动（通过查找日志判断）
      const logBeforeMatch = code.substring(Math.max(0, match.index - 200), match.index);
      const mode = logBeforeMatch.includes('智能滚动') ? 'smart' : 'fixed';
      
      blocks.push(this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, xPosition, mode));
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

    // 2. 解析 wait - 使用特殊标记避免误匹配
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
    
    // 3c. 解析 click without wait - 模板字符串版本
    const clickNoWaitPattern = /log\('点击元素:\s*([^']+)'\);[\s\S]*?await page\.click\(`([^`]+)`\);/g;
    while ((match = clickNoWaitPattern.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createClickBlock(match[2], 5000, 0, false)
      });
    }
    
    // 3d. 解析 click without wait - 单引号版本
    const clickNoWaitPatternSingle = /log\('点击元素:\s*([^']+)'\);[\s\S]*?await page\.click\('([^']+)'\);/g;
    while ((match = clickNoWaitPatternSingle.exec(bodyCode)) !== null) {
      matches.push({
        index: match.index,
        block: this.createClickBlock(match[2], 5000, 0, false)
      });
    }

    // 4. 解析 scroll - 元素滚动 - 模板字符串版本
    const elementScrollPattern = /await page\.waitForSelector\(`([^`]+)`,\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*`([^`]*)`,\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    while ((match = elementScrollPattern.exec(bodyCode)) !== null) {
      const selector = match[1];
      const timeout = parseInt(match[2]);
      const maxScrolls = parseInt(match[4]);
      const distance = parseInt(match[5]);
      const delay = parseInt(match[6]);
      
      // 检查是否为智能滚动（通过查找日志判断）
      const logBeforeMatch = bodyCode.substring(Math.max(0, match.index - 200), match.index);
      const mode = logBeforeMatch.includes('智能滚动') ? 'smart' : 'fixed';
      
      matches.push({
        index: match.index,
        block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0, mode)
      });
    }
    
    // 4b. 解析 scroll - 元素滚动 - 单引号版本
    const elementScrollPatternSingle = /await page\.waitForSelector\('([^']+)',\s*\{\s*timeout:\s*(\d+)\s*\}\);[\s\S]*?await page\.evaluate\([\s\S]*?\},\s*\{\s*sel:\s*'([^']*)',\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    while ((match = elementScrollPatternSingle.exec(bodyCode)) !== null) {
      const selector = match[1];
      const timeout = parseInt(match[2]);
      const maxScrolls = parseInt(match[4]);
      const distance = parseInt(match[5]);
      const delay = parseInt(match[6]);
      
      // 检查是否为智能滚动（通过查找日志判断）
      const logBeforeMatch = bodyCode.substring(Math.max(0, match.index - 200), match.index);
      const mode = logBeforeMatch.includes('智能滚动') ? 'smart' : 'fixed';
      
      matches.push({
        index: match.index,
        block: this.createScrollBlock('element', selector, timeout, maxScrolls, distance, delay, 0, mode)
      });
    }

    // 4b. 解析页面滚动（智能滚动和固定滚动）
    const pageScrollPattern = /await page\.evaluate\(async \(\{ maxScrolls, distance, delay \}\)[\s\S]*?\},\s*\{\s*maxScrolls:\s*(\d+),\s*distance:\s*(\d+),\s*delay:\s*(\d+)\s*\}\);/g;
    while ((match = pageScrollPattern.exec(bodyCode)) !== null) {
      const maxScrolls = parseInt(match[1]);
      const distance = parseInt(match[2]);
      const delay = parseInt(match[3]);
      
      // 检查是否为智能滚动（通过查找日志判断）
      const logBeforeMatch = bodyCode.substring(Math.max(0, match.index - 200), match.index);
      const mode = logBeforeMatch.includes('智能滚动') ? 'smart' : 'fixed';
      
      matches.push({
        index: match.index,
        block: this.createScrollBlock('page', '', 5000, maxScrolls, distance, delay, 0, mode)
      });
    }

    // 5. 解析 extract (提取数据)
    const extractPattern = /log\('开始提取数据，共 (\d+) 个提取项'\);[\s\S]*?await page\.waitForSelector\([^,]+,\s*\{\s*timeout:\s*(\d+)[^}]*\}\);[\s\S]*?const extractedData = await page\.evaluate\(\(\{ extractions, multiple \}\)[\s\S]*?\},\s*\{\s*extractions:\s*\[([\s\S]*?)\],\s*multiple:\s*(true|false)\s*\}\);/g;
    while ((match = extractPattern.exec(bodyCode)) !== null) {
      const extractionCount = parseInt(match[1]);
      const timeout = parseInt(match[2]);
      const extractionsStr = match[3];
      const multiple = match[4] === 'true';
      
      // 查找 saveToTable - 从 saveDataImmediately 调用中提取
      let saveToTable = '';
      let mergeKey = '';
      const saveDataMatch = /saveDataImmediately\(\{[\s\S]*?tableId:\s*'([^']+)'/.exec(bodyCode.substring(match.index));
      if (saveDataMatch) {
        saveToTable = saveDataMatch[1];
        
        // 查找 mergeKey - 从 rowData['_mergeKey'] = xxx 中提取
        const mergeKeyMatch = /rowData\['_mergeKey'\]\s*=\s*([^;]+);/.exec(bodyCode.substring(match.index));
        if (mergeKeyMatch) {
          const mergeKeyValue = mergeKeyMatch[1].trim();
          // 如果是变量名（不带引号），直接使用
          if (/^[a-zA-Z_]\w*$/.test(mergeKeyValue)) {
            mergeKey = mergeKeyValue;
          }
          // 如果是字符串字面量，提取变量名（假设是全局变量）
          else if (mergeKeyValue.startsWith("'") || mergeKeyValue.startsWith('"')) {
            // 这种情况下无法确定原始变量名，跳过
            mergeKey = '';
          }
        }
      }
      
      // 解析 extractions 数组
      const extractions = this.parseExtractions(extractionsStr);
      
      matches.push({
        index: match.index,
        block: this.createExtractBlock(extractions, multiple, saveToTable, 0, timeout, mergeKey)
      });
    }

    // 6. 解析 log（用户日志）- 支持转义的单引号和模板字符串
    const logPattern = /logUser\('((?:[^'\\]|\\.)*)'\);/g;
    while ((match = logPattern.exec(bodyCode)) !== null) {
      const message = match[1].replace(/\\'/g, "'");
      matches.push({
        index: match.index,
        block: this.createLogBlock(message, 0)
      });
    }
    
    // 6b. 解析 log（用户日志）- 模板字符串版本
    const logTemplatePattern = /logUser\(`([^`]*)`\);/g;
    while ((match = logTemplatePattern.exec(bodyCode)) !== null) {
      // 将模板字符串变量 ${variableName} 转换回 {{variableName}}
      const message = match[1].replace(/\$\{(\w+)\}/g, '{{$1}}');
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
    // 支持单引号和反引号（模板字符串）
    const extractionPattern = /\{\s*selector:\s*[`']([^`']+)[`'],\s*attribute:\s*'([^']+)',\s*customAttribute:\s*'([^']*)',\s*saveToColumn:\s*'([^']*)'\s*\}/g;
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

  private createClickBlock(selector: string, timeout: number, xPosition: number, waitForElement: boolean = true): any {
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
        waitForElement,
        timeout
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createScrollBlock(target: string, selector: string, timeout: number, maxScrolls: number, distance: number, delay: number, xPosition: number, mode: string = 'fixed'): any {
    // 将模板字符串变量 ${variableName} 转换回 {{variableName}}
    const convertedSelector = selector.replace(/\$\{(\w+)\}/g, '{{$1}}');
    
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'scroll',
      label: '滚动页面',
      category: 'browser',
      position: { x: xPosition, y: 200 },
      data: {
        target,
        selector: convertedSelector,
        timeout,
        mode,
        maxScrolls,
        scrollDistance: distance,
        delay
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [{ id: 'out', name: '输出', type: 'flow' }]
    };
  }

  private createExtractBlock(extractions: any[], multiple: boolean, saveToTable: string, xPosition: number, timeout: number = 5000, mergeKey: string = ''): any {
    // 将所有提取项的选择器中的模板字符串变量转换回 {{variableName}}
    const convertedExtractions = extractions.map(ext => ({
      ...ext,
      selector: ext.selector.replace(/\$\{(\w+)\}/g, '{{$1}}')
    }));
    
    return {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'extract',
      label: '提取数据',
      category: 'extraction',
      position: { x: xPosition, y: 200 },
      data: {
        extractions: convertedExtractions,
        multiple,
        timeout,
        saveToTable,
        mergeKey
      },
      inputs: [{ id: 'in', name: '输入', type: 'flow' }],
      outputs: [
        { id: 'out', name: '输出', type: 'flow' },
        { id: 'data', name: '数据', type: 'data' }
      ]
    };
  }


}
