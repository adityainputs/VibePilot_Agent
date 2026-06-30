import React, { useState, useEffect } from "react";
import { AppState, Task, Habit, Proposal, AppNotification, Message, TaskStep } from "./types";
import ConversationalPanel from "./components/ConversationalPanel";
import TimelineView from "./components/TimelineView";
import HabitGoalTracker from "./components/HabitGoalTracker";
import NotificationsPanel from "./components/NotificationsPanel";
import FocusSprint from "./components/FocusSprint";
import CalendarPanel from "./components/CalendarPanel";
import { Sparkles, BrainCircuit, Bell, Clock, Compass, Shield, ArrowRight, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

let activeAudioContext: AudioContext | null = null;

const stopAlarmSound = () => {
  if (activeAudioContext) {
    try {
      activeAudioContext.close();
    } catch (err) {
      console.warn("Failed to close active audio context", err);
    }
    activeAudioContext = null;
  }
};

const playAlarmSound = (theme: "zen" | "energy" | "radar" = "zen") => {
  try {
    stopAlarmSound();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    activeAudioContext = ctx;
    
    // Play synthesizer sound based on selected theme
    const playTone = (freq: number, start: number, duration: number, type: "sine" | "triangle" | "sawtooth" | "square" = "sine", gainVal = 0.15) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(gainVal, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    if (theme === "zen") {
      // Warm, deep, layered pentatonic meditative tones lasting exactly 9 seconds
      playTone(130.81, ctx.currentTime, 4.0, "sine", 0.25); // C3 deep root
      playTone(196.00, ctx.currentTime + 1.0, 4.0, "sine", 0.2);  // G3
      playTone(261.63, ctx.currentTime + 2.0, 4.0, "sine", 0.18); // C4
      playTone(329.63, ctx.currentTime + 3.0, 3.5, "sine", 0.15); // E4
      playTone(392.00, ctx.currentTime + 4.0, 3.5, "sine", 0.12); // G4
      playTone(523.25, ctx.currentTime + 5.0, 3.0, "sine", 0.1);  // C5
      playTone(659.25, ctx.currentTime + 6.0, 2.5, "sine", 0.08); // E5
      playTone(783.99, ctx.currentTime + 7.0, 2.0, "sine", 0.05); // G5
    } else if (theme === "energy") {
      // Warm synth chord arpeggio progression lasting exactly 8 seconds
      const notes = [
        // Measure 1 (C Major)
        523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 523.25, 392.00,
        // Measure 2 (D Major)
        587.33, 739.99, 880.00, 1174.66, 880.00, 739.99, 587.33, 440.00,
        // Measure 3 (E Major)
        659.25, 830.61, 987.77, 1318.51, 987.77, 830.61, 659.25, 493.88,
        // Measure 4 (F Major)
        698.46, 880.00, 1046.50, 1396.91, 1046.50, 880.00, 698.46, 523.25
      ];
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.25;
        playTone(freq, start, 0.45, "triangle", 0.08);
      });
    } else {
      // 6 radar sweeps spaced every 1.3 seconds, lasting ~8 seconds
      for (let i = 0; i < 6; i++) {
        const start = ctx.currentTime + i * 1.3;
        
        // Sweeper
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(800, start);
        osc.frequency.exponentialRampToValueAtTime(1600, start + 0.3);
        
        gain.gain.setValueAtTime(0.04, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
        
        // Double pulse beep
        playTone(1500, start + 0.5, 0.15, "square", 0.04);
        playTone(1500, start + 0.7, 0.15, "square", 0.04);
      }
    }
  } catch (err) {
    console.warn("Audio alarm failed to play (user must interact first)", err);
  }
};

export default function App() {
  const [ringtoneTheme, setRingtoneTheme] = useState<"zen" | "energy" | "radar">(() => {
    return (localStorage.getItem("ringtoneTheme") as any) || "zen";
  });

  const [state, setState] = useState<AppState>({
    tasks: [],
    habits: [],
    proposals: [],
    notifications: [],
    messages: [],
    isFocusMode: false,
    focusCountdown: 0
  });

  const [activeTab, setActiveTab] = useState<"timeline" | "habits">("timeline");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  
  // Date and Calendar Tracker state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]; // Defaults to today's YYYY-MM-DD
  });

  // Currently active alarm trigger state
  const [activeAlarm, setActiveAlarm] = useState<Task | null>(null);

  // Keep track of dismissed alarm IDs so they do not repeatedly trigger
  const [dismissedAlarms, setDismissedAlarms] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem("ringtoneTheme", ringtoneTheme);
  }, [ringtoneTheme]);

  // Load state from backend on mount
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks,
          habits: data.habits,
          proposals: data.proposals,
          notifications: data.notifications,
          messages: data.messages
        }));
      }
    } catch (err) {
      console.error("Failed to load initial state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Proximity Alarms Engine - runs every 10 seconds to check active deadlines
  useEffect(() => {
    const checkDeadlines = () => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const curHour = now.getHours().toString().padStart(2, "0");
      const curMin = now.getMinutes().toString().padStart(2, "0");
      const curTimeStr = `${curHour}:${curMin}`;

      state.tasks.forEach((task) => {
        if (task.status === "pending" && task.dueDate === todayStr) {
          if (task.dueTime === curTimeStr) {
            // Check if alarm was already dismissed/acted upon
            if (dismissedAlarms.includes(task.id)) return;

            // Check if alarm already triggered to avoid duplication
            setActiveAlarm((prev) => {
              if (prev?.id === task.id) return prev;
              // Trigger alarm
              playAlarmSound(ringtoneTheme);
              // Insert custom warning notification
              setState((prevS) => {
                const alarmNotificationExists = prevS.notifications.some(n => n.id === `alarm_${task.id}`);
                if (alarmNotificationExists) return prevS;
                return {
                  ...prevS,
                  notifications: [
                    {
                      id: `alarm_${task.id}`,
                      title: `⏰ TASK ALARM: Starting Now!`,
                      message: `"${task.title}" is due at ${task.dueTime}. Check your Kickoff Kit!`,
                      type: "alert" as const,
                      timestamp: new Date().toISOString(),
                      read: false
                    },
                    ...prevS.notifications
                  ]
                };
              });
              return task;
            });
          }
        }
      });
    };

    const timer = setInterval(checkDeadlines, 10000);
    return () => clearInterval(timer);
  }, [state.tasks, dismissedAlarms]);

  // Display a custom temporary visual toast alert
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const getClientTimeInfo = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const localDate = `${yyyy}-${mm}-${dd}`;
    const localTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return { localDate, localTimeStr };
  };

  // State modification REST API post handlers
  const handleSendMessage = async (text: string) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, clientTimeInfo: getClientTimeInfo() })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.state.tasks,
          habits: data.state.habits,
          proposals: data.state.proposals,
          notifications: data.state.notifications,
          messages: data.state.messages
        }));
        
        // Check if a new proposal was generated and navigate the calendar automatically
        if (data.state.proposals.length > 0) {
          const newest = data.state.proposals[data.state.proposals.length - 1];
          if (newest.recommendedDate) {
            setSelectedDate(newest.recommendedDate);
            showToast(`Focused calendar on suggested date: ${newest.recommendedDate}`);
          }
        }
        
        playAlarmSound(ringtoneTheme);
        showToast("VibePilot processed command successfully");
      }
    } catch (err) {
      console.error("Failed to post chat command:", err);
    }
  };

  const handleApproveProposal = async (id: string, customDate?: string, customSlot?: string, customMessage?: string) => {
    try {
      // Set selected date to proposal recommended date
      const proposal = state.proposals.find(p => p.id === id);
      const targetDate = customDate || proposal?.recommendedDate || new Date().toISOString().split("T")[0];

      const res = await fetch("/api/proposals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, customDate, customSlot, customMessage })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks,
          habits: data.habits,
          proposals: data.proposals,
          notifications: data.notifications
        }));
        setSelectedDate(targetDate);
        showToast("Proposal Approved & Synced!");
        setActiveTab("timeline");
      }
    } catch (err) {
      console.error("Failed to approve proposal:", err);
    }
  };

  const handleDismissProposal = async (id: string) => {
    try {
      const res = await fetch("/api/proposals/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          proposals: data.proposals
        }));
        showToast("Proposal dismissed");
      }
    } catch (err) {
      console.error("Failed to dismiss proposal:", err);
    }
  };

  const handleToggleTask = async (taskId: string, stepId?: string) => {
    try {
      const res = await fetch("/api/tasks/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, stepId })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks
        }));
        showToast(stepId ? "Step status updated" : "Task status toggled");
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch("/api/tasks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks
        }));
        showToast("Task removed from agenda");
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  // Post manual task creation
  const handleAddTaskManually = async (taskData: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    dueDate: string;
    dueTime: string;
    duration: number;
    steps: string[];
    kickoffType: "technical" | "professional" | "personal";
    kickoffContent: string;
    recurring?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  }) => {
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks,
          notifications: data.notifications
        }));
        showToast(`Task "${taskData.title}" successfully scheduled!`);
      }
    } catch (err) {
      console.error("Failed to schedule task manually:", err);
    }
  };

  const handleUpdateSteps = async (taskId: string, steps: TaskStep[]) => {
    try {
      const res = await fetch("/api/tasks/update-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, steps })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks
        }));
        showToast("Actionable steps updated successfully!");
      }
    } catch (err) {
      console.error("Failed to update steps:", err);
    }
  };

  const handleRescheduleTask = async (taskId: string, dueTime: string, duration: number) => {
    try {
      const res = await fetch("/api/tasks/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, dueTime, duration })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks,
          notifications: data.notifications
        }));
        showToast("Task updated & schedule auto-resolved!");
      }
    } catch (err) {
      console.error("Failed to reschedule task:", err);
    }
  };

  const handleCompleteEarly = async (taskId: string) => {
    try {
      const res = await fetch("/api/tasks/complete-early", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, clientTimeInfo: getClientTimeInfo() })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks,
          notifications: data.notifications
        }));
        showToast("Task completed early & next activity pulled forward!");
      }
    } catch (err) {
      console.error("Failed to complete task early:", err);
    }
  };

  const handleReorderTasks = async (orderedIds: string[]) => {
    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          tasks: data.tasks
        }));
      }
    } catch (err) {
      console.error("Failed to reorder tasks:", err);
    }
  };

  const handleLogHabit = async (id: string) => {
    try {
      const res = await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          habits: data.habits,
          notifications: data.notifications
        }));
        showToast("Habit updated");
      }
    } catch (err) {
      console.error("Failed to log habit:", err);
    }
  };

  const handleCreateHabit = async (title: string, frequency: "daily" | "weekly") => {
    try {
      const res = await fetch("/api/habits/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, frequency })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          habits: data.habits
        }));
        showToast(`Habit "${title}" created!`);
      }
    } catch (err) {
      console.error("Failed to create habit:", err);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      const res = await fetch("/api/habits/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          habits: data.habits
        }));
        showToast("Habit deleted");
      }
    } catch (err) {
      console.error("Failed to delete habit:", err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      const res = await fetch("/api/notifications/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          notifications: data.notifications
        }));
        showToast("Alert log cleared");
      }
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const handleSimulateChange = async () => {
    try {
      const res = await fetch("/api/simulate-change", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          notifications: data.notifications
        }));
        showToast("Conflict insertion simulated!");
      }
    } catch (err) {
      console.error("Failed to simulate change:", err);
    }
  };

  const handleToggleFocusMode = () => {
    setState((prev) => ({
      ...prev,
      isFocusMode: !prev.isFocusMode
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 font-sans">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <span className="text-sm font-medium tracking-wide">Syncing state with VibePilot Core...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col antialiased selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      
      {/* Alarm Reminder Modal Overlay */}
      <AnimatePresence>
        {activeAlarm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 animate-bounce">
                <Bell className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold tracking-wider text-rose-500 uppercase bg-rose-50 px-2.5 py-1 rounded-full">
                  ⏰ Active Proximity Alarm
                </span>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mt-1">{activeAlarm.title}</h3>
                <p className="text-xs text-slate-500">{activeAlarm.description || "Your scheduled productivity block is starting now!"}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2 pb-2 border-b border-slate-200/60">
                  <span>Scheduled Time</span>
                  <span className="font-bold text-slate-700">{activeAlarm.dueTime}</span>
                </div>
                {activeAlarm.steps.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 font-mono">Immediate Steps</span>
                    {activeAlarm.steps.slice(0, 3).map((st) => (
                      <div key={st.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>{st.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

               <div className="flex gap-3">
                <button
                  onClick={() => {
                    stopAlarmSound();
                    if (activeAlarm) {
                      setDismissedAlarms((prev) => [...prev, activeAlarm.id]);
                    }
                    setActiveAlarm(null);
                    setState((prev) => ({ ...prev, isFocusMode: true }));
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Enter Focus Sprint
                </button>
                <button
                  onClick={() => {
                    stopAlarmSound();
                    if (activeAlarm) {
                      setDismissedAlarms((prev) => [...prev, activeAlarm.id]);
                    }
                    setActiveAlarm(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-3.5 px-5 rounded-xl transition-all cursor-pointer"
                >
                  Dismiss Alarm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-slate-100 px-4 py-2.5 rounded-full text-xs font-mono font-medium shadow-lg flex items-center gap-2 border border-slate-800"
          >
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-slate-100/90 py-4 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-slate-900 text-slate-100 flex items-center justify-center shadow-sm">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              VibePilot <span className="text-indigo-600 font-bold">Agent</span>
            </h1>
          </div>
        </div>

        {/* Primary Lockdown Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleFocusMode}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-xs transition-all tracking-wide border border-transparent hover:border-slate-800 cursor-pointer"
          >
            <BrainCircuit className="w-4 h-4" />
            Enter Focus Sprint
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-12 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: conversational workspace */}
        <section className="lg:col-span-7 h-[calc(100vh-140px)] min-h-[500px]">
          <ConversationalPanel
            messages={state.messages}
            proposals={state.proposals}
            existingTasks={state.tasks}
            onSendMessage={handleSendMessage}
            onApproveProposal={handleApproveProposal}
            onDismissProposal={handleDismissProposal}
          />
        </section>

        {/* Right Side: Tabbed Sidebar + Alerts Center */}
        <section className="lg:col-span-5 space-y-8 h-[calc(100vh-140px)] overflow-y-auto pr-1 scrollbar-none">
          
          {/* Tabbed Sidebar Card */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs relative">
            {/* Tabs Trigger */}
            <div className="flex items-center gap-1.5 bg-slate-100/70 p-1.5 rounded-2xl mb-6">
              <button
                onClick={() => setActiveTab("timeline")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "timeline" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline View
              </button>
              <button
                onClick={() => setActiveTab("habits")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "habits" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Habit Tracker
              </button>
            </div>

            {/* Scannable Tab content panel */}
            <div className="min-h-[220px] space-y-6">
              <AnimatePresence mode="wait">
                {activeTab === "timeline" ? (
                  <motion.div
                    key="timeline"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Interactive Calendar panel */}
                    <div className="border border-slate-100 bg-slate-50/40 rounded-2xl p-4">
                      <CalendarPanel
                        tasks={state.tasks}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        onAddTaskManually={handleAddTaskManually}
                      />
                    </div>

                    {/* Timeline heading */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Daily Timeline</h4>
                      </div>
                      <span className="text-[10px] bg-slate-100 font-mono text-slate-500 font-bold px-2 py-0.5 rounded-full">
                        {state.tasks.filter(t => t.dueDate === selectedDate).length} Items
                      </span>
                    </div>

                    <TimelineView
                      tasks={state.tasks}
                      selectedDate={selectedDate}
                      onToggleTask={handleToggleTask}
                      onDeleteTask={handleDeleteTask}
                      onUpdateSteps={handleUpdateSteps}
                      onRescheduleTask={handleRescheduleTask}
                      onCompleteEarly={handleCompleteEarly}
                      onReorderTasks={handleReorderTasks}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="habits"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HabitGoalTracker
                      habits={state.habits}
                      onLogHabit={handleLogHabit}
                      onCreateHabit={handleCreateHabit}
                      onDeleteHabit={handleDeleteHabit}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Alarm Audio Theme Settings Card */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600 animate-pulse" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Alarm Audio Theme</h4>
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">Custom Synth</span>
            </div>
            
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Choose your alarm synth preset. Tap a theme button to play a live audio preview.
            </p>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: "zen", name: "Zen Bell", desc: "Meditative" },
                { id: "energy", name: "Energy", desc: "Tech pulse" },
                { id: "radar", name: "Radar", desc: "Alert sweep" }
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setRingtoneTheme(theme.id as any);
                    playAlarmSound(theme.id as any);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center cursor-pointer ${
                    ringtoneTheme === theme.id
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 scale-102 font-bold"
                      : "bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-[11px] tracking-tight">{theme.name}</span>
                  <span className="text-[8px] opacity-70 font-mono mt-0.5">{theme.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* How VibePilot Works - Premium Explanation Guide */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">How VibePilot Works</h4>
            </div>
            
            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="flex gap-2.5 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 font-mono">1</span>
                <div>
                  <p className="font-semibold text-slate-800 leading-none">Schedule Tasks Any Time</p>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">Type or speak (e.g. <em>"schedule code deploy after 10 days at 2:30 PM"</em>). AI automatically computes dates relative to current days and checks for conflicts.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 font-mono">2</span>
                <div>
                  <p className="font-semibold text-slate-800 leading-none">Interactive Calendar Agenda</p>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">The monthly grid has task indicator dots. Click any date on the calendar to see that day's specific timeline agenda or add tasks manually.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 font-mono">3</span>
                <div>
                  <p className="font-semibold text-slate-800 leading-none">Approving AI Proposals</p>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">When the AI suggests scheduling, it drafts a Proposal card. Click <strong>Approve</strong>, and it translates into a live timeline task synced on the calendar.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 font-mono">4</span>
                <div>
                  <p className="font-semibold text-slate-800 leading-none">Proximity Alarms & Chimes</p>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">When a scheduled slot begins, VibePilot plays a dual-tone synth notification chime and opens a screen-wide alarm override to help you switch focus.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Automated Notification / Alert Center */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
            <NotificationsPanel
              notifications={state.notifications}
              onClear={handleClearNotifications}
              onSimulateChange={handleSimulateChange}
            />
          </div>

        </section>

      </main>

      {/* Safe Lockdown Immersive Focus Mode Overlay */}
      <AnimatePresence>
        {state.isFocusMode && (
          <FocusSprint onExit={handleToggleFocusMode} />
        )}
      </AnimatePresence>

    </div>
  );
}
