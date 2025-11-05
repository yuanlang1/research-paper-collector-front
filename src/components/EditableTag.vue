<template>
  <div class="editable-tag">
    <input
      v-if="isEditing"
      v-model="editValue"
      @blur="handleSave"
      @keyup.enter="handleSave"
      @keyup.escape="handleCancel"
      class="tag-input"
      ref="inputRef"
    />
    <span v-else class="tag-text" @dblclick="startEdit">
      {{ keyword }}
    </span>
    <button @click="handleRemove" class="remove-button" type="button">
      ×
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

// Props
interface Props {
  keyword: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  update: [keyword: string]
  remove: []
}>()

// 状态
const isEditing = ref(false)
const editValue = ref(props.keyword)
const inputRef = ref<HTMLInputElement>()

// 开始编辑
const startEdit = async () => {
  isEditing.value = true
  editValue.value = props.keyword
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

// 保存编辑
const handleSave = () => {
  if (editValue.value.trim() && editValue.value.trim() !== props.keyword) {
    emit('update', editValue.value.trim())
  }
  isEditing.value = false
}

// 取消编辑
const handleCancel = () => {
  editValue.value = props.keyword
  isEditing.value = false
}

// 移除标签
const handleRemove = () => {
  emit('remove')
}
</script>

<style scoped>
.editable-tag {
  display: inline-flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 8px 12px;
  gap: 8px;
  font-size: 14px;
  color: #1e1e1e;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.editable-tag:hover {
  background-color: #eeeeee;
  border-color: #d0d7de;
}

.tag-text {
  cursor: pointer;
  user-select: none;
  min-width: 20px;
}

.tag-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #1e1e1e;
  min-width: 60px;
  max-width: 200px;
}

.remove-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: none;
  cursor: pointer;
  color: #666666;
  border-radius: 2px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}

.remove-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: #333333;
}

.remove-button:active {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
