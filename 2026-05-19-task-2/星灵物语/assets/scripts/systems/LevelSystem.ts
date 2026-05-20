/**
 * 关卡系统 — 关卡解锁、进度管理、星级奖励
 * Level System — Unlock, progress, star rewards
 */

import { GameManager, PlayerData, LevelProgressData } from '../core/GameManager';
import { LevelDefinition, LevelState, getAllLevels, getLevelById } from '../data/LevelConfig';

export class LevelSystem {
    private static _instance: LevelSystem;

    static getInstance(): LevelSystem {
        if (!this._instance) {
            this._instance = new LevelSystem();
        }
        return this._instance;
    }

    /** 获取所有关卡列表 */
    getAllLevels(): LevelDefinition[] {
        return getAllLevels();
    }

    /** 获取指定章节的关卡 */
    getChapterLevels(chapter: number): LevelDefinition[] {
        return getAllLevels().filter(l => l.chapter === chapter);
    }

    /** 获取关卡状态 */
    getLevelState(levelId: string): LevelState {
        const gm = GameManager.getInstance();
        if (!gm) return LevelState.LOCKED;

        const progress = gm.getLevelProgress(levelId);
        if (progress?.cleared) {
            return LevelState.CLEARED;
        }

        // 检查是否已解锁
        const levelDef = getLevelById(levelId);
        if (!levelDef) return LevelState.LOCKED;

        // 第一个关卡总是解锁
        if (levelDef.chapter === 1 && levelDef.level === 1) {
            return LevelState.UNLOCKED;
        }

        // 前一关通关后解锁
        const prevLevelId = `${levelDef.chapter}-${levelDef.level - 1}`;
        if (levelDef.level > 1) {
            const prevProgress = gm.getLevelProgress(prevLevelId);
            return prevProgress?.cleared ? LevelState.UNLOCKED : LevelState.LOCKED;
        }

        // 前一章最后一关通关后解锁
        if (levelDef.level === 1 && levelDef.chapter > 1) {
            const lastLevelId = `${levelDef.chapter - 1}-10`;
            const prevChapterProgress = gm.getLevelProgress(lastLevelId);
            return prevChapterProgress?.cleared ? LevelState.UNLOCKED : LevelState.LOCKED;
        }

        return LevelState.LOCKED;
    }

    /** 获取关卡星级 */
    getLevelStars(levelId: string): LevelProgressData | null {
        const gm = GameManager.getInstance();
        if (!gm) return null;
        return gm.getLevelProgress(levelId);
    }

    /**
     * 通关结算
     * @param levelId 关卡ID
     * @param remainingSteps 剩余步数
     * @param score 得分
     * @returns 获得的星级 (0-3)
     */
    completeLevel(levelId: string, remainingSteps: number, score: number): number {
        const levelDef = getLevelById(levelId);
        if (!levelDef) return 0;

        // 计算星级
        let stars = 1; // 通关即1星
        if (remainingSteps >= 10) stars = 3;
        else if (remainingSteps >= 5) stars = 2;

        // 更新进度
        const gm = GameManager.getInstance();
        if (gm) {
            gm.updateLevelProgress(levelId, stars, score, levelDef.steps - remainingSteps);

            // 发放奖励
            const reward = levelDef.firstClearReward;
            gm.addGold(reward.gold);
            gm.addDiamond(reward.diamond);

            // 添加玩家经验
            const playerData = gm.getPlayerData();
            if (playerData) {
                this.addPlayerExp(playerData, Math.floor(reward.gold / 2));
            }
        }

        return stars;
    }

    /** 添加玩家经验 */
    private addPlayerExp(playerData: PlayerData, exp: number): void {
        playerData.exp += exp;
        
        // 升级检查
        const expPerLevel = 100 + playerData.level * 50;
        while (playerData.exp >= playerData.maxExp) {
            playerData.exp -= playerData.maxExp;
            playerData.level++;
            playerData.maxExp = 100 + playerData.level * 50;
            // 升级奖励
            playerData.maxStamina += 5;
            playerData.stamina = Math.min(playerData.stamina + 20, playerData.maxStamina);
        }
    }

    /** 获取总星数 */
    getTotalStars(): number {
        const gm = GameManager.getInstance();
        if (!gm) return 0;

        const levels = getAllLevels();
        let total = 0;
        for (const level of levels) {
            const progress = gm.getLevelProgress(level.id);
            if (progress) {
                total += progress.stars;
            }
        }
        return total;
    }

    /** 检查关卡是否可进入（体力检查） */
    canEnterLevel(levelId: string): { canEnter: boolean; reason?: string } {
        const state = this.getLevelState(levelId);
        if (state === LevelState.LOCKED) {
            return { canEnter: false, reason: '关卡未解锁' };
        }

        const gm = GameManager.getInstance();
        if (!gm) return { canEnter: false, reason: '游戏未初始化' };

        const playerData = gm.getPlayerData();
        if (!playerData || playerData.stamina < 5) {
            return { canEnter: false, reason: '体力不足，需要5点体力' };
        }

        return { canEnter: true };
    }

    /** 进入关卡 */
    enterLevel(levelId: string): LevelDefinition | null {
        const check = this.canEnterLevel(levelId);
        if (!check.canEnter) {
            console.warn('[LevelSystem]', check.reason);
            return null;
        }

        const gm = GameManager.getInstance();
        if (gm) {
            gm.useStamina(5);
        }

        return getLevelById(levelId) || null;
    }

    /** 获取下一关ID */
    getNextLevel(currentLevelId: string): string | null {
        const current = getLevelById(currentLevelId);
        if (!current) return null;

        // 同一章下一关
        const nextId = `${current.chapter}-${current.level + 1}`;
        const next = getLevelById(nextId);
        if (next) return nextId;

        // 下一章第一关
        const nextChapterId = `${current.chapter + 1}-1`;
        const nextChapter = getLevelById(nextChapterId);
        if (nextChapter) return nextChapterId;

        return null;
    }
}
