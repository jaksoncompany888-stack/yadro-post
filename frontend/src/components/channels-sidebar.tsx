'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2, Check, Send, Link2 } from 'lucide-react'
import { clsx } from 'clsx'
import { userChannelsApi } from '@/lib/api'

// Все поддерживаемые платформы
const PLATFORMS = [
  {
    id: 'telegram',
    name: 'Telegram',
    color: 'bg-[#0088cc]',
    icon: '✈️',
    connectType: 'bot', // Требуется добавить бота
    placeholder: '@username или ссылка',
    hint: 'Бот @YadroPost_bot должен быть администратором канала',
  },
  {
    id: 'vk',
    name: 'VK',
    color: 'bg-[#4a76a8]',
    icon: '💙',
    connectType: 'oauth', // OAuth авторизация
    placeholder: 'Ссылка на группу',
    hint: 'Требуется авторизация ВКонтакте',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]',
    icon: '📸',
    connectType: 'link', // Просто ссылка
    placeholder: '@username или ссылка',
    hint: 'Укажите ссылку на профиль',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: 'bg-black',
    icon: '🎵',
    connectType: 'link',
    placeholder: '@username или ссылка',
    hint: 'Укажите ссылку на профиль',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'bg-[#ff0000]',
    icon: '▶️',
    connectType: 'link',
    placeholder: 'Ссылка на канал',
    hint: 'Укажите ссылку на канал',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: 'bg-[#1877f2]',
    icon: '👍',
    connectType: 'link',
    placeholder: 'Ссылка на страницу',
    hint: 'Укажите ссылку на страницу',
  },
  {
    id: 'ok',
    name: 'OK',
    color: 'bg-[#ee8208]',
    icon: '🟠',
    connectType: 'link',
    placeholder: 'Ссылка на группу',
    hint: 'Укажите ссылку на группу',
  },
]

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

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0]
  }

  return (
    <>
    {/* Mobile: floating button to open resources */}
    <button
      onClick={() => setShowAddModal(true)}
      className="md:hidden fixed top-3 right-3 z-40 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg"
      title="Мои ресурсы"
    >
      <span className="text-white text-sm font-medium">{channels.length || '+'}</span>
    </button>

    {/* Desktop: sidebar */}
    <div className="hidden md:flex w-52 border-r border-border p-4 flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Мои ресурсы</h2>
        <button
          onClick={() => setShowAddModal(true)}
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
      ) : channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          <div className="text-muted-foreground text-sm mb-4">
            Ресурсов пока нет
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Подключите свои соцсети для публикации контента
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 btn-core text-white rounded-lg text-sm"
          >
            Добавить ресурс
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-auto">
          {channels.map((channel) => {
            const platform = getPlatformInfo(channel.platform)
            return (
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
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm',
                    platform.color
                  )}>
                    {platform.icon}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm truncate">{channel.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{platform.name}</span>
                      {channel.subscribers > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatNumber(channel.subscribers)}</span>
                        </>
                      )}
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
                  title="Удалить ресурс"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )
          })}

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
        <AddResourceModal
          onClose={() => setShowAddModal(false)}
          onChannelAdded={handleChannelAdded}
        />
      )}
    </div>

    {/* Mobile: full-screen resources modal */}
    {showAddModal && (
      <div className="md:hidden fixed inset-0 bg-background z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Мои ресурсы</h2>
          <button
            onClick={() => setShowAddModal(false)}
            className="p-2 rounded-lg hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">Ресурсов пока нет</div>
              <p className="text-sm text-muted-foreground mb-6">
                Подключите свои соцсети для публикации контента
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => {
                const platform = getPlatformInfo(channel.platform)
                return (
                  <div
                    key={channel.channel_id}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all',
                      selectedChannels.includes(channel.channel_id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    )}
                  >
                    <button
                      onClick={() => toggleChannel(channel.channel_id)}
                      className="flex-1 flex items-center gap-3"
                    >
                      <div className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white',
                        platform.color
                      )}>
                        {platform.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{channel.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {platform.name}
                          {channel.subscribers > 0 && ` • ${formatNumber(channel.subscribers)}`}
                        </div>
                      </div>
                      {selectedChannels.includes(channel.channel_id) && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                    <button
                      onClick={() => removeChannel(channel.channel_id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add resource section */}
        <div className="p-4 border-t border-border">
          <MobileAddResource onChannelAdded={handleChannelAdded} />
        </div>
      </div>
    )}
    </>
  )
}

function AddResourceModal({
  onClose,
  onChannelAdded,
}: {
  onClose: () => void
  onChannelAdded: (channel: UserChannel) => void
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [channelInput, setChannelInput] = useState('')
  const [channelName, setChannelName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const platform = selectedPlatform ? PLATFORMS.find(p => p.id === selectedPlatform) : null

  const addChannel = async () => {
    if (!channelInput.trim() || !selectedPlatform) return

    setLoading(true)
    setError('')

    try {
      // Для Telegram используем API валидации
      if (selectedPlatform === 'telegram') {
        const response = await userChannelsApi.add(channelInput, selectedPlatform)
        if (response.data.valid && response.data.channel_info) {
          onChannelAdded(response.data.channel_info)
        } else {
          setError(response.data.error || 'Не удалось добавить канал')
        }
      } else {
        // Для других платформ просто сохраняем ссылку
        const response = await userChannelsApi.add(channelInput, selectedPlatform)
        if (response.data.channel_info) {
          onChannelAdded({
            ...response.data.channel_info,
            name: channelName || channelInput,
          })
        } else if (response.data.valid !== false) {
          // Если API не возвращает channel_info, создаем локально
          onChannelAdded({
            platform: selectedPlatform,
            channel_id: channelInput,
            name: channelName || channelInput,
            subscribers: 0,
            is_valid: true,
            can_post: selectedPlatform === 'telegram' || selectedPlatform === 'vk',
          })
        } else {
          setError(response.data.error || 'Не удалось добавить ресурс')
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка добавления ресурса')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl p-4 md:p-6 w-full max-w-[420px] max-h-[90vh] overflow-auto border border-border shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {selectedPlatform ? `Добавить ${platform?.name}` : 'Добавить ресурс'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedPlatform ? (
          // Выбор платформы
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all"
              >
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white text-lg',
                  p.color
                )}>
                  {p.icon}
                </div>
                <div className="text-left">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.connectType === 'bot' && 'Через бота'}
                    {p.connectType === 'oauth' && 'Авторизация'}
                    {p.connectType === 'link' && 'По ссылке'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Форма добавления
          <div className="space-y-4">
            <button
              onClick={() => setSelectedPlatform(null)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              ← Выбрать другую платформу
            </button>

            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-white text-lg',
                platform?.color
              )}>
                {platform?.icon}
              </div>
              <div>
                <div className="font-medium">{platform?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {platform?.connectType === 'bot' && 'Подключение через бота'}
                  {platform?.connectType === 'oauth' && 'OAuth авторизация'}
                  {platform?.connectType === 'link' && 'Добавление по ссылке'}
                </div>
              </div>
            </div>

            {platform?.connectType === 'link' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Название (необязательно)
                </label>
                <input
                  type="text"
                  placeholder="Мой канал"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                {platform?.connectType === 'bot' ? 'Канал' : 'Ссылка'}
              </label>
              <input
                type="text"
                placeholder={platform?.placeholder}
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                className="w-full bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                {platform?.hint}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {platform?.connectType === 'bot' && (
              <div className="bg-secondary/50 rounded-lg p-4 text-sm">
                <div className="font-medium mb-2">Как добавить бота:</div>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Откройте настройки канала</li>
                  <li>Администраторы → Добавить</li>
                  <li>Найдите @YadroPost_bot</li>
                  <li>Дайте права "Публикация сообщений"</li>
                </ol>
              </div>
            )}

            {platform?.connectType === 'oauth' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Link2 className="w-4 h-4" />
                  <span className="font-medium">Авторизация</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Для автопостинга в VK потребуется авторизация. Пока можно добавить ссылку для планирования контента.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={addChannel}
                disabled={loading || !channelInput.trim()}
                className="flex-1 py-3 btn-core text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Добавить'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Mobile inline add resource component
function MobileAddResource({
  onChannelAdded,
}: {
  onChannelAdded: (channel: UserChannel) => void
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [channelInput, setChannelInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const platform = selectedPlatform ? PLATFORMS.find(p => p.id === selectedPlatform) : null

  const addChannel = async () => {
    if (!channelInput.trim() || !selectedPlatform) return

    setLoading(true)
    setError('')

    try {
      const response = await userChannelsApi.add(channelInput, selectedPlatform)
      if (response.data.channel_info) {
        onChannelAdded(response.data.channel_info)
        setChannelInput('')
        setSelectedPlatform(null)
      } else if (response.data.valid === false) {
        setError(response.data.error || 'Не удалось добавить ресурс')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка добавления')
    } finally {
      setLoading(false)
    }
  }

  if (!selectedPlatform) {
    return (
      <div>
        <div className="text-sm font-medium mb-3">Добавить ресурс</div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors',
              )}
            >
              <span>{p.icon}</span>
              <span className="text-sm">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedPlatform(null)}
          className="text-sm text-muted-foreground"
        >
          ← Назад
        </button>
        <span className="text-sm font-medium">{platform?.name}</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={platform?.placeholder}
          value={channelInput}
          onChange={(e) => setChannelInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChannel()}
          className="flex-1 bg-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        <button
          onClick={addChannel}
          disabled={loading || !channelInput.trim()}
          className="px-4 py-3 btn-core text-white rounded-lg disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}

      <p className="text-xs text-muted-foreground">{platform?.hint}</p>
    </div>
  )
}
