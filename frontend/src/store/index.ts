import { create } from 'zustand'

interface Channel {
  id: string
  type: 'telegram' | 'vk'
  name: string
  channelId: string
  avatarUrl?: string
  isConnected: boolean
}

interface Post {
  id: string
  content: string
  channelIds: string[]
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduledAt?: string
  publishedAt?: string
  mediaUrls: string[]
}

interface User {
  id: string
  email: string
  name?: string
}

interface AppState {
  // User
  user: User | null
  setUser: (user: User | null) => void

  // Channels
  channels: Channel[]
  selectedChannelIds: string[]
  setChannels: (channels: Channel[]) => void
  toggleChannel: (channelId: string) => void
  selectAllChannels: () => void
  deselectAllChannels: () => void

  // Posts
  posts: Post[]
  setPosts: (posts: Post[]) => void
  addPost: (post: Post) => void
  updatePost: (id: string, updates: Partial<Post>) => void
  removePost: (id: string) => void

  // UI
  isSidebarOpen: boolean
  isAIAssistantOpen: boolean
  toggleSidebar: () => void
  toggleAIAssistant: () => void
}

export const useStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Channels
  channels: [],
  selectedChannelIds: [],
  setChannels: (channels) => set({ channels }),
  toggleChannel: (channelId) =>
    set((state) => ({
      selectedChannelIds: state.selectedChannelIds.includes(channelId)
        ? state.selectedChannelIds.filter((id) => id !== channelId)
        : [...state.selectedChannelIds, channelId],
    })),
  selectAllChannels: () =>
    set((state) => ({
      selectedChannelIds: state.channels.map((ch) => ch.id),
    })),
  deselectAllChannels: () => set({ selectedChannelIds: [] }),

  // Posts
  posts: [],
  setPosts: (posts) => set({ posts }),
  addPost: (post) => set((state) => ({ posts: [...state.posts, post] })),
  updatePost: (id, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removePost: (id) =>
    set((state) => ({
      posts: state.posts.filter((p) => p.id !== id),
    })),

  // UI
  isSidebarOpen: true,
  isAIAssistantOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleAIAssistant: () =>
    set((state) => ({ isAIAssistantOpen: !state.isAIAssistantOpen })),
}))
