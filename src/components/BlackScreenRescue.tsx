import React, { useState } from 'react';
import {
  Check,
  Copy,
  Flashlight,
  Laptop,
  RefreshCw,
  RotateCcw,
  Wrench,
  AlertTriangle,
} from 'lucide-react';

type TriState = 'unanswered' | 'yes' | 'no';

interface TriageAnswers {
  flashlightImage: TriState;
  chargerLogo: TriState;
  pcDetectsUsb: TriState;
}

const INITIAL_ANSWERS: TriageAnswers = {
  flashlightImage: 'unanswered',
  chargerLogo: 'unanswered',
  pcDetectsUsb: 'unanswered',
};

interface Verdict {
  title: string;
  likelihood: string;
  explanation: string;
  nextSteps: string[];
  canInstallAppNow: boolean;
}

function computeVerdict(answers: TriageAnswers): Verdict {
  if (answers.flashlightImage === 'yes') {
    return {
      title: 'Display Backlight Failed (LCD & Touch Likely Working)',
      likelihood: 'Hardware · Backlight LED or Backlight IC',
      explanation:
        'Your Realme C2 is booting, receiving calls, and drawing pixels, but the backlight illumination behind the 6.1" IPS LCD has failed. Because calls normally wake Android screens automatically without using the power button, a power-button app cannot turn on a dead backlight.',
      nextSteps: [
        'Keep the phone powered on — under a bright flashlight at an angle you may still be able to unlock the screen and back up photos or WhatsApp.',
        'Connect to a PC via Micro-USB to copy DCIM / WhatsApp folders once unlocked.',
        'Ask a repair technician to check the Realme C2 LCD backlight filter/connector or replace the display assembly (and replace the broken power flex strip at the same time).',
      ],
      canInstallAppNow: false,
    };
  }

  if (answers.chargerLogo === 'yes') {
    return {
      title: 'Display Hardware Works — ColorOS 6 Software Display Freeze',
      likelihood: 'Software · Compositor Hang / Power Switch Stuck',
      explanation:
        'If the charging icon or Recovery menu lights up when plugged in, your Realme C2 screen is physically healthy! The black screen during calls is caused by a ColorOS 6 display hang or a shorted/stuck broken power button constantly forcing the screen back to sleep.',
      nextSteps: [
        'Let the battery drain completely until vibration stops, charge for 15 minutes, then hold Volume Down while plugging in the USB cable to enter ColorOS Recovery -> tap Reboot.',
        'Once it boots normally, immediately enable Settings -> Convenience Aid -> Screen-Off Gestures -> Double Tap to Turn Screen On.',
        'If the screen turns off again immediately after waking, have the jammed power button flex cable disconnected or replaced so it stops sending phantom off signals.',
      ],
      canInstallAppNow: true,
    };
  }

  if (
    answers.flashlightImage === 'no' &&
    answers.chargerLogo === 'no' &&
    answers.pcDetectsUsb === 'yes'
  ) {
    return {
      title: 'Motherboard Alive — LCD Panel or Display Flex Disconnected',
      likelihood: 'Hardware · Display Flex / IPS Panel Failure',
      explanation:
        'Because your phone vibrates on calls and your computer detects it over USB, your motherboard and data are intact. However, since neither incoming calls nor the charger show any image even under a flashlight, the Realme C2 display panel or its internal ribbon connector has failed.',
      nextSteps: [
        'Do NOT factory reset the phone — your photos, contacts, and WhatsApp data are still safely stored inside.',
        'If USB Debugging was previously enabled, use the scrcpy commands below on a PC to view and control your Realme C2 screen on your monitor right now.',
        'Take the Realme C2 to a repair shop to reseat the display flex connector first (often comes loose after drops) or test a replacement Realme C2 (RMX1941) LCD + power button flex.',
      ],
      canInstallAppNow: false,
    };
  }

  if (
    answers.flashlightImage === 'no' &&
    answers.chargerLogo === 'no' &&
    answers.pcDetectsUsb === 'no'
  ) {
    return {
      title: 'Display Hardware Fault or Deep Frozen State',
      likelihood: 'Hardware LCD / Loose Flex or Frozen MediaTek Boot State',
      explanation:
        'Incoming phone and WhatsApp calls automatically wake a healthy Android display without touching the power button. Since the phone vibrates occasionally but stays pitch black under a flashlight and shows no charging icon, the display ribbon or LCD panel is likely faulty (or the phone is stuck in a frozen vibration loop).',
      nextSteps: [
        'Try a completely different data-capable Micro-USB cable on a PC (charge-only cables will not trigger USB detection).',
        'Wait for the battery to drain completely so the device hard-resets without needing the power button, then charge for 15 minutes and check if the green ColorOS battery icon appears.',
        'If no charging battery graphic appears on screen at all, a software app cannot fix the black screen — the display flex cable or LCD needs physical inspection/replacement.',
      ],
      canInstallAppNow: false,
    };
  }

  return {
    title: 'Complete the 3 Hardware Checks Above to Pinpoint the Cause',
    likelihood: 'Interactive Diagnosis · Realme C2 (RMX1941)',
    explanation:
      'Because a normal or WhatsApp call wakes a working Android screen automatically even with a broken power button, a screen that stays black while vibrating usually points to either a display backlight/LCD fault or a ColorOS 6 display freeze. Answer the 3 quick tests above for an exact recovery plan.',
    nextSteps: [
      'Run the 10-second Flashlight Test while calling your Realme C2 from another phone.',
      'Plug in a Micro-USB charger and watch whether any charging animation lights up.',
      'Plug into a Windows/Mac computer to verify whether the motherboard responds over USB.',
    ],
    canInstallAppNow: false,
  };
}

export const BlackScreenRescue: React.FC = () => {
  const [answers, setAnswers] = useState<TriageAnswers>(INITIAL_ANSWERS);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const verdict = computeVerdict(answers);
  const answeredCount = Object.values(answers).filter((v) => v !== 'unanswered').length;

  const setAnswer = (field: keyof TriageAnswers, value: TriState) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Clipboard blocked
    }
  };

  const questions: {
    field: keyof TriageAnswers;
    step: string;
    title: string;
    instruction: string;
    icon: typeof Flashlight;
  }[] = [
    {
      field: 'flashlightImage',
      step: 'Test 01',
      title: 'Bright Flashlight Test (Checks Backlight vs. Dead LCD)',
      instruction:
        'Call your Realme C2 from another phone so it vibrates. In a dark room, hold a bright flashlight almost flat against the glass at a 45° angle. Do you see a very dim lock screen or caller name?',
      icon: Flashlight,
    },
    {
      field: 'chargerLogo',
      step: 'Test 02',
      title: 'Charger & Volume-Down Cold Boot Check',
      instruction:
        'Unplug the phone, hold Volume Down, and plug the Micro-USB charger in. Does the screen light up at all with a battery icon, Realme logo, or ColorOS Recovery menu?',
      icon: RefreshCw,
    },
    {
      field: 'pcDetectsUsb',
      step: 'Test 03',
      title: 'Computer USB Detection Check',
      instruction:
        'Plug the Realme C2 into a laptop or desktop PC with a working data Micro-USB cable. Does the computer make a connection sound or list Realme C2 / RMX1941 / MediaTek in Device Manager?',
      icon: Laptop,
    },
  ];

  const adbCommands = [
    {
      id: 'devices',
      label: '1. Check if Realme C2 responds over USB (ADB)',
      cmd: 'adb devices',
    },
    {
      id: 'reboot',
      label: '2. Force-reboot Realme C2 without a working power button',
      cmd: 'adb reboot',
    },
    {
      id: 'mirror',
      label: '3. Mirror & control the black-screen phone on your PC monitor (scrcpy)',
      cmd: 'scrcpy --turn-screen-off=false --stay-awake',
    },
    {
      id: 'install',
      label: '4. Install C2 Wake APK directly from PC without touching phone screen',
      cmd: 'adb install -r app-debug.apk',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Immediate Clarification & Find Hub Rang-Without-Light Diagnosis */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Find My Device Rang &amp; Phone Is Charging, But Screen Stayed Black
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
              This confirms the motherboard, battery, speaker, and internet are working—<span className="font-semibold text-slate-900">and rules out the broken power button as the sole cause</span>, because both Find Hub &ldquo;Play sound&rdquo; and plugging in a charger automatically wake a healthy display. Also note: model <span className="font-mono font-semibold text-slate-900">RMX3998</span> is the <span className="font-semibold text-slate-900">Realme 12x 5G</span> (6.72&quot; IPS LCD, USB-C, Android 14, side fingerprint sensor).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs text-slate-700 leading-relaxed">
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">
              1. Do NOT Tap &ldquo;Factory reset&rdquo;
            </div>
            <p className="text-slate-600">
              Never use &ldquo;Factory reset&rdquo; in Google Find Hub. It will permanently erase photos and WhatsApp chats without fixing a dead backlight or loose display ribbon.
            </p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">
              2. Side Fingerprint + Flashlight Check
            </div>
            <p className="text-slate-600">
              On <span className="font-mono text-slate-900">RMX3998</span>, rest her registered finger lightly on the side sensor (no click needed) while shining a bright flashlight at 45° onto the glass in a dark room to check for dim icons.
            </p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">
              3. Hardware Flex / LCD Service Needed
            </div>
            <p className="text-slate-600">
              If unplugging/re-plugging USB-C and resting a finger show zero light, ask a technician to reseat the <span className="font-mono text-slate-900">RMX3998</span> LCD flex cable first and inspect the side power/fingerprint flex—with data kept intact.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive 3-Test Hardware Triage */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div className="px-6 py-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Interactive Realme C2 Black-Screen Triage
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {answeredCount} of 3 hardware checks answered
              </p>
            </div>
            {answeredCount > 0 && (
              <button
                type="button"
                onClick={() => setAnswers(INITIAL_ANSWERS)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Tests
              </button>
            )}
          </div>

          {questions.map((q) => {
            const Icon = q.icon;
            const current = answers[q.field];
            return (
              <div key={q.field} className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500 font-medium">{q.step}</div>
                    <h4 className="text-sm font-semibold text-slate-900 mt-0.5">{q.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{q.instruction}</p>
                  </div>
                </div>

                <div className="pl-11 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAnswer(q.field, 'yes')}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      current === 'yes'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Yes, I see / hear it
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswer(q.field, 'no')}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      current === 'no'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    No, completely blank / unresponsive
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Diagnosis Verdict Panel */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5 xl:sticky xl:top-24">
          <div className="space-y-1.5 pb-4 border-b border-slate-100">
            <div className="text-xs font-medium text-amber-800">{verdict.likelihood}</div>
            <h3 className="text-base font-semibold text-slate-900">{verdict.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">{verdict.explanation}</p>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-900">Recommended Next Steps</div>
            <ol className="space-y-2.5 text-xs text-slate-700 list-decimal list-inside leading-relaxed">
              {verdict.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-800">Can a volume-wake app fix this right now? </span>
            {verdict.canInstallAppNow
              ? 'Yes — once the phone reboots cleanly and the display lights up again, install C2 Wake so you never have to rely on the damaged power button.'
              : 'Not until the display lights up. An Android app can wake software sleep, but it cannot power a disconnected or physically burned-out LCD backlight.'}
          </div>
        </div>
      </div>

      {/* Recovery Playbooks: PC Rescue & No-Power-Button Force Reboot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Playbook A: Force Reboot Without Power Button */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-900">
              01. Force-Restart a Frozen Realme C2 Without a Power Button
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            If ColorOS 6 froze with the screen black (which explains random vibration without ringing or display output), a normal phone would hold Power + Volume Up for 10 seconds. With a broken power button, use this cold-boot method:
          </p>
          <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              <span className="font-semibold text-slate-900">Check Silent / Vibrate &amp; Stuck Button:</span>{' '}
              Tap Volume Up 5–10 times rapidly to see if the ringer volume turns up when you call it again, and inspect the right-side power key to make sure it isn&apos;t jammed inward.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Full Battery Drain Reset:</span>{' '}
              Leave the phone unplugged until it stops vibrating completely when called (battery hits 0%, forcing a clean motherboard shutdown).
            </li>
            <li>
              <span className="font-semibold text-slate-900">Charger + Volume Down Boot:</span>{' '}
              Charge for 15 minutes, unplug, then hold <span className="font-semibold text-slate-900">Volume Down</span> while plugging the charger back in. If the screen shows the Realme logo or ColorOS Recovery, tap <span className="font-semibold text-slate-900">Reboot</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Hardware Confirmation:</span>{' '}
              If the screen stays pitch black even when plugging in the charger after a full drain, the LCD panel or internal display flex cable needs repair.
            </li>
          </ol>
        </div>

        {/* Playbook B: PC USB Rescue & Screen Mirroring */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Laptop className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-900">
              02. View Screen &amp; Recover Data on a PC (ADB + scrcpy)
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            If USB Debugging was previously enabled on your Realme C2, you can mirror the display onto a computer monitor using free open-source <span className="font-mono text-slate-800">scrcpy</span>, back up your WhatsApp/photos, or install the C2 Wake APK directly over USB:
          </p>

          <div className="space-y-2.5">
            {adbCommands.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="text-[11px] font-medium text-slate-600">{item.label}</div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px]">
                  <span className="truncate">{item.cmd}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.cmd)}
                    aria-label={`Copy ${item.cmd}`}
                    className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    {copiedKey === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Repair Shop Checklist */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">
            03. What to Tell a Local Repair Shop (Save Money &amp; Protect Your Data)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1 text-xs text-slate-600 leading-relaxed">
          <div>
            <div className="font-semibold text-slate-900 mb-1">
              Ask to Reseat the Display Flex First
            </div>
            On the Realme C2 (RMX1941), a drop can loosen the LCD ribbon cable inside the plastic back cover. Re-clipping the connector takes 5 minutes and costs far less than a new screen.
          </div>
          <div>
            <div className="font-semibold text-slate-900 mb-1">
              Replace the Power Flex While Opened
            </div>
            Since the technician already opens the back cover to inspect the display, replacing the Realme C2 power button flex strip at the same time is very inexpensive and fixes both issues permanently.
          </div>
          <div>
            <div className="font-semibold text-slate-900 mb-1">
              Refuse a Factory Reset
            </div>
            Display replacement or flex reseating never requires wiping the phone. Tell the shop to keep your data intact so your WhatsApp chats and gallery remain untouched.
          </div>
        </div>
      </div>
    </div>
  );
};
