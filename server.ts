import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { AppState } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database (Firestore-ready schema structure)
const getTodayString = () => {
  return new Date().toISOString().split("T")[0];
};
const initialToday = getTodayString();

let dbState: AppState = {
  tasks: [],
  habits: [],
  proposals: [],
  notifications: [
    {
      id: "n1",
      title: "VibePilot AI Engine Online",
      message: "Ready to assist! Try clicking the voice button and say 'Schedule code review for tomorrow morning' to trigger a structured proposal card.",
      type: "success" as const,
      timestamp: new Date().toISOString(),
      read: false
    }
  ],
  messages: [
    {
      id: "m1",
      sender: "assistant" as const,
      text: "Welcome to VibePilot. I am your productivity companion. Ask me to schedule tasks, identify conflicts, or manage your habits. I will propose changes for you to approve.",
      timestamp: new Date().toISOString()
    }
  ],
  isFocusMode: false,
  focusCountdown: 0
};

// Lazy Gemini API initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. AI proposals will run in mock backup mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to sort tasks prioritizing manual position over chronological dueTime
const sortTasks = (tasks: any[]) => {
  return [...tasks].sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    if (a.position !== undefined) return -1;
    if (b.position !== undefined) return 1;
    return a.dueTime.localeCompare(b.dueTime);
  });
};

// Helper to convert time "HH:MM" to minutes from midnight
const toMins = (tStr: string) => {
  const [h, m] = tStr.split(":").map(Number);
  return h * 60 + m;
};

// Helper to convert minutes back to "HH:MM"
const toStr = (mTotal: number) => {
  const h = Math.floor(mTotal / 60) % 24;
  const m = mTotal % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const cascadeShiftTasks = (date: string) => {
  const dateTasks = sortTasks(
    dbState.tasks.filter(t => t.dueDate === date && t.status === "pending")
  );
    
  for (let i = 0; i < dateTasks.length; i++) {
    const cur = dateTasks[i];
    if (i === 0) continue;
    const prev = dateTasks[i-1];
    
    const prevStart = toMins(prev.dueTime);
    const prevEnd = prevStart + prev.duration;
    const curStart = toMins(cur.dueTime);
    
    if (curStart < prevEnd) {
      const origCurTime = cur.dueTime;
      cur.dueTime = toStr(prevEnd);
      
      dbState.notifications.unshift({
        id: `n_shift_${Date.now()}_${cur.id}`,
        title: "Schedule Cascade Adjusted",
        message: `"${cur.title}" was auto-shifted from ${origCurTime} to ${cur.dueTime} to accommodate extension of "${prev.title}".`,
        type: "info" as const,
        timestamp: new Date().toISOString(),
        read: false
      });
    }
  }
};

// Find a related task in the list, handles spellings and minor typos like "mediation"
const findRelatedTask = (msg: string, tasks: any[]) => {
  const lowerMsg = msg.toLowerCase();
  const cleanMsg = lowerMsg.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
  const msgWords = cleanMsg.split(/\s+/).filter(Boolean);
  
  for (const t of tasks) {
    const titleLower = t.title.toLowerCase();
    if (lowerMsg.includes(titleLower)) return t;
    
    // Check if any word of the task title matches words in the message (excluding small filler words)
    const titleWords = titleLower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && w !== "session" && w !== "task");
      
    for (const word of titleWords) {
      if (msgWords.includes(word)) return t;
      
      // Handle "mediation" vs "meditation"
      if (word === "meditation" && (lowerMsg.includes("mediation") || msgWords.includes("mediation"))) {
        return t;
      }
    }
  }
  return null;
};

// REST API Endpoints

// Get current state
app.get("/api/state", (req, res) => {
  res.json(dbState);
});

// Post chat / process command
app.post("/api/chat", async (req, res) => {
  const { text, clientTimeInfo } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid text parameter" });
  }

  // Record user message
  const userMsg = {
    id: `m_${Date.now()}`,
    sender: "user" as const,
    text,
    timestamp: new Date().toISOString()
  };
  dbState.messages.push(userMsg);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const ai = getGeminiClient();
    const curDate = clientTimeInfo?.localDate || new Date().toISOString().split("T")[0];
    const curTime = clientTimeInfo?.localTimeStr || new Date().toLocaleTimeString();
    
    const promptContext = `
You are VibePilot, an elite, professional, and elegant AI-powered hackathon productivity companion.
The user speaks to you via voice/text. Analyze their request and respond with both a polite conversational response and a structured productivity proposal if appropriate.

IMPORTANT RULES:
- The current user date is ${curDate} (YYYY-MM-DD) and current local time is ${curTime}.
- CRITICAL: If the user explicitly specifies a calendar date in their request (e.g., "29 june" or "June 29" or "July 4"), you MUST parse that exact date and output it in YYYY-MM-DD format as the "recommendedDate" (using 2026 as the current year). Do NOT default to today's date if they specified a day!
- Carefully parse any relative dates (e.g., "tomorrow" is the day after the current date, "after 10 days" is exactly 10 days after ${curDate}, etc.) from the user's message.
- Always output a valid date string in YYYY-MM-DD format as the "recommendedDate" field.
- Read the existing user tasks to identify any potential time conflicts on the same recommendedDate. Existing tasks are: ${JSON.stringify(dbState.tasks)}.
- A conflict occurs if the recommended time slot on the same recommendedDate overlaps with an existing task's dueTime and duration.
- If there is a scheduling conflict, mark conflict: true, and generate a polite, clear, professional "conflictMessage" (Crisis Negotiator message template) that the user can copy with a single click to reschedule or request extensions. Ensure it's tailored specifically to the conflict.
- Determine the appropriate kickoffType based on the task:
  - "technical": for coding, deploying, database tasks, etc. Provide a fully annotated syntax-highlighted code snippet or bash commands as kickoffContent.
  - "professional": for business, documents, pitches, writing emails, etc. Provide a polished email/document template or outline as kickoffContent.
  - "personal": for hobbies, routines, personal growth, checklists. Provide a highly actionable checklist of 3-5 items as kickoffContent.
- If the user is asking to reschedule or change the timings of an existing task (e.g. "reschedule Football Session to 18:30" or "move Meditation to 15:00" or "change pitch deck polish time to 3 PM"):
  - Match the task from the provided tasks list above.
  - Set "rescheduleTaskId" to that matched task's ID (e.g. "t1").
  - Populate "title" with the existing task's title, "description" with its description, and reuse its "steps", "priority", "kickoffType", and "kickoffContent" (or adapt them if they requested changes to other details too).
  - Set "recommendedDate" to the date requested, or keep the existing task's dueDate.
  - Set "recommendedSlot" to the new requested slot or starting time (maintaining its original duration unless a different duration/end time is specified).
- If the user is asking to add, create, or track a habit (e.g. "start a habit to read daily" or "add a weekly habit for swimming" or "create a daily habit to stay hydrated"), set the "habitProposal" property with details of that habit. Set "proposal" to null unless they also schedule a task.

Respond with strict JSON structure:
{
  "replyText": "A warm, concise conversational message confirming what was processed.",
  "proposal": {
    "title": "Concise title of the proposed task",
    "description": "Short explanation of the proposal.",
    "priority": "low" | "medium" | "high",
    "recommendedDate": "YYYY-MM-DD",
    "recommendedSlot": "E.g. '15:15 - 16:15' or '09:30 - 10:30'",
    "steps": [
      { "title": "Actionable step 1" },
      { "title": "Actionable step 2" }
    ],
    "conflict": true or false,
    "conflictMessage": "A pre-drafted extension/rescheduling email/chat template, or empty if no conflict.",
    "kickoffType": "technical" | "professional" | "personal",
    "kickoffContent": "Detailed markdown template (markdown supported!) code/email/checklist matching kickoffType.",
    "rescheduleTaskId": "The string ID of the existing task being rescheduled, or null if this is a brand new task."
  } or null,
  "habitProposal": {
    "title": "Clean concise title of the habit (e.g. 'Read 10 Pages' or 'Swim')",
    "frequency": "daily" | "weekly"
  } or null
}

If the user request is just general chat (e.g. 'hello', 'who are you') and does not describe scheduling, tasks, or habits, set both "proposal" and "habitProposal" to null.

User command: "${text}"
`;

    // Wrap in a 4-second timeout to guarantee extremely responsive fallback if Gemini is congested or key is broken
    const generateContentWithTimeout = async (params: any, timeoutMs: number) => {
      return new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error("Gemini API timed out")), timeoutMs);
        ai.models.generateContent(params)
          .then((res) => {
            clearTimeout(timeoutId);
            resolve(res);
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
      });
    };

    const response = await generateContentWithTimeout({
      model: "gemini-3.5-flash",
      contents: promptContext,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are VibePilot. You speak with premium visual design sensibilities, avoiding hype or slop."
      }
    }, 15000);

    const result = JSON.parse(response.text || "{}");

    let proposalId = undefined;
    if (result.proposal) {
      proposalId = `p_${Date.now()}`;
      const newProposal = {
        ...result.proposal,
        id: proposalId,
        prompt: text,
        status: "pending" as const,
        createdAt: new Date().toISOString()
      };
      dbState.proposals.push(newProposal);

      // Add a schedule notification
      dbState.notifications.unshift({
        id: `n_${Date.now()}`,
        title: "New AI Proposal Generated",
        message: `Suggested Slot: ${newProposal.recommendedSlot} on ${newProposal.recommendedDate} for "${newProposal.title}"`,
        type: newProposal.conflict ? "warning" : "info",
        timestamp: new Date().toISOString(),
        read: false
      });
    }

    if (result.habitProposal) {
      const newHabit = {
        id: `h_${Date.now()}`,
        title: result.habitProposal.title,
        frequency: result.habitProposal.frequency || "daily",
        streak: 0,
        completedDays: []
      };
      dbState.habits.push(newHabit);

      dbState.notifications.unshift({
        id: `n_habit_${Date.now()}`,
        title: "Atomic Habit Created",
        message: `Successfully created a new ${newHabit.frequency} habit to "${newHabit.title}" via VibePilot AI.`,
        type: "success" as const,
        timestamp: new Date().toISOString(),
        read: false
      });
    }

    const aiMsg = {
      id: `m_${Date.now()}`,
      sender: "assistant" as const,
      text: result.replyText || "I've analyzed your request and prepared a proposal for your review.",
      timestamp: new Date().toISOString(),
      proposalId
    };
    dbState.messages.push(aiMsg);

    res.json({ state: dbState, replyText: aiMsg.text });
  } catch (error) {
    console.error("Gemini processing error (falling back to dynamic local processing):", error);
    
    const lowerText = text.toLowerCase();
    
    const isHabitQuery = lowerText.includes("habit") || lowerText.includes("start a daily") || lowerText.includes("start a weekly") || lowerText.includes("track daily") || lowerText.includes("track weekly");
    if (isHabitQuery) {
      const frequency = (lowerText.includes("weekly") ? "weekly" : "daily") as "daily" | "weekly";
      let habitTitle = "";
      const habitMatch = text.match(/(?:habit to|habit of|habit|start a daily|start a weekly|add a habit|add habit)\s+([^.]+)/i);
      if (habitMatch && habitMatch[1]) {
        habitTitle = habitMatch[1].replace(/\bdaily\b|\bweekly\b/gi, "").trim();
      } else {
        habitTitle = text.replace(/add\s+/i, "").replace(/create\s+/i, "").replace(/habit\s+/i, "").trim();
      }
      
      if (!habitTitle || habitTitle.length < 3) {
        habitTitle = "New Habit Tracker";
      }
      
      habitTitle = habitTitle.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

      const newHabit = {
        id: `h_${Date.now()}`,
        title: habitTitle,
        frequency,
        streak: 0,
        completedDays: []
      };
      dbState.habits.push(newHabit);

      dbState.notifications.unshift({
        id: `n_habit_${Date.now()}`,
        title: "Atomic Habit Created (Fallback)",
        message: `Successfully created a new ${frequency} habit to "${habitTitle}" locally.`,
        type: "success" as const,
        timestamp: new Date().toISOString(),
        read: false
      });

      const replyText = `I've successfully created the **${frequency}** habit: **"${habitTitle}"** for you! You can track it in your Atomic Habits panel.`;
      
      const aiMsg = {
        id: `m_${Date.now()}`,
        sender: "assistant" as const,
        text: replyText,
        timestamp: new Date().toISOString()
      };
      dbState.messages.push(aiMsg);

      return res.json({ state: dbState, replyText });
    }

    // Exclude basic conversational greetings so general queries don't trigger mock proposals
    const isGeneralGreeting = lowerText === "hello" || lowerText === "hi" || lowerText === "hey" || lowerText === "who are you" || lowerText === "how are you";
    const isMockTask = !isGeneralGreeting;
    
    let replyText = "I've processed your command locally. Here is a proposal for your dashboard.";
    let proposalId = undefined;

    if (isMockTask) {
      proposalId = `p_mock_${Date.now()}`;
      
      const isRescheduleQuery = lowerText.includes("reschedule") || lowerText.includes("move") || lowerText.includes("change") || lowerText.includes("edit") || lowerText.includes("shift");
      const matchedTask = isRescheduleQuery ? findRelatedTask(text, dbState.tasks) : null;
      const rescheduleTaskId = matchedTask ? matchedTask.id : undefined;

      // Parse potential slot/time
      let slot = "17:00 - 17:45";
      let hour = 17;
      let min = 0;
      const timeMatch = text.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i) || text.match(/at\s+(\d{1,2})\s*(AM|PM)/i) || text.match(/at\s+(\d{1,2})/i);
      if (timeMatch) {
        hour = parseInt(timeMatch[1]);
        min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3];
        if (ampm && ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
        if (ampm && ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
        
        const startStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        const endHour = (hour + (min + 45 >= 60 ? 1 : 0)) % 24;
        const endMin = (min + 45) % 60;
        const endStr = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
        slot = `${startStr} - ${endStr}`;
      } else if (matchedTask) {
        // reuse existing task slot if no time matched
        const startStr = matchedTask.dueTime;
        const [sh, sm] = startStr.split(":").map(Number);
        const endMins = (sh * 60 + sm + (matchedTask.duration || 60)) % (24 * 60);
        const eh = Math.floor(endMins / 60);
        const em = endMins % 60;
        const endStr = `${eh.toString().padStart(2, "0")}:${em.toString().padStart(2, "0")}`;
        slot = `${startStr} - ${endStr}`;
        hour = sh;
        min = sm;
      }

      // Parse relative date like "after X days" or "tomorrow" or exact calendar dates
      const parseDateFromText = (input: string): Date => {
        const now = new Date();
        const lower = input.toLowerCase();
        
        if (lower.includes("tomorrow")) {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return d;
        }
        
        const daysMatch = lower.match(/after\s+(\d+)\s+day/i) || lower.match(/in\s+(\d+)\s+day/i) || lower.match(/(\d+)\s+days/i);
        if (daysMatch) {
          const d = new Date();
          d.setDate(d.getDate() + parseInt(daysMatch[1]));
          return d;
        }

        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthsFull = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        
        // Format 1: "29 june" or "29th june" or "29th of june"
        const format1 = lower.match(/(\d{1,2})(st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)/i);
        if (format1) {
          const day = parseInt(format1[1]);
          const monthStr = format1[3].toLowerCase();
          const monthIndex = monthsFull.indexOf(monthStr) !== -1 ? monthsFull.indexOf(monthStr) : months.indexOf(monthStr.slice(0, 3));
          if (monthIndex !== -1) {
            const d = new Date();
            d.setMonth(monthIndex);
            d.setDate(day);
            return d;
          }
        }

        // Format 2: "june 29" or "june 29th"
        const format2 = lower.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(st|nd|rd|th)?/i);
        if (format2) {
          const monthStr = format2[1].toLowerCase();
          const day = parseInt(format2[2]);
          const monthIndex = monthsFull.indexOf(monthStr) !== -1 ? monthsFull.indexOf(monthStr) : months.indexOf(monthStr.slice(0, 3));
          if (monthIndex !== -1) {
            const d = new Date();
            d.setMonth(monthIndex);
            d.setDate(day);
            return d;
          }
        }

        if (matchedTask) {
          const [yr, mn, dy] = matchedTask.dueDate.split("-").map(Number);
          return new Date(yr, mn - 1, dy);
        }

        return now;
      };

      const recDate = parseDateFromText(text);
      const yyyy = recDate.getFullYear();
      const mm = String(recDate.getMonth() + 1).padStart(2, '0');
      const dd = String(recDate.getDate()).padStart(2, '0');
      const recDateStr = `${yyyy}-${mm}-${dd}`;

      // Dynamic Title Extraction (capitalized and polished)
      let taskTitle = "";
      if (matchedTask) {
        taskTitle = matchedTask.title;
      } else {
        let cleanText = text.replace(/schedule\s+(a\s+)?/i, "")
                            .replace(/at\s+\d+.*$/i, "")
                            .replace(/today.*$/i, "")
                            .replace(/tomorrow.*$/i, "")
                            .replace(/in\s+\d+.*$/i, "")
                            .replace(/after\s+\d+.*$/i, "")
                            .replace(/for\s+/i, "")
                            .trim();

        if (cleanText) {
          taskTitle = cleanText.split(" ")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }
      }

      if (!taskTitle || taskTitle.length < 3) {
        taskTitle = "Scheduled AI Action Item";
      }

      // Real, dynamic conflict detection in fallback mode
      let isConflict = false;
      const proposedStartMinutes = hour * 60 + min;
      const proposedEndMinutes = proposedStartMinutes + (matchedTask ? matchedTask.duration : 45);

      for (const t of dbState.tasks) {
        if (rescheduleTaskId && t.id === rescheduleTaskId) continue; // skip self
        if (t.dueDate === recDateStr) {
          const parts = t.dueTime.split(":");
          const tHour = parseInt(parts[0]) || 0;
          const tMin = parseInt(parts[1]) || 0;
          const tStartMinutes = tHour * 60 + tMin;
          const tEndMinutes = tStartMinutes + (t.duration || 60);

          if (
            (proposedStartMinutes >= tStartMinutes && proposedStartMinutes < tEndMinutes) ||
            (proposedEndMinutes > tStartMinutes && proposedEndMinutes <= tEndMinutes) ||
            (tStartMinutes >= proposedStartMinutes && tStartMinutes < proposedEndMinutes)
          ) {
            isConflict = true;
            break;
          }
        }
      }

      const conflictMessage = isConflict
        ? `Subject: Rescheduling Request - ${taskTitle} Slot Conflict\n\nHi team, we have a scheduled conflict at ${slot.split(" - ")[0]}. Could we push this block? Appreciate your flexibility!`
        : undefined;

      const mockProposal = {
        id: proposalId,
        prompt: text,
        title: taskTitle,
        description: rescheduleTaskId ? `Rescheduling existing task "${taskTitle}" to a new timing block.` : `Custom scheduling request extracted from input: "${text}".`,
        priority: rescheduleTaskId ? matchedTask.priority : "medium" as const,
        recommendedDate: recDateStr,
        recommendedSlot: slot,
        steps: rescheduleTaskId ? matchedTask.steps.map(s => ({ title: s.title })) : [
          { title: `Prepare prerequisites for ${taskTitle}` },
          { title: `Execute core workflow and review achievements` }
        ],
        conflict: isConflict,
        conflictMessage,
        kickoffType: rescheduleTaskId ? matchedTask.kickoffKit?.type || "technical" as const : (text.toLowerCase().includes("meditation") || text.toLowerCase().includes("lunch") || text.toLowerCase().includes("football") ? "personal" as const : "technical" as const),
        kickoffContent: rescheduleTaskId ? matchedTask.kickoffKit?.content || "" : (text.toLowerCase().includes("meditation")
          ? `# Meditation Guidelines\n\n1. Find a quiet spot.\n2. Set a timer.\n3. Focus on your breath.`
          : text.toLowerCase().includes("lunch")
          ? `# Refresh & Refuel\n\n1. Step away from screen completely.\n2. Hydrate with fresh water.\n3. Have a nutrient-dense lunch.`
          : text.toLowerCase().includes("football")
          ? `# Football Session\n\n1. Stretch legs and warm up.\n2. Perform standard drills.\n3. Practice shots on goal.`
          : `// Auto Generated Kickoff Code\nconsole.log("Analyzing local repository status...");`),
        status: "pending" as const,
        createdAt: new Date().toISOString(),
        rescheduleTaskId
      };
      dbState.proposals.push(mockProposal);

      dbState.notifications.unshift({
        id: `n_${Date.now()}`,
        title: rescheduleTaskId ? "Reschedule Proposal (Fallback)" : "Proposal Processed (Fallback)",
        message: rescheduleTaskId 
          ? `Reschedule proposed: "${mockProposal.title}" to ${mockProposal.recommendedSlot} on ${mockProposal.recommendedDate}.`
          : `Parsed task: "${mockProposal.title}" on ${mockProposal.recommendedDate} with recommended slot: ${mockProposal.recommendedSlot}.`,
        type: isConflict ? "warning" as const : "info" as const,
        timestamp: new Date().toISOString(),
        read: false
      });
      
      if (rescheduleTaskId) {
        replyText = `I've prepared a rescheduling proposal for your existing task **"${taskTitle}"** to **${slot}** on **${recDateStr}**. Please review and approve the Proposal Card!`;
      } else {
        replyText = `I've prepared a new scheduling proposal for **"${taskTitle}"** on **${recDateStr}** at **${slot}** based on your command. Please review and approve the Proposal Card!`;
      }
    } else {
      replyText = `I understand you said: "${text}". Ask me to schedule tasks (e.g. "schedule a meditation after 10 days" or "deploy tomorrow at 2 PM") to trigger the Proposal Pipeline!`;
    }

    const aiMsg = {
      id: `m_${Date.now()}`,
      sender: "assistant" as const,
      text: replyText,
      timestamp: new Date().toISOString(),
      proposalId
    };
    dbState.messages.push(aiMsg);

    res.json({ state: dbState, replyText: aiMsg.text });
  }
});

// Approve Proposal
app.post("/api/proposals/approve", async (req, res) => {
  const { id, customDate, customSlot, customMessage } = req.body;
  const index = dbState.proposals.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }

  const proposal = dbState.proposals[index];
  if (proposal.status === "approved") {
    // Avoid double approvals
    return res.json(dbState);
  }

  proposal.status = "approved";
  if (customDate) {
    proposal.recommendedDate = customDate;
  }
  if (customSlot) {
    proposal.recommendedSlot = customSlot;
  }

  // If there's a custom instructions message in the extension script input box,
  // let's process it dynamically using Gemini!
  if (customMessage && customMessage.trim() !== "" && customMessage.trim() !== proposal.conflictMessage) {
    const isStandardPreTemplate = customMessage.includes("Rescheduling Request") || customMessage.includes("Hi team");
    if (!isStandardPreTemplate) {
      try {
        const ai = getGeminiClient();
        const geminiPrompt = `
          The user is approving a scheduled task but wants to adjust its timing based on this custom instruction: "${customMessage}".
          
          The current suggested details are:
          - Task Title: "${proposal.title}"
          - Suggested Date: "${proposal.recommendedDate}"
          - Suggested Time Block: "${proposal.recommendedSlot}"
          
          Here is the current list of other tasks: ${JSON.stringify(dbState.tasks.map(t => ({ id: t.id, title: t.title, dueTime: t.dueTime, duration: t.duration })))}.
          
          If the user's instruction references another task's end time (e.g., "cricket", "meeting", "meditation", "mediation", "lunch", "ends", "finish"), search for that task in the list.
          Calculate the end time of that task (start time + duration).
          Then apply any offset mentioned (e.g., "start after two minutes when it ends" means adding 2 minutes to the end time of that task).
          Determine the new start time and format it as a time slot block (e.g., "15:32 - 16:32", maintaining the original duration unless requested otherwise).
          Always output valid JSON.
          
          Return format:
          {
            "recommendedDate": "YYYY-MM-DD",
            "recommendedSlot": "HH:MM - HH:MM",
            "dependencyTaskId": "t_XYZ", // ID of the referenced task if found, else null
            "customGapMinutes": 2 // Offset in minutes if mentioned, else null
          }
        `;
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: geminiPrompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        const parsed = JSON.parse(response.text || "{}");
        if (parsed.recommendedDate) {
          proposal.recommendedDate = parsed.recommendedDate;
        }
        if (parsed.recommendedSlot) {
          proposal.recommendedSlot = parsed.recommendedSlot;
        }
        if (parsed.dependencyTaskId) {
          (proposal as any).dependencyTaskId = parsed.dependencyTaskId;
        }
        if (typeof parsed.customGapMinutes === "number") {
          (proposal as any).customGapMinutes = parsed.customGapMinutes;
        }
      } catch (err) {
        console.error("Failed to parse custom approve message with Gemini:", err);
        // Fallback: look for references to existing tasks and end offsets using robust matcher
        const lowerMsg = customMessage.toLowerCase();
        const matchedTask = findRelatedTask(customMessage, dbState.tasks);
        if (matchedTask) {
          const parts = matchedTask.dueTime.split(":");
          const sh = parseInt(parts[0]) || 0;
          const sm = parseInt(parts[1]) || 0;
          const matchedEndTotal = sh * 60 + sm + (matchedTask.duration || 60);
          
          let offset = 2; // Default to 2 mins offset as per user instructions
          const minMatch = lowerMsg.match(/(\d+)\s+minute/i) || lowerMsg.match(/(\d+)\s+min/i);
          if (minMatch) {
            offset = parseInt(minMatch[1]);
          }
          const finalStartMins = (matchedEndTotal + offset) % (24 * 60);
          const startHour = Math.floor(finalStartMins / 60);
          const startMin = finalStartMins % 60;
          const startStr = `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`;
          
          // Try to compute original duration to keep it
          let origDuration = 45;
          const origParts = proposal.recommendedSlot.split(/ - | to |-/);
          if (origParts.length === 2) {
            const [os, oe] = origParts.map(p => p.trim());
            const [osh, osm] = os.split(":").map(Number);
            const [oeh, oem] = oe.split(":").map(Number);
            if (!isNaN(osh) && !isNaN(osm) && !isNaN(oeh) && !isNaN(oem)) {
              let oStart = osh * 60 + osm;
              let oEnd = oeh * 60 + oem;
              if (oEnd < oStart) oEnd += 24 * 60;
              origDuration = oEnd - oStart;
            }
          }
          
          const finalEndMins = (finalStartMins + origDuration) % (24 * 60);
          const endHour = Math.floor(finalEndMins / 60);
          const endMin = finalEndMins % 60;
          const endStr = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
          
          proposal.recommendedSlot = `${startStr} - ${endStr}`;
          (proposal as any).dependencyTaskId = matchedTask.id;
          (proposal as any).customGapMinutes = offset;
        }
      }
    }
  }

  // Calculate dynamic duration based on recommendedSlot
  let calculatedDuration = 60; // fallback default
  const slot = proposal.recommendedSlot || "";
  const separators = [" - ", " to ", "-"];
  let separatorUsed = "";
  for (const sep of separators) {
    if (slot.includes(sep)) {
      separatorUsed = sep;
      break;
    }
  }
  if (separatorUsed) {
    const parts = slot.split(separatorUsed);
    if (parts.length === 2) {
      const [start, end] = parts.map(p => p.trim());
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        const startMins = sh * 60 + sm;
        let endMins = eh * 60 + em;
        if (endMins < startMins) {
          endMins += 24 * 60; // handle next day wrap
        }
        calculatedDuration = endMins - startMins;
      }
    }
  }

  // Create or Update Task out of Proposal
  let existingTask = null;
  if (proposal.rescheduleTaskId) {
    existingTask = dbState.tasks.find(t => t.id === proposal.rescheduleTaskId);
  }

  if (existingTask) {
    const oldTime = existingTask.dueTime;
    existingTask.dueDate = proposal.recommendedDate || new Date().toISOString().split("T")[0];
    existingTask.dueTime = proposal.recommendedSlot.split(/ - | to |-/)[0]?.trim() || "17:00";
    existingTask.duration = calculatedDuration;
    existingTask.priority = proposal.priority;
    if (proposal.description) {
      existingTask.description = proposal.description;
    }
    if (proposal.steps && proposal.steps.length > 0) {
      existingTask.steps = proposal.steps.map((s, i) => ({
        id: `ts_${Date.now()}_${i}`,
        title: s.title,
        completed: false
      }));
    }
    
    // Recalculate cascade overlaps on the same day
    cascadeShiftTasks(existingTask.dueDate);

    // Notification
    dbState.notifications.unshift({
      id: `n_${Date.now()}`,
      title: "Task Rescheduled & Synced",
      message: `"${existingTask.title}" has been rescheduled from ${oldTime} to ${existingTask.dueTime} on ${existingTask.dueDate}.`,
      type: "success" as const,
      timestamp: new Date().toISOString(),
      read: false
    });
  } else {
    const newTask = {
      id: `t_${Date.now()}`,
      title: proposal.title,
      description: proposal.description,
      status: "pending" as const,
      priority: proposal.priority,
      dueDate: proposal.recommendedDate || new Date().toISOString().split("T")[0],
      dueTime: proposal.recommendedSlot.split(/ - | to |-/)[0]?.trim() || "17:00",
      duration: calculatedDuration,
      steps: proposal.steps.map((s, i) => ({
        id: `ts_${Date.now()}_${i}`,
        title: s.title,
        completed: false
      })),
      kickoffKit: {
        type: proposal.kickoffType,
        title: `${proposal.title} Kickoff Kit`,
        content: proposal.kickoffContent
      },
      dependencyTaskId: (proposal as any).dependencyTaskId,
      customGapMinutes: (proposal as any).customGapMinutes,
      createdAt: new Date().toISOString()
    };

    dbState.tasks.push(newTask);

    // Notification
    dbState.notifications.unshift({
      id: `n_${Date.now()}`,
      title: "Proposal Approved & Synced",
      message: `"${proposal.title}" has been added to your Timeline for ${newTask.dueDate} with kickoff context ready.`,
      type: "success" as const,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  res.json(dbState);
});

// Dismiss Proposal
app.post("/api/proposals/dismiss", (req, res) => {
  const { id } = req.body;
  const index = dbState.proposals.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }

  dbState.proposals[index].status = "dismissed";
  res.json(dbState);
});

// Toggle Task / Step completions
app.post("/api/tasks/toggle", (req, res) => {
  const { taskId, stepId } = req.body;
  const task = dbState.tasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (stepId) {
    const step = task.steps.find(s => s.id === stepId);
    if (step) {
      step.completed = !step.completed;
    }
  } else {
    task.status = task.status === "completed" ? "pending" : "completed";
  }

  res.json(dbState);
});

// Delete Task
app.post("/api/tasks/delete", (req, res) => {
  const { id } = req.body;
  dbState.tasks = dbState.tasks.filter(t => t.id !== id);
  res.json(dbState);
});

// Create Task manually (e.g. via Calendar)
app.post("/api/tasks/create", (req, res) => {
  const { title, description, priority, dueDate, dueTime, duration, steps, kickoffType, kickoffContent, recurring } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title required" });
  }

  const newTask = {
    id: `t_${Date.now()}`,
    title,
    description: description || "",
    status: "pending" as const,
    priority: priority || "medium",
    dueDate: dueDate || new Date().toISOString().split("T")[0],
    dueTime: dueTime || "12:00",
    duration: Number(duration) || 30,
    steps: Array.isArray(steps) ? steps.map((s: any, idx: number) => ({
      id: `ts_${Date.now()}_${idx}`,
      title: typeof s === "string" ? s : s.title || "",
      completed: false
    })) : [],
    kickoffKit: kickoffContent ? {
      type: kickoffType || "personal",
      title: `${title} Kickoff Kit`,
      content: kickoffContent
    } : undefined,
    createdAt: new Date().toISOString(),
    recurring: recurring || "none"
  };

  dbState.tasks.push(newTask);

  dbState.notifications.unshift({
    id: `n_${Date.now()}`,
    title: "Task Manually Scheduled",
    message: `"${title}" has been successfully added for ${newTask.dueDate} at ${newTask.dueTime}.`,
    type: "success" as const,
    timestamp: new Date().toISOString(),
    read: false
  });

  res.json(dbState);
});

// Log Habit
app.post("/api/habits/log", (req, res) => {
  const { id } = req.body;
  const habit = dbState.habits.find(h => h.id === id);
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }

  const today = new Date().toISOString().split("T")[0];
  const completedIndex = habit.completedDays.indexOf(today);

  if (completedIndex !== -1) {
    // Un-complete today
    habit.completedDays.splice(completedIndex, 1);
    habit.streak = Math.max(0, habit.streak - 1);
    habit.lastCompleted = habit.completedDays[habit.completedDays.length - 1];
  } else {
    // Complete today
    habit.completedDays.push(today);
    habit.streak += 1;
    habit.lastCompleted = today;

    // Toast Alert
    dbState.notifications.unshift({
      id: `n_${Date.now()}`,
      title: "Habit Streak Maintained",
      message: `Nice work! Your streak for "${habit.title}" is now ${habit.streak} days!`,
      type: "success" as const,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  res.json(dbState);
});

// Create habit
app.post("/api/habits/create", (req, res) => {
  const { title, frequency } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Habit title required" });
  }

  const newHabit = {
    id: `h_${Date.now()}`,
    title,
    frequency: frequency || "daily",
    streak: 0,
    completedDays: []
  };

  dbState.habits.push(newHabit);
  res.json(dbState);
});

// Delete habit
app.post("/api/habits/delete", (req, res) => {
  const { id } = req.body;
  dbState.habits = dbState.habits.filter(h => h.id !== id);
  res.json(dbState);
});

// Update steps
app.post("/api/tasks/update-steps", (req, res) => {
  const { id, steps } = req.body;
  const task = dbState.tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  task.steps = steps;
  res.json(dbState);
});

// Reorder tasks manually
app.post("/api/tasks/reorder", (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds must be an array" });
  }

  // Assign positions based on the order of IDs received
  orderedIds.forEach((id, index) => {
    const task = dbState.tasks.find(t => t.id === id);
    if (task) {
      task.position = index;
    }
  });

  res.json(dbState);
});

// Reschedule task with cascade shift
app.post("/api/tasks/reschedule", (req, res) => {
  const { id, dueTime, duration } = req.body;
  const task = dbState.tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  task.dueTime = dueTime;
  task.duration = duration;
  
  // Cascade shift all overlapping pending tasks on the same date
  cascadeShiftTasks(task.dueDate);
  
  res.json(dbState);
});

// Complete task early and pull forward the next task
app.post("/api/tasks/complete-early", (req, res) => {
  const { id, clientTimeInfo } = req.body;
  const task = dbState.tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  task.status = "completed";
  task.steps.forEach(s => s.completed = true);
  
  let nowMins = 0;
  if (clientTimeInfo && clientTimeInfo.localTimeStr) {
    const [h, m] = clientTimeInfo.localTimeStr.split(":").map(Number);
    nowMins = h * 60 + m;
  } else {
    const now = new Date();
    nowMins = now.getHours() * 60 + now.getMinutes();
  }
  
  const toStr = (mTotal: number) => {
    const h = Math.floor(mTotal / 60) % 24;
    const m = mTotal % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  
  const date = task.dueDate;
  const pendingOnDay = sortTasks(
    dbState.tasks.filter(t => t.dueDate === date && t.status === "pending")
  );
    
  if (pendingOnDay.length > 0) {
    const nextTask = pendingOnDay[0];
    const originalTime = nextTask.dueTime;
    
    // Find custom gap
    let gap = 5; // Default gap
    if (nextTask.dependencyTaskId === task.id && typeof nextTask.customGapMinutes === "number") {
      gap = nextTask.customGapMinutes;
    } else {
      // Check if ANY task on the day depends on this completed task
      const matchDep = pendingOnDay.find(t => t.dependencyTaskId === task.id);
      if (matchDep && typeof matchDep.customGapMinutes === "number") {
        gap = matchDep.customGapMinutes;
      }
    }
    
    const nextStartMins = nowMins + gap;
    nextTask.dueTime = toStr(nextStartMins);
    
    dbState.notifications.unshift({
      id: `n_early_${Date.now()}`,
      title: "Task Pulled Forward",
      message: `"${task.title}" completed early! "${nextTask.title}" has been scheduled to start in ${gap} minutes at ${nextTask.dueTime} (originally ${originalTime}).`,
      type: "success" as const,
      timestamp: new Date().toISOString(),
      read: false
    });
    
    // Recalculate any downstream overlaps
    const allPendingSorted = sortTasks(
      dbState.tasks.filter(t => t.dueDate === date && t.status === "pending")
    );
      
    const toMins = (tStr: string) => {
      const [h, m] = tStr.split(":").map(Number);
      return h * 60 + m;
    };
    
    for (let i = 0; i < allPendingSorted.length; i++) {
      if (i === 0) continue;
      const cur = allPendingSorted[i];
      const prev = allPendingSorted[i-1];
      const prevEnd = toMins(prev.dueTime) + prev.duration;
      const curStart = toMins(cur.dueTime);
      if (curStart < prevEnd) {
        cur.dueTime = toStr(prevEnd);
      }
    }
  }
  
  res.json(dbState);
});

// Clear Notifications
app.post("/api/notifications/clear", (req, res) => {
  dbState.notifications = [];
  res.json(dbState);
});

// Simulate incoming schedule changes (Alert notification)
app.post("/api/simulate-change", (req, res) => {
  const changeTitle = "Schedule Alert: Overlapping Conflict";
  const changeMsg = "System detected an incoming task insertion at 14:15. Pitch rehearsal may need rescheduling.";
  
  dbState.notifications.unshift({
    id: `n_${Date.now()}`,
    title: changeTitle,
    message: changeMsg,
    type: "alert" as const,
    timestamp: new Date().toISOString(),
    read: false
  });

  res.json(dbState);
});

// Start dev or production configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
