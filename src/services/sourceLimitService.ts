const AGENT_API_BASE_URL = (
  import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8002/api/agent'
).replace(/\/$/, '')

const SETTINGS_API_BASE_URL = (
  import.meta.env.VITE_LLM_PROFILE_API_BASE_URL ||
  AGENT_API_BASE_URL.replace(/\/api\/agent$/, '/api/settings')
).replace(/\/$/, '')

export type SourceLimitName = 'arxiv' | 'dblp' | 'google_scholar'

export type SourceLimits = Record<SourceLimitName, number>

export interface SourceLimitsView {
  limits: SourceLimits
  page_sizes: SourceLimits
  maximum_limits: SourceLimits
}

interface ServiceResponse<T> {
  code: number
  success: boolean
  message: string
  data: T
}

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as { message?: unknown; detail?: unknown }
    if (typeof value.message === 'string' && value.message) return value.message
    if (typeof value.detail === 'string' && value.detail) return value.detail
    if (Array.isArray(value.detail)) {
      const details = value.detail
        .map((item) => (typeof item === 'object' && item !== null ? (item as { msg?: unknown }).msg : null))
        .filter((item): item is string => typeof item === 'string')
      if (details.length) return details.join('；')
    }
  }
  return `来源上限请求失败（${status}）`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SETTINGS_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  })

  const payload = (await response.json().catch(() => null)) as ServiceResponse<T> | unknown
  if (!response.ok) throw new Error(errorMessage(payload, response.status))
  if (!payload || typeof payload !== 'object' || !('success' in payload)) {
    throw new Error('来源上限服务返回了无效响应')
  }

  const envelope = payload as ServiceResponse<T>
  if (!envelope.success || envelope.code !== 0) {
    throw new Error(envelope.message || '来源上限请求失败')
  }
  return envelope.data
}

export const sourceLimitService = {
  get(): Promise<SourceLimitsView> {
    return request('/source-limits')
  },

  update(limits: SourceLimits): Promise<SourceLimitsView> {
    return request('/source-limits', {
      method: 'PUT',
      body: JSON.stringify(limits)
    })
  }
}
