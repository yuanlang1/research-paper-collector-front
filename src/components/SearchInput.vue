<template>
  <div class="search-input-container">
    <div class="search-input-wrapper">
      <input
        v-model="inputValue"
        type="text"
        placeholder="搜索论文相关词..."
        class="search-input"
        @keyup.enter="handleSearch"
        @input="handleInput"
      />
      <div class="search-input-right">
        <button 
          v-if="inputValue" 
          @click="handleClear"
          class="clear-button"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path 
              d="M12 4L4 12M4 4L12 12" 
              stroke="currentColor" 
              stroke-width="1.6" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <slot name="right" />
      </div>
    </div>
    <!-- 额外内容槽位，例如年份标签 -->
    <div class="search-input-extra">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

// Props
interface Props {
  modelValue: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: []
  clear: []
}>()

// 本地状态
const inputValue = ref(props.modelValue)

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  inputValue.value = newValue
})

// 监听输入变化
watch(inputValue, (newValue) => {
  emit('update:modelValue', newValue)
})

// 处理输入
const handleInput = () => {
  emit('update:modelValue', inputValue.value)
}

// 处理搜索
const handleSearch = () => {
  emit('search')
}

// 处理清空
const handleClear = () => {
  inputValue.value = ''
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<style scoped>
.search-input-container {
  width: 100%;
  max-width: 355px;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  height: 44px;
  padding: 14px 16px;
  padding-right: 140px; /* 预留右侧区域给下拉框和清空按钮 */
  border: 1px solid #d9d9d9;
  border-radius: 9999px;
  font-size: 14px;
  color: #1e1e1e;
  background-color: #ffffff;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-input-right {
  position: absolute;
  right: 2px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-input::placeholder {
  color: #999999;
}

.search-input:focus {
  border-color: #0088ff;
  box-shadow: 0 0 0 2px rgba(0, 136, 255, 0.1);
}

.clear-button {
  width: 16px;
  height: 16px;
  border: none;
  background: none;
  cursor: pointer;
  color: #1e1e1e;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: #666666;
}

.clear-button:active {
  color: #333333;
}

.search-input-extra {
  margin-top: 6px;
  display: flex;
  justify-content: flex-start;
}
</style>
