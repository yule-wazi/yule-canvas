<template>
  <div class="home">
    <div class="hero">
      <h2>欢迎使用数据爬取Agent</h2>
      <p>AI驱动的网页数据爬取工具，让数据采集变得简单高效</p>
      <div class="quick-actions">
        <router-link to="/scripts" class="action-btn primary">开始使用</router-link>
        <a href="https://playwright.dev/" target="_blank" class="action-btn secondary">Playwright文档</a>
      </div>
    </div>
    
    <div class="features">
      <div class="feature-card">
        <div class="icon">🤖</div>
        <h3>AI生成脚本</h3>
        <p>使用阿里千问或硅基流动AI自动生成Playwright爬虫脚本，无需手写代码</p>
      </div>
      <div class="feature-card">
        <div class="icon">📝</div>
        <h3>脚本管理</h3>
        <p>创建、编辑、执行和管理您的爬虫脚本，支持实时日志查看</p>
      </div>
      <div class="feature-card">
        <div class="icon">💾</div>
        <h3>数据存储</h3>
        <p>爬取的数据本地存储，支持JSON和表格视图，可导出使用</p>
      </div>
    </div>

    <div class="quick-start">
      <h3>快速开始</h3>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>配置API密钥</h4>
            <p>在 backend/.env 文件中配置阿里千问或硅基流动的API密钥</p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>生成脚本</h4>
            <p>进入脚本管理页面，描述你的需求，让AI生成爬虫代码</p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>执行并查看结果</h4>
            <p>点击执行按钮，实时查看日志，获取爬取的数据</p>
          </div>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">{{ scriptCount }}</div>
        <div class="stat-label">已保存脚本</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ dataCount }}</div>
        <div class="stat-label">数据记录</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ storageUsage }}%</div>
        <div class="stat-label">存储使用</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import storageManager from '../services/storage';

const scriptCount = ref(0);
const dataCount = ref(0);
const storageUsage = ref(0);

onMounted(() => {
  scriptCount.value = storageManager.getAllScripts().length;
  dataCount.value = storageManager.getAllData().length;
  const usage = storageManager.getStorageUsage();
  storageUsage.value = Math.round(usage.percentage);
});
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 3rem 0;
  background: linear-gradient(135deg, #1f6feb 0%, #8957e5 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 3rem;
}

.hero h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.quick-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.action-btn {
  padding: 0.75rem 2rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.action-btn.primary {
  background: white;
  color: #1f6feb;
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid white;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  background: #161b22;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #30363d;
  text-align: center;
  transition: all 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: #58a6ff;
  box-shadow: 0 4px 12px rgba(88, 166, 255, 0.2);
}

.icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #58a6ff;
}

.feature-card p {
  color: #8b949e;
  line-height: 1.6;
}

.quick-start {
  background: #161b22;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #30363d;
  margin-bottom: 3rem;
}

.quick-start h3 {
  text-align: center;
  color: #58a6ff;
  margin-bottom: 2rem;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.step-number {
  width: 40px;
  height: 40px;
  background: #1f6feb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.step-content h4 {
  margin: 0 0 0.5rem 0;
  color: #c9d1d9;
}

.step-content p {
  margin: 0;
  color: #8b949e;
  line-height: 1.6;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.stat-item {
  background: #161b22;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #30363d;
  text-align: center;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f6feb;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #8b949e;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .hero h2 {
    font-size: 2rem;
  }
  
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
