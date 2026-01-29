'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Send,
  Wand2,
  Calendar,
  Clock,
  Eye,
  Loader2,
  ChevronDown,
  Plus,
  Check,
  AlertCircle,
  X,
} from 'lucide-react'
import { aiApi, postsApi, userChannelsApi } from '@/lib/api'

interface UserChannel {
  platform: string
  channel_id: string
  name: string
  username?: string
  subscribers: number
  is_valid: boolean
  can_post: boolean
}

function CreatePostPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [newChannelInput, setNewChannelInput] = useState('')
  const [addingChannel, setAddingChannel] = useState(false)

  // Загрузка параметров из URL
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

  const addChannel = async () => {
    if (!newChannelInput.trim()) return

    setAddingChannel(true)
    try {
      const response = await userChannelsApi.add(newChannelInput)
      if (response.data.valid && response.data.channel_info) {
        setChannels((prev) => [...prev, response.data.channel_info])
        setNewChannelInput('')
        setShowAddChannel(false)
      } else {
        setError(response.data.error || 'Не удалось добавить канал')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка добавления канала')
    } finally {
      setAddingChannel(false)
    }
  }

  const removeChannel = async (channelId: string) => {
    try {
      await userChannelsApi.remove(channelId)
      setChannels((prev) => prev.filter((c) => c.channel_id !== channelId))
      setSelectedChannels((prev) => prev.filter((id) => id !== channelId))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка удаления канала')
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
      router.push('/')
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
      router.push('/')
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
      // Создаём пост и сразу публикуем
      const createResponse = await postsApi.create({
        text: content,
        topic: topic || undefined,
        platforms: ['telegram'],
        channel_ids: { telegram: selectedChannels[0] },
      })

      await postsApi.publish(createResponse.data.id)
      router.push('/')
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

  return (
    <div className="h-full flex">
      {/* Левая панель — редактор */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Заголовок */}
        <div className="h-16 px-6 border-b border-border flex items-center">
          <h1 className="text-xl font-semibold">Создать пост</h1>
        </div>

        {/* Выбор каналов */}
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
              <div key={channel.channel_id} className="relative group">
                <button
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
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChannel(channel.channel_id)
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Удалить канал"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* Кнопка добавления канала */}
            <button
              onClick={() => setShowAddChannel(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-full border-2 border-dashed border-border hover:border-primary/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-sm">Добавить</span>
            </button>
          </div>
        </div>

        {/* Генерация по теме */}
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

        {/* Редактор контента */}
        <div className="flex-1 p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Напишите текст поста или сгенерируйте с помощью AI..."
            className="w-full h-full bg-transparent resize-none focus:outline-none text-lg leading-relaxed"
          />
        </div>

        {/* Ошибка */}
        {error && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* Нижняя панель с действиями */}
        <div className="h-20 px-6 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {content.length} символов
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Планирование */}
            <div className="relative">
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                className="px-4 py-2 bg-secondary rounded-lg flex items-center gap-2 hover:bg-secondary/80"
              >
                <Calendar className="w-4 h-4" />
                Запланировать
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
                    <div>
                      <label className="text-sm text-muted-foreground">Время</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full mt-1 bg-input rounded-lg px-3 py-2"
                      />
                    </div>
                    <button
                      onClick={schedulePost}
                      disabled={!scheduleDate || !scheduleTime || !content.trim() || isSaving}
                      className="w-full py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      Добавить в календарь
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Сохранить как черновик */}
            <button
              onClick={saveAsDraft}
              disabled={!content.trim() || isSaving}
              className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Черновик'}
            </button>

            {/* Опубликовать сейчас */}
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
          </div>
        </div>
      </div>

      {/* Правая панель — превью */}
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
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {content}
                      </div>

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
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {content}
                  </div>
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

      {/* Модалка добавления канала */}
      {showAddChannel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-[420px] border border-border shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Подключить канал</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Username канала
                </label>
                <input
                  type="text"
                  placeholder="@mychannel"
                  value={newChannelInput}
                  onChange={(e) => setNewChannelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                  className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Бот @Yadro888_bot должен быть администратором канала с правами на публикацию
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddChannel(false)
                  setError('')
                }}
                className="flex-1 py-3 bg-secondary rounded-lg hover:bg-secondary/80"
              >
                Отмена
              </button>
              <button
                onClick={addChannel}
                disabled={addingChannel || !newChannelInput.trim()}
                className="flex-1 py-3 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingChannel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Подключить
              </button>
            </div>
          </div>
        </div>
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
