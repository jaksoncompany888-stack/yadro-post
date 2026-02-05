'use client'

import { useState, useEffect } from 'react'
import { FileText, Clock, Trash2, Edit, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { postsApi } from '@/lib/api'
import { FormattedText } from '@/components/formatted-text'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Draft {
  id: number
  text: string
  topic?: string
  status: string
  created_at: string
  updated_at: string
  platforms: string[]
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadDrafts()
  }, [])

  const loadDrafts = async () => {
    try {
      const response = await postsApi.list({ status: 'draft' })
      setDrafts(response.data.items || [])
    } catch (err) {
      console.error('Failed to load drafts:', err)
    } finally {
      setLoading(false)
    }
  }

  const deleteDraft = async (id: number) => {
    if (!confirm('Удалить черновик?')) return

    setDeleting(id)
    try {
      await postsApi.delete(id)
      setDrafts(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error('Failed to delete draft:', err)
    } finally {
      setDeleting(null)
    }
  }

  const filteredDrafts = drafts.filter(draft => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      draft.text.toLowerCase().includes(searchLower) ||
      draft.topic?.toLowerCase().includes(searchLower)
    )
  })

  const platformColors: Record<string, string> = {
    telegram: 'bg-[#0088cc]',
    vk: 'bg-[#4a76a8]',
    instagram: 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]',
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Черновики</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {drafts.length} {drafts.length === 1 ? 'черновик' : drafts.length < 5 ? 'черновика' : 'черновиков'}
          </p>
        </div>

        <Link
          href="/create"
          className="px-4 py-2 btn-core text-white rounded-lg text-sm"
        >
          Новый пост
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Поиск черновиков..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {search ? 'Ничего не найдено' : 'Нет черновиков'}
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            {search
              ? 'Попробуйте изменить поисковый запрос'
              : 'Создайте новый пост и сохраните его как черновик'}
          </p>
          {!search && (
            <Link
              href="/create"
              className="px-6 py-3 btn-core text-white rounded-lg"
            >
              Создать пост
            </Link>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid gap-4">
            {filteredDrafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Topic */}
                    {draft.topic && (
                      <h3 className="font-medium mb-1 truncate">{draft.topic}</h3>
                    )}

                    {/* Text preview with formatting */}
                    <FormattedText
                      text={draft.text}
                      maxLines={2}
                      className="text-sm text-muted-foreground mb-3"
                    />

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(draft.updated_at), 'd MMM, HH:mm', { locale: ru })}
                      </span>

                      {/* Platforms */}
                      <div className="flex items-center gap-1">
                        {draft.platforms.map((platform) => (
                          <div
                            key={platform}
                            className={`w-4 h-4 rounded-full ${platformColors[platform] || 'bg-gray-500'}`}
                            title={platform}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions - always visible */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/create?edit=${draft.id}`}
                      className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-sm flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Редактировать
                    </Link>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      disabled={deleting === draft.id}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Удалить"
                    >
                      {deleting === draft.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
