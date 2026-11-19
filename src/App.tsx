import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Download,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { C2WakeConfig, DEFAULT_CONFIG } from './types/config';
import { ConfigPanel } from './components/ConfigPanel';
import { RealmeC2Simulator } from './components/RealmeC2Simulator';
import { CodeExplorer } from './components/CodeExplorer';
import { RealmeSetupGuide } from './components/RealmeSetupGuide';
import { BlackScreenRescue } from './components/BlackScreenRescue';
import { downloadAndroidProjectZip } from './utils/androidProjectGenerator';

type WorkspaceTab = 'rescue' | 'simulator' | 'code' | 'setup';

const CONFIG_STORAGE_KEY = 'c2_wake_config_v1';

function describeKey(key: C2WakeConfig['wakeKey']): string {
  if (key === 'VOL_UP') return 'Vol +';
  if (key === 'VOL_DOWN') return 'Vol −';
  return 'Vol + or −';
}

function describeWake(cfg: C2WakeConfig): string {
  const gesture =
    cfg.wakeGesture === 'SINGLE_CLICK'
      ? 'Single Click'
      : cfg.wakeGesture === 'DOUBLE_CLICK'
        ? 'Double Click'
        : `Hold ${cfg.longPressDurationMs} ms`;
  return `${gesture} · ${describeKey(cfg.wakeKey)}`;
}

function describeLock(cfg: C2WakeConfig): string {
  if (cfg.lockGesture === 'DISABLED') return 'Notification Only';
  if (cfg.lockGesture === 'CHORD') return 'Vol + & − Together';
  const gesture =
    cfg.lockGesture === 'DOUBLE_CLICK' ? 'Double Click' : `Hold ${cfg.longPressDurationMs} ms`;
  return `${gesture} · ${describeKey(cfg.lockKey)}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('rescue');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const [config, setConfig] = useState<C2WakeConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to default config
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota issues
    }
  }, [config]);

  const handleExportProject = async () => {
    setIsExporting(true);
    try {
      await downloadAndroidProjectZip(config);
      setExportSuccess(true);
      window.setTimeout(() => setExportSuccess(false), 2400);
    } finally {
      setIsExporting(false);
    }
  };

  const navItems: { id: WorkspaceTab; label: string; icon: typeof Sliders }[] = [
    { id: 'rescue', label: 'Black Screen Rescue', icon: ShieldAlert },
    { id: 'simulator', label: 'Simulator & Controls', icon: Sliders },
    { id: 'code', label: 'Android Source & APK', icon: Code2 },
    { id: 'setup', label: 'Realme C2 Setup', icon: CheckCircle2 },
  ];

  const activeNavLabel =
    navItems.find((item) => item.id === activeTab)?.label ?? 'Black Screen Rescue';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (248px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[248px] lg:shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
            C2 Wake Studio
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Workspace sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quiet Hardware Target Metadata */}
        <div className="p-5 border-t border-slate-200 text-xs space-y-2">
          <div className="font-semibold text-slate-900">Target Hardware Profile</div>
          <div className="text-slate-500 leading-relaxed space-y-1">
            <div>Realme C2 · RMX1941 / RMX1945</div>
            <div>ColorOS 6 · Android 9 Pie (API 28)</div>
            <div className="tabular-nums">6.1&quot; Dewdrop LCD · 4000 mAh</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb Left — Single Primary CTA Right */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="lg:hidden font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0">
              C2 Wake Studio
            </span>
            <span className="hidden lg:inline text-slate-400 whitespace-nowrap shrink-0">
              Realme C2
            </span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">
              /
            </span>
            <span className="font-medium text-slate-900 truncate">{activeNavLabel}</span>
          </div>

          <button
            type="button"
            onClick={handleExportProject}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isExporting
                ? 'Packaging...'
                : exportSuccess
                  ? 'Project Downloaded'
                  : 'Download Android Project'}
            </span>
          </button>
        </header>

        {/* Mobile / Tablet Navigation Bar (Non-sticky to honor 15% mobile sticky cap) */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Main Viewport */}
        <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Page Intro & Active Configuration Summary Strip */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900">
                  {activeTab === 'rescue'
                    ? 'Realme C2 Black Screen Diagnostics & Rescue'
                    : 'Volume-Button Screen Controller for Realme C2'}
                </h1>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {activeTab === 'rescue'
                    ? 'Diagnose why your Realme C2 vibrates on calls while staying black, force-restart without a working power button, or mirror and back up your phone on a PC.'
                    : 'Replace a broken physical power button by mapping single or double clicks on the left-edge Volume keys to wake and lock your screen. Test the exact timing live, then download the complete Android Kotlin project with built-in cloud APK compilation.'}
                </p>
              </div>
            </div>

            {/* 4-Column Flat Spec Strip (Single Elevation, Clean Hairlines, Tabular Numerals) */}
            {activeTab !== 'rescue' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Turn Screen On</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums truncate">
                    {describeWake(config)}
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Turn Screen Off</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums truncate">
                    {describeLock(config)}
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Double-Click Window</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5 font-mono tabular-nums">
                    {config.doubleClickWindowMs} ms
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Screen-Off Engine</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                    {config.wakeEngine === 'MEDIA_SESSION'
                      ? 'MediaSession (Low Drain)'
                      : 'WakeLock KeyFilter'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Workspace Content */}
          {activeTab === 'rescue' && <BlackScreenRescue />}

          {activeTab === 'simulator' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7">
                <ConfigPanel config={config} onChange={setConfig} />
              </div>
              <div className="xl:col-span-5 xl:sticky xl:top-24">
                <RealmeC2Simulator config={config} />
              </div>
            </div>
          )}

          {activeTab === 'code' && <CodeExplorer config={config} />}

          {activeTab === 'setup' && <RealmeSetupGuide config={config} />}
        </main>
      </div>
    </div>
  );
}
