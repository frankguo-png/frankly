'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { DotGridCanvas } from '@/components/ui/dot-grid-canvas'
import { InlineChart, parseChartBlocks } from '@/components/chat/inline-chart'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useDynamicSuggestions } from '@/hooks/use-dynamic-suggestions'
import { sanitizeHtml } from '@/lib/utils/sanitize'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface GroupedConversations {
  label: string
  conversations: Conversation[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Marker to protect KaTeX HTML from being HTML-escaped later
const KATEX_OPEN = '\u0000KO\u0000'
const KATEX_CLOSE = '\u0000KC\u0000'

function sanitizeLatexExpr(expr: string): string {
  return expr.replace(/\\text\s*\{([^}]*)\}/g, (_, inner) => {
    return '\\text{' + inner.replace(/\$/g, '\\$') + '}'
  })
}

const BARE_LATEX_RE = /\\(?:times|frac|cdot|div|pm|sqrt|text|sum|prod|int|leq|geq|neq|approx|infty|left|right|mathbf|mathrm|mathbb|over|binom)\b/

function renderLatex(text: string): string {
  // Block LaTeX: $$...$$ or \[...\]
  let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, expr) => {
    if (!/[\\^_{}]/.test(expr)) return match
    try {
      return KATEX_OPEN + katex.renderToString(sanitizeLatexExpr(expr.trim()), { displayMode: true, throwOnError: false }) + KATEX_CLOSE
    } catch { return match }
  })
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
    try {
      return KATEX_OPEN + katex.renderToString(sanitizeLatexExpr(expr.trim()), { displayMode: true, throwOnError: false }) + KATEX_CLOSE
    } catch { return expr }
  })
  // Inline LaTeX: $...$ (but not $$) or \(...\)
  result = result.replace(/(?<!\$)\$(?!\$)(?!\d)(.+?)(?<!\$)\$(?!\$)/g, (match, expr) => {
    if (!/[\\^_{}]/.test(expr)) return match
    try {
      return KATEX_OPEN + katex.renderToString(sanitizeLatexExpr(expr.trim()), { displayMode: false, throwOnError: false }) + KATEX_CLOSE
    } catch { return match }
  })
  result = result.replace(/\\\((.+?)\\\)/g, (_, expr) => {
    try {
      return KATEX_OPEN + katex.renderToString(sanitizeLatexExpr(expr.trim()), { displayMode: false, throwOnError: false }) + KATEX_CLOSE
    } catch { return expr }
  })

  // Strip bare LaTeX commands that the AI didn't wrap in delimiters.
  // Instead of trying to render them (which is fragile), clean them up
  // into readable plain text so they don't show as raw markup.
  result = result.split('\n').map(line => {
    if (!BARE_LATEX_RE.test(line) || line.includes('\u0000')) return line
    return line
      .replace(/\\times/g, '×')
      .replace(/\\cdot/g, '·')
      .replace(/\\div/g, '÷')
      .replace(/\\pm/g, '±')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\approx/g, '≈')
      .replace(/\\infty/g, '∞')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1 / $2)')
      .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
      .replace(/\\(?:left|right)[()[\]{}|.]/g, '')
      .replace(/\\(?:mathbf|mathrm|mathbb)\{([^}]*)\}/g, '$1')
  }).join('\n')

  return result
}

function renderMarkdown(text: string, streaming = false): string {
  let processedText = text
  if (streaming) {
    // ChatGPT approach: render completed LaTeX blocks normally,
    // but strip incomplete trailing LaTeX (no closing delimiter yet).
    // Only strip from the LAST opening delimiter that has no matching close.
    // Check for unclosed block: \[ without \]
    const lastBlockOpen = processedText.lastIndexOf('\\[')
    const lastBlockClose = processedText.lastIndexOf('\\]')
    if (lastBlockOpen > lastBlockClose) {
      processedText = processedText.substring(0, lastBlockOpen) + processedText.substring(lastBlockOpen).replace(/\\\[[\s\S]*$/, ' ...')
    }
    // Check for unclosed $$
    const ddParts = processedText.split('$$')
    if (ddParts.length % 2 === 0) {
      // Odd number of $$ means last one is unclosed
      processedText = ddParts.slice(0, -1).join('$$') + ' ...'
    }
    // Check for unclosed inline: \( without \)
    const lastInlineOpen = processedText.lastIndexOf('\\(')
    const lastInlineClose = processedText.lastIndexOf('\\)')
    if (lastInlineOpen > lastInlineClose) {
      processedText = processedText.substring(0, lastInlineOpen) + ' ...'
    }
  }
  // First render LaTeX (before HTML escaping, since KaTeX outputs HTML)
  let html = renderLatex(processedText)
  // Protect KaTeX HTML from escaping by base64-encoding it
  html = html.replace(/\u0000KO\u0000([\s\S]*?)\u0000KC\u0000/g, (_, katexHtml) => {
    return `\u0000SAFE${btoa(unescape(encodeURIComponent(katexHtml)))}\u0000`
  })
  // Now escape HTML in the remaining text
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Restore KaTeX HTML
  html = html.replace(/\u0000SAFE([\s\S]*?)\u0000/g, (_, b64) => {
    return decodeURIComponent(escape(atob(b64)))
  })
  // Headers (must be before bold/italic to avoid conflicts)
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:0.9rem;font-weight:600;color:#c8d6e5;margin:0.85rem 0 0.25rem;letter-spacing:0.01em">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1rem;font-weight:700;color:#e8edf4;margin:1rem 0 0.35rem;letter-spacing:0.01em">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.1rem;font-weight:700;color:#e8edf4;margin:1rem 0 0.5rem;letter-spacing:-0.01em">$1</h1>')
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0.75rem 0"/>')
  // Bold - streaming-safe
  if (streaming) {
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*\*([^*]*)$/, '<strong>$1</strong>')
  } else {
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs">$1</code>')
  html = html.replace(/^[\s]*[-\u2022]\s+(.+)/gm, '<li class="ml-4 list-disc">$1</li>')
  html = html.replace(/^[\s]*\d+\.\s+(.+)/gm, '<li class="ml-4 list-decimal">$1</li>')
  html = html.replace(/\n/g, '<br/>')
  return sanitizeHtml(html)
}

function groupConversationsByDate(conversations: Conversation[]): GroupedConversations[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  }

  for (const conv of conversations) {
    const d = new Date(conv.updated_at)
    if (d >= today) {
      groups.Today.push(conv)
    } else if (d >= yesterday) {
      groups.Yesterday.push(conv)
    } else if (d >= weekAgo) {
      groups['This Week'].push(conv)
    } else {
      groups.Older.push(conv)
    }
  }

  return Object.entries(groups)
    .filter(([, convs]) => convs.length > 0)
    .map(([label, conversations]) => ({ label, conversations }))
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Just now'
  return formatDistanceToNow(d, { addSuffix: true })
}

// ─── Suggestion Cards ────────────────────────────────────────────────────────

// ─── Typing Indicator ────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-[#5a6d82] text-sm py-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>Thinking...</span>
    </div>
  )
}

// ─── Analysis Card Parser ────────────────────────────────────────────────────

function parseAnalysisSection(content: string): { main: string; analysis: string | null } {
  // Strip FOLLOW_UPS line (parsed separately for buttons)
  const cleaned = content.replace(/\n?FOLLOW_UPS:\s*.+$/m, '').trimEnd()

  // Look for the analysis section: --- followed by **Frankly Analysis** or **Analysis**
  const delimIdx = cleaned.lastIndexOf('---\n')
  if (delimIdx >= 0) {
    const afterDelim = cleaned.substring(delimIdx + 4).trim()
    // Check if what follows the --- is an Analysis block
    if (/^\*{0,2}(?:Frankly )?Analysis\*{0,2}/i.test(afterDelim)) {
      const main = cleaned.substring(0, delimIdx).trim()
      // Strip any trailing "— Frankly, AI CFO" signature if present (legacy)
      const analysis = afterDelim.replace(/\n?\s*— Frankly, AI CFO\s*$/, '').trim()
      return { main, analysis }
    }
  }
  return { main: cleaned, analysis: null }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null)
  const [isThinking, setIsThinking] = useState(false)

  const { suggestions: dynamicSuggestions } = useDynamicSuggestions()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const userScrolledRef = useRef(false)

  // ─── Debounced search ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ─── Load conversations ──────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations ?? [])
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
      toast.error('Failed to load conversations')
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // ─── Load conversation messages ──────────────────────────────────────────

  const loadConversation = useCallback(async (id: string) => {
    setActiveConversationId(id)
    setConversationLoading(true)
    // Keep previous messages visible during load — swap atomically when ready (no flash)
    try {
      const res = await fetch(`/api/chat/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(
          (data.messages ?? []).map((m: Message) => ({
            role: m.role,
            content: m.content,
            id: m.id,
            created_at: m.created_at,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load conversation:', err)
      toast.error('Failed to load conversation messages')
      setMessages([])
    } finally {
      setConversationLoading(false)
    }
  }, [])

  // ─── Create new conversation ─────────────────────────────────────────────

  const createNewChat = useCallback(async () => {
    setActiveConversationId(null)
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }, [])

  // ─── Auto-scroll (respects manual scroll) ────────────────────────────────

  const programmaticScrollRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (userScrolledRef.current) return
    const container = messagesContainerRef.current
    if (!container) return
    programmaticScrollRef.current = true
    container.scrollTop = container.scrollHeight
    // Reset programmatic flag after scroll settles
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false
    })
  }, [])

  // Detect user-initiated scroll via wheel/touch events only
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleUserScroll = () => {
      // Ignore scroll events triggered by our programmatic scrolling
      if (programmaticScrollRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      if (distanceFromBottom > 150) {
        userScrolledRef.current = true
      } else {
        // User scrolled back to bottom — re-enable auto-scroll
        userScrolledRef.current = false
      }
    }

    // Listen to wheel and touchmove — these are always user-initiated
    container.addEventListener('wheel', handleUserScroll, { passive: true })
    container.addEventListener('touchmove', handleUserScroll, { passive: true })
    return () => {
      container.removeEventListener('wheel', handleUserScroll)
      container.removeEventListener('touchmove', handleUserScroll)
    }
  }, [])

  // Reset auto-scroll when user sends a new message
  useEffect(() => {
    if (isLoading) {
      userScrolledRef.current = false
    }
  }, [isLoading])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // ─── Send message ────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)
    setInput('')
    setIsLoading(true)

    let convId = activeConversationId

    // Create conversation if needed
    if (!convId) {
      try {
        const res = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.trim().length > 50 ? text.trim().substring(0, 50) + '...' : text.trim() }),
        })
        if (res.ok) {
          const data = await res.json()
          convId = data.conversation.id
          setActiveConversationId(convId)
          setConversations((prev) => [data.conversation, ...prev])
        }
      } catch (err) {
        console.error('Failed to create conversation:', err)
        toast.error('Failed to start new conversation. Please try again.')
      }
    }

    // Add empty assistant message for streaming
    const assistantIdx = currentMessages.length
    setMessages([...currentMessages, { role: 'assistant', content: '' }])
    setStreamingIdx(assistantIdx)
    setIsThinking(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map((m) => ({
            role: m.role,
            content: m.role === 'assistant'
              ? m.content.replace(/\n?FOLLOW_UPS:\s*.+$/m, '').trimEnd()
              : m.content,
          })),
          conversationId: convId,
        }),
      })

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`
        try {
          const data = await response.json()
          errorMsg = data.error || errorMsg
        } catch {
          errorMsg = await response.text().catch(() => errorMsg)
        }
        console.error('Chat API error:', response.status, errorMsg)
        throw new Error(errorMsg)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          let parsed: { text?: string; error?: string } | null = null
          try {
            parsed = JSON.parse(payload)
          } catch {
            continue // skip malformed JSON
          }
          if (parsed?.text) {
            // First chunk arrived — stop showing thinking indicator
            if (accumulated === '') {
              setIsThinking(false)
            }
            accumulated += parsed.text
            setMessages((prev) => {
              const next = [...prev]
              next[assistantIdx] = { role: 'assistant', content: accumulated }
              return next
            })
          }
          if (parsed?.error) throw new Error(parsed.error)
        }
      }

      // Stream complete
      setStreamingIdx(null)
      setIsLoading(false)
      setIsThinking(false)

      // Generate AI title after first exchange (user message + assistant response)
      if (convId && currentMessages.length <= 1 && accumulated) {
        generateTitle(convId, text.trim(), accumulated)
      }

      loadConversations()
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const next = [...prev]
        next[assistantIdx] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        }
        return next
      })
      setStreamingIdx(null)
      setIsLoading(false)
      setIsThinking(false)
    }
  }

  // Generate a concise AI title from the first exchange
  const generateTitle = useCallback(async (convId: string, userMsg: string, assistantMsg: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a short title (max 6 words) for this conversation. Reply with ONLY the title, nothing else.\n\nUser asked: "${userMsg}"\n\nAssistant replied about: "${assistantMsg.substring(0, 300)}"`,
          history: [],
        }),
      })
      if (!res.ok) return

      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let title = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            if (parsed?.text) title += parsed.text
          } catch { continue }
        }
      }

      // Clean up the title
      title = title.trim().replace(/^["']|["']$/g, '').replace(/\*\*/g, '').substring(0, 60)
      if (!title) return

      // Update in DB
      await fetch(`/api/chat/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      // Update in local state
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c))
    } catch {
      // Non-critical — title stays as the original truncated user message
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
    setInputRadius(9999)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
      setInputRadius(9999)
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
      }
    }
  }

  const [inputRadius, setInputRadius] = useState(9999)

  // Auto-resize textarea as user types (like ChatGPT / Claude)
  // Border-radius morphs proportionally: pill (9999px) → rectangular (16px) based on height
  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    const h = Math.min(el.scrollHeight, 200)
    el.style.height = h + 'px'
    // Single line ~38px → pill (9999). As height grows toward 90px+, ease to 16px.
    const singleLine = 38
    const fullRect = 90
    if (el.scrollHeight <= singleLine) {
      setInputRadius(9999)
    } else {
      const t = Math.min((el.scrollHeight - singleLine) / (fullRect - singleLine), 1)
      // Smooth ease-out curve
      const eased = 1 - Math.pow(1 - t, 2)
      setInputRadius(Math.round(9999 - eased * (9999 - 16)))
    }
  }, [])

  // ─── Grouped conversations ──────────────────────────────────────────────

  const filteredConversations = useMemo(() => {
    if (!debouncedSearch.trim()) return conversations
    const q = debouncedSearch.toLowerCase()
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }, [conversations, debouncedSearch])

  const groupedConversations = groupConversationsByDate(filteredConversations)

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .chat-fade-in {
              animation: fadeIn 0.3s ease-out;
            }
            .chat-textarea::-webkit-scrollbar {
              width: 4px;
            }
            .chat-textarea::-webkit-scrollbar-track {
              background: transparent;
            }
            .chat-textarea::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.1);
              border-radius: 2px;
            }
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
            .katex-display { margin: 0.8em 0 !important; text-align: left !important; }
            .katex-display > .katex { font-size: 1.05em !important; }
            .katex { color: #c8d6e5; font-size: 1em !important; }
          `,
        }}
      />

      <div className="flex -m-4 md:-m-6 relative" style={{ background: '#0a1628', height: 'calc(100dvh - 3.5rem)', overflow: 'hidden' }}>
        {/* Dot Grid Background - always visible, dims when messages present, pulses when streaming */}
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            zIndex: 0,
            pointerEvents: 'none',
            opacity: messages.length === 0 ? 1 : 0,
          }}
        >
          <DotGridCanvas streaming={isLoading} />
        </div>
        {/* ─── Left Sidebar ───────────────────────────────────────────── */}
        <div
          className="flex flex-col shrink-0 transition-all duration-300 overflow-hidden relative"
          style={{
            width: sidebarOpen ? 260 : 0,
            borderRight: sidebarOpen ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
            background: 'rgba(13, 20, 36, 0.92)',
            backdropFilter: 'blur(12px)',
            zIndex: 2,
          }}
        >
          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={createNewChat}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Separator */}
          <div className="mx-3 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Search Input */}
          <div className="px-3 pt-2 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b7f94] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full h-8 pl-8 pr-7 bg-[#0a1628] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#e8edf4] placeholder-[#6b7f94] outline-none focus:border-[rgba(59,130,246,0.4)] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-sm text-[#5a6d82] hover:text-[#8a9bb0] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-xs" style={{ color: '#4a5c73' }}>Loading...</span>
              </div>
            ) : filteredConversations.length === 0 && debouncedSearch.trim() ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Search className="w-8 h-8 text-[#2a3a50]" />
                <p className="text-xs mt-2" style={{ color: '#4a5c73' }}>
                  No conversations found for{' '}
                  <span className="text-[#93b4f4] font-medium">&ldquo;{debouncedSearch.trim()}&rdquo;</span>
                </p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#2a3a50' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-xs mt-2" style={{ color: '#4a5c73' }}>No conversations yet</p>
              </div>
            ) : (
              groupedConversations.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1" style={{ color: '#4a5c73' }}>
                    {group.label}
                  </p>
                  {group.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="relative group/conv overflow-hidden"
                      style={{
                        animation: deletingIds.has(conv.id) ? 'none' : 'slide-up 0.25s ease-out both',
                        maxHeight: deletingIds.has(conv.id) ? 0 : 80,
                        opacity: deletingIds.has(conv.id) ? 0 : 1,
                        transform: deletingIds.has(conv.id) ? 'translateX(-30px)' : 'translateX(0)',
                        transition: deletingIds.has(conv.id)
                          ? 'opacity 150ms ease-out, transform 150ms ease-out, max-height 250ms ease-out 100ms'
                          : 'none',
                      }}
                    >
                      <button
                        onClick={() => loadConversation(conv.id)}
                        className="w-full text-left rounded-lg px-3 py-2 pr-8 text-sm transition-all duration-150"
                        style={{
                          background: activeConversationId === conv.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          color: activeConversationId === conv.id ? '#93b4f4' : '#8a9bb0',
                        }}
                        onMouseEnter={(e) => {
                          if (activeConversationId !== conv.id) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeConversationId !== conv.id) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        <div className="truncate text-[13px] font-medium transition-all duration-300">{conv.title}</div>
                        <time
                          dateTime={conv.updated_at}
                          title={new Date(conv.updated_at).toLocaleString()}
                          className="block text-[10px] mt-0.5"
                          style={{ color: '#4a5c73' }}
                        >
                          {formatTime(conv.updated_at)}
                        </time>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const id = conv.id

                          // Start animation immediately (optimistic)
                          setDeletingIds(prev => new Set(prev).add(id))

                          // If deleting the active chat, clear it right away
                          if (activeConversationId === id) {
                            setActiveConversationId(null)
                            setMessages([])
                          }

                          // Remove from state after animation completes
                          setTimeout(() => {
                            setConversations(prev => prev.filter(c => c.id !== id))
                            setDeletingIds(prev => {
                              const next = new Set(prev)
                              next.delete(id)
                              return next
                            })
                          }, 350)

                          // Delete from DB in background (non-blocking)
                          try {
                            await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' })
                          } catch {
                            // Already removed from UI — toast but don't revert
                            toast.error('Failed to delete from server')
                          }
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/conv:opacity-100 transition-opacity duration-150 hover:bg-red-500/20"
                        style={{ color: '#5a6d82' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6d82' }}
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Main Chat Area ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex: 1 }}>
          {/* Chat Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
              style={{ color: '#7a8ba3' }}
              aria-label="Toggle sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/ampliwork-logo.svg" alt="Ampliwork" className="w-7 h-7" />
              <span className="text-sm font-semibold" style={{ color: '#e8edf4' }}>
                Frankly, AI CFO
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto relative">
            <div className="py-6 relative" style={{ zIndex: 1 }}>
              {messages.length === 0 && !isLoading && !conversationLoading ? (
                /* ─── Empty State (Agent Miles style) ─────────────────── */
                <div className="flex flex-col items-center justify-center min-h-[70vh] chat-fade-in px-4">

                  {/* Logo */}
                  <div className="mb-8">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        boxShadow: '0 0 40px rgba(59, 130, 246, 0.15)',
                      }}
                    >
                      <img src="/ampliwork-logo.svg" alt="Ampliwork" className="w-9 h-9" />
                    </div>
                  </div>

                  {/* Heading with gradient */}
                  <h1 className="text-4xl font-bold mb-3 tracking-tight" style={{ color: '#e8edf4' }}>
                    Ask{' '}
                    <span style={{
                      background: 'linear-gradient(135deg, #60a5fa, #3b82f6, #818cf8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      Frankly
                    </span>
                  </h1>
                  <p className="text-sm mb-12 text-center max-w-md leading-relaxed" style={{ color: '#6b7f96' }}>
                    Get instant, AI-powered answers to your financial questions — grounded entirely in your company data.
                  </p>

                  {/* Centered Input */}
                  <form onSubmit={handleSubmit} className="max-w-2xl w-full mb-10">
                    <div
                      className={`flex ${inputRadius < 100 ? 'items-end' : 'items-center'} gap-3 px-5 py-3`}
                      style={{
                        borderRadius: inputRadius + 'px',
                        transition: 'border-radius 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                        background: 'rgba(17, 29, 46, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.15)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.2)' }}
                    >
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a financial question..."
                        rows={1}
                        className="flex-1 bg-transparent text-sm leading-6 outline-none placeholder:text-[#4a5c73] resize-none focus:outline-none focus:ring-0 chat-textarea"
                        style={{ color: '#e8edf4', border: 'none', boxShadow: 'none', maxHeight: '200px', overflowY: 'auto' }}
                      />
                      <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 disabled:opacity-20 hover:scale-105"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                          boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    </div>
                  </form>

                  {/* 4-column suggestion cards */}
                  <div className="flex gap-2.5 w-full max-w-4xl justify-center">
                    {dynamicSuggestions.map((s, idx) => (
                      <button
                        key={s.title}
                        onClick={() => sendMessage(s.title)}
                        className="group/card text-left rounded-lg px-4 py-2.5 transition-all duration-200 relative whitespace-nowrap"
                        style={{
                          background: 'rgba(17, 29, 46, 0.35)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          animation: `slide-up 0.3s ease-out ${idx * 60}ms both`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)'
                          e.currentTarget.style.background = 'rgba(19, 32, 54, 0.6)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'
                          e.currentTarget.style.background = 'rgba(17, 29, 46, 0.35)'
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <div className="text-[13px] font-medium transition-colors duration-200 group-hover/card:text-blue-300" style={{ color: '#c8d5e3' }}>
                          {s.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ─── Messages ────────────────────────────────────────── */
                <div className="space-y-5 px-6 md:px-10 lg:px-16">
                  {messages.map((msg, i) => {
                    if (msg.role === 'assistant' && !msg.content) return null

                    if (msg.role === 'user') {
                      return (
                        <div key={i} className="flex justify-end chat-fade-in">
                          <div
                            className="max-w-[85%] rounded-2xl px-5 py-3 text-[15px] leading-7 text-white"
                            style={{
                              background: 'linear-gradient(135deg, #3b82f6, #4f6ef6)',
                            }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      )
                    }

                    // Assistant message
                    const isStreaming = streamingIdx === i
                    const { main, analysis } = parseAnalysisSection(msg.content)
                    // During streaming: hide raw chart code blocks, show only text portions
                    // After streaming: parse chart blocks into renderable components
                    let segments: ReturnType<typeof parseChartBlocks>
                    if (isStreaming) {
                      // Strip any partial or complete ```chart...``` blocks and FOLLOW_UPS from displayed text
                      const cleaned = main
                        .replace(/```chart[\s\S]*?```/g, '\n\n*Generating chart...*\n\n')
                        .replace(/```chart[\s\S]*$/g, '\n\n*Generating chart...*\n\n')
                        .replace(/\n?FOLLOW_UPS?:?\s*.*$/m, '')
                        .replace(/\n?FOLLOW[-_]?UP.*$/mi, '')
                      segments = [{ type: 'text' as const, content: cleaned }]
                    } else {
                      segments = parseChartBlocks(main)
                    }

                    return (
                      <div key={i} className="chat-fade-in group/msg">
                        <div className="space-y-3">
                          {/* Main content with inline charts */}
                          <div
                            className="text-[15px] leading-7"
                            style={{
                              color: '#dce4ef',
                            }}
                          >
                            {segments.map((seg, si) =>
                              seg.type === 'chart' ? (
                                <InlineChart key={si} chartData={seg.data} />
                              ) : (
                                <span key={si} dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.content, isStreaming) }} />
                              )
                            )}
                          </div>

                          {/* Analysis Card */}
                          {analysis && (
                            <div
                              className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                              style={{
                                background: 'rgba(59, 130, 246, 0.05)',
                                borderLeft: '3px solid #3b82f6',
                                border: '1px solid rgba(59, 130, 246, 0.15)',
                                borderLeftWidth: '3px',
                                color: '#c8d6e5',
                              }}
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
                            />
                          )}

                          {/* Copy + Regenerate (show on hover, hide during streaming) */}
                          {!isStreaming && msg.content && (
                            <div className="flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
                              <button
                                onClick={async (e) => {
                                  // Capture button ref BEFORE any await — React nullifies currentTarget after event
                                  const btn = e.currentTarget as HTMLButtonElement
                                  // Strip markdown/chart blocks for clean plain text copy
                                  const plain = msg.content
                                    .replace(/```chart[\s\S]*?```/g, '[Chart]')
                                    .replace(/\*\*(.*?)\*\*/g, '$1')
                                    .replace(/\*(.*?)\*/g, '$1')
                                    .replace(/#{1,3}\s/g, '')
                                    .trim()
                                  try {
                                    await navigator.clipboard.writeText(plain)
                                    btn.textContent = 'Copied!'
                                    setTimeout(() => { btn.textContent = 'Copy' }, 1500)
                                  } catch {
                                    // Fallback for non-HTTPS (synchronous execCommand)
                                    const textarea = document.createElement('textarea')
                                    textarea.value = plain
                                    textarea.style.position = 'fixed'
                                    textarea.style.opacity = '0'
                                    document.body.appendChild(textarea)
                                    textarea.select()
                                    document.execCommand('copy')
                                    document.body.removeChild(textarea)
                                    btn.textContent = 'Copied!'
                                    setTimeout(() => { btn.textContent = 'Copy' }, 1500)
                                  }
                                }}
                                className="text-[11px] px-2 py-1 rounded-md transition-colors"
                                style={{ color: '#7b8fa3', background: 'rgba(255,255,255,0.04)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#93a8c1' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#7b8fa3' }}
                              >
                                Copy
                              </button>
                              {i === messages.length - 1 && (
                                <button
                                  onClick={async () => {
                                    // Find the last user message
                                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
                                    if (!lastUserMsg) return

                                    // Remove last assistant message from state, keep everything up to and including last user msg
                                    const lastUserIdx = messages.length - 1 - [...messages].reverse().findIndex(m => m.role === 'user')
                                    const withoutAssistant = messages.slice(0, lastUserIdx + 1)

                                    // Add empty assistant message for streaming (replaces the old one)
                                    const assistantIdx = withoutAssistant.length
                                    setMessages([...withoutAssistant, { role: 'assistant', content: '' }])
                                    setStreamingIdx(assistantIdx)
                                    setIsLoading(true)
                                    setIsThinking(true)
                                    userScrolledRef.current = false

                                    // Delete last assistant message from DB
                                    if (activeConversationId) {
                                      try {
                                        await fetch(`/api/chat/conversations/${activeConversationId}/messages/last`, {
                                          method: 'DELETE',
                                        })
                                      } catch {
                                        // Non-critical
                                      }
                                    }

                                    // Re-stream the response
                                    try {
                                      const response = await fetch('/api/chat', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          message: lastUserMsg.content,
                                          history: withoutAssistant.slice(0, -1).map(m => ({
                                            role: m.role,
                                            content: m.role === 'assistant'
                                              ? m.content.replace(/\n?FOLLOW_UPS:\s*.+$/m, '').trimEnd()
                                              : m.content,
                                          })),
                                          conversationId: activeConversationId,
                                        }),
                                      })

                                      if (!response.ok) throw new Error(`HTTP ${response.status}`)

                                      const reader = response.body?.getReader()
                                      if (!reader) throw new Error('No stream')

                                      const decoder = new TextDecoder()
                                      let buffer = ''
                                      let accumulated = ''

                                      while (true) {
                                        const { done, value } = await reader.read()
                                        if (done) break
                                        buffer += decoder.decode(value, { stream: true })
                                        const lines = buffer.split('\n')
                                        buffer = lines.pop() ?? ''
                                        for (const line of lines) {
                                          if (!line.startsWith('data: ')) continue
                                          const payload = line.slice(6)
                                          if (payload === '[DONE]') continue
                                          try {
                                            const parsed = JSON.parse(payload)
                                            if (parsed?.text) {
                                              if (accumulated === '') setIsThinking(false)
                                              accumulated += parsed.text
                                              setMessages(prev => {
                                                const next = [...prev]
                                                next[assistantIdx] = { role: 'assistant', content: accumulated }
                                                return next
                                              })
                                            }
                                          } catch { continue }
                                        }
                                      }

                                      setStreamingIdx(null)
                                      setIsLoading(false)
                                      setIsThinking(false)
                                    } catch {
                                      setMessages(prev => {
                                        const next = [...prev]
                                        next[assistantIdx] = { role: 'assistant', content: 'Sorry, regeneration failed. Please try again.' }
                                        return next
                                      })
                                      setStreamingIdx(null)
                                      setIsLoading(false)
                                      setIsThinking(false)
                                    }
                                  }}
                                  className="text-[11px] px-2 py-1 rounded-md transition-colors"
                                  style={{ color: '#5a6d82', background: 'rgba(255,255,255,0.04)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = '#93a8c1' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6d82' }}
                                >
                                  &#x21bb; Regenerate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Follow-up suggestions — AI-generated from FOLLOW_UPS: line */}
                  {!isLoading && !isThinking && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (() => {
                    const content = messages[messages.length - 1].content
                    const followUpMatch = content.match(/FOLLOW_UPS:\s*(.+)$/m)
                    if (!followUpMatch) return null

                    const shown = followUpMatch[1]
                      .split('|')
                      .map(q => q.trim())
                      .filter(q => q.length > 0)
                      .slice(0, 3)

                    if (shown.length === 0) return null

                    return (
                      <div className="flex flex-wrap gap-2 mt-2 chat-fade-in">
                        {shown.map((text) => (
                          <button
                            key={text}
                            onClick={() => sendMessage(text)}
                            className="text-xs px-3 py-1.5 rounded-full transition-all"
                            style={{
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              color: '#7ba4db',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'
                              e.currentTarget.style.color = '#a3c4f3'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'
                              e.currentTarget.style.color = '#7ba4db'
                            }}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Thinking indicator — shown before first token arrives */}
                  {isThinking && (
                    <div>
                      <ThinkingIndicator />
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* ─── Input Bar (hidden on empty state - centered input is used instead) ─── */}
          <div className={`px-4 py-4 shrink-0 ${messages.length === 0 && !isLoading ? 'hidden' : ''}`}>
            <form onSubmit={handleSubmit} className="mx-auto" style={{ maxWidth: '48rem' }}>
              <div
                className={`flex ${inputRadius < 100 ? 'items-end' : 'items-center'} gap-3 px-5 py-3`}
                style={{
                  borderRadius: inputRadius + 'px',
                  transition: 'border-radius 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                  background: 'rgba(17, 29, 46, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm leading-6 outline-none placeholder:text-[#4a5c73] resize-none focus:outline-none focus:ring-0 focus:border-none chat-textarea"
                  style={{ color: '#e8edf4', border: 'none', boxShadow: 'none', maxHeight: '200px', overflowY: 'auto' }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 disabled:opacity-20 hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                  }}
                  aria-label="Send message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
