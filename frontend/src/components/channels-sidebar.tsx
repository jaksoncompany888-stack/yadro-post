'use client'

import { useState, useEffect } from 'react'
import { Plus, Send, MessageCircle, X } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { channelsApi } from '@/lib/api'

interface Channel {
  id: string
  name: string
  type: 'telegram' | 'vk'
  channel_id: string
  is_connected: boolean
  isSelected: boolean
}

export function ChannelsSidebar() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // Load channels on mount
  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await channelsApi.list()
      setChannels(response.data.map((ch: any) => ({ ...ch, isSelected: true })))
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleChannel = (id: string) => {
    setChannels(channels.map(ch =>
      ch.id === id ? { ...ch, isSelected: !ch.isSelected } : ch
    ))
  }

  return (
    <div className="w-52 border-r border-border p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Каналы</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Channel type icons */}
      <div className="flex gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <Send className="w-4 h-4 text-blue-400" />
        </div>
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-sky-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="text-muted-foreground text-sm mb-4">
            Каналов пока нет
          </div>
          <p className="text-xs text-muted-foreground">
            Подключите социальные аккаунты, чтобы начать планировать и публиковать.
          </p>
          <Link
            href="/integrations"
            className="mt-4 px-4 py-2 btn-core text-white rounded-lg text-sm"
          >
            Добавить канал
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-2">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => toggleChannel(channel.id)}
              className={clsx(
                'w-full flex items-center gap-3 p-2 rounded-lg transition-all',
                channel.isSelected
                  ? 'bg-primary/20 text-foreground'
                  : 'hover:bg-secondary text-muted-foreground'
              )}
            >
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center',
                channel.isSelected ? 'bg-primary/20' : 'bg-secondary'
              )}>
                {channel.type === 'telegram' ? (
                  <Send className="w-4 h-4 text-blue-400" />
                ) : (
                  <MessageCircle className="w-4 h-4 text-sky-500" />
                )}
              </div>
              <span className="text-sm truncate flex-1 text-left">{channel.name}</span>
              {channel.isSelected && (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </button>
          ))}

          {/* Add more link */}
          <Link
            href="/integrations"
            className="w-full flex items-center gap-3 p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Добавить</span>
          </Link>
        </div>
      )}

      {/* Quick Add Modal */}
      {showAddModal && (
        <AddChannelModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}

function AddChannelModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-96 border border-border shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Добавить канал</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Link
            href="/integrations"
            onClick={onClose}
            className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <div className="font-medium">Telegram</div>
              <div className="text-xs text-muted-foreground">Канал или группа</div>
            </div>
          </Link>

          <Link
            href="/integrations"
            onClick={onClose}
            className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-sky-500" />
            </div>
            <div className="text-left">
              <div className="font-medium">VK</div>
              <div className="text-xs text-muted-foreground">Сообщество</div>
            </div>
          </Link>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
