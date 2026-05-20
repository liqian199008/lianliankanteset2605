/**
 * 存档系统 — 保存/加载游戏数据，支持微信云存储
 * Save System — Persistent storage with WeChat cloud backup
 */

// 微信小游戏API类型声明
declare const wx: any;

export class SaveSystem {
    private static readonly SAVE_KEY_PREFIX = 'spirit_save_';
    private static readonly CLOUD_COLLECTION = 'player_saves';
    private static autoSaveInterval: number = 60; // 秒

    private static _instance: SaveSystem;
    private saveTimer: number | null = null;
    private isCloudEnabled: boolean = false;

    static getInstance(): SaveSystem {
        if (!this._instance) {
            this._instance = new SaveSystem();
        }
        return this._instance;
    }

    /** 初始化存档系统 */
    async init(): Promise<void> {
        // 检查微信云开发是否可用
        if (typeof wx !== 'undefined' && wx.cloud) {
            try {
                await wx.cloud.init({ env: wx.env?.CLOUD_ENV || 'dev' });
                this.isCloudEnabled = true;
                console.log('[SaveSystem] WeChat Cloud initialized');
            } catch (e) {
                console.warn('[SaveSystem] WeChat Cloud not available, using local storage only');
            }
        }
    }

    /** 设置自动保存间隔（秒） */
    setAutoSaveInterval(seconds: number): void {
        this.autoSaveInterval = seconds;
    }

    /** 开始自动保存 */
    startAutoSave(getDataFn: () => any): void {
        if (this.saveTimer) return;
        this.saveTimer = window.setInterval(() => {
            const data = getDataFn();
            if (data) {
                this.saveLocally('auto', data);
            }
        }, this.autoSaveInterval * 1000);
    }

    /** 停止自动保存 */
    stopAutoSave(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }
    }

    // ========== 本地存储 ==========

    /** 保存到本地 */
    saveLocally(slot: string, data: any): boolean {
        try {
            const key = SaveSystem.SAVE_KEY_PREFIX + slot;
            const jsonStr = JSON.stringify({
                data,
                timestamp: Date.now(),
                version: '1.0.0',
            });

            if (typeof wx !== 'undefined' && wx.setStorageSync) {
                wx.setStorageSync(key, jsonStr);
            } else if (typeof sys !== 'undefined' && sys.localStorage) {
                sys.localStorage.setItem(key, jsonStr);
            }
            return true;
        } catch (e) {
            console.error('[SaveSystem] Local save failed:', e);
            return false;
        }
    }

    /** 从本地读取 */
    loadLocally(slot: string): any | null {
        try {
            const key = SaveSystem.SAVE_KEY_PREFIX + slot;
            let jsonStr: string | null = null;

            if (typeof wx !== 'undefined' && wx.getStorageSync) {
                jsonStr = wx.getStorageSync(key);
            } else if (typeof sys !== 'undefined' && sys.localStorage) {
                jsonStr = sys.localStorage.getItem(key);
            }

            if (!jsonStr) return null;

            const parsed = JSON.parse(jsonStr);
            return parsed.data;
        } catch (e) {
            console.error('[SaveSystem] Local load failed:', e);
            return null;
        }
    }

    /** 删除本地存档 */
    deleteLocalSave(slot: string): void {
        const key = SaveSystem.SAVE_KEY_PREFIX + slot;
        if (typeof wx !== 'undefined' && wx.removeStorageSync) {
            wx.removeStorageSync(key);
        } else if (typeof sys !== 'undefined' && sys.localStorage) {
            sys.localStorage.removeItem(key);
        }
    }

    // ========== 微信云存储 ==========

    /** 上传存档到云端 */
    async uploadToCloud(playerId: string, data: any): Promise<boolean> {
        if (!this.isCloudEnabled) return false;

        try {
            // 使用微信云数据库
            const db = wx.cloud.database();
            const collection = db.collection(SaveSystem.CLOUD_COLLECTION);

            await collection.doc(playerId).set({
                data: data,
                updateTime: Date.now(),
            });

            console.log('[SaveSystem] Cloud save uploaded');
            return true;
        } catch (e) {
            console.error('[SaveSystem] Cloud save failed:', e);
            return false;
        }
    }

    /** 从云端下载存档 */
    async downloadFromCloud(playerId: string): Promise<any | null> {
        if (!this.isCloudEnabled) return null;

        try {
            const db = wx.cloud.database();
            const collection = db.collection(SaveSystem.CLOUD_COLLECTION);

            const result = await collection.doc(playerId).get();
            return result.data?.data || null;
        } catch (e) {
            console.error('[SaveSystem] Cloud load failed:', e);
            return null;
        }
    }

    /** 同步存档：本地 → 云 */
    async syncToCloud(playerId: string, getLocalFn: () => any): Promise<boolean> {
        const localData = getLocalFn();
        if (!localData) return false;

        // 先上传
        const success = await this.uploadToCloud(playerId, localData);
        return success;
    }

    /** 同步存档：云 → 本地 */
    async syncFromCloud(playerId: string, saveLocallyFn: (data: any) => void): Promise<boolean> {
        const cloudData = await this.downloadFromCloud(playerId);
        if (!cloudData) return false;

        saveLocallyFn(cloudData);
        return true;
    }

    // ========== 存档槽管理 ==========

    /** 获取所有存档槽信息 */
    getSaveSlots(): string[] {
        const slots: string[] = [];
        const prefix = SaveSystem.SAVE_KEY_PREFIX;

        if (typeof wx !== 'undefined' && wx.getStorageInfoSync) {
            const info = wx.getStorageInfoSync();
            for (const key of info.keys) {
                if (key.startsWith(prefix)) {
                    slots.push(key.replace(prefix, ''));
                }
            }
        } else if (typeof sys !== 'undefined' && sys.localStorage) {
            // 遍历所有localStorage键
            for (let i = 0; i < sys.localStorage.length; i++) {
                const key = sys.localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    slots.push(key.replace(prefix, ''));
                }
            }
        }

        return slots;
    }

    /** 获取存档总大小（KB） */
    getSaveSize(): number {
        let totalSize = 0;
        const slots = this.getSaveSlots();
        for (const slot of slots) {
            const data = this.loadLocally(slot);
            if (data) {
                totalSize += JSON.stringify(data).length;
            }
        }
        return Math.round(totalSize / 1024);
    }

    /** 清除所有存档 */
    clearAllSaves(): void {
        const slots = this.getSaveSlots();
        for (const slot of slots) {
            this.deleteLocalSave(slot);
        }
    }
}
