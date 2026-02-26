/**
 * 带超时的 fetch 请求封装
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number // 超时时间（毫秒），默认30秒
}

/**
 * 带超时控制的 fetch 请求
 * @param url 请求URL
 * @param options 请求选项（包含timeout）
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options

  // 创建 AbortController 用于取消请求
  const controller = new AbortController()
  const signal = controller.signal

  // 设置超时定时器
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal
    })

    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)

    // 判断是否为超时错误
    if (error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout}ms): ${url}`)
    }

    throw error
  }
}

/**
 * 带重试机制的 fetch 请求
 * @param url 请求URL
 * @param options 请求选项
 * @param retries 重试次数，默认3次
 * @param retryDelay 重试延迟（毫秒），默认1000ms
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions = {},
  retries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options)

      // 如果是5xx错误，进行重试
      if (response.status >= 500 && i < retries) {
        console.warn(`请求失败 (${response.status})，${retryDelay}ms后进行第${i + 1}次重试...`)
        await delay(retryDelay)
        continue
      }

      return response
    } catch (error: any) {
      lastError = error
      
      // 如果是最后一次重试，直接抛出错误
      if (i === retries) {
        break
      }

      console.warn(`请求失败: ${error.message}，${retryDelay}ms后进行第${i + 1}次重试...`)
      await delay(retryDelay)
    }
  }

  throw lastError || new Error('请求失败')
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

