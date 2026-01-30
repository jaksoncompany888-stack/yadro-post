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
  Settings,
  Zap,
  Sun,
  Moon,
  Plus,
  Menu,
  X,
  FileText,
  StickyNote,
  Users,
  LogOut,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usersApi, authApi } from '@/lib/api'

// Роли: admin, smm, user
type UserRole = 'admin' | 'smm' | 'user'

interface NavItem {
  name: string
  href: string
  icon: any
  roles?: UserRole[] // Если не указано - доступно всем
}

const navigation: NavItem[] = [
  { name: 'Календарь', href: '/', icon: Calendar },
  { name: 'Черновики', href: '/drafts', icon: FileText },
  { name: 'Заметки', href: '/notes', icon: StickyNote },
  { name: 'Агент', href: '/agent', icon: MessageSquare },
  { name: 'Аналитика', href: '/analytics', icon: BarChart3 },
  { name: 'Медиа', href: '/media', icon: Image },
  { name: 'Анализ', href: '/integrations', icon: Zap },
  { name: 'Пользователи', href: '/admin/users', icon: Users, roles: ['admin', 'smm'] },
]

// Для мобильного нижнего меню - только основные пункты
const mobileNavigation = [
  { name: 'Календарь', href: '/', icon: Calendar },
  { name: 'Агент', href: '/agent', icon: MessageSquare },
  { name: 'Создать', href: '/create', icon: Plus, isCreate: true },
  { name: 'Аналитика', href: '/analytics', icon: BarChart3 },
  { name: 'Ещё', href: '#more', icon: Menu, isMore: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>('user')

  // Load user role
  useEffect(() => {
    usersApi.me()
      .then((res) => {
        setUserRole(res.data.role || 'user')
      })
      .catch(() => {
        // Default to user if API fails
        setUserRole('user')
      })
  }, [])

  // Logout handler
  const handleLogout = () => {
    authApi.logout()
    router.push('/login')
  }

  // Filter navigation by user role
  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true // Доступно всем
    return item.roles.includes(userRole)
  })

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
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-20 bg-card border-r border-border flex-col items-center py-4">
        {/* Logo — Earth Core gradient */}
        <Link href="/" className="mb-4">
          <div className="w-10 h-10 rounded-xl gradient-ember flex items-center justify-center text-white font-bold text-sm shadow-lg glow-core">
            Yai
          </div>
        </Link>

        {/* Create Post Button */}
        <Link
          href="/create"
          className="w-14 h-10 mb-6 rounded-xl btn-core text-white flex items-center justify-center gap-1 shadow-lg hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </Link>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2">
          {filteredNavigation.map((item) => {
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

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
          title="Выйти"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px]">Выйти</span>
        </button>

        {/* Version */}
        <div className="mt-2 text-xs text-muted-foreground">v1.0.0</div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {mobileNavigation.map((item) => {
            const isActive = pathname === item.href

            if (item.isMore) {
              return (
                <button
                  key={item.name}
                  onClick={() => setShowMobileMenu(true)}
                  className="flex flex-col items-center justify-center gap-1 text-muted-foreground"
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-[10px]">{item.name}</span>
                </button>
              )
            }

            if (item.isCreate) {
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center justify-center w-14 h-14 -mt-4 rounded-full btn-core text-white shadow-lg"
                >
                  <item.icon className="w-7 h-7" />
                </Link>
              )
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile More Menu */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowMobileMenu(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Меню</h3>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 rounded-full hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              {[...filteredNavigation, { name: 'Настройки', href: '/settings', icon: Settings }].map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-colors',
                      isActive ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'
                    )}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="text-xs">{item.name}</span>
                  </Link>
                )
              })}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full py-4 bg-secondary rounded-xl flex items-center justify-center gap-3 mb-3"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{isDark ? 'Светлая тема' : 'Тёмная тема'}</span>
            </button>

            {/* Logout */}
            <button
              onClick={() => {
                setShowMobileMenu(false)
                handleLogout()
              }}
              className="w-full py-4 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center gap-3"
            >
              <LogOut className="w-5 h-5" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
