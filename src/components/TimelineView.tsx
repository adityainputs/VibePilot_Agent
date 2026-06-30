import React, { useState, useEffect } from "react";
import { Task, TaskStep, isTaskOnDate } from "../types";
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, Code, FileText, CheckSquare, Trash2, ShieldAlert, Plus, Edit2, Check, X, ArrowUpRight, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TimelineViewProps {
  tasks: Task[];
  selectedDate: string; // YYYY-MM-DD
  onToggleTask: (taskId: string, stepId?: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateSteps?: (taskId: string, steps: TaskStep[]) => Promise<void>;
  onRescheduleTask?: (taskId: string, dueTime: string, duration: number) => Promise<void>;
  onCompleteEarly?: (taskId: string) => Promise<void>;
  onReorderTasks?: (orderedIds: string[]) => Promise<void>;
}

export default function TimelineView({
  tasks,
  selectedDate,
  onToggleTask,
  onDeleteTask,
  onUpdateSteps,
  onRescheduleTask,
  onCompleteEarly,
  onReorderTasks
}: TimelineViewProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // States for inline steps editing
  const [editingStepsTaskId, setEditingStepsTaskId] = useState<string | null>(null);
  const [editedSteps, setEditedSteps] = useState<TaskStep[]>([]);
  const [newStepText, setNewStepText] = useState("");

  // States for reschedule / extend
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState(30);

  // Quick Reschedule state (card-level timing edit form)
  const [quickRescheduleTaskId, setQuickRescheduleTaskId] = useState<string | null>(null);
  const [quickTime, setQuickTime] = useState("");
  const [quickDuration, setQuickDuration] = useState(30);

  // Drag and drop states
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);

  // Filter tasks by selectedDate (including recurring) and sort chronologically by dueTime, or by position if available
  const filteredTasks = tasks.filter((t) => isTaskOnDate(t, selectedDate));
  const sortedTasksFromProps = [...filteredTasks].sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    if (a.position !== undefined) return -1;
    if (b.position !== undefined) return 1;
    return a.dueTime.localeCompare(b.dueTime);
  });

  useEffect(() => {
    if (draggedTaskId === null) {
      setLocalTasks(sortedTasksFromProps);
    }
  }, [tasks, selectedDate, draggedTaskId]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    // For browser compatibility (Firefox)
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedTaskId && draggedTaskId !== targetId) {
      const draggedIndex = localTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = localTasks.findIndex(t => t.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const updated = [...localTasks];
        const [draggedItem] = updated.splice(draggedIndex, 1);
        updated.splice(targetIndex, 0, draggedItem);
        setLocalTasks(updated);
      }
    }
  };

  const handleDragEnd = async () => {
    setDraggedTaskId(null);
    if (onReorderTasks) {
      const orderedIds = localTasks.map(t => t.id);
      await onReorderTasks(orderedIds);
    }
  };

  const toggleExpand = (id: string) => {
    const isExpanding = expandedTask !== id;
    setExpandedTask(isExpanding ? id : null);
    
    // Auto-populate reschedule inputs when expanded
    if (isExpanding) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        setRescheduleTime(task.dueTime);
        setRescheduleDuration(task.duration);
      }
    }
    
    // Reset editing steps state
    setEditingStepsTaskId(null);
  };

  const startEditingSteps = (task: Task) => {
    setEditingStepsTaskId(task.id);
    setEditedSteps([...task.steps]);
    setNewStepText("");
  };

  const handleAddStepInline = () => {
    if (newStepText.trim()) {
      const newStep: TaskStep = {
        id: `ts_new_${Date.now()}`,
        title: newStepText.trim(),
        completed: false
      };
      setEditedSteps([...editedSteps, newStep]);
      setNewStepText("");
    }
  };

  const handleRemoveStepInline = (id: string) => {
    setEditedSteps(editedSteps.filter(s => s.id !== id));
  };

  const handleSaveStepsInline = async (taskId: string) => {
    if (onUpdateSteps) {
      await onUpdateSteps(taskId, editedSteps);
    }
    setEditingStepsTaskId(null);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy kickoff kit", err);
    }
  };

  const getEndTime = (startTime: string, durationMin: number) => {
    const parts = startTime.split(":");
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const endTotal = h * 60 + m + durationMin;
    const endH = Math.floor(endTotal / 60) % 24;
    const endM = endTotal % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(endH)}:${pad(endM)}`;
  };

  const getPriorityBorder = (p: Task["priority"]) => {
    switch (p) {
      case "high": return "border-l-4 border-l-red-500";
      case "medium": return "border-l-4 border-l-amber-500";
      case "low": return "border-l-4 border-l-slate-300";
    }
  };

  const getKitIcon = (type: string) => {
    switch (type) {
      case "technical":
        return <Code className="w-4 h-4 text-sky-600" />;
      case "professional":
        return <FileText className="w-4 h-4 text-emerald-600" />;
      case "personal":
        return <CheckSquare className="w-4 h-4 text-indigo-600" />;
      default:
        return <CheckSquare className="w-4 h-4 text-slate-600" />;
    }
  };

  const getKitBadgeStyle = (type: string) => {
    switch (type) {
      case "technical":
        return "bg-sky-50 text-sky-700 border-sky-100";
      case "professional":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "personal":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <div className="space-y-6">
      {localTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
          <Clock className="w-8 h-8 text-slate-300 mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-700">No scheduled blocks</h3>
          <p className="text-xs text-slate-400 max-w-[240px] mt-1">
            There are no events scheduled on <strong className="font-mono text-slate-600">{selectedDate}</strong>. Use the voice/text workspace to schedule a task or add one manually above!
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-slate-100 space-y-6">
          {localTasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            const completedStepsCount = task.steps.filter((s) => s.completed).length;
            const progressPercent = task.steps.length
              ? Math.round((completedStepsCount / task.steps.length) * 100)
              : 0;

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`relative group ${draggedTaskId === task.id ? "opacity-30" : ""}`}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragEnd={handleDragEnd}
              >
                {/* Visual Timeline Node Dot */}
                <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white group-hover:bg-slate-400 group-hover:scale-125 transition-all" />

                {/* Task Container */}
                <div className={`bg-white border border-slate-100 hover:border-slate-200/80 rounded-2xl p-4 shadow-sm transition-all ${getPriorityBorder(task.priority)}`}>
                  
                  {/* Summary row */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Reorder drag handle */}
                    <div 
                      className="p-1 -ml-1 text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing rounded-md transition-colors flex-shrink-0"
                      title="Drag to reorder tasks"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (quickRescheduleTaskId === task.id) {
                              setQuickRescheduleTaskId(null);
                            } else {
                              setQuickRescheduleTaskId(task.id);
                              setQuickTime(task.dueTime);
                              setQuickDuration(task.duration);
                            }
                          }}
                          className={`text-xs font-mono font-semibold flex items-center gap-1 border px-1.5 py-0.5 rounded-md transition-all cursor-pointer group/time ${quickRescheduleTaskId === task.id ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50/60 text-indigo-600 border-indigo-100/50 hover:bg-indigo-100/50"}`}
                          title="Click to quickly edit timings"
                        >
                          <Clock className="w-3 h-3 text-indigo-500 group-hover/time:scale-110 transition-transform" />
                          {task.dueTime} - {getEndTime(task.dueTime, task.duration)}
                          <Edit2 className="w-2.5 h-2.5 text-indigo-400 opacity-60 group-hover/time:opacity-100 transition-opacity ml-1" />
                        </button>
                        <span className="text-[10px] font-semibold text-slate-500 font-mono bg-slate-100/80 px-1.5 py-0.5 rounded-md">
                          {task.duration} mins
                        </span>
                        {task.recurring && task.recurring !== "none" && (
                          <span className="text-[9px] font-bold text-teal-600 uppercase tracking-wider font-mono bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md">
                            ↻ {task.recurring}
                          </span>
                        )}
                        {task.status === "pending" && onCompleteEarly && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompleteEarly(task.id);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full transition-all flex items-center gap-1 shadow-2xs hover:scale-105 cursor-pointer"
                            title="Complete early to automatically start the next activity in 5 minutes!"
                          >
                            <ArrowUpRight className="w-3 h-3 text-indigo-500" />
                            Complete Early
                          </button>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800 tracking-tight leading-snug">
                        {task.title}
                        {task.status === "completed" && (
                          <span className="ml-2 text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            Done
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {task.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {task.status === "pending" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (quickRescheduleTaskId === task.id) {
                              setQuickRescheduleTaskId(null);
                            } else {
                              setQuickRescheduleTaskId(task.id);
                              setQuickTime(task.dueTime);
                              setQuickDuration(task.duration);
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${quickRescheduleTaskId === task.id ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                          title="Quick Reschedule task"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick Reschedule Form (Pristine, Elegant) */}
                  <AnimatePresence>
                    {quickRescheduleTaskId === task.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <div className="bg-amber-50/55 border border-amber-100/80 rounded-xl p-3 space-y-3">
                          <div className="flex items-center gap-1.5 text-amber-800">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Quick Reschedule & Cascade Shift</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Start Time</label>
                              <input
                                type="time"
                                value={quickTime}
                                onChange={(e) => setQuickTime(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Duration (mins)</label>
                              <input
                                type="number"
                                min="5"
                                value={quickDuration}
                                onChange={(e) => setQuickDuration(parseInt(e.target.value) || 30)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQuickRescheduleTaskId(null)}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (onRescheduleTask) {
                                  await onRescheduleTask(task.id, quickTime, quickDuration);
                                }
                                setQuickRescheduleTaskId(null);
                              }}
                              className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              Save & Shift
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Horizontal miniature progress line */}
                  <div className="mt-3.5 flex items-center gap-3">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {completedStepsCount}/{task.steps.length} steps
                    </span>
                  </div>

                  {/* Expandable Action Steps & Kickoff Kit */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden mt-4 pt-4 border-t border-slate-50 space-y-4"
                      >
                        {/* Steps checklist */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Actionable Steps</h5>
                            {onUpdateSteps && (
                              <button
                                type="button"
                                onClick={() => editingStepsTaskId === task.id ? setEditingStepsTaskId(null) : startEditingSteps(task)}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                {editingStepsTaskId === task.id ? (
                                  <>
                                    <X className="w-3 h-3" /> Cancel
                                  </>
                                ) : (
                                  <>
                                    <Edit2 className="w-3 h-3" /> Edit Steps
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {editingStepsTaskId === task.id ? (
                            <div className="space-y-2 border border-dashed border-indigo-100 rounded-xl p-3 bg-indigo-50/20">
                              <div className="space-y-1.5">
                                {editedSteps.map((step, idx) => (
                                  <div key={step.id} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={step.title}
                                      onChange={(e) => {
                                        const updated = [...editedSteps];
                                        updated[idx].title = e.target.value;
                                        setEditedSteps(updated);
                                      }}
                                      className="flex-1 text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStepInline(step.id)}
                                      className="text-red-500 hover:text-red-700 font-bold p-1 hover:bg-red-50 rounded-lg text-xs"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className="flex gap-2 pt-1 border-t border-indigo-50">
                                <input
                                  type="text"
                                  placeholder="Add custom actionable step..."
                                  value={newStepText}
                                  onChange={(e) => setNewStepText(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddStepInline())}
                                  className="flex-1 text-xs border border-slate-200 bg-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddStepInline}
                                  className="text-xs bg-slate-800 text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-700 cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>

                              <div className="flex justify-end gap-1.5 pt-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveStepsInline(task.id)}
                                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" /> Save Actionable Steps
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {task.steps.map((step) => (
                                <button
                                  key={step.id}
                                  onClick={() => onToggleTask(task.id, step.id)}
                                  className="w-full flex items-center gap-2.5 text-left text-xs text-slate-600 hover:text-slate-800 transition-colors py-1 px-1 rounded-lg hover:bg-slate-50/50"
                                >
                                  {step.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                  )}
                                  <span className={step.completed ? "line-through text-slate-400" : ""}>
                                    {step.title}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Kickoff Kit Display */}
                        {task.kickoffKit && (
                          <div className="border border-slate-100 bg-slate-50/70 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`p-1 rounded-lg border flex items-center justify-center ${getKitBadgeStyle(task.kickoffKit.type)}`}>
                                  {getKitIcon(task.kickoffKit.type)}
                                </span>
                                <div>
                                  <div className="text-[9px] font-mono uppercase font-bold text-slate-400">Context-Aware Kickoff Kit</div>
                                  <h6 className="text-xs font-semibold text-slate-700 leading-none mt-0.5">{task.kickoffKit.title}</h6>
                                </div>
                              </div>
                              <button
                                onClick={() => handleCopy(task.kickoffKit!.content, task.id)}
                                className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 font-mono bg-white border border-slate-100 rounded-md py-1 px-2.5 shadow-xs transition-colors cursor-pointer"
                              >
                                {copiedText === task.id ? "Copied!" : "Copy Template"}
                              </button>
                            </div>
                            <div className="bg-white border border-slate-100/80 rounded-lg p-2.5 text-xs font-mono text-slate-600 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed scrollbar-none">
                              {task.kickoffKit.content}
                            </div>
                          </div>
                        )}

                        {/* Flow Adjuster (Extend & Cascade Shift) */}
                        {onRescheduleTask && (
                          <div className="border border-amber-100 bg-amber-50/30 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <div className="text-[9px] font-mono uppercase font-bold text-amber-600">Smart Flow Adjuster (Extend & Auto-Reschedule)</div>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-normal">
                              Extend your task block or shift its starting time. Overlapping subsequent pending tasks will be automatically shifted forward.
                            </p>
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Reschedule Start Time</label>
                                <input
                                  type="time"
                                  value={rescheduleTime}
                                  onChange={(e) => setRescheduleTime(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Extend Duration (mins)</label>
                                <input
                                  type="number"
                                  min="5"
                                  max="480"
                                  value={rescheduleDuration}
                                  onChange={(e) => setRescheduleDuration(parseInt(e.target.value) || 30)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[9px] text-slate-400 font-medium mr-1">Quick Add:</span>
                                  {[15, 30, 45, 60].map((mins) => (
                                    <button
                                      key={mins}
                                      type="button"
                                      onClick={async () => {
                                        const newDur = task.duration + mins;
                                        setRescheduleDuration(newDur);
                                        if (onRescheduleTask) {
                                          await onRescheduleTask(task.id, task.dueTime, newDur);
                                        }
                                      }}
                                      className="text-[9px] font-extrabold bg-white hover:bg-amber-100 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-800 px-1.5 py-0.5 rounded-md transition-all cursor-pointer shadow-3xs"
                                    >
                                      +{mins}m
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (onRescheduleTask) {
                                    await onRescheduleTask(task.id, rescheduleTime, rescheduleDuration);
                                  }
                                }}
                                className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                Save & Cascade Reschedule
                              </button>
                            </div>
                          </div>
                        )}

                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
