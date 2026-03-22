import type { Block } from '../types/block';
import type { Connection } from '../types/connection';
import type { Workflow } from '../types/workflow';

export class BlockCompiler {
  compile(blocks: Block[], connections: Connection[]): string {
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

  private topologicalSort(blocks: Block[], connections: Connection[]): Block[] {
    // 构建邻接表
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

    // Kahn算法
    const queue: string[] = [];
    const result: Block[] = [];

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

    // 如果有环或孤立节点，添加剩余blocks
    blocks.forEach(block => {
      if (!result.find(b => b.id === block.id)) {
        result.push(block);
      }
    });

    return result;
  }

  private generateBlockCode(block: Block): string {
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
      case 'extract':
        return this.generateExtractCode(block);
      case 'extract-links':
        return this.generateExtractLinksCode(block);
      case 'log':
        return this.generateLogCode(block);
      default:
        return `// 未知block类型: ${block.type}\n`;
    }
  }

  private generateNavigateCode(block: Block): string {
    const { url, waitUntil, timeout } = block.data;
    return `log('访问页面: ${url}');
await page.goto('${url}', { 
  waitUntil: '${waitUntil}', 
  timeout: ${timeout} 
});
`;
  }

  private generateScrollCode(block: Block): string {
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
      log('已到达页面底部');
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

  private generateWaitCode(block: Block): string {
    const { duration } = block.data;
    return `log('等待 ${duration}ms');
await page.waitForTimeout(${duration});
`;
  }

  private generateClickCode(block: Block): string {
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

  private generateTypeCode(block: Block): string {
    const { selector, text, delay } = block.data;
    return `log('输入文本到: ${selector}');
await page.type('${selector}', '${text}', { delay: ${delay} });
`;
  }

  private generateExtractCode(block: Block): string {
    const { selector, attribute, multiple } = block.data;
    
    if (multiple) {
      return `log('提取多个元素: ${selector}');
const extractedData = await page.evaluate((sel, attr) => {
  const elements = document.querySelectorAll(sel);
  return Array.from(elements).map(el => {
    if (attr === 'text') return el.textContent?.trim();
    return el.getAttribute(attr);
  }).filter(Boolean);
}, '${selector}', '${attribute}');
log(\`提取到 \${extractedData.length} 条数据\`);
`;
    } else {
      return `log('提取单个元素: ${selector}');
const extractedData = await page.evaluate((sel, attr) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  if (attr === 'text') return el.textContent?.trim();
  return el.getAttribute(attr);
}, '${selector}', '${attribute}');
`;
    }
  }


  private generateExtractLinksCode(block: Block): string {
    const { filterPattern } = block.data;
    
    return `log('提取链接');
const links = await page.evaluate((pattern) => {
  const linkElements = document.querySelectorAll('a[href]');
  const linkData: any[] = [];
  
  linkElements.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (href && (!pattern || href.includes(pattern))) {
      linkData.push({
        index: index + 1,
        href: href,
        text: link.textContent?.trim() || '',
        title: link.title || ''
      });
    }
  });
  
  return linkData;
}, '${filterPattern}');

log(\`找到 \${links.length} 个链接\`);
`;
  }

  private generateLogCode(block: Block): string {
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
