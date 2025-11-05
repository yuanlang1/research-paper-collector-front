<template>
  <div class="add-keyword-button">
    <input
      v-if="isAdding"
      v-model="newKeyword"
      @blur="handleSave"
      @keyup.enter="handleSave"
      @keyup.escape="handleCancel"
      class="keyword-input"
      placeholder="输入关键词"
      ref="inputRef"
    />
    <button v-else @click="startAdd" class="add-button" type="button">
      <svg width="13.4" height="12.8" viewBox="0 0 13.4 12.8" fill="none">
        <path 
          d="M6.7 1V11.8M1 6.4H12.4" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

// Emits
const emit = defineEmits<{
  add: [keyword: string]
}>()

// 状态
const isAdding = ref(false)
const newKeyword = ref('')
const inputRef = ref<HTMLInputElement>()

// 开始添加
const startAdd = async () => {
  isAdding.value = true
  newKeyword.value = ''
  await nextTick()
  inputRef.value?.focus()
}

// 保存新关键词
const handleSave = () => {
  if (newKeyword.value.trim()) {
    emit('add', newKeyword.value.trim())
  }
  isAdding.value = false
  newKeyword.value = ''
}

// 取消添加
const handleCancel = () => {
  isAdding.value = false
  newKeyword.value = ''
}
</script>

<style scoped>
.add-keyword-button {
  display: inline-flex;
  align-items: center;
}

.add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  color: #444444;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.add-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: #222222;
}

.add-button:active {
  background-color: rgba(0, 0, 0, 0.2);
}

.keyword-input {
  height: 32px;
  padding: 8px 12px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  font-size: 14px;
  color: #1e1e1e;
  background-color: #ffffff;
  outline: none;
  min-width: 120px;
  transition: border-color 0.2s ease;
}

.keyword-input:focus {
  border-color: #0088ff;
  box-shadow: 0 0 0 2px rgba(0, 136, 255, 0.1);
}

.keyword-input::placeholder {
  color: #999999;
}
</style>
