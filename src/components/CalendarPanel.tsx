import React, { useState } from "react";
import { Task, isTaskOnDate } from "../types";
import { ChevronLeft, ChevronRight, Calendar, Plus, Clock, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CalendarPanelProps {
  tasks: Task[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onAddTaskManually: (taskData: {
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
  }) => Promise<void>;
}

export default function CalendarPanel({
  tasks,
  selectedDate,
  onSelectDate,
  onAddTaskManually
}: CalendarPanelProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    // Initialize currentMonth view with selectedDate
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date() : d;
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueTime, setDueTime] = useState("14:00");
  const [duration, setDuration] = useState(30);
  const [recurring, setRecurring] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none");
  const [stepInput, setStepInput] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [kickoffType, setKickoffType] = useState<"technical" | "professional" | "personal">("personal");
  const [kickoffContent, setKickoffContent] = useState("");

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Fill in offset days from previous month
    const startOffset = firstDay.getDay(); // 0 is Sunday
    for (let i = startOffset - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Fill in days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Fill in offset days from next month to make complete rows of 7
    const endOffset = 42 - days.length; // standard 6-row layout
    for (let i = 1; i <= endOffset; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const daysList = getDaysInMonth(currentMonth);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const formatDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDayClick = (d: Date) => {
    const formatted = formatDateString(d);
    onSelectDate(formatted);
  };

  const handleAddStep = () => {
    if (stepInput.trim()) {
      setSteps([...steps, stepInput.trim()]);
      setStepInput("");
    }
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onAddTaskManually({
      title: title.trim(),
      description: desc.trim(),
      priority,
      dueDate: selectedDate,
      dueTime,
      duration,
      steps,
      kickoffType,
      kickoffContent: kickoffContent.trim(),
      recurring
    });

    // Reset form
    setTitle("");
    setDesc("");
    setPriority("medium");
    setDueTime("14:00");
    setDuration(30);
    setRecurring("none");
    setSteps([]);
    setKickoffContent("");
    setShowAddForm(false);
  };

  const monthYearLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const todayStr = formatDateString(new Date());

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 relative bg-indigo-50 hover:bg-indigo-100/75 border border-indigo-100/50 px-2.5 py-1 rounded-xl transition-all cursor-pointer">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 font-bold" />
          <span className="text-[11px] font-bold text-indigo-700 tracking-wide font-mono uppercase">{monthYearLabel} ▾</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDate(e.target.value);
                const d = new Date(e.target.value + "T00:00:00");
                if (!isNaN(d.getTime())) {
                  setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                }
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            title="Jump to any date smoothly"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-slate-100 border border-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-slate-100 border border-slate-100 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((wd) => (
          <span key={wd} className="text-[10px] font-mono uppercase font-bold text-slate-400">
            {wd}
          </span>
        ))}
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 gap-1">
        {daysList.map(({ date, isCurrentMonth }, idx) => {
          const dateStr = formatDateString(date);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          
          // Check scheduled tasks for this day including recurring patterns
          const dayTasks = tasks.filter((t) => isTaskOnDate(t, dateStr));
          const hasTasks = dayTasks.length > 0;
          const pendingTasks = dayTasks.filter((t) => t.status === "pending");

          return (
            <button
              key={idx}
              onClick={() => handleDayClick(date)}
              className={`aspect-square w-full rounded-xl flex flex-col items-center justify-between p-1.5 transition-all relative ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm font-bold scale-105 z-10"
                  : isToday
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold hover:bg-indigo-100/50"
                  : isCurrentMonth
                  ? "text-slate-700 hover:bg-slate-50 border border-transparent"
                  : "text-slate-300 hover:bg-slate-50/50 border border-transparent"
              }`}
            >
              <span className="text-xs font-mono">{date.getDate()}</span>
              
              {/* Task Dots */}
              {hasTasks && (
                <div className="flex gap-0.5 justify-center w-full mt-0.5">
                  {pendingTasks.map((t) => {
                    let dotColor = "bg-amber-500";
                    if (t.priority === "high") dotColor = "bg-rose-500";
                    if (t.priority === "low") dotColor = "bg-slate-400";
                    if (isSelected) dotColor = "bg-white";

                    return (
                      <span
                        key={t.id}
                        className={`w-1 h-1 rounded-full ${dotColor}`}
                        title={t.title}
                      />
                    );
                  })}
                  {pendingTasks.length === 0 && dayTasks.length > 0 && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Actions */}
      <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
        <div className="text-xs">
          <span className="text-slate-400">Selected Date:</span>{" "}
          <strong className="text-slate-700 font-mono">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            })}
          </strong>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100/60 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task Here
        </button>
      </div>

      {/* Manual Task Drawer / Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Schedule Task Manually
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold"
              >
                Cancel
              </button>
            </div>

            {/* Task Title */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Task Title</label>
              <input
                type="text"
                placeholder="E.g. Schedule Pitch Deck polish, Deployment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Description</label>
              <textarea
                placeholder="Details or deliverables of the task block..."
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

             {/* Grid for Time, Duration, Priority, Recurring */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Due Time</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Duration (m)</label>
                <input
                  type="number"
                  min="5"
                  max="480"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Recurring</label>
                <select
                  value={recurring}
                  onChange={(e) => setRecurring(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-indigo-700 bg-indigo-50/50"
                >
                  <option value="none">Once (None)</option>
                  <option value="daily">Daily Reminder</option>
                  <option value="weekly">Weekly Reminder</option>
                  <option value="monthly">Monthly Reminder</option>
                  <option value="yearly">Yearly Reminder</option>
                </select>
              </div>
            </div>

            {/* Step additions */}
            <div className="space-y-1.5">
              <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Actionable Steps Checklist</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="E.g., Practice slide sequence, Refine tagline"
                  value={stepInput}
                  onChange={(e) => setStepInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddStep())}
                  className="flex-1 text-xs border border-slate-200 bg-white rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="text-xs bg-slate-900 text-white font-semibold py-2 px-3 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Add Step
                </button>
              </div>
              
              {steps.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-xl p-2 space-y-1">
                  {steps.map((st, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
                      <span className="truncate">{st}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(i)}
                        className="text-red-500 hover:text-red-700 font-bold ml-2 font-mono text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kickoff Kit Context Area (Optional) */}
            <div className="space-y-2 border-t border-slate-150 pt-2">
              <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono">
                Optional Context Kickoff Template
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {["personal", "professional", "technical"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setKickoffType(t as any)}
                    className={`text-[10px] font-semibold py-1 px-2 rounded-lg border transition-all uppercase tracking-wider font-mono ${
                      kickoffType === t
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Provide copyable code snippet, email draft, checklist, or template guidelines..."
                rows={3}
                value={kickoffContent}
                onChange={(e) => setKickoffContent(e.target.value)}
                className="w-full text-xs font-mono border border-slate-200 bg-white rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Add Task Block to Agenda
            </button>
          </motion.form>
        )}
      </AnimatePresence>

    </div>
  );
}
