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
      path: '/editor',
      redirect: '/workflow'
    },
    {
      path: '/data',
      name: 'data',
      component: () => import('../views/DataManagement.vue')
    },
    {
      path: '/tables',
      name: 'tables',
      component: () => import('../components/DataTableManager.vue')
    },
    {
      path: '/workflow',
      name: 'workflow',
      component: () => import('../components/workflow/WorkflowEditor.vue')
    },
    {
      path: '/page-builder',
      name: 'page-builder',
      component: () => import('../views/PageBuilderView.vue')
    },
    {
      path: '/page-builder-preview-host/:sessionId',
      name: 'page-builder-preview-host',
      component: () => import('../views/PageBuilderPreviewHost.vue')
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('../views/WorkflowJsonTest.vue')
    }
  ]
});

export default router;
