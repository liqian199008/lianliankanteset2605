/**
 * 技能控制器 — 处理技能释放、效果计算、视觉表现
 * Skill Controller — Handles skill cast, effect calculation, visual feedback
 */

import { _decorator, Component, Node, tween, Vec3, Color, Sprite } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { AudioManager } from '../core/AudioManager';
import { INITIAL_CHARACTERS, SkillDefine, SkillEffect, SkillTarget } from '../data/CharacterConfig';
import { calculateSkillDamage, calculateHealing, executeSkill, SkillContext } from '../data/SkillConfig';
import { BattleController, BattleCharacter, BattleEnemy } from './BattleController';
import { GemColor } from '../data/GemConfig';

const { ccclass, property } = _decorator;

@ccclass('SkillController')
export class SkillController extends Component {
    @property({ type: Node, tooltip: '技能特效挂载点' })
    effectRoot: Node | null = null;

    private battleController: BattleController | null = null;

    onLoad() {
        this.battleController = this.getComponent(BattleController);

        EventManager.getInstance().on(GameEvent.SKILL_CAST, this.onSkillCastRequest, this);
    }

    /** 处理技能释放请求 */
    private onSkillCastRequest(data: { characterId: string; skillType: 'normal' | 'ultimate' }): void {
        const character = this.battleController?.getTeam().find(c => c.id === data.characterId);
        if (!character) return;

        // 查找角色配置
        const template = INITIAL_CHARACTERS.find(c => c.id === character.templateId);
        if (!template) return;

        const skill: SkillDefine = data.skillType === 'normal' 
            ? template.skillNormal 
            : template.skillUltimate;

        if (!skill) return;

        // 执行技能
        this.executeSkill(character, skill, data.skillType);
    }

    /** 执行技能效果 */
    private executeSkill(character: BattleCharacter, skill: SkillDefine, skillType: 'normal' | 'ultimate'): void {
        const enemies = this.battleController?.getEnemies() || [];
        const team = this.battleController?.getTeam() || [];

        // 构建技能上下文
        const context: SkillContext = {
            casterId: character.id,
            casterAttack: character.attack,
            casterLevel: character.level,
            skillLevel: 1, // [PLACEHOLDER] 技能等级系统
            targetAllyHP: team.map(c => c.hp),
            targetAllyMaxHP: team.map(c => c.maxHP),
            targetEnemyHP: enemies.map(e => e.hp),
            targetEnemyMaxHP: enemies.map(e => e.maxHP),
            currentSteps: this.battleController?.getRemainingSteps() || 0,
            enemyCount: enemies.filter(e => e.hp > 0).length,
        };

        const result = executeSkill(context, skill.damageMultiplier, skill.targetType, skill.effectType, skill.extraValue, 1);

        // 应用技能结果
        this.applySkillResult(character, result, skill, skillType, enemies, team);

        // 播放视觉特效
        this.playSkillEffects(skill, skillType, character);
    }

    /** 应用技能结果到战斗状态 */
    private applySkillResult(
        character: BattleCharacter,
        result: ReturnType<typeof executeSkill>,
        skill: SkillDefine,
        skillType: 'normal' | 'ultimate',
        enemies: BattleEnemy[],
        team: BattleCharacter[]
    ): void {
        const bc = this.battleController;
        if (!bc) return;

        // 处理伤害
        if (result.damageDealt.length > 0) {
            for (let i = 0; i < result.damageDealt.length && i < enemies.length; i++) {
                bc.applySkillDamageToEnemy(i, result.damageDealt[i]);
            }
        }

        // 处理治疗
        if (result.healingDone.length > 0) {
            for (let i = 0; i < result.healingDone.length && i < team.length; i++) {
                bc.healCharacter(i, result.healingDone[i]);
            }
        }

        // 处理护盾
        if (result.shieldApplied.length > 0 && skill.effectType === SkillEffect.SHIELD) {
            const shieldAmount = result.shieldApplied[0];
            bc.addShieldToAll(shieldAmount);
        }

        // 处理增加步数
        if (result.stepsAdded > 0) {
            bc.addSteps(result.stepsAdded);
        }

        // 处理增益
        for (const buff of result.buffsApplied) {
            // 攻击增益
            if (buff.effect === SkillEffect.BUFF_ATTACK) {
                const targetChar = team[buff.target];
                if (targetChar) {
                    targetChar.attackBuff += buff.value;
                    targetChar.attack = Math.floor(
                        targetChar.attack * (1 + buff.value / 100)
                    );
                }
            }
        }

        // 通知技能释放完成
        EventManager.getInstance().emit(GameEvent.SKILL_CAST_DONE, {
            characterId: character.id,
            skillType,
            skillName: skill.name,
            result,
        });
    }

    /** 播放技能视觉特效 */
    private playSkillEffects(skill: SkillDefine, skillType: 'normal' | 'ultimate', character: BattleCharacter): void {
        // ========== 音频播放（语音 + 技能音效）==========
        const audioMgr = AudioManager.getInstance();
        if (audioMgr) {
            // 大招先播放语音，再播放音效；小技能同时播放
            if (skill.voiceLine) {
                if (skillType === 'ultimate') {
                    // 大招：语音先出，音效延迟0.3秒
                    audioMgr.playVoice(skill.voiceLine, true);
                    if (skill.sfxPath) {
                        setTimeout(() => {
                            audioMgr.playSFX(skill.sfxPath);
                        }, 300);
                    }
                } else {
                    // 小技能：语音和音效同时播放
                    audioMgr.playVoice(skill.voiceLine, true);
                    if (skill.sfxPath) {
                        audioMgr.playSFX(skill.sfxPath);
                    }
                }
            } else if (skill.sfxPath) {
                // 没有语音配置时，至少播放音效
                audioMgr.playSFX(skill.sfxPath);
            }
        }

        // ========== 视觉特效 ==========
        if (!this.effectRoot) return;

        // 简单视觉反馈：缩放脉冲
        const scale = skillType === 'ultimate' ? 1.5 : 1.2;
        const duration = skillType === 'ultimate' ? 0.6 : 0.3;

        tween(this.effectRoot)
            .to(duration / 2, { scale: new Vec3(scale, scale, 1) })
            .to(duration / 2, { scale: new Vec3(1, 1, 1) })
            .start();

        // 大招全屏闪光
        if (skillType === 'ultimate') {
            const flashNode = new Node('SkillFlash');
            flashNode.setParent(this.effectRoot);
            const sprite = flashNode.addComponent(Sprite);
            sprite.color = new Color(255, 255, 255, 200);

            tween(flashNode)
                .to(0.1, { scale: new Vec3(5, 5, 1) })
                .to(0.3, { opacity: 0 })
                .call(() => flashNode.destroy())
                .start();
        }

        // 屏幕震动（通过事件让Camera处理）
        if (skillType === 'ultimate') {
            EventManager.getInstance().emit('camera_shake', {
                intensity: 5,
                duration: 0.3,
            });
        }
    }

    /**
     * 检查角色是否可释放大招
     */
    canCastUltimate(characterId: string): boolean {
        const char = this.battleController?.getTeam().find(c => c.id === characterId);
        return char ? char.skillUltimateReady : false;
    }

    /**
     * 检查角色是否可释放小技能
     */
    canCastNormal(characterId: string): boolean {
        const char = this.battleController?.getTeam().find(c => c.id === characterId);
        return char ? char.skillNormalReady : false;
    }

    onDestroy() {
        EventManager.getInstance().off(GameEvent.SKILL_CAST, this.onSkillCastRequest, this);
    }
}
