// 测试脚本示例

export const exampleScripts = {
  baidu: {
    name: '百度首页标题',
    description: '获取百度首页的标题',
    code: `log('开始访问百度');
await page.goto('https://www.baidu.com');
log('等待页面加载');
await page.waitForLoadState('networkidle');
const title = await page.title();
log(\`获取到标题: \${title}\`);
return { title };`
  },
  
  github: {
    name: 'GitHub趋势',
    description: '获取GitHub趋势页面信息',
    code: `log('访问GitHub趋势页面');
await page.goto('https://github.com/trending');
log('等待页面加载');
await page.waitForLoadState('networkidle');

log('提取趋势仓库信息');
const repos = await page.$$eval('article.Box-row', articles => {
  return articles.slice(0, 5).map(article => {
    const title = article.querySelector('h2 a')?.textContent?.trim() || '';
    const desc = article.querySelector('p')?.textContent?.trim() || '';
    const stars = article.querySelector('.float-sm-right')?.textContent?.trim() || '';
    return { title, desc, stars };
  });
});

log(\`获取到 \${repos.length} 个仓库\`);
return { repos };`
  },
  
  simple: {
    name: '简单测试',
    description: '简单的页面访问测试',
    code: `log('开始测试');
await page.goto('https://example.com');
log('页面加载完成');
const content = await page.textContent('h1');
log(\`页面标题: \${content}\`);
return { content };`
  }
};
