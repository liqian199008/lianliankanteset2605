/**
 * 匹配消除算法 — 核心消除逻辑
 * Match Logic — Core matching and clearing algorithm
 * 
 * 消除规则:
 * - 玩家通过连线选择相邻同色宝石
 * - 连接 ≥ 5 个同色宝石形成消除链
 * - 消除后宝石下落填补空缺
 * - 检查并连续消除（连击）
 */

import { GemColor, 
         BOARD_ROWS, BOARD_COLS, 
         MIN_MATCH_COUNT,
         ENERGY_PER_GEM, 
         LONG_CHAIN_THRESHOLD, 
         LONG_CHAIN_ENERGY_MULTIPLIER,
         SCORE_PER_GEM } from '../data/GemConfig';

/** 棋盘上的单个格子 */
export interface Cell {
    row: number;
    col: number;
    color: GemColor;
    isEmpty: boolean;
    isSpecial: boolean;     // 是否为特殊宝石
    specialType?: string;   // 'bomb' | 'rainbow' | 'frozen' | 'dark' | 'locked'
    frozenCount?: number;   // 冰封层数（需要消除次数）
    lockedCount?: number;   // 锁定剩余消除次数
}

/** 消除结果 */
export interface MatchResult {
    matchedCells: Cell[];           // 被消除的格子
    matchedColor: GemColor;         // 消除的颜色
    matchCount: number;             // 消除数量
    energyGained: number;           // 产生的能量
    scoreGained: number;            // 得分
    isLongChain: boolean;           // 是否触发长链奖励
    comboCount: number;             // 当前连击数
    specialEffects: SpecialEffect[]; // 特殊效果（炸弹等）
}

/** 特殊效果类型 */
export interface SpecialEffect {
    type: 'bomb_explosion' | 'rainbow_clear' | 'frozen_break' | 'dark_drain' | 'lock_break';
    affectedCells: Cell[];
    value?: number;
}

/** 棋盘状态快照（用于存档和回放） */
export interface BoardState {
    grid: number[][]; // row x col, -1=空, 0-4=颜色
    specials: string[][]; // 特殊格子标记
}

export class MatchLogic {
    private grid: Cell[][] = [];
    private comboCount = 0;
    private totalScore = 0;
    private totalEnergy: Record<number, number> = {};

    constructor() {
        this.initGrid(BOARD_ROWS, BOARD_COLS);
    }

    /** 初始化空棋盘 */
    initGrid(rows: number, cols: number): void {
        this.grid = [];
        for (let r = 0; r < rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < cols; c++) {
                this.grid[r][c] = {
                    row: r, col: c,
                    color: GemColor.FIRE,
                    isEmpty: true,
                    isSpecial: false,
                };
            }
        }
        this.comboCount = 0;
        this.totalScore = 0;
        this.totalEnergy = {};
    }

    /** 获取棋盘当前网格 */
    getGrid(): Cell[][] {
        return this.grid;
    }

    /** 设置棋盘网格（从外部初始化） */
    setGrid(grid: Cell[][]): void {
        this.grid = grid;
    }

    /** 获取某个格子 */
    getCell(row: number, col: number): Cell | null {
        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
        return this.grid[row][col];
    }

    /** 检查两个格子是否相邻（上下左右） */
    isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
        const dr = Math.abs(r1 - r2);
        const dc = Math.abs(c1 - c2);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    /**
     * 验证一条连线是否合法
     * @param path 连线经过的格子坐标数组 [(r,c), ...]
     * @returns 是否可消除
     */
    validatePath(path: [number, number][]): { valid: boolean; reason?: string } {
        if (path.length < MIN_MATCH_COUNT) {
            return { valid: false, reason: `至少需要${MIN_MATCH_COUNT}个同色宝石` };
        }

        const firstCell = this.grid[path[0][0]]?.[path[0][1]];
        if (!firstCell || firstCell.isEmpty) {
            return { valid: false, reason: '起始位置为空' };
        }

        const targetColor = firstCell.color;

        // 验证每个格子是否相邻且同色
        for (let i = 0; i < path.length; i++) {
            const [r, c] = path[i];
            const cell = this.grid[r]?.[c];
            if (!cell || cell.isEmpty || cell.color !== targetColor) {
                return { valid: false, reason: `位置(${r},${c})不符合条件` };
            }
            // 检查相邻（从第二个开始）
            if (i > 0) {
                const [pr, pc] = path[i - 1];
                if (!this.isAdjacent(pr, pc, r, c)) {
                    return { valid: false, reason: `位置(${r},${c})与上一个不相邻` };
                }
            }
        }

        // 检查是否有重复格子
        const visited = new Set<string>();
        for (const [r, c] of path) {
            const key = `${r},${c}`;
            if (visited.has(key)) {
                return { valid: false, reason: '路径不能重复经过同一格子' };
            }
            visited.add(key);
        }

        return { valid: true };
    }

    /**
     * 执行消除 — 消除连线上的所有格子
     * @param path 连线路径
     * @returns 消除结果
     */
    executeMatch(path: [number, number][]): MatchResult | null {
        const validation = this.validatePath(path);
        if (!validation.valid) {
            console.warn('[MatchLogic] Invalid path:', validation.reason);
            return null;
        }

        const firstCell = this.grid[path[0][0]][path[0][1]];
        const color = firstCell.color;
        const count = path.length;

        // 收集被消除的格子
        const matchedCells: Cell[] = [];
        const specialEffects: SpecialEffect[] = [];

        for (const [r, c] of path) {
            const cell = this.grid[r][c];
            matchedCells.push({ ...cell });

            // 处理特殊宝石
            if (cell.isSpecial) {
                const sfx = this.handleSpecialGem(cell);
                if (sfx) specialEffects.push(sfx);
            }

            // 标记为空
            this.grid[r][c] = {
                row: r, col: c,
                color: GemColor.FIRE,
                isEmpty: true,
                isSpecial: false,
            };
        }

        // 计算能量和得分
        let energyGained = count * ENERGY_PER_GEM;
        const isLongChain = count >= LONG_CHAIN_THRESHOLD;
        if (isLongChain) {
            energyGained = Math.floor(energyGained * LONG_CHAIN_ENERGY_MULTIPLIER);
        }

        this.comboCount++;
        const comboMultiplier = 1 + (this.comboCount - 1) * 0.25; // 连击加成
        const scoreGained = Math.floor(count * SCORE_PER_GEM * comboMultiplier);
        this.totalScore += scoreGained;

        const result: MatchResult = {
            matchedCells,
            matchedColor: color,
            matchCount: count,
            energyGained,
            scoreGained,
            isLongChain,
            comboCount: this.comboCount,
            specialEffects,
        };

        return result;
    }

    /**
     * 宝石下落 — 消除后填补空位
     * @returns 下落后的变化信息
     */
    applyGravity(): { fallSteps: [number, number, number][] } {
        // fallSteps: [fromRow, fromCol, distance]
        const fallSteps: [number, number, number][] = [];

        for (let c = 0; c < BOARD_COLS; c++) {
            let writeRow = BOARD_ROWS - 1;

            // 从下往上扫描
            for (let r = BOARD_ROWS - 1; r >= 0; r--) {
                if (!this.grid[r][c].isEmpty) {
                    if (r !== writeRow) {
                        // 移动宝石到空位
                        this.grid[writeRow][c] = { ...this.grid[r][c], row: writeRow, col: c };
                        this.grid[r][c] = {
                            row: r, col: c,
                            color: GemColor.FIRE,
                            isEmpty: true,
                            isSpecial: false,
                        };
                        fallSteps.push([r, c, writeRow - r]);
                    }
                    writeRow--;
                }
            }

            // 顶部空位填充新宝石
            for (let r = writeRow; r >= 0; r--) {
                const newColor = this.randomColor();
                this.grid[r][c] = {
                    row: r, col: c,
                    color: newColor,
                    isEmpty: false,
                    isSpecial: false,
                };
                fallSteps.push([-1, c, r + 1]); // -1表示新生成
            }
        }

        return { fallSteps };
    }

    /**
     * 检测棋盘上是否存在可消除组合
     * 用于后续连击检测和死局检测
     */
    findMatches(): [number, number][][] {
        const matches: [number, number][][] = [];

        // 水平方向检测
        for (let r = 0; r < BOARD_ROWS; r++) {
            let start = 0;
            for (let c = 1; c <= BOARD_COLS; c++) {
                if (c < BOARD_COLS && 
                    !this.grid[r][c].isEmpty && 
                    this.grid[r][c].color === this.grid[r][start].color) {
                    continue;
                }
                const length = c - start;
                if (length >= MIN_MATCH_COUNT && !this.grid[r][start].isEmpty) {
                    const match: [number, number][] = [];
                    for (let i = start; i < c; i++) {
                        match.push([r, i]);
                    }
                    matches.push(match);
                }
                start = c;
            }
        }

        // 垂直方向检测
        for (let c = 0; c < BOARD_COLS; c++) {
            let start = 0;
            for (let r = 1; r <= BOARD_ROWS; r++) {
                if (r < BOARD_ROWS && 
                    !this.grid[r][c].isEmpty && 
                    this.grid[r][c].color === this.grid[start][c].color) {
                    continue;
                }
                const length = r - start;
                if (length >= MIN_MATCH_COUNT && !this.grid[start][c].isEmpty) {
                    const match: [number, number][] = [];
                    for (let i = start; i < r; i++) {
                        match.push([i, c]);
                    }
                    matches.push(match);
                }
                start = r;
            }
        }

        return matches;
    }

    /**
     * 检查是否还有可行的消除路径
     * BFS搜索所有可能的5连路径
     */
    hasValidMoves(): boolean {
        // 为每个起点，寻找最长同色路径
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const cell = this.grid[r][c];
                if (cell.isEmpty) continue;
                
                const visited = new Set<string>();
                const longest = this.dfsLongestPath(r, c, cell.color, visited);
                if (longest >= MIN_MATCH_COUNT) return true;
            }
        }
        return false;
    }

    /** DFS搜索最长同色连续路径 */
    private dfsLongestPath(r: number, c: number, color: GemColor, visited: Set<string>): number {
        const key = `${r},${c}`;
        if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return 0;
        if (visited.has(key)) return 0;
        
        const cell = this.grid[r][c];
        if (cell.isEmpty || cell.color !== color) return 0;

        visited.add(key);
        let maxLength = 1;

        const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        for (const [dr, dc] of dirs) {
            maxLength = Math.max(maxLength, 
                1 + this.dfsLongestPath(r + dr, c + dc, color, new Set(visited)));
        }

        return maxLength;
    }

    /**
     * 处理特殊宝石效果
     */
    private handleSpecialGem(cell: Cell): SpecialEffect | null {
        switch (cell.specialType) {
            case 'bomb':
                return this.explodeBomb(cell);
            case 'rainbow':
                return this.clearRainbow(cell);
            case 'frozen':
                return { type: 'frozen_break', affectedCells: [cell] };
            case 'dark':
                return { type: 'dark_drain', affectedCells: [cell], value: 5 };
            case 'locked':
                return { type: 'lock_break', affectedCells: [cell] };
            default:
                return null;
        }
    }

    /** 炸弹爆炸：清除周围3x3 */
    private explodeBomb(cell: Cell): SpecialEffect {
        const affected: Cell[] = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = cell.row + dr;
                const nc = cell.col + dc;
                const neighbor = this.getCell(nr, nc);
                if (neighbor && !neighbor.isEmpty) {
                    affected.push({ ...neighbor });
                    this.grid[nr][nc].isEmpty = true;
                }
            }
        }
        return { type: 'bomb_explosion', affectedCells: affected };
    }

    /** 彩虹清除：清除全盘同色（待扩展） */
    private clearRainbow(cell: Cell): SpecialEffect {
        return { type: 'rainbow_clear', affectedCells: [cell] };
    }

    /** 洗牌 — 在无路可走时重新排列棋盘 */
    shuffle(): void {
        const colors: GemColor[] = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                if (!this.grid[r][c].isEmpty) {
                    colors.push(this.grid[r][c].color);
                }
            }
        }

        // Fisher-Yates 洗牌
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }

        let idx = 0;
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                if (!this.grid[r][c].isEmpty) {
                    this.grid[r][c].color = colors[idx++];
                }
            }
        }
    }

    /** 重置连击计数 */
    resetCombo(): void {
        this.comboCount = 0;
    }

    /** 获取当前连击数 */
    getComboCount(): number {
        return this.comboCount;
    }

    /** 获取总分 */
    getTotalScore(): number {
        return this.totalScore;
    }

    /** 随机生成一个宝石颜色 */
    private randomColor(): GemColor {
        return Math.floor(Math.random() * 5) as GemColor;
    }

    /** 导出棋盘状态 */
    exportState(): BoardState {
        const grid: number[][] = [];
        const specials: string[][] = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
            grid[r] = [];
            specials[r] = [];
            for (let c = 0; c < BOARD_COLS; c++) {
                const cell = this.grid[r][c];
                grid[r][c] = cell.isEmpty ? -1 : cell.color;
                specials[r][c] = cell.isSpecial ? cell.specialType || '' : '';
            }
        }
        return { grid, specials };
    }
}
