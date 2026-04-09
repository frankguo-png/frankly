'use client'

import { usePathname } from 'next/navigation'
import { ChatPanel } from './chat-panel'

/**
 * Client wrapper that renders the floating ChatPanel on all dashboard pages
 * except /dashboard/chat, where the full chat interface is already available.
 */
export function FloatingChatWrapper() {
  const pathname = usePathname()

  if (pathname === '/dashboard/chat') {
    return null
  }

  return <ChatPanel />
}
