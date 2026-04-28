import { useCallback, useEffect, useRef, useState } from "react";
import "./Chat.css";

/**
 * Agent API base:
 * - Dev (default): `/chat-api` → Vite proxies to http://localhost:7000 (cookies on :5173)
 * - Override: set VITE_AGENT_API_BASE=http://localhost:7000 (requires agent CORS + credentials)
 */
function getAgentApiBase() {
  const fromEnv = import.meta.env.VITE_AGENT_API_BASE;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) return "/chat-api";
  return "http://localhost:7000";
}

export default function Chat() {
  const apiBase = getAgentApiBase();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  // Per-tab session: initialize when this component mounts (no localStorage).
  // AbortController avoids duplicate sessions under React StrictMode (dev double-mount).
  useEffect(() => {
    const ac = new AbortController();
    async function initSession() {
      setSessionError("");
      setBusy(true);
      try {
        console.log(`${apiBase}/v1/session`);
        const res = await fetch(`${apiBase}/v1/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
          signal: ac.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `Session failed (${res.status})`);
        }
        setSessionReady(true);
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "bot",
            text: "You’re connected to the LMS assistant. Ask anything the agent supports (registration, marks, attendance, etc.).",
          },
        ]);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setSessionError(e?.message || "Could not start session. Is the agent running on port 7000?");
      } finally {
        setBusy(false);
      }
    }
    initSession();
    return () => ac.abort();
  }, [apiBase]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionReady || busy) return;

    const userMsg = { id: crypto.randomUUID(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    setTyping(true);

    try {
      const res = await fetch(`${apiBase}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => null);
      console.log(`${apiBase}/v1/chat`);
      if (!res.ok) {
        throw new Error(data?.error || `Chat failed (${res.status})`);
      }
      const reply = data?.reply ?? "(No reply text)";
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "bot", text: String(reply) }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: `Sorry — something went wrong.\n${e?.message || "Unknown error"}`,
          isError: true,
        },
      ]);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chatPage">
      <header className="chatHeader">
        <div>
          <h1 className="chatTitle">LMS assistant</h1>
          <p className="chatSubtitle">Session-based · each tab is isolated</p>
        </div>
        <div className="chatHeaderMeta">
          <span className={`chatPill ${sessionReady ? "ok" : sessionError ? "err" : ""}`}>
            {sessionError ? "Session error" : sessionReady ? "Ready" : "Connecting…"}
          </span>
          <a className="chatLink" href="/login">
            LMS login
          </a>
        </div>
      </header>

      {sessionError ? <div className="chatBanner err">{sessionError}</div> : null}

      <div className="chatShell">
        <div className="chatList" ref={listRef} aria-live="polite">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chatRow ${msg.role === "user" ? "user" : "bot"}${msg.isError ? " error" : ""}`}
            >
              <div className="chatBubble">{msg.text}</div>
            </div>
          ))}
          {typing ? (
            <div className="chatRow bot">
              <div className="chatBubble typing">Typing…</div>
            </div>
          ) : null}
        </div>

        <div className="chatComposer">
          <textarea
            className="chatInput"
            rows={2}
            placeholder={sessionReady ? "Message the assistant…" : "Waiting for session…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!sessionReady || busy}
          />
          <button type="button" className="chatSend" onClick={sendMessage} disabled={!sessionReady || busy || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
