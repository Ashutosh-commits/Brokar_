import { useState, useRef, useEffect } from "react";
import { User } from "./../lib/auth";
import { api } from "./../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatBotProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "How does price prediction work?",
  "How do I compare properties?",
  "What's a good appreciation rate?",
  "Explain stamp duty in India",
  "How do I save a property?",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatBot({ open, onOpenChange, user }: ChatBotProps) {
  const welcomeText = user
    ? `Namaste ${user.name.split(" ")[0]}! I'm BROkar, your real estate assistant. I can help you navigate the platform, understand price predictions, compare properties, and answer any investment questions. How can I help?`
    : "Namaste! I'm BROkar, your real estate assistant. I can help with property information, price predictions, and investment advice. How can I help you today?";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeText,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Track viewport width so the panel resizes correctly on any device.
  const [winW, setWinW] = useState(() => window.innerWidth);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update welcome message when user logs in
  useEffect(() => {
    if (user) {
      setMessages((prev) => {
        const first = prev[0];
        if (first?.id === "welcome") {
          return [
            {
              ...first,
              content: `Namaste ${user.name.split(" ")[0]}! I'm BROkar, your real estate assistant. I can help you navigate the platform, understand price predictions, compare properties, and answer any investment questions. How can I help?`,
            },
            ...prev.slice(1),
          ];
        }
        return prev;
      });
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Keep winW in sync so the panel respects screen size changes (rotation, resize).
  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async (text: string) => {
    const userText = text.trim();
    if (!userText || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Route through the Express backend — the Groq key stays server-side only.
      // The api instance (src/lib/api.ts) automatically attaches the JWT token.
      const { data } = await api.post("/chat", { message: userText });
      const reply =
        data.reply ?? "Sorry, I could not generate a response. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Make sure you're logged in and the server is running.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!open) return null;

  // Responsive sizing: on phones (<480 px) the panel fills the screen width
  // and uses 85 % of viewport height. On larger screens it floats as a 380×560 window.
  const isMobile = winW < 480;
  const panelWidth  = isMobile ? `calc(100vw - 16px)` : 380;
  const panelHeight = isMobile ? `min(560px, calc(100vh - 100px))` : 560;
  const panelRight  = isMobile ? 8  : 24;
  const panelBottom = isMobile ? 72 : 88;

  return (
    <div
      style={{
        position: "fixed",
        bottom: panelBottom,
        right: panelRight,
        width: panelWidth,
        height: panelHeight,
        display: "flex",
        flexDirection: "column",
        borderRadius: isMobile ? 12 : 16,
        overflow: "hidden",
        boxShadow: "0 24px 48px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.1)",
        zIndex: 50,
        background: "white",
        border: "1px solid #f0f0f0",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
              fill="white"
              opacity="0.9"
            />
            <path
              d="M17 3L22 8"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span
              style={{
                color: "white",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "-0.5px",
              }}
            >
              BRO
            </span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 18 }}>
              kar
            </span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>
            {user ? `Chatting as ${user.name.split(" ")[0]}` : "Property Assistant"}
            {" · Powered by Llama 3"}
          </div>
        </div>

        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#4ade80",
            boxShadow: "0 0 0 2px rgba(74,222,128,0.3)",
          }}
        />
        <button
          onClick={() => onOpenChange(false)}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: 6,
            width: 28,
            height: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "#fafafa",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 13px",
                borderRadius:
                  msg.role === "user"
                    ? "16px 16px 4px 16px"
                    : "16px 16px 16px 4px",
                background: msg.role === "user" ? "#dc2626" : "white",
                color: msg.role === "user" ? "white" : "#1a1a1a",
                fontSize: 13.5,
                lineHeight: 1.55,
                boxShadow:
                  msg.role === "user"
                    ? "0 2px 8px rgba(220,38,38,0.3)"
                    : "0 1px 4px rgba(0,0,0,0.08)",
                border: msg.role === "assistant" ? "1px solid #eee" : "none",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.content}
            </div>
            <span
              style={{
                fontSize: 10,
                color: "#aaa",
                marginTop: 3,
                paddingLeft: msg.role === "assistant" ? 4 : 0,
                paddingRight: msg.role === "user" ? 4 : 0,
              }}
            >
              {formatTime(msg.timestamp)}
            </span>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                background: "white",
                borderRadius: "16px 16px 16px 4px",
                border: "1px solid #eee",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#dc2626",
                    opacity: 0.4,
                    animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions — only on first message */}
      {messages.length === 1 && (
        <div
          style={{
            padding: "6px 12px 4px",
            background: "#fafafa",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              style={{
                background: "white",
                border: "1px solid #e5e5e5",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 11.5,
                color: "#555",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "#dc2626";
                (e.target as HTMLButtonElement).style.color = "#dc2626";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "#e5e5e5";
                (e.target as HTMLButtonElement).style.color = "#555";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "10px 12px",
          background: "white",
          borderTop: "1px solid #f0f0f0",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Ask about properties, prices, features..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "9px 14px",
            border: "1.5px solid #e5e5e5",
            borderRadius: 24,
            fontSize: 13.5,
            outline: "none",
            background: "#fafafa",
            color: "#1a1a1a",
            transition: "border-color 0.15s",
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#dc2626")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            background:
              !input.trim() || isLoading ? "#f0f0f0" : "#dc2626",
            color: !input.trim() || isLoading ? "#bbb" : "white",
            cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow:
              input.trim() && !isLoading
                ? "0 2px 8px rgba(220,38,38,0.35)"
                : "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes chatBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
