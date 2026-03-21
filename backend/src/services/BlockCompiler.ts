export class BlockCompiler {
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
    const { mode, maxScrolls, delay } = block.data;
    
    if (mode === 'smart') {
      return `log('智能滚动页面');
await page.evaluate(async () => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let lastHeight = document.body.scrollHeight;
  let scrollAttempts = 0;
  const maxScrolls = ${maxScrolls};
  
  while (scrollAttempts < maxScrolls) {
    window.scrollBy(0, window.innerHeight);
    await delay(${delay});
    
    const newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight) {
      break;
    }
    
    lastHeight = newHeight;
    scrollAttempts++;
  }
});
`;
    } else {
      return `log('滚动页面 ${maxScrolls} 次');
for (let i = 0; i < ${maxScrolls}; i++) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(${delay});
}
`;
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
    
    if (waitForElement) {
      return `log('等待并点击元素: ${selector}');
await page.waitForSelector('${selector}', { timeout: ${timeout} });
await page.click('${selector}');
`;
    } else {
      return `log('点击元素: ${selector}');
await page.click('${selector}');
`;
    }
  }

  private generateTypeCode(block: any): string {
    const { selector, text, delay } = block.data;
    return `log('输入文本到: ${selector}');
await page.type('${selector}', '${text}', { delay: ${delay} });
`;
  }

  private generateExtractImagesCode(block: any): string {
    const { filterInvalid, attributes } = block.data;
    const attrsStr = attributes.map((a: string) => `'${a}'`).join(', ');
    
    return `log('提取图片');
const images = await page.evaluate((attrs, filter) => {
  const imgElements = document.querySelectorAll('img');
  const imageData: any[] = [];
  
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
}, [${attrsStr}], ${filterInvalid});

log(\`找到 \${images.length} 张图片\`);
`;
  }

  private generateLogCode(block: any): string {
    const { message } = block.data;
    return `log('${message}');
`;
  }

  private assembleCode(fragments: string[]): string {
    const header = `// 自动生成的Playwright脚本
// 生成时间: ${new Date().toLocaleString()}

`;

    const body = fragments.join('\n');

    const footer = `
// 返回统一数据格式
return {
  success: true,
  dataType: 'custom',
  url: page.url(),
  timestamp: Date.now(),
  count: 0,
  items: []
};
`;

    return header + body + footer;
  }
}
