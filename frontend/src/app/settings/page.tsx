'use client'

import { useState } from 'react'
import { User, Bell, Globe, Palette } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'language', label: 'Язык', icon: Globe },
    { id: 'appearance', label: 'Внешний вид', icon: Palette },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Настройки</h1>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary/20 text-primary'
                  : 'hover:bg-secondary text-muted-foreground'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-card rounded-xl border border-border p-6">
          {activeTab === 'profile' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Профиль</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Имя</label>
                  <input
                    type="text"
                    defaultValue="User"
                    className="w-full bg-secondary rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Email</label>
                  <input
                    type="email"
                    defaultValue="user@example.com"
                    className="w-full bg-secondary rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Сохранить
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Уведомления</h2>
              <div className="space-y-4">
                {[
                  { label: 'Успешная публикация', desc: 'Уведомлять о успешных публикациях' },
                  { label: 'Ошибки публикации', desc: 'Уведомлять об ошибках при публикации' },
                  { label: 'Напоминания', desc: 'Напоминать о запланированных постах' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Язык интерфейса</h2>
              <select className="w-full max-w-xs bg-secondary rounded-lg px-4 py-2">
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Внешний вид</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Тема</label>
                  <div className="flex gap-4">
                    <button className="px-6 py-3 bg-primary/20 text-primary rounded-lg border-2 border-primary">
                      Тёмная
                    </button>
                    <button className="px-6 py-3 bg-secondary rounded-lg border-2 border-transparent">
                      Светлая
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
