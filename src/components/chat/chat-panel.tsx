'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { InlineChart, parseChartBlocks } from '@/components/chat/inline-chart'
import { sanitizeHtml } from '@/lib/utils/sanitize'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_SUGGESTIONS = [
  'Give me a financial health check',
  'Where is our money going this month?',
  'When do we run out of cash?',
  'What if we hire 3 more engineers?',
]

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/dashboard/payroll': [
    "What's our cost per engineer?",
    'What if we hire 2 more?',
    'Show payroll breakdown',
  ],
  '/dashboard/transactions': [
    'Show top spending categories',
    'Any unusual transactions?',
    'Compare to last month',
  ],
  '/dashboard/deals': [
    'Which deals should we prioritize?',
    'What if we close the top 3?',
    'Show pipeline by stage',
  ],
  '/dashboard/payments': [
    'What should we pay first?',
    'How much cash do we need?',
    'Show overdue breakdown',
  ],
}

const KATEX_OPEN_P = '\u0000KO\u0000'
const KATEX_CLOSE_P = '\u0000KC\u0000'

function sanitizeLatex(expr: string): string {
  return expr.replace(/\\text\s*\{([^}]*)\}/g, (_, inner) => {
    return '\\text{' + inner.replace(/\$/g, '\\$') + '}'
  })
}

const BARE_LATEX_PANEL = /\\(?:times|frac|cdot|div|pm|sqrt|text|sum|prod|int|leq|geq|neq|approx|infty|left|right)\b/

function renderLatexPanel(text: string): string {
  let result = text
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
    try {
      return KATEX_OPEN_P + katex.renderToString(sanitizeLatex(expr.trim()), { displayMode: true, throwOnError: false }) + KATEX_CLOSE_P
    } catch { return expr }
  })
  result = result.replace(/\\\((.+?)\\\)/g, (_, expr) => {
    try {
      return KATEX_OPEN_P + katex.renderToString(sanitizeLatex(expr.trim()), { displayMode: false, throwOnError: false }) + KATEX_CLOSE_P
    } catch { return expr }
  })
  // Fallback for bare LaTeX
  result = result.split('\n').map(line => {
    if (!BARE_LATEX_PANEL.test(line) || line.includes('\u0000')) return line
    return line.replace(
      /([\d,.\s$()]*(?:\\(?:times|frac|cdot|div|pm|sqrt|text|sum|prod|int|leq|geq|neq|approx|infty|left|right)(?:\s*\{[^}]*\}){0,2}[\d,.\s$()=+\-]*)+)/g,
      (match) => {
        if (!BARE_LATEX_PANEL.test(match)) return match
        try {
          return KATEX_OPEN_P + katex.renderToString(sanitizeLatex(match.trim()), { displayMode: false, throwOnError: false }) + KATEX_CLOSE_P
        } catch { return match }
      }
    )
  }).join('\n')
  return result
}

function renderMarkdown(text: string): string {
  let html = renderLatexPanel(text)
  // Protect KaTeX output from HTML escaping
  html = html.replace(/\u0000KO\u0000([\s\S]*?)\u0000KC\u0000/g, (_, katexHtml) => {
    return `\u0000SAFE${btoa(unescape(encodeURIComponent(katexHtml)))}\u0000`
  })
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Restore KaTeX HTML
  html = html.replace(/\u0000SAFE([\s\S]*?)\u0000/g, (_, b64) => {
    return decodeURIComponent(escape(atob(b64)))
  })
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-sm">$1</code>')
  // Unordered lists
  html = html.replace(/^[\s]*[-*]\s+(.+)/gm, '<li class="ml-4 list-disc">$1</li>')
  // Ordered lists
  html = html.replace(/^[\s]*\d+\.\s+(.+)/gm, '<li class="ml-4 list-decimal">$1</li>')
  // Line breaks
  html = html.replace(/\n/g, '<br/>')
  return sanitizeHtml(html)
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-[#5a6d82] text-sm py-2 px-4">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>Thinking...</span>
    </div>
  )
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(400)
  const [isMac, setIsMac] = useState(false)
  const isResizingRef = useRef(false)
  const currentPath = usePathname()

  const suggestions = useMemo(() => {
    // Find the most specific matching page
    for (const [path, items] of Object.entries(PAGE_SUGGESTIONS)) {
      if (currentPath?.startsWith(path)) return items
    }
    return DEFAULT_SUGGESTIONS
  }, [currentPath])

  // Detect OS client-side only to avoid hydration mismatch
  useEffect(() => {
    setIsMac(/Mac/.test(navigator.userAgent))
  }, [])

  // Drag-to-resize from left edge
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 360), 900)
      setPanelWidth(newWidth)
    }
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [showPulse, setShowPulse] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Stop pulse animation after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  // Cmd+J / Ctrl+J keyboard shortcut to toggle panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    // Add empty assistant message that we'll stream into
    const assistantIdx = updatedMessages.length
    setMessages([...updatedMessages, { role: 'assistant', content: '' }])
    setStreamingIdx(assistantIdx)
    setIsThinking(true)
    setLastFailedMessage(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('Chat API error:', response.status, data)
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            if (payload === '[DONE]') break
            try {
              const parsed = JSON.parse(payload)
              if (parsed.text) {
                if (accumulated === '') {
                  setIsThinking(false)
                }
                accumulated += parsed.text
                setMessages(prev => {
                  const next = [...prev]
                  next[assistantIdx] = { role: 'assistant', content: accumulated }
                  return next
                })
              }
              if (parsed.error) throw new Error(parsed.error)
            } catch (e) {
              // skip malformed JSON lines
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setLastFailedMessage(text.trim())
      setMessages(prev => {
        const next = [...prev]
        next[assistantIdx] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        }
        return next
      })
    } finally {
      setIsLoading(false)
      setIsThinking(false)
      setStreamingIdx(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <>
      {/* Cursor and pulse keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes blinkCursor {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            .streaming-cursor::after {
              content: '\\25AE';
              display: inline;
              color: #60a5fa;
              animation: blinkCursor 0.8s step-end infinite;
              margin-left: 1px;
            }
            @keyframes chatPulse {
              0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
              70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
              100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            }
          `,
        }}
      />

      {/* Toggle button */}
      <div
        className="fixed bottom-8 right-8 z-50 flex items-center gap-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Hover label */}
        <div
          className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 pointer-events-none"
          style={{
            background: '#1a2740',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#93b4f4',
            opacity: isHovered && !isOpen ? 1 : 0,
            transform: isHovered && !isOpen ? 'translateX(0)' : 'translateX(8px)',
          }}
        >
          Ask Frankly <span style={{ color: '#5a6d82' }} className="ml-1">{isMac ? '\u2318' : 'Ctrl+'}J</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
            animation: showPulse && !isOpen ? 'chatPulse 2s ease-in-out 3' : 'none',
          }}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          {isOpen ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
              <path d="M18 12l1 2.5L21.5 16 19 17.5 18 20l-1-2.5L14.5 16 17 14.5 18 12z" />
              <path d="M6 16l.5 1.5L8 18l-1.5.5L6 20l-.5-1.5L4 18l1.5-.5L6 16z" />
            </svg>
          )}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-50 h-full flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: `min(100vw, ${panelWidth}px)`,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          background: '#0d1a2d',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isOpen ? '-4px 0 24px rgba(0, 0, 0, 0.3)' : 'none',
        }}
      >
        {/* Resize handle — left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group/resize"
          onMouseDown={(e) => {
            e.preventDefault()
            isResizingRef.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover/resize:bg-blue-500/40 transition-colors" />
        </div>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
              </svg>
            </div>
            <h2
              className="text-base font-semibold"
              style={{ color: '#e8edf4' }}
            >
              AI Assistant
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: '#7a8ba3' }}
            aria-label="Close chat"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="space-y-4">
              <p
                className="text-sm text-center py-6"
                style={{ color: '#7a8ba3' }}
              >
                Ask me anything about your company finances.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white/10"
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      color: '#93b4f4',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            // Don't render empty assistant messages (streaming placeholder)
            if (msg.role === 'assistant' && !msg.content) return null

            if (msg.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #4f6ef6)', color: '#ffffff' }}
                  >
                    {msg.content}
                  </div>
                </div>
              )
            }

            // Assistant message — parse analysis section and strip FOLLOW_UPS
            const cleaned = msg.content.replace(/\n?FOLLOW_UPS:\s*.+$/m, '').trimEnd()
            const isStreaming = streamingIdx === i

            // Parse Frankly Analysis section
            const delimIdx = cleaned.lastIndexOf('---\n')
            let mainContent = cleaned
            let analysisContent: string | null = null
            if (delimIdx >= 0) {
              const afterDelim = cleaned.substring(delimIdx + 4).trim()
              if (/^\*{0,2}(?:Frankly )?Analysis\*{0,2}/i.test(afterDelim)) {
                mainContent = cleaned.substring(0, delimIdx).trim()
                analysisContent = afterDelim.replace(/\n?\s*— Frankly, AI CFO\s*$/, '').trim()
              }
            }

            let segments: ReturnType<typeof parseChartBlocks>
            if (isStreaming) {
              const cleanedChart = mainContent
                .replace(/```chart[\s\S]*?```/g, '\n\n*Generating chart...*\n\n')
                .replace(/```chart[\s\S]*$/g, '\n\n*Generating chart...*\n\n')
                .replace(/\n?FOLLOW_UPS?:?\s*.*$/m, '')
                .replace(/\n?FOLLOW[-_]?UP.*$/mi, '')
              segments = [{ type: 'text' as const, content: cleanedChart }]
            } else {
              segments = parseChartBlocks(mainContent)
            }

            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  {/* Main content with inline charts */}
                  <div
                    className="rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                    style={{ background: '#111d2e', border: '1px solid rgba(255, 255, 255, 0.06)', color: '#dce4ef' }}
                  >
                    {segments.map((seg, si) =>
                      seg.type === 'chart' ? (
                        <InlineChart key={si} chartData={seg.data} />
                      ) : (
                        <span key={si} dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.content) }} />
                      )
                    )}
                  </div>
                  {/* Frankly Analysis card */}
                  {analysisContent && (
                    <div
                      className="rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                      style={{
                        background: 'rgba(59, 130, 246, 0.05)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderLeftWidth: '3px',
                        borderLeftColor: '#3b82f6',
                        color: '#c8d6e5',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisContent) }}
                    />
                  )}
                  {/* Follow-up buttons */}
                  {!isLoading && !isStreaming && i === messages.length - 1 && (() => {
                    const followUpMatch = msg.content.match(/FOLLOW_UPS:\s*(.+)$/m)
                    if (!followUpMatch) return null
                    const items = followUpMatch[1].split('|').map(q => q.trim()).filter(q => q.length > 0).slice(0, 3)
                    if (items.length === 0) return null
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(text => (
                          <button
                            key={text}
                            onClick={() => sendMessage(text)}
                            className="text-[11px] px-2.5 py-1 rounded-full transition-all"
                            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#7ba4db' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.color = '#a3c4f3' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; e.currentTarget.style.color = '#7ba4db' }}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}

          {lastFailedMessage && !isLoading && (
            <div className="flex justify-start">
              <button
                onClick={() => {
                  // Remove the error message and the failed user message, then retry
                  setMessages(prev => prev.slice(0, -2))
                  setLastFailedMessage(null)
                  sendMessage(lastFailedMessage)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 underline ml-2 mb-1"
              >
                Retry last message
              </button>
            </div>
          )}

          {isThinking && (
              <div className="flex justify-start">
                <div
                  className="rounded-xl"
                  style={{
                    background: '#111d2e',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <ThinkingIndicator />
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2"
            style={{
              background: '#0a1628',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#4a5c73]"
              style={{ color: '#e8edf4' }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              }}
              aria-label="Send message"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
