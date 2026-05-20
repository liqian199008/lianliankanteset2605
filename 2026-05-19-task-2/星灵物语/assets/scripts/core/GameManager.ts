/**
 * 游戏管理器 — 全局游戏状态单例
 * Game Manager — Global game state singleton
 * 管理：玩家数据、货币、队伍、场景流转
 */

import { _decorator, Component, Node, director, Scene } from 'cc';
import { EventManager, GameEvent } from './EventManager';

const { ccclass, property } = _decorator;

/** 玩家数据结构 */
export interface PlayerData {
    // 基本信息
    nickname: string;
    level: number;
    exp: number;
    maxExp: number;
    playerId: string;
    avatarUrl: string;

    // 货币
    gold: number;
    diamond: number;
    stamina: number;
    maxStamina: number;
    staminaRecoverTime: number; // 上次恢复时间戳

    // 拥有的角色
    ownedCharacters: OwnedCharacter[];

    // 关卡进度
    levelProgress: Record<string, LevelProgressData>;

    // 抽卡记录
    gachaHistory: Record<string, GachaHistoryData>;

    // 社交
    socialData: SocialData;

    // 每日信息
    dailyData: DailyData;
}

export interface OwnedCharacter {
    instanceId: string;
    templateId: string;
    level: number;
    breakthrough: number;
    exp: number;
    skillLevel: number;
    affinity: number;
    isInTeam: boolean;
}

export interface LevelProgressData {
    cleared: boolean;
    stars: number;      // 0-3
    bestScore: number;
    bestSteps: number;
}

export interface GachaHistoryData {
    poolId: string;
    pityCount: number;
    totalPulls: number;
}

export interface SocialData {
    friends: string[];
    lastShareTime: number;
    dailyLikes: number;
}

export interface DailyData {
    date: string;
    sharedCount: number;
    likedCount: number;
    staminaReceived: number;
}

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    static getInstance(): GameManager | null {
        return this._instance;
    }

    @property
    isDebugMode: boolean = false;

    private playerData: PlayerData | null = null;
    private isInitialized: boolean = false;

    onLoad() {
        if (GameManager._instance) {
            this.destroy();
            return;
        }
        GameManager._instance = this;
        director.addPersistRootNode(this.node);
    }

    start() {
        this.initGame();
    }

    /** 初始化游戏 */
    async initGame(): Promise<void> {
        console.log('[GameManager] Initializing game...');
        
        // 加载存档
        await this.loadGameData();

        // 检查每日重置
        this.checkDailyReset();

        this.isInitialized = true;
        console.log('[GameManager] Game initialized!');
    }

    // ========== 存档系统 ==========

    private async loadGameData(): Promise<void> {
        try {
            // 尝试从微信本地存储加载
            const savedData = await this.loadFromStorage('playerData');
            if (savedData) {
                this.playerData = JSON.parse(savedData);
                console.log('[GameManager] Player data loaded from storage');
            } else {
                this.createNewPlayer();
            }
        } catch (e) {
            console.warn('[GameManager] Failed to load save, creating new player:', e);
            this.createNewPlayer();
        }
    }

    async saveGameData(): Promise<void> {
        if (!this.playerData) return;

        try {
            const dataStr = JSON.stringify(this.playerData);
            await this.saveToStorage('playerData', dataStr);
            EventManager.getInstance().emit(GameEvent.SAVE_COMPLETE);
            console.log('[GameManager] Game saved');
        } catch (e) {
            console.error('[GameManager] Failed to save game:', e);
        }
    }

    private async saveToStorage(key: string, value: string): Promise<void> {
        // Cocos Creator 环境
        if (typeof sys !== 'undefined' && sys.localStorage) {
            sys.localStorage.setItem(key, value);
        }
    }

    private async loadFromStorage(key: string): Promise<string | null> {
        if (typeof sys !== 'undefined' && sys.localStorage) {
            return sys.localStorage.getItem(key);
        }
        return null;
    }

    /** 创建新玩家 */
    private createNewPlayer(): void {
        const today = new Date().toISOString().split('T')[0];
        this.playerData = {
            nickname: '星灵使者',
            level: 1,
            exp: 0,
            maxExp: 100,
            playerId: this.generatePlayerId(),
            avatarUrl: '',
            gold: 1000,
            diamond: 500,
            stamina: 120,
            maxStamina: 120,
            staminaRecoverTime: Date.now(),
            ownedCharacters: [],
            levelProgress: {},
            gachaHistory: {},
            socialData: {
                friends: [],
                lastShareTime: 0,
                dailyLikes: 0,
            },
            dailyData: {
                date: today,
                sharedCount: 0,
                likedCount: 0,
                staminaReceived: 0,
            },
        };

        // 赠送初始角色：星火·凛
        this.addCharacter('char_fire_001', true);
    }

    private generatePlayerId(): string {
        return 'SP_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    }

    // ========== 每日重置 ==========

    private checkDailyReset(): void {
        if (!this.playerData) return;
        const today = new Date().toISOString().split('T')[0];
        if (this.playerData.dailyData.date !== today) {
            this.resetDailyData();
        }
    }

    private resetDailyData(): void {
        if (!this.playerData) return;
        const today = new Date().toISOString().split('T')[0];
        this.playerData.dailyData = {
            date: today,
            sharedCount: 0,
            likedCount: 0,
            staminaReceived: 0,
        };
        EventManager.getInstance().emit(GameEvent.DAILY_RESET);
        this.saveGameData();
        console.log('[GameManager] Daily data reset');
    }

    // ========== 玩家数据访问 ==========

    getPlayerData(): PlayerData | null {
        return this.playerData;
    }

    /** 获取关卡进度 */
    getLevelProgress(levelId: string): LevelProgressData | null {
        if (!this.playerData) return null;
        return this.playerData.levelProgress[levelId] || null;
    }

    /** 更新关卡进度 */
    updateLevelProgress(levelId: string, stars: number, score: number, steps: number): void {
        if (!this.playerData) return;

        const existing = this.playerData.levelProgress[levelId];
        if (!existing || stars > existing.stars || score > existing.bestScore) {
            this.playerData.levelProgress[levelId] = {
                cleared: true,
                stars: Math.max(existing?.stars || 0, stars),
                bestScore: Math.max(existing?.bestScore || 0, score),
                bestSteps: existing ? Math.min(existing.bestSteps, steps) : steps,
            };
            this.saveGameData();
        }
    }

    // ========== 货币系统 ==========

    addGold(amount: number): void {
        if (!this.playerData) return;
        this.playerData.gold += amount;
        EventManager.getInstance().emit(GameEvent.GOLD_CHANGED, {
            gold: this.playerData.gold,
            change: amount,
        });
    }

    spendGold(amount: number): boolean {
        if (!this.playerData || this.playerData.gold < amount) return false;
        this.playerData.gold -= amount;
        EventManager.getInstance().emit(GameEvent.GOLD_CHANGED, {
            gold: this.playerData.gold,
            change: -amount,
        });
        return true;
    }

    addDiamond(amount: number): void {
        if (!this.playerData) return;
        this.playerData.diamond += amount;
        EventManager.getInstance().emit(GameEvent.DIAMOND_CHANGED, {
            diamond: this.playerData.diamond,
            change: amount,
        });
    }

    spendDiamond(amount: number): boolean {
        if (!this.playerData || this.playerData.diamond < amount) return false;
        this.playerData.diamond -= amount;
        EventManager.getInstance().emit(GameEvent.DIAMOND_CHANGED, {
            diamond: this.playerData.diamond,
            change: -amount,
        });
        return true;
    }

    useStamina(amount: number): boolean {
        if (!this.playerData || this.playerData.stamina < amount) return false;
        this.playerData.stamina -= amount;
        EventManager.getInstance().emit(GameEvent.STAMINA_CHANGED, {
            stamina: this.playerData.stamina,
            maxStamina: this.playerData.maxStamina,
        });
        return true;
    }

    addStamina(amount: number): void {
        if (!this.playerData) return;
        this.playerData.stamina = Math.min(this.playerData.maxStamina, this.playerData.stamina + amount);
        EventManager.getInstance().emit(GameEvent.STAMINA_CHANGED, {
            stamina: this.playerData.stamina,
            maxStamina: this.playerData.maxStamina,
        });
    }

    // ========== 角色系统 ==========

    /** 添加角色到玩家账户 */
    addCharacter(templateId: string, addToTeam: boolean = false): OwnedCharacter | null {
        if (!this.playerData) return null;

        const instanceId = templateId + '_' + Date.now().toString(36);
        const newChar: OwnedCharacter = {
            instanceId,
            templateId,
            level: 1,
            breakthrough: 0,
            exp: 0,
            skillLevel: 1,
            affinity: 0,
            isInTeam: addToTeam && this.playerData.ownedCharacters.filter(c => c.isInTeam).length < 4,
        };

        this.playerData.ownedCharacters.push(newChar);
        EventManager.getInstance().emit(GameEvent.CHARACTER_UNLOCKED, { character: newChar });
        this.saveGameData();
        return newChar;
    }

    /** 获取队伍 */
    getTeam(): OwnedCharacter[] {
        if (!this.playerData) return [];
        return this.playerData.ownedCharacters.filter(c => c.isInTeam);
    }

    /** 设置队伍 */
    setTeam(instanceIds: string[]): void {
        if (!this.playerData) return;
        for (const char of this.playerData.ownedCharacters) {
            char.isInTeam = instanceIds.includes(char.instanceId);
        }
        this.saveGameData();
    }

    /** 获取角色属性（含等级加成） */
    getCharacterStats(instanceId: string): { attack: number; hp: number; defense: number } | null {
        if (!this.playerData) return null;

        const ownedChar = this.playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!ownedChar) return null;

        // 从配置查找基础属性
        const template = require('../data/CharacterConfig').INITIAL_CHARACTERS
            .find((c: any) => c.id === ownedChar.templateId);
        if (!template) return null;

        const levelMult = 1 + (ownedChar.level - 1) * 0.08;
        const rarityMult = require('../data/CharacterConfig').RARITY_STAT_MULTIPLIERS[template.rarity];

        return {
            attack: Math.floor(template.baseAttack * levelMult * rarityMult),
            hp: Math.floor(template.baseHP * levelMult * rarityMult),
            defense: Math.floor(template.baseDefense * levelMult * rarityMult),
        };
    }

    // ========== 体力自然恢复 ==========

    update(dt: number): void {
        // 每30秒检查一次体力恢复
        if (!this.playerData) return;
        
        const now = Date.now();
        const elapsed = now - this.playerData.staminaRecoverTime;
        
        if (elapsed >= 5 * 60 * 1000) { // 每5分钟恢复1点
            const recovered = Math.floor(elapsed / (5 * 60 * 1000));
            const actualRecover = Math.min(recovered, this.playerData.maxStamina - this.playerData.stamina);
            if (actualRecover > 0) {
                this.playerData.stamina += actualRecover;
                this.playerData.staminaRecoverTime += actualRecover * 5 * 60 * 1000;
                EventManager.getInstance().emit(GameEvent.STAMINA_CHANGED, {
                    stamina: this.playerData.stamina,
                    maxStamina: this.playerData.maxStamina,
                });
            }
        }
    }

    onDestroy() {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
    }
}
