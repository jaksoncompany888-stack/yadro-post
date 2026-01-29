'use client'

import { useState } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { useRouter } from 'next/navigation'

type ViewType = 'day' | 'week' | 'month'

const hours = Array.from({ length: 24 }, (_, i) => i)

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')
  const router = useRouter()

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
    // Переходим на страницу создания поста с датой
    const dateStr = format(date, 'yyyy-MM-dd')
    const timeStr = hour !== undefined ? `&time=${hour.toString().padStart(2, '0')}:00` : ''
    router.push(`/create?date=${dateStr}${timeStr}`)
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {view === 'month' ? (
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
                return (
                  <button
                    key={i}
                    onClick={() => handleCellClick(day)}
                    className={clsx(
                      'aspect-square p-2 rounded-lg text-sm transition-colors relative group',
                      isToday && 'bg-primary/20 text-primary font-semibold',
                      !isCurrentMonth && 'text-muted-foreground/50',
                      isCurrentMonth && !isToday && 'hover:bg-secondary'
                    )}
                  >
                    <span>{format(day, 'd')}</span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                  </button>
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
            {hours.map((hour) => (
              <>
                <div key={`time-${hour}`} className="calendar-cell text-right pr-2 text-xs text-muted-foreground">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <button
                  key={`cell-${hour}`}
                  onClick={() => handleCellClick(currentDate, hour)}
                  className="calendar-cell group relative hover:bg-secondary/50 transition-colors"
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                </button>
              </>
            ))}
          </div>
        ) : (
          // Недельный вид
          <div className="calendar-grid rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="calendar-cell" /> {/* Empty corner */}
            {weekDays.map((day, i) => {
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
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
                </div>
              )
            })}

            {/* Time rows */}
            {hours.map((hour) => (
              <>
                <div key={`time-${hour}`} className="calendar-cell text-right pr-2 text-xs text-muted-foreground">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {weekDays.map((day, dayIndex) => (
                  <button
                    key={`cell-${hour}-${dayIndex}`}
                    onClick={() => handleCellClick(day, hour)}
                    className="calendar-cell group relative hover:bg-secondary/50 transition-colors"
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-4 h-4 text-primary" />
                    </div>
                  </button>
                ))}
              </>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
