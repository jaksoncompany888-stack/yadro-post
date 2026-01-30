'use client'

import { Suspense } from 'react'
import { Calendar } from '@/components/calendar'
import { ChannelsSidebar } from '@/components/channels-sidebar'
import { Loader2 } from 'lucide-react'

function CalendarLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="flex h-full">
      {/* Channels sidebar */}
      <ChannelsSidebar />

      {/* Main calendar */}
      <div className="flex-1 p-6">
        <Suspense fallback={<CalendarLoader />}>
          <Calendar />
        </Suspense>
      </div>
    </div>
  )
}
