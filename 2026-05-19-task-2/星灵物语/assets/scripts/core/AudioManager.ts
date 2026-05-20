/**
 * 音频管理器 — BGM、SFX、角色语音播放管理
 * Audio Manager — Background music, sound effects, and character voice playback
 *
 * 注意：音频资源应放在 assets/resources/audio/ 目录下，
 * 使用 resources.load 加载，确保在微信小游戏等平台正常工作。
 */

import { _decorator, Component, AudioSource, resources, assetManager, AudioClip, game, Game } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager;

    @property({ type: AudioSource, tooltip: 'BGM音频源' })
    bgmSource: AudioSource | null = null;

    @property({ type: AudioSource, tooltip: 'SFX音频源' })
    sfxSource: AudioSource | null = null;

    @property({ type: AudioSource, tooltip: '语音音频源（专用，避免和BGM/SFX冲突）' })
    voiceSource: AudioSource | null = null;

    @property
    bgmVolume: number = 0.5;

    @property
    sfxVolume: number = 0.8;

    @property
    voiceVolume: number = 1.0;

    private soundCache: Map<string, AudioClip> = new Map();
    private bgmPath: string = '';
    private audioUnlocked: boolean = false;
    private voiceQueue: string[] = []; // 语音播放队列，防止重叠

    static getInstance(): AudioManager | null {
        return this._instance;
    }

    onLoad() {
        if (AudioManager._instance) {
            this.destroy();
            return;
        }
        AudioManager._instance = this;

        // 监听首次用户交互，解锁移动端音频
        this.setupMobileAudioUnlock();
    }

    start() {
        // 默认音量
        if (this.bgmSource) this.bgmSource.volume = this.bgmVolume;
        if (this.sfxSource) this.sfxSource.volume = this.sfxVolume;
        if (this.voiceSource) this.voiceSource.volume = this.voiceVolume;
    }

    /**
     * 解锁移动端/微信小游戏音频
     * iOS Safari 和微信 WebView 要求在用户交互事件中首次调用 play() 才能解锁 AudioContext
     */
    private setupMobileAudioUnlock(): void {
        const unlock = () => {
            if (this.audioUnlocked) return;

            // 播放一个静音的 clip 来解锁音频上下文
            const tryUnlock = (source: AudioSource | null) => {
                if (!source || this.audioUnlocked) return;
                const oldVolume = source.volume;
                source.volume = 0;
                source.play();
                source.stop();
                source.volume = oldVolume;
                this.audioUnlocked = true;
                console.log('[AudioManager] Audio context unlocked');
            };

            tryUnlock(this.bgmSource);
            tryUnlock(this.sfxSource);
            tryUnlock(this.voiceSource);

            // 微信小游戏 InnerAudioContext 兼容
            if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
                try {
                    const ctx = wx.createInnerAudioContext();
                    ctx.volume = 0;
                    ctx.play();
                    ctx.stop();
                    ctx.destroy();
                    this.audioUnlocked = true;
                } catch (e) {
                    console.warn('[AudioManager] WeChat audio unlock failed:', e);
                }
            }
        };

        game.on(Game.EVENT_TOUCH_START, unlock, this);
        // 备用：也监听 document 级别的事件
        if (typeof document !== 'undefined') {
            document.addEventListener('touchstart', unlock, { once: true });
            document.addEventListener('click', unlock, { once: true });
        }
    }

    /** 播放BGM */
    playBGM(path: string, loop: boolean = true): void {
        if (!this.bgmSource) return;

        if (path === this.bgmPath && this.bgmSource.playing) return;

        this.loadAudioClip(path, (clip) => {
            if (!clip) return;
            this.bgmSource!.clip = clip;
            this.bgmSource!.loop = loop;
            this.bgmSource!.volume = this.bgmVolume;
            this.bgmSource!.play();
            this.bgmPath = path;
        });
    }

    /** 停止BGM */
    stopBGM(): void {
        if (this.bgmSource) {
            this.bgmSource.stop();
        }
        this.bgmPath = '';
    }

    /** 播放音效 */
    playSFX(path: string): void {
        if (!this.sfxSource) return;

        this.loadAudioClip(path, (clip) => {
            if (!clip) return;
            this.sfxSource!.playOneShot(clip, this.sfxVolume);
        });
    }

    /**
     * 播放角色语音
     * @param path 音频路径，如 'audio/voice/fire_ulti_1'
     *             资源需放置在 assets/resources/audio/voice/ 下
     * @param interrupt 是否打断当前正在播放的语音，默认 true
     */
    playVoice(path: string, interrupt: boolean = true): void {
        if (!this.voiceSource) {
            // voiceSource 未配置时降级到 sfxSource
            console.warn('[AudioManager] voiceSource not set, fallback to sfxSource');
            this.playSFX(path);
            return;
        }

        if (interrupt) {
            // 打断当前语音，播放新语音
            this.voiceSource.stop();
            this.voiceQueue = [];
        } else {
            // 排队播放，防止语音重叠
            if (this.voiceSource.playing) {
                this.voiceQueue.push(path);
                return;
            }
        }

        this.loadAudioClip(path, (clip) => {
            if (!clip || !this.voiceSource) return;
            this.voiceSource.clip = clip;
            this.voiceSource.loop = false;
            this.voiceSource.volume = this.voiceVolume;
            this.voiceSource.play();
        });
    }

    /** 停止当前语音 */
    stopVoice(): void {
        if (this.voiceSource) {
            this.voiceSource.stop();
        }
        this.voiceQueue = [];
    }

    /** 设置BGM音量 */
    setBGMVolume(volume: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        if (this.bgmSource) {
            this.bgmSource.volume = this.bgmVolume;
        }
    }

    /** 设置SFX音量 */
    setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxSource) {
            this.sfxSource.volume = this.sfxVolume;
        }
    }

    /** 设置语音音量 */
    setVoiceVolume(volume: number): void {
        this.voiceVolume = Math.max(0, Math.min(1, volume));
        if (this.voiceSource) {
            this.voiceSource.volume = this.voiceVolume;
        }
    }

    /**
     * 加载音频资源
     * @param path 相对于 resources/ 的路径（不带扩展名），如 'audio/bgm/battle_01'
     */
    private loadAudioClip(path: string, callback: (clip: AudioClip | null) => void): void {
        // 检查缓存
        if (this.soundCache.has(path)) {
            const cached = this.soundCache.get(path);
            callback(cached || null);
            return;
        }

        // resources.load 只能加载 resources/ 目录下的资源
        // 音频文件应放在 assets/resources/audio/ 下
        resources.load(path, AudioClip, (err, clip) => {
            if (err) {
                console.warn(`[AudioManager] Failed to load audio: ${path}`, err);
                callback(null);
                return;
            }
            this.soundCache.set(path, clip);
            callback(clip);
        });
    }

    update(dt: number): void {
        // 处理语音队列
        if (this.voiceSource && this.voiceQueue.length > 0 && !this.voiceSource.playing) {
            const nextPath = this.voiceQueue.shift()!;
            this.playVoice(nextPath, true);
        }
    }

    onDestroy() {
        if (AudioManager._instance === this) {
            AudioManager._instance = null;
        }
    }
}
