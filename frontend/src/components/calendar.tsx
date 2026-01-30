'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle, AlertCircle, FileText, StickyNote, Filter } from 'lucide-react'
import { clsx } from 'clsx'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type ViewType = 'day' | 'week' | 'month'

interface Post {
  id: number
  text: string
  topic?: string
  status: 'draft' | 'scheduled' | 'published' | 'error'
  publish_at: string | null
  created_at: string
  platforms: string[]
}

interface CalendarDay {
  date: string
  posts: Post[]
  count: number
}

interface CalendarData {
  start_date: string
  end_date: string
  days: CalendarDay[]
  total_posts: number
}

// Все платформы с цветами
const PLATFORMS = [
  { id: 'all', name: 'Все', color: 'bg-gray-500' },
  { id: 'telegram', name: 'Telegram', color: 'bg-[#0088cc]' },
  { id: 'vk', name: 'VK', color: 'bg-[#4a76a8]' },
  { id: 'instagram', name: 'Instagram', color: 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]' },
  { id: 'tiktok', name: 'TikTok', color: 'bg-black' },
  { id: 'youtube', name: 'YouTube', color: 'bg-[#ff0000]' },
  { id: 'facebook', name: 'Facebook', color: 'bg-[#1877f2]' },
  { id: 'ok', name: 'OK', color: 'bg-[#ee8208]' },
]

const hours = Array.from({ length: 24 }, (_, i) => i)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showCreateMenu, setShowCreateMenu] = useState<{ date: Date; hour?: number } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Для месячного вида
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Добавляем дни предыдущего месяца для заполнения первой недели
  const firstDayOfWeek = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  const prevMonthDays = Array.from({ length: firstDayOfWeek }, (_, i) =>
    subDays(monthStart, firstDayOfWeek - i)
  )

  // Добавляем дни следующего месяца для заполнения последней недели
  const totalDays = prevMonthDays.length + monthDays.length
  const nextMonthDaysCount = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7)
  const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) =>
    addDays(monthEnd, i + 1)
  )

  const allMonthDays = [...prevMonthDays, ...monthDays, ...nextMonthDays]

  // Слушаем параметр refresh для обновления после создания поста
  useEffect(() => {
    const refresh = searchParams.get('refresh')
    if (refresh) {
      setRefreshKey(Date.now())
      // Очищаем URL от параметра refresh
      router.replace('/', { scroll: false })
    }
  }, [searchParams, router])

  // Загрузка постов при изменении даты или вида
  useEffect(() => {
    const fetchCalendarData = async () => {
      setLoading(true)
      try {
        let startDate: string
        let endDate: string

        if (view === 'day') {
          startDate = format(currentDate, 'yyyy-MM-dd')
          endDate = startDate
        } else if (view === 'week') {
          startDate = format(weekStart, 'yyyy-MM-dd')
          endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')
        } else {
          startDate = format(allMonthDays[0], 'yyyy-MM-dd')
          endDate = format(allMonthDays[allMonthDays.length - 1], 'yyyy-MM-dd')
        }

        const response = await fetch(
          `${API_URL}/api/calendar?start_date=${startDate}&end_date=${endDate}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        )

        if (response.ok) {
          const data = await response.json()
          setCalendarData(data)
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarData()
  }, [currentDate, view, refreshKey])

  // Получить посты для конкретной даты с фильтрацией
  const getPostsForDate = (date: Date): Post[] => {
    if (!calendarData || !calendarData.days) return []
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayData = calendarData.days.find(d => d.date === dateStr)
    let posts = dayData?.posts || []

    // Фильтр по платформе
    if (platformFilter !== 'all') {
      posts = posts.filter(post => post.platforms.includes(platformFilter))
    }

    return posts
  }

  // Получить посты для конкретного времени
  const getPostsForTime = (date: Date, hour: number): Post[] => {
    const posts = getPostsForDate(date)
    return posts.filter(post => {
      if (!post.publish_at) return false
      const postHour = new Date(post.publish_at).getHours()
      return postHour === hour
    })
  }

  const goToPrev = () => {
    if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1))
    } else if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === 'day') {
      setCurrentDate(subDays(currentDate, 1))
    }
  }

  const goToNext = () => {
    if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1))
    } else if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === 'day') {
      setCurrentDate(addDays(currentDate, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleCellClick = (date: Date, hour?: number) => {
    setShowCreateMenu({ date, hour })
  }

  const handleCreatePost = () => {
    if (!showCreateMenu) return
    const dateStr = format(showCreateMenu.date, 'yyyy-MM-dd')
    const timeStr = showCreateMenu.hour !== undefined ? `&time=${showCreateMenu.hour.toString().padStart(2, '0')}:00` : ''
    router.push(`/create?date=${dateStr}${timeStr}`)
    setShowCreateMenu(null)
  }

  const handleCreateNote = () => {
    if (!showCreateMenu) return
    const dateStr = format(showCreateMenu.date, 'yyyy-MM-dd')
    router.push(`/notes?new=true&date=${dateStr}`)
    setShowCreateMenu(null)
  }

  const getDateRangeText = () => {
    if (view === 'day') {
      return format(currentDate, 'd MMMM yyyy', { locale: ru })
    } else if (view === 'week') {
      return `${format(weekStart, 'd MMMM', { locale: ru })} - ${format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: ru })}`
    } else {
      return format(currentDate, 'LLLL yyyy', { locale: ru })
    }
  }

  // Цвета платформ для карточек
  const platformColors: Record<string, string> = {
    telegram: 'bg-[#0088cc]/20 text-[#0088cc] border-[#0088cc]/30',
    vk: 'bg-[#4a76a8]/20 text-[#4a76a8] border-[#4a76a8]/30',
    instagram: 'bg-gradient-to-r from-[#833ab4]/20 via-[#fd1d1d]/20 to-[#fcb045]/20 text-[#e1306c] border-[#e1306c]/30',
    tiktok: 'bg-black/20 text-white border-black/30',
    youtube: 'bg-[#ff0000]/20 text-[#ff0000] border-[#ff0000]/30',
    facebook: 'bg-[#1877f2]/20 text-[#1877f2] border-[#1877f2]/30',
    ok: 'bg-[#ee8208]/20 text-[#ee8208] border-[#ee8208]/30',
  }

  // Иконки статусов
  const statusIcons: Record<string, React.ReactNode> = {
    draft: <FileText className="w-3 h-3 text-gray-400" />,
    scheduled: <Clock className="w-3 h-3 text-blue-400" />,
    published: <CheckCircle className="w-3 h-3 text-green-400" />,
    error: <AlertCircle className="w-3 h-3 text-red-400" />,
  }

  // Компонент для отображения поста
  const PostCard = ({ post }: { post: Post }) => {
    const mainPlatform = post.platforms[0] || 'telegram'
    const colorClass = platformColors[mainPlatform] || platformColors.telegram

    return (
      <Link
        href={`/create?edit=${post.id}`}
        className={clsx(
          'block px-2 py-1 rounded text-xs truncate border cursor-pointer hover:opacity-80 transition-opacity',
          colorClass
        )}
        title={post.text}
      >
        <span className="flex items-center gap-1">
          {statusIcons[post.status]}
          <span className="truncate">{post.topic || post.text.slice(0, 30)}</span>
          {post.platforms.length > 1 && (
            <span className="text-[10px] opacity-60">+{post.platforms.length - 1}</span>
          )}
        </span>
      </Link>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Календарь</h1>

          <div className="flex items-center gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrev}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm min-w-[200px] text-center">
                {getDateRangeText()}
              </span>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Today button */}
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Сегодня
            </button>

            {/* View switcher */}
            <div className="flex bg-secondary rounded-lg p-1">
              {(['day', 'week', 'month'] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'px-4 py-1.5 text-sm rounded-md transition-colors',
                    view === v
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Platform filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setPlatformFilter(platform.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all',
                  platformFilter === platform.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {platform.id !== 'all' && (
                  <div className={clsx('w-3 h-3 rounded-full', platform.color)} />
                )}
                {platform.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        ) : view === 'month' ? (
          // Месячный вид
          <div className="h-full">
            {/* Заголовки дней недели */}
            <div className="grid grid-cols-7 mb-2">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                <div key={day} className="text-center text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            {/* Сетка дней */}
            <div className="grid grid-cols-7 gap-1">
              {allMonthDays.map((day, i) => {
                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                const isCurrentMonth = isSameMonth(day, currentDate)
                const dayPosts = getPostsForDate(day)
                return (
                  <div
                    key={i}
                    className={clsx(
                      'min-h-[100px] p-2 rounded-lg text-sm transition-colors relative group border',
                      isToday && 'bg-primary/10 border-primary/30',
                      !isCurrentMonth && 'text-muted-foreground/50 border-border/50',
                      isCurrentMonth && !isToday && 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={clsx(isToday && 'text-primary font-semibold')}>
                        {format(day, 'd')}
                      </span>
                      <button
                        onClick={() => handleCellClick(day)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayPosts.length - 3} ещё
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : view === 'day' ? (
          // Дневной вид
          <div className="calendar-grid rounded-lg overflow-hidden" style={{ gridTemplateColumns: '60px 1fr' }}>
            {/* Header */}
            <div className="calendar-cell" />
            <div className={clsx(
              'calendar-cell text-center py-3',
              format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && 'bg-primary/10'
            )}>
              <div className="text-xs text-muted-foreground uppercase">
                {format(currentDate, 'EEEE', { locale: ru })}
              </div>
              <div className="text-sm mt-1 font-semibold">
                {format(currentDate, 'd MMMM yyyy', { locale: ru })}
              </div>
            </div>

            {/* Time rows */}
            {hours.map((hour) => {
              const hourPosts = getPostsForTime(currentDate, hour)
              return (
                <div key={`row-${hour}`} className="contents">
                  <div className="calendar-cell text-right pr-2 text-xs text-muted-foreground">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div
                    className="calendar-cell group relative hover:bg-secondary/50 transition-colors min-h-[60px]"
                  >
                    {hourPosts.length > 0 ? (
                      <div className="p-1 space-y-1">
                        {hourPosts.map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCellClick(currentDate, hour)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Недельный вид
          <div className="calendar-grid rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="calendar-cell" /> {/* Empty corner */}
            {weekDays.map((day, i) => {
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const dayPosts = getPostsForDate(day)
              return (
                <div
                  key={i}
                  className={clsx(
                    'calendar-cell text-center py-3',
                    isToday && 'bg-primary/10'
                  )}
                >
                  <div className="text-xs text-muted-foreground uppercase">
                    {format(day, 'EEEEEE', { locale: ru })}
                  </div>
                  <div className={clsx(
                    'text-sm mt-1',
                    isToday && 'text-primary font-semibold'
                  )}>
                    {format(day, 'd.MM.yyyy')}
                  </div>
                  {dayPosts.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {dayPosts.length} пост{dayPosts.length > 1 ? (dayPosts.length < 5 ? 'а' : 'ов') : ''}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Time rows */}
            {hours.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="calendar-cell text-right pr-2 text-xs text-muted-foreground">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {weekDays.map((day, dayIndex) => {
                  const hourPosts = getPostsForTime(day, hour)
                  return (
                    <div
                      key={`cell-${hour}-${dayIndex}`}
                      className="calendar-cell group relative hover:bg-secondary/50 transition-colors min-h-[50px]"
                    >
                      {hourPosts.length > 0 ? (
                        <div className="p-1 space-y-1">
                          {hourPosts.map((post) => (
                            <PostCard key={post.id} post={post} />
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCellClick(day, hour)}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create menu popup */}
      {showCreateMenu && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setShowCreateMenu(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-4 shadow-2xl w-64"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm text-muted-foreground mb-3">
              {format(showCreateMenu.date, 'd MMMM yyyy', { locale: ru })}
              {showCreateMenu.hour !== undefined && `, ${showCreateMenu.hour.toString().padStart(2, '0')}:00`}
            </div>
            <div className="space-y-2">
              <button
                onClick={handleCreatePost}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Создать пост</div>
                  <div className="text-xs text-muted-foreground">С генерацией контента</div>
                </div>
              </button>
              <button
                onClick={handleCreateNote}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <StickyNote className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Создать заметку</div>
                  <div className="text-xs text-muted-foreground">Идея или напоминание</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
