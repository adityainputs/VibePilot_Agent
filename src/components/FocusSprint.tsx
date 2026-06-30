import React, { useState, useEffect } from "react";
import { Play, Square, XCircle, BrainCircuit, Sparkles, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FocusSprintProps {
  onExit: () => void;
}

export default function FocusSprint({ onExit }: FocusSprintProps) {
  const [duration, setDuration] = useState(25); // In minutes
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [completed, setCompleted] = useState(false);

  // Sync seconds left when duration changes (only if timer is not active)
  useEffect(() => {
    if (!isActive) {
      setSecondsLeft(duration * 60);
    }
  }, [duration, isActive]);

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      setCompleted(true);
      // Play a subtle native browser beep if possible
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } catch (err) {
        console.warn("Audio Context beep failed", err);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsLeft]);

  const handleStartStop = () => {
    if (completed) {
      setCompleted(false);
      setSecondsLeft(duration * 60);
    }
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsLeft(duration * 60);
    setCompleted(false);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rSecs.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((duration * 60 - secondsLeft) / (duration * 60)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between p-8 md:p-12 overflow-hidden"
    >
      {/* Decorative stars / atmospheric lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-rose-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between max-w-4xl mx-auto w-full relative z-10">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-mono font-semibold tracking-widest text-slate-400 uppercase">Lockdown Focus Mode</span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          Exit Focus
        </button>
      </div>

      {/* Main Clock Stage */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2 text-emerald-400">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Focus Block Complete</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Excellent discipline. Your neural pathways thank you. Take a brief break to integrate.
              </p>
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
              >
                Reset Timer
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              {/* Pulsing breathing indicator ring */}
              <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-full border border-white/5 flex items-center justify-center mb-6">
                
                {/* Visual ripple representation */}
                <div
                  className={`absolute inset-4 rounded-full border-2 border-dashed border-indigo-500/20 transition-all duration-1000 ${
                    isActive ? "animate-spin [animation-duration:60s]" : ""
                  }`}
                />
                
                {/* Breathing ripple block */}
                {isActive && (
                  <span className="absolute inset-8 rounded-full bg-indigo-500/5 animate-pulse [animation-duration:4s]" />
                )}

                <div className="text-center relative z-10">
                  <span className="text-5xl md:text-6xl font-mono font-light tracking-tight text-white block">
                    {formatTime(secondsLeft)}
                  </span>
                  <span className="text-[10px] tracking-widest text-slate-400 uppercase font-mono font-medium block mt-2">
                    {isActive ? "Breathing / Concentrating" : "Paused"}
                  </span>
                </div>
              </div>

              {/* Minute Options Selector */}
              {!isActive && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 bg-white/5 border border-white/5 p-1 rounded-xl mb-6">
                  {[10, 25, 50, 90].map((m) => (
                    <button
                      key={m}
                      onClick={() => setDuration(m)}
                      className={`text-[10px] font-mono font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        duration === m ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {m}M
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 font-mono select-none px-1">or</span>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    placeholder="Custom"
                    value={duration !== 10 && duration !== 25 && duration !== 50 && duration !== 90 ? duration : ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setDuration(val);
                      }
                    }}
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center text-[10px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    title="Type any custom minutes duration"
                  />
                  <span className="text-[10px] text-slate-400 font-mono pr-2">mins</span>
                </div>
              )}

              {/* Active Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartStop}
                  className={`flex items-center gap-2 py-3 px-6 rounded-2xl text-xs font-semibold tracking-wide transition-all shadow-md cursor-pointer ${
                    isActive
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {isActive ? (
                    <>
                      <Square className="w-4 h-4 fill-white" />
                      Pause Sprint
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Begin Deep Focus
                    </>
                  )}
                </button>

                {(isActive || secondsLeft !== duration * 60) && (
                  <button
                    onClick={handleReset}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Reset timer"
                  >
                    <XCircle className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Focus mode footer quotes */}
      <div className="text-center relative z-10 max-w-md mx-auto py-4">
        <p className="text-[11px] text-slate-500 font-serif italic">
          "Deep work is the ability to focus without distraction on a cognitively demanding task." — Cal Newport
        </p>
      </div>

    </motion.div>
  );
}
