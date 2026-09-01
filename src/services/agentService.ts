const AGENT_API_BASE_URL = (
  import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8002/api/agent'
).replace(/\/$/, '')

export type AgentRunStatus = 'idle' | 'streaming' | 'detached' | 'waiting_confirmation' | 'completed' | 'failed'
export type AgentDecision = 'approved' | 'rejected'

export interface AgentChatRequest {
  message: string
  conversation_id?: string | null
}

export interface AgentResumeRequest {
  conversation_id: string
  run_id: string
  action_id: string
  decision: AgentDecision
  comment?: string | null
}

export interface AgentInterrupt {
  action_id: string
  action_type: 'tool' | 'subagent'
  kind?: 'tool' | 'subagent'
  name: string
  display_name?: string
  summary?: string
  requires_confirmation?: boolean
  status?: string
}

export interface AgentResponse<T = Record<string, unknown>> {
  code: number
  success: boolean
  message: string
  data: T
}

export interface AgentConversationSummary {
  conversation_id: string
  title: string
  last_message_preview: string
  message_count: number
  last_message_at: string
}

export interface AgentConversationListData {
  items: AgentConversationSummary[]
}

export type AgentConversationMessageStatus =
  | 'running'
  | 'completed'
  | 'confirmation_required'
  | 'failed'
  | 'blocked'
  | 'interrupted'

export interface AgentCardReasoning {
  reasoning_id: string
  scope: string
  start_seq: number | null
  end_seq: number | null
  text: string
}

export interface AgentCardTimelineStep {
  step_id: string
  step_key?: string | null
  label?: string | null
  iteration?: number | null
  state: string
  start_seq: number | null
  end_seq: number | null
  error?: string | null
}

export interface AgentCardTool {
  action_id: string
  name?: string | null
  status: string
  start_seq: number | null
  end_seq: number | null
  summary?: string | null
  artifact_refs?: string[]
  error_code?: string | null
  error_message?: string | null
}

export interface AgentCardSubagent {
  delegation_id?: string | null
  workflow?: string | null
  name?: string | null
  status: string
  start_seq: number | null
  end_seq: number | null
  phase?: string | null
  phase_label?: string | null
  progress_percent?: number | null
  iteration?: number | null
  task_id?: string | number | null
  warnings?: string[]
  error?: string | null
  summary?: string | null
  artifact_refs?: string[]
  error_code?: string | null
  error_message?: string | null
  timeline?: AgentCardTimelineStep[]
}

export interface AgentExecutionCardMeta {
  status: string
  latency_ms?: number
  iterations?: number
  model?: string | null
  provider?: string | null
  reasoning?: AgentCardReasoning[]
  tools?: AgentCardTool[]
  subagents?: AgentCardSubagent[]
  artifact_refs?: string[]
  pending_action?: AgentInterrupt | null
  error?: string | null
}

export interface AgentConversationMessageMeta {
  artifact_refs?: string[]
  schema_version?: number
  card?: AgentExecutionCardMeta
  latency_ms?: number
  error?: string | null
}

export interface AgentConversationMessage {
  id: number
  conversation_id: string
  run_id: string
  role: 'user' | 'assistant'
  content: string
  status: AgentConversationMessageStatus
  source: string
  meta: AgentConversationMessageMeta | null
  created_at: string
}

export interface AgentConversationMessagesData {
  conversation_id: string
  items: AgentConversationMessage[]
  next_before_id: number | null
}

export interface AgentStreamEvent<T = Record<string, unknown>> {
  event_id: string
  sequence: number
  event: string
  conversation_id: string
  run_id: string
  assistant_message_id?: number | null
  timestamp: string
  data: T
}

export interface AgentStreamHandlers {
  onEvent: (event: AgentStreamEvent) => void
  onError: (error: Error) => void
  onComplete?: () => void
}

export interface AgentStreamController {
  abort: () => void
  finished: Promise<void>
}

function createJsonError(response: Response): Promise<Error> {
  return response.text().then((body) => {
    try {
      const payload = JSON.parse(body) as { message?: string }
      return new Error(payload.message || `Agent 请求失败（${response.status}）`)
    } catch {
      return new Error(`Agent 请求失败（${response.status}）`)
    }
  })
}

async function createStreamError(response: Response): Promise<Error> {
  const error = await createJsonError(response)
  error.name = 'AgentStreamHttpError'
  return error
}

function streamRequest(
  path: string,
  body: AgentChatRequest | AgentResumeRequest,
  handlers: AgentStreamHandlers
): AgentStreamController {
  const controller = new AbortController()
  const receivedEventIds = new Set<string>()

  const finished = (async () => {
    try {
      const response = await fetch(`${AGENT_API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        throw await createStreamError(response)
      }
      if (!response.body) {
        throw new Error('Agent 服务未返回可读取的数据流')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = ''
      let dataLines: string[] = []

      const flushEvent = () => {
        if (!dataLines.length) {
          eventName = ''
          return
        }

        const rawData = dataLines.join('\n')
        dataLines = []

        try {
          const event = JSON.parse(rawData) as AgentStreamEvent
          if (!event.event) event.event = eventName
          if (!event.event_id || receivedEventIds.has(event.event_id)) return
          receivedEventIds.add(event.event_id)
          handlers.onEvent(event)
        } catch {
          throw new Error('Agent 服务返回了无法解析的流事件')
        } finally {
          eventName = ''
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })

        let lineEnd = buffer.indexOf('\n')
        while (lineEnd !== -1) {
          const line = buffer.slice(0, lineEnd).replace(/\r$/, '')
          buffer = buffer.slice(lineEnd + 1)
          lineEnd = buffer.indexOf('\n')

          if (!line) {
            flushEvent()
          } else if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }

        if (done) {
          if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).trimStart())
          flushEvent()
          break
        }
      }

      handlers.onComplete?.()
    } catch (error) {
      if (controller.signal.aborted) return
      handlers.onError(error instanceof Error ? error : new Error('Agent 流连接失败'))
    }
  })()

  return { abort: () => controller.abort(), finished }
}

async function jsonRequest<T>(path: string, body: AgentResumeRequest): Promise<AgentResponse<T>> {
  const response = await fetch(`${AGENT_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw await createJsonError(response)
  }

  return (await response.json()) as AgentResponse<T>
}

async function getJsonRequest<T>(path: string): Promise<AgentResponse<T>> {
  const response = await fetch(`${AGENT_API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    throw await createJsonError(response)
  }

  return (await response.json()) as AgentResponse<T>
}

export const agentService = {
  streamChat(request: AgentChatRequest, handlers: AgentStreamHandlers): AgentStreamController {
    return streamRequest('/chat/stream', request, handlers)
  },
  resume(request: AgentResumeRequest): Promise<AgentResponse> {
    return jsonRequest('/chat/resume', request)
  },
  resumeStream(request: AgentResumeRequest, handlers: AgentStreamHandlers): AgentStreamController {
    return streamRequest('/chat/resume/stream', request, handlers)
  },
  getConversations(limit: number = 30): Promise<AgentResponse<AgentConversationListData>> {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
    return getJsonRequest(`/conversations?limit=${safeLimit}`)
  },
  getConversationMessages(
    conversationId: string,
    options: { limit?: number; beforeId?: number } = {}
  ): Promise<AgentResponse<AgentConversationMessagesData>> {
    if (!conversationId) throw new Error('会话 ID 不能为空')

    const params = new URLSearchParams({
      limit: String(Math.min(100, Math.max(1, Math.trunc(options.limit ?? 100))))
    })
    if (options.beforeId !== undefined) params.set('before_id', String(options.beforeId))

    return getJsonRequest(`/conversations/${encodeURIComponent(conversationId)}/messages?${params}`)
  }
}
