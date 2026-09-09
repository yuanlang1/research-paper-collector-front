const AGENT_API_BASE_URL = (
  import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8002/api/agent'
).replace(/\/$/, '')

const LLM_PROFILE_API_BASE_URL = (
  import.meta.env.VITE_LLM_PROFILE_API_BASE_URL ||
  AGENT_API_BASE_URL.replace(/\/api\/agent$/, '/api/settings')
).replace(/\/$/, '')

export type LlmProvider = 'openai' | 'deepseek'

export interface LlmProfile {
  id: number
  name: string
  provider: LlmProvider
  base_url: string
  model: string
  key_set: boolean
  key_last4: string
  enabled: boolean
  is_default: boolean
  is_small_model: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface LlmProfileInput {
  name: string
  provider: LlmProvider
  base_url?: string | null
  model: string
  api_key: string
  enabled: boolean
  is_default: boolean
  is_small_model: boolean
}

export interface LlmProfileUpdate {
  name?: string
  provider?: LlmProvider
  base_url?: string | null
  model?: string
  api_key?: string
  enabled?: boolean
  is_default?: boolean
  is_small_model?: boolean
}

export interface LlmProfileConnectionTest {
  ok: boolean
  model_count: number | null
  message: string | null
}

interface ServiceResponse<T> {
  code: number
  success: boolean
  message: string
  data: T
}

interface LlmProfileListData {
  items: LlmProfile[]
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
  return `LLM 配置请求失败（${status}）`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${LLM_PROFILE_API_BASE_URL}${path}`, {
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
    throw new Error('LLM 配置服务返回了无效响应')
  }

  const envelope = payload as ServiceResponse<T>
  if (!envelope.success || envelope.code !== 0) {
    throw new Error(envelope.message || 'LLM 配置请求失败')
  }
  return envelope.data
}

export const llmProfileService = {
  async list(): Promise<LlmProfile[]> {
    return (await request<LlmProfileListData>('/llm-profiles')).items
  },

  create(input: LlmProfileInput): Promise<LlmProfile> {
    return request('/llm-profiles', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  },

  update(profileId: number, input: LlmProfileUpdate): Promise<LlmProfile> {
    return request(`/llm-profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    })
  },

  remove(profileId: number): Promise<{ id: number; deleted: boolean }> {
    return request(`/llm-profiles/${profileId}`, { method: 'DELETE' })
  },

  setDefault(profileId: number): Promise<LlmProfile> {
    return request(`/llm-profiles/${profileId}/set-default`, { method: 'POST' })
  },

  test(profileId: number): Promise<LlmProfileConnectionTest> {
    return request(`/llm-profiles/${profileId}/test`, { method: 'POST' })
  }
}
