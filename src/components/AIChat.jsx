import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, HelpCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your SmartSpend AI assistant. I parse your local receipts and transactions to help you manage your financial health.\n\nAsk me questions like:\n• \"Do I have active subscriptions?\"\n• \"Any advice to save money?\"\n• \"Where did my money go?\""
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    "What is my Financial Health Score?",
    "Do I have active subscriptions?",
    "Any advice to save money?",
    "Where did my money go?"
  ]);

  const messagesEndRef = useRef(null);
  const { showError } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText) => {
    const text = messageText || input;
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput('');
    setLoading(true);

    try {
      // Map frontend history format to backend ChatMessage schema
      const historyPayload = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const res = await api.chat.sendMessage(text, historyPayload);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply
      }]);
      
      if (res.suggested_questions && res.suggested_questions.length > 0) {
        setSuggestions(res.suggested_questions);
      }
    } catch (err) {
      showError(err.message || "Failed to contact AI assistant.");
    } finally {
      setLoading(false);
    }
  };

  // Utility to parse markdown bold/list elements in a basic way for clean UI display
  const formatMessage = (content) => {
    return content.split('\n').map((line, lIdx) => {
      let elements = [];
      let cursor = 0;
      
      // Basic match for list bullet
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('*') || line.trim().startsWith('-');
      const cleanLine = isBullet ? line.replace(/^[•\*\-\s]+/, '') : line;
      
      // Highlight bold parts (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;
      let parts = [];
      let lastIndex = 0;
      
      while ((match = boldRegex.exec(cleanLine)) !== null) {
        if (match.index > lastIndex) {
          parts.push(cleanLine.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} style={{ color: 'white', fontWeight: 700 }}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      
      if (lastIndex < cleanLine.length) {
        parts.push(cleanLine.substring(lastIndex));
      }

      if (parts.length === 0) {
        parts.push(cleanLine);
      }

      if (isBullet) {
        return (
          <li key={lIdx} style={{ marginLeft: '20px', marginBottom: '6px', listStyleType: 'disc', color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--text-primary)' }}>{parts}</span>
          </li>
        );
      } else {
        return (
          <p key={lIdx} style={{ marginBottom: '10px', lineHeight: 1.5 }}>
            {parts}
          </p>
        );
      }
    });
  };

  return (
    <div className="glass-card stat-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
        <Sparkles size={20} className="accent-text-violet" style={{ animation: 'spin-scanner-icon 6s linear infinite' }} />
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>SmartSpend AI Assistant</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Your local OCR financial intelligence chatbot</p>
        </div>
      </div>

      {/* MESSAGES VIEW */}
      <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '6px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={idx} 
              style={{
                display: 'flex',
                gap: '12px',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                flexDirection: isUser ? 'row-reverse' : 'row',
                maxWidth: '85%'
              }}
            >
              {/* Avatar Icon */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: isUser ? 'var(--c-violet-glow)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isUser ? 'rgba(139,92,246,0.2)' : 'var(--border-glass)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isUser ? <User size={16} color="var(--c-violet)" /> : <Bot size={16} color="white" />}
              </div>

              {/* Message Bubble */}
              <div className="glass-card" style={{
                padding: '12px 18px',
                borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: isUser ? 'rgba(139, 92, 246, 0.08)' : 'rgba(0,0,0,0.15)',
                borderColor: isUser ? 'rgba(139, 92, 246, 0.25)' : 'var(--border-glass)',
                fontSize: '0.9rem',
                color: 'var(--text-primary)'
              }}>
                {formatMessage(msg.content)}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={16} color="white" />
            </div>
            <div className="glass-card" style={{
              padding: '14px 20px',
              borderRadius: '4px 16px 16px 16px',
              background: 'rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem'
            }}>
              <Loader2 size={14} className="animate-spin accent-text-violet" />
              <span>Analyzing spend tables...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTION CHIPS */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              className="btn-glass"
              onClick={() => handleSend(sug)}
              disabled={loading}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                borderRadius: '20px',
                borderColor: 'rgba(255,255,255,0.04)',
                background: 'rgba(255,255,255,0.02)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* INPUT FORM */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          className="input-glass"
          placeholder="Ask about your financial health, subscriptions, or categories..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          style={{ flexGrow: 1 }}
        />
        <button
          type="submit"
          className="btn-glass btn-primary"
          disabled={loading || !input.trim()}
          style={{ padding: '12px 20px', borderRadius: '12px', flexShrink: 0 }}
        >
          <Send size={16} />
        </button>
      </form>
      
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
