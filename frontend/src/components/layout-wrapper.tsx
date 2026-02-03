'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

// Страницы без сайдбара
const NO_SIDEBAR_PATHS = ['/login']

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = !NO_SIDEBAR_PATHS.includes(pathname)

  if (!showSidebar) {
    // Страница логина — без сайдбара, на весь экран
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}
