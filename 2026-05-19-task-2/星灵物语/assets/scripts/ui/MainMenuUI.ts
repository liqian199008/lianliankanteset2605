/**
 * 主菜单UI — 游戏主界面
 * Main Menu UI — Game home screen
 */

import { _decorator, Component, Node, Label, Button, Sprite, Color } from 'cc';
import { GameManager } from '../core/GameManager';
import { EventManager, GameEvent } from '../core/EventManager';

const { ccclass, property } = _decorator;

@ccclass('MainMenuUI')
export class MainMenuUI extends Component {
    // === 顶部信息栏 ===
    @property({ type: Label, tooltip: '玩家等级' })
    playerLevel: Label | null = null;
    @property({ type: Label, tooltip: '玩家昵称' })
    playerName: Label | null = null;
    @property({ type: Label, tooltip: '金币数量' })
    goldLabel: Label | null = null;
    @property({ type: Label, tooltip: '星钻数量' })
    diamondLabel: Label | null = null;
    @property({ type: Label, tooltip: '体力值' })
    staminaLabel: Label | null = null;

    // === 底部导航按钮 ===
    @property({ type: Button, tooltip: '战斗按钮' })
    battleButton: Button | null = null;
    @property({ type: Button, tooltip: '角色按钮' })
    characterButton: Button | null = null;
    @property({ type: Button, tooltip: '抽卡按钮' })
    gachaButton: Button | null = null;
    @property({ type: Button, tooltip: '社交按钮' })
    socialButton: Button | null = null;

    // === 中央展示 ===
    @property({ type: Node, tooltip: '角色展示区域' })
    characterDisplay: Node | null = null;

    // === 活动入口 ===
    @property({ type: Button, tooltip: '每日任务' })
    dailyQuestButton: Button | null = null;

    onLoad() {
        this.setupButtons();
        this.registerEvents();
    }

    onEnable() {
        this.refreshUI();
    }

    /** 设置按钮点击事件 */
    private setupButtons(): void {
        if (this.battleButton) {
            this.battleButton.node.on(Button.EventType.CLICK, () => {
                EventManager.getInstance().emit(GameEvent.SCENE_TRANSITION, { to: 'LevelScene' });
            });
        }
        if (this.characterButton) {
            this.characterButton.node.on(Button.EventType.CLICK, () => {
                EventManager.getInstance().emit(GameEvent.SCENE_TRANSITION, { to: 'CharacterScene' });
            });
        }
        if (this.gachaButton) {
            this.gachaButton.node.on(Button.EventType.CLICK, () => {
                EventManager.getInstance().emit(GameEvent.SCENE_TRANSITION, { to: 'GachaScene' });
            });
        }
        if (this.socialButton) {
            this.socialButton.node.on(Button.EventType.CLICK, () => {
                this.showSocialPanel();
            });
        }
        if (this.dailyQuestButton) {
            this.dailyQuestButton.node.on(Button.EventType.CLICK, () => {
                this.showDailyQuests();
            });
        }
    }

    /** 注册数据变更事件 */
    private registerEvents(): void {
        EventManager.getInstance().on(GameEvent.GOLD_CHANGED, this.onCurrencyChanged, this);
        EventManager.getInstance().on(GameEvent.DIAMOND_CHANGED, this.onCurrencyChanged, this);
        EventManager.getInstance().on(GameEvent.STAMINA_CHANGED, this.onStaminaChanged, this);
    }

    /** 刷新UI数据 */
    refreshUI(): void {
        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        if (this.playerLevel) this.playerLevel.string = `Lv.${playerData.level}`;
        if (this.playerName) this.playerName.string = playerData.nickname;
        if (this.goldLabel) this.goldLabel.string = this.formatNumber(playerData.gold);
        if (this.diamondLabel) this.diamondLabel.string = this.formatNumber(playerData.diamond);
        if (this.staminaLabel) {
            this.staminaLabel.string = `${playerData.stamina}/${playerData.maxStamina}`;
        }
    }

    /** 货币变化 */
    private onCurrencyChanged(data: { gold?: number; diamond?: number }): void {
        if (data.gold !== undefined && this.goldLabel) {
            this.goldLabel.string = this.formatNumber(data.gold);
        }
        if (data.diamond !== undefined && this.diamondLabel) {
            this.diamondLabel.string = this.formatNumber(data.diamond);
        }
    }

    /** 体力变化 */
    private onStaminaChanged(data: { stamina: number; maxStamina: number }): void {
        if (this.staminaLabel) {
            this.staminaLabel.string = `${data.stamina}/${data.maxStamina}`;
        }
    }

    /** 展示社交面板 */
    private showSocialPanel(): void {
        EventManager.getInstance().emit(GameEvent.UI_PANEL_OPEN, { name: 'social_panel' });
    }

    /** 展示每日任务 */
    private showDailyQuests(): void {
        EventManager.getInstance().emit(GameEvent.UI_PANEL_OPEN, { name: 'daily_quests' });
    }

    /** 格式化数字显示 */
    private formatNumber(num: number): string {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }

    onDestroy() {
        EventManager.getInstance().off(GameEvent.GOLD_CHANGED, this.onCurrencyChanged, this);
        EventManager.getInstance().off(GameEvent.DIAMOND_CHANGED, this.onCurrencyChanged, this);
        EventManager.getInstance().off(GameEvent.STAMINA_CHANGED, this.onStaminaChanged, this);
    }
}
