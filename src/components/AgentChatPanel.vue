<template>
  <section class="agent-chat-panel" :class="{ 'has-conversation': hasConversation }">
    <header class="chat-header">
      <div>
        <p class="chat-eyebrow">Paper Research</p>
        <h2 v-if="!hasConversation">今天想研究什么？</h2>
      </div>
      <div class="chat-header-actions">
        <span v-if="hasConversation" class="chat-status" :class="`chat-status-${runStatus}`">{{
          statusLabel
        }}</span>
      </div>
    </header>

    <div ref="messageListRef" class="message-list" aria-live="polite">
      <div v-if="!messages.length" class="chat-empty">
        <strong>告诉我你的研究需求</strong>
        <span>例如：帮我找近五年 RAG 幻觉检测论文，并推荐 20 篇。</span>
      </div>
      <article
        v-for="message in messages"
        :key="message.id"
        class="chat-message"
        :class="`chat-message-${message.role}`"
      >
        <span class="message-role">{{
          message.role === 'user' ? '你' : message.role === 'assistant' ? '论文研究助手' : '系统'
        }}</span>
        <div v-if="message.role === 'assistant' && (hasReasoning(message) || message.thinkingStartedAt)" class="thinking-reasoning">
          <button
            class="thinking-reasoning-header"
            :class="{ 'is-clickable': isThinkingComplete(message) }"
            type="button"
            :aria-expanded="isReasoningExpanded(message)"
            :aria-label="isReasoningExpanded(message) ? '收起推理过程' : '展开推理过程'"
            @click="toggleReasoning(message)"
          >
            <span v-if="!message.thinkingStartedAt" class="thinking-reasoning-label">思考过程</span>
            <span v-else-if="isThinkingComplete(message)" class="thinking-reasoning-label">
              思考了 {{ getThinkingSeconds(message) }} 秒
            </span>
            <span v-else class="thinking-reasoning-label thinking-reasoning-shimmer">思考中…</span>
            <svg
              v-if="isThinkingComplete(message)"
              class="thinking-reasoning-chevron"
              :class="{ 'is-expanded': isReasoningExpanded(message) }"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <path d="m4.5 15.75 7.5-7.5 7.5 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <Transition name="reasoning-collapse">
            <div v-if="isReasoningExpanded(message)" class="thinking-reasoning-body">
              <div class="thinking-reasoning-viewport">
                <p v-for="(line, index) in reasoningLines(reasoningText(message))" :key="`${message.id}-${index}`" class="thinking-reasoning-line">
                  {{ line }}
                </p>
              </div>
            </div>
          </Transition>
        </div>
        <div
          v-if="message.content && !message.executionCard"
          class="message-content markdown-body"
          :class="{ 'is-streaming': isMessageStreaming(message) }"
          v-html="renderMarkdown(message.content)"
        ></div>
        <button
          v-if="message.role === 'user' && canReuseMessage"
          class="message-reuse-trigger"
          type="button"
          aria-label="复用此消息与筛选条件"
          title="复用此消息与筛选条件"
          @click="reuseMessage(message)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="m14.7 4.3 5 5M4.5 19.5l3.2-.8L19.4 7a2.1 2.1 0 0 0-3-3L4.7 15.7l-.2 3.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <section v-if="message.executionCard" class="execution-card">
          <header class="execution-card-header">
            <span class="execution-status" :class="`execution-status-${executionStatusTone(message.executionCard.status)}`">
              {{ executionStatusLabel(message.executionCard.status) }}
            </span>
          </header>

          <p v-if="message.executionCard.iterations || message.executionCard.latencyMs" class="execution-card-meta">
            <span v-if="message.executionCard.iterations">{{ message.executionCard.iterations }} 轮推理</span>
            <span v-if="message.executionCard.iterations && message.executionCard.latencyMs"> · </span>
            <span v-if="message.executionCard.latencyMs">{{ formatDuration(message.executionCard.latencyMs) }}</span>
          </p>
          <section
            v-if="message.executionCard.memory"
            class="memory-retrieval"
            :class="`memory-retrieval-${memoryRetrievalTone(message.executionCard.memory.status)}`"
          >
            <span class="memory-retrieval-indicator" aria-hidden="true"></span>
            <div>
              <p class="memory-retrieval-title">{{ memoryRetrievalLabel(message.executionCard.memory.status) }}</p>
              <p class="memory-retrieval-detail">{{ memoryRetrievalDetail(message.executionCard.memory) }}</p>
            </div>
          </section>
          <ol v-if="message.executionCard.activities.length" class="execution-activity-list">
            <li
              v-for="(activityItem, index) in message.executionCard.activities"
              :key="activityItem.id"
              class="execution-activity"
              :class="`execution-activity-${executionStatusTone(activityItem.status)}`"
            >
              <span class="execution-activity-rail" aria-hidden="true"></span>
              <div class="execution-activity-content">
                <p class="execution-activity-title">
                  <span class="execution-activity-index">#{{ index + 1 }}</span>
                  <span>{{ activityItem.kind === 'tool' ? '工具调用' : '子代理' }}</span>
                  <strong>{{ activityItem.name }}</strong>
                  <span class="execution-activity-status">{{ executionStatusLabel(activityItem.status) }}</span>
                </p>
                <p v-if="executionActivityDetail(activityItem)" class="execution-activity-detail">
                  {{ executionActivityDetail(activityItem) }}
                </p>
                <p v-if="activityItem.error" class="execution-activity-error">{{ activityItem.error }}</p>

                <template v-if="activityItem.kind === 'subagent'">
                  <div v-if="activityItem.summary || activityItem.warnings.length" class="execution-subagent-note">
                    <button
                      class="execution-section-toggle"
                      type="button"
                      :aria-expanded="isActivityDetailsExpanded(activityItem)"
                      @click="toggleActivityDetails(activityItem)"
                    >
                      <span>执行说明</span>
                      <svg class="execution-section-chevron" :class="{ 'is-expanded': isActivityDetailsExpanded(activityItem) }" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path d="m6.75 9 5.25 5.25L17.25 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    <div v-if="isActivityDetailsExpanded(activityItem)">
                      <p v-if="activityItem.summary">{{ activityItem.summary }}</p>
                      <p v-for="warning in activityItem.warnings" :key="warning" class="execution-subagent-warning">
                        {{ warning }}
                      </p>
                    </div>
                  </div>
                  <div v-if="activityItem.timeline.length" class="execution-workflow">
                    <button
                      class="execution-section-toggle"
                      type="button"
                      :aria-expanded="isTimelineExpanded(activityItem)"
                      @click="toggleTimeline(activityItem)"
                    >
                      <span>Workflow timeline</span>
                      <svg class="execution-section-chevron" :class="{ 'is-expanded': isTimelineExpanded(activityItem) }" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path d="m6.75 9 5.25 5.25L17.25 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    <ol v-if="isTimelineExpanded(activityItem)">
                      <li
                        v-for="step in activityItem.timeline"
                        :key="step.stepId"
                        :class="`execution-workflow-step-${step.state}`"
                      >
                        <span>{{ step.label }}</span>
                        <small>{{ executionStepLabel(step.state) }}</small>
                        <p v-if="step.error">{{ step.error }}</p>
                      </li>
                    </ol>
                  </div>
                </template>

              </div>
            </li>
          </ol>

          <article v-if="message.executionCard?.pendingAction" class="confirmation-card execution-confirmation-card">
            <p class="confirmation-title">需要你的确认</p>
            <p>将执行：{{ message.executionCard.pendingAction.display_name || message.executionCard.pendingAction.name }}</p>
            <p v-if="message.executionCard.pendingAction.summary">内容：{{ message.executionCard.pendingAction.summary }}</p>
            <textarea
              v-model="confirmationComment"
              rows="2"
              :disabled="isRunning"
              placeholder="可选备注，例如：按当前筛选条件执行"
            ></textarea>
            <div class="confirmation-actions">
              <button type="button" class="reject-button" :disabled="isRunning" @click="resume('rejected')">暂不执行</button>
              <button type="button" class="approve-button" :disabled="isRunning" @click="resume('approved')">
                {{ isRunning ? '正在继续执行…' : '允许执行' }}
              </button>
            </div>
          </article>

          <section v-if="shouldShowExecutionResult(message.executionCard.status)" class="execution-final-result">
            <p>{{ executionResultTitle(message.executionCard.status) }}</p>
            <div v-if="message.content" class="message-content markdown-body" v-html="renderMarkdown(message.content)"></div>
            <p v-else-if="message.executionCard.error" class="execution-activity-error">{{ message.executionCard.error }}</p>
          </section>
        </section>
      </article>

    </div>

    <div class="chat-composer">
      <div class="llm-profile-selector">
        <label for="llm-profile-select">模型</label>
        <select
          id="llm-profile-select"
          :value="selectedLlmProfileId"
          :disabled="llmSelectorDisabled"
          @change="selectLlmProfile"
        >
          <option v-for="profile in enabledLlmProfiles" :key="profile.id" :value="profile.id">
            {{ profile.name }}
          </option>
        </select>
      </div>
      <textarea
        ref="composerRef"
        v-model="draft"
        rows="1"
        :disabled="isRunning"
        placeholder="给论文研究助手发送消息…"
        @keydown.enter.exact.prevent="send"
        @keydown.enter.shift.exact.stop
      ></textarea>
      <button v-if="isRunning" class="stop-button" type="button" @click="disconnectStream">
        断开实时连接
      </button>
      <button
        v-if="!isRunning"
        class="send-button"
        type="button"
        :disabled="!draft.trim()"
        @click="send"
      >
        ↑
      </button>
      <div class="composer-divider"></div>
      <div class="chat-filter-slot">
        <slot name="filters" />
      </div>
      <p>Enter 发送，Shift + Enter 换行。确认时会携带当前筛选条件。</p>
    </div>
  </section>
</template>

<script lang="ts">/*
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import type { PaperTagValue, SourceTag } from '@/constants/searchTagMappings'
import {
  agentService,
  type AgentInterrupt,
  type AgentConversationMessage,
  type AgentRunStatus,
  type AgentStreamController,
  type AgentStreamEvent
} from '@/services/agentService'

interface FilterSnapshot {
  yearTag: number
  paperTags: PaperTagValue[]
  sourceTags: SourceTag[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  filters?: FilterSnapshot
  reasoning?: string
  thinkingStartedAt?: number
  thinkingCompletedAt?: number
  reasoningExpanded?: boolean
  artifacts?: string[]
}
interface TimelineStep {
  stepId: string
  label: string
  state: 'started' | 'completed' | 'failed'
  error: string | null
}

interface TimelineGroup {
  id: string
  runId: string
  workflow: string
  steps: TimelineStep[]
  collapsed: boolean
}

interface Activity {
  title: string
  detail?: string
  level?: 'normal' | 'error'
}

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true })

function renderMarkdown(content: string): string {
  return markdown.render(content)
}

const emit = defineEmits<{
  completed: []
  'update:isRunning': [value: boolean]
  'message-sent': [message: string]
  'conversation-changed': [value: boolean]
  'conversation-updated': [conversationId: string]
  'restore-filters': [filters: FilterSnapshot]
}>()
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const runStatus = ref<AgentRunStatus>('idle')
const conversationId = ref<string | null>(null)
const streamController = ref<AgentStreamController | null>(null)
const pendingConfirmation = ref<AgentInterrupt | null>(null)
const confirmationComment = ref('')
const activity = ref<Activity | null>(null)
const timelineGroups = ref<TimelineGroup[]>([])
const activeRunId = ref<string | null>(null)
const messageListRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)

const props = defineProps<{
  currentFilters: FilterSnapshot
}>()

const isRunning = computed(() => runStatus.value === 'streaming')
const canReuseMessage = computed(
  () => !isRunning.value && runStatus.value !== 'waiting_confirmation'
)
const visibleTimelineGroups = computed(() =>
  activeRunId.value
    ? timelineGroups.value.filter((group) => group.runId === activeRunId.value)
    : []
)
const hasConversation = computed(
  () =>
    messages.value.length > 0 ||
    Boolean(activity.value) ||
    Boolean(pendingConfirmation.value) ||
    visibleTimelineGroups.value.length > 0
)
const statusLabel = computed(
  () =>
    ({
      idle: '准备就绪',
      streaming: '正在执行',
      waiting_confirmation: '等待确认',
      completed: '本轮完成',
      failed: '执行失败'
    })[runStatus.value]
)

watch(isRunning, (value) => emit('update:isRunning', value), { immediate: true })
watch(hasConversation, (value) => emit('conversation-changed', value), { immediate: true })
watch(
  [messages, activity, pendingConfirmation, visibleTimelineGroups],
  () => nextTick(scrollToBottom),
  { deep: true }
)
function scrollToBottom() {
  if (messageListRef.value) messageListRef.value.scrollTop = messageListRef.value.scrollHeight
}
function addMessage(
  role: ChatMessage['role'],
  content: string,
  artifacts?: string[],
  filters?: FilterSnapshot
) {
  messages.value.push({
    id: crypto.randomUUID(),
    role,
    content,
    artifacts,
    filters: filters && {
      yearTag: filters.yearTag,
      paperTags: [...filters.paperTags],
      sourceTags: [...filters.sourceTags]
    }
  })
}
function clearStream() {
  streamController.value?.abort()
  streamController.value = null
}
function resetConversation() {
  clearStream()
  messages.value = []
  draft.value = ''
  conversationId.value = null
  pendingConfirmation.value = null
  confirmationComment.value = ''
  activity.value = null
  timelineGroups.value = []
  activeRunId.value = null
  runStatus.value = 'idle'
  nextTick(() => composerRef.value?.focus())
}

function loadConversation(historyMessages: AgentConversationMessage[]) {
  clearStream()
  messages.value = historyMessages.map((message) => ({
    id: `history-${message.id}`,
    role: message.role,
    content: message.content,
    artifacts: message.meta?.artifact_refs?.filter(String)
  }))
  conversationId.value = historyMessages[0]?.conversation_id || null
  draft.value = ''
  pendingConfirmation.value = null
  confirmationComment.value = ''
  activity.value = null
  timelineGroups.value = []
  activeRunId.value = null
  activeAssistantMessageId = null
  runStatus.value = 'idle'
  nextTick(scrollToBottom)
}
function stopStreaming() {
  finalizeActiveThinking()
  clearStream()
  runStatus.value = 'idle'
  activity.value = { title: '已停止本次执行', detail: '你可以继续输入新的需求。' }
}
let activeAssistantMessageId: string | null = null

function getActiveAssistantMessage(): ChatMessage | undefined {
  return messages.value.find((message) => message.id === activeAssistantMessageId)
}

function initializeAssistantMessage() {
  const message = getActiveAssistantMessage()
  if (message) return message

  const nextMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    thinkingStartedAt: Date.now(),
    reasoningExpanded: true
  }
  messages.value.push(nextMessage)
  activeAssistantMessageId = nextMessage.id
  return nextMessage
}

function isThinkingComplete(message: ChatMessage) {
  return Boolean(message.thinkingCompletedAt) ||
    (!message.thinkingStartedAt && Boolean(message.executionCard?.reasoning.length))
}

function isReasoningExpanded(message: ChatMessage) {
  return isThinkingComplete(message) ? Boolean(message.reasoningExpanded) : true
}

function getThinkingSeconds(message: ChatMessage) {
  const start = message.thinkingStartedAt
  const end = message.thinkingCompletedAt
  if (!start || !end) return 1
  return Math.max(1, Math.round((end - start) / 1000))
}

function reasoningLines(reasoning?: string) {
  return reasoning?.split(/\n+/).map((line) => line.trim()).filter(Boolean) || []
}

function reasoningText(message: ChatMessage) {
  return message.executionCard?.reasoning.join('\n') || message.reasoning || ''
}

function hasReasoning(message: ChatMessage) {
  return Boolean(reasoningText(message))
}

function toggleReasoning(message: ChatMessage) {
  if (!isThinkingComplete(message) || !message.reasoning) return
  message.reasoningExpanded = !message.reasoningExpanded
}

function isMessageStreaming(message: ChatMessage) {
  return message.id === activeAssistantMessageId && runStatus.value === 'streaming'
}

function appendDelta(field: 'reasoning' | 'content', delta: unknown) {
  if (typeof delta !== 'string' || !delta) return
  const message = initializeAssistantMessage()
  message[field] = `${message[field] || ''}${delta}`
}

function extractFinalContent(data: Record<string, unknown>): string | undefined {
  const response = data.response && typeof data.response === 'object' ? data.response : data
  const candidate = response as Record<string, unknown>
  return [candidate.reply, candidate.content, candidate.message]
    .find((value): value is string => typeof value === 'string' && Boolean(value))
}

function finalizeActiveThinking() {
  const message = getActiveAssistantMessage()
  if (message && !message.thinkingCompletedAt) {
    message.thinkingCompletedAt = Date.now()
    message.reasoningExpanded = false
  }
}

function markThinkingFailed() {
  finalizeActiveThinking()
}

function reuseMessage(message: ChatMessage) {
  if (message.role !== 'user' || !canReuseMessage.value) return
  draft.value = message.content
  if (message.filters) emit('restore-filters', message.filters)
  nextTick(() => {
    composerRef.value?.focus()
    composerRef.value?.select()
  })
}

function startStream(resumeRequest?: { decision: 'approved' | 'rejected'; comment: string }) {
  pendingConfirmation.value = null
  activity.value = { title: '正在连接研究 Agent…' }
  runStatus.value = 'streaming'
  const handlers = {
    onEvent: handleEvent,
    onError: (error: Error) => {
      markThinkingFailed()
      runStatus.value = 'failed'
      activity.value = { title: 'Agent 执行失败', detail: error.message, level: 'error' }
      addMessage('system', `执行失败：${error.message}`)
    }
  }
  streamController.value = resumeRequest
    ? agentService.resumeStream(
        {
          conversation_id: conversationId.value!,
          decision: resumeRequest.decision,
          comment: resumeRequest.comment || null
        },
        handlers
      )
    : agentService.streamChat(
        {
          message: draft.value.trim(),
          conversation_id: conversationId.value
        },
        handlers
      )
}
function send() {
  if (!draft.value.trim() || isRunning.value) return
  const message = draft.value.trim()
  addMessage('user', message, undefined, props.currentFilters)
  emit('message-sent', message)
  activeAssistantMessageId = null
  startStream()
  draft.value = ''
}
function resume(decision: 'approved' | 'rejected') {
  if (!conversationId.value || isRunning.value) return
  activeAssistantMessageId = null
  startStream({ decision, comment: confirmationComment.value.trim() })
}
function getCompletedStepCount(group: TimelineGroup) {
  return group.steps.filter((step) => step.state === 'completed').length
}

function getFailedStepCount(group: TimelineGroup) {
  return group.steps.filter((step) => step.state === 'failed').length
}

function getTimelineGroupStatus(group: TimelineGroup) {
  if (getFailedStepCount(group)) return 'failed'
  if (group.steps.some((step) => step.state === 'started')) return 'started'
  return 'completed'
}

function toggleTimelineGroup(group: TimelineGroup) {
  group.collapsed = !group.collapsed
}

function handleTimelineStep(event: AgentStreamEvent, data: Record<string, unknown>) {
  const runId = event.run_id
  if (!runId) return
  if (!activeRunId.value) activeRunId.value = runId
  if (runId !== activeRunId.value) return

  const stepId = typeof data.step_id === 'string' ? data.step_id : ''
  const state = data.state
  if (!stepId || (state !== 'started' && state !== 'completed' && state !== 'failed')) return

  const delegationId = typeof data.delegation_id === 'string' ? data.delegation_id : ''
  const childThreadId = typeof data.child_thread_id === 'string' ? data.child_thread_id : ''
  const groupId = delegationId || childThreadId
  if (!groupId) return

  const workflow = typeof data.workflow === 'string' ? data.workflow : 'Agent 任务'
  const label = typeof data.label === 'string' ? data.label : stepId
  const error = typeof data.error === 'string' && data.error ? data.error : null
  let group = timelineGroups.value.find((item) => item.id === groupId && item.runId === runId)
  if (!group) {
    group = { id: groupId, runId, workflow, steps: [], collapsed: false }
    timelineGroups.value.push(group)
  }

  const step = group.steps.find((item) => item.stepId === stepId)
  if (step) {
    step.state = state
    step.error = state === 'failed' ? error : null
  } else if (state === 'started') {
    group.steps.push({ stepId, label, state, error: null })
  }

  const status = getTimelineGroupStatus(group)
  group.collapsed = status === 'completed' && group.steps.length > 0
}

function handleEvent(event: AgentStreamEvent) {
  if (event.conversation_id) conversationId.value = event.conversation_id
  const data = event.data as Record<string, unknown>

  if (event.event === 'run_started') {
    if (event.run_id) activeRunId.value = event.run_id
    initializeAssistantMessage()
    activity.value = { title: 'Agent 已开始处理', detail: '正在分析你的研究需求。' }
  }
  if (event.event === 'reasoning_delta') appendDelta('reasoning', data.delta)
  if (event.event === 'content_delta') appendDelta('content', data.delta)
  if (event.event === 'timeline_step') handleTimelineStep(event, data)
  if (event.event === 'subagent_progress') {
    const progress = typeof data.progress_percent === 'number' ? `${data.progress_percent}%` : ''
    const iteration = typeof data.iteration === 'number' ? `第 ${data.iteration} 轮` : ''
    const warnings = Array.isArray(data.warnings) ? data.warnings.filter(String).join(' · ') : ''
    activity.value = {
      title: data.phase_label ? String(data.phase_label) : `正在执行 ${String(data.subagent || '子 Agent')}`,
      detail: [data.subagent, data.phase, iteration, progress, data.status, warnings]
        .filter(Boolean)
        .join(' · '),
      level: data.error ? 'error' : 'normal'
    }
  }
  if (event.event === 'confirmation_required') {
    const interrupt = data.interrupt as AgentInterrupt | undefined
    if (!interrupt) {
      runStatus.value = 'failed'
      activity.value = { title: '确认请求格式错误', level: 'error' }
      return
    }
    pendingConfirmation.value = interrupt
    finalizeActiveThinking()
    runStatus.value = 'waiting_confirmation'
    activity.value = null
    clearStream()
  }
  if (event.event === 'action_result') {
    activity.value = {
      title: '执行结果',
      detail: String(data.summary || data.message || data.result || '已收到执行结果'),
      level: data.error ? 'error' : 'normal'
    }
  }
  if (event.event === 'node_error') {
    activity.value = {
      title: `阶段出现异常${data.node ? `：${String(data.node)}` : ''}`,
      detail: String(data.error || data.message || '未知错误'),
      level: 'error'
    }
  }
  if (event.event === 'run_completed') {
    const reply = extractFinalContent(data)
    const message = initializeAssistantMessage()
    if (reply && !message.content) message.content = reply
    if (Array.isArray(data.artifact_refs)) message.artifacts = data.artifact_refs.filter(String) as string[]
    finalizeActiveThinking()
    runStatus.value = 'completed'
    activity.value = null
    emit('completed')
    if (conversationId.value) emit('conversation-updated', conversationId.value)
    clearStream()
  }
  if (event.event === 'run_failed') {
    finalizeActiveThinking()
    runStatus.value = 'failed'
    activity.value = {
      title: 'Agent 执行失败',
      detail: String(data.error || data.message || '未知错误'),
      level: 'error'
    }
    clearStream()
  }
}
onBeforeUnmount(clearStream)

defineExpose({
  resetConversation,
  loadConversation
})
*/</script>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import MarkdownIt from 'markdown-it'
import type { LlmProfile } from '@/services/llmProfileService'
import {
  useAgentChatStore,
  type ChatMessage,
  type FilterSnapshot,
  type HistoricalExecutionActivity,
  type HistoricalMemoryRetrieval
} from '@/stores/agentChat'

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true })
const chatStore = useAgentChatStore()
const {
  messages,
  runStatus,
  pendingConfirmation,
  confirmationComment,
  hasConversation,
  selectedLlmProfileId,
  isRunning
} = storeToRefs(chatStore)
const draft = ref('')
const messageListRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)

const props = defineProps<{
  currentFilters: FilterSnapshot
  llmProfiles?: LlmProfile[]
}>()
const emit = defineEmits<{
  completed: []
  'update:isRunning': [value: boolean]
  'message-sent': [message: string]
  'conversation-changed': [value: boolean]
  'conversation-updated': [conversationId: string]
  'restore-filters': [filters: FilterSnapshot]
}>()

const canReuseMessage = computed(() => !isRunning.value && runStatus.value !== 'waiting_confirmation')
const enabledLlmProfiles = computed(() => (props.llmProfiles || []).filter((profile) => profile.enabled))
const llmSelectorDisabled = computed(() => isRunning.value || runStatus.value === 'waiting_confirmation')
const statusLabel = computed(() => ({
  idle: '准备就绪', streaming: '正在执行', detached: '后台执行中（实时连接已断开）', waiting_confirmation: '等待确认', completed: '本轮完成', failed: '执行失败'
})[runStatus.value])

function executionStatusTone(status: string) {
  if (['completed', 'success', 'accepted'].includes(status)) return 'completed'
  if (['failed', 'error', 'rejected', 'blocked', 'interrupted', 'partial', 'partial_failed'].includes(status)) return 'failed'
  return 'started'
}

function executionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: '已完成',
    success: '已完成',
    accepted: '已接受',
    running: '进行中',
    detached: '后台执行中',
    confirmation_required: '等待确认',
    failed: '失败',
    error: '失败',
    rejected: '已拒绝',
    blocked: '已阻塞',
    interrupted: '已中断',
    partial: '部分完成',
    partial_failed: '部分失败'
  }
  return labels[status] || status
}

function executionStepLabel(state: string) {
  if (state === 'completed') return '完成'
  if (state === 'failed') return '失败'
  return '进行中'
}

function memoryRetrievalTone(status: string) {
  if (status === 'completed') return 'completed'
  if (status === 'failed') return 'failed'
  if (status === 'empty' || status === 'skipped') return 'empty'
  return 'running'
}

function memoryRetrievalLabel(status: string) {
  const labels: Record<string, string> = {
    running: '正在检索会话记忆',
    completed: '已加载会话记忆',
    empty: '未找到匹配的会话记忆',
    failed: '会话记忆暂不可用',
    skipped: '已跳过会话记忆检索'
  }
  return labels[status] || '正在处理会话记忆'
}

function memoryRetrievalDetail(memory: HistoricalMemoryRetrieval) {
  if (memory.status === 'running') return '正在匹配长期偏好与会话摘要'
  if (memory.status === 'empty') return '未匹配到长期记忆或会话摘要'
  if (memory.status === 'failed') return '已跳过记忆上下文，继续执行'
  if (memory.status === 'skipped') return '本轮无需调用记忆'
  return `长期记忆 ${memory.factsCount} 条 · 会话摘要 ${memory.episodesCount} 条`
}

function isActivityDetailsExpanded(activityItem: HistoricalExecutionActivity) {
  return activityItem.detailsExpanded ?? activityItem.status === 'running'
}

function toggleActivityDetails(activityItem: HistoricalExecutionActivity) {
  activityItem.detailsExpanded = !isActivityDetailsExpanded(activityItem)
}

function isTimelineExpanded(activityItem: HistoricalExecutionActivity) {
  return activityItem.timelineExpanded ?? activityItem.status === 'running'
}

function toggleTimeline(activityItem: HistoricalExecutionActivity) {
  activityItem.timelineExpanded = !isTimelineExpanded(activityItem)
}

function shouldShowExecutionResult(status: string) {
  return status !== 'running' && status !== 'detached'
}

function executionResultTitle(status: string) {
  return status === 'confirmation_required' ? '等待确认' : '最终结果'
}

function formatDuration(latencyMs: number) {
  return latencyMs < 1000 ? `${latencyMs} ms` : `${(latencyMs / 1000).toFixed(1)} 秒`
}

function executionActivityDetail(activityItem: HistoricalExecutionActivity) {
  const parts: string[] = []
  if (activityItem.kind === 'tool' && activityItem.summary) parts.push(activityItem.summary)
  if (activityItem.phaseLabel) parts.push(activityItem.phaseLabel)
  if (activityItem.progressPercent !== null) parts.push(`${activityItem.progressPercent}%`)
  if (activityItem.taskId !== null) parts.push(`任务 #${activityItem.taskId}`)
  return parts.join(' · ')
}

function renderMarkdown(content: string) {
  return markdown.render(content)
}

function scrollToBottom() {
  if (messageListRef.value) messageListRef.value.scrollTop = messageListRef.value.scrollHeight
}

function isThinkingComplete(message: ChatMessage) {
  return Boolean(message.thinkingCompletedAt) ||
    (!message.thinkingStartedAt && Boolean(message.executionCard?.reasoning.length))
}

function isReasoningExpanded(message: ChatMessage) {
  return isThinkingComplete(message) ? Boolean(message.reasoningExpanded) : true
}

function getThinkingSeconds(message: ChatMessage) {
  if (!message.thinkingStartedAt || !message.thinkingCompletedAt) return 1
  return Math.max(1, Math.round((message.thinkingCompletedAt - message.thinkingStartedAt) / 1000))
}

function reasoningLines(reasoning?: string) {
  return reasoning?.split(/\n+/).map((line) => line.trim()).filter(Boolean) || []
}

function reasoningText(message: ChatMessage) {
  return message.executionCard?.reasoning.join('\n') || message.reasoning || ''
}

function hasReasoning(message: ChatMessage) {
  return Boolean(reasoningText(message))
}

function toggleReasoning(message: ChatMessage) {
  if (isThinkingComplete(message) && hasReasoning(message)) message.reasoningExpanded = !message.reasoningExpanded
}

function isMessageStreaming(message: ChatMessage) {
  return Boolean(message.thinkingStartedAt) && !message.thinkingCompletedAt && isRunning.value
}

function reuseMessage(message: ChatMessage) {
  if (message.role !== 'user' || !canReuseMessage.value) return
  draft.value = message.content
  if (message.filters) emit('restore-filters', message.filters)
  nextTick(() => {
    composerRef.value?.focus()
    composerRef.value?.select()
  })
}

function send() {
  const message = draft.value.trim()
  if (!message || isRunning.value) return
  chatStore.send(message, props.currentFilters)
  emit('message-sent', message)
  draft.value = ''
}

function resume(decision: 'approved' | 'rejected') {
  chatStore.resume(decision)
}

function disconnectStream() {
  chatStore.disconnectStream()
}

function selectLlmProfile(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  chatStore.setLlmProfile(value ? Number(value) : null)
}

watch(isRunning, (value) => emit('update:isRunning', value), { immediate: true })
watch(hasConversation, (value) => emit('conversation-changed', value), { immediate: true })
watch(enabledLlmProfiles, (profiles) => {
  const selectedProfileExists = profiles.some((profile) => profile.id === selectedLlmProfileId.value)
  if (selectedProfileExists) return

  chatStore.setLlmProfile(profiles.find((profile) => profile.is_default)?.id ?? profiles[0]?.id ?? null)
}, { immediate: true })
watch([messages, pendingConfirmation], () => nextTick(scrollToBottom), { deep: true })
watch(runStatus, (status) => {
  if (status !== 'completed') return
  emit('completed')
  if (chatStore.conversationId) emit('conversation-updated', chatStore.conversationId)
})
</script>

<style scoped>
.agent-chat-panel {
  width: min(940px, calc(100vw - 72px));
  margin: 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 22px 55px rgba(74, 85, 140, 0.17);
  backdrop-filter: blur(18px);
  overflow: hidden;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}
.chat-eyebrow {
  margin: 0 0 4px;
  color: #7c88a5;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.chat-header h2 {
  margin: 0;
  color: #27334e;
  font-size: 24px;
}
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.chat-status {
  padding: 6px 10px;
  border-radius: 999px;
  color: #64748b;
  background: #f1f5f9;
  font-size: 12px;
  font-weight: 700;
}
.chat-status-streaming {
  color: #1d4ed8;
  background: #dbeafe;
}
.chat-status-waiting_confirmation {
  color: #b45309;
  background: #fef3c7;
}
.chat-status-failed {
  color: #b91c1c;
  background: #fee2e2;
}
.stop-button,
.send-button,
.approve-button,
.reject-button {
  border: 0;
  border-radius: 10px;
  padding: 9px 13px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.reject-button {
  color: #475569;
  background: #e2e8f0;
}
.chat-filter-slot {
  padding: 14px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.38);
}
.message-list {
  height: min(48vh, 500px);
  min-height: 300px;
  overflow: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chat-empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #64748b;
  text-align: center;
}
.chat-empty strong {
  color: #334155;
  font-size: 18px;
}
.chat-message {
  max-width: 82%;
  padding: 12px 15px;
  border-radius: 16px;
  color: #334155;
  background: #f1f5f9;
}
.chat-message-user {
  align-self: flex-end;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #1890ff);
}
.chat-message-system {
  align-self: center;
  max-width: 90%;
  color: #b45309;
  background: #fffbeb;
}
.message-role {
  display: block;
  margin-bottom: 5px;
  font-size: 11px;
  font-weight: 800;
  opacity: 0.75;
}
.thinking-reasoning {
  margin: 2px 0 12px;
  color: #64748b;
  font-size: 13px;
}
.thinking-reasoning-header {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  line-height: 1.5;
}
.thinking-reasoning-header.is-clickable {
  cursor: pointer;
}
.thinking-reasoning-label {
  font-weight: 600;
}
.thinking-reasoning-shimmer {
  color: transparent;
  background: linear-gradient(100deg, #64748b 20%, #a5b4fc 45%, #64748b 70%);
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  animation: thinking-shimmer 1.45s linear infinite;
}
.thinking-reasoning-chevron {
  flex: none;
  transition: transform 0.2s ease;
}
.thinking-reasoning-chevron.is-expanded {
  transform: rotate(180deg);
}
.thinking-reasoning-body {
  overflow: hidden;
}
.thinking-reasoning-viewport {
  max-height: 180px;
  margin-top: 7px;
  overflow-y: auto;
  padding: 7px 11px;
  border-left: 2px solid #c7d2fe;
  background: linear-gradient(90deg, rgba(238, 242, 255, 0.68), transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 10px), transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 10px), transparent);
}
.thinking-reasoning-line {
  margin: 0;
  padding: 3px 0;
  line-height: 1.65;
  white-space: pre-wrap;
}
.reasoning-collapse-enter-active,
.reasoning-collapse-leave-active {
  transition: all 0.2s ease;
}
.reasoning-collapse-enter-from,
.reasoning-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}
@keyframes thinking-shimmer {
  to {
    background-position: -200% 0;
  }
}
.message-reuse-trigger {
  position: absolute;
  right: 8px;
  bottom: 7px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: #64748b;
  background: rgba(255, 255, 255, 0.58);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.18s ease, color 0.18s ease, background 0.18s ease;
}
.chat-message-user {
  position: relative;
  padding-bottom: 22px;
}
.chat-message-user:hover .message-reuse-trigger,
.message-reuse-trigger:focus-visible {
  opacity: 1;
}
.message-reuse-trigger:hover {
  color: #3b5ccc;
  background: rgba(255, 255, 255, 0.92);
}
.chat-message p,
.activity-card p,
.confirmation-card p {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
}
.execution-card {
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: linear-gradient(145deg, #fbfdff, #f5f8fc);
}
.execution-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid #e5ebf3;
}
.execution-card-meta,
.execution-final-result > p {
  margin: 0;
}
.execution-status,
.execution-activity-status {
  flex: none;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.execution-status {
  padding: 4px 8px;
  color: #4f6fe8;
  background: #e8edff;
}
.execution-status-completed {
  color: #15803d;
  background: #dcfce7;
}
.execution-status-failed {
  color: #b91c1c;
  background: #fee2e2;
}
.execution-card-meta {
  padding: 9px 14px 0;
  color: #7a879d;
  font-size: 12px;
}
.memory-retrieval {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 10px 14px 0;
  padding: 9px 10px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  color: #5d6b82;
  background: rgba(255, 255, 255, 0.72);
}
.memory-retrieval-indicator {
  width: 8px;
  height: 8px;
  flex: none;
  margin-top: 5px;
  border-radius: 50%;
  background: #7c91d8;
}
.memory-retrieval-title,
.memory-retrieval-detail {
  margin: 0;
}
.memory-retrieval-title {
  color: #465775;
  font-size: 12px;
  font-weight: 750;
}
.memory-retrieval-detail {
  margin-top: 2px;
  color: #7a879d;
  font-size: 11px;
  line-height: 1.5;
}
.memory-retrieval-running .memory-retrieval-indicator {
  animation: pulse 1.2s infinite;
}
.memory-retrieval-completed {
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.memory-retrieval-completed .memory-retrieval-indicator {
  background: #16a34a;
}
.memory-retrieval-completed .memory-retrieval-title {
  color: #166534;
}
.memory-retrieval-empty {
  border-color: #e2e8f0;
  background: #f8fafc;
}
.memory-retrieval-empty .memory-retrieval-indicator {
  background: #94a3b8;
}
.memory-retrieval-failed {
  border-color: #fecaca;
  background: #fef2f2;
}
.memory-retrieval-failed .memory-retrieval-indicator {
  background: #dc2626;
}
.memory-retrieval-failed .memory-retrieval-title,
.memory-retrieval-failed .memory-retrieval-detail {
  color: #b91c1c;
}
.execution-activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 14px;
  list-style: none;
}
.execution-activity {
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 9px;
}
.execution-activity:not(:last-child)::after {
  position: absolute;
  top: 16px;
  bottom: -12px;
  left: 6px;
  width: 1px;
  background: #d7dfeb;
  content: '';
}
.execution-activity-rail {
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 5px;
  border: 2px solid #7c91d8;
  border-radius: 50%;
  background: #fff;
}
.execution-activity-completed .execution-activity-rail {
  border-color: #22a35a;
  background: #dcfce7;
}
.execution-activity-failed .execution-activity-rail {
  border-color: #dc2626;
  background: #fee2e2;
}
.execution-activity-content {
  min-width: 0;
}
.execution-activity-title,
.execution-activity-detail,
.execution-activity-error,
.execution-subagent-note p,
.execution-workflow p {
  margin: 0;
}
.execution-activity-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: #56657e;
  font-size: 12px;
}
.execution-activity-title strong {
  color: #334155;
  font-size: 13px;
}
.execution-activity-index {
  color: #7080a0;
  font-variant-numeric: tabular-nums;
}
.execution-activity-status {
  padding: 2px 6px;
  color: #64748b;
  background: #eef2f7;
}
.execution-activity-completed .execution-activity-status {
  color: #15803d;
  background: #dcfce7;
}
.execution-activity-failed .execution-activity-status {
  color: #b91c1c;
  background: #fee2e2;
}
.execution-activity-detail {
  margin-top: 4px;
  color: #7a879d;
  font-size: 12px;
  line-height: 1.55;
}
.execution-activity-error,
.execution-subagent-warning {
  margin-top: 5px !important;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.55;
}
.execution-subagent-note,
.execution-workflow {
  margin-top: 9px;
  padding: 9px 10px;
  border: 1px solid #e1e7f0;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.72);
}
.execution-section-toggle {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 5px;
  padding: 0;
  border: 0;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
}
.execution-section-chevron {
  margin-left: auto;
  transition: transform 0.18s ease;
}
.execution-section-chevron.is-expanded {
  transform: rotate(180deg);
}
.execution-subagent-note p {
  color: #5d6b82;
  font-size: 12px;
  line-height: 1.55;
}
.execution-workflow ol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.execution-workflow li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}
.execution-workflow li::before {
  grid-column: 1;
  grid-row: 1 / span 2;
  width: 7px;
  height: 7px;
  margin: 5px 0 0 1px;
  border-radius: 50%;
  background: #7c91d8;
  content: '';
}
.execution-workflow li > span {
  grid-column: 2;
}
.execution-workflow li small {
  grid-column: 3;
  color: #94a3b8;
  font-size: 11px;
}
.execution-workflow li p {
  grid-column: 2 / -1;
  color: #b91c1c;
  font-size: 11px;
}
.execution-workflow-step-completed::before {
  background: #22a35a !important;
}
.execution-workflow-step-failed::before {
  background: #dc2626 !important;
}
.execution-final-result {
  padding: 12px 14px 14px 37px;
  border-top: 1px solid #e5ebf3;
  background: rgba(255, 255, 255, 0.6);
}
.execution-final-result > p {
  margin-bottom: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}
.execution-final-result .message-content {
  color: #334155;
}
.activity-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 14px;
  color: #1d4ed8;
  background: #eff6ff;
}
.activity-card.error {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fef2f2;
}
.activity-dot {
  width: 8px;
  height: 8px;
  flex: none;
  margin-top: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.2s infinite;
}
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.todo-group {
  overflow: hidden;
  border: 1px solid #dbe1ea;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}
.todo-header {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 11px 12px;
  border: 0;
  color: #475569;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.todo-header:hover {
  background: rgba(248, 250, 252, 0.85);
}
.todo-header-icon,
.todo-step-icon {
  display: grid;
  place-items: center;
  flex: none;
}
.todo-header-icon {
  color: #64748b;
}
.todo-header-icon.started {
  color: #4f6fe8;
  animation: todo-spin 2.4s linear infinite;
}
.todo-header-icon.completed {
  color: #16a34a;
}
.todo-header-icon.failed {
  color: #dc2626;
}
.todo-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-count,
.todo-failed-count {
  flex: none;
  color: #94a3b8;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.todo-failed-count {
  color: #dc2626;
}
.todo-chevron {
  flex: none;
  color: #94a3b8;
  transition: transform 0.18s ease;
}
.todo-chevron.is-collapsed {
  transform: rotate(-90deg);
}
.todo-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 12px 12px;
  list-style: none;
}
.todo-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}
.todo-step-icon {
  margin-top: 1px;
}
.todo-step-started {
  color: #4f6fe8;
}
.todo-step-started .todo-step-icon {
  animation: todo-pulse 1.2s ease-in-out infinite;
}
.todo-step-completed {
  color: #64748b;
}
.todo-step-completed .todo-step-icon {
  color: #16a34a;
}
.todo-step-completed .todo-step-label {
  color: #64748b;
}
.todo-step-failed {
  color: #dc2626;
}
.todo-step-content {
  min-width: 0;
}
.todo-step-label {
  overflow-wrap: anywhere;
}
.todo-step-error {
  margin: 3px 0 0;
  color: #b91c1c;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.todo-collapse-enter-active,
.todo-collapse-leave-active {
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.18s ease;
}
.todo-collapse-enter-from,
.todo-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
@keyframes todo-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes todo-pulse {
  50% {
    opacity: 0.42;
  }
}
.confirmation-card {
  padding: 16px;
  border: 1px solid #fcd34d;
  border-radius: 16px;
  background: #fffbeb;
  color: #78350f;
}
.confirmation-title {
  font-weight: 800;
}
.confirmation-card textarea {
  box-sizing: border-box;
  width: 100%;
  margin: 12px 0 10px;
  padding: 9px;
  border: 1px solid #fcd34d;
  border-radius: 9px;
  resize: vertical;
  font: inherit;
}
.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}
.approve-button,
.send-button {
  color: #fff;
  background: linear-gradient(135deg, #667eea, #1890ff);
}
.chat-composer {
  padding: 15px 24px 17px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.75);
}
.chat-composer textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 54px;
  padding: 14px 80px 14px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  outline: none;
  resize: vertical;
  font: inherit;
}
.chat-composer textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}
.send-button,
.stop-button {
  float: right;
  margin: -46px 8px 0 0;
}
.stop-button {
  color: #b91c1c;
  background: #fee2e2;
}
.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.chat-composer p {
  clear: both;
  margin: 9px 0 0;
  color: #94a3b8;
  font-size: 12px;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (max-width: 640px) {
  .agent-chat-panel {
    width: calc(100vw - 32px);
    border-radius: 20px;
  }
  .chat-header {
    padding: 18px;
  }
  .chat-header h2 {
    font-size: 20px;
  }
  .message-list {
    height: 46vh;
    padding: 16px;
  }
  .chat-message {
    max-width: 92%;
  }
  .chat-composer {
    padding: 13px 16px;
  }
  .chat-header-actions {
    gap: 7px;
  }
}
.agent-chat-panel {
  display: flex;
  flex-direction: column;
  width: min(100%, 960px);
  min-height: 0;
  margin: 0 auto;
  color: #1f2937;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  overflow: visible;
}
.chat-header {
  min-height: 42px;
  padding: 0 8px;
  border: 0;
}
.chat-eyebrow {
  margin: 0;
  color: #718096;
  font-size: 12px;
  letter-spacing: 0.12em;
}
.chat-header h2 {
  margin: 10px 0 0;
  color: #1f2937;
  font-size: 32px;
  letter-spacing: -0.04em;
}
.chat-filter-slot {
  order: 4;
  padding: 8px 10px 0;
}
.message-list {
  order: 2;
  flex: 1;
  height: auto;
  min-height: 0;
  padding: 28px max(8px, calc((100% - 780px) / 2));
  gap: 16px;
}
.chat-message {
  max-width: min(78%, 680px);
  color: #263447;
  background: #f6f7f9;
}
.chat-message-user {
  align-self: flex-end;
  color: #1f2937;
  background: #edf3ff;
  border-bottom-right-radius: 5px;
}
.chat-message-assistant {
  align-self: flex-start;
  border-bottom-left-radius: 5px;
}
.message-role {
  color: #94a3b8;
}
.chat-message-user .message-role {
  text-align: right;
}
.chat-composer {
  order: 3;
  box-sizing: border-box;
  width: 100%;
  padding: 13px 14px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
}
.chat-composer textarea {
  min-height: 64px;
  padding: 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.chat-composer textarea:focus {
  box-shadow: none;
}
.send-button,
.stop-button {
  width: 34px;
  height: 34px;
  margin: -45px 3px 0 0;
  border-radius: 50%;
  background: #4f6fe8;
  font-size: 23px;
  line-height: 1;
}
.stop-button {
  width: auto;
  padding: 8px 12px;
  border-radius: 9px;
  color: #b91c1c;
  background: #fee2e2;
  font-size: 13px;
}
.send-button:disabled {
  background: #c7d2fe;
}
.chat-composer > p {
  font-size: 11px;
  color: #a8b2c1;
}
.has-conversation {
  min-height: calc(100vh - 96px);
}
.has-conversation .chat-header {
  padding-bottom: 8px;
}
.has-conversation .chat-composer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
}
.agent-chat-panel:not(.has-conversation) .chat-header {
  justify-content: center;
  text-align: center;
  margin: 0 0 12px;
}
.agent-chat-panel:not(.has-conversation) .chat-header-actions {
  display: none;
}
.agent-chat-panel:not(.has-conversation) .chat-header h2::after {
  content: '用自然语言描述你的研究需求，我会帮你检索、筛选并推荐论文。';
  display: block;
  margin-top: 13px;
  color: #94a3b8;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0;
}
.agent-chat-panel:not(.has-conversation) .chat-filter-slot :deep(.search-toolbar) {
  padding: 2px 0;
  min-height: 36px;
}
.agent-chat-panel:not(.has-conversation) .message-list {
  flex: 0;
  min-height: 0;
  height: 0;
  padding: 0;
  overflow: visible;
}
.agent-chat-panel:not(.has-conversation) .chat-empty {
  display: none;
}
.agent-chat-panel:not(.has-conversation) .chat-composer {
  width: min(820px, 100%);
  margin: 0 auto;
}
@media (max-width: 720px) {
  .agent-chat-panel,
  .has-conversation {
    min-height: calc(100vh - 40px);
  }
  .chat-header h2 {
    font-size: 27px;
  }
  .message-list {
    padding: 20px 0;
  }
  .chat-message {
    max-width: 88%;
  }
  .chat-filter-slot :deep(.search-toolbar) {
    align-items: flex-start;
    flex-direction: column;
  }
  .chat-filter-slot :deep(.search-toolbar-actions) {
    width: 100%;
  }
  .chat-filter-slot :deep(.source-dropdown),
  .chat-filter-slot :deep(.source-trigger) {
    width: 100%;
    box-sizing: border-box;
  }
  .chat-composer {
    border-radius: 16px;
  }
}
.has-conversation {
  height: calc(100vh - 96px);
  min-height: 0;
  max-height: calc(100vh - 96px);
}
.has-conversation .message-list {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.has-conversation .chat-composer {
  flex: none;
  position: relative;
  bottom: auto;
  margin-top: 0;
}
.chat-message,
.chat-message-user,
.chat-message-assistant,
.chat-message-system,
.chat-message p,
.message-role {
  text-align: left;
}
.chat-message-user .message-role {
  text-align: left;
}
.message-list::-webkit-scrollbar {
  width: 8px;
}
.message-list::-webkit-scrollbar-track {
  background: transparent;
}
.message-list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
  background-clip: padding-box;
}
.message-list::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.72);
  background-clip: padding-box;
}
@media (max-width: 720px) {
  .has-conversation {
    height: calc(100vh - 40px);
    max-height: calc(100vh - 40px);
  }
}
.markdown-body {
  overflow-wrap: anywhere;
  text-align: left;
}
.markdown-body.is-streaming::after {
  display: inline-block;
  width: 0.58em;
  height: 1.15em;
  margin-left: 0.14em;
  border-radius: 1px;
  vertical-align: -0.2em;
  background: #64748b;
  content: '';
  animation: streaming-caret 0.92s steps(1, end) infinite;
}
@keyframes streaming-caret {
  50% {
    opacity: 0;
  }
}
.markdown-body :deep(p) {
  margin: 0 0 10px;
  line-height: 1.75;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px;
  color: #172033;
  line-height: 1.35;
}
.markdown-body :deep(h1) {
  font-size: 1.35em;
}
.markdown-body :deep(h2) {
  font-size: 1.22em;
}
.markdown-body :deep(h3) {
  font-size: 1.1em;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}
.markdown-body :deep(li) {
  margin: 4px 0;
  line-height: 1.65;
}
.markdown-body :deep(a) {
  color: #3b5ccc;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  color: #334155;
  background: rgba(148, 163, 184, 0.18);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.88em;
}
.markdown-body :deep(pre) {
  max-width: 100%;
  margin: 10px 0;
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: #1e293b;
}
.markdown-body :deep(pre code) {
  padding: 0;
  color: #e2e8f0;
  background: transparent;
  line-height: 1.6;
}
.markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding-left: 12px;
  border-left: 3px solid #93a6ef;
  color: #64748b;
}
.markdown-body :deep(table) {
  display: block;
  max-width: 100%;
  margin: 10px 0;
  overflow-x: auto;
  border-collapse: collapse;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 7px 9px;
  border: 1px solid #dbe1ea;
  text-align: left;
  white-space: nowrap;
}
.markdown-body :deep(th) {
  background: #eef2ff;
  font-weight: 700;
}
.send-button {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 38px;
  height: 38px;
  margin: -47px 3px 0 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.72), rgba(118, 75, 162, 0.66));
  box-shadow:
    0 8px 20px rgba(90, 91, 184, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}
.send-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.04);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.88), rgba(118, 75, 162, 0.82));
  box-shadow:
    0 12px 25px rgba(90, 91, 184, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
.send-button:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
}
.send-button:disabled {
  color: rgba(255, 255, 255, 0.72);
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.45), rgba(129, 140, 167, 0.38));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  cursor: not-allowed;
}
.chat-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(130px, 170px) auto;
  column-gap: 8px;
  align-items: end;
  padding: 16px 18px 13px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(238, 242, 255, 0.64));
  box-shadow:
    0 18px 42px rgba(74, 85, 140, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(135%);
  -webkit-backdrop-filter: blur(20px) saturate(135%);
}
.chat-composer > textarea {
  grid-column: 1;
  grid-row: 1;
}
.llm-profile-selector {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  margin: 0;
}
.llm-profile-selector label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.llm-profile-selector select {
  width: 100%;
  min-width: 0;
  height: 31px;
  border: 1px solid rgba(122, 143, 179, 0.3);
  border-radius: 9px;
  padding: 0 9px;
  color: #354867;
  background: rgba(255, 255, 255, 0.76);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.llm-profile-selector select:focus {
  border-color: rgba(79, 111, 232, 0.75);
  box-shadow: 0 0 0 3px rgba(79, 111, 232, 0.12);
}
.llm-profile-selector select:disabled {
  color: #8795a9;
  background: rgba(241, 245, 249, 0.74);
  cursor: not-allowed;
}
.chat-filter-slot {
  grid-column: 1 / -1;
  padding: 0;
  background: transparent;
  border: 0;
}
.composer-divider {
  grid-column: 1 / -1;
  height: 1px;
  margin: 8px 0 9px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 190, 0.25), transparent);
}
.chat-filter-slot :deep(.search-toolbar) {
  min-height: 36px;
  padding: 0 2px;
}
.chat-filter-slot :deep(.filter-tag) {
  padding: 7px 12px;
  border-color: rgba(129, 140, 190, 0.2);
  color: #53617d;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-weight: 650;
}
.chat-filter-slot :deep(.filter-tag:hover),
.chat-filter-slot :deep(.filter-tag-active) {
  border-color: rgba(102, 126, 234, 0.58);
  color: #465dc4;
  background: rgba(232, 237, 255, 0.8);
  box-shadow:
    0 5px 13px rgba(102, 126, 234, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}
.chat-filter-slot :deep(.add-btn) {
  width: 30px;
  height: 30px;
  justify-content: center;
  padding: 0;
  color: #5c70ce;
  background: rgba(238, 242, 255, 0.76);
  font-size: 20px;
  line-height: 1;
}
.chat-filter-slot :deep(.source-trigger) {
  border: 1px solid rgba(129, 140, 190, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.chat-composer > p {
  grid-column: 1 / -1;
  margin-top: 8px;
}
.search-agent-button {
  float: right;
  margin: -47px 50px 0 0;
  padding: 8px 12px;
  border: 1px solid rgba(102, 126, 234, 0.32);
  border-radius: 999px;
  color: #465dc4;
  background: rgba(238, 242, 255, 0.86);
  box-shadow: 0 5px 13px rgba(102, 126, 234, 0.12);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.search-agent-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(224, 231, 255, 0.96);
  box-shadow: 0 8px 18px rgba(102, 126, 234, 0.2);
}

.search-agent-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-composer > .send-button,
.chat-composer > .stop-button {
  grid-column: 3;
  grid-row: 1;
  float: none;
  margin: 0;
}
@media (max-width: 560px) {
  .chat-composer {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }
  .chat-composer textarea {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .llm-profile-selector {
    grid-column: 1;
    grid-row: 2;
  }
  .chat-composer > .send-button,
  .chat-composer > .stop-button {
    grid-column: 2;
    grid-row: 2;
  }
}
</style>
