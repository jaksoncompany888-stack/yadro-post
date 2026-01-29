'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import {
  Calendar,
  MessageSquare,
  BarChart3,
  Image,
  Puzzle,
  Settings,
  Zap,
  Sun,
  Moon,
} from 'lucide-react'

const navigation = [
  { name: 'Календарь', href: '/', icon: Calendar },
  { name: 'Агент', href: '/agent', icon: MessageSquare },
  { name: 'Аналитика', href: '/analytics', icon: BarChart3 },
  { name: 'Медиа', href: '/media', icon: Image },
  { name: 'Плагины', href: '/plugins', icon: Puzzle },
  { name: 'Интеграции', href: '/integrations', icon: Zap },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(true)

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('yadro-theme')
    if (saved === 'light') {
      setIsDark(false)
      document.documentElement.classList.add('light')
    }
  }, [])

  // Toggle theme
  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.classList.remove('light')
      localStorage.setItem('yadro-theme', 'dark')
    } else {
      document.documentElement.classList.add('light')
      localStorage.setItem('yadro-theme', 'light')
    }
  }

  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center py-4">
      {/* Logo — Earth Core gradient */}
      <Link href="/" className="mb-8">
        <div className="w-10 h-10 rounded-xl gradient-ember flex items-center justify-center text-white font-bold text-lg shadow-lg glow-core">
          Я
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200',
                isActive
                  ? 'bg-primary/20 text-primary glow-core'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 text-muted-foreground hover:bg-secondary hover:text-foreground mb-2"
        title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        <span className="text-[10px]">{isDark ? 'Светлая' : 'Тёмная'}</span>
      </button>

      {/* Settings */}
      <Link
        href="/settings"
        className={clsx(
          'w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200',
          pathname === '/settings'
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px]">Настройки</span>
      </Link>

      {/* Version */}
      <div className="mt-4 text-xs text-muted-foreground">v1.0.0</div>
    </aside>
  )
}
