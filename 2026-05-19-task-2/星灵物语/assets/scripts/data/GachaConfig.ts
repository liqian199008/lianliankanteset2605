/**
 * 抽卡配置 — 卡池概率、保底机制、消耗
 * Gacha Configuration
 */
import { Rarity } from './CharacterConfig';

/** 卡池类型 */
export enum GachaPoolType {
    NOVICE = 'novice',       // 新手卡池
    STANDARD = 'standard',   // 标准卡池
    LIMITED = 'limited',     // 限定卡池
}

/** 卡池配置接口 */
export interface GachaPoolConfig {
    id: GachaPoolType;
    name: string;
    description: string;
    costSingle: number;        // 单抽价格（星钻）
    costMulti: number;         // 十连价格（星钻）
    maxPulls: number;          // 最大抽取次数（0=无限）
    pityGuarantee: number;     // 保底次数
    rateUpCharacterId?: string; // 概率UP角色ID（限定池用）

    // 概率（总和=100%）
    rateSSR: number;   // SSR概率（万分比，如160=1.6%）
    rateSR: number;    // SR概率
    rateR: number;     // R概率

    // 保底规则
    softPityStart: number;    // 软保底开始次数
    softPityIncrease: number; // 软保底每抽增加概率（万分比）
}

/** 查看配置 */
export const GACHA_POOLS: Record<GachaPoolType, GachaPoolConfig> = {
    [GachaPoolType.NOVICE]: {
        id: GachaPoolType.NOVICE,
        name: '新手召唤',
        description: '新手专属福利卡池，首次十连必得SR！限30次',
        costSingle: 160,
        costMulti: 1440,
        maxPulls: 30,
        pityGuarantee: 10,
        rateSSR: 200,   // 2%
        rateSR: 1800,   // 18%
        rateR: 8000,    // 80%
        softPityStart: 8,
        softPityIncrease: 500,
    },
    [GachaPoolType.STANDARD]: {
        id: GachaPoolType.STANDARD,
        name: '标准召唤',
        description: '常驻卡池，包含所有标准角色',
        costSingle: 160,
        costMulti: 1440,
        maxPulls: 0,
        pityGuarantee: 90,
        rateSSR: 160,   // 1.6%
        rateSR: 1500,   // 15%
        rateR: 8340,    // 83.4%
        softPityStart: 75,
        softPityIncrease: 300,
    },
    [GachaPoolType.LIMITED]: {
        id: GachaPoolType.LIMITED,
        name: '限定召唤',
        description: '限时卡池，指定SSR概率大幅提升！',
        costSingle: 160,
        costMulti: 1440,
        maxPulls: 0,
        pityGuarantee: 90,
        rateSSR: 160,   // 1.6%（其中UP角色占SSR的50%）
        rateSR: 1500,   // 15%
        rateR: 8340,    // 83.4%
        softPityStart: 75,
        softPityIncrease: 300,
    },
};

/** 抽卡结果 */
export interface GachaResult {
    characterId: string;
    rarity: Rarity;
    isNew: boolean;      // 是否首次获得
    isRateUp: boolean;   // 是否UP角色
    isPity: boolean;     // 是否保底触发
}

/** 抽卡历史记录 */
export interface GachaHistory {
    poolId: GachaPoolType;
    results: GachaResult[];
    pityCount: number;      // 当前保底计数
    totalPulls: number;     // 总抽取次数
    lastUpdateTime: number; // 时间戳
}

/** 十连动画配置 */
export const GACHA_ANIMATION_CONFIG = {
    REVEAL_DELAY: 0.3,     // 每张卡揭示间隔（秒）
    CARD_FLIP_DURATION: 0.5, // 卡片翻转动画时长
    SSR_DELAY_BONUS: 0.5,    // SSR额外延迟（制造悬念）
    PARTICLE_BURST_COUNT: {
        [Rarity.R]: 10,
        [Rarity.SR]: 30,
        [Rarity.SSR]: 80,
    },
};

/** 免费抽卡获取途径 */
export const FREE_GACHA_SOURCES = {
    DAILY_FREE: 0,           // 每日免费（暂不支持）
    QUEST_REWARD: 1,         // 任务奖励（1抽/天）
    SHARE_REWARD: 0.5,       // 分享奖励（1抽/2次分享）
    EVENT_REWARD: 3,         // 活动奖励（一次性）
};
