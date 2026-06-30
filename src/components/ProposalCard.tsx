import React, { useState, useEffect } from "react";
import { Check, Copy, AlertTriangle, Calendar, Layers, ShieldCheck } from "lucide-react";
import { Proposal, Task } from "../types";
import { motion } from "motion/react";

interface ProposalCardProps {
  proposal: Proposal;
  existingTasks: Task[];
  onApprove: (id: string, customDate?: string, customSlot?: string, customMessage?: string) => void;
  onDismiss: (id: string) => void;
}

export default function ProposalCard({ proposal, existingTasks, onApprove, onDismiss }: ProposalCardProps) {
  const [copied, setCopied] = useState(false);
  const [editedMessage, setEditedMessage] = useState(proposal.conflictMessage || "");
  const [isEditingSlot, setIsEditingSlot] = useState(false);
  const [editedDate, setEditedDate] = useState(proposal.recommendedDate);
  const [editedSlot, setEditedSlot] = useState(proposal.recommendedSlot);
  const [editedStart, setEditedStart] = useState("");
  const [editedEnd, setEditedEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConflict, setHasConflict] = useState(proposal.conflict || false);
  const [conflictingTask, setConflictingTask] = useState<Task | null>(null);

  // Helper to parse start & end times
  const parseSlot = (slotStr: string) => {
    const parts = slotStr.split(/ - | to |-/);
    const start = parts[0]?.trim() || "09:00";
    const end = parts[1]?.trim() || "10:00";
    return { start, end };
  };

  useEffect(() => {
    setEditedMessage(proposal.conflictMessage || "");
    setEditedDate(proposal.recommendedDate);
    setEditedSlot(proposal.recommendedSlot);
    
    const { start, end } = parseSlot(proposal.recommendedSlot);
    setEditedStart(start);
    setEditedEnd(end);
    
    setIsEditingSlot(false);
    setIsSubmitting(false);
  }, [proposal.id, proposal.conflictMessage, proposal.recommendedDate, proposal.recommendedSlot]);

  useEffect(() => {
    if (!existingTasks || !Array.isArray(existingTasks)) {
      setHasConflict(proposal.conflict || false);
      setConflictingTask(null);
      return;
    }

    const parts = editedSlot.split(/ - | to |-/);
    if (parts.length !== 2) {
      setHasConflict(false);
      setConflictingTask(null);
      return;
    }

    const [start, end] = parts.map(p => p.trim());
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
      setHasConflict(false);
      setConflictingTask(null);
      return;
    }

    const proposedStartMinutes = sh * 60 + sm;
    let proposedEndMinutes = eh * 60 + em;
    if (proposedEndMinutes < proposedStartMinutes) {
      proposedEndMinutes += 24 * 60; // Next day wrap
    }

    let foundConflict = false;
    let conflictTask: Task | null = null;

    for (const t of existingTasks) {
      if (t.dueDate === editedDate && t.status !== "completed") {
        const tParts = t.dueTime.split(":");
        const tHour = parseInt(tParts[0]) || 0;
        const tMin = parseInt(tParts[1]) || 0;
        const tStartMinutes = tHour * 60 + tMin;
        const tEndMinutes = tStartMinutes + (t.duration || 60);

        if (
          (proposedStartMinutes >= tStartMinutes && proposedStartMinutes < tEndMinutes) ||
          (proposedEndMinutes > tStartMinutes && proposedEndMinutes <= tEndMinutes) ||
          (tStartMinutes >= proposedStartMinutes && tStartMinutes < proposedEndMinutes)
        ) {
          foundConflict = true;
          conflictTask = t;
          break;
        }
      }
    }

    setHasConflict(foundConflict);
    setConflictingTask(conflictTask);

    if (foundConflict && conflictTask) {
      if (editedDate === proposal.recommendedDate && editedSlot === proposal.recommendedSlot && proposal.conflictMessage) {
        setEditedMessage(proposal.conflictMessage);
      } else {
        const startStr = editedSlot.split(/ - | to |-/)[0]?.trim() || "17:00";
        const customMessage = `Subject: Rescheduling Request - Conflict between "${proposal.title}" & "${conflictTask.title}"\n\nHi team, we have a scheduled conflict at ${startStr} on ${editedDate} between our "${proposal.title}" and the existing "${conflictTask.title}" task. Could we push this block? Appreciate your flexibility!`;
        setEditedMessage(customMessage);
      }
    } else {
      setEditedMessage("");
    }
  }, [editedDate, editedSlot, existingTasks, proposal.id, proposal.title, proposal.recommendedDate, proposal.recommendedSlot, proposal.conflictMessage]);

  const handleStartChange = (newStart: string) => {
    setEditedStart(newStart);
    
    const [prevSH, prevSM] = editedStart.split(":").map(Number);
    const [prevEH, prevEM] = editedEnd.split(":").map(Number);
    const [newSH, newSM] = newStart.split(":").map(Number);
    
    if (!isNaN(prevSH) && !isNaN(prevSM) && !isNaN(prevEH) && !isNaN(prevEM) && !isNaN(newSH) && !isNaN(newSM)) {
      const prevStartMins = prevSH * 60 + prevSM;
      let prevEndMins = prevEH * 60 + prevEM;
      if (prevEndMins < prevStartMins) prevEndMins += 24 * 60;
      
      const duration = prevEndMins - prevStartMins;
      const newStartMins = newSH * 60 + newSM;
      const newEndMins = (newStartMins + duration) % (24 * 60);
      
      const endH = Math.floor(newEndMins / 60);
      const endM = newEndMins % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      const newEndStr = `${pad(endH)}:${pad(endM)}`;
      setEditedEnd(newEndStr);
      setEditedSlot(`${newStart} - ${newEndStr}`);
    } else {
      setEditedSlot(`${newStart} - ${editedEnd}`);
    }
  };

  const handleEndChange = (newEnd: string) => {
    setEditedEnd(newEnd);
    setEditedSlot(`${editedStart} - ${newEnd}`);
  };

  const handleCopyConflictMessage = async () => {
    if (!editedMessage) return;
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  };

  const getPriorityColor = (p: Proposal["priority"]) => {
    switch (p) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200/60";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "low":
        return "bg-slate-50 text-slate-700 border-slate-200/60";
    }
  };

  if (proposal.status !== "pending") {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center py-6">
        <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <span className="text-sm font-medium text-slate-700">Proposal {proposal.status === "approved" ? "Approved & Synced" : "Dismissed"}</span>
        <span className="text-xs text-slate-400 mt-0.5">"${proposal.title}" has been archived.</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden"
    >
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <span className="text-[10px] font-mono tracking-wider text-indigo-600 font-semibold uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
            AI Proposal
          </span>
          <h3 className="text-base font-semibold text-slate-800 mt-1.5">{proposal.title}</h3>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getPriorityColor(proposal.priority)}`}>
          {proposal.priority} priority
        </span>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed mb-4">{proposal.description}</p>

      {/* Suggested Slot with dynamic editing capability */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-mono">Suggested Schedule</span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingSlot(!isEditingSlot)}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {isEditingSlot ? "Save Schedule" : "Adjust Time"}
          </button>
        </div>

        {isEditingSlot ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Date</label>
              <input
                type="date"
                value={editedDate}
                onChange={(e) => setEditedDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Start Time</label>
              <input
                type="time"
                value={editedStart}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">End Time</label>
              <input
                type="time"
                value={editedEnd}
                onChange={(e) => handleEndChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-slate-700 font-mono">
              {editedDate} <span className="text-slate-300 font-light mx-1">|</span> {editedSlot}
            </div>
            {hasConflict && (
              <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                Conflict
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Steps */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider font-mono mb-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Recommended Action Steps ({proposal.steps.length})
        </div>
        <ul className="space-y-1.5">
          {proposal.steps.map((step, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs text-slate-500 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span className="truncate">{step.title}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Crisis Negotiator Overlay for Conflict */}
      {hasConflict && (
        <div className="border border-red-100 bg-red-50/70 rounded-xl p-3.5 mb-4 relative">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-red-900 leading-tight">Schedule Conflict Detected</h4>
              <p className="text-[11px] text-red-700 mt-0.5">
                Overlaps with another task{conflictingTask ? ` ("${conflictingTask.title}")` : ""}. Use the pre-drafted negotiator template to request a shift:
              </p>
            </div>
          </div>
          <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            rows={4}
            className="w-full bg-white border border-red-100 rounded-lg p-2.5 text-[11px] text-slate-600 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400 resize-y"
            placeholder="Edit your negotiator extension script..."
          />
          <button
            onClick={handleCopyConflictMessage}
            className="mt-2 w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg transition-colors shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied Template!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Extension Script
              </>
            )}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        <button
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true);
            onDismiss(proposal.id);
          }}
          className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true);
            onApprove(proposal.id, editedDate, editedSlot, editedMessage);
          }}
          className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isSubmitting ? "Processing..." : "Approve & Sync"}
        </button>
      </div>
    </motion.div>
  );
}
