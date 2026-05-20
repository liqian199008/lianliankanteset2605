/**
 * 事件管理器 — 全局事件总线
 * Event Manager — Global event bus for decoupled communication
 */
type EventCallback = (...args: any[]) => void;

export class EventManager {
    private static _instance: EventManager;
    private _listeners: Map<string, Set<EventCallback>> = new Map();
    private _onceListeners: Map<string, Set<EventCallback>> = new Map();

    static getInstance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    /** 注册事件监听 */
    on(event: string, callback: EventCallback): void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(callback);
    }

    /** 一次性监听 */
    once(event: string, callback: EventCallback): void {
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, new Set());
        }
        this._onceListeners.get(event)!.add(callback);
    }

    /** 移除监听 */
    off(event: string, callback: EventCallback): void {
        this._listeners.get(event)?.delete(callback);
        this._onceListeners.get(event)?.delete(callback);
    }

    /** 触发事件 */
    emit(event: string, ...args: any[]): void {
        // 触发普通监听
        this._listeners.get(event)?.forEach(cb => {
            try {
                cb(...args);
            } catch (e) {
                console.error(`[EventManager] Error in event "${event}":`, e);
            }
        });

        // 触发一次性监听并清理
        const onceSet = this._onceListeners.get(event);
        if (onceSet) {
            onceSet.forEach(cb => {
                try {
                    cb(...args);
                } catch (e) {
                    console.error(`[EventManager] Error in once event "${event}":`, e);
                }
            });
            this._onceListeners.delete(event);
        }
    }

    /** 清空所有监听 */
    clearAll(): void {
        this._listeners.clear();
        this._onceListeners.clear();
    }

    /** 清空指定事件的所有监听 */
    clearEvent(event: string): void {
        this._listeners.delete(event);
        this._onceListeners.delete(event);
    }
}

// ========== 游戏事件常量 ==========

export const GameEvent = {
    // === 棋盘事件 ===
    BOARD_INIT: 'board_init',
    BOARD_UPDATED: 'board_updated',
    GEM_SELECTED: 'gem_selected',
    GEM_SWAPPED: 'gem_swapped',
    MATCH_FOUND: 'match_found',
    MATCH_CLEARED: 'match_cleared',
    GEMS_FALLING: 'gems_falling',
    GEMS_FALL_DONE: 'gems_fall_done',
    NO_MOVE_AVAILABLE: 'no_move_available',

    // === 战斗事件 ===
    BATTLE_START: 'battle_start',
    BATTLE_TURN: 'battle_turn',
    BATTLE_STEP_USED: 'battle_step_used',
    ENERGY_CHANGED: 'energy_changed',
    SKILL_READY: 'skill_ready',         // { characterId }
    SKILL_CAST: 'skill_cast',           // { characterId, skillType }
    SKILL_CAST_DONE: 'skill_cast_done',
    ENEMY_DAMAGED: 'enemy_damaged',
    ENEMY_DEFEATED: 'enemy_defeated',
    ALL_ENEMIES_DEFEATED: 'all_enemies_defeated',
    PLAYER_DAMAGED: 'player_damaged',
    PLAYER_DEFEATED: 'player_defeated',
    BATTLE_VICTORY: 'battle_victory',
    BATTLE_DEFEAT: 'battle_defeat',
    BATTLE_END: 'battle_end',

    // === 关卡事件 ===
    LEVEL_SELECTED: 'level_selected',
    LEVEL_CLEARED: 'level_cleared',

    // === UI事件 ===
    UI_PANEL_OPEN: 'ui_panel_open',
    UI_PANEL_CLOSE: 'ui_panel_close',
    SCENE_TRANSITION: 'scene_transition',
    NOTIFICATION: 'notification',

    // === 系统事件 ===
    GOLD_CHANGED: 'gold_changed',
    DIAMOND_CHANGED: 'diamond_changed',
    STAMINA_CHANGED: 'stamina_changed',
    SAVE_COMPLETE: 'save_complete',
    INVENTORY_UPDATED: 'inventory_updated',
    CHARACTER_UNLOCKED: 'character_unlocked',
    DAILY_RESET: 'daily_reset',
} as const;
