'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, CheckCircle, AlertCircle, Mail, Lock, User, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { authApi } from '@/lib/api'

type AuthMode = 'login' | 'register'
type AuthState = 'idle' | 'loading' | 'success' | 'error'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [botUsername, setBotUsername] = useState<string>('YadroPostBot')

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isDark, setIsDark] = useState(true)

  // Load theme
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

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/')
    }
  }, [router])

  // Load bot config for Telegram widget
  useEffect(() => {
    authApi.getTelegramConfig()
      .then((res) => {
        setBotUsername(res.data.bot_username)
      })
      .catch(() => {
        // Use default
      })
  }, [])

  // Handle email login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setAuthState('loading')

    try {
      const res = await authApi.login({ email, password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      // Set cookie for middleware auth check
      document.cookie = `token=${res.data.token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
      setAuthState('success')
      setTimeout(() => router.push('/'), 1000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка входа')
      setAuthState('error')
    }
  }

  // Handle email registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    if (password.length < 6) {
      setError('Пароль должен быть минимум 6 символов')
      return
    }
    if (!firstName.trim()) {
      setError('Введите имя')
      return
    }

    setAuthState('loading')

    try {
      const res = await authApi.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName || undefined,
      })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      // Set cookie for middleware auth check
      document.cookie = `token=${res.data.token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
      setAuthState('success')
      setTimeout(() => router.push('/'), 1000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка регистрации')
      setAuthState('error')
    }
  }

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

      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      // Set cookie for middleware auth check
      document.cookie = `token=${res.data.token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
      setAuthState('success')
      setTimeout(() => router.push('/'), 1000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка авторизации через Telegram')
      setAuthState('error')
    }
  }, [router])

  // Load Telegram Login Widget script
  useEffect(() => {
    ;(window as any).onTelegramAuth = handleTelegramAuth

    const loadTelegramWidget = () => {
      const container = document.getElementById('telegram-login-container')
      if (container) {
        container.innerHTML = ''
        const script = document.createElement('script')
        script.src = 'https://telegram.org/js/telegram-widget.js?22'
        script.async = true
        script.setAttribute('data-telegram-login', botUsername)
        script.setAttribute('data-size', 'large')
        script.setAttribute('data-radius', '12')
        script.setAttribute('data-onauth', 'onTelegramAuth(user)')
        script.setAttribute('data-request-access', 'write')
        container.appendChild(script)
      }
    }

    // Small delay to ensure DOM is ready
    setTimeout(loadTelegramWidget, 100)

    return () => {
      delete (window as any).onTelegramAuth
    }
  }, [botUsername, handleTelegramAuth])

  // Reset error when switching modes
  useEffect(() => {
    setError(null)
    setAuthState('idle')
  }, [mode])

  return (
    <div className="min-h-screen bg-background flex items-start md:items-center justify-center p-4 py-8 relative overflow-auto">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl gradient-ember flex items-center justify-center text-white font-bold text-2xl shadow-xl glow-core mb-4">
            Yai
          </div>
          <h1 className="text-3xl font-bold mb-2">Ядро Post</h1>
          <p className="text-muted-foreground">СММ планировщик с AI</p>
        </div>

        {/* Success State */}
        {authState === 'success' && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-lg text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Успешно!</h2>
            <p className="text-muted-foreground text-sm">
              Перенаправление в приложение...
            </p>
          </div>
        )}

        {/* Auth Forms */}
        {authState !== 'success' && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
            {/* Telegram Login Widget - First */}
            <div className="text-center mb-4">
              <div
                id="telegram-login-container"
                className="flex justify-center"
              >
                <div className="text-muted-foreground text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка...
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">или по email</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex mb-4 bg-secondary rounded-lg p-1">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-card text-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-card text-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Регистрация
              </button>
            </div>

            {/* Login Form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-12 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authState === 'loading'}
                  className="w-full py-3 btn-core text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authState === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    'Войти'
                  )}
                </button>
              </form>
            )}

            {/* Register Form */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Имя *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Иван"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Фамилия</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Иванов"
                      className="w-full px-4 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Пароль *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-12 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Подтверждение пароля *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите пароль"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authState === 'loading'}
                  className="w-full py-3 btn-core text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authState === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Регистрация...
                    </>
                  ) : (
                    'Зарегистрироваться'
                  )}
                </button>
              </form>
            )}

          </div>
        )}

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Продолжая, вы соглашаетесь с условиями использования
          </p>
        </div>
      </div>
    </div>
  )
}
