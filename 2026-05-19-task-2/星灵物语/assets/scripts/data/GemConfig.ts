/**
 * 宝石配置 — 5种颜色宝石的属性定义
 * Gem Color Config — 5 attribute gems
 */
export enum GemColor {
    FIRE = 0,      // 炎 🔥 红色
    WATER = 1,     // 水 💧 蓝色
    WIND = 2,      // 风 🌪 绿色
    EARTH = 3,     // 地 🪨 黄色
    LIGHT = 4,     // 光 ✨ 紫色
    SPECIAL = 5,   // 特殊宝石（炸弹、彩虹等）
}

/** 宝石颜色 → 显示名 */
export const GEM_COLOR_NAMES: Record<number, string> = {
    [GemColor.FIRE]: '炎',
    [GemColor.WATER]: '水',
    [GemColor.WIND]: '风',
    [GemColor.EARTH]: '地',
    [GemColor.LIGHT]: '光',
};

/** 宝石颜色 → Hex色值 */
export const GEM_COLOR_HEX: Record<number, string> = {
    [GemColor.FIRE]: '#FF4444',
    [GemColor.WATER]: '#4488FF',
    [GemColor.WIND]: '#44CC88',
    [GemColor.EARTH]: '#FFAA33',
    [GemColor.LIGHT]: '#AA66FF',
};

/** 宝石颜色 → 浅色（用于光晕/背景） */
export const GEM_COLOR_LIGHT: Record<number, string> = {
    [GemColor.FIRE]: '#FFDDDD',
    [GemColor.WATER]: '#DDEEFF',
    [GemColor.WIND]: '#DDFFEE',
    [GemColor.EARTH]: '#FFF4DD',
    [GemColor.LIGHT]: '#EEDDFF',
};

/** 每个宝石消除提供的能量值 */
export const ENERGY_PER_GEM = 2;

/** 长链奖励阈值（≥此数量触发额外奖励） */
export const LONG_CHAIN_THRESHOLD = 8;

/** 长链能量倍率 */
export const LONG_CHAIN_ENERGY_MULTIPLIER = 1.5;

/** 每步得分基础 */
export const SCORE_PER_GEM = 10;

/** 最小消除数量 */
export const MIN_MATCH_COUNT = 5;

/** 棋盘尺寸 */
export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;

/** 棋盘上每种颜色的宝石数量范围（百分比） */
export interface GemDistribution {
    color: GemColor;
    weight: number; // 权重，总和=100
}

/** 标准分布 — 每种颜色均等 */
export const DEFAULT_DISTRIBUTION: GemDistribution[] = [
    { color: GemColor.FIRE, weight: 20 },
    { color: GemColor.WATER, weight: 20 },
    { color: GemColor.WIND, weight: 20 },
    { color: GemColor.EARTH, weight: 20 },
    { color: GemColor.LIGHT, weight: 20 },
];
