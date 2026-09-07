<template>
  <section class="design-panel creative-direction-panel">
    <div class="creative-direction-heading">
      <div class="design-panel__title">
        <i class="fa-solid fa-bullseye"></i>
        <span>创作方向</span>
      </div>
      <span
        class="creative-direction-status"
        :class="{ ready: directionReady }"
      >
        <i :class="directionReady ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'"></i>
        {{ directionReady ? '定位已完整' : missingDirectionText }}
      </span>
    </div>

    <div class="creative-direction-grid">
      <label class="direction-control">
        <span>发布平台 <em>*</em></span>
        <el-select
          :model-value="baseConfig.platform"
          class="ink-select workflow-config-select"
          popper-class="ink-select-popper"
          fit-input-width
          @change="selectPlatform(String($event))"
        >
          <el-option
            v-for="platform in platformOptions"
            :key="platform.code"
            :label="platform.name"
            :value="platform.name"
          />
        </el-select>
      </label>

      <label class="direction-control">
        <span>目标读者 <em>*</em></span>
        <el-select
          :model-value="baseConfig.audience"
          class="ink-select workflow-config-select"
          popper-class="ink-select-popper"
          fit-input-width
          @change="selectAudience(String($event))"
        >
          <el-option
            v-for="option in audienceOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </label>

      <label class="direction-control">
        <span>小说类型 <em>*</em></span>
        <el-select
          :model-value="selectedGenre"
          class="ink-select workflow-config-select"
          popper-class="ink-select-popper"
          filterable
          allow-create
          fit-input-width
          placeholder="请选择或输入类型"
          @change="selectGenre(String($event))"
        >
          <el-option
            v-for="option in genreOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </label>

      <label class="direction-control direction-control--tags">
        <span>风格标签</span>
        <el-select
          :model-value="baseConfig.tags"
          class="ink-select workflow-config-select"
          popper-class="ink-select-popper"
          multiple
          filterable
          allow-create
          collapse-tags
          collapse-tags-tooltip
          fit-input-width
          placeholder="可选"
          @change="updateTags"
        >
          <el-option
            v-for="tag in tagOptions"
            :key="tag"
            :label="tag"
            :value="tag"
          />
        </el-select>
      </label>

      <label class="direction-control direction-control--model">
        <span>本次模型</span>
        <ModelChip
          :model-value="baseConfig.modelCode"
          group-code="workflow_book"
          scope="book"
          @update:model-value="handleModelChange"
        />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModelChip from '@/components/ModelChip.vue'
import type { WorkflowBaseConfig, WorkflowDraft } from '../types'
import type { WorkflowResources } from '@/types/workflow'

const props = withDefaults(defineProps<{
  draft: WorkflowDraft
  resources?: WorkflowResources | null
}>(), {
  resources: null,
})

const emit = defineEmits<{
  (event: 'patch', payload: Partial<WorkflowDraft>): void
}>()

const baseConfig = computed(() => props.draft.baseConfig)
const platformOptions = computed(() => props.resources?.platforms || [])
const selectedPlatform = computed(() =>
  platformOptions.value.find(item => item.name === baseConfig.value.platform)
)
const audienceOptions = computed(() =>
  props.resources?.selectFields.find(item => item.key === 'audience')?.options || ['男频', '女频']
)

const selectedGenre = computed(() => baseConfig.value.genre)
const genreOptions = computed(() => Array.from(new Set([
  ...(props.resources?.genres || []),
  baseConfig.value.genre,
].filter(Boolean))))
const tagOptions = computed(() => Array.from(new Set([
  ...(props.resources?.tags || []),
  ...baseConfig.value.tags,
])))

const directionReady = computed(() => Boolean(
  baseConfig.value.platform.trim() &&
  baseConfig.value.audience.trim() &&
  baseConfig.value.genre.trim()
))
const missingDirectionText = computed(() => {
  if (!baseConfig.value.platform.trim()) return '请选择发布平台'
  if (!baseConfig.value.audience.trim()) return '请选择目标读者'
  return '请选择小说类型'
})

// 方向配置始终整包替换，确保草稿只有一个状态来源。
const updateBaseConfig = (payload: Partial<WorkflowBaseConfig>) => {
  emit('patch', {
    baseConfig: {
      ...props.draft.baseConfig,
      ...payload,
    },
  })
}

const selectPlatform = (platformName: string) => {
  const platform = platformOptions.value.find(item => item.name === platformName)
  if (!platform) return
  updateBaseConfig({
    platform: platform.name,
  })
}

const selectAudience = (audience: string) => {
  updateBaseConfig({ audience })
}

const selectGenre = (genre: string) => {
  const value = genre.trim()
  if (!value) return
  const isCommonGenre = (props.resources?.genres || []).includes(value)
  updateBaseConfig({
    genre: value,
    platformCategory: value,
    platformCategorySource: isCommonGenre ? 'common' : 'custom',
  })
}

const updateTags = (value: unknown) => {
  const tags = Array.isArray(value)
    ? value.map(item => String(item).trim()).filter(Boolean)
    : []
  updateBaseConfig({ tags })
}

// 空值表示沿用用户的 AI 功能偏好，具体模型表示本书显式锁定。
const handleModelChange = (modelCode: string) => {
  updateBaseConfig({
    modelCode,
    modelFollowPreference: modelCode === '',
  })
}
</script>
