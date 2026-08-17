import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Timer, Clock, Check, Zap, Sparkles } from 'lucide-react';

interface StopwatchProps {
  onTimeCaptured: (timeInMs: number, timeFormatted: string) => void;
  initialTimeMs?: number;
}

export const Stopwatch: React.FC<StopwatchProps> = ({ onTimeCaptured, initialTimeMs = 0 }) => {
  const [timeMs, setTimeMs] = useState<number>(initialTimeMs);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Dedicated Minute & Second state for fast typing
  const [minStr, setMinStr] = useState<string>('');
  const [secStr, setSecStr] = useState<string>('');

  const minInputRef = useRef<HTMLInputElement>(null);
  const secInputRef = useRef<HTMLInputElement>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Sync initialTimeMs on mount or prop change
  useEffect(() => {
    setTimeMs(initialTimeMs);
    if (initialTimeMs === 0) {
      setMinStr('');
      setSecStr('');
      setIsRunning(false);
    } else {
      const m = Math.floor(initialTimeMs / 60000);
      const s = Math.floor((initialTimeMs % 60000) / 1000);
      setMinStr(String(m).padStart(2, '0'));
      setSecStr(String(s).padStart(2, '0'));
    }
  }, [initialTimeMs]);

  // Stopwatch timer loop
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = performance.now() - timeMs;
      const updateTimer = () => {
        const now = performance.now();
        const elapsed = Math.max(0, Math.floor(now - startTimeRef.current));
        setTimeMs(elapsed);
        timerRef.current = requestAnimationFrame(updateTimer);
      };
      timerRef.current = requestAnimationFrame(updateTimer);
    } else if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
    }

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isRunning, timeMs]);

  const formatTimeParts = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return {
      mm: String(minutes).padStart(2, '0'),
      ss: String(seconds).padStart(2, '0'),
    };
  };

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    // Round to nearest second for clean minute and second storage
    const totalSec = Math.floor(timeMs / 1000);
    const roundedMs = totalSec * 1000;
    const parts = formatTimeParts(roundedMs);
    const formatted = `${parts.mm}:${parts.ss}`;
    setTimeMs(roundedMs);
    setMinStr(parts.mm);
    setSecStr(parts.ss);
    onTimeCaptured(roundedMs, formatted);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeMs(0);
    setMinStr('');
    setSecStr('');
    onTimeCaptured(0, '00:00');
    minInputRef.current?.focus();
  };

  // Helper to sync state to parent
  const updateCapturedTime = (mVal: string, sVal: string) => {
    const m = parseInt(mVal || '0', 10) || 0;
    const s = parseInt(sVal || '0', 10) || 0;
    const safeSec = Math.min(59, Math.max(0, s));
    const totalMs = (m * 60000) + (safeSec * 1000);
    const mmFormatted = String(m).padStart(2, '0');
    const ssFormatted = String(safeSec).padStart(2, '0');
    
    setTimeMs(totalMs);
    onTimeCaptured(totalMs, `${mmFormatted}:${ssFormatted}`);
  };

  // Handle Minute Input with Auto-Advance to Seconds
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');

    // Support paste of 3 or 4 digits (e.g. "0530" or "1245")
    if (val.length >= 3) {
      const mPart = val.slice(0, val.length - 2);
      const sPart = val.slice(val.length - 2);
      const mPad = String(parseInt(mPart, 10) || 0).padStart(2, '0');
      const sSafe = Math.min(59, parseInt(sPart, 10) || 0);
      const sPad = String(sSafe).padStart(2, '0');
      
      setMinStr(mPad);
      setSecStr(sPad);
      updateCapturedTime(mPad, sPad);
      secInputRef.current?.focus();
      secInputRef.current?.select();
      return;
    }

    // Limit to max 2 digits
    const cleaned = val.slice(0, 2);
    setMinStr(cleaned);

    if (cleaned.length === 2) {
      // 2 digits typed: Auto-advance to seconds!
      // If second is empty, default to "00"
      const currentSec = secStr !== '' ? secStr : '00';
      setSecStr(currentSec);
      updateCapturedTime(cleaned, currentSec);

      // Shift focus to Second input and auto-select
      setTimeout(() => {
        secInputRef.current?.focus();
        secInputRef.current?.select();
      }, 10);
    } else if (cleaned.length === 1) {
      updateCapturedTime(cleaned, secStr || '00');
    } else if (cleaned.length === 0) {
      if (secStr) {
        updateCapturedTime('00', secStr);
      } else {
        setTimeMs(0);
        onTimeCaptured(0, '00:00');
      }
    }
  };

  // Handle Minute Keydown (Tab, Colon, Dot, Enter, Arrow navigation)
  const handleMinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ':' || e.key === '.' || e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (minStr.length === 1) {
        const padded = '0' + minStr;
        setMinStr(padded);
        const currentSec = secStr !== '' ? secStr : '00';
        setSecStr(currentSec);
        updateCapturedTime(padded, currentSec);
      } else if (minStr.length === 0) {
        setMinStr('00');
        const currentSec = secStr !== '' ? secStr : '00';
        setSecStr(currentSec);
        updateCapturedTime('00', currentSec);
      }
      secInputRef.current?.focus();
      secInputRef.current?.select();
    }
  };

  const handleMinBlur = () => {
    if (minStr.length === 1) {
      const padded = '0' + minStr;
      setMinStr(padded);
      updateCapturedTime(padded, secStr || '00');
    }
  };

  // Handle Second Input
  const handleSecChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const cleaned = val.slice(0, 2);
    
    // Check if value > 59, clamp to 59 if user typed something like 75
    let numVal = parseInt(cleaned, 10);
    let finalSec = cleaned;
    if (!isNaN(numVal) && numVal > 59) {
      finalSec = '59';
    }

    setSecStr(finalSec);

    const effectiveMin = minStr !== '' ? minStr : '00';
    if (minStr === '') {
      setMinStr('00');
    }

    if (finalSec.length > 0) {
      updateCapturedTime(effectiveMin, finalSec);
    } else {
      updateCapturedTime(effectiveMin, '00');
    }
  };

  // Handle Second Keydown (Backspace to return to Minute, ArrowLeft)
  const handleSecKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && (secStr === '' || (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === secStr.length))) {
      e.preventDefault();
      setSecStr('');
      minInputRef.current?.focus();
      minInputRef.current?.select();
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      minInputRef.current?.focus();
    }
  };

  const handleSecBlur = () => {
    if (secStr.length === 1) {
      const padded = '0' + secStr;
      setSecStr(padded);
      updateCapturedTime(minStr || '00', padded);
    }
  };

  const applyPreset = (m: number, s: number) => {
    setIsRunning(false);
    const mmStr = String(m).padStart(2, '0');
    const ssStr = String(s).padStart(2, '0');
    setMinStr(mmStr);
    setSecStr(ssStr);
    
    const totalMs = (m * 60000) + (s * 1000);
    setTimeMs(totalMs);
    onTimeCaptured(totalMs, `${mmStr}:${ssStr}`);
  };

  const { mm, ss } = formatTimeParts(timeMs);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 text-amber-400 text-xs uppercase tracking-wider font-extrabold">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>PENCATAT WAKTU (STOPWATCH & KETIK MENIT:DETIK)</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${isRunning ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
          {isRunning ? '▶ RUNNING' : '⏸ IDLE'}
        </span>
      </div>

      {/* BLOCK 1: INPUT KETIK CEPAT OTOMATIS BERPINDAH (AUTO-ADVANCE MM:SS) */}
      <div className="space-y-3 bg-slate-950/90 p-4 rounded-2xl border-2 border-amber-500/40 shadow-inner">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Ketik Waktu (Auto-Pindah Menit ➔ Detik)</span>
          </label>
          <span className="text-[10px] font-bold text-amber-400/90 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Ketik 2 angka langsung pindah
          </span>
        </div>

        {/* Big Dual-Input Boxes */}
        <div className="bg-slate-900/90 p-3 sm:p-4 rounded-xl border border-slate-700/80 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 select-none">
            {/* Minute Box */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                MENIT
              </span>
              <input
                ref={minInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={minStr}
                onChange={handleMinChange}
                onKeyDown={handleMinKeyDown}
                onBlur={handleMinBlur}
                placeholder="00"
                className="w-20 sm:w-24 h-16 sm:h-20 text-center text-3xl sm:text-4xl font-mono font-black text-amber-400 bg-slate-950 border-2 border-amber-500/60 rounded-xl focus:border-amber-400 focus:ring-4 focus:ring-amber-500/30 focus:outline-none transition-all placeholder:text-slate-700 shadow-inner"
              />
            </div>

            {/* Separator Colon */}
            <div className="text-3xl sm:text-4xl font-mono font-black text-amber-400/80 pt-4 animate-pulse">
              :
            </div>

            {/* Second Box */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                DETIK (0-59)
              </span>
              <input
                ref={secInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={secStr}
                onChange={handleSecChange}
                onKeyDown={handleSecKeyDown}
                onBlur={handleSecBlur}
                placeholder="00"
                className="w-20 sm:w-24 h-16 sm:h-20 text-center text-3xl sm:text-4xl font-mono font-black text-sky-400 bg-slate-950 border-2 border-sky-500/60 rounded-xl focus:border-sky-400 focus:ring-4 focus:ring-sky-500/30 focus:outline-none transition-all placeholder:text-slate-700 shadow-inner"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2.5 text-center font-medium">
            💡 Contoh: Ketik <strong className="text-amber-300 font-mono">05</strong> (otomatis jadi 05:00 & pindah kursor), lalu ketik <strong className="text-sky-300 font-mono">30</strong> ➔ <strong className="text-emerald-400 font-mono">05:30</strong>.
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
            Pilihan Cepat (Klik untuk isi instan):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '00:30 (30 Dtk)', m: 0, s: 30 },
              { label: '01:00 (1 Mnt)', m: 1, s: 0 },
              { label: '02:00 (2 Mnt)', m: 2, s: 0 },
              { label: '03:00 (3 Mnt)', m: 3, s: 0 },
              { label: '05:00 (5 Mnt)', m: 5, s: 0 },
              { label: '06:30 (6½ Mnt)', m: 6, s: 30 },
              { label: '10:00 (10 Mnt)', m: 10, s: 0 },
              { label: '12:45 (12m 45s)', m: 12, s: 45 },
            ].map((p) => (
              <button
                key={`${p.m}_${p.s}`}
                type="button"
                onClick={() => applyPreset(p.m, p.s)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-all cursor-pointer hover:border-amber-400/50"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* BLOCK 2: DIGITAL STOPWATCH TIMER (START / STOP) */}
      <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1 text-sky-400">
            <Timer className="w-3.5 h-3.5" />
            Atau Gunakan Stopwatch Timer Otomatis
          </span>
          <span className="text-[10px] text-slate-400 font-normal">Format: {mm} : {ss}</span>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START TIMER ({mm}:{ss})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="col-span-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>STOP & REKAM WAKTU</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* Captured Result Summary Bar */}
      {timeMs > 0 && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs flex items-center justify-between text-emerald-200 font-medium">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Waktu Terpilih:</span>
            <strong className="font-mono text-white text-base bg-emerald-900 px-2.5 py-0.5 rounded border border-emerald-700 font-black">
              {mm}:{ss}
            </strong>
            <span className="text-[11px] text-emerald-300">
              ({Math.floor(timeMs / 60000)} Menit {Math.floor((timeMs % 60000) / 1000)} Detik)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
