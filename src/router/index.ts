import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SearchResultsView from '../views/SearchResultsView.vue'
import TasksView from '../views/TasksView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/search',
      name: 'search-results',
      component: SearchResultsView
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: TasksView
    }
  ]
})

export default router
