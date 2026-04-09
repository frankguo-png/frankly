import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/command-palette'
import { FloatingChatWrapper } from '@/components/chat/floating-chat-wrapper'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-52 lg:pl-60">
        <Header />
        <main className="p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette />
      <FloatingChatWrapper />
    </div>
  )
}
