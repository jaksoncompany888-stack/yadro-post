'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Target,
  Loader2,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import { userChannelsApi, analyticsApi } from '@/lib/api'

// API response types
interface OverviewStats {
  total_posts: number
  draft_posts: number
  scheduled_posts: number
  published_posts: number
  error_posts: number
  channels_count: number
}

interface ApiChannelStats {
  channel_id: string
  name: string
  platform: string
  total_posts: number
  draft_posts: number
  scheduled_posts: number
  published_posts: number
}

interface DailyStats {
  date: string
  posts_created: number
  posts_published: number
}

interface ApiPostStats {
  id: number
  text_preview: string
  channel_id: string | null
  status: string
  created_at: string
  publish_at: string | null
}

// Legacy interface for UI compatibility (with mock engagement data)
interface ChannelStats {
  channel_id: string
  name: string
  platform: string
  subscribers: number
  subscribersGrowth: number
  totalViews: number
  viewsGrowth: number
  reach: number
  reachGrowth: number
  engagementRate: number
  erGrowth: number
  posts: number
  likes: number
  comments: number
  shares: number
}

interface PostStats {
  id: number
  title: string
  platform: string
  channelName: string
  date: string
  reach: number
  views: number
  er: number
  likes: number
  comments: number
  shares: number
}

// Mock data generator for demo purposes
const generateMockStats = (channels: any[]): ChannelStats[] => {
  return channels.map(ch => ({
    channel_id: ch.channel_id,
    name: ch.name,
    platform: ch.platform,
    subscribers: ch.subscribers || Math.floor(Math.random() * 10000) + 1000,
    subscribersGrowth: Math.floor(Math.random() * 20) - 5,
    totalViews: Math.floor(Math.random() * 50000) + 5000,
    viewsGrowth: Math.floor(Math.random() * 30) - 10,
    reach: Math.floor(Math.random() * 30000) + 3000,
    reachGrowth: Math.floor(Math.random() * 25) - 8,
    engagementRate: parseFloat((Math.random() * 8 + 1).toFixed(2)),
    erGrowth: parseFloat((Math.random() * 3 - 1).toFixed(2)),
    posts: Math.floor(Math.random() * 30) + 5,
    likes: Math.floor(Math.random() * 5000) + 500,
    comments: Math.floor(Math.random() * 500) + 50,
    shares: Math.floor(Math.random() * 200) + 20,
  }))
}

// Mock posts generator for top/anti-top lists
const generateMockPosts = (channels: any[]): PostStats[] => {
  const posts: PostStats[] = []
  const titles = [
    'Как увеличить охваты в 2 раза',
    'Топ-5 ошибок начинающих',
    'Секреты вирального контента',
    'Анонс нового продукта',
    'Отзыв клиента о сервисе',
    'Инструкция по применению',
    'Закулисье работы команды',
    'Ответы на вопросы подписчиков',
    'Сравнение продуктов',
    'История успеха клиента',
    'Новости индустрии',
    'Полезные лайфхаки',
    'Обзор функционала',
    'Интервью с экспертом',
    'Результаты опроса',
  ]

  channels.forEach(ch => {
    const postCount = Math.floor(Math.random() * 8) + 3
    for (let i = 0; i < postCount; i++) {
      const reach = Math.floor(Math.random() * 15000) + 500
      const views = reach + Math.floor(Math.random() * 5000)
      const likes = Math.floor(Math.random() * reach * 0.1)
      const comments = Math.floor(Math.random() * likes * 0.2)
      const shares = Math.floor(Math.random() * likes * 0.1)
      const er = parseFloat(((likes + comments + shares) / reach * 100).toFixed(2))

      posts.push({
        id: posts.length + 1,
        title: titles[Math.floor(Math.random() * titles.length)],
        platform: ch.platform,
        channelName: ch.name,
        date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reach,
        views,
        er,
        likes,
        comments,
        shares,
      })
    }
  })

  return posts
}

// Simple bar chart component
function SimpleBarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1)

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-24">
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-colors relative group"
            style={{ height: `${(value / max) * 100}%`, minHeight: '4px' }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  )
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  telegram: 'bg-[#0088cc]',
  vk: 'bg-[#4a76a8]',
  instagram: 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]',
  tiktok: 'bg-black',
  youtube: 'bg-[#ff0000]',
  facebook: 'bg-[#1877f2]',
  ok: 'bg-[#ee8208]',
}

const PLATFORM_ICONS: Record<string, string> = {
  telegram: '✈️',
  vk: '💙',
  instagram: '📸',
  tiktok: '🎵',
  youtube: '▶️',
  facebook: '👍',
  ok: '🟠',
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<any[]>([])
  const [stats, setStats] = useState<ChannelStats[]>([])
  const [posts, setPosts] = useState<PostStats[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [period, setPeriod] = useState('30d')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [dailyData, setDailyData] = useState<DailyStats[]>([])

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    try {
      // Load user channels for display
      const channelsResponse = await userChannelsApi.list()
      const channelData = channelsResponse.data || []
      setChannels(channelData)

      // Load real analytics from API
      const analyticsResponse = await analyticsApi.get(period)
      const analytics = analyticsResponse.data

      // Convert API channel stats to UI format (with mock engagement data for now)
      const channelStats: ChannelStats[] = (analytics.channels || []).map((ch: ApiChannelStats) => ({
        channel_id: ch.channel_id,
        name: ch.name,
        platform: ch.platform,
        subscribers: channelData.find((c: any) => c.channel_id === ch.channel_id)?.subscribers || 0,
        subscribersGrowth: 0, // Not tracked yet
        totalViews: 0, // Not tracked yet
        viewsGrowth: 0,
        reach: 0, // Not tracked yet
        reachGrowth: 0,
        engagementRate: 0, // Not tracked yet
        erGrowth: 0,
        posts: ch.total_posts,
        likes: 0, // Not tracked yet
        comments: 0,
        shares: 0,
      }))
      setStats(channelStats)

      // Convert API posts to UI format
      const postStats: PostStats[] = (analytics.recent_posts || []).map((p: ApiPostStats) => {
        const channel = channelData.find((c: any) => c.channel_id === p.channel_id)
        return {
          id: p.id,
          title: p.text_preview || 'Без заголовка',
          platform: channel?.platform || 'telegram',
          channelName: channel?.name || p.channel_id || 'Не указан',
          date: p.created_at?.split('T')[0] || '',
          reach: 0, // Not tracked yet
          views: 0,
          er: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        }
      })
      setPosts(postStats)

      // Store overview for display
      setOverview(analytics.overview)
      setDailyData(analytics.daily || [])
    } catch (err) {
      console.error('Failed to load analytics:', err)
      // Fallback to mock data on error
      setStats(generateMockStats(channels))
      setPosts(generateMockPosts(channels))
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const formatGrowth = (value: number) => {
    const isPositive = value > 0
    return (
      <span className={clsx(
        'flex items-center gap-1 text-sm',
        isPositive ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-muted-foreground'
      )}>
        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : value < 0 ? <ArrowDownRight className="w-4 h-4" /> : null}
        {isPositive ? '+' : ''}{value}%
      </span>
    )
  }

  // Aggregate stats for "all" view
  const aggregatedStats = {
    subscribers: stats.reduce((sum, s) => sum + s.subscribers, 0),
    subscribersGrowth: stats.length > 0 ? parseFloat((stats.reduce((sum, s) => sum + s.subscribersGrowth, 0) / stats.length).toFixed(1)) : 0,
    totalViews: stats.reduce((sum, s) => sum + s.totalViews, 0),
    viewsGrowth: stats.length > 0 ? parseFloat((stats.reduce((sum, s) => sum + s.viewsGrowth, 0) / stats.length).toFixed(1)) : 0,
    reach: stats.reduce((sum, s) => sum + s.reach, 0),
    reachGrowth: stats.length > 0 ? parseFloat((stats.reduce((sum, s) => sum + s.reachGrowth, 0) / stats.length).toFixed(1)) : 0,
    engagementRate: stats.length > 0 ? parseFloat((stats.reduce((sum, s) => sum + s.engagementRate, 0) / stats.length).toFixed(2)) : 0,
    erGrowth: stats.length > 0 ? parseFloat((stats.reduce((sum, s) => sum + s.erGrowth, 0) / stats.length).toFixed(2)) : 0,
    posts: stats.reduce((sum, s) => sum + s.posts, 0),
    likes: stats.reduce((sum, s) => sum + s.likes, 0),
    comments: stats.reduce((sum, s) => sum + s.comments, 0),
    shares: stats.reduce((sum, s) => sum + s.shares, 0),
  }

  const currentStats = selectedChannel === 'all'
    ? aggregatedStats
    : stats.find(s => s.channel_id === selectedChannel) || aggregatedStats

  // Calculate avg reach per post
  const avgReachPerPost = currentStats.posts > 0
    ? Math.round(currentStats.reach / currentStats.posts)
    : 0

  // Filter posts by selected channel
  const filteredPosts = selectedChannel === 'all'
    ? posts
    : posts.filter(p => channels.find(ch => ch.channel_id === selectedChannel && ch.name === p.channelName))

  // Top-10 by reach
  const topByReach = [...filteredPosts]
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 10)

  // Top-10 by ER
  const topByER = [...filteredPosts]
    .sort((a, b) => b.er - a.er)
    .slice(0, 10)

  // Anti-top (lowest ER, min 100 reach to exclude empty posts)
  const antiTop = [...filteredPosts]
    .filter(p => p.reach >= 100)
    .sort((a, b) => a.er - b.er)
    .slice(0, 10)

  // Chart data from real daily stats (or empty array)
  const sortedDaily = [...dailyData].sort((a, b) => a.date.localeCompare(b.date)).slice(-7)
  const dailyCreated = sortedDaily.map(d => d.posts_created)
  const dailyPublished = sortedDaily.map(d => d.posts_published)
  // Labels for chart
  const chartLabels = sortedDaily.map(d => {
    const date = new Date(d.date)
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()]
  }).join(' ')

  const periods = [
    { value: '7d', label: 'Последние 7 дней' },
    { value: '30d', label: 'Последние 30 дней' },
    { value: '90d', label: 'Последние 90 дней' },
  ]

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Аналитика</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Статистика по вашим ресурсам
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Channel filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-secondary rounded-lg px-4 py-2 text-sm"
          >
            <option value="all">Все ресурсы</option>
            {channels.map(ch => (
              <option key={ch.channel_id} value={ch.channel_id}>
                {ch.name}
              </option>
            ))}
          </select>

          {/* Period selector */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="bg-secondary rounded-lg px-4 py-2 text-sm flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              {periods.find(p => p.value === period)?.label}
              <ChevronDown className="w-4 h-4" />
            </button>

            {showPeriodDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPeriodDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-xl z-20 py-1 w-48">
                  {periods.map(p => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setPeriod(p.value)
                        setShowPeriodDropdown(false)
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors',
                        period === p.value && 'bg-primary/10 text-primary'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {channels.length === 0 ? (
        /* Empty state */
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
      ) : (
        <>
          {/* Main stats grid - using real data from API */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Total Posts */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{overview?.total_posts || 0}</div>
              <div className="text-sm text-muted-foreground">Всего постов</div>
            </div>

            {/* Draft Posts */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{overview?.draft_posts || 0}</div>
              <div className="text-sm text-muted-foreground">Черновики</div>
            </div>

            {/* Scheduled Posts */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{overview?.scheduled_posts || 0}</div>
              <div className="text-sm text-muted-foreground">Запланировано</div>
            </div>

            {/* Published Posts */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{overview?.published_posts || 0}</div>
              <div className="text-sm text-muted-foreground">Опубликовано</div>
            </div>

            {/* Channels Count */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{overview?.channels_count || 0}</div>
              <div className="text-sm text-muted-foreground">Каналов</div>
            </div>
          </div>

          {/* Charts row - real data from API */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-medium mb-4">Создано постов за период</h3>
              {dailyCreated.length > 0 ? (
                <SimpleBarChart data={dailyCreated} label={chartLabels || 'Нет данных'} />
              ) : (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                  Нет данных за выбранный период
                </div>
              )}
            </div>
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-medium mb-4">Опубликовано за период</h3>
              {dailyPublished.length > 0 ? (
                <SimpleBarChart data={dailyPublished} label={chartLabels || 'Нет данных'} />
              ) : (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                  Нет данных за выбранный период
                </div>
              )}
            </div>
          </div>

          {/* Engagement breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Engagement metrics */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-medium mb-4">Детализация вовлечённости</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium">Лайки</div>
                      <div className="text-sm text-muted-foreground">Реакции на посты</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold">{formatNumber(currentStats.likes)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium">Комментарии</div>
                      <div className="text-sm text-muted-foreground">Ответы аудитории</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold">{formatNumber(currentStats.comments)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="font-medium">Репосты</div>
                      <div className="text-sm text-muted-foreground">Распространение контента</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold">{formatNumber(currentStats.shares)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="font-medium">Публикации</div>
                      <div className="text-sm text-muted-foreground">Всего за период</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold">{currentStats.posts}</div>
                </div>
              </div>
            </div>

            {/* Per-channel stats */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-medium mb-4">Статистика по ресурсам</h3>
              <div className="space-y-3">
                {stats.map(channelStat => (
                  <div
                    key={channelStat.channel_id}
                    className={clsx(
                      'p-3 rounded-lg border transition-colors cursor-pointer',
                      selectedChannel === channelStat.channel_id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => setSelectedChannel(channelStat.channel_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm',
                          PLATFORM_COLORS[channelStat.platform] || 'bg-gray-500'
                        )}>
                          {PLATFORM_ICONS[channelStat.platform] || '📱'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{channelStat.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(channelStat.subscribers)} подписчиков
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{channelStat.engagementRate}% ER</div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(channelStat.reach)} охват
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top posts sections */}
          {filteredPosts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Top-10 by Reach */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <h3 className="font-medium">Топ-10 по охвату</h3>
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {topByReach.map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{post.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={clsx(
                            'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                            PLATFORM_COLORS[post.platform] || 'bg-gray-500'
                          )}>
                            {PLATFORM_ICONS[post.platform]}
                          </span>
                          <span>{post.date}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-blue-500">{formatNumber(post.reach)}</div>
                        <div className="text-xs text-muted-foreground">охват</div>
                      </div>
                    </div>
                  ))}
                  {topByReach.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Нет данных
                    </div>
                  )}
                </div>
              </div>

              {/* Top-10 by ER */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="w-5 h-5 text-pink-500" />
                  <h3 className="font-medium">Топ-10 по ER</h3>
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {topByER.map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{post.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={clsx(
                            'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                            PLATFORM_COLORS[post.platform] || 'bg-gray-500'
                          )}>
                            {PLATFORM_ICONS[post.platform]}
                          </span>
                          <span>{formatNumber(post.reach)} охват</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-pink-500">{post.er}%</div>
                        <div className="text-xs text-muted-foreground">ER</div>
                      </div>
                    </div>
                  ))}
                  {topByER.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Нет данных
                    </div>
                  )}
                </div>
              </div>

              {/* Anti-top (failed posts) */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  <h3 className="font-medium">Анти-топ (провальные)</h3>
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {antiTop.map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{post.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={clsx(
                            'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                            PLATFORM_COLORS[post.platform] || 'bg-gray-500'
                          )}>
                            {PLATFORM_ICONS[post.platform]}
                          </span>
                          <span>{formatNumber(post.reach)} охват</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-red-500">{post.er}%</div>
                        <div className="text-xs text-muted-foreground">ER</div>
                      </div>
                    </div>
                  ))}
                  {antiTop.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Нет данных
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ER/Reach ratio explanation */}
          <div className="bg-card rounded-xl p-6 border border-border">
            <h3 className="font-medium mb-4">Ключевые метрики</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="font-medium">Reach (Охват)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Количество уникальных пользователей, которые увидели ваш контент. Показывает реальный размер аудитории.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-primary" />
                  <span className="font-medium">ER (Engagement Rate)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Процент вовлечённости = (лайки + комментарии + репосты) / охват × 100%. Показывает активность аудитории.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="font-medium">ER/Reach Ratio</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Соотношение вовлечённости к охвату. Хороший показатель: ER &gt; 3% для небольших аккаунтов, &gt; 1% для крупных.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
