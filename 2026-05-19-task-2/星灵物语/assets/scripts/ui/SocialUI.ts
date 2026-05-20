/**
 * 社交UI — 好友排行榜、分享入口、互动
 * Social UI — Friend leaderboard, share entry, interaction
 */

import { _decorator, Component, Node, Label, Button, ScrollView } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { SocialSystem } from '../systems/SocialSystem';
import { GameManager } from '../core/GameManager';

const { ccclass, property } = _decorator;

@ccclass('SocialUI')
export class SocialUI extends Component {
    @property({ type: ScrollView, tooltip: '排行榜滚动视图' })
    leaderboardScroll: ScrollView | null = null;

    @property({ type: Node, tooltip: '排行榜内容容器' })
    leaderboardContent: Node | null = null;

    @property({ type: Label, tooltip: '玩家战力' })
    powerLabel: Label | null = null;

    @property({ type: Label, tooltip: '通关数' })
    clearedLabel: Label | null = null;

    @property({ type: Button, tooltip: '分享通关' })
    shareClearBtn: Button | null = null;

    @property({ type: Button, tooltip: '分享抽卡' })
    shareGachaBtn: Button | null = null;

    @property({ type: Button, tooltip: '求体力' })
    askStaminaBtn: Button | null = null;

    @property({ type: Button, tooltip: '好友点赞' })
    likeBtn: Button | null = null;

    @property({ type: Button, tooltip: '关闭按钮' })
    closeBtn: Button | null = null;

    private socialSystem: SocialSystem;

    constructor() {
        super();
        this.socialSystem = SocialSystem.getInstance();
    }

    onLoad() {
        this.setupButtons();
        this.registerEvents();
    }

    onEnable() {
        this.refreshSocialData();
    }

    private setupButtons(): void {
        if (this.shareClearBtn) {
            this.shareClearBtn.node.on(Button.EventType.CLICK, () => {
                this.socialSystem.shareToFriend('level_clear');
            });
        }
        if (this.shareGachaBtn) {
            this.shareGachaBtn.node.on(Button.EventType.CLICK, () => {
                this.socialSystem.shareToFriend('gacha_ssr');
            });
        }
        if (this.askStaminaBtn) {
            this.askStaminaBtn.node.on(Button.EventType.CLICK, () => {
                this.socialSystem.shareToFriend('ask_stamina');
            });
        }
        if (this.likeBtn) {
            this.likeBtn.node.on(Button.EventType.CLICK, () => {
                this.onLikeFriend();
            });
        }
        if (this.closeBtn) {
            this.closeBtn.node.on(Button.EventType.CLICK, () => {
                this.node.destroy();
            });
        }
    }

    private registerEvents(): void {
        EventManager.getInstance().on('leaderboard_updated', this.onLeaderboardUpdated, this);
    }

    /** 刷新社交数据 */
    private refreshSocialData(): void {
        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        // 战力
        if (this.powerLabel) {
            const power = this.calculatePower();
            this.powerLabel.string = `战力: ${power}`;
        }

        // 通关数
        if (this.clearedLabel) {
            const clearedCount = Object.values(playerData.levelProgress).filter(p => p.cleared).length;
            this.clearedLabel.string = `已通关: ${clearedCount}关`;
        }

        // 更新排行榜
        this.socialSystem.updateLeaderboard('power', this.calculatePower());
        this.socialSystem.showLeaderboard();
    }

    /** 计算战力 */
    private calculatePower(): number {
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

    /** 排行榜更新 */
    private onLeaderboardUpdated(data: { friends: any[] }): void {
        if (!this.leaderboardContent) return;

        this.leaderboardContent.removeAllChildren();

        // 添加玩家自己
        const gm = GameManager.getInstance();
        const playerData = gm?.getPlayerData();
        if (playerData) {
            const selfNode = this.createRankItem(
                0, playerData.nickname, this.calculatePower(), true
            );
            this.leaderboardContent.addChild(selfNode);
        }

        // 添加好友排名
        for (let i = 0; i < data.friends.length; i++) {
            const friend = data.friends[i];
            const rankNode = this.createRankItem(i + 1, friend.nickname, friend.power || 0, false);
            this.leaderboardContent.addChild(rankNode);
        }
    }

    /** 创建排行项 */
    private createRankItem(rank: number, name: string, power: number, isSelf: boolean): Node {
        const node = new Node(`rank_${rank}`);
        const label = node.addComponent(Label);

        const medal = rank === 0 ? '👑' : rank <= 3 ? `#${rank}` : `#${rank + 1}`;
        const selfTag = isSelf ? ' [我]' : '';
        label.string = `${medal} ${name}${selfTag} 战力: ${power}`;
        label.fontSize = 18;
        label.lineHeight = 40;

        return node;
    }

    /** 点赞好友 */
    private onLikeFriend(): void {
        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        if (playerData.dailyData.likedCount >= 5) {
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: '今日点赞已达上限(5次)',
                type: 'warning',
            });
            return;
        }

        this.socialSystem.likeFriend('friend_placeholder');
        EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
            message: '点赞成功！好友获得了体力❤️',
            type: 'success',
        });
    }

    onDestroy() {
        EventManager.getInstance().off('leaderboard_updated', this.onLeaderboardUpdated, this);
    }
}
