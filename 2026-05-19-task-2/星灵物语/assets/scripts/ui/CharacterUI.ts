/**
 * 角色UI — 角色列表、详情、养成操作
 * Character UI — Character list, detail, cultivation actions
 */

import { _decorator, Component, Node, Label, Button, 
         ProgressBar, Sprite, Color, tween, Vec3 } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { GameManager, OwnedCharacter } from '../core/GameManager';
import { CultivationSystem } from '../systems/CultivationSystem';
import { INITIAL_CHARACTERS, RARITY_COLORS, RARITY_NAMES } from '../data/CharacterConfig';

const { ccclass, property } = _decorator;

@ccclass('CharacterUI')
export class CharacterUI extends Component {
    @property({ type: Node, tooltip: '角色列表容器' })
    characterListContainer: Node | null = null;

    @property({ type: Node, tooltip: '角色详情面板' })
    detailPanel: Node | null = null;

    @property({ type: Label, tooltip: '角色名称' })
    charNameLabel: Label | null = null;
    @property({ type: Label, tooltip: '角色等级' })
    charLevelLabel: Label | null = null;
    @property({ type: Label, tooltip: '角色稀有度' })
    charRarityLabel: Label | null = null;
    @property({ type: ProgressBar, tooltip: '经验条' })
    expBar: ProgressBar | null = null;
    @property({ type: Label, tooltip: '攻击力' })
    attackLabel: Label | null = null;
    @property({ type: Label, tooltip: '生命值' })
    hpLabel: Label | null = null;
    @property({ type: Label, tooltip: '防御力' })
    defenseLabel: Label | null = null;
    @property({ type: Label, tooltip: '好感度等级' })
    affinityLabel: Label | null = null;

    @property({ type: Button, tooltip: '突破按钮' })
    breakthroughButton: Button | null = null;
    @property({ type: Button, tooltip: '升级按钮' })
    levelUpButton: Button | null = null;
    @property({ type: Button, tooltip: '技能升级' })
    skillUpButton: Button | null = null;

    private selectedCharacterId: string | null = null;

    onLoad() {
        this.setupButtons();
    }

    onEnable() {
        this.refreshCharacterList();
    }

    private setupButtons(): void {
        if (this.breakthroughButton) {
            this.breakthroughButton.node.on(Button.EventType.CLICK, () => {
                this.onBreakthrough();
            });
        }
        if (this.levelUpButton) {
            this.levelUpButton.node.on(Button.EventType.CLICK, () => {
                this.onLevelUp();
            });
        }
        if (this.skillUpButton) {
            this.skillUpButton.node.on(Button.EventType.CLICK, () => {
                this.onSkillUp();
            });
        }
    }

    /** 刷新角色列表 */
    private refreshCharacterList(): void {
        if (!this.characterListContainer) return;

        // 清空现有列表
        this.characterListContainer.removeAllChildren();

        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        // 为每个角色创建列表项
        for (const ownedChar of playerData.ownedCharacters) {
            const template = INITIAL_CHARACTERS.find(c => c.id === ownedChar.templateId);
            if (!template) continue;

            const itemNode = this.createCharacterListItem(ownedChar, template);
            this.characterListContainer.addChild(itemNode);
        }
    }

    /** 创建角色列表项 */
    private createCharacterListItem(ownedChar: OwnedCharacter, template: any): Node {
        const node = new Node(`char_${ownedChar.instanceId}`);

        // 名称标签
        const nameLabel = node.addComponent(Label);
        nameLabel.string = `[${RARITY_NAMES[template.rarity]}] ${template.name}  Lv.${ownedChar.level}`;
        nameLabel.fontSize = 20;
        nameLabel.lineHeight = 40;

        // 点击选择该角色
        node.on(Node.EventType.TOUCH_END, () => {
            this.selectCharacter(ownedChar.instanceId);
        });

        return node;
    }

    /** 选择角色查看详情 */
    private selectCharacter(instanceId: string): void {
        this.selectedCharacterId = instanceId;
        this.showCharacterDetail(instanceId);
    }

    /** 显示角色详情 */
    private showCharacterDetail(instanceId: string): void {
        if (!this.detailPanel) return;

        this.detailPanel.setActive(true);

        const gm = GameManager.getInstance();
        if (!gm) return;

        const playerData = gm.getPlayerData();
        if (!playerData) return;

        const ownedChar = playerData.ownedCharacters.find(c => c.instanceId === instanceId);
        if (!ownedChar) return;

        const template = INITIAL_CHARACTERS.find(c => c.id === ownedChar.templateId);
        if (!template) return;

        if (this.charNameLabel) {
            this.charNameLabel.string = template.name;
            const color = RARITY_COLORS[template.rarity];
            this.charNameLabel.color = new Color().fromHEX(color.substring(1));
        }
        if (this.charLevelLabel) this.charLevelLabel.string = `Lv.${ownedChar.level}`;
        if (this.charRarityLabel) this.charRarityLabel.string = RARITY_NAMES[template.rarity];

        // 属性值
        const cultivation = CultivationSystem.getInstance();
        const stats = cultivation.getCalculatedStats(ownedChar);
        if (stats) {
            if (this.attackLabel) this.attackLabel.string = `${stats.attack}`;
            if (this.hpLabel) this.hpLabel.string = `${stats.hp}`;
            if (this.defenseLabel) this.defenseLabel.string = `${stats.defense}`;
        }

        // 经验条
        const levelInfo = cultivation.getLevelInfo(ownedChar);
        if (this.expBar) {
            if (levelInfo.isMaxLevel) {
                this.expBar.progress = 1;
            } else {
                this.expBar.progress = levelInfo.currentExp / levelInfo.expToNext;
            }
        }

        // 好感度
        if (this.affinityLabel) {
            this.affinityLabel.string = `好感度 Lv.${cultivation.getAffinityLevel(ownedChar.affinity)}`;
        }

        // 入口动画
        this.detailPanel.setScale(new Vec3(0.8, 0.8, 1));
        tween(this.detailPanel)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    /** 突破操作 */
    private onBreakthrough(): void {
        if (!this.selectedCharacterId) return;

        const cultivation = CultivationSystem.getInstance();
        const result = cultivation.performBreakthrough(this.selectedCharacterId);

        if (!result || !result.success) {
            const check = cultivation.canBreakthrough(this.selectedCharacterId);
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: check.reason || '突破失败',
                type: 'warning',
            });
            return;
        }

        EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
            message: `突破成功！当前突破${result.newBreakthrough}阶`,
            type: 'success',
        });
        this.showCharacterDetail(this.selectedCharacterId);
    }

    /** 升级操作 */
    private onLevelUp(): void {
        if (!this.selectedCharacterId) return;

        const cultivation = CultivationSystem.getInstance();
        const result = cultivation.addExp(this.selectedCharacterId, 100); // [PLACEHOLDER] 使用消耗品

        if (result && result.leveledUp) {
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: `升级！当前Lv.${result.newLevel}`,
                type: 'success',
            });
            this.showCharacterDetail(this.selectedCharacterId);
            this.refreshCharacterList();
        }
    }

    /** 技能升级 */
    private onSkillUp(): void {
        if (!this.selectedCharacterId) return;

        const cultivation = CultivationSystem.getInstance();
        const result = cultivation.upgradeSkill(this.selectedCharacterId);

        if (result.success) {
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: `技能升级成功！Lv.${result.newLevel}`,
                type: 'success',
            });
        } else {
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: '技能已达最高等级',
                type: 'warning',
            });
        }
    }
}
