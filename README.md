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


✨ Key Features
Sleek Tabbed Workspace Layout: Prioritizes minimalism and breathing room by partitioning the view into a clean chat panel on the left and a balanced, tabbed side container on the right (Timeline View vs. Habit Tracker).

The Propose Pipeline (Guardrails): The AI companion never mutates data automatically. It processes incoming complex problems and dynamically renders structured UI ProposalCard elements with explicit [Approve & Sync] and [Dismiss] choices.

Domain-Aware Starter Kits: Instantly addresses blank-page paralysis upon task confirmation. The system detects the domain context to build tailored kickoff payloads (syntax-highlighted code blocks for technical projects, email/document mock templates for professional tasks, or micro-checklists for personal items).

The Crisis Negotiator Engine: If the calendar layer catches overlapping deadlines, the generated card automatically constructs a polished, context-specific extension/rescheduling message template for single-click copying.

Lockdown Focus Sprints: A strictly user-triggered transition via FocusSprint.tsx that fades the workspace into an ultra-minimalist, dark focus environment displaying a deep work countdown timer and an obvious escape path.

🛠️ Technology Stack & Architecture
Frontend: React, Vite, TypeScript, Tailwind CSS, Lucide Icons

Backend: Node.js, Express.js (server.ts)

Google Core Technologies:

Google AI Studio Build Mode: Primary application development and sandbox environment.

Gemini 3.5 Flash: Powers multi-turn contextual reasoning, priority triage, and dynamic template generation.

Google Cloud Run: Hosts the final fully functional live application shell container via the Cloud Starter Tier pipeline.
