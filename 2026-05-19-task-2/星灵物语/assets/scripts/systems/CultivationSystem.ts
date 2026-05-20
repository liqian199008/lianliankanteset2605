/**
 * 养成系统 — 角色升级、突破、好感度
 * Cultivation System — Level up, breakthrough, affinity
 */

import { GameManager, OwnedCharacter } from '../core/GameManager';
import { 
    INITIAL_CHARACTERS, CharacterTemplate, Rarity,
    LEVEL_EXP_TABLE, LEVEL_STAT_GROWTH, BREAKTHROUGH_COST,
    RARITY_STAT_MULTIPLIERS 
} from '../data/CharacterConfig';

export class CultivationSystem {
    private static _instance: CultivationSystem;

    static getInstance(): CultivationSystem {
        if (!this._instance) {
            this._instance = new CultivationSystem();
        }
        return this._instance;
    }

    // ========== 等级相关 ==========

    /** 获取角色当前等级信息 */
    getLevelInfo(ownedChar: OwnedCharacter): {
        level: number;
        currentExp: number;
        expToNext: number;
        isMaxLevel: boolean;
        maxLevel: number;
    } {
        const maxLevel = this.getMaxLevel(ownedChar);
        const isMaxLevel = ownedChar.level >= maxLevel;
        const expToNext = isMaxLevel ? 0 : LEVEL_EXP_TABLE[ownedChar.level] || 99999;

        return {
            level: ownedChar.level,
            currentExp: ownedChar.exp,
            expToNext,
            isMaxLevel,
            maxLevel,
        };
    }

    /** 获取当前最大等级（受突破限制） */
    private getMaxLevel(ownedChar: OwnedCharacter): number {
        return 10 + ownedChar.breakthrough * 5; // Lv.10 + 突破次数×5
    }

    /** 添加角色经验 */
    addExp(instanceId: string, exp: number): { leveledUp: boolean; newLevel: number } | null {
        const gm = GameManager.getInstance();
        if (!gm) return null;

        const playerData = gm.getPlayerData();
        if (!playerData) return null;

        const char = playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!char) return null;

        const maxLevel = this.getMaxLevel(char);
        if (char.level >= maxLevel) {
            return { leveledUp: false, newLevel: char.level };
        }

        char.exp += exp;
        let leveledUp = false;

        // 检查是否可升级
        while (char.level < maxLevel && char.exp >= LEVEL_EXP_TABLE[char.level]) {
            char.exp -= LEVEL_EXP_TABLE[char.level];
            char.level++;
            leveledUp = true;
        }

        if (leveledUp) {
            gm.saveGameData();
        }

        return { leveledUp, newLevel: char.level };
    }

    /** 计算角色当前属性 */
    getCalculatedStats(ownedChar: OwnedCharacter): { attack: number; hp: number; defense: number } | null {
        const template = INITIAL_CHARACTERS.find(c => c.id === ownedChar.templateId);
        if (!template) return null;

        const levelMult = 1 + (ownedChar.level - 1) * LEVEL_STAT_GROWTH.attack;
        const rarityMult = RARITY_STAT_MULTIPLIERS[template.rarity];

        return {
            attack: Math.floor(template.baseAttack * levelMult * rarityMult),
            hp: Math.floor(template.baseHP * (1 + (ownedChar.level - 1) * LEVEL_STAT_GROWTH.hp) * rarityMult),
            defense: Math.floor(template.baseDefense * (1 + (ownedChar.level - 1) * LEVEL_STAT_GROWTH.defense) * rarityMult),
        };
    }

    // ========== 突破相关 ==========

    /** 检查是否可以突破 */
    canBreakthrough(instanceId: string): { canBreak: boolean; reason?: string; cost?: { shards: number; gold: number } } {
        const gm = GameManager.getInstance();
        if (!gm) return { canBreak: false, reason: '游戏未初始化' };

        const playerData = gm.getPlayerData();
        if (!playerData) return { canBreak: false, reason: '无玩家数据' };

        const char = playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!char) return { canBreak: false, reason: '角色不存在' };

        if (char.breakthrough >= BREAKTHROUGH_COST.maxBreakthrough) {
            return { canBreak: false, reason: '已达最大突破次数' };
        }

        const maxLevel = this.getMaxLevel(char);
        if (char.level < maxLevel) {
            return { canBreak: false, reason: `需要达到Lv.${maxLevel}才可突破` };
        }

        // 检查材料和金币
        const template = INITIAL_CHARACTERS.find(c => c.id === char.templateId);
        if (!template) return { canBreak: false, reason: '角色配置异常' };

        const cost = {
            shards: BREAKTHROUGH_COST.shardCount,
            gold: BREAKTHROUGH_COST.gold,
        };

        // 检查同角色碎片数量（通过重复角色判断）
        const sameChars = playerData.ownedCharacters.filter(
            c => c.templateId === char.templateId && c.instanceId !== instanceId
        );
        if (sameChars.length < cost.shards) {
            return { 
                canBreak: false, 
                reason: `需要${cost.shards}个同角色碎片`,
                cost,
            };
        }

        if (playerData.gold < cost.gold) {
            return { 
                canBreak: false, 
                reason: `金币不足，需要${cost.gold}`,
                cost,
            };
        }

        return { canBreak: true, cost };
    }

    /** 执行突破 */
    performBreakthrough(instanceId: string): { success: boolean; newBreakthrough: number } | null {
        const check = this.canBreakthrough(instanceId);
        if (!check.canBreak || !check.cost) {
            return { success: false, newBreakthrough: 0 };
        }

        const gm = GameManager.getInstance();
        if (!gm) return null;

        const playerData = gm.getPlayerData();
        if (!playerData) return null;

        const char = playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!char) return null;

        // 扣除碎片（移除相同templateId的角色）
        let removedCount = 0;
        for (let i = playerData.ownedCharacters.length - 1; i >= 0; i--) {
            if (playerData.ownedCharacters[i].templateId === char.templateId 
                && playerData.ownedCharacters[i].instanceId !== instanceId
                && removedCount < check.cost.shards) {
                playerData.ownedCharacters.splice(i, 1);
                removedCount++;
            }
        }

        // 扣除金币
        gm.spendGold(check.cost.gold);

        // 执行突破
        char.breakthrough++;
        char.level = 1; // 突破后等级重置
        char.exp = 0;

        gm.saveGameData();
        return { success: true, newBreakthrough: char.breakthrough };
    }

    // ========== 技能升级 ==========

    /** 升级技能（消耗技能书+金币） */
    upgradeSkill(instanceId: string): { success: boolean; newLevel: number; cost: { books: number; gold: number } } {
        const gm = GameManager.getInstance();
        if (!gm) return { success: false, newLevel: 0, cost: { books: 0, gold: 0 } };

        const playerData = gm.getPlayerData();
        if (!playerData) return { success: false, newLevel: 0, cost: { books: 0, gold: 0 } };

        const char = playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!char) return { success: false, newLevel: 0, cost: { books: 0, gold: 0 } };

        if (char.skillLevel >= 5) {
            return { success: false, newLevel: 5, cost: { books: 0, gold: 0 } };
        }

        const cost = {
            books: char.skillLevel * 2,
            gold: char.skillLevel * 1000,
        };

        if (playerData.gold < cost.gold) return { success: false, newLevel: char.skillLevel, cost };

        gm.spendGold(cost.gold);
        char.skillLevel++;

        gm.saveGameData();
        return { success: true, newLevel: char.skillLevel, cost };
    }

    // ========== 好感度 ==========

    /** 好感度等级对应的上限 */
    private readonly AFFINITY_CAPS = [0, 100, 300, 600, 1000];

    /** 增加好感度 */
    addAffinity(instanceId: string, amount: number): { leveledUp: boolean; newAffinity: number; level: number } | null {
        const gm = GameManager.getInstance();
        if (!gm) return null;

        const playerData = gm.getPlayerData();
        if (!playerData) return null;

        const char = playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!char) return null;

        const currentLevel = this.getAffinityLevel(char.affinity);
        char.affinity += amount;
        const newLevel = this.getAffinityLevel(char.affinity);

        gm.saveGameData();
        return { 
            leveledUp: newLevel > currentLevel, 
            newAffinity: char.affinity, 
            level: newLevel 
        };
    }

    /** 获取好感度等级 */
    getAffinityLevel(affinity: number): number {
        for (let i = this.AFFINITY_CAPS.length - 1; i >= 0; i--) {
            if (affinity >= this.AFFINITY_CAPS[i]) return i + 1;
        }
        return 1;
    }

    /** 获取好感度上限 */
    getAffinityCap(level: number): number {
        if (level < 1) return 0;
        if (level > this.AFFINITY_CAPS.length) return this.AFFINITY_CAPS[this.AFFINITY_CAPS.length - 1];
        return this.AFFINITY_CAPS[level - 1];
    }

    /** 获取好感度解锁内容 */
    getAffinityUnlocks(level: number): string[] {
        const unlocks: Record<number, string[]> = {
            1: ['基础互动'],
            2: ['角色语音②解锁'],
            3: ['背景故事解锁'],
            4: ['角色语音③解锁'],
            5: ['专属头像框解锁'],
        };
        return unlocks[level] || [];
    }
}
