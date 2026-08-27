const AGENT_API_BASE_URL = (
  import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8002/api/agent'
).replace(/\/$/, '')

export type AgentRunStatus = 'idle' | 'streaming' | 'waiting_confirmation' | 'completed' | 'failed'
export type AgentDecision = 'approved' | 'rejected'

export interface AgentChatRequest {
  message: string
  conversation_id?: string | null
}

export interface AgentResumeRequest {
  conversation_id: string
  decision: AgentDecision
  comment?: string | null
}

export interface AgentInterrupt {
  type: string
  tool_call_id: string
  tool_name: string
  tool_arguments: Record<string, unknown>
  message: string
}

export interface AgentResponse<T = Record<string, unknown>> {
  code: number
  success: boolean
  message: string
  data: T
}

export interface AgentStreamEvent<T = Record<string, unknown>> {
  event_id: string
  sequence: number
  event: string
  conversation_id: string
  run_id: string
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

function createStreamError(response: Response): Promise<Error> {
  return createJsonError(response)
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

export const agentService = {
  streamChat(request: AgentChatRequest, handlers: AgentStreamHandlers): AgentStreamController {
    return streamRequest('/chat/stream', request, handlers)
  },
  resume(request: AgentResumeRequest): Promise<AgentResponse> {
    return jsonRequest('/chat/resume', request)
  },
  resumeStream(request: AgentResumeRequest, handlers: AgentStreamHandlers): AgentStreamController {
    return streamRequest('/chat/resume/stream', request, handlers)
  }
}
