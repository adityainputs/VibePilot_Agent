export type Priority = "low" | "medium" | "high";

export interface TaskStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface KickoffKit {
  type: "technical" | "professional" | "personal";
  title: string;
  content: string; // Markdown or raw text code snippet/email template/checklist
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "completed";
  priority: Priority;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // e.g. "14:00"
  duration: number; // in minutes
  steps: TaskStep[];
  kickoffKit?: KickoffKit;
  createdAt: string;
  recurring?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  dependencyTaskId?: string;
  customGapMinutes?: number;
  position?: number;
}

export interface Habit {
  id: string;
  title: string;
  frequency: "daily" | "weekly";
  streak: number;
  completedDays: string[]; // dates in YYYY-MM-DD
  lastCompleted?: string; // YYYY-MM-DD
}

export interface Proposal {
  id: string;
  prompt: string;
  title: string;
  description: string;
  priority: Priority;
  recommendedDate: string; // YYYY-MM-DD
  recommendedSlot: string; // e.g. "14:30 - 15:30"
  steps: { title: string }[];
  conflict: boolean;
  conflictMessage?: string; // Pre-drafted crisis negotiation extension template
  kickoffType: "technical" | "professional" | "personal";
  kickoffContent: string; // Code template, email draft, or checklist
  status: "pending" | "approved" | "dismissed";
  createdAt: string;
  rescheduleTaskId?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "alert";
  timestamp: string;
  read: boolean;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  proposalId?: string; // Attached proposal if generated
}

export interface AppState {
  tasks: Task[];
  habits: Habit[];
  proposals: Proposal[];
  notifications: AppNotification[];
  messages: Message[];
  isFocusMode: boolean;
  focusCountdown: number; // in seconds
}

export function isTaskOnDate(task: Task, dateStr: string): boolean {
  if (task.dueDate === dateStr) return true;
  if (!task.recurring || task.recurring === "none") return false;
  
  const taskDate = new Date(task.dueDate + "T00:00:00");
  const targetDate = new Date(dateStr + "T00:00:00");
  
  // Only matches on or after original due date
  if (targetDate < taskDate) return false;
  
  if (task.recurring === "daily") {
    return true;
  }
  if (task.recurring === "weekly") {
    return taskDate.getDay() === targetDate.getDay();
  }
  if (task.recurring === "monthly") {
    return taskDate.getDate() === targetDate.getDate();
  }
  if (task.recurring === "yearly") {
    return taskDate.getMonth() === targetDate.getMonth() && taskDate.getDate() === targetDate.getDate();
  }
  return false;
}
