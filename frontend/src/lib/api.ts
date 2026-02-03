import axios from 'axios'

// Используем относительные пути - nginx проксирует на backend
export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// API methods
export const postsApi = {
  list: (params?: { status?: string }) => api.get('/api/posts', { params }),
  get: (id: number) => api.get(`/api/posts/${id}`),
  create: (data: any) => api.post('/api/posts', data),
  update: (id: number, data: any) => api.patch(`/api/posts/${id}`, data),
  delete: (id: number) => api.delete(`/api/posts/${id}`),
  publish: (id: number) => api.post(`/api/posts/${id}/publish`),
}

// Заметки
export const notesApi = {
  list: (params?: { search?: string; pinned_only?: boolean }) =>
    api.get('/api/notes', { params }),
  get: (id: number) => api.get(`/api/notes/${id}`),
  create: (data: { title?: string; content: string; color?: string; is_pinned?: boolean }) =>
    api.post('/api/notes', data),
  update: (id: number, data: { title?: string; content?: string; color?: string; is_pinned?: boolean }) =>
    api.patch(`/api/notes/${id}`, data),
  delete: (id: number) => api.delete(`/api/notes/${id}`),
}

// Анализ конкурентов
export const channelsApi = {
  list: () => api.get('/api/channels'),
  get: (id: string) => api.get(`/api/channels/${id}`),
  create: (data: any) => api.post('/api/channels', data),
  delete: (id: string) => api.delete(`/api/channels/${id}`),
  analyze: (channel: string, limit?: number) =>
    api.post('/api/channels/analyze', { channel, limit: limit || 10 }),
  add: (channel: string) => api.post('/api/channels/add', { channel }),
  remove: (username: string) => api.delete(`/api/channels/${username}`),
}

// Мои каналы для постинга
export const userChannelsApi = {
  list: () => api.get('/api/user-channels'),
  add: (channelId: string, platform: string = 'telegram') =>
    api.post('/api/user-channels/add', { channel_id: channelId, platform }),
  remove: (channelId: string) => api.delete(`/api/user-channels/${encodeURIComponent(channelId)}`),
  validate: (channelId: string, platform: string = 'telegram') =>
    api.post('/api/user-channels/validate', { channel_id: channelId, platform }),
}

export const calendarApi = {
  get: (view: string, date?: string) =>
    api.get('/api/calendar', { params: { view, date } }),
  getSlots: (date: string, channelIds: string[]) =>
    api.get('/api/calendar/slots', { params: { date, channel_ids: channelIds } }),
}

export const aiApi = {
  // Используем yadro-smm API
  generate: (data: {
    topic: string
    platform?: string
    style?: string
    language?: string
  }) => api.post('/api/posts/generate', { topic: data.topic }),
  edit: (data: { content: string; instruction: string }) =>
    api.post('/api/posts/edit', { text: data.content, instruction: data.instruction }),
  chat: (messages: { role: string; content: string }[], context?: string) =>
    api.post('/api/posts/generate', { topic: messages[messages.length - 1]?.content || '' }),
}

export const authApi = {
  // Email registration
  register: (data: {
    email: string
    password: string
    first_name: string
    last_name?: string
  }) => api.post('/api/auth/register', data),

  // Email login
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),

  // Telegram Login Widget
  telegramLogin: (data: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
  }) => api.post('/api/auth/telegram/login', data),

  // Get Telegram widget config
  getTelegramConfig: () => api.get('/api/auth/telegram/config'),

  // Get current user from token
  me: () => {
    const token = localStorage.getItem('token')
    return api.get('/api/auth/me', { params: { token } })
  },

  // Refresh token
  refresh: () => {
    const token = localStorage.getItem('token')
    return api.post('/api/auth/refresh', null, { params: { token } })
  },

  // Verify channel subscription
  verifySubscription: () => {
    const token = localStorage.getItem('token')
    return api.post('/api/auth/verify-subscription', null, { params: { token } })
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return api.post('/api/auth/logout')
  },
}

// Users API (роли и управление пользователями)
export const usersApi = {
  me: () => api.get('/api/users/me'),
  list: (params?: { limit?: number; offset?: number }) =>
    api.get('/api/users', { params }),
  updateRole: (userId: number, role: string) =>
    api.put(`/api/users/${userId}/role`, { role }),
  activate: (userId: number) =>
    api.put(`/api/users/${userId}/activate`),
  deactivate: (userId: number) =>
    api.put(`/api/users/${userId}/deactivate`),
}

// Черновики
export const draftsApi = {
  list: () => api.get('/api/posts', { params: { status: 'draft' } }),
  create: (data: { text: string; topic?: string }) =>
    api.post('/api/posts', { ...data, status: 'draft' }),
}

// Ресурсы пользователя (свой канал + конкуренты)
export const resourcesApi = {
  // Сводка
  summary: () => api.get('/api/resources/summary'),

  // Мой канал
  getMyChannel: () => api.get('/api/resources/my-channel'),
  setMyChannel: (channel: string) =>
    api.post('/api/resources/my-channel', { channel }),
  analyzeMyChannel: () => api.post('/api/resources/my-channel/analyze'),

  // Конкуренты
  listCompetitors: () => api.get('/api/resources/competitors'),
  addCompetitor: (channel: string, autoAnalyze: boolean = true) =>
    api.post('/api/resources/competitors', { channel, auto_analyze: autoAnalyze }),
  removeCompetitor: (id: number) => api.delete(`/api/resources/competitors/${id}`),
  analyzeCompetitor: (id: number) =>
    api.post(`/api/resources/competitors/${id}/analyze`),
}
