import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SearchResultsView from '../views/SearchResultsView.vue'
import TasksView from '../views/TasksView.vue'
import ReviewTaskView from '../views/ReviewTaskView.vue'
import ReviewDetailView from '../views/ReviewDetailView.vue'
import DocumentView from '../views/DocumentView.vue'
import ErrorView from '../views/ErrorView.vue'
import { setupRouterGuards } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: '首页' }
    },
    {
      path: '/search',
      name: 'search-results',
      component: SearchResultsView,
      meta: { title: '搜索结果' }
    },
    {
      path: '/document',
      name: 'document',
      component: DocumentView,
      meta: { title: '文档查看' }
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: TasksView,
      meta: { title: '任务管理' }
    },
    {
      path: '/reviews',
      name: 'review-tasks',
      component: ReviewTaskView,
      meta: { title: '综述任务' }
    },
    {
      path: '/reviews/:id',
      name: 'review-detail',
      component: ReviewDetailView,
      meta: { title: '综述详情' }
    },
    {
      path: '/error/:code?',
      name: 'error',
      component: ErrorView,
      props: true,
      meta: { title: '错误' }
    },
    {
      // 404 catch-all
      path: '/:pathMatch(.*)*',
      redirect: '/error/404'
    }
  ]
})

// 设置路由守卫
setupRouterGuards(router)

export default router
