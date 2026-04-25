<template>
  <div class="editable-tag">
    <input
      v-if="isEditing"
      v-model="editValue"
      @blur="handleSave"
      @keyup.enter="handleSave"
      @keyup.escape="handleCancel"
      @click.stop
      class="tag-input"
      ref="inputRef"
    />
    <span v-else class="tag-text" @click.stop @dblclick.stop="startEdit">
      {{ keyword }}
    </span>
    <button
      @click.stop="handleRemove"
      class="remove-button"
      type="button"
      aria-label="删除标签"
      title="删除标签"
    >
      <span class="close-icon"></span>
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
  position: relative;
  display: inline-flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 5px 22px 5px 9px;
  gap: 5px;
  font-size: 13px;
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
  min-width: 12px;
  line-height: 1.1;
}

.tag-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: #1e1e1e;
  min-width: 44px;
  max-width: 180px;
  width: 100%;
}

.remove-button {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  color: inherit;
}

.close-icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
  line-height: 12px;
  opacity: 0.5;
  margin-left: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-icon::before {
  content: "\2716";
}

.remove-button:hover .close-icon {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
  color: #ff4d4f;
}
</style>
