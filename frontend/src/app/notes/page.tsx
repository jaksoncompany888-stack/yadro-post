'use client'

import { useState, useEffect } from 'react'
import { StickyNote, Plus, Trash2, Pin, PinOff, Loader2, Search, X } from 'lucide-react'
import { notesApi } from '@/lib/api'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { clsx } from 'clsx'

interface Note {
  id: number
  title?: string
  content: string
  color: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

const NOTE_COLORS = [
  { name: 'default', bg: 'bg-card', border: 'border-border' },
  { name: 'yellow', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { name: 'green', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  { name: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { name: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { name: 'pink', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
]

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [saving, setSaving] = useState(false)

  // Editor state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('default')
  const [isPinned, setIsPinned] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    try {
      const response = await notesApi.list()
      setNotes(response.data.items || [])
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }

  const openEditor = (note?: Note) => {
    if (note) {
      setEditingNote(note)
      setTitle(note.title || '')
      setContent(note.content)
      setColor(note.color)
      setIsPinned(note.is_pinned)
    } else {
      setEditingNote(null)
      setTitle('')
      setContent('')
      setColor('default')
      setIsPinned(false)
    }
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingNote(null)
    setTitle('')
    setContent('')
    setColor('default')
    setIsPinned(false)
  }

  const saveNote = async () => {
    if (!content.trim()) return

    setSaving(true)
    try {
      if (editingNote) {
        const response = await notesApi.update(editingNote.id, {
          title: title || undefined,
          content,
          color,
          is_pinned: isPinned,
        })
        setNotes(prev =>
          prev.map(n => (n.id === editingNote.id ? response.data : n))
        )
      } else {
        const response = await notesApi.create({
          title: title || undefined,
          content,
          color,
          is_pinned: isPinned,
        })
        setNotes(prev => [response.data, ...prev])
      }
      closeEditor()
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: number) => {
    if (!confirm('Удалить заметку?')) return

    try {
      await notesApi.delete(id)
      setNotes(prev => prev.filter(n => n.id !== id))
      if (editingNote?.id === id) {
        closeEditor()
      }
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const togglePin = async (note: Note) => {
    try {
      const response = await notesApi.update(note.id, {
        is_pinned: !note.is_pinned,
      })
      setNotes(prev =>
        prev.map(n => (n.id === note.id ? response.data : n))
      )
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  const filteredNotes = notes.filter(note => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      note.content.toLowerCase().includes(searchLower) ||
      note.title?.toLowerCase().includes(searchLower)
    )
  })

  const pinnedNotes = filteredNotes.filter(n => n.is_pinned)
  const unpinnedNotes = filteredNotes.filter(n => !n.is_pinned)

  const getColorClasses = (colorName: string) => {
    const colorObj = NOTE_COLORS.find(c => c.name === colorName)
    return colorObj || NOTE_COLORS[0]
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Заметки</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {notes.length} {notes.length === 1 ? 'заметка' : notes.length < 5 ? 'заметки' : 'заметок'}
          </p>
        </div>

        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 px-4 py-2 btn-core text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Новая заметка
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Поиск заметок..."
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
      ) : filteredNotes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <StickyNote className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {search ? 'Ничего не найдено' : 'Нет заметок'}
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            {search
              ? 'Попробуйте изменить поисковый запрос'
              : 'Создайте свою первую заметку'}
          </p>
          {!search && (
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 px-6 py-3 btn-core text-white rounded-lg"
            >
              <Plus className="w-5 h-5" />
              Создать заметку
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Pinned notes */}
          {pinnedNotes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Pin className="w-4 h-4" />
                Закреплённые
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    colorClasses={getColorClasses(note.color)}
                    onEdit={() => openEditor(note)}
                    onDelete={() => deleteNote(note.id)}
                    onTogglePin={() => togglePin(note)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Остальные
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    colorClasses={getColorClasses(note.color)}
                    onEdit={() => openEditor(note)}
                    onDelete={() => deleteNote(note.id)}
                    onTogglePin={() => togglePin(note)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={clsx(
            'w-full max-w-lg rounded-xl border shadow-2xl',
            getColorClasses(color).bg,
            getColorClasses(color).border
          )}>
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold">
                {editingNote ? 'Редактировать заметку' : 'Новая заметка'}
              </h3>
              <button
                onClick={closeEditor}
                className="p-1 rounded hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <input
                type="text"
                placeholder="Заголовок (необязательно)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-lg font-medium focus:outline-none placeholder:text-muted-foreground/50"
              />

              <textarea
                placeholder="Текст заметки..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50"
                autoFocus
              />

              {/* Color picker */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Цвет:</span>
                <div className="flex gap-1">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColor(c.name)}
                      className={clsx(
                        'w-6 h-6 rounded-full border-2 transition-transform',
                        c.bg,
                        color === c.name ? 'scale-110 border-primary' : 'border-transparent hover:scale-105'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border/50 flex items-center justify-between">
              <button
                onClick={() => setIsPinned(!isPinned)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  isPinned ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'
                )}
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {isPinned ? 'Открепить' : 'Закрепить'}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={closeEditor}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={saveNote}
                  disabled={saving || !content.trim()}
                  className="px-4 py-2 btn-core text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Сохранить'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoteCard({
  note,
  colorClasses,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: Note
  colorClasses: { bg: string; border: string }
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  return (
    <div
      onClick={onEdit}
      className={clsx(
        'rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-shadow group',
        colorClasses.bg,
        colorClasses.border
      )}
    >
      {note.title && (
        <h3 className="font-medium mb-2 truncate">{note.title}</h3>
      )}

      <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
        {note.content}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {format(new Date(note.updated_at), 'd MMM', { locale: ru })}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin()
            }}
            className="p-1 rounded hover:bg-secondary"
            title={note.is_pinned ? 'Открепить' : 'Закрепить'}
          >
            {note.is_pinned ? (
              <PinOff className="w-4 h-4" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 rounded hover:bg-red-500/20 text-red-400"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
