<template>
  <div class="workflow-first-step">
    <WorkflowCreativeDirectionBar
      :draft="draft"
      :resources="resources"
      @patch="$emit('patch', $event)"
    />

    <div class="workflow-first-step__body is-original-mode">
      <section class="design-panel inspiration-panel original-inspiration-panel">
        <div class="original-inspiration-head">
          <div class="design-panel__title">
            <i class="fa-regular fa-lightbulb"></i>
            <span>灵感输入</span>
          </div>
          <p class="original-inspiration-subtitle">输入一句想法，AI 将结合上方创作方向生成</p>
        </div>

        <div class="original-idea-editor">
          <textarea
            :value="draft.ideaText"
            maxlength="1000"
            rows="7"
            placeholder="输入你的故事灵感、开头片段、主题概念、角色设想、世界背景等任何相关内容...&#10;越详细越有助于 AI 理解你的想法，为你生成更贴合的内容。&#10;你也可以输入一句话、一个关键词或一个情绪......"
            @input="$emit('patch', { ideaText: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
          <em>{{ draft.ideaText.length }} / 1000</em>
        </div>

        <div class="idea-assist-bar">
          <span class="idea-assist-bar__hint">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            AI 会遵守当前平台、读者、类型与风格标签
          </span>
          <div class="idea-assist-bar__actions">
            <button
              class="idea-assist-btn"
              type="button"
              :disabled="!directionReady || generating"
              @click="requestIdea('generate')"
            >
              <i :class="activeAction === 'generate' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-wand-magic-sparkles'"></i>
              {{ activeAction === 'generate' ? '生成中…' : '按当前定位生成灵感' }}
            </button>
            <button
              class="idea-assist-btn"
              type="button"
              :disabled="!directionReady || !draft.ideaText.trim() || generating"
              @click="requestIdea('optimize')"
            >
              <i :class="activeAction === 'optimize' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-pen'"></i>
              {{ activeAction === 'optimize' ? '优化中…' : 'AI优化' }}
            </button>
          </div>
        </div>

      </section>

      <aside class="workflow-side-stack original-side-stack">
        <section class="design-panel original-side-panel">
          <div class="design-panel__title">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>AI 灵感辅助</span>
          </div>
          <div class="original-assist-grid">
            <button
              v-for="item in originalAssistItems"
              :key="item.code"
              type="button"
              :disabled="!directionReady || generating"
              @click="requestIdea(item.code)"
            >
              <i :class="activeAction === item.code ? 'fa-solid fa-spinner fa-spin' : item.icon"></i>
              <span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.desc }}</small>
              </span>
            </button>
          </div>
          <div v-if="ideaPreview" class="idea-preview-popover">
            <div class="idea-preview-popover__head">
              <strong>AI 生成结果</strong>
              <button type="button" aria-label="关闭预览" @click="$emit('close-preview')">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p>{{ ideaPreview.text }}</p>
            <div class="idea-preview-popover__actions">
              <button type="button" :disabled="previewApplying" @click="$emit('close-preview')">关闭</button>
              <button class="primary" type="button" :disabled="previewApplying" @click="$emit('apply-preview')">
                <i v-if="previewApplying" class="fa-solid fa-spinner fa-spin"></i>
                采用
              </button>
            </div>
          </div>
        </section>
      </aside>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkflowDraft } from '../types'
import type { WorkflowResources } from '@/types/workflow'
import WorkflowCreativeDirectionBar from './WorkflowCreativeDirectionBar.vue'

interface WorkflowIdeaPreview {
  text: string
  action: string
}

const props = withDefaults(defineProps<{
  draft: WorkflowDraft
  resources?: WorkflowResources | null
  generating?: boolean
  ideaPreview?: WorkflowIdeaPreview | null
  previewApplying?: boolean
}>(), {
  resources: null,
  generating: false,
  ideaPreview: null,
  previewApplying: false,
})
const emit = defineEmits<{
  (event: 'patch', payload: Partial<WorkflowDraft>): void
  (event: 'generate-inspiration', payload: { action: string; directions: string[]; ideaText: string }): void
  (event: 'apply-preview'): void
  (event: 'close-preview'): void
}>()

const originalAssistItems = computed(() => props.resources?.inspirationAssistActions || [])

const selectedPlatformCode = computed(() =>
  props.resources?.platforms.find(item => item.name === props.draft.baseConfig.platform)?.code || ''
)

const directionReady = computed(() => Boolean(
  props.draft.baseConfig.platform.trim() &&
  props.draft.baseConfig.audience.trim() &&
  props.draft.baseConfig.genre.trim()
))
const selectedDirections = computed(() => Array.from(new Set([
  props.draft.baseConfig.genre,
  ...props.draft.baseConfig.tags,
].filter(Boolean))))
// 记录正在请求的灵感动作，用于只在被点击的按钮上展示加载态。
const activeAction = ref('')
watch(() => props.generating, (value) => {
  if (!value) activeAction.value = ''
})

// 灵感方向直接来自已确认的基础配置，不再维护第二套临时标签状态。
const requestIdea = (action: string) => {
  if (!directionReady.value || props.generating) return
  activeAction.value = action
  emit('generate-inspiration', {
    action,
    directions: [...selectedDirections.value],
    ideaText: props.draft.ideaText,
  })
}

</script>
