'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: number
  tg_id: number
  username: string | null
  role: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: () => {},
})

export const useAuth = () => useContext(AuthContext)

interface AuthProviderProps {
  children: ReactNode
  requireAuth?: boolean // Если true — редиректит на /login без авторизации
}

export function AuthProvider({ children, requireAuth = false }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Проверяем токен при загрузке
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        // Invalid JSON
        localStorage.removeItem('user')
      }
    }

    setIsLoading(false)

    // Редирект на логин если требуется авторизация
    if (requireAuth && !token && pathname !== '/login') {
      router.push('/login')
    }
  }, [requireAuth, pathname, router])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Clear cookie for middleware auth check
    document.cookie = 'token=; path=/; max-age=0; SameSite=Lax'
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
