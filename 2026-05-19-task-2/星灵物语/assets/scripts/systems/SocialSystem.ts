/**
 * 微信社交系统 — 好友、排行榜、分享
 * WeChat Social System — Friends, leaderboards, sharing
 */

import { GameManager, SocialData } from '../core/GameManager';

// 微信API类型声明
declare const wx: any;
declare const tt: any; // 字节系备用

export class SocialSystem {
    private static _instance: SocialSystem;

    static getInstance(): SocialSystem {
        if (!this._instance) {
            this._instance = new SocialSystem();
        }
        return this._instance;
    }

    // ========== 微信初始化 ==========

    /** 初始化微信SDK（在wx环境下调用） */
    initWeChatSDK(): void {
        if (typeof wx === 'undefined') {
            console.log('[SocialSystem] Not in WeChat environment, social features disabled');
            return;
        }
        console.log('[SocialSystem] WeChat SDK initialized');
    }

    // ========== 好友排行榜 ==========

    /** 
     * 更新好友排行榜
     * 使用微信关系链数据
     */
    updateLeaderboard(scoreType: 'score' | 'level' | 'power', value: number): void {
        if (typeof wx === 'undefined' || !wx.setUserCloudStorage) return;

        const kvData = [];
        
        switch (scoreType) {
            case 'score':
                kvData.push({ key: 'high_score', value: JSON.stringify(value) });
                break;
            case 'level':
                kvData.push({ key: 'max_level', value: JSON.stringify(this.getTotalClearedLevels()) });
                break;
            case 'power':
                kvData.push({ key: 'combat_power', value: JSON.stringify(this.calculateCombatPower()) });
                break;
        }

        try {
            wx.setUserCloudStorage({
                KVDataList: kvData,
                success: () => console.log('[SocialSystem] Leaderboard updated'),
                fail: (err: any) => console.warn('[SocialSystem] Leaderboard update failed:', err),
            });
        } catch (e) {
            console.warn('[SocialSystem] Leaderboard error:', e);
        }
    }

    /** 展示好友排行榜 */
    showLeaderboard(): void {
        if (typeof wx === 'undefined') return;

        try {
            // 使用微信关系链数据
            wx.getFriendCloudStorage({
                keyList: ['high_score', 'combat_power'],
                success: (res: any) => {
                    const friends = res.data.map((item: any) => ({
                        avatarUrl: item.avatarUrl,
                        nickname: item.nickname,
                        score: JSON.parse(item.KVDataList?.find((d: any) => d.key === 'high_score')?.value || '0'),
                        power: JSON.parse(item.KVDataList?.find((d: any) => d.key === 'combat_power')?.value || '0'),
                    }));

                    // 排序
                    friends.sort((a: any, b: any) => b.score - a.score);

                    // 触发UI更新事件
                    const EventManager = require('../core/EventManager').EventManager;
                    EventManager.getInstance().emit('leaderboard_updated', { friends });
                },
                fail: () => {
                    console.warn('[SocialSystem] Failed to get friend data');
                },
            });
        } catch (e) {
            console.warn('[SocialSystem] Leaderboard error:', e);
        }
    }

    /** 显示微信排行榜（使用开放数据域） */
    showWeChatLeaderboard(): void {
        if (typeof wx === 'undefined') return;

        try {
            wx.postMessage({
                type: 'show_rank',
                data: { type: 'score' },
            });
        } catch (e) {
            console.warn('[SocialSystem] Open data context error:', e);
        }
    }

    // ========== 分享系统 ==========

    /** 分享给好友/群聊 */
    shareToFriend(shareType: 'level_clear' | 'gacha_ssr' | 'invite' | 'ask_stamina'): { success: boolean; reward?: string } {
        if (typeof wx === 'undefined') return { success: false };

        const shareData = this.getShareData(shareType);
        if (!shareData) return { success: false };

        try {
            wx.shareAppMessage({
                title: shareData.title,
                imageUrl: shareData.image,
                query: shareData.query,
                success: () => {
                    // 分享成功后发放奖励
                    this.grantShareReward(shareType);
                },
                fail: () => {
                    console.log('[SocialSystem] Share cancelled');
                },
            });
            return { success: true };
        } catch (e) {
            console.warn('[SocialSystem] Share failed:', e);
            return { success: false };
        }
    }

    /** 获取分享数据 */
    private getShareData(shareType: string): { title: string; image: string; query: string } | null {
        const gm = GameManager.getInstance();
        const playerData = gm?.getPlayerData();
        const nickname = playerData?.nickname || '星灵使者';

        const shareTemplates: Record<string, { title: string; image: string; query: string }> = {
            level_clear: {
                title: `✨ ${nickname}在星灵物语中通关了！来一起玩吧~`,
                image: 'share/level_clear.png',
                query: 'from=share_level',
            },
            gacha_ssr: {
                title: `🎉 ${nickname}抽到了SSR！这运气也太好了吧！`,
                image: 'share/gacha_ssr.png',
                query: 'from=share_gacha',
            },
            invite: {
                title: `🌟 ${nickname}邀请你来星灵物语！成为星灵使者吧！`,
                image: 'share/invite.png',
                query: 'from=share_invite',
            },
            ask_stamina: {
                title: `💪 ${nickname}需要体力支援！快来帮我一下吧~`,
                image: 'share/stamina.png',
                query: 'from=share_stamina',
            },
        };

        return shareTemplates[shareType] || null;
    }

    /** 发放分享奖励 */
    private grantShareReward(shareType: string): void {
        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        const today = new Date().toISOString().split('T')[0];
        
        // 检查每日分享上限
        if (shareType !== 'invite' && playerData.dailyData.sharedCount >= 3) {
            console.log('[SocialSystem] Daily share limit reached');
            return;
        }

        switch (shareType) {
            case 'level_clear':
                gm.addDiamond(10);
                playerData.dailyData.sharedCount++;
                break;
            case 'gacha_ssr':
                gm.addDiamond(20);
                playerData.dailyData.sharedCount++;
                break;
            case 'invite':
                gm.addDiamond(50);
                break;
            case 'ask_stamina':
                gm.addStamina(5);
                playerData.dailyData.sharedCount++;
                break;
        }

        gm.saveGameData();
    }

    // ========== 好友互动 ==========

    /** 点赞好友（送体力） */
    likeFriend(friendId: string): boolean {
        const gm = GameManager.getInstance();
        if (!gm) return false;

        const playerData = gm.getPlayerData();
        if (!playerData) return false;

        if (playerData.dailyData.likedCount >= 5) {
            console.log('[SocialSystem] Daily like limit reached');
            return false;
        }

        // 扣减自己的体力送给好友（设计上自己不减）
        playerData.dailyData.likedCount++;
        gm.saveGameData();

        // 通过微信API通知好友（模拟）
        console.log(`[SocialSystem] Liked friend ${friendId}`);
        return true;
    }

    /** 接收好友赠送的体力 */
    receiveStaminaFromFriend(senderId: string): boolean {
        const gm = GameManager.getInstance();
        if (!gm) return false;

        const playerData = gm.getPlayerData();
        if (!playerData) return false;

        if (playerData.dailyData.staminaReceived >= 10) {
            return false;
        }

        gm.addStamina(5);
        playerData.dailyData.staminaReceived++;
        gm.saveGameData();

        return true;
    }

    /** 获取好友列表（模拟/微信） */
    async getFriendList(): Promise<{ id: string; nickname: string; avatar: string; lastActive: number }[]> {
        // 从本地数据读取已添加的好友
        const gm = GameManager.getInstance();
        if (!gm) return [];

        const playerData = gm.getPlayerData();
        if (!playerData) return [];

        // [PLACEHOLDER] 实际应使用wx.getFriendList()
        return playerData.socialData.friends.map(id => ({
            id,
            nickname: `好友${id.substring(0, 4)}`,
            avatar: '',
            lastActive: Date.now(),
        }));
    }

    // ========== 群排行 ==========

    /** 获取群排名数据（需要群分享卡片上下文） */
    getGroupRank(): void {
        if (typeof wx === 'undefined') return;

        try {
            wx.getGroupCloudStorage({
                keyList: ['high_score'],
                success: (res: any) => {
                    console.log('[SocialSystem] Group rank data:', res);
                    // 触发UI更新
                    const EventManager = require('../core/EventManager').EventManager;
                    EventManager.getInstance().emit('group_rank_updated', { data: res.data });
                },
                fail: () => console.warn('[SocialSystem] Failed to get group data'),
            });
        } catch (e) {
            console.warn('[SocialSystem] Group rank error:', e);
        }
    }

    // ========== 辅助方法 ==========

    /** 计算总战力 */
    private calculateCombatPower(): number {
        const gm = GameManager.getInstance();
        if (!gm) return 0;

        const team = gm.getTeam();
        let power = 0;

        for (const char of team) {
            const stats = gm.getCharacterStats(char.instanceId);
            if (stats) {
                power += stats.attack * 1.5 + stats.hp * 0.5 + stats.defense * 2;
            }
        }

        return Math.floor(power);
    }

    /** 获取总通关关卡数 */
    private getTotalClearedLevels(): number {
        const gm = GameManager.getInstance();
        if (!gm) return 0;

        const playerData = gm.getPlayerData();
        if (!playerData) return 0;

        return Object.values(playerData.levelProgress).filter(p => p.cleared).length;
    }
}
