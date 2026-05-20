/**
 * UI管理器 — 管理UI栈、面板打开/关闭、界面过渡
 * UI Manager — Stack management, panel open/close, transitions
 */

import { _decorator, Component, Node, director, Animation, 
         tween, Vec3, color, Sprite, Color } from 'cc';
import { EventManager, GameEvent } from '../core/EventManager';

const { ccclass, property } = _decorator;

interface UIPanel {
    node: Node;
    name: string;
    layer: UILayer;
    isPopup: boolean; // 是否为弹窗（阻挡下层交互）
}

export enum UILayer {
    BACKGROUND = 0,  // 背景层
    GAME = 1,        // 游戏层
    UI = 2,          // 常规UI
    POPUP = 3,       // 弹窗
    OVERLAY = 4,     // 遮罩/加载
    DEBUG = 5,       // 调试
}

@ccclass('UIManager')
export class UIManager extends Component {
    private static _instance: UIManager;
    private panelStack: UIPanel[] = [];
    private panelMap: Map<string, UIPanel> = new Map();
    private layerNodes: Map<UILayer, Node> = new Map();

    static getInstance(): UIManager | null {
        return this._instance;
    }

    @property({ type: Node, tooltip: 'UI根节点' })
    uiRoot: Node | null = null;

    @property
    fadeDuration: number = 0.2;

    onLoad() {
        if (UIManager._instance) {
            this.destroy();
            return;
        }
        UIManager._instance = this;
        director.addPersistRootNode(this.node);

        this.initLayers();
        this.registerEvents();
    }

    /** 初始化UI层级 */
    private initLayers(): void {
        if (!this.uiRoot) return;

        const layerOrder = [UILayer.BACKGROUND, UILayer.GAME, UILayer.UI, UILayer.POPUP, UILayer.OVERLAY, UILayer.DEBUG];
        const layerNames = ['Background', 'Game', 'UI', 'Popup', 'Overlay', 'Debug'];

        for (let i = 0; i < layerOrder.length; i++) {
            const layerNode = new Node(layerNames[i]);
            layerNode.setParent(this.uiRoot);
            layerNode.setSiblingIndex(i);
            this.layerNodes.set(layerOrder[i], layerNode);
        }
    }

    /** 注册全局UI事件 */
    private registerEvents(): void {
        EventManager.getInstance().on(GameEvent.NOTIFICATION, this.showNotification, this);
        EventManager.getInstance().on(GameEvent.SCENE_TRANSITION, this.onSceneTransition, this);
    }

    // ========== 面板管理 ==========

    /** 打开UI面板 */
    openPanel(name: string, node: Node, layer: UILayer = UILayer.UI, isPopup: boolean = false): void {
        if (this.panelMap.has(name)) {
            console.warn(`[UIManager] Panel "${name}" already open`);
            return;
        }

        const layerNode = this.layerNodes.get(layer);
        if (!layerNode) return;

        node.setParent(layerNode);
        node.name = name;

        const panel: UIPanel = { node, name, layer, isPopup };
        this.panelMap.set(name, panel);
        this.panelStack.push(panel);

        // 入场动画
        this.playPanelOpenAnimation(node);

        // 如果是弹窗，添加遮罩
        if (isPopup) {
            this.addOverlay(node);
        }

        EventManager.getInstance().emit(GameEvent.UI_PANEL_OPEN, { name });
    }

    /** 关闭UI面板 */
    closePanel(name: string, animated: boolean = true): void {
        const panel = this.panelMap.get(name);
        if (!panel) return;

        const closeAction = () => {
            panel.node.removeFromParent();
            this.panelMap.delete(name);
            this.panelStack = this.panelStack.filter(p => p.name !== name);
            EventManager.getInstance().emit(GameEvent.UI_PANEL_CLOSE, { name });
        };

        if (animated) {
            this.playPanelCloseAnimation(panel.node, closeAction);
        } else {
            closeAction();
        }
    }

    /** 关闭最上层弹窗 */
    closeTopPopup(): void {
        for (let i = this.panelStack.length - 1; i >= 0; i--) {
            const panel = this.panelStack[i];
            if (panel.isPopup) {
                this.closePanel(panel.name);
                return;
            }
        }
    }

    /** 关闭所有面板（场景切换时调用） */
    closeAllPanels(): void {
        const names = [...this.panelMap.keys()];
        for (const name of names) {
            this.closePanel(name, false);
        }
    }

    // ========== 遮罩管理 ==========

    /** 添加半透明遮罩 */
    private addOverlay(targetNode: Node): void {
        const overlayNode = new Node('Overlay');
        const layerNode = this.layerNodes.get(UILayer.OVERLAY);
        if (!layerNode) return;

        overlayNode.setParent(layerNode);

        const sprite = overlayNode.addComponent(Sprite);
        sprite.color = new Color(0, 0, 0, 160);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 点击遮罩关闭弹窗
        overlayNode.on(Node.EventType.TOUCH_START, () => {
            this.closeTopPopup();
        });
    }

    // ========== 过渡动画 ==========

    /** 面板打开动画 */
    private playPanelOpenAnimation(node: Node): void {
        node.setScale(new Vec3(0.8, 0.8, 1));
        node.setOpacity(0);
        
        tween(node)
            .parallel(
                tween().to(this.fadeDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }),
                tween().to(this.fadeDuration / 2, { opacity: 255 })
            )
            .start();
    }

    /** 面板关闭动画 */
    private playPanelCloseAnimation(node: Node, onComplete: () => void): void {
        tween(node)
            .parallel(
                tween().to(this.fadeDuration, { scale: new Vec3(0.8, 0.8, 1) }),
                tween().to(this.fadeDuration, { opacity: 0 })
            )
            .call(onComplete)
            .start();
    }

    /** 场景过渡 */
    private onSceneTransition(data: { to: string }): void {
        this.closeAllPanels();
        
        // 淡出效果
        const overlay = new Node('TransitionOverlay');
        const layerNode = this.layerNodes.get(UILayer.OVERLAY);
        if (!layerNode) return;

        overlay.setParent(layerNode);
        const sprite = overlay.addComponent(Sprite);
        sprite.color = new Color(0, 0, 0, 0);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        tween(overlay)
            .to(0.3, { opacity: 255 })
            .call(() => {
                // 切换场景
                director.loadScene(data.to);
            })
            .to(0.3, { opacity: 0 })
            .call(() => overlay.destroy())
            .start();
    }

    // ========== 通知系统 ==========

    private notificationQueue: { message: string; type: string }[] = [];
    private isNotifying: boolean = false;

    /** 显示通知 */
    showNotification(data: { message: string; type?: string }): void {
        this.notificationQueue.push({ 
            message: data.message, 
            type: data.type || 'info' 
        });
        
        if (!this.isNotifying) {
            this.processNotificationQueue();
        }
    }

    private processNotificationQueue(): void {
        if (this.notificationQueue.length === 0) {
            this.isNotifying = false;
            return;
        }

        this.isNotifying = true;
        const data = this.notificationQueue.shift()!;

        // 创建通知节点
        const notifyNode = new Node('Notification');
        const layerNode = this.layerNodes.get(UILayer.OVERLAY);
        if (!layerNode) return;

        notifyNode.setParent(layerNode);

        // [PLACEHOLDER] 这里应该使用预制体UI
        // 简易通知实现：Y位置飘入 + 停留 + 飘出
        notifyNode.setPosition(0, -100, 0);
        
        tween(notifyNode)
            .to(0.3, { position: new Vec3(0, 0, 0) }, { easing: 'backOut' })
            .delay(1.5)
            .to(0.3, { position: new Vec3(0, 100, 0), opacity: 0 })
            .call(() => {
                notifyNode.destroy();
                this.processNotificationQueue();
            })
            .start();
    }

    // ========== 工具方法 ==========

    /** 获取指定层级的节点 */
    getLayerNode(layer: UILayer): Node | undefined {
        return this.layerNodes.get(layer);
    }

    /** 检查面板是否打开 */
    isPanelOpen(name: string): boolean {
        return this.panelMap.has(name);
    }

    onDestroy() {
        EventManager.getInstance().off(GameEvent.NOTIFICATION, this.showNotification, this);
        EventManager.getInstance().off(GameEvent.SCENE_TRANSITION, this.onSceneTransition, this);
        
        if (UIManager._instance === this) {
            UIManager._instance = null;
        }
    }
}
