<div align="center">
 
</div>

# 🚀 VibePilot Core

An intentional, production-grade AI-powered productivity companion built for the **Vibe21Ship Hackathon**. VibePilot replaces passive alerts with an interactive, user-authorized execution engine built to help users make better decisions and manage sudden schedule conflicts under pressure without cognitive fatigue.

---

## 💡 Problem Statement & Focus
* **Track Selected:** Problem 1: The Last-Minute Life Saver
* **Core Challenge:** Traditional productivity tools rely on easily ignorable notifications. VibePilot mitigates this by using an active "Propose, Don't Impose" workflow—dynamically parsing chaos and building tailored execution pipelines that require a user confirmation before syncing.

---

## 📂 Project Directory Structure

Here is the modular layout of our codebase as generated and verified:

```text
├── src/
│   ├── components/
│   │   ├── ConversationalPanel.tsx  # Central chat layout & speech processing UI
│   │   ├── ProposalCard.tsx         # Active, user-controlled guardrail action cards
│   │   ├── CalendarPanel.tsx        # High-whitespace dynamic schedule renderer
│   │   ├── TimelineView.tsx         # Vertical daily hourly task tracker stack
│   │   ├── HabitGoalTracker.tsx     # Clean daily streak validation matrix
│   │   ├── FocusSprint.tsx          # User-initiated dark focus mode workspace
│   │   └── NotificationsPanel.tsx   # Context-aware alert aggregator
│   ├── App.tsx                      # Core layout controller and root state context
│   ├── main.tsx                     # React application mounting point
│   ├── index.css                    # Global Tailwind CSS configurations
│   └── types.ts                     # TypeScript data schema definitions
├── server.ts                        # Secure Node.js mock API endpoint router
├── package.json                     # Dynamic compilation dependencies
└── vite.config.ts                   # Fast production bundling engine
