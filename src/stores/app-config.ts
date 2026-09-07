import { ref } from "vue";
import { defineStore } from "pinia";

// 开源版：配置不再从服务端拉取，这里就是唯一配置源。
// 功能开关机制保留（侧栏/首页/搜索面板仍在消费），本地全部开启。

/** 客户端已接线的功能开关 key */
export type FeatureKey =
  | "ai"
  | "aiImage"
  | "workflowBook"
  | "breakdown"
  | "inspiration"
  | "writeStatistics"
  | "byokModels"
  | "personaAgent";

export interface UploadSceneLimit {
  maxSizeMB?: number;
  maxSizeMb?: number;
  extensions?: string[];
  allowedExtensions?: string[];
}

export interface PublicAppConfig {
  upload: {
    enabled: boolean;
    limits: Record<string, UploadSceneLimit>;
  };
  features: Record<string, { enabled: boolean; disabledText: string }>;
}

export const defaultPublicAppConfig: PublicAppConfig = {
  upload: {
    enabled: true,
    limits: {}
  },
  features: {}
};

export const useAppConfigStore = defineStore("app-config", () => {
  const config = ref<PublicAppConfig>({ ...defaultPublicAppConfig });

  // 功能开关：未知 key 或配置缺失一律视为开启（关停必须显式）
  const isFeatureEnabled = (key: FeatureKey) => config.value.features?.[key]?.enabled !== false;
  const featureDisabledText = (key: FeatureKey) =>
    String(config.value.features?.[key]?.disabledText || "功能维护中，请稍后再试");

  return {
    config,
    isFeatureEnabled,
    featureDisabledText
  };
});
