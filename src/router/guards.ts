import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'

/**
 * 路由守卫配置
 */

/**
 * 全局前置守卫
 */
export function setupBeforeEach(router: Router) {
  router.beforeEach((to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
    // 页面标题设置
    if (to.meta.title) {
      document.title = `${to.meta.title} - 科研论文收集器`
    } else {
      document.title = '科研论文收集器'
    }

    // 开发环境日志
    if (import.meta.env.DEV) {
      console.log(`🚀 路由跳转: ${from.path} -> ${to.path}`)
    }

    // 防止错误页面无限循环
    if (to.name === 'error' && from.name === 'error') {
      console.warn('检测到错误页面循环，阻止跳转')
      next(false)
      return
    }

    next()
  })
}

/**
 * 全局后置守卫
 */
export function setupAfterEach(router: Router) {
  router.afterEach((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    // 页面滚动到顶部
    window.scrollTo(0, 0)

    // 开发环境日志
    if (import.meta.env.DEV) {
      console.log(`✅ 路由完成: ${to.path}`)
    }
  })
}

/**
 * 全局错误守卫
 */
export function setupErrorHandler(router: Router) {
  router.onError((error) => {
    console.error('路由错误:', error)
    
    // 跳转到错误页面
    router.push({
      name: 'error',
      params: { code: '500' },
      query: { detail: `路由加载失败: ${error.message}` }
    })
  })
}

/**
 * 初始化所有路由守卫
 */
export function setupRouterGuards(router: Router) {
  setupBeforeEach(router)
  setupAfterEach(router)
  setupErrorHandler(router)
}

