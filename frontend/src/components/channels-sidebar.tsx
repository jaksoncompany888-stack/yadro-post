'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2, Check, RefreshCw, Users, User, BarChart3 } from 'lucide-react'
import { resourcesApi } from '@/lib/api'

interface MyChannel {
  channel: string | null
  name: string | null
  analyzed: boolean
  temperature: number | null
}

interface Competitor {
  id: number
  channel: string
  analyzed: boolean
  temperature: number | null
}

export function ChannelsSidebar() {
  const [myChannel, setMyChannel] = useState<MyChannel | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState<'channel' | 'competitor' | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    try {
      const [channelRes, competitorsRes] = await Promise.all([
        resourcesApi.getMyChannel(),
        resourcesApi.listCompetitors(),
      ])
      setMyChannel(channelRes.data)
      setCompetitors(competitorsRes.data || [])
    } catch (err) {
      console.error('Failed to load resources:', err)
    } finally {
      setLoading(false)
    }
  }

  const removeCompetitor = async (id: number) => {
    try {
      await resourcesApi.removeCompetitor(id)
      setCompetitors(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to remove competitor:', err)
    }
  }

  const analyzeChannel = async (type: 'my' | 'competitor', id?: number) => {
    const key = type === 'my' ? 'my-channel' : `comp-${id}`
    setAnalyzing(key)
    try {
      if (type === 'my') {
        await resourcesApi.analyzeMyChannel()
        const res = await resourcesApi.getMyChannel()
        setMyChannel(res.data)
      } else if (id) {
        await resourcesApi.analyzeCompetitor(id)
        const res = await resourcesApi.listCompetitors()
        setCompetitors(res.data || [])
      }
    } catch (err) {
      console.error('Failed to analyze:', err)
    } finally {
      setAnalyzing(null)
    }
  }

  const handleChannelAdded = async () => {
    setShowAddModal(null)
    setLoading(true)
    await loadResources()
  }

  return (
    <div className="w-52 border-r border-border p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Мои ресурсы</h2>
        <button
          onClick={() => setShowAddModal('channel')}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="Добавить ресурс"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-auto">
          {/* Мой канал */}
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <User className="w-3 h-3" />
              <span>Мой канал</span>
            </div>
            {myChannel?.channel ? (
              <div className="relative group">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center text-white text-sm">
                    T
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{myChannel.channel}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {myChannel.analyzed ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          <span>t={myChannel.temperature?.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-yellow-500">Не анализирован</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => analyzeChannel('my')}
                    disabled={analyzing === 'my-channel'}
                    className="p-1 rounded hover:bg-secondary"
                    title="Переанализировать"
                  >
                    {analyzing === 'my-channel' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddModal('channel')}
                className="w-full flex items-center gap-3 p-2 rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Добавить канал</span>
              </button>
            )}
          </div>

          {/* Конкуренты */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>Конкуренты ({competitors.length})</span>
              </div>
              <button
                onClick={() => setShowAddModal('competitor')}
                className="text-muted-foreground hover:text-primary"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {competitors.length === 0 ? (
              <button
                onClick={() => setShowAddModal('competitor')}
                className="w-full flex items-center gap-3 p-2 rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить конкурента</span>
              </button>
            ) : (
              <div className="space-y-1">
                {competitors.map((comp) => (
                  <div key={comp.id} className="relative group">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">
                        <BarChart3 className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{comp.channel}</div>
                        <div className="text-xs text-muted-foreground">
                          {comp.analyzed ? (
                            <span className="text-green-500">t={comp.temperature?.toFixed(2)}</span>
                          ) : (
                            <span className="text-yellow-500">...</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => analyzeChannel('competitor', comp.id)}
                        disabled={analyzing === `comp-${comp.id}`}
                        className="p-1 rounded hover:bg-secondary opacity-0 group-hover:opacity-100"
                        title="Переанализировать"
                      >
                        {analyzing === `comp-${comp.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => removeCompetitor(comp.id)}
                        className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100"
                        title="Удалить"
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddResourceModal
          type={showAddModal}
          onClose={() => setShowAddModal(null)}
          onAdded={handleChannelAdded}
        />
      )}
    </div>
  )
}

function AddResourceModal({
  type,
  onClose,
  onAdded,
}: {
  type: 'channel' | 'competitor'
  onClose: () => void
  onAdded: () => void
}) {
  const [channelInput, setChannelInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isMyChannel = type === 'channel'

  const handleAdd = async () => {
    if (!channelInput.trim()) return

    setLoading(true)
    setError('')

    try {
      if (isMyChannel) {
        await resourcesApi.setMyChannel(channelInput.trim())
      } else {
        await resourcesApi.addCompetitor(channelInput.trim(), true)
      }
      onAdded()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка добавления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-[380px] border border-border shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isMyChannel ? 'Мой канал' : 'Добавить конкурента'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {isMyChannel
            ? 'Укажите ваш Telegram канал для анализа стиля и генерации постов в вашем стиле.'
            : 'Укажите канал конкурента для анализа его стиля и вдохновения.'}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Канал
            </label>
            <input
              type="text"
              placeholder="@username"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
            После добавления канал будет автоматически проанализирован. Это займёт ~10-20 секунд.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleAdd}
              disabled={loading || !channelInput.trim()}
              className="flex-1 py-3 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Анализ...</span>
                </>
              ) : (
                'Добавить'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
