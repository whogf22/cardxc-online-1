import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi! I'm the CardXC support assistant. How can I help you today? You can ask about your account, virtual cards, transfers, or anything else.",
  time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
};

export default function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate assistant reply (can be replaced with real AI/API later)
    setTimeout(() => {
      const reply: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: "Thanks for your message! A support agent will get back to you shortly. For urgent issues, you can also email us at support@cardxc.online or call +1 (516) 666-6333.",
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Live chat"
    >
      <div
        className="w-full sm:max-w-md h-[85vh] sm:h-[520px] bg-dark-card border border-dark-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-elevated">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center">
              <i className="ri-robot-2-line text-lg text-black" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Chat Assistant</h2>
              <p className="text-xs text-neutral-500">CardXC Support</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-dark-hover transition-colors"
            aria-label="Close chat"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-lime-400/20 flex items-center justify-center shrink-0">
                  <i className="ri-robot-2-line text-lime-400 text-sm" aria-hidden />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-lime-400/20 text-lime-100 rounded-tr-md'
                    : 'bg-dark-elevated text-neutral-200 rounded-tl-md'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <span className="text-xs text-neutral-500 mt-1 block">{msg.time}</span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-lime-400/20 flex items-center justify-center shrink-0">
                <i className="ri-robot-2-line text-lime-400 text-sm" aria-hidden />
              </div>
              <div className="bg-dark-elevated rounded-2xl rounded-tl-md px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-dark-border bg-dark-elevated">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/50 text-sm"
              aria-label="Message"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-3 bg-lime-500 text-black font-semibold rounded-xl hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              aria-label="Send message"
            >
              <i className="ri-send-plane-line text-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
