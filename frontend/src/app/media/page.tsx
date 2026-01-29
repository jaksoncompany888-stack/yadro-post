'use client'

import { useState } from 'react'
import { Upload, Image, Film, FolderOpen, Plus, Search } from 'lucide-react'

export default function MediaPage() {
  const [files, setFiles] = useState<any[]>([])

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Медиа библиотека</h1>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Загрузить
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск файлов..."
            className="w-full bg-secondary rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select className="bg-secondary rounded-lg px-4 py-2">
          <option>Все файлы</option>
          <option>Изображения</option>
          <option>Видео</option>
        </select>
      </div>

      {/* Content */}
      {files.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Медиа библиотека пуста</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Загружайте изображения и видео для использования в постах. Поддерживаются форматы JPG, PNG, GIF, MP4.
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
              <Plus className="w-5 h-5" />
              Загрузить файлы
              <input type="file" className="hidden" multiple accept="image/*,video/*" />
            </label>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file, i) => (
            <div key={i} className="aspect-square bg-secondary rounded-lg overflow-hidden">
              <img src={file.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
