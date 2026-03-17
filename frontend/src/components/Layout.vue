<template>
  <div class="layout">
    <header class="header">
      <h1>数据爬取Agent</h1>
      <nav>
        <router-link to="/">首页</router-link>
        <router-link to="/scripts">脚本管理</router-link>
        <router-link to="/data">数据管理</router-link>
      </nav>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
}

.header {
  background: #161b22;
  color: #c9d1d9;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #30363d;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #58a6ff;
}

nav {
  display: flex;
  gap: 1.5rem;
}

nav a {
  color: #c9d1d9;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.3s;
}

nav a:hover {
  background: #21262d;
  color: #58a6ff;
}

nav a.router-link-active {
  background: #1f6feb;
  color: white;
}

.main {
  flex: 1;
  padding: 2rem;
  background: #0d1117;
}
</style>
