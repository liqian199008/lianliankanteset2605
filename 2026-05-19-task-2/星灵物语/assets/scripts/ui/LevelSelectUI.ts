/**
 * 关卡选择UI — 章节/关卡地图、星级展示
 * Level Selection UI — Chapter/level map, star display
 */

import { _decorator, Component, Node, Label, Button, Sprite, Color } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { LevelSystem } from '../systems/LevelSystem';
import { LevelState, LevelDefinition, getAllLevels } from '../data/LevelConfig';

const { ccclass, property } = _decorator;

@ccclass('LevelSelectUI')
export class LevelSelectUI extends Component {
    @property({ type: Node, tooltip: '关卡列表容器' })
    levelContainer: Node | null = null;

    @property({ type: Node, tooltip: '章节信息栏' })
    chapterInfoNode: Node | null = null;

    @property({ type: Label, tooltip: '章节标题' })
    chapterTitle: Label | null = null;

    @property({ type: Label, tooltip: '总星数' })
    totalStarsLabel: Label | null = null;

    @property({ type: Button, tooltip: '返回按钮' })
    backButton: Button | null = null;

    private currentChapter: number = 1;
    private levelSystem: LevelSystem;

    constructor() {
        super();
        this.levelSystem = LevelSystem.getInstance();
    }

    onLoad() {
        this.setupButtons();
    }

    onEnable() {
        this.refreshLevelMap();
    }

    private setupButtons(): void {
        if (this.backButton) {
            this.backButton.node.on(Button.EventType.CLICK, () => {
                EventManager.getInstance().emit(GameEvent.SCENE_TRANSITION, { to: 'MainScene' });
            });
        }
    }

    /** 刷新关卡地图 */
    private refreshLevelMap(): void {
        if (!this.levelContainer) return;

        this.levelContainer.removeAllChildren();

        const chapterLevels = this.levelSystem.getChapterLevels(this.currentChapter);

        // 章节标题
        if (this.chapterTitle) {
            this.chapterTitle.string = `第${this.currentChapter}章 · 星界之旅`;
        }

        // 总星数
        if (this.totalStarsLabel) {
            const totalStars = this.levelSystem.getTotalStars();
            const maxStars = getAllLevels().length * 3;
            this.totalStarsLabel.string = `★ ${totalStars}/${maxStars}`;
        }

        // 创建关卡节点
        for (let i = 0; i < chapterLevels.length; i++) {
            const level = chapterLevels[i];
            const levelNode = this.createLevelNode(level);
            this.levelContainer.addChild(levelNode);
        }
    }

    /** 创建关卡节点 */
    private createLevelNode(level: LevelDefinition): Node {
        const node = new Node(`level_${level.id}`);
        const state = this.levelSystem.getLevelState(level.id);

        // 关卡编号
        const label = node.addComponent(Label);
        label.string = level.isBoss 
            ? `BOSS\n${level.name}`
            : `${level.level}\n${level.name}`;
        label.fontSize = level.isBoss ? 16 : 14;
        label.lineHeight = 22;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;

        // 根据状态设置颜色
        switch (state) {
            case LevelState.LOCKED:
                label.color = new Color(120, 120, 120); // 灰色
                break;
            case LevelState.UNLOCKED:
                label.color = new Color(200, 200, 200); // 白色
                break;
            case LevelState.CLEARED:
                label.color = new Color(255, 215, 0); // 金色
                // 添加星级显示
                const progress = this.levelSystem.getLevelStars(level.id);
                if (progress && progress.stars > 0) {
                    const starLabel = node.addComponent(Label);
                    starLabel.string = '★'.repeat(progress.stars);
                    starLabel.fontSize = 12;
                    starLabel.color = new Color(255, 215, 0);
                }
                break;
        }

        // 点击进入关卡
        if (state !== LevelState.LOCKED) {
            node.on(Node.EventType.TOUCH_END, () => {
                this.onLevelSelected(level.id);
            });
        }

        return node;
    }

    /** 关卡被选中 */
    private onLevelSelected(levelId: string): void {
        const check = this.levelSystem.canEnterLevel(levelId);
        if (!check.canEnter) {
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: check.reason || '无法进入',
                type: 'warning',
            });
            return;
        }

        const levelDef = this.levelSystem.enterLevel(levelId);
        if (levelDef) {
            // 进入战斗场景
            EventManager.getInstance().emit(GameEvent.LEVEL_SELECTED, { levelDef });
            EventManager.getInstance().emit(GameEvent.SCENE_TRANSITION, { to: 'BattleScene' });
        }
    }

    /** 切换章节 */
    switchChapter(delta: number): void {
        const newChapter = this.currentChapter + delta;
        if (newChapter < 1 || newChapter > 8) return;
        
        this.currentChapter = newChapter;
        this.refreshLevelMap();
    }
}
