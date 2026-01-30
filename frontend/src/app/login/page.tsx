'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { authApi } from '@/lib/api'

type AuthState = 'idle' | 'loading' | 'success' | 'error'

export default function LoginPage() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [botUsername, setBotUsername] = useState<string>('YadroPostBot')

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/')
    }
  }, [router])

  // Load bot config
  useEffect(() => {
    authApi.getTelegramConfig()
      .then((res) => {
        setBotUsername(res.data.bot_username)
      })
      .catch(() => {
        // Use default
      })
  }, [])

  // Handle Telegram Login Widget callback
  const handleTelegramAuth = useCallback(async (user: any) => {
    try {
      setAuthState('loading')
      setError(null)

      const res = await authApi.telegramLogin({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url,
        auth_date: user.auth_date,
        hash: user.hash,
      })

      // Save token and user
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))

      setAuthState('success')

      // Redirect after short delay
      setTimeout(() => {
        router.push('/')
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка авторизации')
      setAuthState('error')
    }
  }, [router])

  // Load Telegram Login Widget script
  useEffect(() => {
    // Make callback available globally
    ;(window as any).onTelegramAuth = handleTelegramAuth

    // Load Telegram widget script
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')

    const container = document.getElementById('telegram-login-container')
    if (container) {
      container.innerHTML = ''
      container.appendChild(script)
    }

    return () => {
      delete (window as any).onTelegramAuth
    }
  }, [botUsername, handleTelegramAuth])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl gradient-ember flex items-center justify-center text-white font-bold text-2xl shadow-xl glow-core mb-4">
            Yai
          </div>
          <h1 className="text-3xl font-bold mb-2">Ядро Post</h1>
          <p className="text-muted-foreground">СММ планировщик с AI</p>
        </div>

        {/* Auth Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
          {/* Idle/Loading State */}
          {(authState === 'idle' || authState === 'loading') && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#0088cc]/20 flex items-center justify-center mb-4">
                {authState === 'loading' ? (
                  <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                ) : (
                  <Send className="w-8 h-8 text-[#0088cc]" />
                )}
              </div>
              <h2 className="text-xl font-semibold mb-2">Вход через Telegram</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Для использования Ядро Post необходимо авторизоваться через Telegram
              </p>

              {/* Telegram Login Widget Container */}
              <div
                id="telegram-login-container"
                className="flex justify-center mb-4"
              >
                {/* Widget will be inserted here */}
                <div className="text-muted-foreground text-sm">
                  Загрузка виджета...
                </div>
              </div>

              {authState === 'loading' && (
                <p className="text-sm text-muted-foreground">
                  Авторизация...
                </p>
              )}
            </div>
          )}

          {/* Success State */}
          {authState === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Успешно!</h2>
              <p className="text-muted-foreground text-sm">
                Перенаправление в приложение...
              </p>
            </div>
          )}

          {/* Error State */}
          {authState === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ошибка</h2>
              <p className="text-red-500 text-sm mb-6">{error}</p>
              <button
                onClick={() => {
                  setAuthState('idle')
                  setError(null)
                }}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium"
              >
                Попробовать снова
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            После входа проверьте подписку на канал <a href="https://t.me/yadro_channel" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@yadro_channel</a>
          </p>
          <p className="text-xs text-muted-foreground">
            Продолжая, вы соглашаетесь с условиями использования
          </p>
        </div>
      </div>
    </div>
  )
}
