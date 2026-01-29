'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Wand2, Copy, Check, Calendar, Loader2 } from 'lucide-react'
import { aiApi } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  hashtags?: string[]
  suggestedTime?: string
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Привет! Я AI-агент Ядро SMM. Могу помочь:\n\n• Сгенерировать пост на любую тему\n• Отредактировать текст\n• Создать цепляющий контент для Telegram и VK\n\nНапиши тему поста!',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const copyToClipboard = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await aiApi.generate({
        topic: input,
        platform: 'telegram',
        language: 'ru',
      })

      const data = response.data

      // Адаптация под yadro-smm API (text вместо content)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text || data.content || 'Не удалось сгенерировать контент.',
        hashtags: data.suggestions || data.hashtags,
        suggestedTime: data.suggested_time,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.response?.data?.detail || 'Ошибка подключения к API. Проверьте, что backend запущен.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickPrompts = [
    'Пост про криптовалюты',
    'Мотивационный пост',
    'Новости IT',
    'Пост для продвижения',
    'Обзор продукта',
    'Новость дня',
  ]

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-ember flex items-center justify-center glow-core">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Агент</h1>
          <p className="text-sm text-muted-foreground">Ядро SMM • Генерация контента</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-xl ${
                message.role === 'user'
                  ? 'ml-auto bg-gradient-ember text-white p-4'
                  : 'bg-secondary p-4'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Hashtags */}
              {message.hashtags && message.hashtags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.hashtags.map((tag, i) => (
                    <span key={i} className="text-primary text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Suggested time */}
              {message.suggestedTime && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Лучшее время: {message.suggestedTime}</span>
                </div>
              )}

              {/* Copy button for assistant messages */}
              {message.role === 'assistant' && message.content && !message.content.includes('Ошибка') && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-background/50 rounded-lg hover:bg-background transition-colors"
                  >
                    {copiedId === message.id ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-green-500">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => router.push(`/create?text=${encodeURIComponent(message.content)}`)}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-background/50 rounded-lg hover:bg-background transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Запланировать</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="bg-secondary rounded-xl p-4 max-w-[80%]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-muted-foreground">Генерирую пост...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-6 py-3 border-t border-border flex gap-2 flex-wrap">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              className="text-sm px-4 py-2 bg-secondary rounded-lg hover:bg-primary/20 hover:text-primary transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите тему поста или задайте вопрос..."
              className="flex-1 bg-input rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 btn-core text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
