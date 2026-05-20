/**
 * 资源管理器 — 预加载、缓存、分包
 * Resource Manager — Preloading, caching, subpackage management
 */

import { _decorator, Component, resources, assetManager, Asset, SpriteAtlas, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

interface LoadTask {
    path: string;
    type: typeof Asset;
    priority: number;
    onComplete?: () => void;
}

@ccclass('ResourceManager')
export class ResourceManager extends Component {
    private static _instance: ResourceManager;
    private cache: Map<string, any> = new Map();
    private loadQueue: LoadTask[] = [];
    private isLoading: boolean = false;

    static getInstance(): ResourceManager | null {
        return this._instance;
    }

    onLoad() {
        if (ResourceManager._instance) {
            this.destroy();
            return;
        }
        ResourceManager._instance = this;
    }

    /** 预加载关键资源 */
    preloadEssential(): void {
        const essentials = [
            { path: 'textures/ui', type: SpriteAtlas },
            { path: 'textures/gems', type: SpriteAtlas },
            { path: 'textures/characters', type: SpriteAtlas },
        ];

        for (const item of essentials) {
            this.load(item.path, item.type);
        }
    }

    /** 加载资源 */
    load<T extends Asset>(path: string, type: new () => T): Promise<T | null> {
        return new Promise((resolve) => {
            // 检查缓存
            if (this.cache.has(path)) {
                resolve(this.cache.get(path) as T);
                return;
            }

            resources.load(path, type, (err, asset) => {
                if (err) {
                    console.error(`[ResourceManager] Failed to load ${path}:`, err);
                    resolve(null);
                    return;
                }
                this.cache.set(path, asset);
                resolve(asset);
            });
        });
    }

    /** 批量加载 */
    loadBatch<T extends Asset>(paths: string[], type: new () => T): Promise<(T | null)[]> {
        return Promise.all(paths.map(p => this.load(p, type)));
    }

    /** 预加载场景资源 */
    preloadScene(sceneName: string): Promise<void> {
        return new Promise((resolve) => {
            assetManager.preloadScene(sceneName, () => {
                console.log(`[ResourceManager] Scene "${sceneName}" preloaded`);
                resolve();
            });
        });
    }

    /** 获取缓存的资源 */
    get<T>(path: string): T | null {
        return (this.cache.get(path) as T) || null;
    }

    /** 清理缓存（场景切换时） */
    clearCache(): void {
        this.cache.clear();
    }

    /** 添加加载任务到队列 */
    enqueue(path: string, type: typeof Asset, priority: number = 0): void {
        this.loadQueue.push({ path, type, priority });
        this.loadQueue.sort((a, b) => b.priority - a.priority);
        this.processQueue();
    }

    /** 处理加载队列 */
    private async processQueue(): Promise<void> {
        if (this.isLoading || this.loadQueue.length === 0) return;
        
        this.isLoading = true;
        const task = this.loadQueue.shift()!;
        await this.load(task.path, task.type);
        task.onComplete?.();
        this.isLoading = false;
        this.processQueue();
    }

    onDestroy() {
        if (ResourceManager._instance === this) {
            ResourceManager._instance = null;
        }
    }
}
