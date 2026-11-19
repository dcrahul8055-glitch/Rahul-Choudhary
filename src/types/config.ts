export type VolumeKeyTarget = 'VOL_UP' | 'VOL_DOWN' | 'EITHER';
export type WakeGesture = 'SINGLE_CLICK' | 'DOUBLE_CLICK' | 'LONG_PRESS';
export type LockGesture = 'DOUBLE_CLICK' | 'LONG_PRESS' | 'CHORD' | 'DISABLED';
export type WakeEngine = 'MEDIA_SESSION' | 'WAKELOCK_ACCESSIBILITY';

export interface C2WakeConfig {
  appName: string;
  packageName: string;
  wakeKey: VolumeKeyTarget;
  wakeGesture: WakeGesture;
  lockKey: VolumeKeyTarget;
  lockGesture: LockGesture;
  doubleClickWindowMs: number;
  longPressDurationMs: number;
  pocketProtection: boolean;
  mediaSafeguard: boolean;
  hapticFeedback: boolean;
  startOnBoot: boolean;
  persistentNotificationLock: boolean;
  wakeEngine: WakeEngine;
}

export const DEFAULT_CONFIG: C2WakeConfig = {
  appName: 'C2 Wake',
  packageName: 'com.c2wake.realme',
  wakeKey: 'EITHER',
  wakeGesture: 'DOUBLE_CLICK',
  lockKey: 'VOL_DOWN',
  lockGesture: 'DOUBLE_CLICK',
  doubleClickWindowMs: 360,
  longPressDurationMs: 650,
  pocketProtection: true,
  mediaSafeguard: true,
  hapticFeedback: true,
  startOnBoot: true,
  persistentNotificationLock: true,
  wakeEngine: 'MEDIA_SESSION',
};

export type ScreenPowerState = 'OFF' | 'LOCKED' | 'UNLOCKED';

export interface HardwareEventEntry {
  id: string;
  timestamp: string;
  keyLabel: string;
  gestureLabel: string;
  deltaMs: number | null;
  outcome: 'WAKED' | 'LOCKED' | 'VOLUME' | 'BLOCKED' | 'IGNORED';
  androidApi: string;
  detail: string;
}

export interface GeneratedProjectFile {
  path: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'yaml' | 'markdown' | 'properties';
  category: 'Core Service' | 'UI & Receivers' | 'Manifest & Res' | 'Build & CI';
  summary: string;
  content: string;
}
