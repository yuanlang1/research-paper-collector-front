<template>
  <section class="llm-profiles-panel" aria-label="LLM 配置档案">
    <header class="llm-profiles-toolbar">
      <div>
        <h3>LLM 配置档案</h3>
        <p>配置用于论文研究助手的模型和 OpenAI-compatible 服务端点。</p>
      </div>
      <div class="llm-profiles-toolbar-actions">
        <button class="profile-button profile-button-secondary" type="button" :disabled="loading" @click="refresh">
          刷新
        </button>
        <button class="profile-button profile-button-primary" type="button" @click="openCreateForm">
          新建档案
        </button>
      </div>
    </header>

    <p v-if="notice" class="profile-notice" :class="`profile-notice-${notice.type}`">{{ notice.text }}</p>

    <div v-if="loading" class="profile-skeleton-list" aria-label="正在加载 LLM 配置档案">
      <span v-for="index in 3" :key="index" class="profile-skeleton-row"></span>
    </div>

    <div v-else-if="!profiles.length" class="profile-empty-state">
      <strong>还没有 LLM 配置档案</strong>
      <span>新建后可将其设为系统默认，或在每次对话前单独选择。</span>
    </div>

    <div v-else class="profile-list">
      <article v-for="profile in profiles" :key="profile.id" class="profile-row" :class="{ 'is-disabled': !profile.enabled }">
        <div class="profile-primary-info">
          <div class="profile-name-line">
            <strong>{{ profile.name }}</strong>
            <span v-if="profile.is_default" class="profile-status profile-status-default">系统默认</span>
            <span class="profile-status" :class="profile.enabled ? 'profile-status-enabled' : 'profile-status-disabled'">
              {{ profile.enabled ? '已启用' : '已停用' }}
            </span>
          </div>
          <p>{{ providerLabel(profile.provider) }} · {{ profile.model }}</p>
          <span class="profile-endpoint">{{ profile.base_url }}</span>
        </div>
        <div class="profile-key-status" :class="{ 'is-missing': !profile.key_set }">
          {{ profile.key_set ? '密钥已保存' : '未设置密钥' }}
        </div>
        <div class="profile-actions">
          <button class="profile-action" type="button" :disabled="isWorking(profile.id)" @click="testProfile(profile)">
            {{ actionLabel(profile.id, 'test', '测试') }}
          </button>
          <button class="profile-action" type="button" :disabled="isWorking(profile.id)" @click="openEditForm(profile)">
            编辑
          </button>
          <button
            v-if="!profile.is_default"
            class="profile-action"
            type="button"
            :disabled="isWorking(profile.id) || !profile.enabled"
            @click="setDefault(profile)"
          >
            {{ actionLabel(profile.id, 'default', '设为默认') }}
          </button>
          <button
            class="profile-action"
            type="button"
            :disabled="isWorking(profile.id) || profile.is_default"
            @click="toggleEnabled(profile)"
          >
            {{ actionLabel(profile.id, 'toggle', profile.enabled ? '停用' : '启用') }}
          </button>
          <button
            class="profile-action profile-action-danger"
            type="button"
            :disabled="isWorking(profile.id) || profile.is_default"
            @click="removeProfile(profile)"
          >
            删除
          </button>
        </div>
      </article>
    </div>

    <form v-if="editorOpen" class="profile-editor" @submit.prevent="saveProfile">
      <header class="profile-editor-header">
        <div>
          <h4>{{ editingProfileId ? '编辑配置档案' : '新建配置档案' }}</h4>
          <p>API Key 只会在保存时提交，页面不会读取或展示已保存的密钥。</p>
        </div>
        <button class="profile-editor-close" type="button" aria-label="关闭配置档案表单" @click="closeEditor">×</button>
      </header>

      <p v-if="formError" class="profile-form-error">{{ formError }}</p>

      <div class="profile-form-grid">
        <label class="profile-field">
          <span>档案名称</span>
          <input v-model.trim="draft.name" maxlength="100" required placeholder="例如：团队 OpenAI" />
        </label>
        <label class="profile-field">
          <span>Provider</span>
          <select v-model="draft.provider">
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </label>
        <label class="profile-field profile-field-wide">
          <span>Base URL</span>
          <input v-model.trim="draft.base_url" type="url" :placeholder="baseUrlPlaceholder" />
          <small>留空时由服务端使用该 Provider 的默认地址。</small>
        </label>
        <label class="profile-field">
          <span>模型</span>
          <input v-model.trim="draft.model" maxlength="200" required :placeholder="modelPlaceholder" />
        </label>
        <label class="profile-field">
          <span>{{ editingProfileId ? '替换 API Key（可选）' : 'API Key' }}</span>
          <input
            v-model="draft.api_key"
            type="password"
            autocomplete="new-password"
            :required="!editingProfileId"
            :placeholder="editingProfileId ? '留空则保持当前密钥' : '输入 API Key'"
          />
        </label>
      </div>

      <div class="profile-form-options">
        <label class="profile-check">
          <input v-model="draft.enabled" type="checkbox" :disabled="!editingProfileId && !profiles.length" />
          <span>启用此档案</span>
        </label>
        <label class="profile-check">
          <input v-model="draft.is_default" type="checkbox" :disabled="!draft.enabled || isEditingDefault" />
          <span>设为系统默认</span>
        </label>
      </div>

      <div class="profile-editor-actions">
        <button class="profile-button profile-button-secondary" type="button" :disabled="saving" @click="closeEditor">取消</button>
        <button class="profile-button profile-button-primary" type="submit" :disabled="saving">
          {{ saving ? '保存中…' : '保存档案' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  llmProfileService,
  type LlmProfile,
  type LlmProfileConnectionTest,
  type LlmProfileInput,
  type LlmProfileUpdate
} from '@/services/llmProfileService'

const emit = defineEmits<{ updated: [profiles: LlmProfile[]] }>()

type ProfileAction = 'default' | 'test' | 'toggle'

interface ProfileDraft {
  name: string
  provider: 'openai' | 'deepseek'
  base_url: string
  model: string
  api_key: string
  enabled: boolean
  is_default: boolean
}

const profiles = ref<LlmProfile[]>([])
const loading = ref(false)
const saving = ref(false)
const editorOpen = ref(false)
const editingProfileId = ref<number | null>(null)
const working = ref<{ id: number; action: ProfileAction } | null>(null)
const formError = ref('')
const notice = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const draft = ref<ProfileDraft>(newDraft())

const baseUrlPlaceholder = computed(() =>
  draft.value.provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'
)
const modelPlaceholder = computed(() => (draft.value.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4.1-mini'))
const isEditingDefault = computed(() =>
  Boolean(editingProfileId.value && profiles.value.find((profile) => profile.id === editingProfileId.value)?.is_default)
)

function newDraft(profile?: LlmProfile): ProfileDraft {
  return {
    name: profile?.name || '',
    provider: profile?.provider || 'openai',
    base_url: profile?.base_url || '',
    model: profile?.model || '',
    api_key: '',
    enabled: profile?.enabled ?? true,
    is_default: profile?.is_default ?? false
  }
}

function providerLabel(provider: LlmProfile['provider']) {
  return provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'
}

function actionLabel(id: number, action: ProfileAction, label: string) {
  return working.value?.id === id && working.value.action === action ? '处理中…' : label
}

function isWorking(id: number) {
  return working.value?.id === id
}

function showNotice(text: string, type: 'success' | 'error' = 'success') {
  notice.value = { text, type }
}

async function refresh() {
  try {
    loading.value = true
    profiles.value = await llmProfileService.list()
    emit('updated', profiles.value)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '加载 LLM 配置档案失败', 'error')
  } finally {
    loading.value = false
  }
}

function openCreateForm() {
  editingProfileId.value = null
  draft.value = newDraft()
  formError.value = ''
  editorOpen.value = true
}

function openEditForm(profile: LlmProfile) {
  editingProfileId.value = profile.id
  draft.value = newDraft(profile)
  formError.value = ''
  editorOpen.value = true
}

function closeEditor() {
  if (saving.value) return
  editorOpen.value = false
  formError.value = ''
  draft.value.api_key = ''
}

async function saveProfile() {
  if (!draft.value.name || !draft.value.model) {
    formError.value = '请填写档案名称和模型。'
    return
  }
  if (!editingProfileId.value && !draft.value.api_key.trim()) {
    formError.value = '新建档案必须填写 API Key。'
    return
  }
  if (draft.value.is_default && !draft.value.enabled) {
    formError.value = '默认档案必须处于启用状态。'
    return
  }

  try {
    saving.value = true
    formError.value = ''
    const common = {
      name: draft.value.name,
      provider: draft.value.provider,
      base_url: draft.value.base_url || null,
      model: draft.value.model,
      enabled: editingProfileId.value || profiles.value.length ? draft.value.enabled : true,
      is_default: draft.value.is_default
    }
    if (editingProfileId.value) {
      const payload: LlmProfileUpdate = { ...common }
      if (draft.value.api_key.trim()) payload.api_key = draft.value.api_key.trim()
      await llmProfileService.update(editingProfileId.value, payload)
      showNotice('LLM 配置档案已更新。')
    } else {
      await llmProfileService.create({ ...common, api_key: draft.value.api_key.trim() } as LlmProfileInput)
      showNotice('LLM 配置档案已创建。')
    }
    editorOpen.value = false
    draft.value.api_key = ''
    await refresh()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存 LLM 配置档案失败。'
  } finally {
    saving.value = false
  }
}

async function runAction(profile: LlmProfile, action: ProfileAction, task: () => Promise<void>) {
  try {
    working.value = { id: profile.id, action }
    await task()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '操作失败', 'error')
  } finally {
    working.value = null
  }
}

async function testProfile(profile: LlmProfile) {
  await runAction(profile, 'test', async () => {
    const result: LlmProfileConnectionTest = await llmProfileService.test(profile.id)
    if (result.ok) {
      showNotice(`连接成功，可获取 ${result.model_count ?? 0} 个模型。`)
    } else {
      showNotice(result.message || '连接测试失败。', 'error')
    }
  })
}

async function setDefault(profile: LlmProfile) {
  await runAction(profile, 'default', async () => {
    await llmProfileService.setDefault(profile.id)
    showNotice(`已将“${profile.name}”设为系统默认。`)
    await refresh()
  })
}

async function toggleEnabled(profile: LlmProfile) {
  await runAction(profile, 'toggle', async () => {
    await llmProfileService.update(profile.id, { enabled: !profile.enabled })
    showNotice(profile.enabled ? `已停用“${profile.name}”。` : `已启用“${profile.name}”。`)
    await refresh()
  })
}

async function removeProfile(profile: LlmProfile) {
  if (!window.confirm(`确认删除“${profile.name}”吗？此操作无法恢复。`)) return
  try {
    working.value = { id: profile.id, action: 'toggle' }
    await llmProfileService.remove(profile.id)
    showNotice(`已删除“${profile.name}”。`)
    await refresh()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '删除 LLM 配置档案失败', 'error')
  } finally {
    working.value = null
  }
}

onMounted(refresh)
</script>

<style scoped>
.llm-profiles-panel {
  display: grid;
  gap: 18px;
}
.llm-profiles-toolbar,
.llm-profiles-toolbar-actions,
.profile-name-line,
.profile-actions,
.profile-editor-header,
.profile-editor-actions,
.profile-form-options {
  display: flex;
  align-items: center;
}
.llm-profiles-toolbar,
.profile-editor-header {
  justify-content: space-between;
  gap: 18px;
}
.llm-profiles-toolbar h3,
.profile-editor-header h4 {
  margin: 0;
  color: #243552;
  font-size: 18px;
}
.llm-profiles-toolbar p,
.profile-editor-header p {
  margin: 5px 0 0;
  color: #687891;
  font-size: 13px;
  line-height: 1.55;
}
.llm-profiles-toolbar-actions,
.profile-editor-actions {
  flex: none;
  gap: 8px;
}
.profile-button,
.profile-action,
.profile-editor-close {
  border: 1px solid transparent;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}
.profile-button:active,
.profile-action:active,
.profile-editor-close:active {
  transform: translateY(1px);
}
.profile-button:disabled,
.profile-action:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}
.profile-button {
  min-height: 34px;
  padding: 0 13px;
  border-radius: 10px;
  font-size: 13px;
  white-space: nowrap;
}
.profile-button-primary {
  color: #fff;
  background: #285ea8;
  box-shadow: 0 7px 16px rgba(40, 94, 168, 0.2);
}
.profile-button-primary:hover:not(:disabled) {
  background: #1f4f90;
}
.profile-button-secondary {
  border-color: #ccd8e6;
  color: #405774;
  background: #fff;
}
.profile-button-secondary:hover:not(:disabled),
.profile-action:hover:not(:disabled) {
  border-color: #a9c4e6;
  color: #1f4f90;
  background: #f3f8ff;
}
.profile-notice,
.profile-form-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.profile-notice-success {
  color: #166534;
  background: #ecfdf3;
}
.profile-notice-error,
.profile-form-error {
  color: #b42318;
  background: #fff2f0;
}
.profile-skeleton-list,
.profile-list {
  display: grid;
  gap: 9px;
}
.profile-skeleton-row {
  display: block;
  height: 94px;
  border-radius: 14px;
  background: linear-gradient(100deg, #edf2f7 25%, #f7f9fc 38%, #edf2f7 54%);
  background-size: 200% 100%;
  animation: profile-loading 1.3s linear infinite;
}
.profile-empty-state {
  display: grid;
  justify-items: start;
  gap: 5px;
  padding: 28px;
  border: 1px dashed #bdccdd;
  border-radius: 14px;
  color: #687891;
  background: #f8fbff;
  font-size: 13px;
}
.profile-empty-state strong {
  color: #2f4664;
  font-size: 15px;
}
.profile-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content max-content;
  gap: 18px;
  align-items: center;
  padding: 14px 15px;
  border: 1px solid #dbe5ef;
  border-radius: 14px;
  background: #fff;
}
.profile-row.is-disabled {
  background: #fafbfd;
}
.profile-primary-info {
  min-width: 0;
}
.profile-name-line {
  flex-wrap: wrap;
  gap: 7px;
}
.profile-name-line strong {
  color: #263d5b;
  font-size: 14px;
}
.profile-primary-info p,
.profile-endpoint {
  display: block;
  overflow: hidden;
  margin: 5px 0 0;
  color: #637792;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-endpoint {
  margin-top: 3px;
  color: #8a9ab0;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
}
.profile-status,
.profile-key-status {
  padding: 3px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}
.profile-status-default {
  color: #174a83;
  background: #e6f1ff;
}
.profile-status-enabled,
.profile-key-status {
  color: #257047;
  background: #edf9f0;
}
.profile-status-disabled,
.profile-key-status.is-missing {
  color: #8a5d19;
  background: #fff8e6;
}
.profile-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
.profile-action {
  min-height: 29px;
  padding: 0 8px;
  border-color: #d6e0ea;
  border-radius: 8px;
  color: #50657e;
  background: #fff;
  font-size: 12px;
  white-space: nowrap;
}
.profile-action-danger {
  color: #b42318;
}
.profile-action-danger:hover:not(:disabled) {
  border-color: #f2bbb4;
  color: #9d1d14;
  background: #fff4f2;
}
.profile-editor {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid #c9d9eb;
  border-radius: 14px;
  background: #f8fbff;
}
.profile-editor-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: #667990;
  background: transparent;
  font-size: 22px;
  line-height: 1;
}
.profile-editor-close:hover {
  color: #a3261c;
  background: #fff0ee;
}
.profile-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}
.profile-field {
  display: grid;
  gap: 7px;
  color: #435a76;
  font-size: 12px;
  font-weight: 750;
}
.profile-field-wide {
  grid-column: 1 / -1;
}
.profile-field input,
.profile-field select {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  border: 1px solid #c4d2e1;
  border-radius: 9px;
  padding: 0 10px;
  color: #273b55;
  background: #fff;
  font: inherit;
  outline: none;
}
.profile-field input:focus,
.profile-field select:focus {
  border-color: #3b7dc7;
  box-shadow: 0 0 0 3px rgba(59, 125, 199, 0.13);
}
.profile-field small {
  color: #7d8ea5;
  font-size: 11px;
  font-weight: 500;
}
.profile-form-options {
  flex-wrap: wrap;
  gap: 16px;
}
.profile-check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #405774;
  font-size: 13px;
  font-weight: 650;
}
.profile-check input {
  width: 15px;
  height: 15px;
  accent-color: #285ea8;
}
.profile-editor-actions {
  justify-content: flex-end;
}
@keyframes profile-loading {
  to { background-position: -200% 0; }
}
@media (max-width: 760px) {
  .llm-profiles-toolbar,
  .profile-editor-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .profile-row {
    grid-template-columns: 1fr;
    gap: 11px;
  }
  .profile-actions {
    justify-content: flex-start;
  }
  .profile-form-grid {
    grid-template-columns: 1fr;
  }
  .profile-field-wide {
    grid-column: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .profile-skeleton-row { animation: none; }
  .profile-button,
  .profile-action,
  .profile-editor-close { transition: none; }
}
</style>
