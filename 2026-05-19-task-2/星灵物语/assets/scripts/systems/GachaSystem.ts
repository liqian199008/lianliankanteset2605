/**
 * 抽卡系统 — 卡池管理、概率抽取、保底机制
 * Gacha System — Pool management, probability, pity system
 */

import { GameManager } from '../core/GameManager';
import { 
    GachaPoolConfig, GachaPoolType, GachaResult, 
    GACHA_POOLS, GACHA_ANIMATION_CONFIG 
} from '../data/GachaConfig';
import { Rarity, INITIAL_CHARACTERS, CharacterTemplate } from '../data/CharacterConfig';

export class GachaSystem {
    private static _instance: GachaSystem;

    static getInstance(): GachaSystem {
        if (!this._instance) {
            this._instance = new GachaSystem();
        }
        return this._instance;
    }

    /** 获取卡池配置 */
    getPoolConfig(poolId: GachaPoolType): GachaPoolConfig {
        return GACHA_POOLS[poolId];
    }

    /** 获取所有卡池 */
    getAllPools(): GachaPoolConfig[] {
        return Object.values(GACHA_POOLS);
    }

    /** 获取当前保底计数 */
    getPityCount(poolId: GachaPoolType): number {
        const gm = GameManager.getInstance();
        if (!gm) return 0;

        const playerData = gm.getPlayerData();
        if (!playerData) return 0;

        const history = playerData.gachaHistory[poolId];
        return history?.pityCount || 0;
    }

    /** 获取总抽取次数 */
    getTotalPulls(poolId: GachaPoolType): number {
        const gm = GameManager.getInstance();
        if (!gm) return 0;

        const playerData = gm.getPlayerData();
        if (!playerData) return 0;

        const history = playerData.gachaHistory[poolId];
        return history?.totalPulls || 0;
    }

    /**
     * 执行单抽
     */
    performSinglePull(poolId: GachaPoolType): GachaResult | null {
        const gm = GameManager.getInstance();
        if (!gm) return null;

        const poolConfig = GACHA_POOLS[poolId];
        if (!poolConfig) return null;

        // 消耗星钻
        if (!gm.spendDiamond(poolConfig.costSingle)) {
            console.warn('[GachaSystem] Not enough diamonds');
            return null;
        }

        const result = this.calculatePull(poolId, poolConfig);

        // 更新保底计数
        this.updatePityCounter(poolId, result.rarity);

        // 添加角色
        if (result.rarity >= Rarity.R) {
            const ownedChar = gm.addCharacter(result.characterId, false);
            result.isNew = ownedChar !== null;
        }

        return result;
    }

    /**
     * 执行十连
     */
    performMultiPull(poolId: GachaPoolType): GachaResult[] | null {
        const gm = GameManager.getInstance();
        if (!gm) return null;

        const poolConfig = GACHA_POOLS[poolId];
        if (!poolConfig) return null;

        // 消耗星钻（十连9折）
        if (!gm.spendDiamond(poolConfig.costMulti)) {
            console.warn('[GachaSystem] Not enough diamonds for multi-pull');
            return null;
        }

        const results: GachaResult[] = [];
        const beforePity = this.getPityCount(poolId);

        for (let i = 0; i < 10; i++) {
            const result = this.calculatePull(poolId, poolConfig, i + 1 === 10, beforePity + i);

            // 更新保底
            this.updatePityCounterDirect(poolId, result.rarity);

            // 添加角色
            if (result.rarity >= Rarity.R) {
                const ownedChar = gm.addCharacter(result.characterId, false);
                result.isNew = ownedChar !== null;
            }

            results.push(result);
        }

        // 检查新手池首次十连必出SR
        if (poolId === GachaPoolType.NOVICE && this.getTotalPulls(poolId) <= 10) {
            const hasSR = results.some(r => r.rarity >= Rarity.SR);
            if (!hasSR) {
                // 将最后一个R替换为SR
                const lastRIndex = results.map((r, i) => ({ r, i }))
                    .filter(x => x.r.rarity === Rarity.R)
                    .pop()?.i;
                if (lastRIndex !== undefined) {
                    const srChar = this.getRandomCharacter(Rarity.SR);
                    results[lastRIndex] = this.createResult(srChar, poolId);
                }
            }
        }

        return results;
    }

    /** 计算单次抽取结果 */
    private calculatePull(
        poolId: GachaPoolType, 
        poolConfig: GachaPoolConfig,
        isLastOfTen: boolean = false,
        overridePityCount?: number
    ): GachaResult {
        const currentPity = overridePityCount ?? this.getPityCount(poolId);
        let rarity: Rarity;

        // 检查硬保底
        if (currentPity >= poolConfig.pityGuarantee - 1) {
            rarity = Rarity.SSR;
        } else {
            // 计算概率（含软保底加成）
            let ssrRate = poolConfig.rateSSR;
            
            if (currentPity >= poolConfig.softPityStart) {
                const softPitySteps = currentPity - poolConfig.softPityStart + 1;
                ssrRate += softPitySteps * poolConfig.softPityIncrease;
            }

            const roll = Math.random() * 10000;
            
            if (roll < ssrRate) {
                rarity = Rarity.SSR;
            } else if (roll < ssrRate + poolConfig.rateSR) {
                rarity = Rarity.SR;
            } else {
                rarity = Rarity.R;
            }
        }

        // 获取角色
        const character = this.getRandomCharacter(rarity, poolId);

        return this.createResult(character, poolId, rarity, currentPity >= poolConfig.pityGuarantee - 1);
    }

    /** 创建抽取结果 */
    private createResult(
        character: CharacterTemplate,
        poolId: GachaPoolType,
        rarity?: Rarity,
        isPity: boolean = false
    ): GachaResult {
        const poolConfig = GACHA_POOLS[poolId];
        const finalRarity = rarity ?? character.rarity;

        return {
            characterId: character.id,
            rarity: finalRarity,
            isNew: false,
            isRateUp: poolConfig.rateUpCharacterId === character.id,
            isPity,
        };
    }

    /** 根据稀有度随机获取角色 */
    private getRandomCharacter(rarity: Rarity, poolId?: GachaPoolType): CharacterTemplate {
        const pool = poolId ? GACHA_POOLS[poolId] : undefined;
        const candidates = INITIAL_CHARACTERS.filter(c => c.rarity === rarity);
        
        if (candidates.length === 0) {
            // 降级处理
            return INITIAL_CHARACTERS[Math.floor(Math.random() * INITIAL_CHARACTERS.length)];
        }

        // 如果有限定UP且抽到SSR，50%概率出UP
        if (rarity === Rarity.SSR && pool?.rateUpCharacterId) {
            if (Math.random() < 0.5) {
                const upChar = INITIAL_CHARACTERS.find(c => c.id === pool.rateUpCharacterId);
                if (upChar) return upChar;
            }
        }

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /** 更新保底计数器 */
    private updatePityCounter(poolId: GachaPoolType, pulledRarity: Rarity): void {
        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        if (!playerData.gachaHistory[poolId]) {
            playerData.gachaHistory[poolId] = {
                poolId,
                pityCount: 0,
                totalPulls: 0,
            };
        }

        const history = playerData.gachaHistory[poolId];
        history.totalPulls++;

        // 抽到SR/SSR重置保底
        if (pulledRarity >= Rarity.SR) {
            history.pityCount = 0;
        } else {
            history.pityCount++;
        }
    }

    /** 直接更新保底计数（无totalPulls） */
    private updatePityCounterDirect(poolId: GachaPoolType, pulledRarity: Rarity): void {
        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        if (!playerData.gachaHistory[poolId]) {
            playerData.gachaHistory[poolId] = {
                poolId,
                pityCount: 0,
                totalPulls: 0,
            };
        }

        const history = playerData.gachaHistory[poolId];
        history.totalPulls++;

        if (pulledRarity >= Rarity.SR) {
            history.pityCount = 0;
        } else {
            history.pityCount++;
        }
    }

    /** 检查新手卡池是否还可抽取 */
    canPullNovicePool(): boolean {
        return this.getTotalPulls(GachaPoolType.NOVICE) < GACHA_POOLS[GachaPoolType.NOVICE].maxPulls;
    }

    /** 获取保底进度百分比 */
    getPityProgress(poolId: GachaPoolType): number {
        const config = GACHA_POOLS[poolId];
        const pity = this.getPityCount(poolId);
        return Math.min(100, (pity / config.pityGuarantee) * 100);
    }

    /** 分解重复角色（获得星尘） */
    decomposeCharacter(instanceId: string): number {
        const gm = GameManager.getInstance();
        if (!gm) return 0;

        const playerData = gm.getPlayerData();
        if (!playerData) return 0;

        const charIndex = playerData.ownedCharacters.findIndex(c => c.instanceId === instanceId);
        if (charIndex === -1) return 0;

        const char = playerData.ownedCharacters[charIndex];
        const template = INITIAL_CHARACTERS.find(c => c.id === char.templateId);
        if (!template) return 0;

        // 分解获得的星尘
        let stardust = 0;
        switch (template.rarity) {
            case Rarity.R: stardust = 10; break;
            case Rarity.SR: stardust = 50; break;
            case Rarity.SSR: stardust = 500; break;
            default: stardust = 5;
        }

        // 移除角色
        playerData.ownedCharacters.splice(charIndex, 1);
        return stardust;
    }
}
