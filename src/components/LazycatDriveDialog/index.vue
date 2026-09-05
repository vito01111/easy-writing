<template>
  <EwModal
    v-model:visible="visibleProxy"
    :title="title"
    width="min(560px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="lazycat-drive">
      <div class="root-row" v-if="mode === 'open'">
        <button
          v-for="r in rootOptions"
          :key="r.key"
          type="button"
          class="root-tab"
          :class="{ active: root === r.key }"
          @click="switchRoot(r.key)"
        >
          {{ r.label }}
        </button>
      </div>

      <div class="breadcrumb">
        <button type="button" class="crumb" @click="navigateTo('')">{{ rootLabel }}</button>
        <template v-for="(seg, idx) in segments" :key="idx">
          <span class="crumb-sep">/</span>
          <button type="button" class="crumb" @click="navigateTo(segments.slice(0, idx + 1).join('/'))">{{ seg }}</button>
        </template>
      </div>

      <div class="file-list" v-loading="loading">
        <div v-if="errorMessage" class="list-state error">{{ errorText }}</div>
        <div v-else-if="!loading && !items.length" class="list-state">此处暂无文件</div>
        <template v-else>
          <button
            v-for="item in items"
            :key="item.name"
            type="button"
            class="file-row"
            :class="{
              dir: item.dir,
              selected: mode === 'open' && !item.dir && isSelected(item),
              disabled: item.dir === false && item.reachable === false,
            }"
            :disabled="mode === 'save' && !item.dir"
            @click="handleItemClick(item)"
          >
            <i :class="item.dir ? 'fa-solid fa-folder' : 'fa-regular fa-file-lines'"></i>
            <span class="name">{{ item.name }}</span>
            <span v-if="item.dir && item.reachable === false" class="badge">暂时不可用</span>
            <span v-else-if="!item.dir && item.size != null" class="size">{{ formatSize(item.size) }}</span>
          </button>
        </template>
      </div>

      <div class="save-row" v-if="mode === 'save'">
        <label>文件名</label>
        <input v-model="filename" class="filename-input" type="text" spellcheck="false" />
      </div>
    </div>

    <template #footer>
      <div class="actions">
        <button type="button" class="ink-btn ink-btn-outline" @click="handleClose">取消</button>
        <button
          v-if="mode === 'open'"
          type="button"
          class="ink-btn ink-btn-accent"
          :disabled="!selectedFile"
          @click="confirmOpen"
        >
          打开
        </button>
        <button
          v-else
          type="button"
          class="ink-btn ink-btn-accent"
          :disabled="saving || !filename.trim()"
          @click="confirmSave"
        >
          <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
          保存
        </button>
      </div>
    </template>
  </EwModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EwModal from '@/components/EwModal/index.vue'
import {
  listLazycatDir,
  readLazycatFile,
  saveLazycatFile,
  type LazycatDriveItem,
  type LazycatDriveRoot,
} from '@/utils/lazycat-drive'

const props = defineProps<{
  mode: 'open' | 'save'
  accepts?: string[]
  filename?: string
  contentBase64?: string
  defaultRoot?: LazycatDriveRoot
  onClose: (result: { file?: File; savedPath?: string; done: boolean }) => void
}>()

const visible = ref(true)
const visibleProxy = computed({
  get: () => visible.value,
  set: (value: boolean) => {
    visible.value = value
    if (!value) handleClose()
  },
})

const root = ref<LazycatDriveRoot>(props.defaultRoot || (props.mode === 'save' ? 'documents' : 'netdisk'))
const path = ref('')
const items = ref<LazycatDriveItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const selectedName = ref('')
const filename = ref(props.filename || '')
const saving = ref(false)

const rootOptions = [
  { key: 'netdisk' as LazycatDriveRoot, label: '懒猫网盘' },
  { key: 'documents' as LazycatDriveRoot, label: '应用文稿' },
]

const rootLabel = computed(() => (root.value === 'netdisk' ? '懒猫网盘' : '应用文稿'))
const title = computed(() => (props.mode === 'open' ? '从懒猫网盘打开' : '保存到懒猫网盘'))
const segments = computed(() => (path.value ? path.value.split('/') : []))
const selectedFile = computed(() => (selectedName.value ? `${path.value ? path.value + '/' : ''}${selectedName.value}` : ''))

const errorText = computed(() => {
  if (errorMessage.value === 'user-dir-not-found') return '未找到当前用户的网盘目录'
  if (errorMessage.value === 'unreachable') return '此目录暂时不可用（挂载可能未就绪）'
  if (errorMessage.value === 'lazycat-unavailable') return '懒猫文件通道不可用'
  return errorMessage.value || '加载失败'
})

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const isAccepted = (name: string) => {
  if (!props.accepts?.length) return true
  const lower = name.toLowerCase()
  return props.accepts.some(ext => lower.endsWith(ext.toLowerCase()))
}

const refresh = async () => {
  loading.value = true
  errorMessage.value = ''
  selectedName.value = ''
  try {
    const result = await listLazycatDir(root.value, path.value)
    if (!result.ok) {
      errorMessage.value = result.error || '加载失败'
      items.value = []
    } else {
      items.value = result.items
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

const switchRoot = (key: LazycatDriveRoot) => {
  if (root.value === key) return
  root.value = key
  path.value = ''
  void refresh()
}

const navigateTo = (next: string) => {
  if (path.value === next) return
  path.value = next
  void refresh()
}

const isSelected = (item: LazycatDriveItem) => selectedName.value === item.name

const handleItemClick = (item: LazycatDriveItem) => {
  if (item.dir) {
    if (item.reachable === false) return
    path.value = `${path.value ? `${path.value}/` : ''}${item.name}`
    void refresh()
    return
  }
  if (props.mode !== 'open') return
  if (!isAccepted(item.name)) return
  selectedName.value = item.name
}

const confirmOpen = async () => {
  if (!selectedFile.value) return
  try {
    const file = await readLazycatFile(root.value, selectedFile.value)
    props.onClose({ file, done: true })
  } catch (error) {
    selectedName.value = ''
    errorMessage.value = error instanceof Error ? error.message : '读取失败'
  }
}

const confirmSave = async () => {
  const name = filename.value.trim()
  if (!name || saving.value) return
  saving.value = true
  try {
    const savedPath = await saveLazycatFile(path.value, name, props.contentBase64 || '')
    props.onClose({ savedPath: savedPath, done: true })
  } catch (error) {
    alert(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  props.onClose({ done: false })
}

onMounted(() => {
  void refresh()
})
</script>

<style scoped lang="scss">
.lazycat-drive {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
}

.root-row {
  display: flex;
  gap: 8px;
}

.root-tab {
  border: 1px solid var(--ew-border, #ddd5c8);
  background: transparent;
  border-radius: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;

  &.active {
    background: var(--ew-accent, #8c2f24);
    border-color: var(--ew-accent, #8c2f24);
    color: #fff;
  }
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  color: var(--ew-text-secondary, #6b6257);

  .crumb {
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
    padding: 2px 4px;
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }

  .crumb-sep {
    opacity: 0.5;
  }
}

.file-list {
  flex: 1;
  min-height: 240px;
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--ew-border, #e5ddcf);
  border-radius: 10px;
  padding: 6px;
}

.list-state {
  padding: 32px 12px;
  text-align: center;
  color: var(--ew-text-secondary, #8a8175);
  font-size: 13px;

  &.error {
    color: #a33;
  }
}

.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;

  &:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.05);
  }

  &.selected {
    background: rgba(140, 47, 36, 0.12);
  }

  &.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    font-size: 12px;
    color: #a33;
  }

  .size {
    font-size: 12px;
    color: var(--ew-text-secondary, #8a8175);
  }
}

.save-row {
  display: flex;
  align-items: center;
  gap: 10px;

  label {
    font-size: 13px;
    color: var(--ew-text-secondary, #6b6257);
  }

  .filename-input {
    flex: 1;
    border: 1px solid var(--ew-border, #ddd5c8);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    background: transparent;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
