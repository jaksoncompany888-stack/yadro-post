'use client'

import { useState, useEffect } from 'react'
import { Send, MessageCircle, Check, Plus, ExternalLink, Loader2, X, RefreshCw } from 'lucide-react'
import { channelsApi } from '@/lib/api'

interface Channel {
  id: string
  name: string
  type: 'telegram' | 'vk'
  channel_id: string
  is_connected: boolean
  avatar_url?: string
}

export default function IntegrationsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showTelegramModal, setShowTelegramModal] = useState(false)
  const [showVKModal, setShowVKModal] = useState(false)
  const [connectCode, setConnectCode] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  // VK form state
  const [vkToken, setVkToken] = useState('')
  const [vkGroupId, setVkGroupId] = useState('')

  // Load channels on mount
  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      setLoading(true)
      const response = await channelsApi.list()
      setChannels(response.data)
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoading(false)
    }
  }

  const openTelegramModal = () => {
    setConnectCode(Math.random().toString(36).substring(2, 6).toUpperCase())
    setError('')
    setShowTelegramModal(true)
  }

  const checkTelegramConnection = async () => {
    setConnecting(true)
    setError('')

    try {
      const response = await channelsApi.connectTelegram(connectCode)

      if (response.data.status === 'connected') {
        // Reload channels
        await loadChannels()
        setShowTelegramModal(false)
      } else if (response.data.status === 'pending') {
        setError('Бот ещё не получил команду. Убедитесь, что бот добавлен в канал как администратор.')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка подключения')
    } finally {
      setConnecting(false)
    }
  }

  const connectVK = async () => {
    if (!vkToken || !vkGroupId) {
      setError('Заполните все поля')
      return
    }

    setConnecting(true)
    setError('')

    try {
      await channelsApi.connectVK(vkToken, vkGroupId)
      await loadChannels()
      setShowVKModal(false)
      setVkToken('')
      setVkGroupId('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка подключения VK')
    } finally {
      setConnecting(false)
    }
  }

  const deleteChannel = async (channelId: string) => {
    if (!confirm('Отключить этот канал?')) return

    try {
      await channelsApi.delete(channelId)
      setChannels(channels.filter(c => c.id !== channelId))
    } catch (err) {
      console.error('Failed to delete channel:', err)
    }
  }

  const integrations = [
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Каналы и группы в Telegram',
      icon: Send,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      onClick: openTelegramModal,
    },
    {
      id: 'vk',
      name: 'ВКонтакте',
      description: 'Сообщества и группы VK',
      icon: MessageCircle,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10',
      onClick: () => {
        setError('')
        setShowVKModal(true)
      },
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Интеграции</h1>
          <p className="text-muted-foreground">Подключите социальные сети для публикации постов</p>
        </div>
        <button
          onClick={loadChannels}
          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          title="Обновить"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Connected channels */}
      {channels.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Подключённые каналы</h2>
          <div className="space-y-3">
            {channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  {channel.type === 'telegram' ? (
                    <div className="w-10 h-10 rounded-full bg-blue-400/10 flex items-center justify-center">
                      <Send className="w-5 h-5 text-blue-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-sky-500" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{channel.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {channel.type === 'telegram' ? 'Telegram' : 'VK'} • {channel.channel_id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Подключено</span>
                  </div>
                  <button
                    onClick={() => deleteChannel(channel.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Отключить"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && channels.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Available integrations */}
      <h2 className="text-lg font-medium mb-4">Доступные интеграции</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <button
            key={integration.id}
            onClick={integration.onClick}
            className="p-6 bg-card rounded-xl border border-border hover:border-primary/50 hover:glow-core transition-all text-left"
          >
            <div className={`w-12 h-12 rounded-xl ${integration.bgColor} flex items-center justify-center mb-4`}>
              <integration.icon className={`w-6 h-6 ${integration.color}`} />
            </div>
            <h3 className="font-medium mb-1">{integration.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{integration.description}</p>
            <div className="flex items-center gap-2 text-primary text-sm">
              <Plus className="w-4 h-4" />
              Подключить
            </div>
          </button>
        ))}
      </div>

      {/* Telegram Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-[480px] border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Подключить Telegram</h3>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="p-1 rounded hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Шаг 1</div>
                <p>Добавьте бота <code className="px-2 py-1 bg-background rounded text-primary">@YadroPostBot</code> в ваш канал как администратора</p>
              </div>

              <div className="p-4 bg-secondary rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Шаг 2</div>
                <p>Отправьте в канал команду:</p>
                <code className="block mt-2 px-4 py-3 bg-background rounded text-primary font-mono text-lg">/connect {connectCode}</code>
              </div>

              <div className="p-4 bg-secondary rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Шаг 3</div>
                <p>Нажмите кнопку ниже после отправки команды</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTelegramModal(false)}
                className="flex-1 py-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={checkTelegramConnection}
                disabled={connecting}
                className="flex-1 py-3 btn-core text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                Проверить подключение
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VK Modal */}
      {showVKModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-[480px] border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Подключить ВКонтакте</h3>
              <button
                onClick={() => setShowVKModal(false)}
                className="p-1 rounded hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-muted-foreground">
                Для подключения VK сообщества необходим токен доступа с правами на управление сообществом.
              </p>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">VK Access Token</label>
                <input
                  type="text"
                  placeholder="vk1.a.xxx..."
                  value={vkToken}
                  onChange={(e) => setVkToken(e.target.value)}
                  className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">ID сообщества</label>
                <input
                  type="text"
                  placeholder="123456789"
                  value={vkGroupId}
                  onChange={(e) => setVkGroupId(e.target.value)}
                  className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <a
                href="https://vk.com/editapp?act=create"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary text-sm hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Как получить токен?
              </a>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowVKModal(false)}
                className="flex-1 py-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={connectVK}
                disabled={connecting || !vkToken || !vkGroupId}
                className="flex-1 py-3 btn-core text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                Подключить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
