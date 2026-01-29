'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  Plus,
  Loader2,
  X,
  RefreshCw,
  BarChart3,
  Users,
  Eye,
  Heart,
  TrendingUp,
} from 'lucide-react'
import { channelsApi } from '@/lib/api'

interface ChannelInfo {
  username: string
  title: string
  subscribers: number
  description: string
}

interface ChannelMetrics {
  posts_analyzed: number
  avg_length: number
  length_category: string
  avg_emoji: number
  emoji_style: string
  avg_views: number
  avg_reactions: number
  engagement_rate: number
  content_type: string
  recommended_temperature: number
  top_words: string[]
  hook_patterns: string[]
}

interface ChannelAnalysis {
  channel: ChannelInfo
  metrics: ChannelMetrics
}

export default function IntegrationsPage() {
  const [channels, setChannels] = useState<ChannelAnalysis[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [channelInput, setChannelInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<ChannelAnalysis | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  // Загрузка сохранённых каналов при старте
  useEffect(() => {
    loadChannels()
  }, [])

  // Выбор канала с подгрузкой метрик если нужно
  const selectChannel = async (ch: ChannelAnalysis) => {
    setSelectedChannel(ch)

    // Если метрик нет — загружаем
    if (!ch.metrics?.posts_analyzed) {
      setLoadingMetrics(true)
      try {
        const response = await channelsApi.analyze(ch.channel.username)
        const analysis = response.data as ChannelAnalysis

        // Обновляем в списке
        setChannels((prev) =>
          prev.map((c) =>
            c.channel.username === ch.channel.username ? analysis : c
          )
        )
        setSelectedChannel(analysis)
      } catch (err) {
        console.error('Failed to load metrics:', err)
      } finally {
        setLoadingMetrics(false)
      }
    }
  }

  const loadChannels = async () => {
    try {
      setLoading(true)
      const response = await channelsApi.list()
      // Каналы приходят как ChannelInfo, нужно обогатить метриками
      const channelInfos = response.data as ChannelInfo[]
      // Для простоты показываем без метрик, метрики загружаем по клику
      setChannels(
        channelInfos.map((ch) => ({
          channel: ch,
          metrics: {} as ChannelMetrics,
        }))
      )
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoading(false)
    }
  }

  const analyzeChannel = async () => {
    if (!channelInput.trim()) return

    setAnalyzing(true)
    setError('')

    try {
      const response = await channelsApi.analyze(channelInput)
      const analysis = response.data as ChannelAnalysis

      // Добавляем в список
      setChannels((prev) => {
        // Проверяем дубликат
        const exists = prev.find((c) => c.channel.username === analysis.channel.username)
        if (exists) {
          return prev.map((c) =>
            c.channel.username === analysis.channel.username ? analysis : c
          )
        }
        return [...prev, analysis]
      })

      // Сохраняем на сервере
      await channelsApi.add(channelInput)

      setShowAddModal(false)
      setChannelInput('')
      setSelectedChannel(analysis)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Не удалось проанализировать канал')
    } finally {
      setAnalyzing(false)
    }
  }

  const removeChannel = async (username: string) => {
    try {
      await channelsApi.remove(username)
      setChannels((prev) => prev.filter((c) => c.channel.username !== username))
      if (selectedChannel?.channel.username === username) {
        setSelectedChannel(null)
      }
    } catch (err) {
      console.error('Failed to remove channel:', err)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Каналы</h1>
          <p className="text-muted-foreground">
            Добавьте Telegram каналы для анализа и генерации контента
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadChannels}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            title="Обновить"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 btn-core text-white rounded-lg flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Добавить канал
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список каналов */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-medium mb-4">Мои каналы</h2>

          {loading && channels.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Каналов пока нет</p>
              <p className="text-sm mt-2">Добавьте канал для анализа</p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch.channel.username}
                  onClick={() => selectChannel(ch)}
                  className={`p-4 bg-card rounded-xl border cursor-pointer transition-all ${
                    selectedChannel?.channel.username === ch.channel.username
                      ? 'border-primary glow-core'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-400/10 flex items-center justify-center">
                        <Send className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium">{ch.channel.title}</div>
                        <div className="text-sm text-muted-foreground">
                          @{ch.channel.username}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeChannel(ch.channel.username)
                      }}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {ch.channel.subscribers > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{formatNumber(ch.channel.subscribers)} подписчиков</span>
                    </div>
                  )}

                  {ch.metrics?.content_type && (
                    <div className="mt-2">
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                        {ch.metrics.content_type}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Детали канала */}
        <div className="lg:col-span-2">
          {selectedChannel ? (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-blue-400/10 flex items-center justify-center">
                  <Send className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{selectedChannel.channel.title}</h2>
                  <p className="text-muted-foreground">@{selectedChannel.channel.username}</p>
                  {selectedChannel.channel.description && (
                    <p className="text-sm mt-1">{selectedChannel.channel.description}</p>
                  )}
                </div>
              </div>

              {loadingMetrics ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Анализируем канал...</p>
                  <p className="text-xs text-muted-foreground mt-2">Это может занять 10-30 секунд</p>
                </div>
              ) : selectedChannel.metrics?.posts_analyzed ? (
                <>
                  {/* Основные метрики */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs">Подписчики</span>
                      </div>
                      <div className="text-xl font-semibold">
                        {formatNumber(selectedChannel.channel.subscribers)}
                      </div>
                    </div>

                    <div className="p-4 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Ср. просмотры</span>
                      </div>
                      <div className="text-xl font-semibold">
                        {formatNumber(selectedChannel.metrics.avg_views)}
                      </div>
                    </div>

                    <div className="p-4 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Heart className="w-4 h-4" />
                        <span className="text-xs">Ср. реакции</span>
                      </div>
                      <div className="text-xl font-semibold">
                        {formatNumber(selectedChannel.metrics.avg_reactions)}
                      </div>
                    </div>

                    <div className="p-4 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs">Engagement</span>
                      </div>
                      <div className="text-xl font-semibold">
                        {selectedChannel.metrics.engagement_rate}%
                      </div>
                    </div>
                  </div>

                  {/* Стиль контента */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Анализ стиля
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Тип контента</span>
                        <div className="font-medium capitalize">
                          {selectedChannel.metrics.content_type}
                        </div>
                      </div>
                      <div className="p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Длина постов</span>
                        <div className="font-medium">
                          {selectedChannel.metrics.length_category} (~
                          {selectedChannel.metrics.avg_length} симв.)
                        </div>
                      </div>
                      <div className="p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Эмодзи</span>
                        <div className="font-medium">{selectedChannel.metrics.emoji_style}</div>
                      </div>
                      <div className="p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">
                          Рекомендуемая temperature
                        </span>
                        <div className="font-medium">
                          {selectedChannel.metrics.recommended_temperature}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Хуки и топ слова */}
                  <div className="grid grid-cols-2 gap-6">
                    {selectedChannel.metrics.hook_patterns?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Паттерны хуков</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedChannel.metrics.hook_patterns.map((pattern, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full"
                            >
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedChannel.metrics.top_words?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Топ слова</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedChannel.metrics.top_words.slice(0, 6).map((word, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-secondary rounded-full">
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-border text-sm text-muted-foreground">
                    Проанализировано {selectedChannel.metrics.posts_analyzed} постов
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Метрики не загружены</p>
                  <button
                    onClick={() => selectChannel(selectedChannel)}
                    className="mt-4 px-4 py-2 btn-core text-white rounded-lg text-sm"
                  >
                    Загрузить метрики
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">Выберите канал</h3>
              <p className="text-muted-foreground">
                Кликните на канал слева, чтобы увидеть детальный анализ
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-[480px] border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Добавить Telegram канал</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Username канала
                </label>
                <input
                  type="text"
                  placeholder="@durov или durov"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyzeChannel()}
                  className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Канал должен быть публичным для анализа
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
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={analyzeChannel}
                disabled={analyzing || !channelInput.trim()}
                className="flex-1 py-3 btn-core text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Анализирую...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    Анализировать
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
