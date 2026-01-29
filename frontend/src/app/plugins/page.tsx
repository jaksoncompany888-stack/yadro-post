'use client'

import { Puzzle, Sparkles, Image, Video, FileText, Zap } from 'lucide-react'

export default function PluginsPage() {
  const plugins = [
    {
      id: 'ai-generate',
      name: 'AI Генератор',
      description: 'Генерация текста постов с помощью Claude AI',
      icon: Sparkles,
      isActive: true,
      isBuiltIn: true,
    },
    {
      id: 'ai-images',
      name: 'AI Картинки',
      description: 'Генерация изображений для постов',
      icon: Image,
      isActive: false,
      isBuiltIn: false,
    },
    {
      id: 'ai-video',
      name: 'AI Видео',
      description: 'Создание коротких видео',
      icon: Video,
      isActive: false,
      isBuiltIn: false,
    },
    {
      id: 'auto-hashtags',
      name: 'Авто-хэштеги',
      description: 'Автоматический подбор хэштегов',
      icon: FileText,
      isActive: true,
      isBuiltIn: true,
    },
    {
      id: 'best-time',
      name: 'Лучшее время',
      description: 'Анализ лучшего времени для публикации',
      icon: Zap,
      isActive: true,
      isBuiltIn: true,
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Плагины</h1>
      <p className="text-muted-foreground mb-6">Расширьте функционал с помощью плагинов</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className="p-6 bg-card rounded-xl border border-border"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${plugin.isActive ? 'gradient-purple' : 'bg-secondary'} flex items-center justify-center`}>
                <plugin.icon className={`w-6 h-6 ${plugin.isActive ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              {plugin.isBuiltIn && (
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Встроенный</span>
              )}
            </div>

            <h3 className="font-medium mb-1">{plugin.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{plugin.description}</p>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                defaultChecked={plugin.isActive}
                disabled={plugin.isBuiltIn}
              />
              <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-disabled:opacity-50"></div>
              <span className="ml-3 text-sm">{plugin.isActive ? 'Включено' : 'Выключено'}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
