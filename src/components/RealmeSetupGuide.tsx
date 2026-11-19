import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, RotateCcw } from 'lucide-react';
import { C2WakeConfig } from '../types/config';
import { downloadAndroidProjectZip } from '../utils/androidProjectGenerator';

interface RealmeSetupGuideProps {
  config: C2WakeConfig;
}

interface ChecklistStep {
  id: string;
  phase: 'Immediate Zero-Install Fixes' | 'Build & Install Your Custom APK' | 'ColorOS 6 Background Survival';
  title: string;
  path: string;
  detail: string;
}

const STORAGE_KEY = 'c2_wake_setup_progress_v1';

export const RealmeSetupGuide: React.FC<RealmeSetupGuideProps> = ({ config }) => {
  const appLabel = config.appName.trim() || 'C2 Wake';

  const steps: ChecklistStep[] = [
    {
      id: 'builtin-dt2w',
      phase: 'Immediate Zero-Install Fixes',
      title: 'Enable Built-In Double Tap to Turn Screen On',
      path: 'Settings -> Convenience Aid -> Gesture & Motion -> Screen-Off Gestures',
      detail:
        'Turn ON "Screen-Off Gestures" and "Double Tap to Turn Screen On". This works natively in Realme C2 hardware firmware with zero battery impact as a reliable backup alongside Volume Wake.',
    },
    {
      id: 'builtin-assistive-ball',
      phase: 'Immediate Zero-Install Fixes',
      title: 'Enable Assistive Ball Quick Lock',
      path: 'Settings -> Convenience Aid -> Assistive Ball -> Tap Menu',
      detail:
        'Turn ON Assistive Ball and set one gesture (such as Double Tap) to "Lock Screen" so you can immediately turn the screen off even before installing the APK.',
    },
    {
      id: 'build-apk-cloud',
      phase: 'Build & Install Your Custom APK',
      title: 'Compile Your Custom APK (Free Cloud Build or Android Studio)',
      path: 'Download ZIP -> Upload to GitHub -> Actions -> Build Realme C2 APK',
      detail:
        'The downloaded ZIP includes a preconfigured .github/workflows/build-apk.yml file. Upload the ZIP to a free GitHub repository and run the workflow to download app-debug.apk directly to your Realme C2 — no PC or Android Studio required.',
    },
    {
      id: 'install-apk',
      phase: 'Build & Install Your Custom APK',
      title: 'Install APK & Start the Foreground Volume Service',
      path: `Files -> Downloads -> app-debug.apk -> Open ${appLabel}`,
      detail:
        'Allow "Install from Unknown Sources" for Chrome or Files, install the APK, open the app, and tap "1. Start Screen-Off Volume Service".',
    },
    {
      id: 'coloros-accessibility',
      phase: 'ColorOS 6 Background Survival',
      title: 'Grant Accessibility Key Filter Permission',
      path: `Settings -> Additional Settings -> Accessibility -> ${appLabel} Volume Controller`,
      detail:
        'Required so Android 9 delivers hardware Volume Up / Volume Down events to the app and allows instant screen lock via GLOBAL_ACTION_LOCK_SCREEN without root.',
    },
    {
      id: 'coloros-lock-recents',
      phase: 'ColorOS 6 Background Survival',
      title: 'Lock the App in Realme C2 Recent Apps',
      path: `Recents Button -> Pull Down on ${appLabel} Card -> Lock Icon`,
      detail:
        'ColorOS 6 aggressively clears unlocked apps when memory is low. Locking the card in Recents keeps your Volume Wake listener alive.',
    },
    {
      id: 'coloros-battery',
      phase: 'ColorOS 6 Background Survival',
      title: 'Allow Background Running & Auto-Startup',
      path: `Settings -> App Management -> ${appLabel} -> Power Saver`,
      detail:
        'Enable "Allow Background Running" and "Allow Auto-Startup". Also go to Settings -> Battery -> Power Saver Options and turn OFF "Sleep Standby Optimization" if waking fails overnight.',
    },
  ];

  const [completed, setCompleted] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    } catch {
      // Ignore storage quota errors
    }
  }, [completed]);

  const toggleStep = (id: string) => {
    setCompleted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const doneCount = steps.filter((s) => completed[s.id]).length;

  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      window.setTimeout(() => setCopiedCmd(null), 1500);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const phases: ChecklistStep['phase'][] = [
    'Immediate Zero-Install Fixes',
    'Build & Install Your Custom APK',
    'ColorOS 6 Background Survival',
  ];

  return (
    <div className="space-y-6">
      {/* Progress Summary Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Realme C2 (ColorOS 6 / Android 9) Deployment Checklist
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Follow these device-specific steps so ColorOS 6 never kills your Volume Wake service and your phone stays usable without a power button.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
              {doneCount} / {steps.length} completed
            </span>
            {doneCount > 0 && (
              <button
                type="button"
                onClick={() => setCompleted({})}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Subtle Progress Track */}
        <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-200"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Phased Checklists */}
      {phases.map((phase, phaseIndex) => {
        const phaseSteps = steps.filter((s) => s.phase === phase);
        return (
          <div
            key={phase}
            className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100"
          >
            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                0{phaseIndex + 1}. {phase}
              </h3>
              {phase === 'Build & Install Your Custom APK' && (
                <button
                  type="button"
                  onClick={() => downloadAndroidProjectZip(config)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Project ZIP
                </button>
              )}
            </div>

            {phaseSteps.map((step) => {
              const isDone = Boolean(completed[step.id]);
              return (
                <label
                  key={step.id}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleStep(step.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-amber-600 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-medium ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs font-mono text-amber-800 mt-1 break-words">
                      {step.path}
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{step.detail}</p>
                  </div>
                </label>
              );
            })}
          </div>
        );
      })}

      {/* Emergency Boot & ADB Recovery Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            04. Emergency Power-On Guide (If Realme C2 Battery Hits 0%)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Because the physical power button is broken, keep these two recovery methods handy if your Realme C2 ever shuts down completely.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Method A: Volume Down + USB Charger (No PC Required)
            </div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Charge the Realme C2 for at least 10 minutes first.</li>
              <li>Unplug the Micro-USB cable.</li>
              <li>
                Press and hold the <span className="font-semibold text-slate-800">Volume Down</span> button firmly, and while holding it, plug the charger cable back in.
              </li>
              <li>
                Keep holding Volume Down until the <span className="font-semibold text-slate-800">ColorOS Recovery</span> menu appears, then tap <span className="font-semibold text-slate-800">English -&gt; Reboot</span> on the touchscreen.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Method B: Sideload APK or Wake via USB (ADB Commands)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              If USB Debugging is enabled on your Realme C2, you can install your built APK or toggle the screen directly from a PC:
            </p>
            <div className="space-y-2 pt-1">
              {[
                'adb install -r app-debug.apk',
                'adb shell input keyevent KEYCODE_WAKEUP',
              ].map((cmd) => (
                <div
                  key={cmd}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px]"
                >
                  <span className="truncate">{cmd}</span>
                  <button
                    type="button"
                    onClick={() => copyCommand(cmd)}
                    className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                    aria-label={`Copy command ${cmd}`}
                  >
                    {copiedCmd === cmd ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
