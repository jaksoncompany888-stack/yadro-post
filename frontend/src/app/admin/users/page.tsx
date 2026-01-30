'use client'

import { useState, useEffect } from 'react'
import { Users, Shield, ShieldCheck, User, Loader2, AlertCircle } from 'lucide-react'
import { usersApi } from '@/lib/api'
import { clsx } from 'clsx'

interface UserData {
  id: number
  tg_id: number
  username: string | null
  role: string
  is_active: boolean
}

const ROLE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  admin: { label: 'Администратор', icon: ShieldCheck, color: 'text-red-500' },
  smm: { label: 'SMM-менеджер', icon: Shield, color: 'text-yellow-500' },
  user: { label: 'Пользователь', icon: User, color: 'text-muted-foreground' },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('user')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  useEffect(() => {
    loadUsers()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const res = await usersApi.me()
      setCurrentUserRole(res.data.role || 'user')
    } catch {
      setCurrentUserRole('user')
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await usersApi.list({ limit: 100 })
      setUsers(res.data.users)
      setError(null)
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Доступ запрещён. Требуется роль Admin или SMM.')
      } else {
        setError('Ошибка загрузки пользователей')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (currentUserRole !== 'admin') {
      alert('Только администратор может менять роли')
      return
    }

    try {
      setUpdatingId(userId)
      await usersApi.updateRole(userId, newRole)
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка изменения роли')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    if (currentUserRole !== 'admin') {
      alert('Только администратор может активировать/деактивировать пользователей')
      return
    }

    try {
      setUpdatingId(userId)
      if (isActive) {
        await usersApi.deactivate(userId)
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: false } : u))
      } else {
        await usersApi.activate(userId)
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: true } : u))
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-red-500">Ошибка</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Управление пользователями</h1>
          <p className="text-muted-foreground">
            {currentUserRole === 'admin' ? 'Вы можете менять роли и статус' : 'Только просмотр'}
          </p>
        </div>
      </div>

      {/* Role Legend */}
      <div className="flex gap-4 mb-6">
        {Object.entries(ROLE_LABELS).map(([role, { label, icon: Icon, color }]) => (
          <div key={role} className="flex items-center gap-2 text-sm">
            <Icon className={clsx('w-4 h-4', color)} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground">ID</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Telegram</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Username</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Роль</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Статус</th>
              {currentUserRole === 'admin' && (
                <th className="text-left p-4 font-medium text-muted-foreground">Действия</th>
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.user
              const RoleIcon = roleInfo.icon
              const isUpdating = updatingId === user.id

              return (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="p-4">{user.id}</td>
                  <td className="p-4">{user.tg_id}</td>
                  <td className="p-4">
                    {user.username ? `@${user.username}` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <RoleIcon className={clsx('w-4 h-4', roleInfo.color)} />
                      <span>{roleInfo.label}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs',
                      user.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                    )}>
                      {user.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  {currentUserRole === 'admin' && (
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="bg-secondary border border-border rounded px-2 py-1 text-sm"
                            >
                              <option value="user">Пользователь</option>
                              <option value="smm">SMM</option>
                              <option value="admin">Админ</option>
                            </select>
                            <button
                              onClick={() => handleToggleActive(user.id, user.is_active)}
                              className={clsx(
                                'px-3 py-1 rounded text-xs',
                                user.is_active
                                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                                  : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                              )}
                            >
                              {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Пользователи не найдены
          </div>
        )}
      </div>

      {/* Info for SMM users */}
      {currentUserRole === 'smm' && (
        <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-500 text-sm">
            Вы можете просматривать пользователей, но не можете менять их роли или статус.
            Для изменений обратитесь к администратору.
          </p>
        </div>
      )}
    </div>
  )
}
