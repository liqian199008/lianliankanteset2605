/**
 * 抽卡UI — 卡池选择、抽卡动画、结果展示
 * Gacha UI — Pool selection, pull animation, result display
 */

import { _decorator, Component, Node, Label, Button, Sprite, Color, tween, Vec3 } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { GachaSystem } from '../systems/GachaSystem';
import { GachaPoolType, GachaResult, GACHA_POOLS, GACHA_ANIMATION_CONFIG } from '../data/GachaConfig';
import { Rarity, RARITY_COLORS } from '../data/CharacterConfig';
import { GameManager } from '../core/GameManager';

const { ccclass, property } = _decorator;

@ccclass('GachaUI')
export class GachaUI extends Component {
    @property({ type: Node, tooltip: '卡池选择容器' })
    poolContainer: Node | null = null;

    @property({ type: Button, tooltip: '单抽按钮' })
    singlePullBtn: Button | null = null;

    @property({ type: Button, tooltip: '十连按钮' })
    multiPullBtn: Button | null = null;

    @property({ type: Label, tooltip: '保底进度文本' })
    pityLabel: Label | null = null;

    @property({ type: Node, tooltip: '抽卡结果展示区域' })
    resultContainer: Node | null = null;

    @property({ type: Node, tooltip: '单抽动画节点' })
    cardRevealNode: Node | null = null;

    private currentPool: GachaPoolType = GachaPoolType.STANDARD;
    private isAnimating: boolean = false;

    onLoad() {
        this.setupPoolSelection();
        this.setupButtons();
    }

    onEnable() {
        this.refreshUI();
    }

    private setupPoolSelection(): void {
        // [PLACEHOLDER] 卡池标签切换
        // 实际应创建可点击的标签页
    }

    private setupButtons(): void {
        if (this.singlePullBtn) {
            this.singlePullBtn.node.on(Button.EventType.CLICK, () => {
                this.performPull(false);
            });
        }
        if (this.multiPullBtn) {
            this.multiPullBtn.node.on(Button.EventType.CLICK, () => {
                this.performPull(true);
            });
        }
    }

    private refreshUI(): void {
        const gachaSystem = GachaSystem.getInstance();
        const poolConfig = GACHA_POOLS[this.currentPool];
        const gm = GameManager.getInstance();

        if (this.singlePullBtn) {
            const btnLabel = this.singlePullBtn.node.getComponentInChildren(Label);
            if (btnLabel) btnLabel.string = `单抽 ${poolConfig.costSingle}💎`;
        }
        if (this.multiPullBtn) {
            const btnLabel = this.multiPullBtn.node.getComponentInChildren(Label);
            if (btnLabel) btnLabel.string = `十连 ${poolConfig.costMulti}💎`;
        }

        if (this.pityLabel) {
            const pity = gachaSystem.getPityCount(this.currentPool);
            const guarantee = poolConfig.pityGuarantee;
            this.pityLabel.string = `保底进度: ${pity}/${guarantee}`;
        }
    }

    /** 执行抽卡 */
    private async performPull(isMulti: boolean): Promise<void> {
        if (this.isAnimating) return;

        const gm = GameManager.getInstance();
        if (!gm) return;

        const poolConfig = GACHA_POOLS[this.currentPool];
        const cost = isMulti ? poolConfig.costMulti : poolConfig.costSingle;

        // 检查钻石
        const playerData = gm.getPlayerData();
        if (!playerData || playerData.diamond < cost) {
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: '星钻不足！',
                type: 'warning',
            });
            return;
        }

        this.isAnimating = true;

        if (isMulti) {
            await this.performMultiPull();
        } else {
            await this.performSinglePull();
        }

        this.isAnimating = false;
        this.refreshUI();
    }

    /** 单抽 */
    private async performSinglePull(): Promise<void> {
        const gachaSystem = GachaSystem.getInstance();
        const result = gachaSystem.performSinglePull(this.currentPool);
        if (!result) return;

        // 播放卡牌翻转动画
        if (this.cardRevealNode) {
            this.cardRevealNode.setScale(new Vec3(1, 0, 1));
            
            await new Promise<void>(resolve => {
                tween(this.cardRevealNode)
                    .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .call(resolve)
                    .start();
            });
        }

        this.showSingleResult(result);
    }

    /** 十连 */
    private async performMultiPull(): Promise<void> {
        const gachaSystem = GachaSystem.getInstance();
        const results = gachaSystem.performMultiPull(this.currentPool);
        if (!results || results.length === 0) return;

        // 逐张揭示
        for (let i = 0; i < results.length; i++) {
            this.showSingleResult(results[i]);
            await this.delay(GACHA_ANIMATION_CONFIG.REVEAL_DELAY * 1000);
        }

        // 稀有度高亮（如果有SSR）
        const ssrResults = results.filter(r => r.rarity === Rarity.SSR);
        if (ssrResults.length > 0) {
            await this.delay(300);
            this.playSSRCelebration();
        }
    }

    /** 显示单张结果 */
    private showSingleResult(result: GachaResult): void {
        // 创建结果卡片节点
        const cardNode = new Node('GachaCard');
        if (this.resultContainer) {
            cardNode.setParent(this.resultContainer);
        }

        // 根据稀有度设置边框色
        const rarityColor = RARITY_COLORS[result.rarity];
        
        // [PLACEHOLDER] 这里应该实例化卡片预制体
        const label = cardNode.addComponent(Label);
        const charName = this.getCharacterName(result.characterId);
        label.string = `${charName} [${Rarity[result.rarity]}]`;
        label.fontSize = 20;
        label.color = new Color().fromHEX(rarityColor.substring(1));
        label.horizontalAlign = Label.HorizontalAlign.CENTER;

        // 入场动画
        cardNode.setScale(new Vec3(0.5, 0.5, 1));
        cardNode.setOpacity(0);
        tween(cardNode)
            .to(0.3, { scale: new Vec3(1, 1, 1), opacity: 255 }, { easing: 'backOut' })
            .start();
    }

    /** SSR庆祝特效 */
    private playSSRCelebration(): void {
        // 全屏金色粒子效果（通过事件交给特效系统）
        EventManager.getInstance().emit('effect_golden_particle', {
            duration: 2.0,
            count: 80,
        });

        EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
            message: '★ SSR 降临！★',
            type: 'celebration',
        });
    }

    /** 获取角色名称 */
    private getCharacterName(characterId: string): string {
        const { INITIAL_CHARACTERS } = require('../data/CharacterConfig');
        const char = INITIAL_CHARACTERS.find((c: any) => c.id === characterId);
        return char ? char.name : '未知角色';
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
