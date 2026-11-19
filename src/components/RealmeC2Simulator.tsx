import React, { useEffect, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  Volume2,
  Volume1,
  Smartphone,
  Music,
  EyeOff,
  Trash2,
  Wifi,
  Battery,
  Signal,
  AlertTriangle,
  PowerOff,
} from 'lucide-react';
import { C2WakeConfig, HardwareEventEntry, ScreenPowerState } from '../types/config';

interface RealmeC2SimulatorProps {
  config: C2WakeConfig;
}

const WALLPAPER_SRC = '/src/assets/images/realme_c2_wallpaper_1795054645679.jpg';

function formatClock(): { time: string; date: string } {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return { time, date };
}

function formatTimestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export const RealmeC2Simulator: React.FC<RealmeC2SimulatorProps> = ({ config }) => {
  const [screenState, setScreenState] = useState<ScreenPowerState>('OFF');
  const [volume, setVolume] = useState<number>(8);
  const [showVolumeHud, setShowVolumeHud] = useState<boolean>(false);
  const [inPocket, setInPocket] = useState<boolean>(false);
  const [mediaPlaying, setMediaPlaying] = useState<boolean>(false);
  const [wallpaperFailed, setWallpaperFailed] = useState<boolean>(false);
  const [activeKey, setActiveKey] = useState<'UP' | 'DOWN' | 'POWER' | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [events, setEvents] = useState<HardwareEventEntry[]>([]);
  const [clock, setClock] = useState(formatClock);

  const lastClickRef = useRef<{ key: 'UP' | 'DOWN' | null; time: number }>({ key: null, time: 0 });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef<boolean>(false);
  const volumeHudTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const pressedKeysRef = useRef<{ UP: boolean; DOWN: boolean }>({ UP: false, DOWN: false });

  // Keep latest config & state in refs for clean timer callbacks
  const stateRef = useRef({ config, screenState, inPocket, mediaPlaying });
  stateRef.current = { config, screenState, inPocket, mediaPlaying };

  useEffect(() => {
    const interval = window.setInterval(() => setClock(formatClock()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setStatusBanner(null), 2200);
  };

  const pushEvent = (entry: Omit<HardwareEventEntry, 'id' | 'timestamp'>) => {
    setEvents((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: formatTimestamp(),
      },
      ...prev.slice(0, 29),
    ]);
  };

  const adjustVolume = (dir: 1 | -1) => {
    setVolume((v) => Math.max(0, Math.min(15, v + dir)));
    setShowVolumeHud(true);
    if (volumeHudTimerRef.current) window.clearTimeout(volumeHudTimerRef.current);
    volumeHudTimerRef.current = window.setTimeout(() => setShowVolumeHud(false), 1600);
  };

  const matchesKeyTarget = (key: 'UP' | 'DOWN', target: C2WakeConfig['wakeKey']) => {
    if (target === 'EITHER') return true;
    return target === 'VOL_UP' ? key === 'UP' : key === 'DOWN';
  };

  const performWake = (keyLabel: string, gestureLabel: string, deltaMs: number | null) => {
    const { config: cfg, inPocket: pocket } = stateRef.current;
    if (cfg.pocketProtection && pocket) {
      flashBanner('Wake blocked — proximity sensor detects pocket');
      pushEvent({
        keyLabel,
        gestureLabel,
        deltaMs,
        outcome: 'BLOCKED',
        androidApi: 'Sensor.TYPE_PROXIMITY (< 3cm)',
        detail: 'Pocket Protection prevented accidental wake.',
      });
      return;
    }

    setScreenState('LOCKED');
    flashBanner(cfg.hapticFeedback ? 'Screen woken (28ms vibration)' : 'Screen woken');
    pushEvent({
      keyLabel,
      gestureLabel,
      deltaMs,
      outcome: 'WAKED',
      androidApi:
        cfg.wakeEngine === 'MEDIA_SESSION'
          ? 'MediaSessionCompat -> ACQUIRE_CAUSES_WAKEUP'
          : 'AccessibilityService -> ACQUIRE_CAUSES_WAKEUP',
      detail: 'Display backlight turned ON (Lock Screen).',
    });
  };

  const performLock = (keyLabel: string, gestureLabel: string, deltaMs: number | null) => {
    const { config: cfg } = stateRef.current;
    setScreenState('OFF');
    setShowVolumeHud(false);
    flashBanner(cfg.hapticFeedback ? 'Screen locked (28ms vibration)' : 'Screen locked');
    pushEvent({
      keyLabel,
      gestureLabel,
      deltaMs,
      outcome: 'LOCKED',
      androidApi: 'performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)',
      detail: 'Display turned OFF cleanly without Power key.',
    });
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleVolumeDownEvent = (key: 'UP' | 'DOWN') => {
    setActiveKey(key);
    pressedKeysRef.current[key] = true;
    longPressFiredRef.current = false;

    const { config: cfg, screenState: scr, mediaPlaying: media } = stateRef.current;
    const isScreenOn = scr !== 'OFF';
    const keyLabel = key === 'UP' ? 'Volume Up' : 'Volume Down';

    // Check simultaneous chord
    if (isScreenOn && cfg.lockGesture === 'CHORD' && pressedKeysRef.current.UP && pressedKeysRef.current.DOWN) {
      clearLongPressTimer();
      longPressFiredRef.current = true;
      performLock('Vol Up + Down', 'Chord Press', null);
      return;
    }

    const watchWakeLongPress =
      !isScreenOn && cfg.wakeGesture === 'LONG_PRESS' && matchesKeyTarget(key, cfg.wakeKey);
    const watchLockLongPress =
      isScreenOn &&
      cfg.lockGesture === 'LONG_PRESS' &&
      matchesKeyTarget(key, cfg.lockKey) &&
      !(cfg.mediaSafeguard && media);

    if (watchWakeLongPress || watchLockLongPress) {
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true;
        if (watchWakeLongPress) {
          performWake(keyLabel, `Long Press (${cfg.longPressDurationMs}ms)`, cfg.longPressDurationMs);
        } else {
          performLock(keyLabel, `Long Press (${cfg.longPressDurationMs}ms)`, cfg.longPressDurationMs);
        }
      }, cfg.longPressDurationMs);
    }
  };

  const handleVolumeUpEvent = (key: 'UP' | 'DOWN') => {
    setActiveKey(null);
    pressedKeysRef.current[key] = false;
    clearLongPressTimer();

    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    const { config: cfg, screenState: scr, mediaPlaying: media } = stateRef.current;
    const isScreenOn = scr !== 'OFF';
    const keyLabel = key === 'UP' ? 'Volume Up' : 'Volume Down';
    const now = performance.now();
    const delta =
      lastClickRef.current.key === key ? Math.round(now - lastClickRef.current.time) : null;
    const isDoubleClick = delta !== null && delta > 0 && delta <= cfg.doubleClickWindowMs;

    if (!isScreenOn) {
      if (matchesKeyTarget(key, cfg.wakeKey)) {
        if (cfg.wakeGesture === 'SINGLE_CLICK') {
          performWake(keyLabel, 'Single Click', null);
          lastClickRef.current = { key: null, time: 0 };
          return;
        }
        if (cfg.wakeGesture === 'DOUBLE_CLICK') {
          if (isDoubleClick) {
            lastClickRef.current = { key: null, time: 0 };
            performWake(keyLabel, 'Double Click', delta);
            return;
          }
          lastClickRef.current = { key, time: now };
          pushEvent({
            keyLabel,
            gestureLabel: 'Click 1 of 2',
            deltaMs: null,
            outcome: 'IGNORED',
            androidApi: 'onKeyEvent(KEYCODE_VOLUME)',
            detail: `Waiting up to ${cfg.doubleClickWindowMs}ms for second click to wake.`,
          });
          return;
        }
        if (cfg.wakeGesture === 'LONG_PRESS') {
          pushEvent({
            keyLabel,
            gestureLabel: 'Short Click',
            deltaMs: null,
            outcome: 'IGNORED',
            androidApi: 'onKeyEvent(KEYCODE_VOLUME)',
            detail: `Hold ${cfg.longPressDurationMs}ms to wake screen.`,
          });
          return;
        }
      } else {
        pushEvent({
          keyLabel,
          gestureLabel: 'Single Click',
          deltaMs: null,
          outcome: 'IGNORED',
          androidApi: 'onKeyEvent(KEYCODE_VOLUME)',
          detail: `Configured wake key is ${cfg.wakeKey === 'VOL_UP' ? 'Volume Up' : 'Volume Down'}.`,
        });
        return;
      }
    }

    // Screen is ON
    if (cfg.mediaSafeguard && media) {
      adjustVolume(key === 'UP' ? 1 : -1);
      pushEvent({
        keyLabel,
        gestureLabel: isDoubleClick ? 'Double Click' : 'Single Click',
        deltaMs: delta,
        outcome: 'VOLUME',
        androidApi: 'AudioManager.isMusicActive == true',
        detail: 'Media Safeguard active — normal volume adjusted instead of locking.',
      });
      lastClickRef.current = { key, time: now };
      return;
    }

    if (cfg.lockGesture === 'DOUBLE_CLICK' && matchesKeyTarget(key, cfg.lockKey)) {
      if (isDoubleClick) {
        lastClickRef.current = { key: null, time: 0 };
        performLock(keyLabel, 'Double Click', delta);
        return;
      }
      lastClickRef.current = { key, time: now };
      adjustVolume(key === 'UP' ? 1 : -1);
      pushEvent({
        keyLabel,
        gestureLabel: 'Single Click',
        deltaMs: null,
        outcome: 'VOLUME',
        androidApi: 'AudioManager.adjustStreamVolume',
        detail: `Adjusted volume. Press again within ${cfg.doubleClickWindowMs}ms to lock.`,
      });
      return;
    }

    // Default normal volume adjustment
    adjustVolume(key === 'UP' ? 1 : -1);
    pushEvent({
      keyLabel,
      gestureLabel: 'Single Click',
      deltaMs: null,
      outcome: 'VOLUME',
      androidApi: 'AudioManager.adjustStreamVolume',
      detail: 'Normal Realme C2 volume adjustment.',
    });
    lastClickRef.current = { key, time: now };
  };

  const handleBrokenPowerClick = () => {
    setActiveKey('POWER');
    window.setTimeout(() => setActiveKey(null), 180);
    flashBanner('Power button hardware fault — use Volume keys');
    pushEvent({
      keyLabel: 'Power Key',
      gestureLabel: 'Broken Switch',
      deltaMs: null,
      outcome: 'BLOCKED',
      androidApi: 'No hardware interrupt received',
      detail: 'Physical power switch is unresponsive. Use configured Volume key trigger.',
    });
  };

  const handleTriggerChordButton = () => {
    const { config: cfg, screenState: scr } = stateRef.current;
    if (scr === 'OFF') {
      flashBanner('Screen is already off — wake it with your configured Volume trigger');
      return;
    }
    if (cfg.lockGesture !== 'CHORD') {
      flashBanner('Switch Lock Gesture to "Up + Down Chord" to use simultaneous press');
      return;
    }
    performLock('Vol Up + Down', 'Chord Press', null);
  };

  // Keyboard shortcuts (ArrowUp / ArrowDown) when not typing in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.repeat) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeDownEvent('UP');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeDownEvent('DOWN');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeUpEvent('UP');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeUpEvent('DOWN');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const wakeHint = `${
    config.wakeGesture === 'SINGLE_CLICK'
      ? 'Single-click'
      : config.wakeGesture === 'DOUBLE_CLICK'
        ? 'Double-click'
        : `Hold (${config.longPressDurationMs}ms)`
  } ${
    config.wakeKey === 'VOL_UP'
      ? 'Volume Up'
      : config.wakeKey === 'VOL_DOWN'
        ? 'Volume Down'
        : 'Volume Up or Down'
  }`;

  const lockHint =
    config.lockGesture === 'DISABLED'
      ? 'Use Notification Lock'
      : config.lockGesture === 'CHORD'
        ? 'Press Vol Up + Down together'
        : `${config.lockGesture === 'DOUBLE_CLICK' ? 'Double-click' : `Hold (${config.longPressDurationMs}ms)`} ${
            config.lockKey === 'VOL_UP'
              ? 'Volume Up'
              : config.lockKey === 'VOL_DOWN'
                ? 'Volume Down'
                : 'Either Volume Key'
          }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Interactive Hardware Stage */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Interactive Realme C2 Hardware Simulator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click or hold the left-edge Volume keys below, or press keyboard Up / Down arrows to test your exact timing.
            </p>
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            Display:{' '}
            <span className="font-semibold text-slate-900">
              {screenState === 'OFF' ? 'Screen Off' : screenState === 'LOCKED' ? 'Lock Screen' : 'Home Screen'}
            </span>
          </div>
        </div>

        {/* Phone Mockup + Edge Controls */}
        <div className="mt-6 flex flex-col items-center">
          <div className="relative flex items-center justify-center select-none">
            {/* Left-edge hardware key callouts & tactile Volume buttons */}
            <div className="flex flex-col items-end gap-3 pr-1.5 z-10">
              <button
                type="button"
                onPointerDown={() => handleVolumeDownEvent('UP')}
                onPointerUp={() => handleVolumeUpEvent('UP')}
                onPointerLeave={() => {
                  if (pressedKeysRef.current.UP) handleVolumeUpEvent('UP');
                }}
                aria-label="Realme C2 Volume Up Button"
                className={`group flex items-center gap-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-md pl-2 py-1 transition-colors ${
                  activeKey === 'UP' ? 'text-amber-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">
                  Vol +
                </span>
                <span
                  className={`block w-2.5 h-12 rounded-l-md border border-r-0 transition-transform duration-100 ${
                    activeKey === 'UP'
                      ? 'bg-amber-500 border-amber-600 translate-x-0.5'
                      : 'bg-slate-800 border-slate-700 group-hover:bg-amber-600 group-hover:border-amber-700'
                  }`}
                />
              </button>

              <button
                type="button"
                onPointerDown={() => handleVolumeDownEvent('DOWN')}
                onPointerUp={() => handleVolumeUpEvent('DOWN')}
                onPointerLeave={() => {
                  if (pressedKeysRef.current.DOWN) handleVolumeUpEvent('DOWN');
                }}
                aria-label="Realme C2 Volume Down Button"
                className={`group flex items-center gap-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-md pl-2 py-1 transition-colors ${
                  activeKey === 'DOWN' ? 'text-amber-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">
                  Vol −
                </span>
                <span
                  className={`block w-2.5 h-12 rounded-l-md border border-r-0 transition-transform duration-100 ${
                    activeKey === 'DOWN'
                      ? 'bg-amber-500 border-amber-600 translate-x-0.5'
                      : 'bg-slate-800 border-slate-700 group-hover:bg-amber-600 group-hover:border-amber-700'
                  }`}
                />
              </button>
            </div>

            {/* Realme C2 Chassis (6.1" 19.5:9 Dewdrop IPS LCD) */}
            <div className="relative w-[254px] h-[510px] rounded-[34px] bg-slate-900 p-[9px] shadow-xl border border-slate-700">
              {/* Screen Bezel */}
              <div className="relative w-full h-full rounded-[26px] overflow-hidden bg-black flex flex-col">
                {/* Dewdrop Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                  <div className="w-16 h-4 bg-slate-950 rounded-b-2xl flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-indigo-950" />
                    </div>
                  </div>
                </div>

                {/* Screen Content: OFF vs ON */}
                {screenState === 'OFF' ? (
                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-between px-5 py-12 text-center">
                    <div className="mt-4 text-[11px] text-slate-500 font-medium">
                      Realme C2 · Display Off
                    </div>

                    <div className="space-y-2.5">
                      <div className="w-10 h-10 mx-auto rounded-full border border-slate-800 flex items-center justify-center text-slate-500">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-medium text-slate-300 leading-relaxed">
                        {wakeHint}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        to turn screen light ON
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {inPocket && config.pocketProtection
                        ? 'Proximity sensor covered (Pocket Mode)'
                        : config.wakeEngine === 'MEDIA_SESSION'
                          ? 'MediaSession listener standby'
                          : 'WakeLock key filter standby'}
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex flex-col justify-between text-white">
                    {/* Wallpaper Layer */}
                    {!wallpaperFailed ? (
                      <img
                        src={WALLPAPER_SRC}
                        alt="Realme C2 diamond geometric wallpaper"
                        referrerPolicy="no-referrer"
                        onError={() => setWallpaperFailed(true)}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900" />
                    )}

                    {/* Contrast Scrim */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/75" />

                    {/* ColorOS 6 Status Bar */}
                    <div className="relative z-20 flex items-center justify-between px-4 pt-2 text-[10px] font-medium text-white/90 tabular-nums">
                      <span>{clock.time}</span>
                      <div className="flex items-center gap-1.5">
                        <Signal className="w-3 h-3" />
                        <Wifi className="w-3 h-3" />
                        <Battery className="w-3.5 h-3.5" />
                        <span>84%</span>
                      </div>
                    </div>

                    {/* Volume HUD Overlay (ColorOS 6 left-side vertical slider) */}
                    {showVolumeHud && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-slate-900/90 backdrop-blur-sm border border-white/15 rounded-xl px-2 py-3 flex flex-col items-center gap-2">
                        {volume === 0 ? (
                          <Volume1 className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <div className="w-1.5 h-24 bg-white/20 rounded-full overflow-hidden flex flex-col justify-end">
                          <div
                            className="w-full bg-amber-400 rounded-full transition-all duration-100"
                            style={{ height: `${(volume / 15) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-white/80">
                          {volume}
                        </span>
                      </div>
                    )}

                    {/* Lock Screen vs Home Screen Body */}
                    {screenState === 'LOCKED' ? (
                      <div className="relative z-20 flex-1 flex flex-col justify-between px-4 pt-8 pb-5">
                        <div className="text-center">
                          <div className="text-4xl font-semibold tracking-tight tabular-nums font-display">
                            {clock.time}
                          </div>
                          <div className="text-xs text-white/80 mt-1">{clock.date}</div>
                        </div>

                        {/* Persistent Notification Card */}
                        {config.persistentNotificationLock && (
                          <div className="bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-xl p-3 text-left">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-white truncate">
                                {config.appName || 'C2 Wake'}
                              </span>
                              <span className="text-[10px] text-white/60">Active</span>
                            </div>
                            <p className="text-[10px] text-white/75 mt-1 leading-snug">
                              Lock: {lockHint}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                performLock('Notification', 'Quick Action Tap', null)
                              }
                              className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Lock className="w-3 h-3" />
                              Lock Screen Now
                            </button>
                          </div>
                        )}

                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setScreenState('UNLOCKED')}
                            className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Unlock Home Screen
                          </button>
                          <div className="w-20 h-1 rounded-full bg-white/40" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-20 flex-1 flex flex-col justify-between px-4 pt-6 pb-5">
                        {/* Home Screen Widget */}
                        <div className="bg-slate-950/65 backdrop-blur-md border border-white/15 rounded-xl p-3">
                          <div className="text-[11px] font-semibold text-amber-300">
                            {config.appName || 'C2 Wake'} · ColorOS 6
                          </div>
                          <div className="text-[11px] text-white/85 mt-1 leading-snug">
                            {mediaPlaying
                              ? 'Music playing — Volume keys adjust audio safely'
                              : `Lock gesture: ${lockHint}`}
                          </div>
                        </div>

                        {/* Simulated Home Icons */}
                        <div className="grid grid-cols-3 gap-3 text-center my-auto py-4">
                          <button
                            type="button"
                            onClick={() => performLock('Home Shortcut', 'Widget Tap', null)}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer"
                          >
                            <span className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center group-hover:bg-amber-400 transition-colors shadow-sm">
                              <Lock className="w-5 h-5" />
                            </span>
                            <span className="text-[10px] font-medium text-white/90">
                              Lock Now
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setMediaPlaying((m) => !m)}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer"
                          >
                            <span
                              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors border ${
                                mediaPlaying
                                  ? 'bg-emerald-500/90 border-emerald-300 text-white'
                                  : 'bg-white/15 border-white/20 text-white group-hover:bg-white/25'
                              }`}
                            >
                              <Music className="w-5 h-5" />
                            </span>
                            <span className="text-[10px] font-medium text-white/90">
                              {mediaPlaying ? 'Playing' : 'Music'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setScreenState('LOCKED')}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer"
                          >
                            <span className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center group-hover:bg-white/25 transition-colors">
                              <Smartphone className="w-5 h-5" />
                            </span>
                            <span className="text-[10px] font-medium text-white/90">
                              Lock View
                            </span>
                          </button>
                        </div>

                        <div className="flex justify-center">
                          <div className="w-20 h-1 rounded-full bg-white/40" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right-edge Broken Power Button */}
            <div className="flex flex-col items-start pl-1.5 z-10">
              <button
                type="button"
                onClick={handleBrokenPowerClick}
                aria-label="Broken Realme C2 Power Button"
                className="group flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 rounded-md pr-2 py-1"
              >
                <span
                  className={`block w-2.5 h-11 rounded-r-md border border-l-0 transition-colors ${
                    activeKey === 'POWER'
                      ? 'bg-rose-600 border-rose-700'
                      : 'bg-rose-100 border-rose-300 group-hover:bg-rose-200'
                  }`}
                />
                <span className="hidden sm:flex flex-col leading-tight">
                  <span className="text-xs font-medium text-rose-700 whitespace-nowrap">
                    Power
                  </span>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    Broken
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Live Feedback Line */}
          <div className="mt-4 min-h-[24px] flex items-center justify-center">
            {statusBanner ? (
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>{statusBanner}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Tip: {screenState === 'OFF' ? `Try ${wakeHint}` : `Try ${lockHint}`}
              </p>
            )}
          </div>

          {/* Direct Test Controls Bar */}
          <div className="mt-4 w-full pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onPointerDown={() => handleVolumeDownEvent('UP')}
                onPointerUp={() => handleVolumeUpEvent('UP')}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-amber-50 active:border-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Press Vol +
              </button>
              <button
                type="button"
                onPointerDown={() => handleVolumeDownEvent('DOWN')}
                onPointerUp={() => handleVolumeUpEvent('DOWN')}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-amber-50 active:border-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Press Vol −
              </button>
              {config.lockGesture === 'CHORD' && (
                <button
                  type="button"
                  onClick={handleTriggerChordButton}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Press Vol + &amp; − Together
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInPocket((p) => !p)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  inPocket
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {inPocket ? 'Pocket: Covered' : 'Pocket: Open'}
              </button>
              <button
                type="button"
                onClick={() => setMediaPlaying((m) => !m)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  mediaPlaying
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                {mediaPlaying ? 'Audio: Playing' : 'Audio: Idle'}
              </button>
              <button
                type="button"
                onClick={() => setScreenState((s) => (s === 'OFF' ? 'LOCKED' : 'OFF'))}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PowerOff className="w-3.5 h-3.5" />
                Toggle Screen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Key Event Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Hardware Key Event Log</h3>
            <p className="text-xs text-slate-500">
              Live timing measurements and Android API calls from the simulator
            </p>
          </div>
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => setEvents([])}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-600 font-medium">No hardware clicks recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Click the Volume Up or Volume Down keys on the Realme C2 frame above to inspect key timing and Android wake/lock actions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 pl-5 pr-3">Time</th>
                  <th className="py-2.5 px-3">Input</th>
                  <th className="py-2.5 px-3 text-right">Delta</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 pl-3 pr-5">Android API / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pl-5 pr-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {ev.timestamp}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                      <span className="font-medium">{ev.keyLabel}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-600">{ev.gestureLabel}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                      {ev.deltaMs !== null ? `${ev.deltaMs} ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                      {ev.outcome === 'WAKED' && (
                        <span className="text-emerald-700">Screen On</span>
                      )}
                      {ev.outcome === 'LOCKED' && (
                        <span className="text-amber-700">Screen Off</span>
                      )}
                      {ev.outcome === 'VOLUME' && (
                        <span className="text-slate-700">Volume Step</span>
                      )}
                      {ev.outcome === 'BLOCKED' && (
                        <span className="text-rose-700">Blocked</span>
                      )}
                      {ev.outcome === 'IGNORED' && (
                        <span className="text-slate-500">Waiting</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-slate-600">
                      <span className="font-mono text-[11px] text-slate-800 block">
                        {ev.androidApi}
                      </span>
                      <span className="text-[11px] text-slate-500">{ev.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
