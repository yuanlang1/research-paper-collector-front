<template>
  <div class="review-tasks-wrapper">
    <div class="background-shapes" aria-hidden="true">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <main class="review-tasks-container">
      <header class="page-header">
        <h1 class="page-title">综述任务列表</h1>
      </header>

      <form class="filter-panel" @submit.prevent="applyFilters">
        <div class="filter-field keyword-field">
          <label for="review-keyword">关键词</label>
          <input
            id="review-keyword"
            v-model="keywordInput"
            type="search"
            placeholder="搜索综述主题或标题"
            autocomplete="off"
          />
        </div>
        <div class="filter-field task-id-field">
          <label for="review-task-id">检索任务 ID</label>
          <input
            id="review-task-id"
            v-model="taskIdInput"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            placeholder="例如 12"
          />
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="submit" :disabled="isLoading">查询</button>
          <button class="btn btn-outline" type="button" :disabled="isLoading" @click="resetFilters">
            重置
          </button>
        </div>
      </form>

      <section class="table-container" aria-live="polite" :aria-busy="isLoading">
        <div v-if="isLoading" class="state-panel">
          <div class="loading-spinner" aria-hidden="true"></div>
          <p>正在加载综述任务...</p>
        </div>

        <div v-else-if="errorMessage" class="state-panel error-state" role="alert">
          <h2>综述任务加载失败</h2>
          <p>{{ errorMessage }}</p>
          <button class="btn btn-primary" type="button" @click="fetchReviews(currentPage)">重新加载</button>
        </div>

        <div v-else-if="reviews.length" class="table-wrapper">
          <table class="review-table">
            <thead>
              <tr>
                <th class="align-center">综述 ID</th>
                <th class="align-center">关联检索任务</th>
                <th class="align-left">主题</th>
                <th class="align-left">标题</th>
                <th class="align-center">版本</th>
                <th class="align-center">语言</th>
                <th class="align-center">综述类型</th>
                <th class="align-center">引用格式</th>
                <th class="align-center">创建时间</th>
                <th class="align-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="review in reviews" :key="review.id">
                <td class="align-center review-id">#{{ review.id }}</td>
                <td class="align-center task-reference">任务 #{{ review.taskId }}</td>
                <td class="align-left text-cell" :title="review.topic">{{ review.topic || '-' }}</td>
                <td class="align-left title-cell" :title="review.title">{{ review.title || '-' }}</td>
                <td class="align-center"><span class="version-badge">v{{ review.versionNumber }}</span></td>
                <td class="align-center">{{ review.language || '-' }}</td>
                <td class="align-center">{{ review.reviewTypeName || '-' }}</td>
                <td class="align-center citation-style">{{ review.citationStyleName || '-' }}</td>
                <td class="align-center time-cell">{{ review.creationTime || '-' }}</td>
                <td class="align-center">
                  <button class="btn btn-sm btn-outline" type="button" @click="viewReview(review.id)">
                    查看
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="state-panel empty-state">
          <h2>暂无综述任务</h2>
          <p>{{ hasAppliedFilters ? '没有找到符合条件的综述记录' : '还没有已保存的综述记录' }}</p>
          <button v-if="hasAppliedFilters" class="btn btn-outline" type="button" @click="resetFilters">
            清除筛选
          </button>
        </div>
      </section>

      <div v-if="reviews.length" class="pagination-container">
        <div class="pagination-row">
          <div class="page-size-selector">
            <label for="review-page-size">每页显示：</label>
            <select id="review-page-size" v-model.number="pageSize" class="page-size-select" @change="changePageSize">
              <option :value="5">5条</option>
              <option :value="10">10条</option>
              <option :value="20">20条</option>
              <option :value="50">50条</option>
            </select>
          </div>

          <div class="pagination" aria-label="综述任务分页">
            <button
              class="btn btn-outline"
              type="button"
              :disabled="currentPage <= 1"
              @click="changePage(currentPage - 1)"
            >
              上一页
            </button>
            <div class="page-numbers">
              <button
                v-for="page in visiblePages"
                :key="page"
                class="btn page-btn"
                :class="{ active: page === currentPage }"
                type="button"
                :aria-current="page === currentPage ? 'page' : undefined"
                @click="changePage(page)"
              >
                {{ page }}
              </button>
            </div>
            <button
              class="btn btn-outline"
              type="button"
              :disabled="currentPage >= totalPages"
              @click="changePage(currentPage + 1)"
            >
              下一页
            </button>
          </div>
        </div>
        <div class="page-info">第 {{ currentPage }} 页，共 {{ totalPages }} 页（总计 {{ totalReviews }} 条）</div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiService, type ReviewTask, type ReviewTasksParams } from '@/services/api'

const router = useRouter()

const reviews = ref<ReviewTask[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalPages = ref(0)
const totalReviews = ref(0)

const keywordInput = ref('')
const taskIdInput = ref('')
const appliedKeyword = ref('')
const appliedTaskId = ref<number | undefined>()

const hasAppliedFilters = computed(() => Boolean(appliedKeyword.value || appliedTaskId.value))

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 3) return [1, 2, 3, 4, 5]
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
  return [current - 2, current - 1, current, current + 1, current + 2]
})

const fetchReviews = async (page: number) => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const params: ReviewTasksParams = {
      pageIndex: page,
      pageSize: pageSize.value,
      taskId: appliedTaskId.value,
      keyword: appliedKeyword.value || undefined
    }
    const response = await apiService.getReviewTasks(params)

    reviews.value = response.data.list
    totalReviews.value = response.data.total
    totalPages.value = response.data.pages
    currentPage.value = response.data.pageNumber
    pageSize.value = response.data.pageSize
  } catch (error) {
    reviews.value = []
    totalReviews.value = 0
    totalPages.value = 0
    errorMessage.value = error instanceof Error ? error.message : '无法获取综述任务，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const applyFilters = async () => {
  const normalizedTaskId = String(taskIdInput.value).trim()
  if (normalizedTaskId && !/^[1-9]\d*$/.test(normalizedTaskId)) {
    errorMessage.value = '检索任务 ID 必须是大于 0 的整数'
    return
  }

  appliedKeyword.value = keywordInput.value.trim()
  appliedTaskId.value = normalizedTaskId ? Number(normalizedTaskId) : undefined
  currentPage.value = 1
  await fetchReviews(1)
}

const resetFilters = async () => {
  keywordInput.value = ''
  taskIdInput.value = ''
  appliedKeyword.value = ''
  appliedTaskId.value = undefined
  currentPage.value = 1
  await fetchReviews(1)
}

const changePage = async (page: number) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  await fetchReviews(page)
}

const changePageSize = async () => {
  currentPage.value = 1
  await fetchReviews(1)
}

const viewReview = (id: number) => {
  router.push({ name: 'review-detail', params: { id: id.toString() } })
}

onMounted(() => fetchReviews(1))
</script>

<style scoped>
.review-tasks-wrapper {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow-x: hidden;
}

.background-shapes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
  will-change: transform;
}

.shape-1 {
  width: 400px;
  height: 400px;
  top: -100px;
  left: -100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.shape-2 {
  width: 350px;
  height: 350px;
  top: 50%;
  right: -100px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  animation-delay: 7s;
}

.shape-3 {
  width: 300px;
  height: 300px;
  bottom: -100px;
  left: 50%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  animation-delay: 14s;
}

@keyframes float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  33% { transform: translate3d(50px, -50px, 0) scale(1.1); }
  66% { transform: translate3d(-50px, 50px, 0) scale(0.9); }
}

.review-tasks-container {
  position: relative;
  z-index: 1;
  width: 95%;
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 30px 0 42px;
}

.page-header {
  text-align: center;
  margin-bottom: 4px;
}

.page-title {
  margin: 0 0 13px;
  font-size: 45px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.28);
  outline-offset: 2px;
}

.filter-panel {
  width: min(100%, 900px);
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #dbe3ed;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.filter-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.keyword-field { flex: 1; }
.task-id-field { width: 194px; }

.filter-field label {
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.filter-field input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2937;
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.filter-field input::placeholder { color: #9ca3af; }
.filter-field input:hover { border-color: #9ca3af; }
.filter-field input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.filter-actions {
  display: flex;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid #e5e7eb;
}

.filter-actions .btn {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
}

.table-container {
  width: 100%;
  min-height: 220px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-wrapper {
  max-height: 70vh;
  overflow: auto;
}

.review-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.review-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 12px 10px;
  border-bottom: 2px solid #e5e7eb;
  background: #f8f9fa;
  color: #374151;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.review-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  vertical-align: middle;
}

.review-table tbody tr:hover { background: #f9fafb; }
.align-left { text-align: left; }
.align-center { text-align: center; }

.review-id,
.task-reference {
  color: #2563eb;
  font-weight: 600;
  white-space: nowrap;
}

.text-cell,
.title-cell {
  min-width: 220px;
  max-width: 340px;
  line-height: 1.55;
}

.title-cell { color: #111827; font-weight: 500; }

.version-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  background: #dbeafe;
  color: #1e40af;
  font-size: 12px;
  font-weight: 600;
}

.citation-style { text-transform: uppercase; }
.time-cell { min-width: 150px; white-space: nowrap; }

.state-panel {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6b7280;
  text-align: center;
}

.state-panel h2 {
  margin: 0 0 8px;
  color: #374151;
  font-size: 18px;
}

.state-panel p { margin: 0 0 22px; font-size: 14px; }
.error-state p { color: #b91c1c; }

.loading-spinner {
  width: 32px;
  height: 32px;
  margin-bottom: 16px;
  border: 3px solid #f3f4f6;
  border-top-color: #0088ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { border-color: #0066cc; background: #0066cc; color: #ffffff; }
.btn-primary:hover:not(:disabled) { border-color: #0052a3; background: #0052a3; }
.btn-outline { border-color: #d0d7de; background: transparent; color: #4b5563; }
.btn-outline:hover:not(:disabled) { background: #f6f8fa; }
.btn-sm { padding: 4px 8px; font-size: 12px; }

.pagination-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: -4px;
}

.pagination-row,
.page-size-selector,
.pagination,
.page-numbers {
  display: flex;
  align-items: center;
}

.pagination-row { justify-content: center; gap: 24px; flex-wrap: wrap; }
.page-size-selector { gap: 8px; color: #374151; font-size: 14px; }
.page-size-selector label { font-weight: 500; }
.pagination { justify-content: center; gap: 8px; flex-wrap: wrap; }
.page-numbers { gap: 4px; margin: 0 16px; }

.page-size-select {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.page-btn {
  min-width: 40px;
  height: 40px;
  padding: 8px;
  border-color: #d1d5db;
  background: #ffffff;
  color: #374151;
}

.page-btn:hover { border-color: #9ca3af; background: #f3f4f6; }
.page-btn.active { border-color: #2563eb; background: #2563eb; color: #ffffff; }
.page-info { color: #6b7280; font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
  .shape,
  .loading-spinner { animation: none; }
}

@media (max-width: 768px) {
  .review-tasks-container { padding: 24px 0 32px; }
  .page-title { font-size: 24px; }
  .filter-panel { align-items: stretch; flex-direction: column; gap: 10px; }
  .filter-field { width: 100%; }
  .task-id-field { width: 100%; }
  .filter-actions { width: 100%; padding-left: 0; border-left: none; }
  .filter-actions .btn { flex: 1; }
  .review-table { font-size: 12px; }
  .review-table th,
  .review-table td { padding: 8px 6px; }
  .pagination-row,
  .pagination { flex-direction: column; gap: 12px; }
  .page-numbers { margin: 0 8px; }
  .page-btn { min-width: 36px; height: 36px; font-size: 13px; }
}
</style>
