import React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  C2WakeConfig,
  DEFAULT_CONFIG,
  LockGesture,
  VolumeKeyTarget,
  WakeEngine,
  WakeGesture,
} from '../types/config';

interface ConfigPanelProps {
  config: C2WakeConfig;
  onChange: (next: C2WakeConfig) => void;
}

const PRESETS: { id: string; label: string; patch: Partial<C2WakeConfig> }[] = [
  {
    id: 'balanced',
    label: 'Balanced Daily',
    patch: {
      wakeKey: 'EITHER',
      wakeGesture: 'DOUBLE_CLICK',
      lockKey: 'VOL_DOWN',
      lockGesture: 'DOUBLE_CLICK',
      doubleClickWindowMs: 360,
      pocketProtection: true,
      mediaSafeguard: true,
    },
  },
  {
    id: 'one-tap',
    label: 'Single-Click Wake',
    patch: {
      wakeKey: 'VOL_UP',
      wakeGesture: 'SINGLE_CLICK',
      lockKey: 'VOL_DOWN',
      lockGesture: 'LONG_PRESS',
      longPressDurationMs: 600,
      pocketProtection: true,
      mediaSafeguard: true,
    },
  },
  {
    id: 'pocket-safe',
    label: 'Maximum Pocket Safety',
    patch: {
      wakeKey: 'VOL_UP',
      wakeGesture: 'DOUBLE_CLICK',
      lockKey: 'EITHER',
      lockGesture: 'CHORD',
      doubleClickWindowMs: 320,
      pocketProtection: true,
      mediaSafeguard: true,
    },
  },
];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange }) => {
  const update = <K extends keyof C2WakeConfig>(key: K, value: C2WakeConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {/* Header & Quick Presets */}
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Volume Key Trigger Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Changes immediately update both the Realme C2 simulator and your downloadable Android APK source code.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CONFIG)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>

        {/* Presets */}
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-600 mb-2">Recommended Presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ ...config, ...preset.patch })}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 1: Turn Screen ON (Wake) */}
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            01. Turn Screen Light ON (Wake Trigger)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active when the Realme C2 display is off. Replaces pressing the broken power button to wake the phone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Wake Gesture
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'SINGLE_CLICK', label: 'Single' },
                  { id: 'DOUBLE_CLICK', label: 'Double' },
                  { id: 'LONG_PRESS', label: 'Hold' },
                ] as { id: WakeGesture; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update('wakeGesture', item.id)}
                  className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    config.wakeGesture === item.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Which Volume Key
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'VOL_UP', label: 'Vol +' },
                  { id: 'VOL_DOWN', label: 'Vol −' },
                  { id: 'EITHER', label: 'Either' },
                ] as { id: VolumeKeyTarget; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update('wakeKey', item.id)}
                  className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    config.wakeKey === item.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Turn Screen OFF (Lock) */}
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            02. Turn Screen Light OFF (Lock Trigger)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active when the screen is on. Single clicks stay free for normal volume control; double-click, hold, or chord locks the screen instantly via Android 9 Global Action.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Lock Gesture
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'DOUBLE_CLICK', label: 'Double Click' },
                  { id: 'LONG_PRESS', label: 'Long Press' },
                  { id: 'CHORD', label: 'Vol + & − Chord' },
                  { id: 'DISABLED', label: 'Notification Only' },
                ] as { id: LockGesture; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update('lockGesture', item.id)}
                  className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    config.lockGesture === item.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Lock Volume Key
            </label>
            <div
              className={`grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg ${
                config.lockGesture === 'CHORD' || config.lockGesture === 'DISABLED'
                  ? 'opacity-45 pointer-events-none'
                  : ''
              }`}
            >
              {(
                [
                  { id: 'VOL_UP', label: 'Vol +' },
                  { id: 'VOL_DOWN', label: 'Vol −' },
                  { id: 'EITHER', label: 'Either' },
                ] as { id: VolumeKeyTarget; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update('lockKey', item.id)}
                  className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    config.lockKey === item.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {(config.lockGesture === 'CHORD' || config.lockGesture === 'DISABLED') && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                {config.lockGesture === 'CHORD'
                  ? 'Uses both Volume Up and Volume Down simultaneously.'
                  : 'Screen lock triggered from notification bar button only.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Timing Calibration */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">03. Click Timing Calibration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <label htmlFor="double-click-window" className="font-medium text-slate-700">
                Double-Click Window
              </label>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {config.doubleClickWindowMs} ms
              </span>
            </div>
            <input
              id="double-click-window"
              type="range"
              min={220}
              max={600}
              step={20}
              value={config.doubleClickWindowMs}
              onChange={(e) => update('doubleClickWindowMs', Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1 tabular-nums">
              <span>220 ms (Fast)</span>
              <span>600 ms (Relaxed)</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <label htmlFor="long-press-window" className="font-medium text-slate-700">
                Long-Press Threshold
              </label>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {config.longPressDurationMs} ms
              </span>
            </div>
            <input
              id="long-press-window"
              type="range"
              min={400}
              max={1100}
              step={50}
              value={config.longPressDurationMs}
              onChange={(e) => update('longPressDurationMs', Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1 tabular-nums">
              <span>400 ms</span>
              <span>1100 ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Screen-Off Wake Engine & Safeguards */}
      <div className="p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            04. ColorOS 6 Screen-Off Engine &amp; Safeguards
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Android puts the CPU to sleep when the screen turns off. Choose how the app keeps volume clicks responsive on your Realme C2 (4000 mAh battery).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {
                id: 'MEDIA_SESSION',
                title: 'MediaSession Volume Intercept',
                drain: '~2.5% / 8h standby',
                desc: 'Recommended for Realme C2. Intercepts volume clicks via Android MediaSession without holding a full CPU wake lock.',
              },
              {
                id: 'WAKELOCK_ACCESSIBILITY',
                title: 'Partial WakeLock + KeyFilter',
                drain: '~5.0% / 8h standby',
                desc: 'Maximum reliability if ColorOS Doze interrupts MediaSession. Supports Long-Press wake while screen is off.',
              },
            ] as { id: WakeEngine; title: string; drain: string; desc: string }[]
          ).map((eng) => {
            const active = config.wakeEngine === eng.id;
            return (
              <button
                key={eng.id}
                type="button"
                onClick={() => update('wakeEngine', eng.id)}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  active
                    ? 'border-amber-500 bg-amber-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">{eng.title}</span>
                </div>
                <div className="text-[11px] font-mono text-amber-800 mt-1 tabular-nums">
                  Est. drain: {eng.drain}
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{eng.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Safety Toggles */}
        <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
          {(
            [
              {
                key: 'pocketProtection',
                label: 'Pocket Proximity Protection',
                desc: 'Checks the Realme C2 proximity sensor before waking so accidental pocket presses do not turn on the screen.',
              },
              {
                key: 'mediaSafeguard',
                label: 'Music & Call Volume Safeguard',
                desc: 'Pauses screen-lock triggers while audio or phone calls are active so volume keys adjust sound normally.',
              },
              {
                key: 'persistentNotificationLock',
                label: 'Notification Bar Quick-Lock Button',
                desc: 'Adds a one-tap "Lock Screen Now" button to the ColorOS notification shade as an extra power-button replacement.',
              },
              {
                key: 'hapticFeedback',
                label: 'Haptic Vibration Confirmation',
                desc: 'Fires a short 28 ms vibration when waking or locking the display via volume buttons.',
              },
              {
                key: 'startOnBoot',
                label: 'Auto-Start After Reboot',
                desc: 'Registers RECEIVE_BOOT_COMPLETED so volume wake restarts automatically after a phone restart.',
              },
            ] as const
          ).map((toggle) => (
            <label
              key={toggle.key}
              className="flex items-start justify-between gap-4 py-3 cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-slate-900">{toggle.label}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toggle.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={config[toggle.key]}
                onChange={(e) => update(toggle.key, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-amber-600 shrink-0 cursor-pointer"
              />
            </label>
          ))}
        </div>

        {/* App Metadata for APK Export */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label htmlFor="apk-app-name" className="block text-xs font-medium text-slate-700 mb-1">
              Android App Label
            </label>
            <input
              id="apk-app-name"
              type="text"
              value={config.appName}
              onChange={(e) => update('appName', e.target.value)}
              placeholder="C2 Wake"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>
          <div>
            <label htmlFor="apk-package-name" className="block text-xs font-medium text-slate-700 mb-1">
              Android Package ID
            </label>
            <input
              id="apk-package-name"
              type="text"
              value={config.packageName}
              onChange={(e) =>
                update(
                  'packageName',
                  e.target.value.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase()
                )
              }
              placeholder="com.c2wake.realme"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
