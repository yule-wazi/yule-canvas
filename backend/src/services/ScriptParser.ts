import * as acorn from 'acorn';

export class ScriptParser {
  parse(code: string): any {
    try {
      const blocks: any[] = [];
      const connections: any[] = [];
      let xPosition = 100; // 改为水平位置

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
