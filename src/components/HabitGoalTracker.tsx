import React, { useState } from "react";
import { Habit } from "../types";
import { Flame, CheckCircle2, Circle, Plus, Sparkles, Trash2 } from "lucide-react";
import { motion } from "motion/react";

interface HabitGoalTrackerProps {
  habits: Habit[];
  onLogHabit: (id: string) => void;
  onCreateHabit: (title: string, frequency: "daily" | "weekly") => void;
  onDeleteHabit?: (id: string) => void;
}

export default function HabitGoalTracker({ habits, onLogHabit, onCreateHabit, onDeleteHabit }: HabitGoalTrackerProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newFreq, setNewFreq] = useState<"daily" | "weekly">("daily");
  const [showAdd, setShowAdd] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateHabit(newTitle.trim(), newFreq);
    setNewTitle("");
    setShowAdd(false);
  };

  const today = new Date().toISOString().split("T")[0];

  // Helper to get past 7 days to show in the visual progress matrix
  const getPastSevenDays = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  const pastSevenDays = getPastSevenDays();

  // Helper to get past 4 weeks
  const getPastFourWeeks = () => {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date();
      // Adjust offset to cover a full 7-day week
      start.setDate(start.getDate() - (i * 7 + 6));
      const end = new Date();
      end.setDate(end.getDate() - (i * 7));
      
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      
      const days = [];
      const currentDay = new Date(start);
      // Generate the 7 days of this specific week range
      for (let dIdx = 0; dIdx < 7; dIdx++) {
        days.push(currentDay.toISOString().split("T")[0]);
        currentDay.setDate(currentDay.getDate() + 1);
      }
      
      weeks.push({
        label: i === 0 ? "This Week" : `${i}w ago`,
        startStr,
        endStr,
        days
      });
    }
    return weeks;
  };

  const pastFourWeeks = getPastFourWeeks();

  return (
    <div className="space-y-6">
      {/* Habit Creation Overlay or Trigger */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Atomic Habits</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 border border-indigo-100/55 px-2.5 py-1 rounded-xl cursor-pointer shadow-2xs hover:scale-105"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Habit
        </button>
      </div>

      {showAdd && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl space-y-3"
        >
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">Habit Title</label>
            <input
              type="text"
              placeholder="E.g., Read 10 Pages, Stay Hydrated"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full text-xs border border-slate-200 bg-white rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">Frequency</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewFreq("daily")}
                  className={`text-[10px] font-semibold py-1 px-3 rounded-md border transition-colors cursor-pointer ${
                    newFreq === "daily" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setNewFreq("weekly")}
                  className={`text-[10px] font-semibold py-1 px-3 rounded-md border transition-colors cursor-pointer ${
                    newFreq === "weekly" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-2 px-4 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Create
            </button>
          </div>
        </motion.form>
      )}

      {/* Habits List */}
      <div className="space-y-4">
        {habits.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            <Sparkles className="w-7 h-7 text-indigo-400 mb-2" />
            <h4 className="text-xs font-semibold text-slate-700">Clean Slate</h4>
            <p className="text-[11px] text-slate-400 max-w-[200px] mt-1">
              No habits set up yet. Tap "Add Habit" above to build your daily atomic ritual!
            </p>
          </div>
        )}

        {habits.map((habit) => {
          const isCompletedToday = habit.completedDays.includes(today);

          return (
            <motion.div
              key={habit.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 tracking-tight truncate">{habit.title}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                      {habit.frequency}
                    </span>
                    {habit.streak > 0 && (
                      <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded-md font-mono">
                        <Flame className="w-3 h-3 fill-amber-500" />
                        {habit.streak}d streak
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onDeleteHabit && (
                    <button
                      onClick={() => onDeleteHabit(habit.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Remove habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onLogHabit(habit.id)}
                    className="flex-shrink-0 p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                    title="Toggle complete today"
                  >
                    {isCompletedToday ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Progress visual matrix grid of the past 7 days (Daily) or 4 weeks (Weekly) */}
              {habit.frequency === "daily" ? (
                <div className="mt-4 border-t border-slate-50/70 pt-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono">Daily Logs</span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {habit.completedDays.filter(d => pastSevenDays.includes(d)).length}/7 days active
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pastSevenDays.map((day) => {
                      const isDone = habit.completedDays.includes(day);
                      const formattedDay = new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" });
                      const isDayToday = day === today;

                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <span className={`text-[8px] font-semibold ${isDayToday ? "text-indigo-600 font-bold" : "text-slate-400"}`}>
                            {formattedDay}
                          </span>
                          <div
                            className={`w-full aspect-square max-w-[16px] rounded-md transition-colors ${
                              isDone
                                ? "bg-emerald-500"
                                : isDayToday
                                ? "bg-indigo-50 border border-dashed border-indigo-200"
                                : "bg-slate-50 border border-slate-100"
                            }`}
                            title={`${day}: ${isDone ? "Completed" : "Incomplete"}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-slate-50/70 pt-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono">Weekly Logs (Past 4 Weeks)</span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {pastFourWeeks.filter(wk => wk.days.some(d => habit.completedDays.includes(d))).length}/4 weeks active
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pastFourWeeks.map((wk, idx) => {
                      const isDoneThisWeek = wk.days.some(d => habit.completedDays.includes(d));
                      const isThisWeek = idx === 3;

                      return (
                        <div key={wk.label} className="flex-1 flex flex-col items-center gap-1">
                          <span className={`text-[8px] font-semibold ${isThisWeek ? "text-indigo-600 font-bold" : "text-slate-400"}`}>
                            {wk.label}
                          </span>
                          <div
                            className={`w-full py-1 px-1.5 rounded-lg text-center text-[9px] font-bold transition-all border ${
                              isDoneThisWeek
                                ? "bg-emerald-500 text-white border-emerald-500 shadow-2xs"
                                : isThisWeek
                                ? "bg-indigo-50 text-indigo-600 border-dashed border-indigo-200"
                                : "bg-slate-50 text-slate-400 border-slate-100"
                            }`}
                            title={`Range: ${wk.startStr} to ${wk.endStr}. Status: ${isDoneThisWeek ? "Completed" : "Incomplete"}`}
                          >
                            {isDoneThisWeek ? "Done" : "Pending"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
