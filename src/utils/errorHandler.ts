/**
 * 全局错误处理工具
 */

import type { Router } from 'vue-router'

export interface ErrorLog {
  timestamp: string
  type: 'api' | 'runtime' | 'network' | 'route'
  message: string
  stack?: string
  url?: string
  statusCode?: number
  userAgent: string
}

class ErrorHandler {
  private router: Router | null = null
  private errorLogs: ErrorLog[] = []
  private maxLogs = 50 // 最多保存50条错误日志

  /**
   * 初始化错误处理器
   */
  init(router: Router) {
    this.router = router
    this.setupGlobalErrorHandlers()
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers() {
    // 捕获未处理的Promise错误
    window.addEventListener('unhandledrejection', (event) => {
      console.error('未处理的Promise错误:', event.reason)
      this.logError({
        type: 'runtime',
        message: event.reason?.message || '未处理的Promise错误',
        stack: event.reason?.stack
      })
      event.preventDefault()
    })

    // 捕获全局JavaScript错误
    window.addEventListener('error', (event) => {
      console.error('全局错误:', event.error)
      this.logError({
        type: 'runtime',
        message: event.message,
        stack: event.error?.stack,
        url: event.filename
      })
    })
  }

  /**
   * 处理API错误
   */
  handleApiError(error: any, endpoint: string, statusCode?: number) {
    const errorMessage = error?.message || '未知API错误'
    
    this.logError({
      type: 'api',
      message: errorMessage,
      url: endpoint,
      statusCode,
      stack: error?.stack
    })

    // 根据状态码跳转到错误页面（不显示具体的API端点）
    if (this.router && statusCode) {
      this.navigateToErrorPage(statusCode, this.getFriendlyErrorMessage(statusCode), endpoint)
    }
  }

  /**
   * 获取用户友好的错误提示
   */
  private getFriendlyErrorMessage(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return '请求参数有误，请检查后重试'
      case 401:
        return '未授权访问，请先登录'
      case 403:
        return '没有访问权限'
      case 404:
        return '请求的资源不存在'
      case 500:
        return '服务器内部错误，请稍后重试'
      case 502:
        return '网关错误，请稍后重试'
      case 503:
        return '服务暂时不可用，请稍后重试'
      case 504:
        return '请求超时，请检查网络后重试'
      default:
        return '请求失败，请稍后重试'
    }
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(endpoint: string) {
    this.logError({
      type: 'network',
      message: '网络连接失败',
      url: endpoint
    })

    if (this.router) {
      this.navigateToErrorPage(503, '无法连接到服务器，请检查网络或后端状态', endpoint)
    }
  }

  /**
   * 跳转到错误页面
   */
  private navigateToErrorPage(code: number, detail: string, endpoint?: string) {
    if (!this.router) return

    // 避免重复跳转到错误页面
    if (this.router.currentRoute.value.name === 'error') {
      return
    }

    this.router.push({
      name: 'error',
      params: { code: code.toString() },
      query: { detail, endpoint }
    })
  }

  /**
   * 记录错误日志
   */
  private logError(error: Omit<ErrorLog, 'timestamp' | 'userAgent'>) {
    const log: ErrorLog = {
      ...error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    }

    this.errorLogs.push(log)

    // 限制日志数量
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs.shift()
    }

    // 开发环境打印详细错误
    if (import.meta.env.DEV) {
      console.group(`🔴 错误日志 [${log.type}]`)
      console.log('时间:', log.timestamp)
      console.log('消息:', log.message)
      if (log.url) console.log('URL:', log.url)
      if (log.statusCode) console.log('状态码:', log.statusCode)
      if (log.stack) console.log('堆栈:', log.stack)
      console.groupEnd()
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs]
  }

  /**
   * 清除错误日志
   */
  clearErrorLogs() {
    this.errorLogs = []
  }

  /**
   * 导出错误日志（用于调试或上报）
   */
  exportErrorLogs(): string {
    return JSON.stringify(this.errorLogs, null, 2)
  }
}

// 导出单例
export const errorHandler = new ErrorHandler()

