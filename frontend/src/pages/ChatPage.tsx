import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, BrainCircuit } from 'lucide-react'
import api from '../api/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load last analysis context from localStorage
  const getContext = () => {
    try {
      const raw = localStorage.getItem('lastAnalysis')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/chat', {
        message: input,
        context: getContext(),
        history: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          content: m.content,
        })),
      })

      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const context = getContext()

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-5 fade-up">
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          AI Career Mentor
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {context.score
            ? `Context loaded — ${context.target_role} analysis (score: ${context.score})`
            : 'Ask anything about your career, resume, or interview prep'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 fade-up-delay-1">
        {messages.length === 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-slate-500 text-sm text-center mb-6">Start a conversation with your AI career mentor</p>
            {[
              'What skills should I prioritize for a Software Engineer role?',
              'How do I quantify my achievements on a resume?',
              'What are common resume mistakes for freshers?',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="w-full text-left text-sm text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl px-4 py-3 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center mr-2 mt-1 shrink-0">
                <BrainCircuit size={14} className="text-indigo-400" />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-800 text-slate-200 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center mr-2 shrink-0">
              <BrainCircuit size={14} className="text-indigo-400" />
            </div>
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
              <Loader2 size={14} className="animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 fade-up-delay-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about your resume, career, or interview prep..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 rounded-xl transition-colors"
        >
          <Send size={17} className="text-white" />
        </button>
      </div>
    </div>
  )
}
