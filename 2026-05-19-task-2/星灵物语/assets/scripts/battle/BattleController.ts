/**
 * 战斗控制器 — 管理战斗流程（回合、伤害结算、胜负判定）
 * Battle Controller — Manages battle flow, damage calculation, win/loss
 */

import { _decorator, Component } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { LevelDefinition, EnemyTemplate } from '../data/LevelConfig';
import { BOARD_ROWS, BOARD_COLS, MIN_MATCH_COUNT } from '../data/GemConfig';
import { MatchResult } from './MatchLogic';
import { SkillController } from './SkillController';

const { ccclass, property } = _decorator;

export interface BattleTeam {
    characters: BattleCharacter[];
}

export interface BattleCharacter {
    id: string;
    name: string;
    templateId: string;
    attribute: number;
    level: number;
    breakthrough: number;
    attack: number;
    hp: number;
    maxHP: number;
    defense: number;
    energy: number;
    maxEnergy: number;
    skillNormalReady: boolean;
    skillNormalCooldown: number;
    skillUltimateReady: boolean;
    shield: number;
    attackBuff: number;
    defenseBuff: number;
}

export interface BattleEnemy {
    templateId: string;
    name: string;
    hp: number;
    maxHP: number;
    attack: number;
    defense: number;
    isBoss: boolean;
    shield: number;
}

export enum BattlePhase {
    INIT = 'init',
    PLAYER_TURN = 'player_turn',
    ENEMY_TURN = 'enemy_turn',
    VICTORY = 'victory',
    DEFEAT = 'defeat',
    IDLE = 'idle',
}

@ccclass('BattleController')
export class BattleController extends Component {
    private phase: BattlePhase = BattlePhase.IDLE;
    private levelDef: LevelDefinition | null = null;
    private team: BattleCharacter[] = [];
    private enemies: BattleEnemy[] = [];
    private remainingSteps: number = 0;
    private totalScore: number = 0;
    private stepsUsed: number = 0;
    private skillController: SkillController | null = null;

    onLoad() {
        this.skillController = this.getComponent(SkillController);
        
        // 注册事件
        EventManager.getInstance().on(GameEvent.BATTLE_STEP_USED, this.onStepUsed, this);
        EventManager.getInstance().on(GameEvent.MATCH_FOUND, this.onMatchFound, this);
        EventManager.getInstance().on(GameEvent.SKILL_CAST, this.onSkillCast, this);
    }

    /**
     * 初始化战斗
     * @param levelDef 关卡配置
     * @param characterTemplates 队伍角色模板
     */
    initBattle(
        levelDef: LevelDefinition, 
        characterTemplates: { id: string; templateId: string; level: number; breakthrough: number; attack: number; hp: number; defense: number; attribute: number }[]
    ): void {
        this.levelDef = levelDef;
        this.remainingSteps = levelDef.steps;
        this.stepsUsed = 0;
        this.totalScore = 0;
        this.phase = BattlePhase.INIT;

        // 初始化队伍
        this.team = characterTemplates.map(t => ({
            id: t.id,
            name: '',
            templateId: t.templateId,
            attribute: t.attribute,
            level: t.level,
            breakthrough: t.breakthrough,
            attack: t.attack,
            hp: t.hp,
            maxHP: t.hp,
            defense: t.defense,
            energy: 0,
            maxEnergy: 100,
            skillNormalReady: false,
            skillNormalCooldown: 0,
            skillUltimateReady: false,
            shield: 0,
            attackBuff: 0,
            defenseBuff: 0,
        }));

        // 初始化敌人
        this.enemies = levelDef.enemies.map(e => ({
            templateId: e.id,
            name: e.name,
            hp: e.hp,
            maxHP: e.hp,
            attack: e.attack,
            defense: e.defense,
            isBoss: levelDef.isBoss,
            shield: 0,
        }));

        this.phase = BattlePhase.PLAYER_TURN;
    }

    /** 获取当前阶段 */
    getPhase(): BattlePhase {
        return this.phase;
    }

    /** 获取队伍 */
    getTeam(): BattleCharacter[] {
        return this.team;
    }

    /** 获取敌人 */
    getEnemies(): BattleEnemy[] {
        return this.enemies;
    }

    /** 获取剩余步数 */
    getRemainingSteps(): number {
        return this.remainingSteps;
    }

    /** 获取已用步数 */
    getStepsUsed(): number {
        return this.stepsUsed;
    }

    /** 步数消耗回调 */
    private onStepUsed(eventData: { matchResult: MatchResult; totalScore: number }): void {
        if (this.phase !== BattlePhase.PLAYER_TURN) return;

        this.remainingSteps--;
        this.stepsUsed++;
        this.totalScore = eventData.totalScore;

        // 处理能量
        this.distributeEnergy(eventData.matchResult);

        // 处理技能自动触发
        this.checkAutoSkills();

        // 检查是否可释放大招
        this.checkUltimateReady();

        // 如果步数用完，结束玩家回合
        if (this.remainingSteps <= 0) {
            this.endPlayerTurn();
            return;
        }
    }

    /** 匹配消除后的能量分配 */
    private distributeEnergy(matchResult: MatchResult): void {
        const color = matchResult.matchedColor;
        const energy = matchResult.energyGained;

        // 给对应属性的角色加能量
        for (const char of this.team) {
            if (char.attribute === color) {
                char.energy = Math.min(char.maxEnergy, char.energy + energy);
                EventManager.getInstance().emit(GameEvent.ENERGY_CHANGED, {
                    characterId: char.id,
                    energy: char.energy,
                    maxEnergy: char.maxEnergy,
                });

                // 检查技能就绪
                if (char.energy >= 30 && !char.skillNormalReady && char.skillNormalCooldown <= 0) {
                    char.skillNormalReady = true;
                }
                if (char.energy >= 100) {
                    char.skillUltimateReady = true;
                    EventManager.getInstance().emit(GameEvent.SKILL_READY, {
                        characterId: char.id,
                        skillType: 'ultimate',
                    });
                }
            }
        }
    }

    /** 检查是否需要自动触发小技能 */
    private checkAutoSkills(): void {
        for (const char of this.team) {
            if (char.skillNormalReady && char.skillNormalCooldown <= 0) {
                // 自动触发小技能
                EventManager.getInstance().emit(GameEvent.SKILL_CAST, {
                    characterId: char.id,
                    skillType: 'normal',
                    isAuto: true,
                });
            }
        }
    }

    /** 检查大招就绪状态 */
    private checkUltimateReady(): void {
        for (const char of this.team) {
            if (char.energy >= char.maxEnergy && !char.skillUltimateReady) {
                char.skillUltimateReady = true;
                EventManager.getInstance().emit(GameEvent.SKILL_READY, {
                    characterId: char.id,
                    skillType: 'ultimate',
                });
            }
        }
    }

    /** 技能释放回调 */
    private onSkillCast(data: { characterId: string; skillType: 'normal' | 'ultimate' }): void {
        const character = this.team.find(c => c.id === data.characterId);
        if (!character) return;

        if (data.skillType === 'normal') {
            character.energy -= 30;
            character.skillNormalReady = false;
            character.skillNormalCooldown = 2; // 2回合CD
            // 技能效果由SkillController处理
        } else if (data.skillType === 'ultimate') {
            character.energy = 0;
            character.skillUltimateReady = false;
            // 大招效果由SkillController处理
        }
    }

    /** 处理技能伤害到敌人 */
    applySkillDamageToEnemy(enemyIndex: number, damage: number): boolean {
        if (enemyIndex < 0 || enemyIndex >= this.enemies.length) return false;
        
        const enemy = this.enemies[enemyIndex];
        
        // 先扣除护盾
        if (enemy.shield > 0) {
            const shieldDamage = Math.min(enemy.shield, damage);
            enemy.shield -= shieldDamage;
            damage -= shieldDamage;
        }

        if (damage > 0) {
            enemy.hp = Math.max(0, enemy.hp - damage);
        }

        EventManager.getInstance().emit(GameEvent.ENEMY_DAMAGED, {
            enemyIndex,
            damage,
            remainingHP: enemy.hp,
            maxHP: enemy.maxHP,
        });

        if (enemy.hp <= 0) {
            EventManager.getInstance().emit(GameEvent.ENEMY_DEFEATED, { enemyIndex });
        }

        // 检查是否全部击败
        if (this.enemies.every(e => e.hp <= 0)) {
            EventManager.getInstance().emit(GameEvent.ALL_ENEMIES_DEFEATED);
            return true;
        }

        return false;
    }

    /** 敌人攻击玩家 */
    applyEnemyAttackToPlayer(characterIndex: number, damage: number): void {
        if (characterIndex < 0 || characterIndex >= this.team.length) return;
        
        const char = this.team[characterIndex];
        
        // 护盾吸收
        if (char.shield > 0) {
            const shieldDamage = Math.min(char.shield, damage);
            char.shield -= shieldDamage;
            damage -= shieldDamage;
        }

        if (damage > 0) {
            char.hp = Math.max(0, char.hp - damage);
        }

        EventManager.getInstance().emit(GameEvent.PLAYER_DAMAGED, {
            characterIndex,
            damage,
            remainingHP: char.hp,
            maxHP: char.maxHP,
        });

        if (char.hp <= 0) {
            EventManager.getInstance().emit(GameEvent.PLAYER_DEFEATED, { characterIndex });
        }
    }

    /** 结束玩家回合，进入敌人回合 */
    private endPlayerTurn(): void {
        this.phase = BattlePhase.ENEMY_TURN;
        
        // 敌人回合逻辑
        this.executeEnemyTurn();
    }

    /** 执行敌人回合 */
    private executeEnemyTurn(): void {
        // 每个敌人攻击一次
        for (let ei = 0; ei < this.enemies.length; ei++) {
            const enemy = this.enemies[ei];
            if (enemy.hp <= 0) continue;

            // 攻击第一个存活的队友
            const targetIndex = this.team.findIndex(c => c.hp > 0);
            if (targetIndex < 0) break;

            const damage = Math.max(1, enemy.attack - this.team[targetIndex].defense);
            this.applyEnemyAttackToPlayer(targetIndex, damage);
        }

        // 减少技能CD
        for (const char of this.team) {
            if (char.skillNormalCooldown > 0) {
                char.skillNormalCooldown--;
            }
        }

        // 检查是否全灭
        if (this.team.every(c => c.hp <= 0)) {
            this.phase = BattlePhase.DEFEAT;
            EventManager.getInstance().emit(GameEvent.BATTLE_DEFEAT);
            return;
        }

        // 检查是否已击败所有敌人
        if (this.enemies.every(e => e.hp <= 0)) {
            this.phase = BattlePhase.VICTORY;
            EventManager.getInstance().emit(GameEvent.BATTLE_VICTORY, {
                levelId: this.levelDef?.id,
                stepsUsed: this.stepsUsed,
                totalSteps: this.levelDef?.steps,
                totalScore: this.totalScore,
                remainingSteps: this.remainingSteps,
            });
            return;
        }

        // 回到玩家回合
        this.phase = BattlePhase.PLAYER_TURN;
        EventManager.getInstance().emit(GameEvent.BATTLE_TURN, { 
            turn: this.stepsUsed,
            remainingSteps: this.remainingSteps,
        });
    }

    /** 增加步数（风系大招效果） */
    addSteps(extraSteps: number): void {
        this.remainingSteps += extraSteps;
    }

    /** 治疗指定角色 */
    healCharacter(characterIndex: number, amount: number): void {
        if (characterIndex < 0 || characterIndex >= this.team.length) return;
        const char = this.team[characterIndex];
        char.hp = Math.min(char.maxHP, char.hp + amount);
    }

    /** 加护盾 */
    addShieldToAll(shieldAmount: number): void {
        for (const char of this.team) {
            char.shield += shieldAmount;
        }
    }

    onDestroy() {
        EventManager.getInstance().off(GameEvent.BATTLE_STEP_USED, this.onStepUsed, this);
        EventManager.getInstance().off(GameEvent.MATCH_FOUND, this.onMatchFound, this);
        EventManager.getInstance().off(GameEvent.SKILL_CAST, this.onSkillCast, this);
    }

    // 占位，实际由外部Match事件驱动
    private onMatchFound(_data: any): void {
        // 由onStepUsed处理
    }
}
