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
  const editorRef = useRef<HTMLDivElement>(null)
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
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)

  // Режим: пост или заметка
  const isNoteMode = searchParams.get('type') === 'note'

  // Load URL parameters
  useEffect(() => {
    const textParam = searchParams.get('text')
    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')
    const editParam = searchParams.get('edit')

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

    // Load draft for editing
    if (editParam) {
      const draftId = parseInt(editParam)
      if (!isNaN(draftId)) {
        setEditingDraftId(draftId)
        loadDraftForEdit(draftId)
      }
    }
  }, [searchParams])

  const loadDraftForEdit = async (draftId: number) => {
    setLoadingDraft(true)
    try {
      const response = await postsApi.get(draftId)
      const draft = response.data
      setContent(draft.text || '')
      setTopic(draft.topic || '')
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Failed to load draft:', err)
      setError('Не удалось загрузить черновик')
    } finally {
      setLoadingDraft(false)
    }
  }

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

  // Get plain text from editor (strip HTML)
  const getPlainText = (html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n+/g, '\n')
      .trim()
  }

  // Convert plain text to HTML for editor
  const textToHtml = (text: string): string => {
    if (!text) return ''

    let html = text

    // First preserve existing HTML bold/italic tags
    html = html
      .replace(/<b>/gi, '\x00BOLD_OPEN\x00')
      .replace(/<\/b>/gi, '\x00BOLD_CLOSE\x00')
      .replace(/<strong>/gi, '\x00BOLD_OPEN\x00')
      .replace(/<\/strong>/gi, '\x00BOLD_CLOSE\x00')
      .replace(/<i>/gi, '\x00ITALIC_OPEN\x00')
      .replace(/<\/i>/gi, '\x00ITALIC_CLOSE\x00')
      .replace(/<em>/gi, '\x00ITALIC_OPEN\x00')
      .replace(/<\/em>/gi, '\x00ITALIC_CLOSE\x00')

    // Escape remaining HTML
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Restore preserved tags
    html = html
      .replace(/\x00BOLD_OPEN\x00/g, '<b>')
      .replace(/\x00BOLD_CLOSE\x00/g, '</b>')
      .replace(/\x00ITALIC_OPEN\x00/g, '<i>')
      .replace(/\x00ITALIC_CLOSE\x00/g, '</i>')

    // Convert markdown to HTML
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/__(.*?)__/g, '<b>$1</b>')
      .replace(/(?<![a-zA-Z0-9])_([^_\n]+?)_(?![a-zA-Z0-9])/g, '<i>$1</i>')
      .replace(/\n/g, '<br>')

    return html
  }

  // Update editor content when content state changes (e.g., from AI generation)
  useEffect(() => {
    if (editorRef.current && content) {
      const currentHtml = editorRef.current.innerHTML
      const newHtml = textToHtml(content)
      // Only update if different to avoid cursor jump
      if (getPlainText(currentHtml) !== content) {
        editorRef.current.innerHTML = newHtml
      }
    }
  }, [content])

  // Handle editor input
  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      const plainText = getPlainText(html)
      // Convert HTML formatting back to markdown-like syntax for storage
      let text = html
        .replace(/<b>(.*?)<\/b>/gi, '**$1**')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<i>(.*?)<\/i>/gi, '_$1_')
        .replace(/<em>(.*?)<\/em>/gi, '_$1_')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
      setContent(text)
    }
  }

  // Format text with execCommand (works with contenteditable)
  const formatBold = () => {
    document.execCommand('bold', false)
    editorRef.current?.focus()
    handleEditorInput()
  }

  const formatItalic = () => {
    document.execCommand('italic', false)
    editorRef.current?.focus()
    handleEditorInput()
  }

  const formatBulletList = () => {
    document.execCommand('insertUnorderedList', false)
    editorRef.current?.focus()
    handleEditorInput()
  }

  const formatNumberedList = () => {
    document.execCommand('insertOrderedList', false)
    editorRef.current?.focus()
    handleEditorInput()
  }

  const insertEmoji = (emoji: string) => {
    document.execCommand('insertText', false, emoji)
    editorRef.current?.focus()
    handleEditorInput()
    setShowEmojiPicker(false)
  }

  const insertHashtag = () => {
    document.execCommand('insertText', false, '#')
    editorRef.current?.focus()
    handleEditorInput()
  }

  const insertLink = () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString() || ''
    const url = prompt('Введите URL:')
    if (url) {
      if (selectedText) {
        document.execCommand('createLink', false, url)
      } else {
        document.execCommand('insertText', false, url)
      }
      editorRef.current?.focus()
      handleEditorInput()
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
      if (editingDraftId) {
        // Update existing draft
        await postsApi.update(editingDraftId, {
          text: content,
          topic: topic || undefined,
          platforms: ['telegram'],
          channel_ids: selectedChannels.length > 0
            ? { telegram: selectedChannels[0] }
            : {},
        })
      } else {
        // Create new draft
        await postsApi.create({
          text: content,
          topic: topic || undefined,
          platforms: ['telegram'],
          channel_ids: selectedChannels.length > 0
            ? { telegram: selectedChannels[0] }
            : {},
        })
      }
      setHasUnsavedChanges(false)
      router.push('/drafts?refresh=' + Date.now())
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
    // Step 1: Preserve allowed HTML tags through XSS escaping
    let html = text
      .replace(/<b>/gi, '\x00BOLD_OPEN\x00')
      .replace(/<\/b>/gi, '\x00BOLD_CLOSE\x00')
      .replace(/<strong>/gi, '\x00BOLD_OPEN\x00')
      .replace(/<\/strong>/gi, '\x00BOLD_CLOSE\x00')
      .replace(/<i>/gi, '\x00ITALIC_OPEN\x00')
      .replace(/<\/i>/gi, '\x00ITALIC_CLOSE\x00')
      .replace(/<em>/gi, '\x00ITALIC_OPEN\x00')
      .replace(/<\/em>/gi, '\x00ITALIC_CLOSE\x00')

    // Step 2: Escape remaining HTML
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Step 3: Restore allowed tags
    html = html
      .replace(/\x00BOLD_OPEN\x00/g, '<strong>')
      .replace(/\x00BOLD_CLOSE\x00/g, '</strong>')
      .replace(/\x00ITALIC_OPEN\x00/g, '<em>')
      .replace(/\x00ITALIC_CLOSE\x00/g, '</em>')

    // Step 4: Convert markdown to HTML
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')

    return <div className="whitespace-pre-wrap text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Left panel — editor */}
      <div className="flex-1 flex flex-col md:border-r border-border min-h-0">
        {/* Header */}
        <div className="h-14 md:h-16 px-4 md:px-6 border-b border-border flex items-center gap-3 md:gap-4 shrink-0">
          <button
            onClick={handleExit}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold flex-1">
            {isNoteMode ? 'Создать заметку' : editingDraftId ? 'Редактировать' : 'Создать пост'}
          </h1>
          {loadingDraft && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          {/* Mobile preview button */}
          {content && !isNoteMode && (
            <button
              className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => {
                // Scroll to show preview in a modal or alert
                alert('Превью:\n\n' + content.substring(0, 500) + (content.length > 500 ? '...' : ''))
              }}
            >
              <Eye className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Channel selection - только для постов */}
        {!isNoteMode && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Каналы:</span>
              {loadingChannels ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : channels.length === 0 ? (
                <span className="text-sm text-muted-foreground">Нет подключённых каналов</span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 md:gap-3">
              {channels.map((channel) => (
                <button
                  type="button"
                  key={channel.channel_id}
                  onClick={() => toggleChannel(channel.channel_id)}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    toggleChannel(channel.channel_id)
                  }}
                  className={`flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-full border-2 transition-all cursor-pointer select-none active:scale-95 ${
                    selectedChannels.includes(channel.channel_id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 grayscale'
                  }`}
                >
                  <div className="relative">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
                      <Send className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                    </div>
                    {selectedChannels.includes(channel.channel_id) && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-xs md:text-sm font-medium">{channel.name}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">
                      {formatNumber(channel.subscribers)}
                    </div>
                  </div>
                </button>
              ))}

              {channels.length === 0 && !loadingChannels && (
                <a
                  href="/"
                  className="flex items-center gap-2 px-3 py-2 rounded-full border-2 border-dashed border-border hover:border-primary/50 transition-colors text-sm text-muted-foreground"
                >
                  Добавьте каналы через «Мои ресурсы» на главной
                </a>
              )}
            </div>
          </div>
        )}

        {/* AI generation - только для постов */}
        {!isNoteMode && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border shrink-0">
            <div className="flex gap-2 md:gap-3">
              <input
                type="text"
                placeholder="Тема для генерации..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateContent()}
                className="flex-1 min-w-0 bg-input rounded-lg px-3 md:px-4 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={generateContent}
                disabled={isGenerating || !topic.trim()}
                className="px-3 md:px-4 py-2 btn-core text-white rounded-lg flex items-center gap-1.5 md:gap-2 disabled:opacity-50 shrink-0"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Сгенерировать</span>
                <span className="sm:hidden">AI</span>
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
        <div className="px-4 md:px-6 py-2 border-b border-border flex items-center gap-0.5 md:gap-1 overflow-x-auto shrink-0">
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

        {/* Content editor - contenteditable for rich text */}
        <div className="flex-1 p-6 overflow-auto">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
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
            data-placeholder={isNoteMode
              ? "Запишите идею или напоминание..."
              : "Напишите текст поста или сгенерируйте с помощью AI..."
            }
            className="w-full h-full bg-transparent focus:outline-none text-lg leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
            style={{ minHeight: '200px' }}
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
        <div className="shrink-0 px-4 md:px-6 py-3 md:py-4 border-t border-border mb-16 md:mb-0">
          {/* Mobile: stacked layout */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {content.length} символов
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Schedule - для постов и заметок */}
              <div className="relative flex-1 md:flex-none">
                <button
                  onClick={() => setShowSchedule(!showSchedule)}
                  className="w-full md:w-auto px-3 md:px-4 py-2.5 md:py-2 bg-secondary rounded-lg flex items-center justify-center gap-2 hover:bg-secondary/80 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">{isNoteMode ? 'В календарь' : 'Запланировать'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSchedule ? 'rotate-180' : ''}`} />
                </button>

                {showSchedule && (
                  <div className="absolute bottom-full mb-2 left-0 md:left-auto md:right-0 bg-card border border-border rounded-xl p-4 shadow-xl w-72 z-50">
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
                className="px-3 md:px-4 py-2.5 md:py-2 bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50 text-sm"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Черновик'}
              </button>
            )}

            {/* Publish now - только для постов */}
            {!isNoteMode && (
              <button
                onClick={publishNow}
                disabled={!content.trim() || selectedChannels.length === 0 || isPublishing}
                className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Опубликовать</span>
              </button>
            )}

            {/* Быстрое сохранение заметки без даты */}
            {isNoteMode && (
              <button
                onClick={saveAsDraft}
                disabled={!content.trim() || isSaving}
                className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
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
          {/* Mobile character count */}
          <div className="md:hidden mt-2 text-center text-xs text-muted-foreground">
            {content.length} символов
          </div>
        </div>
      </div>

      {/* Right panel — preview (hidden on mobile) */}
      <div className="hidden md:flex w-[400px] flex-col bg-card/50">
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
