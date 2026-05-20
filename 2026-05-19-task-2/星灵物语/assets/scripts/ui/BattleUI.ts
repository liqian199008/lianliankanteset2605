/**
 * 战斗UI — 战斗场景中的HUD界面
 * Battle UI — In-battle HUD interface
 */

import { _decorator, Component, Node, Label, Sprite, 
         ProgressBar, Button, Color, Vec3, tween } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';
import { BattleController, BattleCharacter, BattleEnemy, BattlePhase } from '../battle/BattleController';

const { ccclass, property } = _decorator;

@ccclass('BattleUI')
export class BattleUI extends Component {
    // === 敌人区域 ===
    @property({ type: Node, tooltip: '敌人头像' })
    enemyAvatar: Node | null = null;
    @property({ type: Label, tooltip: '敌人名称' })
    enemyName: Label | null = null;
    @property({ type: ProgressBar, tooltip: '敌人血条' })
    enemyHPBar: ProgressBar | null = null;
    @property({ type: Label, tooltip: '敌人血量数值' })
    enemyHPText: Label | null = null;

    // === 步数/信息区域 ===
    @property({ type: Label, tooltip: '剩余步数' })
    stepsLabel: Label | null = null;
    @property({ type: Label, tooltip: '得分' })
    scoreLabel: Label | null = null;
    @property({ type: Label, tooltip: '连击数' })
    comboLabel: Label | null = null;

    // === 角色头像区域 ===
    @property({ type: [Node], tooltip: '4个角色头像节点' })
    characterSlots: Node[] = [];
    @property({ type: [ProgressBar], tooltip: '角色能量条' })
    energyBars: ProgressBar[] = [];
    @property({ type: [Label], tooltip: '角色血量数值' })
    hpLabels: Label[] = [];

    // === 控制按钮 ===
    @property({ type: Button, tooltip: '暂停按钮' })
    pauseButton: Button | null = null;

    // 内部状态
    private battleController: BattleController | null = null;
    private currentCombo: number = 0;
    private comboPopupNode: Node | null = null;

    onLoad() {
        this.registerEvents();
    }

    /** 设置战斗控制器引用 */
    setBattleController(bc: BattleController): void {
        this.battleController = bc;
        this.refreshUI();
    }

    /** 注册事件监听 */
    private registerEvents(): void {
        EventManager.getInstance().on(GameEvent.MATCH_FOUND, this.onMatchFound, this);
        EventManager.getInstance().on(GameEvent.MATCH_CLEARED, this.onMatchCleared, this);
        EventManager.getInstance().on(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged, this);
        EventManager.getInstance().on(GameEvent.ENERGY_CHANGED, this.onEnergyChanged, this);
        EventManager.getInstance().on(GameEvent.BATTLE_STEP_USED, this.onStepUsed, this);
        EventManager.getInstance().on(GameEvent.BATTLE_VICTORY, this.onBattleVictory, this);
        EventManager.getInstance().on(GameEvent.BATTLE_DEFEAT, this.onBattleDefeat, this);
    }

    /** 刷新整个UI */
    refreshUI(): void {
        if (!this.battleController) return;

        const enemies = this.battleController.getEnemies();
        const team = this.battleController.getTeam();

        this.updateEnemyInfo(enemies);
        this.updateTeamInfo(team);
        this.updateSteps();
        this.updateScore(0);
    }

    // ========== 敌人信息 ==========

    private updateEnemyInfo(enemies: BattleEnemy[]): void {
        if (enemies.length === 0) return;

        const enemy = enemies[0]; // 显示第一个敌人
        if (this.enemyName) this.enemyName.string = enemy.name;
        if (this.enemyHPBar) {
            this.enemyHPBar.progress = enemy.hp / enemy.maxHP;
            // 血条颜色随血量变化
            if (enemy.hp / enemy.maxHP < 0.3) {
                this.enemyHPBar['barSprite']?.color?.set(Color.RED);
            }
        }
        if (this.enemyHPText) {
            this.enemyHPText.string = `${enemy.hp}/${enemy.maxHP}`;
        }
    }

    /** 敌人受伤动画效果 */
    private onEnemyDamaged(data: { enemyIndex: number; damage: number; remainingHP: number; maxHP: number }): void {
        if (!this.battleController) return;

        const enemies = this.battleController.getEnemies();
        if (data.enemyIndex < 0 || data.enemyIndex >= enemies.length) return;

        const enemy = enemies[data.enemyIndex];
        this.updateEnemyInfo([enemy]);

        // 血量数字飘字效果
        if (data.damage > 0) {
            this.showDamageNumber(data.damage);
        }
    }

    /** 显示伤害数字飘出 */
    private showDamageNumber(damage: number): void {
        // [PLACEHOLDER] 使用预制体展示伤害数字
        if (this.enemyAvatar) {
            const node = new Node('DamageNumber');
            node.setParent(this.enemyAvatar);
            const label = node.addComponent(Label);
            label.string = `-${damage}`;
            label.fontSize = 36;
            label.color = new Color(255, 50, 50);

            tween(node)
                .to(0.8, { position: new Vec3(0, 80, 0), opacity: 0 })
                .call(() => node.destroy())
                .start();
        }
    }

    // ========== 队伍信息 ==========

    private updateTeamInfo(team: BattleCharacter[]): void {
        for (let i = 0; i < this.characterSlots.length; i++) {
            if (i >= team.length) {
                this.characterSlots[i]?.setActive(false);
                continue;
            }

            const char = team[i];
            this.characterSlots[i]?.setActive(true);

            // 更新HP
            if (this.hpLabels[i]) {
                this.hpLabels[i].string = `${char.hp}`;
            }

            // 更新能量条
            if (this.energyBars[i]) {
                this.energyBars[i].progress = char.energy / char.maxEnergy;
            }

            // 大招就绪特效
            if (char.skillUltimateReady) {
                this.characterSlots[i]?.getChildByName('UltimateReady')?.setActive(true);
            } else {
                this.characterSlots[i]?.getChildByName('UltimateReady')?.setActive(false);
            }
        }
    }

    /** 能量变化更新 */
    private onEnergyChanged(data: { characterId: string; energy: number; maxEnergy: number }): void {
        if (!this.battleController) return;

        const team = this.battleController.getTeam();
        const index = team.findIndex(c => c.id === data.characterId);
        if (index < 0 || index >= this.energyBars.length) return;

        this.energyBars[index].progress = data.energy / data.maxEnergy;
    }

    // ========== 步数与得分 ==========

    private updateSteps(): void {
        if (!this.battleController) return;
        if (this.stepsLabel) {
            this.stepsLabel.string = `${this.battleController.getRemainingSteps()}`;
            
            // 步数不足时闪烁红色
            if (this.battleController.getRemainingSteps() <= 5) {
                this.stepsLabel.color = new Color(255, 50, 50);
            }
        }
    }

    private onStepUsed(data: any): void {
        this.updateSteps();
        this.updateScore(data.matchResult?.scoreGained || 0);
    }

    private updateScore(addedScore: number): void {
        if (!this.battleController) return;
        if (this.scoreLabel) {
            // [PLACEHOLDER] 总分需要通过事件累计
        }
    }

    // ========== 连击效果 ==========

    private onMatchFound(_data: any): void {
        // 匹配产生，准备连击
    }

    private onMatchCleared(_data: any): void {
        // 由MatchLogic内部处理连击显示
        this.showComboEffect();
    }

    private showComboEffect(): void {
        if (!this.comboLabel) return;

        this.currentCombo++;
        this.comboLabel.string = `连击 x${this.currentCombo}`;
        this.comboLabel.node.setScale(new Vec3(0.5, 0.5, 1));

        tween(this.comboLabel.node)
            .to(0.2, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.5, { scale: new Vec3(1, 1, 1) })
            .delay(1)
            .to(0.2, { scale: new Vec3(0.5, 0.5, 1) })
            .call(() => {
                this.comboLabel.string = '';
                this.currentCombo = 0;
            })
            .start();
    }

    // ========== 战斗结果 ==========

    private onBattleVictory(data: any): void {
        // 显示胜利面板（由专门的胜利UI处理）
        EventManager.getInstance().emit(GameEvent.UI_PANEL_OPEN, { name: 'victory_panel', data });
    }

    private onBattleDefeat(): void {
        EventManager.getInstance().emit(GameEvent.UI_PANEL_OPEN, { name: 'defeat_panel' });
    }

    onDestroy() {
        EventManager.getInstance().off(GameEvent.MATCH_FOUND, this.onMatchFound, this);
        EventManager.getInstance().off(GameEvent.MATCH_CLEARED, this.onMatchCleared, this);
        EventManager.getInstance().off(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged, this);
        EventManager.getInstance().off(GameEvent.ENERGY_CHANGED, this.onEnergyChanged, this);
        EventManager.getInstance().off(GameEvent.BATTLE_STEP_USED, this.onStepUsed, this);
        EventManager.getInstance().off(GameEvent.BATTLE_VICTORY, this.onBattleVictory, this);
        EventManager.getInstance().off(GameEvent.BATTLE_DEFEAT, this.onBattleDefeat, this);
    }
}
