import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PaperTagValue, SourceTag } from '@/constants/searchTagMappings'
import {
  agentService,
  type AgentCardSubagent,
  type AgentCardTimelineStep,
  type AgentConversationMessage,
  type AgentConversationMessageMeta,
  type AgentInterrupt,
  type AgentRunStatus,
  type AgentStreamController,
  type AgentStreamEvent
} from '@/services/agentService'

export interface FilterSnapshot {
  yearTag: number
  paperTags: PaperTagValue[]
  sourceTags: SourceTag[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  runId?: string
  assistantMessageId?: number
  filters?: FilterSnapshot
  reasoning?: string
  thinkingStartedAt?: number
  thinkingCompletedAt?: number
  reasoningExpanded?: boolean
  artifacts?: string[]
  executionCard?: HistoricalExecutionCard
}

export interface TimelineStep {
  stepId: string
  label: string
  state: 'started' | 'completed' | 'failed'
  error: string | null
}

export interface HistoricalExecutionStep extends TimelineStep {
  startSeq: number | null
  endSeq: number | null
}

export interface HistoricalExecutionActivity {
  id: string
  kind: 'tool' | 'subagent'
  name: string
  status: string
  startSeq: number | null
  endSeq: number | null
  summary: string | null
  artifacts: string[]
  error: string | null
  phaseLabel: string | null
  progressPercent: number | null
  taskId: string | number | null
  warnings: string[]
  detailsExpanded?: boolean
  timeline: HistoricalExecutionStep[]
  timelineExpanded?: boolean
}

export interface HistoricalExecutionCard {
  status: string
  latencyMs: number | null
  iterations: number | null
  model: string | null
  provider: string | null
  reasoning: string[]
  activities: HistoricalExecutionActivity[]
  artifacts: string[]
  pendingAction: AgentInterrupt | null
  error: string | null
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : []
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function historicalStep(step: AgentCardTimelineStep): HistoricalExecutionStep {
  const state = step.state === 'completed' ? 'completed' : step.state === 'failed' ? 'failed' : 'started'
  return {
    stepId: step.step_id,
    label: asNullableString(step.label) || step.step_key || step.step_id,
    state,
    error: asNullableString(step.error),
    startSeq: asNullableNumber(step.start_seq),
    endSeq: asNullableNumber(step.end_seq)
  }
}

function subagentDisplayName(subagent: AgentCardSubagent): string {
  if (subagent.name === 'paper_search_agent') return '论文检索子代理'
  if (subagent.name === 'task_review_agent') return '文献综述子代理'
  return asNullableString(subagent.name) || asNullableString(subagent.workflow) || '子代理'
}

function historicalExecutionCard(meta: AgentConversationMessageMeta | null): HistoricalExecutionCard | undefined {
  if (meta?.schema_version !== 1 || !meta.card) return undefined

  const card = meta.card
  const tools: HistoricalExecutionActivity[] = (card.tools || []).map((tool) => ({
    id: `tool:${tool.action_id}`,
    kind: 'tool',
    name: asNullableString(tool.name) || '工具调用',
    status: tool.status,
    startSeq: asNullableNumber(tool.start_seq),
    endSeq: asNullableNumber(tool.end_seq),
    summary: asNullableString(tool.summary),
    artifacts: asStringList(tool.artifact_refs),
    error: asNullableString(tool.error_message) || asNullableString(tool.error_code),
    phaseLabel: null,
    progressPercent: null,
    taskId: null,
    warnings: [],
    timeline: []
  }))
  const subagents: HistoricalExecutionActivity[] = (card.subagents || []).map((subagent, index) => ({
    id: `subagent:${subagent.delegation_id || subagent.workflow || index}`,
    kind: 'subagent',
    name: subagentDisplayName(subagent),
    status: subagent.status,
    startSeq: asNullableNumber(subagent.start_seq),
    endSeq: asNullableNumber(subagent.end_seq),
    summary: asNullableString(subagent.summary),
    artifacts: asStringList(subagent.artifact_refs),
    error: asNullableString(subagent.error) || asNullableString(subagent.error_message) || asNullableString(subagent.error_code),
    phaseLabel: asNullableString(subagent.phase_label),
    progressPercent: asNullableNumber(subagent.progress_percent),
    taskId: typeof subagent.task_id === 'string' || typeof subagent.task_id === 'number' ? subagent.task_id : null,
    warnings: asStringList(subagent.warnings),
    detailsExpanded: subagent.status === 'running',
    timeline: (subagent.timeline || []).map(historicalStep).sort((left, right) =>
      (left.startSeq ?? Number.MAX_SAFE_INTEGER) - (right.startSeq ?? Number.MAX_SAFE_INTEGER)
    ),
    timelineExpanded: subagent.status === 'running'
  }))

  return {
    status: card.status,
    latencyMs: asNullableNumber(card.latency_ms),
    iterations: asNullableNumber(card.iterations),
    model: asNullableString(card.model),
    provider: asNullableString(card.provider),
    reasoning: (card.reasoning || [])
      .map((item) => asNullableString(item.text))
      .filter((item): item is string => Boolean(item)),
    activities: [...tools, ...subagents].sort((left, right) =>
      (left.startSeq ?? Number.MAX_SAFE_INTEGER) - (right.startSeq ?? Number.MAX_SAFE_INTEGER)
    ),
    artifacts: asStringList(card.artifact_refs),
    pendingAction: card.pending_action || null,
    error: asNullableString(card.error)
  }
}

function liveExecutionCard(): HistoricalExecutionCard {
  return {
    status: 'running',
    latencyMs: null,
    iterations: null,
    model: null,
    provider: null,
    reasoning: [],
    activities: [],
    artifacts: [],
    pendingAction: null,
    error: null
  }
}

export const useAgentChatStore = defineStore('agentChat', () => {
  const messages = ref<ChatMessage[]>([])
  const runStatus = ref<AgentRunStatus>('idle')
  const conversationId = ref<string | null>(null)
  const pendingConfirmation = ref<AgentInterrupt | null>(null)
  const confirmationComment = ref('')
  const activeRunId = ref<string | null>(null)
  const streamController = ref<AgentStreamController | null>(null)
  let activeAssistantMessageId: string | null = null

  const isRunning = computed(() => runStatus.value === 'streaming')
  const hasConversation = computed(
    () =>
      messages.value.length > 0 ||
      Boolean(pendingConfirmation.value)
  )

  function clearStream() {
    streamController.value?.abort()
    streamController.value = null
  }

  function markStreamDetached() {
    finalizeActiveThinking()
    runStatus.value = 'detached'
    const card = activeExecutionCard()
    if (card) {
      card.status = 'detached'
      card.error = '实时连接已断开，任务仍在后台执行。'
    }
    streamController.value = null
  }

  function isNetworkDisconnect(error: Error) {
    return error.name === 'TypeError'
  }

  function addMessage(role: ChatMessage['role'], content: string, filters?: FilterSnapshot) {
    messages.value.push({
      id: crypto.randomUUID(),
      role,
      content,
      filters: filters && {
        yearTag: filters.yearTag,
        paperTags: [...filters.paperTags],
        sourceTags: [...filters.sourceTags]
      }
    })
  }

  function getActiveAssistantMessage() {
    return messages.value.find((message) => message.id === activeAssistantMessageId)
  }

  function initializeAssistantMessage(
    runId: string | null = activeRunId.value,
    assistantMessageId: number | null | undefined = undefined
  ) {
    const current = getActiveAssistantMessage()
    if (current && (
      (assistantMessageId != null && current.assistantMessageId === assistantMessageId) ||
      (assistantMessageId == null && (!runId || current.runId === runId))
    )) return current

    if (assistantMessageId != null) {
      const persistedMessage = messages.value.find((message) =>
        message.role === 'assistant' && message.assistantMessageId === assistantMessageId
      )
      if (persistedMessage) {
        const card = persistedMessage.executionCard
        if (card?.status === 'confirmation_required') {
          card.status = 'running'
          card.pendingAction = null
          card.error = null
        }
        activeAssistantMessageId = persistedMessage.id
        return persistedMessage
      }
    }

    if (runId) {
      const resumedMessage = [...messages.value]
        .reverse()
        .find((message) =>
          message.role === 'assistant' &&
          message.runId === runId &&
          message.executionCard?.status === 'confirmation_required'
        )
      if (resumedMessage) {
        const card = resumedMessage.executionCard
        if (card) {
          card.status = 'running'
          card.pendingAction = null
          card.error = null
        }
        activeAssistantMessageId = resumedMessage.id
        return resumedMessage
      }
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      runId: runId || undefined,
      assistantMessageId: assistantMessageId ?? undefined,
      thinkingStartedAt: Date.now(),
      reasoningExpanded: true,
      executionCard: liveExecutionCard()
    }
    messages.value.push(message)
    activeAssistantMessageId = message.id
    return message
  }

  function finalizeActiveThinking() {
    const message = getActiveAssistantMessage()
    if (message && !message.thinkingCompletedAt) {
      message.thinkingCompletedAt = Date.now()
      message.reasoningExpanded = false
    }
  }

  function appendDelta(field: 'reasoning' | 'content', delta: unknown) {
    if (typeof delta !== 'string' || !delta) return
    const message = initializeAssistantMessage()
    message[field] = `${message[field] || ''}${delta}`
    if (field === 'reasoning' && message.executionCard) {
      message.executionCard.reasoning = [message.reasoning || '']
    }
  }

  function extractFinalContent(data: Record<string, unknown>) {
    const response = data.response && typeof data.response === 'object' ? data.response : data
    const candidate = response as Record<string, unknown>
    return [candidate.reply, candidate.content, candidate.message].find(
      (value): value is string => typeof value === 'string' && Boolean(value)
    )
  }

  function activeExecutionCard() {
    return getActiveAssistantMessage()?.executionCard
  }

  function activityId(kind: HistoricalExecutionActivity['kind'], data: Record<string, unknown>) {
    const rawId = kind === 'subagent'
      ? data.delegation_id || data.action_id || data.child_thread_id
      : data.action_id
    return typeof rawId === 'string' && rawId ? `${kind}:${rawId}` : null
  }

  function activityName(kind: HistoricalExecutionActivity['kind'], data: Record<string, unknown>) {
    const rawName = typeof data.name === 'string'
      ? data.name
      : typeof data.subagent === 'string'
        ? data.subagent
        : ''
    if (kind === 'subagent' && rawName === 'paper_search_agent') return '论文检索子代理'
    if (kind === 'subagent' && rawName === 'task_review_agent') return '文献综述子代理'
    return rawName || (kind === 'subagent' ? '子代理' : '工具调用')
  }

  function upsertExecutionActivity(
    kind: HistoricalExecutionActivity['kind'],
    data: Record<string, unknown>,
    sequence: number
  ) {
    const card = activeExecutionCard()
    const id = activityId(kind, data)
    if (!card || !id) return undefined

    let item = card.activities.find((activityItem) => activityItem.id === id)
    if (!item) {
      item = {
        id,
        kind,
        name: activityName(kind, data),
        status: 'running',
        startSeq: sequence,
        endSeq: null,
        summary: null,
        artifacts: [],
        error: null,
        phaseLabel: null,
        progressPercent: null,
        taskId: null,
        warnings: [],
        detailsExpanded: true,
        timeline: [],
        timelineExpanded: true
      }
      card.activities.push(item)
    }
    return item
  }

  function updateExecutionAction(event: AgentStreamEvent, data: Record<string, unknown>, terminal = false) {
    const kind: HistoricalExecutionActivity['kind'] = data.action_type === 'subagent' ? 'subagent' : 'tool'
    const item = upsertExecutionActivity(kind, data, event.sequence)
    if (!item) return

    item.name = activityName(kind, data)
    if (terminal) {
      item.status = typeof data.status === 'string' ? data.status : 'failed'
      item.endSeq = event.sequence
      item.summary = asNullableString(data.summary)
      item.artifacts = asStringList(data.artifact_refs)
      item.error = asNullableString(data.error_message) || asNullableString(data.error_code)
    }
  }

  function updateExecutionSubagent(event: AgentStreamEvent, data: Record<string, unknown>) {
    const item = upsertExecutionActivity('subagent', data, event.sequence)
    if (!item) return

    item.name = activityName('subagent', data)
    item.status = typeof data.status === 'string' ? data.status : item.status
    item.phaseLabel = asNullableString(data.phase_label)
    item.progressPercent = asNullableNumber(data.progress_percent)
    item.taskId = typeof data.task_id === 'string' || typeof data.task_id === 'number' ? data.task_id : null
    item.warnings = asStringList(data.warnings)
    item.error = asNullableString(data.error) || asNullableString(data.task_status_update_error) || asNullableString(data.pdf_cleanup_error)
  }

  function updateExecutionTimeline(event: AgentStreamEvent, data: Record<string, unknown>) {
    const item = upsertExecutionActivity('subagent', data, event.sequence)
    const stepId = asNullableString(data.step_id)
    if (!item || !stepId) return

    const state = data.state === 'completed' ? 'completed' : data.state === 'failed' ? 'failed' : 'started'
    let step = item.timeline.find((timelineItem) => timelineItem.stepId === stepId)
    if (!step) {
      step = {
        stepId,
        label: asNullableString(data.label) || stepId,
        state,
        error: null,
        startSeq: event.sequence,
        endSeq: null
      }
      item.timeline.push(step)
    }
    step.state = state
    if (state !== 'started') {
      step.endSeq = event.sequence
      step.error = asNullableString(data.error)
    }
  }

  function handleEvent(event: AgentStreamEvent) {
    if (event.conversation_id) conversationId.value = event.conversation_id
    const data = event.data as Record<string, unknown>
    if (event.event === 'run_started') {
      if (event.run_id) activeRunId.value = event.run_id
      initializeAssistantMessage(event.run_id || null, event.assistant_message_id)
    }
    if (event.event === 'iteration_started') {
      const card = activeExecutionCard()
      if (card && typeof data.iteration === 'number') card.iterations = data.iteration
    }
    if (event.event === 'reasoning_delta') appendDelta('reasoning', data.delta)
    if (event.event === 'content_delta') appendDelta('content', data.delta)
    if (event.event === 'timeline_step') {
      updateExecutionTimeline(event, data)
    }
    if (event.event === 'subagent_progress') {
      updateExecutionSubagent(event, data)
    }
    if (event.event === 'action_started') {
      updateExecutionAction(event, data)
    }
    if (event.event === 'confirmation_required') {
      const interrupt = data.interrupt as AgentInterrupt | undefined
      if (!interrupt) {
        runStatus.value = 'failed'
        const card = activeExecutionCard()
        if (card) {
          card.status = 'failed'
          card.error = 'Invalid confirmation request'
        }
        return
      }
      pendingConfirmation.value = interrupt
      finalizeActiveThinking()
      runStatus.value = 'waiting_confirmation'
      const card = activeExecutionCard()
      if (card) {
        card.status = 'confirmation_required'
        card.pendingAction = interrupt
        card.error = null
        const actionId = interrupt.action_id
        const activity = card.activities.find((item) => item.id.endsWith(`:${actionId}`))
        if (activity) activity.status = 'awaiting_approval'
      }
      clearStream()
    }
    if (event.event === 'action_result') {
      updateExecutionAction(event, data, true)
    }
    if (event.event === 'node_error') {
      const card = activeExecutionCard()
      if (card) card.error = asNullableString(data.error) || asNullableString(data.message)
    }
    if (event.event === 'run_completed') {
      const reply = extractFinalContent(data)
      const message = initializeAssistantMessage()
      if (reply) message.content = reply
      if (Array.isArray(data.artifact_refs)) message.artifacts = data.artifact_refs.filter(String) as string[]
      if (message.executionCard) {
        message.executionCard.status = typeof data.status === 'string' ? data.status : 'completed'
        message.executionCard.artifacts = asStringList(data.artifact_refs)
        message.executionCard.pendingAction = null
        message.executionCard.error = asNullableString(data.error)
      }
      finalizeActiveThinking()
      pendingConfirmation.value = null
      runStatus.value = 'completed'
      clearStream()
    }
    if (event.event === 'run_failed') {
      const message = initializeAssistantMessage()
      const reply = extractFinalContent(data)
      if (reply) message.content = reply
      if (message.executionCard) {
        message.executionCard.status = 'failed'
        message.executionCard.pendingAction = null
        message.executionCard.error = asNullableString(data.error)
      }
      finalizeActiveThinking()
      pendingConfirmation.value = null
      runStatus.value = 'failed'
      clearStream()
    }
  }

  function startStream(resumeRequest?: {
    decision: 'approved' | 'rejected'
    comment: string
    runId: string
    actionId: string
  }) {
    pendingConfirmation.value = null
    for (const message of messages.value) {
      if (message.runId === activeRunId.value && message.executionCard?.pendingAction) {
        message.executionCard.pendingAction = null
      }
    }
    runStatus.value = 'streaming'
    const handlers = {
      onEvent: handleEvent,
      onError: (error: Error) => {
        if (isNetworkDisconnect(error)) {
          markStreamDetached()
          return
        }

        finalizeActiveThinking()
        runStatus.value = 'failed'
        const card = activeExecutionCard()
        if (card) {
          card.status = 'failed'
          card.error = error.message
        }
        addMessage('system', `Execution failed: ${error.message}`)
        streamController.value = null
      },
      onComplete: () => {
        if (runStatus.value !== 'streaming') return
        markStreamDetached()
      }
    }
    streamController.value = resumeRequest
      ? agentService.resumeStream({
          conversation_id: conversationId.value!,
          run_id: resumeRequest.runId,
          action_id: resumeRequest.actionId,
          decision: resumeRequest.decision,
          comment: resumeRequest.comment || null
        }, handlers)
      : agentService.streamChat({ message: messages.value.at(-1)?.content || '', conversation_id: conversationId.value }, handlers)
  }

  function send(message: string, filters: FilterSnapshot) {
    if (!message || isRunning.value) return
    addMessage('user', message, filters)
    activeAssistantMessageId = null
    startStream()
  }

  function resume(decision: 'approved' | 'rejected') {
    const pendingAction = pendingConfirmation.value
    if (!conversationId.value || !activeRunId.value || !pendingAction || isRunning.value) return
    activeAssistantMessageId = null
    startStream({
      decision,
      comment: confirmationComment.value.trim(),
      runId: activeRunId.value,
      actionId: pendingAction.action_id
    })
  }

  function disconnectStream() {
    clearStream()
    markStreamDetached()
  }

  function resetConversation() {
    clearStream()
    messages.value = []
    conversationId.value = null
    pendingConfirmation.value = null
    confirmationComment.value = ''
    activeRunId.value = null
    activeAssistantMessageId = null
    runStatus.value = 'idle'
  }

  function loadConversation(historyMessages: AgentConversationMessage[]) {
    if (isRunning.value) return
    const settledRunIds = new Set(
      historyMessages
        .filter(
          (message) =>
            message.role === 'assistant' &&
            ['completed', 'failed', 'blocked', 'interrupted'].includes(message.status)
        )
        .map((message) => message.run_id)
    )
    const latestAssistantByRun = new Map<string, number>()
    for (const message of historyMessages) {
      if (message.role === 'assistant') latestAssistantByRun.set(message.run_id, message.id)
    }
    messages.value = historyMessages
      .filter((message) => message.role !== 'assistant' || latestAssistantByRun.get(message.run_id) === message.id)
      .map((message) => {
      const executionCard = historicalExecutionCard(message.meta)
      if (executionCard?.pendingAction && settledRunIds.has(message.run_id)) {
        executionCard.pendingAction = null
      }
      const isRunningPlaceholder =
        message.role === 'assistant' && message.status === 'running' && !message.content.trim()
      return {
        id: `history-${message.id}`,
        role: message.role,
        content: isRunningPlaceholder ? '任务正在后台执行，完成后会写入会话历史。' : message.content,
        runId: message.run_id,
        assistantMessageId: message.role === 'assistant' ? message.id : undefined,
        artifacts: executionCard?.artifacts.length
          ? executionCard.artifacts
          : asStringList(message.meta?.artifact_refs),
        executionCard
      }
      })
    conversationId.value = historyMessages[0]?.conversation_id || null
    pendingConfirmation.value = null
    confirmationComment.value = ''
    activeRunId.value = null
    activeAssistantMessageId = null
    const visibleHistory = historyMessages.filter(
      (message) => message.role !== 'assistant' || latestAssistantByRun.get(message.run_id) === message.id
    )
    const latestAssistantMessage = [...visibleHistory]
      .reverse()
      .find((message) => message.role === 'assistant')
    if (
      latestAssistantMessage?.status === 'confirmation_required' &&
      latestAssistantMessage.meta?.card?.pending_action
    ) {
      pendingConfirmation.value = latestAssistantMessage.meta.card.pending_action
      activeRunId.value = latestAssistantMessage.run_id
      runStatus.value = 'waiting_confirmation'
      return
    }

    if (latestAssistantMessage?.status === 'running') {
      activeRunId.value = latestAssistantMessage.run_id
      runStatus.value = 'detached'
      return
    }

    runStatus.value = 'idle'
  }

  return {
    messages, runStatus, conversationId, pendingConfirmation, confirmationComment, activeRunId, isRunning,
    hasConversation, send, resume, disconnectStream,
    resetConversation, loadConversation
  }
})
