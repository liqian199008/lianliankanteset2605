/**
 * 关卡配置 — 章节/关卡数据和敌人配置
 * Level Configuration
 */
import { GemColor, GemDistribution } from './GemConfig';

/** 关卡状态 */
export enum LevelState {
    LOCKED = 0,
    UNLOCKED = 1,
    CLEARED = 2,
}

/** 关卡星级 */
export interface LevelStars {
    star1: boolean; // 通关
    star2: boolean; // 剩余步数≥5
    star3: boolean; // 剩余步数≥10
}

/** 敌人模板 */
export interface EnemyTemplate {
    id: string;
    name: string;
    hp: number;
    attack: number;
    defense: number;
    spritePath: string; // 资源路径
    description: string;
}

/** 关卡定义 */
export interface LevelDefinition {
    id: string;             // e.g. "1-1"
    chapter: number;
    level: number;
    name: string;
    description: string;

    // 战斗参数
    steps: number;          // 可用步数
    enemies: EnemyTemplate[];
    gemDistribution: GemDistribution[]; // 宝石分布权重

    // 奖励
    firstClearReward: { gold: number; diamond: number };
    normalReward: { gold: number; exp: number };

    // Boss关卡标记
    isBoss: boolean;
}

// ========== 敌人预设 ==========

const ENEMIES = {
    SLIME_FIRE: {
        id: 'enemy_fire_slime',
        name: '火焰史莱姆',
        hp: 100,
        attack: 15,
        defense: 5,
        spritePath: 'textures/enemies/fire_slime',
        description: '充满火元素能量的小怪物',
    },
    SLIME_WATER: {
        id: 'enemy_water_slime',
        name: '水波史莱姆',
        hp: 120,
        attack: 10,
        defense: 8,
        spritePath: 'textures/enemies/water_slime',
        description: '由水元素凝聚而成的柔软生物',
    },
    SLIME_EARTH: {
        id: 'enemy_earth_slime',
        name: '岩石史莱姆',
        hp: 200,
        attack: 8,
        defense: 20,
        spritePath: 'textures/enemies/earth_slime',
        description: '覆盖着坚硬岩层的史莱姆',
    },
    GOBLIN_FIRE: {
        id: 'enemy_fire_goblin',
        name: '火焰哥布林',
        hp: 200,
        attack: 25,
        defense: 10,
        spritePath: 'textures/enemies/fire_goblin',
        description: '手持火炬的狡猾哥布林',
    },
    WISP_DARK: {
        id: 'enemy_dark_wisp',
        name: '暗影之灵',
        hp: 500,
        attack: 40,
        defense: 15,
        spritePath: 'textures/enemies/dark_wisp',
        description: '徘徊在阴暗处的神秘灵体',
    },
    BOSS_FIRE: {
        id: 'enemy_boss_fire',
        name: '炎魔领主',
        hp: 1000,
        attack: 60,
        defense: 25,
        spritePath: 'textures/enemies/boss_fire',
        description: '第一章首领·掌控烈焰的恶魔领主',
    },
    BOSS_WATER: {
        id: 'enemy_boss_water',
        name: '深渊之潮',
        hp: 1500,
        attack: 55,
        defense: 30,
        spritePath: 'textures/enemies/boss_water',
        description: '第二章首领·来自深渊的海之巨兽',
    },
};

// ========== 章节关卡配置 ==========

export const CHAPTER_1: LevelDefinition[] = [
    {
        id: '1-1', chapter: 1, level: 1,
        name: '初入星界',
        description: '初次踏入星灵世界，熟悉消除的规则',
        steps: 25,
        enemies: [{ ...ENEMIES.SLIME_FIRE, hp: 80 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 30 },
            { color: GemColor.WATER, weight: 18 },
            { color: GemColor.WIND, weight: 18 },
            { color: GemColor.EARTH, weight: 17 },
            { color: GemColor.LIGHT, weight: 17 },
        ],
        firstClearReward: { gold: 100, diamond: 50 },
        normalReward: { gold: 30, exp: 20 },
        isBoss: false,
    },
    {
        id: '1-2', chapter: 1, level: 2,
        name: '星火初燃',
        description: '火焰的力量在你指尖跃动',
        steps: 24,
        enemies: [{ ...ENEMIES.SLIME_FIRE, hp: 110 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 25 },
            { color: GemColor.WATER, weight: 19 },
            { color: GemColor.WIND, weight: 19 },
            { color: GemColor.EARTH, weight: 19 },
            { color: GemColor.LIGHT, weight: 18 },
        ],
        firstClearReward: { gold: 100, diamond: 50 },
        normalReward: { gold: 30, exp: 20 },
        isBoss: false,
    },
    {
        id: '1-3', chapter: 1, level: 3,
        name: '水波荡漾',
        description: '水之精灵加入了你的队伍',
        steps: 24,
        enemies: [{ ...ENEMIES.SLIME_WATER, hp: 130 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 20 },
            { color: GemColor.WATER, weight: 25 },
            { color: GemColor.WIND, weight: 19 },
            { color: GemColor.EARTH, weight: 18 },
            { color: GemColor.LIGHT, weight: 18 },
        ],
        firstClearReward: { gold: 100, diamond: 50 },
        normalReward: { gold: 35, exp: 25 },
        isBoss: false,
    },
    {
        id: '1-4', chapter: 1, level: 4,
        name: '疾风过境',
        description: '风的力量将助你一臂之力',
        steps: 23,
        enemies: [{ ...ENEMIES.SLIME_WATER, hp: 150 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 18 },
            { color: GemColor.WATER, weight: 20 },
            { color: GemColor.WIND, weight: 25 },
            { color: GemColor.EARTH, weight: 19 },
            { color: GemColor.LIGHT, weight: 18 },
        ],
        firstClearReward: { gold: 150, diamond: 60 },
        normalReward: { gold: 35, exp: 25 },
        isBoss: false,
    },
    {
        id: '1-5', chapter: 1, level: 5,
        name: '坚岩守护',
        description: '岩石的力量会保护好你的队伍',
        steps: 22,
        enemies: [{ ...ENEMIES.SLIME_EARTH, hp: 200 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 18 },
            { color: GemColor.WATER, weight: 18 },
            { color: GemColor.WIND, weight: 19 },
            { color: GemColor.EARTH, weight: 25 },
            { color: GemColor.LIGHT, weight: 20 },
        ],
        firstClearReward: { gold: 150, diamond: 60 },
        normalReward: { gold: 40, exp: 30 },
        isBoss: false,
    },
    {
        id: '1-6', chapter: 1, level: 6,
        name: '哥布林袭击',
        description: '一群哥布林挡住了去路',
        steps: 22,
        enemies: [{ ...ENEMIES.GOBLIN_FIRE, hp: 180 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 22 },
            { color: GemColor.WATER, weight: 20 },
            { color: GemColor.WIND, weight: 20 },
            { color: GemColor.EARTH, weight: 18 },
            { color: GemColor.LIGHT, weight: 20 },
        ],
        firstClearReward: { gold: 150, diamond: 70 },
        normalReward: { gold: 40, exp: 30 },
        isBoss: false,
    },
    {
        id: '1-7', chapter: 1, level: 7,
        name: '暗影降临',
        description: '黑暗开始在星界蔓延',
        steps: 21,
        enemies: [{ ...ENEMIES.GOBLIN_FIRE, hp: 220 }, { ...ENEMIES.SLIME_FIRE, hp: 150 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 22 },
            { color: GemColor.WATER, weight: 18 },
            { color: GemColor.WIND, weight: 22 },
            { color: GemColor.EARTH, weight: 18 },
            { color: GemColor.LIGHT, weight: 20 },
        ],
        firstClearReward: { gold: 200, diamond: 70 },
        normalReward: { gold: 45, exp: 35 },
        isBoss: false,
    },
    {
        id: '1-8', chapter: 1, level: 8,
        name: '最后的试炼',
        description: '炎魔领主正在逼近',
        steps: 20,
        enemies: [{ ...ENEMIES.GOBLIN_FIRE, hp: 250 }, { ...ENEMIES.SLIME_EARTH, hp: 200 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 20 },
            { color: GemColor.WATER, weight: 20 },
            { color: GemColor.WIND, weight: 20 },
            { color: GemColor.EARTH, weight: 20 },
            { color: GemColor.LIGHT, weight: 20 },
        ],
        firstClearReward: { gold: 200, diamond: 80 },
        normalReward: { gold: 45, exp: 35 },
        isBoss: false,
    },
    {
        id: '1-9', chapter: 1, level: 9,
        name: '暗流涌动',
        description: '黑暗之力越来越强，做好准备！',
        steps: 20,
        enemies: [{ ...ENEMIES.WISP_DARK, hp: 350 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 24 },
            { color: GemColor.WATER, weight: 24 },
            { color: GemColor.WIND, weight: 18 },
            { color: GemColor.EARTH, weight: 16 },
            { color: GemColor.LIGHT, weight: 18 },
        ],
        firstClearReward: { gold: 250, diamond: 80 },
        normalReward: { gold: 50, exp: 40 },
        isBoss: false,
    },
    {
        id: '1-10', chapter: 1, level: 10,
        name: '炎魔领主',
        description: '直面第一章的最终Boss——炎魔领主！',
        steps: 18,
        enemies: [{ ...ENEMIES.BOSS_FIRE, hp: 1000 }],
        gemDistribution: [
            { color: GemColor.FIRE, weight: 15 },
            { color: GemColor.WATER, weight: 25 },
            { color: GemColor.WIND, weight: 20 },
            { color: GemColor.EARTH, weight: 15 },
            { color: GemColor.LIGHT, weight: 25 },
        ],
        firstClearReward: { gold: 500, diamond: 200 },
        normalReward: { gold: 100, exp: 80 },
        isBoss: true,
    },
];

/** 获取所有关卡配置（合并各章节） */
export function getAllLevels(): LevelDefinition[] {
    return [...CHAPTER_1];
}

/** 通过ID查找关卡 */
export function getLevelById(id: string): LevelDefinition | undefined {
    return getAllLevels().find(l => l.id === id);
}
