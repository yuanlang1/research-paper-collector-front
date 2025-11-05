<template>
  <button 
    @click="handleClick"
    class="search-button"
    type="button"
  >
    <svg width="29.25" height="29.25" viewBox="0 0 29.25 29.25" fill="none">
      <circle 
        cx="13" 
        cy="13" 
        r="9" 
        stroke="currentColor" 
        stroke-width="4"
        fill="none"
      />
      <path 
        d="m21 21 4.35 4.35" 
        stroke="currentColor" 
        stroke-width="4" 
        stroke-linecap="round"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
// Emits
const emit = defineEmits<{
  click: []
}>()

// 处理点击
const handleClick = () => {
  emit('click')
}
</script>

<style scoped>
.search-button {
  width: 39px;
  height: 39px;
  border: none;
  background: none;
  cursor: pointer;
  color: #0088ff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4.875px;
  border-radius: 8px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.search-button:hover {
  background-color: rgba(0, 136, 255, 0.1);
  color: #0066cc;
}

.search-button:active {
  background-color: rgba(0, 136, 255, 0.2);
  color: #004499;
}

.search-button:focus {
  outline: 2px solid rgba(0, 136, 255, 0.3);
  outline-offset: 2px;
}
</style>
