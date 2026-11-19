import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, Search } from 'lucide-react';
import { C2WakeConfig, GeneratedProjectFile } from '../types/config';
import {
  downloadAndroidProjectZip,
  generateAndroidProject,
} from '../utils/androidProjectGenerator';

interface CodeExplorerProps {
  config: C2WakeConfig;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({ config }) => {
  const files = useMemo(() => generateAndroidProject(config), [config]);
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path ?? '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.path.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q)
    );
  }, [files, searchQuery]);

  const activeFile: GeneratedProjectFile =
    files.find((f) => f.path === selectedPath) ?? filteredFiles[0] ?? files[0];

  const categories = useMemo(() => {
    const map = new Map<string, GeneratedProjectFile[]>();
    for (const file of filteredFiles) {
      const list = map.get(file.category) ?? [];
      list.push(file);
      map.set(file.category, list);
    }
    return Array.from(map.entries());
  }, [filteredFiles]);

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedPath(activeFile.path);
      window.setTimeout(() => setCopiedPath(null), 1600);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await downloadAndroidProjectZip(config);
    } finally {
      setDownloading(false);
    }
  };

  const lines = activeFile ? activeFile.content.split('\n') : [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Top Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Generated Android Kotlin Project
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {files.length} source files · Targets Realme C2 (Android 9 / API 28+) · Includes Cloud APK Builder Workflow
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={downloading}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {downloading ? 'Packaging ZIP...' : 'Download Android Project (.zip)'}
        </button>
      </div>

      {/* Direct APK Clarification & 2-Minute Cloud Build Strip */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs leading-relaxed">
        <div>
          <div className="font-semibold text-slate-900">Why ZIP Instead of Direct .APK?</div>
          <p className="text-slate-600 mt-1">
            Web browsers cannot run the Android SDK/Gradle compiler to sign a binary <span className="font-mono text-slate-800">.apk</span> directly. This ZIP contains the complete ready-to-compile Kotlin project + an automatic cloud APK builder.
          </p>
        </div>
        <div>
          <div className="font-semibold text-slate-900">Get Your .APK in 2 Minutes (No PC Needed)</div>
          <p className="text-slate-600 mt-1">
            Download the ZIP, upload the unzipped files to a free GitHub repository, open the <span className="font-semibold text-slate-800">Actions</span> tab, and run <span className="font-mono text-slate-800">Build Realme APK</span> to download your signed <span className="font-mono text-slate-800">app-debug.apk</span>.
          </p>
        </div>
        <div>
          <div className="font-semibold text-slate-900">Fastest No-Build Alternative</div>
          <p className="text-slate-600 mt-1">
            Once your screen lights up, Realme 12x 5G (<span className="font-mono text-slate-800">RMX3998</span>) and Realme C2 both include built-in <span className="font-semibold text-slate-800">Double-tap to wake / turn off screen</span> in Settings—no APK compilation required.
          </p>
        </div>
      </div>

      {/* Two-Column Code Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        {/* Left File Tree */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/60 flex flex-col">
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter project files..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="p-3 space-y-4 overflow-y-auto max-h-[560px]">
            {categories.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-4 text-center">
                No files match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              categories.map(([category, groupFiles]) => (
                <div key={category}>
                  <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-500">
                    {category}
                  </div>
                  <div className="space-y-0.5">
                    {groupFiles.map((file) => {
                      const fileName = file.path.split('/').pop() ?? file.path;
                      const isSelected = activeFile?.path === file.path;
                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setSelectedPath(file.path)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-white text-slate-900 font-semibold shadow-sm border border-slate-200'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                          }`}
                        >
                          <FileCode2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-amber-600' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate font-mono text-[11px]">{fileName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="lg:col-span-8 flex flex-col bg-slate-950 text-slate-100 min-w-0">
          {activeFile && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-medium text-slate-100 truncate">
                    {activeFile.path}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{activeFile.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedPath === activeFile.path ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy File
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-auto max-h-[560px] p-4 font-mono text-xs leading-relaxed">
                <table className="w-full border-collapse">
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/60">
                        <td className="select-none pr-4 text-right text-slate-600 tabular-nums align-top w-10">
                          {idx + 1}
                        </td>
                        <td className="whitespace-pre text-slate-200">{line || ' '}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
