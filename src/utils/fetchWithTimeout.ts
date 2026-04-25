/**
 * 带超时的 fetch 请求封装
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number
}

export class TimeoutError extends Error {
  readonly url: string
  readonly timeout: number

  constructor(url: string, timeout: number) {
    super(`请求超时 (${timeout}ms): ${url}`)
    this.name = 'TimeoutError'
    this.url = url
    this.timeout = timeout
  }
}

export function isTimeoutError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLowerCase()
  return (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('超时')
  )
}

/**
 * 带超时控制的 fetch 请求
 * @param url 请求 URL
 * @param options 请求选项
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options

  const controller = new AbortController()
  const signal = controller.signal

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

    if (error.name === 'AbortError') {
      throw new TimeoutError(url, timeout)
    }

    throw error
  }
}

/**
 * 带重试机制的 fetch 请求
 * @param url 请求 URL
 * @param options 请求选项
 * @param retries 重试次数
 * @param retryDelay 重试延迟
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

      if (response.status >= 500 && i < retries) {
        console.warn(`请求失败 (${response.status})，${retryDelay}ms 后进行第 ${i + 1} 次重试...`)
        await delay(retryDelay)
        continue
      }

      return response
    } catch (error: any) {
      lastError = error

      if (i === retries) {
        break
      }

      console.warn(`请求失败: ${error.message}，${retryDelay}ms 后进行第 ${i + 1} 次重试...`)
      await delay(retryDelay)
    }
  }

  throw lastError || new Error('请求失败')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
