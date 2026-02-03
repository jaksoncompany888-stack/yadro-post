'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Wand2, Copy, Check, Calendar, Loader2, MessageSquare, Plus, Trash2, FileText, Clock } from 'lucide-react'
import { aiApi, draftsApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  hashtags?: string[]
  suggestedTime?: string
}

interface ChatHistory {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: 'Привет! Я AI-агент Ядро SMM. Могу помочь:\n\n• Сгенерировать пост на любую тему\n• Отредактировать текст\n• Создать цепляющий контент для Telegram и VK\n\nНапиши тему поста!',
}

const MAX_HISTORY_COUNT = 5

// Находит последнее сообщение ассистента с контентом (для редактирования)
const getLastAssistantContent = (messages: Message[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.content && msg.id !== '1' && !msg.content.includes('Ошибка')) {
      return msg.content
    }
  }
  return null
}

// Проверяет, должен ли запрос идти через generate (новая тема) или edit
// ЛОГИКА: Если уже есть сгенерированный контент — ВСЕ запросы идут через edit
// Исключение: явно новые темы (напиши пост про...)
const shouldGenerate = (input: string, hasExistingContent: boolean): boolean => {
  if (!hasExistingContent) return true // Нет контента — генерируем

  // Ключевые слова для НОВОЙ генерации
  const newTopicKeywords = [
    'напиши пост', 'сгенерируй', 'создай пост', 'новый пост',
    'пост про', 'пост о ', 'пост на тему',
    'придумай', 'напиши про', 'напиши о ',
  ]

  const lowerInput = input.toLowerCase()
  return newTopicKeywords.some(kw => lowerInput.includes(kw))
}

export default function AgentPage() {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savingToDraft, setSavingToDraft] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Load chat history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('yadro-chat-history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setChatHistory(parsed.slice(0, MAX_HISTORY_COUNT))
      } catch (e) {
        console.error('Failed to parse chat history:', e)
      }
    }
  }, [])

  // Save chat history to localStorage
  const saveChatHistory = (history: ChatHistory[]) => {
    const limited = history.slice(0, MAX_HISTORY_COUNT)
    localStorage.setItem('yadro-chat-history', JSON.stringify(limited))
    setChatHistory(limited)
  }

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

  // Start a new chat
  const startNewChat = () => {
    // Save current chat if it has user messages
    if (messages.length > 1 && currentChatId) {
      updateCurrentChatInHistory()
    }

    setCurrentChatId(null)
    setMessages([INITIAL_MESSAGE])
  }

  // Update current chat in history
  const updateCurrentChatInHistory = () => {
    if (!currentChatId) return

    const updated = chatHistory.map(chat =>
      chat.id === currentChatId
        ? { ...chat, messages, updatedAt: new Date().toISOString() }
        : chat
    )
    saveChatHistory(updated)
  }

  // Load a chat from history
  const loadChat = (chat: ChatHistory) => {
    // Save current chat first if needed
    if (messages.length > 1 && currentChatId && currentChatId !== chat.id) {
      updateCurrentChatInHistory()
    }

    setCurrentChatId(chat.id)
    setMessages(chat.messages)
  }

  // Delete a chat from history
  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = chatHistory.filter(chat => chat.id !== chatId)
    saveChatHistory(updated)

    if (currentChatId === chatId) {
      setCurrentChatId(null)
      setMessages([INITIAL_MESSAGE])
    }
  }

  // Get title from first user message
  const getChatTitle = (msgs: Message[]): string => {
    const firstUserMsg = msgs.find(m => m.role === 'user')
    if (firstUserMsg) {
      return firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
    }
    return 'Новый диалог'
  }

  // Save message to drafts
  const saveToDraft = async (content: string, messageId: string) => {
    setSavingToDraft(messageId)
    try {
      await draftsApi.create({
        text: content,
      })
      // Show success briefly
      setTimeout(() => setSavingToDraft(null), 1500)
    } catch (error) {
      console.error('Failed to save draft:', error)
      setSavingToDraft(null)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      let response
      let data

      // Проверяем, есть ли уже сгенерированный контент
      const lastContent = getLastAssistantContent(messages)
      const needsGenerate = shouldGenerate(input, !!lastContent)

      if (needsGenerate) {
        // Генерация нового контента
        response = await aiApi.generate({
          topic: input,
          platform: 'telegram',
          language: 'ru',
        })
        data = response.data
      } else {
        // Редактирование существующего контента
        // Ядро SMM само разберётся — точечное или творческое редактирование
        response = await aiApi.edit({
          content: lastContent!,
          instruction: input,
        })
        data = response.data
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text || data.content || data.edited_text || 'Не удалось сгенерировать контент.',
        hashtags: data.suggestions || data.hashtags,
        suggestedTime: data.suggested_time,
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)

      // Save to history
      if (currentChatId) {
        // Update existing chat
        const updated = chatHistory.map(chat =>
          chat.id === currentChatId
            ? { ...chat, messages: finalMessages, updatedAt: new Date().toISOString() }
            : chat
        )
        saveChatHistory(updated)
      } else {
        // Create new chat
        const newChat: ChatHistory = {
          id: Date.now().toString(),
          title: getChatTitle(finalMessages),
          messages: finalMessages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setCurrentChatId(newChat.id)
        saveChatHistory([newChat, ...chatHistory])
      }
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
    <div className="h-full flex flex-col md:flex-row">
      {/* Chat History Sidebar - hidden on mobile */}
      <div className="hidden md:flex w-64 border-r border-border p-4 flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">История диалогов</h2>
          <button
            onClick={startNewChat}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title="Новый диалог"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {chatHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              История пуста
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Начните диалог с AI-агентом
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-auto">
            {chatHistory.map((chat) => (
              <div
                key={chat.id}
                onClick={() => loadChat(chat)}
                className={clsx(
                  'p-3 rounded-lg cursor-pointer group transition-colors relative',
                  currentChatId === chat.id
                    ? 'bg-primary/20'
                    : 'hover:bg-secondary'
                )}
              >
                <div className="text-sm font-medium truncate pr-6">
                  {chat.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(chat.updatedAt), 'd MMM, HH:mm', { locale: ru })}
                </div>
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-opacity"
                  title="Удалить диалог"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-border mt-4">
          <p className="text-xs text-muted-foreground text-center">
            Сохраняется до {MAX_HISTORY_COUNT} диалогов
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-3 md:p-6 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl gradient-ember flex items-center justify-center glow-core">
            <Wand2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-semibold">AI Агент</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">Ядро SMM • Генерация контента</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col min-w-0 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-auto p-3 md:p-6 space-y-3 md:space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] md:max-w-[80%] rounded-xl ${
                  message.role === 'user'
                    ? 'ml-auto bg-gradient-ember text-white p-3 md:p-4'
                    : 'bg-secondary p-3 md:p-4'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm md:text-base">{message.content}</p>

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

                {/* Action buttons for assistant messages */}
                {message.role === 'assistant' && message.content && !message.content.includes('Ошибка') && message.id !== '1' && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-background/50 rounded-lg hover:bg-background transition-colors"
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
                      onClick={() => saveToDraft(message.content, message.id)}
                      disabled={savingToDraft === message.id}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-background/50 rounded-lg hover:bg-background transition-colors disabled:opacity-50"
                    >
                      {savingToDraft === message.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">Сохранено</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          <span>В черновики</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => router.push(`/create?text=${encodeURIComponent(message.content)}`)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-background/50 rounded-lg hover:bg-background transition-colors"
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
                  <span className="text-muted-foreground">
                    {!shouldGenerate(input, !!getLastAssistantContent(messages))
                      ? 'Редактирую текст...'
                      : 'Генерирую пост...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts - horizontal scroll on mobile */}
          <div className="px-3 md:px-6 py-2 md:py-3 border-t border-border flex gap-2 overflow-x-auto">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 bg-secondary rounded-lg hover:bg-primary/20 hover:text-primary transition-colors whitespace-nowrap flex-shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 md:p-4 border-t border-border">
            <div className="flex gap-2 md:gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите тему поста..."
                className="flex-1 bg-input rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-3 md:px-6 py-2.5 md:py-3 btn-core text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
                )}
                <span className="hidden sm:inline">Отправить</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
