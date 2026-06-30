import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, HelpCircle, Sparkles, Check } from "lucide-react";
import { Message, Proposal, Task } from "../types";
import ProposalCard from "./ProposalCard";
import { motion, AnimatePresence } from "motion/react";

interface ConversationalPanelProps {
  messages: Message[];
  proposals: Proposal[];
  existingTasks: Task[];
  onSendMessage: (text: string) => Promise<void>;
  onApproveProposal: (id: string, customDate?: string, customSlot?: string, customMessage?: string) => void;
  onDismissProposal: (id: string) => void;
}

export default function ConversationalPanel({
  messages,
  proposals,
  existingTasks,
  onSendMessage,
  onApproveProposal,
  onDismissProposal
}: ConversationalPanelProps) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "processing">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setVoiceStatus("listening");
        setIsListening(true);
      };

      rec.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          setVoiceStatus("processing");
          // Auto send
          await onSendMessage(transcript);
          setInputText("");
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setErrorMsg(`Voice Error: ${event.error}.`);
        setTimeout(() => setErrorMsg(null), 3000);
        setVoiceStatus("idle");
        setIsListening(false);
      };

      rec.onend = () => {
        setVoiceStatus("idle");
        setIsListening(false);
      };

      recognitionRef.current = rec;
    } else {
      console.warn("Web Speech API is not supported in this browser.");
    }
  }, [onSendMessage]);

  const handleToggleVoice = () => {
    if (!recognitionRef.current) {
      setErrorMsg("Voice recognition not supported in this browser.");
      setTimeout(() => setErrorMsg(null), 3500);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setErrorMsg(null);
      recognitionRef.current.start();
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const txt = inputText;
    setInputText("");
    await onSendMessage(txt);
  };

  // Scroll to bottom on updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposals]);

  const samplePrompts = [
    "Schedule Pitch Deck Polish around 2 PM",
    "Deploy API router for 6 PM tonight",
    "Complete my deep work focus habit"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/20 rounded-3xl border border-slate-100 overflow-hidden relative">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-100/80 bg-white/70 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Pilot Assistant</h2>
            <p className="text-[10px] text-slate-400 font-medium">Agentic Reasoning Core Active</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          v1.0
        </div>
      </div>

      {/* Messages / Proposal Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const attachedProposal = msg.proposalId
            ? proposals.find((p) => p.id === msg.proposalId)
            : null;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs transition-all ${
                  isUser
                    ? "bg-indigo-600 text-white rounded-tr-none font-medium"
                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] font-mono text-slate-300 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {/* Inline proposal card immediately following the AI message */}
              {attachedProposal && (
                <div className="mt-3.5 w-full max-w-md">
                  <ProposalCard
                    proposal={attachedProposal}
                    existingTasks={existingTasks}
                    onApprove={onApproveProposal}
                    onDismiss={onDismissProposal}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Warning/Error indicator */}
      {errorMsg && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-900 border border-slate-800 text-slate-200 text-xs py-2 px-3 rounded-xl flex items-center gap-2 shadow-md animate-bounce">
          <MicOff className="w-3.5 h-3.5 text-indigo-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Starter suggestions if no user messages exist */}
      {messages.length <= 1 && (
        <div className="p-4 px-5 border-t border-slate-50 space-y-2 bg-white/40">
          <div className="text-[10px] font-mono uppercase font-bold text-slate-400">Suggested Commands</div>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(p)}
                className="text-[11px] text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 rounded-xl px-3 py-1.5 bg-white transition-all text-left shadow-2xs"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input controls panel */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          
          {/* Voice Mic Trigger */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-3 rounded-2xl border transition-all flex items-center justify-center relative ${
              isListening
                ? "bg-red-50 border-red-200 text-red-600"
                : voiceStatus === "processing"
                ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse"
                : "bg-slate-50 hover:bg-slate-100 border-slate-200/60 text-slate-500"
            }`}
            title={isListening ? "Listening - Click to stop" : "Use voice input"}
          >
            {isListening ? (
              <>
                <Mic className="w-5 h-5 animate-pulse" />
                {/* Custom glowing audio soundbar ripple */}
                <span className="absolute -inset-0.5 rounded-2xl bg-red-400/20 animate-ping" />
              </>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Text Input Box */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={
                isListening
                  ? "Listening..."
                  : voiceStatus === "processing"
                  ? "Processing speech transcript..."
                  : "Type schedule command or chat..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isListening}
              className="w-full text-xs border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white rounded-2xl py-3.5 pl-4 pr-11 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
            />
            {inputText.trim() && (
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
        </form>

        {/* Status Indicators bar */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 px-1">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-red-500" : voiceStatus === "processing" ? "bg-amber-500" : "bg-emerald-500"}`} />
            <span>
              {isListening
                ? "Voice Active: Listening..."
                : voiceStatus === "processing"
                ? "Parsing with Gemini..."
                : "Engine Ready: click Mic or type"}
            </span>
          </div>
          <span className="font-semibold uppercase tracking-wider text-[9px]">Continuous Sync</span>
        </div>

      </div>

    </div>
  );
}
