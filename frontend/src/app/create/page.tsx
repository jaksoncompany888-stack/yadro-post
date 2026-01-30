'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Send,
  Wand2,
  Calendar,
  Clock,
  Eye,
  Loader2,
  ChevronDown,
  Check,
  AlertCircle,
  Bold,
  Italic,
  List,
  ListOrdered,
  Smile,
  Link2,
  Hash,
  ArrowLeft,
} from 'lucide-react'
import { aiApi, postsApi, userChannelsApi } from '@/lib/api'
import { clsx } from 'clsx'

interface UserChannel {
  platform: string
  channel_id: string
  name: string
  username?: string
  subscribers: number
  is_valid: boolean
  can_post: boolean
}

// Popular emojis for quick access
const EMOJI_LIST = [
  '😀', '😂', '🥹', '😍', '🥰', '😎', '🤔', '😴',
  '🎉', '🔥', '💯', '❤️', '👍', '👎', '🙏', '💪',
  '✨', '⭐', '🌟', '💡', '📌', '🎯', '✅', '❌',
  '📢', '🚀', '💰', '📈', '📊', '🎁', '🏆', '💎',
]

function CreatePostPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [channels, setChannels] = useState<UserChannel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [error, setError] = useState('')
  const [showConfirmExit, setShowConfirmExit] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)

  // Режим: пост или заметка
  const isNoteMode = searchParams.get('type') === 'note'

  // Load URL parameters
  useEffect(() => {
    const textParam = searchParams.get('text')
    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')

    if (textParam) {
      setContent(textParam)
    }
    if (dateParam) {
      setScheduleDate(dateParam)
      setShowSchedule(true)
    }
    if (timeParam) {
      setScheduleTime(timeParam)
    }
  }, [searchParams])

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      setLoadingChannels(true)
      const response = await userChannelsApi.list()
      setChannels(response.data || [])
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoadingChannels(false)
    }
  }

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
  }

  const generateContent = async () => {
    if (!topic.trim()) return

    setIsGenerating(true)
    setError('')

    try {
      const response = await aiApi.generate({ topic })
      setContent(response.data.text || response.data.content || '')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка генерации')
    } finally {
      setIsGenerating(false)
    }
  }

  // Track selection in textarea
  const handleSelect = () => {
    if (textareaRef.current) {
      setSelectionStart(textareaRef.current.selectionStart)
      setSelectionEnd(textareaRef.current.selectionEnd)
    }
  }

  // Insert text at cursor position
  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end)
    setContent(newText)

    // Set cursor position after insert
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selectedText.length + after.length
      textarea.setSelectionRange(
        selectedText ? newCursorPos : start + before.length,
        selectedText ? newCursorPos : start + before.length
      )
    }, 0)
  }

  // Format text with markdown
  const formatBold = () => insertText('**', '**')
  const formatItalic = () => insertText('_', '_')

  const formatBulletList = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    if (selectedText) {
      // Format selected lines as list
      const lines = selectedText.split('\n')
      const formatted = lines.map(line => line.trim() ? `• ${line}` : line).join('\n')
      const newText = content.substring(0, start) + formatted + content.substring(end)
      setContent(newText)
    } else {
      // Insert bullet at cursor
      insertText('• ')
    }
  }

  const formatNumberedList = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    if (selectedText) {
      // Format selected lines as numbered list
      const lines = selectedText.split('\n')
      const formatted = lines.map((line, i) => line.trim() ? `${i + 1}. ${line}` : line).join('\n')
      const newText = content.substring(0, start) + formatted + content.substring(end)
      setContent(newText)
    } else {
      // Insert number at cursor
      insertText('1. ')
    }
  }

  const insertEmoji = (emoji: string) => {
    insertText(emoji)
    setShowEmojiPicker(false)
  }

  const insertHashtag = () => {
    insertText('#')
  }

  const insertLink = () => {
    const url = prompt('Введите URL:')
    if (url) {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = content.substring(start, end)

      if (selectedText) {
        // Wrap selected text in link
        insertText(`[${selectedText}](${url})`, '')
        const newText = content.substring(0, start) + `[${selectedText}](${url})` + content.substring(end)
        setContent(newText)
      } else {
        insertText(url)
      }
    }
  }

  // Track unsaved changes
  useEffect(() => {
    if (content.trim() || topic.trim()) {
      setHasUnsavedChanges(true)
    }
  }, [content, topic])

  // Предупреждение при закрытии вкладки
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Функция для безопасного выхода
  const handleExit = () => {
    if (hasUnsavedChanges && content.trim()) {
      setShowConfirmExit(true)
    } else {
      router.push('/')
    }
  }

  const saveAsDraft = async () => {
    if (!content.trim()) return

    setIsSaving(true)
    try {
      await postsApi.create({
        text: content,
        topic: topic || undefined,
        platforms: ['telegram'],
        channel_ids: selectedChannels.length > 0
          ? { telegram: selectedChannels[0] }
          : {},
      })
      setHasUnsavedChanges(false)
      router.push('/?refresh=' + Date.now())
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка сохранения')
    } finally {
      setIsSaving(false)
    }
  }

  const schedulePost = async () => {
    if (!content.trim() || !scheduleDate || !scheduleTime) return

    setIsSaving(true)
    try {
      const publishAt = new Date(`${scheduleDate}T${scheduleTime}`)
      await postsApi.create({
        text: content,
        topic: topic || undefined,
        platforms: ['telegram'],
        channel_ids: selectedChannels.length > 0
          ? { telegram: selectedChannels[0] }
          : {},
        publish_at: publishAt.toISOString(),
      })
      setHasUnsavedChanges(false)
      router.push('/?refresh=' + Date.now())
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка планирования')
    } finally {
      setIsSaving(false)
    }
  }

  const publishNow = async () => {
    if (!content.trim() || selectedChannels.length === 0) return

    setIsPublishing(true)
    try {
      const createResponse = await postsApi.create({
        text: content,
        topic: topic || undefined,
        platforms: ['telegram'],
        channel_ids: { telegram: selectedChannels[0] },
      })

      await postsApi.publish(createResponse.data.id)
      setHasUnsavedChanges(false)
      router.push('/?refresh=' + Date.now())
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка публикации')
    } finally {
      setIsPublishing(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  // Render formatted content for preview
  const renderFormattedContent = (text: string) => {
    // Simple markdown rendering for preview
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')

    return <div className="whitespace-pre-wrap text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div className="h-full flex">
      {/* Left panel — editor */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Header */}
        <div className="h-16 px-6 border-b border-border flex items-center gap-4">
          <button
            onClick={handleExit}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">
            {isNoteMode ? 'Создать заметку' : 'Создать пост'}
          </h1>
        </div>

        {/* Channel selection - только для постов */}
        {!isNoteMode && (
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Каналы:</span>
              {loadingChannels ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : channels.length === 0 ? (
                <span className="text-sm text-muted-foreground">Нет подключённых каналов</span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              {channels.map((channel) => (
                <button
                  key={channel.channel_id}
                  onClick={() => toggleChannel(channel.channel_id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all ${
                    selectedChannels.includes(channel.channel_id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 grayscale'
                  }`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
                      <Send className="w-4 h-4 text-blue-400" />
                    </div>
                    {selectedChannels.includes(channel.channel_id) && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{channel.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(channel.subscribers)}
                    </div>
                  </div>
                </button>
              ))}

              {channels.length === 0 && !loadingChannels && (
                <a
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 rounded-full border-2 border-dashed border-border hover:border-primary/50 transition-colors text-sm text-muted-foreground"
                >
                  Добавьте каналы в настройках
                </a>
              )}
            </div>
          </div>
        )}

        {/* AI generation - только для постов */}
        {!isNoteMode && (
          <div className="px-6 py-4 border-b border-border">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Тема для генерации..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateContent()}
                className="flex-1 bg-input rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={generateContent}
                disabled={isGenerating || !topic.trim()}
                className="px-4 py-2 btn-core text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Сгенерировать
              </button>
            </div>
          </div>
        )}

        {/* Подсказка для заметки */}
        {isNoteMode && (
          <div className="px-6 py-4 border-b border-border bg-yellow-500/5">
            <p className="text-sm text-muted-foreground">
              Заметка — это идея или напоминание. Позже вы сможете превратить её в полноценный пост.
            </p>
          </div>
        )}

        {/* Formatting toolbar */}
        <div className="px-6 py-2 border-b border-border flex items-center gap-1">
          <button
            onClick={formatBold}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Жирный (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={formatItalic}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Курсив (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <button
            onClick={formatBulletList}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Маркированный список"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={formatNumberedList}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Нумерованный список"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <button
            onClick={insertHashtag}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Хэштег"
          >
            <Hash className="w-4 h-4" />
          </button>
          <button
            onClick={insertLink}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Ссылка"
          >
            <Link2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Emoji picker */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showEmojiPicker ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'
              )}
              title="Эмодзи"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-xl p-3 shadow-xl z-10 w-[280px]">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content editor */}
        <div className="flex-1 p-6">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={handleSelect}
            onKeyDown={(e) => {
              // Keyboard shortcuts
              if (e.ctrlKey || e.metaKey) {
                if (e.key === 'b') {
                  e.preventDefault()
                  formatBold()
                } else if (e.key === 'i') {
                  e.preventDefault()
                  formatItalic()
                }
              }
            }}
            placeholder={isNoteMode
              ? "Запишите идею или напоминание..."
              : "Напишите текст поста или сгенерируйте с помощью AI..."
            }
            className="w-full h-full bg-transparent resize-none focus:outline-none text-lg leading-relaxed"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="h-20 px-6 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {content.length} символов
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Schedule - для постов и заметок */}
            <div className="relative">
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                className="px-4 py-2 bg-secondary rounded-lg flex items-center gap-2 hover:bg-secondary/80"
              >
                <Calendar className="w-4 h-4" />
                {isNoteMode ? 'Добавить в календарь' : 'Запланировать'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showSchedule ? 'rotate-180' : ''}`} />
              </button>

              {showSchedule && (
                <div className="absolute bottom-full mb-2 right-0 bg-card border border-border rounded-xl p-4 shadow-xl w-72">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground">Дата</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full mt-1 bg-input rounded-lg px-3 py-2"
                      />
                    </div>
                    {!isNoteMode && (
                      <div>
                        <label className="text-sm text-muted-foreground">Время</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full mt-1 bg-input rounded-lg px-3 py-2"
                        />
                      </div>
                    )}
                    <button
                      onClick={isNoteMode ? saveAsDraft : schedulePost}
                      disabled={!scheduleDate || (!isNoteMode && !scheduleTime) || !content.trim() || isSaving}
                      className="w-full py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      {isNoteMode ? 'Сохранить заметку' : 'Добавить в календарь'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Save as draft - только для постов */}
            {!isNoteMode && (
              <button
                onClick={saveAsDraft}
                disabled={!content.trim() || isSaving}
                className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Черновик'}
              </button>
            )}

            {/* Publish now - только для постов */}
            {!isNoteMode && (
              <button
                onClick={publishNow}
                disabled={!content.trim() || selectedChannels.length === 0 || isPublishing}
                className="px-6 py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Опубликовать
              </button>
            )}

            {/* Быстрое сохранение заметки без даты */}
            {isNoteMode && (
              <button
                onClick={saveAsDraft}
                disabled={!content.trim() || isSaving}
                className="px-6 py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Сохранить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right panel — preview */}
      <div className="w-[400px] flex flex-col bg-card/50">
        <div className="h-16 px-6 border-b border-border flex items-center">
          <Eye className="w-5 h-5 mr-2 text-muted-foreground" />
          <h2 className="text-lg font-medium">Превью</h2>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {content ? (
            <div className="space-y-4">
              {/* Telegram preview */}
              {selectedChannels.map((channelId) => {
                const channel = channels.find((c) => c.channel_id === channelId)
                if (!channel) return null

                return (
                  <div key={channelId} className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center">
                        <Send className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium">{channel.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {channel.username ? `@${channel.username}` : channel.channel_id}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      {renderFormattedContent(content)}

                      {/* Footer */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        <div className="flex items-center gap-3">
                          <span>👁 0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {selectedChannels.length === 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  {renderFormattedContent(content)}
                  <div className="mt-4 text-xs text-muted-foreground text-center">
                    Выберите канал для публикации
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div className="text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Начните писать или</p>
                <p>сгенерируйте контент</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm exit dialog */}
      {showConfirmExit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-[380px] border border-border shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Сохранить изменения?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              У вас есть несохранённые изменения. Хотите сохранить их перед выходом?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmExit(false)
                  router.push('/')
                }}
                className="flex-1 py-3 bg-secondary rounded-lg hover:bg-secondary/80"
              >
                Не сохранять
              </button>
              <button
                onClick={() => {
                  setShowConfirmExit(false)
                  saveAsDraft()
                }}
                className="flex-1 py-3 btn-core text-white rounded-lg"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close emoji picker */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  )
}

export default function CreatePostPageWrapper() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <CreatePostPage />
    </Suspense>
  )
}
