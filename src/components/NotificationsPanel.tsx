import React from "react";
import { AppNotification } from "../types";
import { Bell, BellOff, Info, AlertTriangle, CheckCircle, Flame, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationsPanelProps {
  notifications: AppNotification[];
  onClear: () => void;
  onSimulateChange: () => void;
}

export default function NotificationsPanel({
  notifications,
  onClear,
  onSimulateChange
}: NotificationsPanelProps) {
  const getIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case "alert":
        return <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getStyle = (type: AppNotification["type"]) => {
    switch (type) {
      case "success":
        return "bg-emerald-50 border-emerald-100 text-slate-700";
      case "warning":
        return "bg-amber-50 border-amber-100 text-slate-700";
      case "alert":
        return "bg-rose-50 border-rose-100 text-slate-700 font-medium";
      case "info":
      default:
        return "bg-slate-50 border-slate-100 text-slate-700";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Title block */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Alert Center</h3>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSimulateChange}
            className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-100/50 rounded-lg py-1 px-2 flex items-center gap-1 transition-colors"
            title="Simulate schedule insertion from external factors"
          >
            <Sparkles className="w-3 h-3 text-rose-500" />
            Simulate Conflict
          </button>
          
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="text-[10px] text-slate-400 hover:text-slate-600 font-mono transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 border border-slate-100 rounded-xl">
              <BellOff className="w-6 h-6 text-slate-300 mb-1" />
              <span className="text-xs text-slate-400 font-medium">Notification feed clean</span>
            </div>
          ) : (
            notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: -12, height: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className={`p-3 border rounded-xl text-xs leading-relaxed flex gap-2.5 overflow-hidden ${getStyle(
                  n.type
                )}`}
              >
                <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-slate-800">{n.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</div>
                  <div className="text-[8px] font-mono text-slate-300 mt-1">
                    {new Date(n.timestamp).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
