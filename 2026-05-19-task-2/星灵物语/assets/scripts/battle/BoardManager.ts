/**
 * 棋盘管理器 — 管理宝石棋盘的视觉布局、触摸交互
 * Board Manager — Visual management and touch interaction for the gem board
 * 
 * Cocos Creator组件，挂载在Board节点上
 */

import { _decorator, Component, Node, instantiate, Prefab, 
         UITransform, Vec3, Touch, EventTouch, tween, 
         Sprite, Color, v3, Animation, ParticleSystem } from 'cc';
import { BOARD_ROWS, BOARD_COLS, GemColor, GEM_COLOR_HEX, GEM_COLOR_LIGHT } from '../data/GemConfig';
import { MatchLogic, Cell, MatchResult } from './MatchLogic';
import { EventManager, GameEvent } from '../core/EventManager';

const { ccclass, property } = _decorator;

/** 玩家连线状态 */
enum ConnectState {
    IDLE = 0,       // 空闲
    SELECTING = 1,  // 正在连线
}

@ccclass('BoardManager')
export class BoardManager extends Component {
    @property({ type: Prefab, tooltip: '宝石预制体' })
    gemPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '棋盘父节点' })
    boardContainer: Node | null = null;

    @property({ tooltip: '宝石大小' })
    gemSize: number = 80;

    @property({ tooltip: '宝石间距' })
    gemPadding: number = 4;

    // 内部状态
    private matchLogic: MatchLogic;
    private gemNodes: (Node | null)[][] = [];
    private connectState: ConnectState = ConnectState.IDLE;
    private selectedPath: [number, number][] = [];
    private isAnimating: boolean = false;
    private activeTweens: any[] = [];

    constructor() {
        super();
        this.matchLogic = new MatchLogic();
    }

    onLoad() {
        this.initGemNodes();
        this.setupTouchInput();
    }

    /** 初始化宝石节点数组 */
    private initGemNodes(): void {
        this.gemNodes = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
            this.gemNodes[r] = [];
            for (let c = 0; c < BOARD_COLS; c++) {
                this.gemNodes[r][c] = null;
            }
        }
    }

    /** 设置触摸输入 */
    private setupTouchInput(): void {
        if (!this.boardContainer) return;

        this.boardContainer.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.boardContainer.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.boardContainer.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.boardContainer.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /**
     * 使用关卡配置初始化棋盘
     * @param distribution 宝石颜色分布权重
     */
    initBoard(distribution: { color: GemColor; weight: number }[]): void {
        this.matchLogic.initGrid(BOARD_ROWS, BOARD_COLS);
        const grid = this.matchLogic.getGrid();

        // 根据分布权重填充棋盘
        const weightedColors = this.buildWeightedArray(distribution);
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const color = weightedColors[Math.floor(Math.random() * weightedColors.length)];
                grid[r][c] = {
                    row: r, col: c,
                    color,
                    isEmpty: false,
                    isSpecial: false,
                };
            }
        }

        // 确保有可行的消除路径
        while (!this.matchLogic.hasValidMoves()) {
            this.matchLogic.shuffle();
        }

        this.matchLogic.resetCombo();
        this.renderBoard();
        this.connectState = ConnectState.IDLE;
        this.isAnimating = false;
    }

    /** 构建权重数组 */
    private buildWeightedArray(distribution: { color: GemColor; weight: number }[]): GemColor[] {
        const result: GemColor[] = [];
        for (const entry of distribution) {
            for (let i = 0; i < entry.weight; i++) {
                result.push(entry.color);
            }
        }
        return result;
    }

    /** 渲染整个棋盘 */
    renderBoard(): void {
        const grid = this.matchLogic.getGrid();
        const containerWidth = BOARD_COLS * (this.gemSize + this.gemPadding);
        const containerHeight = BOARD_ROWS * (this.gemSize + this.gemPadding);

        // 设置容器尺寸
        if (this.boardContainer) {
            const uiTransform = this.boardContainer.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.width = containerWidth;
                uiTransform.height = containerHeight;
            }
        }

        const startX = -containerWidth / 2 + this.gemSize / 2;
        const startY = -containerHeight / 2 + this.gemSize / 2;

        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const cell = grid[r][c];
                if (!cell || cell.isEmpty) continue;

                let node = this.gemNodes[r]?.[c];
                if (!node) {
                    // 创建新宝石节点
                    if (!this.gemPrefab || !this.boardContainer) continue;
                    node = instantiate(this.gemPrefab);
                    node.name = `gem_${r}_${c}`;
                    this.boardContainer.addChild(node);
                    this.gemNodes[r][c] = node;
                }

                const x = startX + c * (this.gemSize + this.gemPadding);
                const y = startY + r * (this.gemSize + this.gemPadding);
                node.setPosition(new Vec3(x, y, 0));

                // 设置颜色
                this.applyGemVisual(node, cell);
            }
        }
    }

    /** 应用宝石颜色视觉 */
    private applyGemVisual(node: Node, cell: Cell): void {
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const colorHex = GEM_COLOR_HEX[cell.color];
            const color = new Color();
            color.fromHEX(colorHex.substring(1));
            sprite.color = color;
        }

        // 设置节点数据
        node['_gemColor'] = cell.color;
        node['_gemRow'] = cell.row;
        node['_gemCol'] = cell.col;
    }

    /** 根据屏幕坐标获取棋盘位置 */
    private screenToBoard(worldPos: Vec3): { row: number; col: number } | null {
        if (!this.boardContainer) return null;

        const containerPos = this.boardContainer.getWorldPosition();
        const containerWidth = BOARD_COLS * (this.gemSize + this.gemPadding);
        const containerHeight = BOARD_ROWS * (this.gemSize + this.gemPadding);
        
        const startX = containerPos.x - containerWidth / 2;
        const startY = containerPos.y - containerHeight / 2;

        const col = Math.floor((worldPos.x - startX) / (this.gemSize + this.gemPadding));
        const row = Math.floor((worldPos.y - startY) / (this.gemSize + this.gemPadding));

        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
        return { row, col };
    }

    // ========== 触摸事件处理 ==========

    private onTouchStart(event: EventTouch): void {
        if (this.isAnimating) return;

        const pos = event.getUILocation();
        const worldPos = new Vec3(pos.x, pos.y, 0);
        const boardPos = this.screenToBoard(worldPos);
        if (!boardPos) return;

        const { row, col } = boardPos;
        const cell = this.matchLogic.getCell(row, col);
        if (!cell || cell.isEmpty) return;

        this.connectState = ConnectState.SELECTING;
        this.selectedPath = [[row, col]];
        
        // 高亮选中
        this.highlightGem(row, col, true);
        EventManager.getInstance().emit(GameEvent.GEM_SELECTED, { row, col, color: cell.color });
    }

    private onTouchMove(event: EventTouch): void {
        if (this.isAnimating || this.connectState !== ConnectState.SELECTING) return;

        const pos = event.getUILocation();
        const worldPos = new Vec3(pos.x, pos.y, 0);
        const boardPos = this.screenToBoard(worldPos);
        if (!boardPos) return;

        const { row, col } = boardPos;
        const lastPos = this.selectedPath[this.selectedPath.length - 1];

        // 检查是否相邻
        if (row === lastPos[0] && col === lastPos[1]) return; // 同一格
        if (!this.matchLogic.isAdjacent(lastPos[0], lastPos[1], row, col)) return;

        // 检查是否同色
        const firstCell = this.matchLogic.getCell(this.selectedPath[0][0], this.selectedPath[0][1]);
        const currentCell = this.matchLogic.getCell(row, col);
        if (!firstCell || !currentCell || currentCell.color !== firstCell.color) return;

        // 检查是否已选中
        const alreadySelected = this.selectedPath.some(([r, c]) => r === row && c === col);
        if (alreadySelected) {
            // 如果是回退到上一个格子，则移除最后一个
            if (row === this.selectedPath[this.selectedPath.length - 2]?.[0] &&
                col === this.selectedPath[this.selectedPath.length - 2]?.[1]) {
                const last = this.selectedPath.pop()!;
                this.highlightGem(last[0], last[1], false);
                return;
            }
            return;
        }

        // 添加到路径
        this.selectedPath.push([row, col]);
        this.highlightGem(row, col, true);
    }

    private onTouchEnd(_event: EventTouch): void {
        if (this.connectState !== ConnectState.SELECTING) return;
        this.finalizeSelection();
    }

    private onTouchCancel(_event: EventTouch): void {
        if (this.connectState !== ConnectState.SELECTING) return;
        this.finalizeSelection();
    }

    /** 完成连线选择，执行消除 */
    private finalizeSelection(): void {
        this.connectState = ConnectState.IDLE;

        if (this.selectedPath.length < 5) {
            // 不足5个，取消选择
            this.clearHighlights();
            this.selectedPath = [];
            EventManager.getInstance().emit(GameEvent.NOTIFICATION, {
                message: `至少连接${5}个同色宝石！`,
                type: 'warning',
            });
            return;
        }

        // 执行消除
        this.executeMatchSequence(this.selectedPath);
        this.selectedPath = [];
    }

    /** 执行消除序列 */
    private async executeMatchSequence(path: [number, number][]): Promise<void> {
        this.isAnimating = true;

        const result = this.matchLogic.executeMatch(path);
        if (!result) {
            this.isAnimating = false;
            this.clearHighlights();
            return;
        }

        // 播放消除动画
        await this.playMatchAnimation(result);
        
        // 触发事件
        EventManager.getInstance().emit(GameEvent.MATCH_FOUND, result);
        EventManager.getInstance().emit(GameEvent.MATCH_CLEARED, result);

        // 宝石下落
        const fallInfo = this.matchLogic.applyGravity();
        await this.playFallAnimation(fallInfo.fallSteps);
        EventManager.getInstance().emit(GameEvent.GEMS_FALL_DONE);

        // 检查是否有连续消除（连击）
        const chainMatches = this.matchLogic.findMatches();
        if (chainMatches.length > 0) {
            // 递归处理连击消除
            for (const chainPath of chainMatches) {
                await this.executeMatchSequence(chainPath);
            }
        } else {
            this.matchLogic.resetCombo();
        }

        // 检查是否还有可行移动
        if (!this.matchLogic.hasValidMoves()) {
            this.matchLogic.shuffle();
            this.renderBoard();
            EventManager.getInstance().emit(GameEvent.NO_MOVE_AVAILABLE);
        }

        this.isAnimating = false;
        this.clearHighlights();

        // 广播步数消耗
        EventManager.getInstance().emit(GameEvent.BATTLE_STEP_USED, { 
            path, 
            matchResult: result,
            totalScore: this.matchLogic.getTotalScore(),
        });
    }

    // ========== 动画方法 ==========

    /** 播放消除动画 */
    private playMatchAnimation(result: MatchResult): Promise<void> {
        return new Promise((resolve) => {
            for (const cell of result.matchedCells) {
                const node = this.gemNodes[cell.row]?.[cell.col];
                if (!node) continue;

                // 缩放+淡出
                const t = tween(node)
                    .to(0.2, { scale: new Vec3(1.3, 1.3, 1) })
                    .to(0.15, { scale: new Vec3(0, 0, 1), opacity: 0 })
                    .call(() => {
                        // 移除节点
                        node.removeFromParent();
                        this.gemNodes[cell.row][cell.col] = null;
                    })
                    .start();
                this.activeTweens.push(t);
            }

            // 等待动画完成
            setTimeout(resolve, 400);
        });
    }

    /** 播放下落动画 */
    private playFallAnimation(fallSteps: [number, number, number][]): Promise<void> {
        return new Promise((resolve) => {
            if (fallSteps.length === 0) {
                this.renderBoard();
                resolve();
                return;
            }

            // 重建棋盘视觉效果
            this.renderBoard();
            
            // 简单下落效果：从原始位置Y方向移动
            for (const [_fromR, fromC, distance] of fallSteps) {
                // 对新生成的宝石做进入动画
                if (_fromR === -1) {
                    // 找到对应位置的节点
                    for (let r = 0; r < BOARD_ROWS; r++) {
                        const node = this.gemNodes[r]?.[fromC];
                        if (node) {
                            const origY = node.position.y;
                            node.setPosition(node.position.x, origY + distance * (this.gemSize + this.gemPadding), 0);
                            tween(node)
                                .to(0.3, { position: new Vec3(node.position.x, origY, 0) }, { easing: 'bounceOut' })
                                .start();
                            break;
                        }
                    }
                }
            }

            setTimeout(resolve, 350);
        });
    }

    /** 高亮/取消高亮宝石 */
    private highlightGem(row: number, col: number, highlight: boolean): void {
        const node = this.gemNodes[row]?.[col];
        if (!node) return;

        const sprite = node.getComponent(Sprite);
        if (!sprite) return;

        if (highlight) {
            tween(node)
                .to(0.1, { scale: new Vec3(1.15, 1.15, 1) })
                .start();
            sprite.color = new Color(255, 255, 255);
        } else {
            node.setScale(new Vec3(1, 1, 1));
            const cell = this.matchLogic.getCell(row, col);
            if (cell) this.applyGemVisual(node, cell);
        }
    }

    /** 清除所有高亮 */
    private clearHighlights(): void {
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const node = this.gemNodes[r]?.[c];
                if (!node) continue;
                node.setScale(new Vec3(1, 1, 1));
                const cell = this.matchLogic.getCell(r, c);
                if (cell && !cell.isEmpty) this.applyGemVisual(node, cell);
            }
        }
    }

    /** 获取消除逻辑（供BattleController使用） */
    getMatchLogic(): MatchLogic {
        return this.matchLogic;
    }

    onDestroy() {
        // 清理所有tween
        for (const t of this.activeTweens) {
            t.stop();
        }
        this.activeTweens = [];
    }
}
