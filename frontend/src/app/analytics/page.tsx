'use client'

import { BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle } from 'lucide-react'

export default function AnalyticsPage() {
  const stats = [
    { label: 'Всего постов', value: '0', icon: BarChart3, change: '+0%' },
    { label: 'Просмотры', value: '0', icon: Eye, change: '+0%' },
    { label: 'Подписчики', value: '0', icon: Users, change: '+0%' },
    { label: 'Вовлечённость', value: '0%', icon: Heart, change: '+0%' },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Аналитика</h1>
        <select className="bg-secondary rounded-lg px-4 py-2 text-sm">
          <option>Последние 7 дней</option>
          <option>Последние 30 дней</option>
          <option>Последние 90 дней</option>
        </select>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-green-500">{stat.change}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Нет данных для отображения</h3>
        <p className="text-muted-foreground mb-4">
          Подключите каналы и начните публиковать посты, чтобы видеть аналитику
        </p>
        <a
          href="/create"
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Создать пост
        </a>
      </div>
    </div>
  )
}
