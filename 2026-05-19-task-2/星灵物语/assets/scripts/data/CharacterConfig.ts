/**
 * 角色配置 — 5名初始角色的完整定义
 * Character Configuration
 */
import { GemColor } from './GemConfig';

/** 稀有度枚举 */
export enum Rarity {
    N = 0,
    R = 1,
    SR = 2,
    SSR = 3,
}

export const RARITY_NAMES: Record<number, string> = {
    [Rarity.N]: 'N',
    [Rarity.R]: 'R',
    [Rarity.SR]: 'SR',
    [Rarity.SSR]: 'SSR',
};

export const RARITY_COLORS: Record<number, string> = {
    [Rarity.N]: '#AAAAAA',
    [Rarity.R]: '#4488FF',
    [Rarity.SR]: '#AA66FF',
    [Rarity.SSR]: '#FFD700',
};

export const RARITY_STAT_MULTIPLIERS: Record<number, number> = {
    [Rarity.N]: 1.0,
    [Rarity.R]: 1.5,
    [Rarity.SR]: 2.2,
    [Rarity.SSR]: 3.5,
};

/** 角色模板接口 */
export interface CharacterTemplate {
    id: string;
    name: string;
    title: string;       // 称号
    rarity: Rarity;
    attribute: GemColor; // 对应宝石颜色
    description: string; // 角色简介

    // 基础属性 (Lv.1, 无突破)
    baseAttack: number;
    baseHP: number;
    baseDefense: number;

    // 技能
    skillNormal: SkillDefine;
    skillUltimate: SkillDefine;
}

/** 技能定义 */
export interface SkillDefine {
    id: string;
    name: string;
    description: string;
    energyCost: number;          // 能量消耗
    damageMultiplier: number;    // 攻击倍率 (1.0 = 100%)
    targetType: SkillTarget;
    effectType: SkillEffect;
    cooldown: number;            // 回合冷却
    extraValue?: number;         // 额外数值（治疗量/护盾量等）
    voiceLine?: string;          // 技能释放时的语音资源路径（相对于 resources/）
    sfxPath?: string;            // 技能音效资源路径（相对于 resources/）
}

export enum SkillTarget {
    SINGLE_ENEMY = 0,   // 单体敌人
    ALL_ENEMIES = 1,    // 全体敌人
    SELF = 2,           // 自己
    ALL_ALLIES = 3,     // 全体友方
    LOWEST_ALLY = 4,    // 血量最低友方
}

export enum SkillEffect {
    DAMAGE = 0,         // 伤害
    HEAL = 1,           // 治疗
    SHIELD = 2,         // 护盾
    BUFF_ATTACK = 3,    // 加攻击
    BUFF_DEFENSE = 4,   // 加防御
    ADD_STEPS = 5,      // 加步数
    AOE_DAMAGE = 6,     // 群体伤害
    CLEANSE = 7,        // 净化
}

// ========== 5名初始角色 ==========

export const INITIAL_CHARACTERS: CharacterTemplate[] = [
    // ===== 炎·星火凛 (Fire - Main DPS) =====
    {
        id: 'char_fire_001',
        name: '星火·凛',
        title: '焚天少女',
        rarity: Rarity.R,
        attribute: GemColor.FIRE,
        description: '来自火山族的热情少女，拥有操控烈焰的能力。虽然性格火爆，但内心温柔。',
        baseAttack: 120,
        baseHP: 800,
        baseDefense: 50,
        skillNormal: {
            id: 'fire_skill_1',
            name: '烈焰斩',
            description: '挥动火焰之刃，对单体敌人造成伤害',
            energyCost: 30,
            damageMultiplier: 1.8,
            targetType: SkillTarget.SINGLE_ENEMY,
            effectType: SkillEffect.DAMAGE,
            cooldown: 0,
            voiceLine: 'audio/voice/fire_skill_1',
            sfxPath: 'audio/sfx/fire_slash',
        },
        skillUltimate: {
            id: 'fire_ulti_1',
            name: '焚天·红莲业火',
            description: '召唤红莲之火吞噬所有敌人',
            energyCost: 100,
            damageMultiplier: 4.5,
            targetType: SkillTarget.ALL_ENEMIES,
            effectType: SkillEffect.AOE_DAMAGE,
            cooldown: 0,
            voiceLine: 'audio/voice/fire_ulti_1',
            sfxPath: 'audio/sfx/fire_ultimate',
        },
    },
    // ===== 水·清波瑶 (Water - Healer) =====
    {
        id: 'char_water_001',
        name: '清波·瑶',
        title: '碧波仙子',
        rarity: Rarity.R,
        attribute: GemColor.WATER,
        description: '生活在深海的温柔少女，擅长治愈之术。她哼唱的歌声能抚平一切伤痛。',
        baseAttack: 60,
        baseHP: 1000,
        baseDefense: 60,
        skillNormal: {
            id: 'water_skill_1',
            name: '碧波之愈',
            description: '呼唤水元素，治疗血量最低的队友',
            energyCost: 30,
            damageMultiplier: 0,
            targetType: SkillTarget.LOWEST_ALLY,
            effectType: SkillEffect.HEAL,
            cooldown: 1,
            extraValue: 200, // 基础治疗量
            voiceLine: 'audio/voice/water_skill_1',
            sfxPath: 'audio/sfx/water_heal',
        },
        skillUltimate: {
            id: 'water_ulti_1',
            name: '沧海·生命之泉',
            description: '召唤生命泉水，全体队友恢复大量生命',
            energyCost: 100,
            damageMultiplier: 0,
            targetType: SkillTarget.ALL_ALLIES,
            effectType: SkillEffect.HEAL,
            cooldown: 0,
            extraValue: 500, // 全体治疗量
            voiceLine: 'audio/voice/water_ulti_1',
            sfxPath: 'audio/sfx/water_ultimate',
        },
    },
    // ===== 风·疾风翎 (Wind - Speed/Buffer) =====
    {
        id: 'char_wind_001',
        name: '疾风·翎',
        title: '逐风行者',
        rarity: Rarity.R,
        attribute: GemColor.WIND,
        description: '翱翔于天际的风之使者，行动迅捷如风。喜欢自由自在的生活。',
        baseAttack: 90,
        baseHP: 700,
        baseDefense: 40,
        skillNormal: {
            id: 'wind_skill_1',
            name: '疾风加持',
            description: '呼唤疾风之力，增加全体攻击力',
            energyCost: 30,
            damageMultiplier: 0,
            targetType: SkillTarget.ALL_ALLIES,
            effectType: SkillEffect.BUFF_ATTACK,
            cooldown: 2,
            extraValue: 20, // +20%攻击
            voiceLine: 'audio/voice/wind_skill_1',
            sfxPath: 'audio/sfx/wind_buff',
        },
        skillUltimate: {
            id: 'wind_ulti_1',
            name: '神岚·天翔之翼',
            description: '展开风之翼，在风中起舞额外获得5步',
            energyCost: 100,
            damageMultiplier: 0,
            targetType: SkillTarget.SELF,
            effectType: SkillEffect.ADD_STEPS,
            cooldown: 0,
            extraValue: 5, // +5步
            voiceLine: 'audio/voice/wind_ulti_1',
            sfxPath: 'audio/sfx/wind_ultimate',
        },
    },
    // ===== 地·岩盾磐 (Earth - Tank) =====
    {
        id: 'char_earth_001',
        name: '岩盾·磐',
        title: '不动明王',
        rarity: Rarity.R,
        attribute: GemColor.EARTH,
        description: '来自远古山岭的守护者，沉默寡言但无比可靠。她的盾能抵挡一切攻击。',
        baseAttack: 70,
        baseHP: 1500,
        baseDefense: 120,
        skillNormal: {
            id: 'earth_skill_1',
            name: '坚岩之盾',
            description: '凝聚岩石之力，为全体队友施加护盾',
            energyCost: 30,
            damageMultiplier: 0,
            targetType: SkillTarget.ALL_ALLIES,
            effectType: SkillEffect.SHIELD,
            cooldown: 2,
            extraValue: 300, // 护盾值
            voiceLine: 'audio/voice/earth_skill_1',
            sfxPath: 'audio/sfx/earth_shield',
        },
        skillUltimate: {
            id: 'earth_ulti_1',
            name: '地脉·不破壁垒',
            description: '召唤大地之力形成绝对防御，全体获得巨额护盾并提升防御',
            energyCost: 100,
            damageMultiplier: 0,
            targetType: SkillTarget.ALL_ALLIES,
            effectType: SkillEffect.SHIELD,
            cooldown: 0,
            extraValue: 800, // 护盾值
            voiceLine: 'audio/voice/earth_ulti_1',
            sfxPath: 'audio/sfx/earth_ultimate',
        },
    },
    // ===== 光·辉光薇 (Light - AOE Burst) =====
    {
        id: 'char_light_001',
        name: '辉光·薇',
        title: '星辰圣女',
        rarity: Rarity.SR,
        attribute: GemColor.LIGHT,
        description: '掌控星辰之力的神秘少女，来自遥远的星界。她的光芒能驱散一切黑暗。',
        baseAttack: 150,
        baseHP: 600,
        baseDefense: 35,
        skillNormal: {
            id: 'light_skill_1',
            name: '星光射线',
            description: '发射一道星光，贯穿单体敌人',
            energyCost: 30,
            damageMultiplier: 2.0,
            targetType: SkillTarget.SINGLE_ENEMY,
            effectType: SkillEffect.DAMAGE,
            cooldown: 0,
            voiceLine: 'audio/voice/light_skill_1',
            sfxPath: 'audio/sfx/light_beam',
        },
        skillUltimate: {
            id: 'light_ulti_1',
            name: '极光·星爆',
            description: '引爆星辰之力，对全体敌人造成毁灭性打击',
            energyCost: 100,
            damageMultiplier: 5.0,
            targetType: SkillTarget.ALL_ENEMIES,
            effectType: SkillEffect.AOE_DAMAGE,
            cooldown: 0,
            voiceLine: 'audio/voice/light_ulti_1',
            sfxPath: 'audio/sfx/light_ultimate',
        },
    },
];

/** 角色升级所需经验表 (Lv.1 → Lv.10) */
export const LEVEL_EXP_TABLE: number[] = [
    0,      // Lv.1 (起点)
    100,    // 1→2
    200,    // 2→3
    300,    // 3→4
    400,    // 4→5
    500,    // 5→6
    600,    // 6→7
    700,    // 7→8
    800,    // 8→9
    900,    // 9→10
];

/** 每级属性成长倍率 */
export const LEVEL_STAT_GROWTH = {
    attack: 0.08,  // 每级+8%
    hp: 0.06,      // 每级+6%
    defense: 0.05, // 每级+5%
};

/** 突破消耗 */
export const BREAKTHROUGH_COST = {
    shardCount: 5,      // 需要同角色碎片×5
    gold: 5000,         // 需要金币
    maxBreakthrough: 3, // 最多突破3次
};
