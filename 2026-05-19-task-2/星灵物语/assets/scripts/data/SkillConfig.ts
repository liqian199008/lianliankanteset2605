/**
 * 技能配置 — 技能效果、伤害计算、特效配置
 * Skill Configuration
 */
import { SkillTarget, SkillEffect } from './CharacterConfig';

/** 技能释放上下文 */
export interface SkillContext {
    casterId: string;
    casterAttack: number;
    casterLevel: number;
    skillLevel: number;       // 技能等级 (1-5)
    targetAllyHP: number[];   // 己方全体当前HP
    targetAllyMaxHP: number[];
    targetEnemyHP: number[];
    targetEnemyMaxHP: number[];
    currentSteps: number;
    enemyCount: number;
}

/** 技能计算结果 */
export interface SkillResult {
    damageDealt: number[];      // 对每个敌人的伤害
    healingDone: number[];      // 对每个友方的治疗
    shieldApplied: number[];    // 护盾值
    buffsApplied: { target: number; effect: SkillEffect; value: number }[];
    stepsAdded: number;         // 增加的步数
    effects: SkillVisualEffect[];
}

/** 视觉特效描述 */
export interface SkillVisualEffect {
    type: 'screen_shake' | 'flash' | 'particle' | 'animation' | 'slow_motion';
    duration: number;
    intensity?: number;
    color?: string;
    animationName?: string;
}

/**
 * 计算技能伤害
 * Formula: Damage = CasterAttack × DamageMultiplier × (1 + SkillLevel × 0.05)
 *          - TargetDefense × 0.5
 */
export function calculateSkillDamage(
    casterAttack: number,
    damageMultiplier: number,
    skillLevel: number,
    targetDefense: number
): number {
    const baseDamage = casterAttack * damageMultiplier;
    const levelBonus = 1 + skillLevel * 0.05;
    const defenseReduction = targetDefense * 0.5;
    const rawDamage = baseDamage * levelBonus - defenseReduction;
    return Math.max(1, Math.floor(rawDamage)); // 至少1点伤害
}

/**
 * 计算治疗量
 * Formula: Heal = BaseHeal + CasterAttack × 0.5 × (1 + SkillLevel × 0.05)
 */
export function calculateHealing(
    casterAttack: number,
    baseHeal: number,
    skillLevel: number
): number {
    const healBonus = casterAttack * 0.5;
    const levelBonus = 1 + skillLevel * 0.05;
    return Math.floor((baseHeal + healBonus) * levelBonus);
}

/**
 * 根据技能配置执行计算
 */
export function executeSkill(
    context: SkillContext,
    damageMultiplier: number,
    targetType: SkillTarget,
    effectType: SkillEffect,
    extraValue: number | undefined,
    skillLevel: number
): SkillResult {
    const result: SkillResult = {
        damageDealt: [],
        healingDone: [],
        shieldApplied: [],
        buffsApplied: [],
        stepsAdded: 0,
        effects: [],
    };

    const eff = extraValue || 0;

    switch (effectType) {
        case SkillEffect.DAMAGE:
            // 单体伤害
            if (context.enemyCount > 0) {
                const dmg = calculateSkillDamage(
                    context.casterAttack, damageMultiplier, skillLevel, 0
                );
                result.damageDealt = [dmg];
                result.effects.push({
                    type: 'particle',
                    duration: 0.8,
                    intensity: 1,
                    color: '#FF6644',
                });
            }
            break;

        case SkillEffect.AOE_DAMAGE:
            // 群体伤害
            for (let i = 0; i < context.enemyCount; i++) {
                const dmg = calculateSkillDamage(
                    context.casterAttack, damageMultiplier, skillLevel, 0
                );
                result.damageDealt.push(dmg);
            }
            result.effects.push({
                type: 'screen_shake',
                duration: 0.5,
                intensity: 3,
                animationName: 'screen_shake_heavy',
            });
            result.effects.push({
                type: 'particle',
                duration: 1.2,
                intensity: 3,
                color: '#FFD700',
            });
            break;

        case SkillEffect.HEAL:
            if (targetType === SkillTarget.LOWEST_ALLY) {
                // 治疗血量最低的队友
                const heal = calculateHealing(context.casterAttack, eff, skillLevel);
                result.healingDone = [heal];
            } else if (targetType === SkillTarget.ALL_ALLIES) {
                // 全体治疗
                const allyCount = context.targetAllyHP.length;
                for (let i = 0; i < allyCount; i++) {
                    const heal = calculateHealing(context.casterAttack, eff / allyCount, skillLevel);
                    result.healingDone.push(heal);
                }
            }
            result.effects.push({
                type: 'particle',
                duration: 1.0,
                intensity: 2,
                color: '#44FF88',
            });
            break;

        case SkillEffect.SHIELD:
            const shieldValue = eff * (1 + skillLevel * 0.05);
            const allyCount = context.targetAllyHP.length;
            for (let i = 0; i < allyCount; i++) {
                result.shieldApplied.push(Math.floor(shieldValue));
            }
            result.effects.push({
                type: 'particle',
                duration: 1.0,
                intensity: 2,
                color: '#88CCFF',
            });
            break;

        case SkillEffect.BUFF_ATTACK:
            const atkBuff = eff * (1 + skillLevel * 0.1);
            const buffTargets = targetType === SkillTarget.ALL_ALLIES
                ? context.targetAllyHP.length : 1;
            for (let i = 0; i < buffTargets; i++) {
                result.buffsApplied.push({
                    target: i,
                    effect: SkillEffect.BUFF_ATTACK,
                    value: Math.floor(atkBuff),
                });
            }
            result.effects.push({
                type: 'particle',
                duration: 0.8,
                intensity: 1,
                color: '#FFAA00',
            });
            break;

        case SkillEffect.ADD_STEPS:
            result.stepsAdded = Math.floor(eff * (1 + skillLevel * 0.1));
            result.effects.push({
                type: 'animation',
                duration: 1.0,
                animationName: 'steps_add',
            });
            break;
    }

    return result;
}
