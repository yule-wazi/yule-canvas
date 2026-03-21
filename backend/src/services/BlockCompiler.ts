export class BlockCompiler {
  // 默认超时时间常量（毫秒）
  private readonly DEFAULT_TIMEOUT = 5000;

  compile(blocks: any[], connections: any[]): string {
    if (blocks.length === 0) {
      return '// 工作流为空\nreturn { success: false, message: "工作流为空" };';
    }

    // 拓扑排序确定执行顺序
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

  private generateBlockCode(block: any): string {
    switch (block.type) {
      case 'navigate':
        return this.generateNavigateCode(block);
      case 'scroll':
        return this.generateScrollCode(block);
      case 'wait':
        return this.generateWaitCode(block);
      case 'click':
        return this.generateClickCode(block);
      case 'type':
        return this.generateTypeCode(block);
      case 'extract-images':
        return this.generateExtractImagesCode(block);
      case 'extract':
        return this.generateExtractCode(block);
      case 'log':
        return this.generateLogCode(block);
      default:
        return `// 未知block类型: ${block.type}\n`;
    }
  }

  private generateNavigateCode(block: any): string {
    const { url, waitUntil, timeout } = block.data;
    return `log('访问页面: ${url}');
await page.goto('${url}', { 
  waitUntil: '${waitUntil}', 
  timeout: ${timeout} 
});
`;
  }

  private generateScrollCode(block: any): string {
    const { target, selector, timeout, mode, maxScrolls, scrollDistance, delay } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    const distance = scrollDistance || 800; // 默认800像素
    
    if (target === 'element') {
      // 元素滚动 - 先等待元素出现
      const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      
      if (mode === 'smart') {
        return `log('等待元素出现: ${escapedSelector}');
await page.waitForSelector('${escapedSelector}', { timeout: ${timeoutValue} });

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
}, { sel: '${escapedSelector}', maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
      } else {
        return `log('等待元素出现: ${escapedSelector}');
await page.waitForSelector('${escapedSelector}', { timeout: ${timeoutValue} });

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
}, { sel: '${escapedSelector}', maxScrolls: ${maxScrolls}, distance: ${distance}, delay: ${delay} });
`;
      }
    } else {
      // 页面滚动
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
    return `log('等待 ${duration}ms');
await page.waitForTimeout(${duration});
`;
  }

  private generateClickCode(block: any): string {
    const { selector, waitForElement, timeout } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    
    if (waitForElement) {
      return `log('等待并点击元素: ${selector}');
await page.waitForSelector('${selector}', { timeout: ${timeoutValue} });
await page.click('${selector}');
`;
    } else {
      return `log('点击元素: ${selector}');
await page.click('${selector}');
`;
    }
  }

  private generateTypeCode(block: any): string {
    const { selector, text, delay, timeout } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    
    return `log('等待元素出现: ${selector}');
await page.waitForSelector('${selector}', { timeout: ${timeoutValue} });

log('输入文本到: ${selector}');
await page.type('${selector}', '${text}', { delay: ${delay} });
`;
  }

  private generateExtractImagesCode(block: any): string {
    const { selector, filterInvalid, attributes, timeout, saveToTable, saveToColumn } = block.data;
    const timeoutValue = timeout || this.DEFAULT_TIMEOUT;
    const imgSelector = selector || 'img';
    const escapedSelector = imgSelector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const attrsStr = attributes.map((a: string) => `'${a}'`).join(', ');
    
    let code = `log('等待图片元素出现');
await page.waitForSelector('${escapedSelector}', { timeout: ${timeoutValue} });

log('提取图片');
const images = await page.evaluate(({ sel, attrs, filter }) => {
  const imgElements = document.querySelectorAll(sel);
  const imageData = [];
  
  imgElements.forEach((img, index) => {
    let src = null;
    for (const attr of attrs) {
      src = img.getAttribute(attr);
      if (src) break;
    }
    
    if (src) {
      if (filter && (!src.startsWith('http') || src.includes('data:image'))) {
        return;
      }
      
      imageData.push({
        index: index + 1,
        src: src,
        alt: img.alt || '',
        title: img.title || ''
      });
    }
  });
  
  return imageData;
}, { sel: '${escapedSelector}', attrs: [${attrsStr}], filter: ${filterInvalid} });

`;

    // 如果配置了保存到数据表
    if (saveToTable && saveToColumn) {
      code += `// 保存到数据表
images.forEach(img => {
  extractedResults.images.push({
    _table: '${saveToTable}',
    _column: '${saveToColumn}',
    ...img
  });
});
log('找到 ' + images.length + ' 张图片，已保存到数据表');
`;
    } else {
      code += `// 保存提取的图片
extractedResults.images.push(...images);
log('找到 ' + images.length + ' 张图片');
`;
    }

    return code;
  }

  private generateExtractCode(block: any): string {
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
      const escapedSelector = extraction.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `{
    selector: '${escapedSelector}',
    attribute: '${attr}',
    saveToColumn: '${extraction.saveToColumn || ''}'
  }`;
    }).join(',\n  ');

    code += `log('开始提取数据，共 ${validExtractions.length} 个提取项');

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
extractedData.forEach(row => {
  const rowData = {
    _table: '${saveToTable}',
    _rowData: {}
  };
  
  // 组装每一行的数据
  ${validExtractions.map((extraction: any, idx: number) => {
    if (extraction.saveToColumn) {
      return `rowData._rowData['${extraction.saveToColumn}'] = row.field_${idx};`;
    }
    return '';
  }).filter(Boolean).join('\n  ')}
  
  extractedResults.data.push(rowData);
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

  private generateLogCode(block: any): string {
    const { message } = block.data;
    return `log('${message}');
`;
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
