'use client'

import { Calendar } from '@/components/calendar'
import { ChannelsSidebar } from '@/components/channels-sidebar'
import { AIAssistant } from '@/components/ai-assistant'

export default function HomePage() {
  return (
    <div className="flex h-full">
      {/* Channels sidebar */}
      <ChannelsSidebar />

      {/* Main calendar */}
      <div className="flex-1 p-6">
        <Calendar />
      </div>

      {/* AI Assistant */}
      <AIAssistant />
    </div>
  )
}
