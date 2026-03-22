import { useState, useEffect, useRef, useCallback } from 'react';
import { aiApi } from '@/lib/api';
import { MessageCircle, Send, Plus, Bot, User, Loader2, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const loadConversations = async () => {
    setLoadError(null);
    const result = await aiApi.getConversations();
    if (result.success && result.data) {
      setConversations(result.data.conversations);
    } else {
      const msg = result.error?.message || 'Failed to load conversations. Please sign in and try again.';
      setLoadError(msg);
    }
  };

  const loadConversation = async (id: string) => {
    setActiveConversation(id);
    setIsLoading(true);
    setError(null);
    const result = await aiApi.getConversation(id);
    if (result.success && result.data) {
      setMessages(result.data.messages);
    } else {
      setError(result.error?.message || 'Failed to load conversation.');
    }
    setIsLoading(false);
  };

  const createNewConversation = async () => {
    setError(null);
    const result = await aiApi.createConversation();
    if (result.success && result.data) {
      setConversations([result.data.conversation, ...conversations]);
      setActiveConversation(result.data.conversation.id);
      setMessages([]);
    } else {
      setError(result.error?.message || 'Failed to create conversation. AI may not be configured.');
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    setError(null);
    if (!activeConversation) {
      const result = await aiApi.createConversation();
      if (!result.success || !result.data) {
        setError(result.error?.message || 'Failed to create conversation. AI may not be configured.');
        return;
      }
      setConversations([result.data.conversation, ...conversations]);
      setActiveConversation(result.data.conversation.id);
      await streamMessage(result.data.conversation.id, input.trim());
    } else {
      await streamMessage(activeConversation, input.trim());
    }
  }, [input, activeConversation, isStreaming, conversations]);

  const streamMessage = async (conversationId: string, content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'Failed to get AI response.';
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson?.error?.message || errJson?.message || errMsg;
        } catch {
          if (response.status === 401) errMsg = 'Please sign in to use AI Assistant.';
          else if (response.status === 503) errMsg = 'AI service is temporarily unavailable.';
        }
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ ${errMsg}`,
          created_at: new Date().toISOString(),
        }]);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(line => line.startsWith('data: '));
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
              if (data.done) {
                const assistantMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: fullContent,
                  created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, assistantMessage]);
                setStreamingContent('');
              }
              if (data.error) {
                const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || 'AI error');
                setMessages(prev => [...prev, {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: `⚠️ ${errMsg}`,
                  created_at: new Date().toISOString(),
                }]);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ${errMsg}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-96 h-[500px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white">AI Assistant</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-24 border-r border-gray-700 flex flex-col">
          <button
            onClick={createNewConversation}
            className="p-2 m-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
          {loadError && (
            <p className="px-2 py-1 text-xs text-amber-400 truncate" title={loadError}>{loadError}</p>
          )}
          <div className="flex-1 overflow-y-auto">
            {conversations.slice(0, 10).map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full p-2 text-xs text-left truncate hover:bg-gray-800 ${
                  activeConversation === conv.id ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                {conv.title.substring(0, 15)}...
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {error && (
            <div className="mx-3 mt-2 p-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs flex items-center justify-between gap-2">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-amber-400 hover:text-white shrink-0">×</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : messages.length === 0 && !streamingContent ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm text-center px-4">
                {error ? (
                  <>
                    <p className="text-amber-400 mb-2">⚠️ {error}</p>
                    <p className="text-xs">Make sure AI_INTEGRATIONS_OPENAI_API_KEY is set in server env.</p>
                  </>
                ) : (
                  <>
                    <Bot className="w-10 h-10 mb-2 text-purple-400" />
                    <p>Ask me about your account, transactions, cards, or anything!</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3 h-3 text-purple-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] p-2.5 rounded-xl text-sm ${
                        message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-blue-400" />
                      </div>
                    )}
                  </div>
                ))}
                {streamingContent && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 text-purple-400" />
                    </div>
                    <div className="max-w-[85%] p-2.5 rounded-xl text-sm bg-gray-800 text-gray-100">
                      <p className="whitespace-pre-wrap">{streamingContent}</p>
                      <span className="inline-block w-1 h-4 bg-purple-400 animate-pulse ml-1" />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="p-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700 transition-colors"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
