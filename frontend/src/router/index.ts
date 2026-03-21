import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/scripts',
      name: 'scripts',
      component: () => import('../views/ScriptManagement.vue')
    },
    {
      path: '/data',
      name: 'data',
      component: () => import('../views/DataManagement.vue')
    },
    {
      path: '/workflow',
      name: 'workflow',
      component: () => import('../components/workflow/WorkflowEditor.vue')
    }
  ]
});

export default router;
