<template>
  <div class="home">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">DATA EXTRACTION WORKFLOW</p>
        <h2>让数据采集像工程系统一样清晰、可控、可复用</h2>
        <p class="hero-text">
          用录制、编排和执行把网页采集任务沉淀为稳定工作流，再把数据直接送进你的页面与产品系统。
        </p>
        <div class="quick-actions">
          <router-link to="/workflow" class="action-btn primary">开始使用</router-link>
          <a href="https://playwright.dev/" target="_blank" rel="noreferrer" class="action-btn secondary">Playwright 文档</a>
        </div>
      </div>
      <div class="hero-panel">
        <div class="hero-panel-label">SYSTEM STATUS</div>
        <div class="hero-metric-grid">
          <div class="hero-metric">
            <span class="metric-value">{{ dataCount }}</span>
            <span class="metric-label">数据记录</span>
          </div>
          <div class="hero-metric">
            <span class="metric-value">{{ storageUsage }}%</span>
            <span class="metric-label">存储占用</span>
          </div>
          <div class="hero-metric">
            <span class="metric-value">JSON</span>
            <span class="metric-label">工作流输出</span>
          </div>
          <div class="hero-metric">
            <span class="metric-value">REC</span>
            <span class="metric-label">录制驱动</span>
          </div>
        </div>
      </div>
    </section>

    <section class="feature-section">
      <div class="section-head">
        <p class="eyebrow">CAPABILITIES</p>
        <h3>核心能力</h3>
      </div>
      <div class="features">
        <article class="feature-card">
          <div class="feature-icon">01</div>
          <h4>录制转工作流</h4>
          <p>将用户真实操作转为可执行 workflow，保留可视化编辑能力，而不是停留在一次性脚本。</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">02</div>
          <h4>可视化编排</h4>
          <p>通过节点、循环、条件和数据表构建采集链路，让复杂网页任务具备工程化可维护性。</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">03</div>
          <h4>数据沉淀</h4>
          <p>采集结果直接写入数据表，支持结构化保存、调试验证和后续页面生成使用。</p>
        </article>
        <article class="feature-card feature-card--interactive" @click="$router.push('/test')">
          <div class="feature-icon">04</div>
          <h4>JSON 测试</h4>
          <p>直接输入 Workflow JSON 进行验证，快速检查执行链路是否符合预期。</p>
        </article>
      </div>
    </section>

    <section class="quick-start">
      <div class="section-head">
        <p class="eyebrow">QUICK START</p>
        <h3>三步开始</h3>
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-number">01</div>
          <div class="step-content">
            <h4>配置基础环境</h4>
            <p>准备浏览器执行环境、后端配置和数据表，让录制与执行链路先可用。</p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">02</div>
          <div class="step-content">
            <h4>录制并映射</h4>
            <p>在可视化编辑器中录制真实操作，映射为可执行工作流，并保留手动调整空间。</p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">03</div>
          <div class="step-content">
            <h4>执行与沉淀数据</h4>
            <p>运行 workflow，检查执行日志，将提取结果沉淀进数据表供后续页面使用。</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import storageManager from '../services/storage';

const dataCount = ref(0);
const storageUsage = ref(0);

onMounted(() => {
  dataCount.value = storageManager.getAllData().length;
  const usage = storageManager.getStorageUsage();
  storageUsage.value = Math.round(usage.percentage);
});
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  color: #ffffff;
}

.hero,
.quick-start,
.feature-card {
  border-radius: 2px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
  gap: 24px;
  padding: 32px;
  margin-bottom: 32px;
  background: #000000;
  border: 1px solid #5e5e5e;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
  position: relative;
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  border-top: 2px solid #76b900;
  pointer-events: none;
}

.hero::after {
  content: "";
  position: absolute;
  right: 32px;
  top: 32px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(118, 185, 0, 0.14) 0%, rgba(118, 185, 0, 0) 72%);
  pointer-events: none;
}

.hero-copy h2,
.section-head h3,
.feature-card h4,
.step-content h4 {
  font-family: "Arial", "Helvetica", sans-serif;
  font-weight: 700;
  line-height: 1.25;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: normal;
  text-transform: uppercase;
  color: #76b900;
}

.hero-copy h2 {
  margin: 0 0 16px;
  font-size: 36px;
  max-width: 760px;
  color: #ffffff;
}

.hero-text {
  margin: 0 0 24px;
  max-width: 720px;
  font-size: 16px;
  line-height: 1.5;
  color: #a7a7a7;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 11px 13px;
  border: 2px solid #76b900;
  border-radius: 2px;
  background: transparent;
  color: #ffffff;
  text-decoration: none;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.action-btn:hover {
  background: #1eaedb;
  border-color: #1eaedb;
  color: #ffffff;
}

.action-btn.primary {
  color: #ffffff;
}

.action-btn.secondary {
  border-width: 1px;
}

.hero-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #5e5e5e;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
  color: #000000;
}

.hero-panel-label {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: #000000;
  padding-bottom: 8px;
  border-bottom: 2px solid #76b900;
}

.hero-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.hero-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid #5e5e5e;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: #000000;
}

.metric-label {
  font-size: 14px;
  color: #757575;
}

.feature-section,
.quick-start {
  margin-bottom: 32px;
}

.section-head {
  margin-bottom: 16px;
}

.section-head h3 {
  margin: 0;
  font-size: 24px;
  color: #ffffff;
}

.features {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.feature-card {
  min-height: 220px;
  padding: 24px;
  background: #ffffff;
  color: #000000;
  border: 1px solid #5e5e5e;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
}

.feature-card--interactive {
  cursor: pointer;
}

.feature-card:hover {
  border-color: #76b900;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  padding-bottom: 8px;
  margin-bottom: 18px;
  border-bottom: 2px solid #76b900;
  font-size: 20px;
  font-weight: 700;
  color: #000000;
}

.feature-card h4 {
  margin: 0 0 12px;
  font-size: 20px;
}

.feature-card p {
  margin: 0;
  font-size: 15px;
  line-height: 1.67;
  color: #1a1a1a;
}

.quick-start {
  padding: 24px;
  background: #000000;
  border: 1px solid #5e5e5e;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 5px 0;
  position: relative;
}

.quick-start::before {
  content: "";
  position: absolute;
  inset: 0;
  border-top: 2px solid #76b900;
  pointer-events: none;
}

.steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.step {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid #5e5e5e;
}

.step-number {
  flex-shrink: 0;
  min-width: 42px;
  font-size: 20px;
  font-weight: 700;
  color: #76b900;
}

.step-content h4 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #ffffff;
}

.step-content p {
  margin: 0;
  font-size: 15px;
  line-height: 1.67;
  color: #a7a7a7;
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .features,
  .steps {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .hero {
    padding: 24px 16px;
  }

  .hero-copy h2 {
    font-size: 28px;
  }

  .quick-start {
    padding: 20px 16px;
  }
}
</style>
