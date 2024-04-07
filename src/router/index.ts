import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// createRouter创建路由实例

// import.meta.env.BASE_URL 是vite中的环境变量
const routes: RouteRecordRaw[] = [ // 登录页

  {
    path: '/',
    component: () => import('@/views/LayoutContainer.vue'),
    
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
