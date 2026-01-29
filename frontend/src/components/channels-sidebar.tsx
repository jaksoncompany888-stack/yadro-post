'use client'

import { useState, useEffect } from 'react'
import { Plus, Send, MessageCircle, X, Loader2, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { userChannelsApi } from '@/lib/api'

interface UserChannel {
  platform: string
  channel_id: string
  name: string
  username?: string
  subscribers: number
  is_valid: boolean
  can_post: boolean
}

export function ChannelsSidebar() {
  const [channels, setChannels] = useState<UserChannel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await userChannelsApi.list()
      const data = response.data || []
      setChannels(data)
      // Select all by default
      setSelectedChannels(data.map((ch: UserChannel) => ch.channel_id))
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    )
  }

  const removeChannel = async (channelId: string) => {
    try {
      await userChannelsApi.remove(channelId)
      setChannels(prev => prev.filter(ch => ch.channel_id !== channelId))
      setSelectedChannels(prev => prev.filter(id => id !== channelId))
    } catch (err) {
      console.error('Failed to remove channel:', err)
    }
  }

  const handleChannelAdded = (channel: UserChannel) => {
    setChannels(prev => [...prev, channel])
    setSelectedChannels(prev => [...prev, channel.channel_id])
    setShowAddModal(false)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  return (
    <div className="w-52 border-r border-border p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Мои каналы</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="Добавить канал для постинга"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          <div className="text-muted-foreground text-sm mb-4">
            Каналов пока нет
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Добавьте свой Telegram канал для публикации постов
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 btn-core text-white rounded-lg text-sm"
          >
            Добавить канал
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-2">
          {channels.map((channel) => (
            <div key={channel.channel_id} className="relative group">
              <button
                onClick={() => toggleChannel(channel.channel_id)}
                className={clsx(
                  'w-full flex items-center gap-3 p-2 rounded-lg transition-all',
                  selectedChannels.includes(channel.channel_id)
                    ? 'bg-primary/20 text-foreground'
                    : 'hover:bg-secondary text-muted-foreground'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  selectedChannels.includes(channel.channel_id) ? 'bg-primary/20' : 'bg-secondary'
                )}>
                  <Send className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm truncate">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(channel.subscribers)}
                  </div>
                </div>
                {selectedChannels.includes(channel.channel_id) && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeChannel(channel.channel_id)
                }}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Удалить канал"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center gap-3 p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Добавить</span>
          </button>
        </div>
      )}

      {showAddModal && (
        <AddChannelModal
          onClose={() => setShowAddModal(false)}
          onChannelAdded={handleChannelAdded}
        />
      )}
    </div>
  )
}

function AddChannelModal({
  onClose,
  onChannelAdded,
}: {
  onClose: () => void
  onChannelAdded: (channel: UserChannel) => void
}) {
  const [channelInput, setChannelInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addChannel = async () => {
    if (!channelInput.trim()) return

    setLoading(true)
    setError('')

    try {
      const response = await userChannelsApi.add(channelInput)
      if (response.data.valid && response.data.channel_info) {
        onChannelAdded(response.data.channel_info)
      } else {
        setError(response.data.error || 'Не удалось добавить канал')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка добавления канала')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-96 border border-border shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Добавить канал</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Telegram канал
            </label>
            <input
              type="text"
              placeholder="@username или ссылка"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChannel()}
              className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              Бот @Yadro888_bot должен быть администратором канала
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-secondary/50 rounded-lg p-4 text-sm">
            <div className="font-medium mb-2">Как добавить бота:</div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Откройте настройки канала</li>
              <li>Администраторы → Добавить</li>
              <li>Найдите @Yadro888_bot</li>
              <li>Дайте права "Публикация сообщений"</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={addChannel}
            disabled={loading || !channelInput.trim()}
            className="flex-1 py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Добавить'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
