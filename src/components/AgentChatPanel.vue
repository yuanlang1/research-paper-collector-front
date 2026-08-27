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
        <button
          v-if="hasConversation"
          class="new-chat-button"
          type="button"
          :disabled="isRunning"
          @click="resetConversation"
        >
          新对话
        </button>
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
        <div v-if="message.role === 'assistant' && (message.reasoning || message.thinkingStartedAt)" class="thinking-reasoning">
          <button
            class="thinking-reasoning-header"
            :class="{ 'is-clickable': isThinkingComplete(message) }"
            type="button"
            :aria-expanded="isReasoningExpanded(message)"
            :aria-label="isReasoningExpanded(message) ? '收起推理过程' : '展开推理过程'"
            @click="toggleReasoning(message)"
          >
            <span v-if="isThinkingComplete(message)" class="thinking-reasoning-label">
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
                <p v-for="(line, index) in reasoningLines(message.reasoning)" :key="`${message.id}-${index}`" class="thinking-reasoning-line">
                  {{ line }}
                </p>
              </div>
            </div>
          </Transition>
        </div>
        <div
          v-if="message.content"
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
        <div v-if="message.artifacts?.length" class="artifact-list">
          <code v-for="artifact in message.artifacts" :key="artifact">{{ artifact }}</code>
        </div>
      </article>

      <article v-if="activity" class="activity-card" :class="{ error: activity.level === 'error' }">
        <span class="activity-dot"></span>
        <div>
          <strong>{{ activity.title }}</strong>
          <p v-if="activity.detail">{{ activity.detail }}</p>
        </div>
      </article>

      <section v-if="visibleTimelineGroups.length" class="todo-list" aria-label="任务列表">
        <div v-for="group in visibleTimelineGroups" :key="group.id" class="todo-group">
          <button
            class="todo-header"
            type="button"
            :aria-expanded="!group.collapsed"
            :aria-label="`${group.workflow}任务列表`"
            @click="toggleTimelineGroup(group)"
          >
            <span class="todo-header-icon" :class="getTimelineGroupStatus(group)">
              <svg v-if="getTimelineGroupStatus(group) === 'completed'" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill-rule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm4.08 6.99a.75.75 0 0 1 .18 1.05l-4.5 6a.75.75 0 0 1-1.12.08l-3-3a.75.75 0 0 1 1.06-1.06l2.39 2.39 3.93-5.24a.75.75 0 0 1 1.05-.17Z" fill="currentColor" />
              </svg>
              <svg v-else-if="getTimelineGroupStatus(group) === 'started'" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2 3.2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
                <path d="M12 7.5v5m0 3h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </span>
            <span class="todo-title">{{ group.workflow }}</span>
            <span class="todo-count">{{ getCompletedStepCount(group) }}/{{ group.steps.length }}</span>
            <span v-if="getFailedStepCount(group)" class="todo-failed-count">
              {{ getFailedStepCount(group) }} 失败
            </span>
            <svg class="todo-chevron" :class="{ 'is-collapsed': group.collapsed }" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="m6.75 9 5.25 5.25L17.25 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <Transition name="todo-collapse">
            <ol v-if="!group.collapsed" class="todo-steps">
              <li v-for="step in group.steps" :key="step.stepId" class="todo-step" :class="`todo-step-${step.state}`">
                <span class="todo-step-icon" aria-hidden="true">
                  <svg v-if="step.state === 'completed'" viewBox="0 0 24 24" width="16" height="16">
                    <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="step.state === 'started'" viewBox="0 0 24 24" width="16" height="16">
                    <path d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="16" height="16">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
                    <path d="M12 8v5m0 3h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </span>
                <div class="todo-step-content">
                  <span class="todo-step-label">{{ step.label }}</span>
                  <p v-if="step.error" class="todo-step-error">{{ step.error }}</p>
                </div>
              </li>
            </ol>
          </Transition>
        </div>
      </section>

      <article v-if="pendingConfirmation" class="confirmation-card">
        <p class="confirmation-title">需要你的确认</p>
        <p>{{ pendingConfirmation.message }}</p>
        <textarea
          v-model="confirmationComment"
          rows="2"
          placeholder="可选备注，例如：按当前筛选条件执行"
        ></textarea>
        <div class="confirmation-actions">
          <button type="button" class="reject-button" @click="resume('rejected')">暂不执行</button>
          <button type="button" class="approve-button" @click="resume('approved')">允许执行</button>
        </div>
      </article>
    </div>

    <div class="chat-composer">
      <textarea
        ref="composerRef"
        v-model="draft"
        rows="1"
        :disabled="isRunning"
        placeholder="给论文研究助手发送消息…"
        @keydown.enter.exact.prevent="send"
        @keydown.enter.shift.exact.stop
      ></textarea>
      <button v-if="isRunning" class="stop-button" type="button" @click="stopStreaming">
        停止
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

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import type { PaperTagValue, SourceTag } from '@/constants/searchTagMappings'
import {
  agentService,
  type AgentInterrupt,
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
  return Boolean(message.thinkingCompletedAt)
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
.new-chat-button,
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
.new-chat-button,
.reject-button {
  color: #475569;
  background: #e2e8f0;
}
.new-chat-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
.artifact-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 9px;
}
.artifact-list code {
  padding: 6px 8px;
  overflow: auto;
  border-radius: 6px;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.68);
  font-size: 11px;
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
  .new-chat-button {
    padding: 7px 9px;
    font-size: 12px;
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
.chat-filter-slot {
  padding: 0;
  background: transparent;
  border: 0;
}
.composer-divider {
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

.send-button {
  margin: -49px 4px 0 0;
}
</style>
