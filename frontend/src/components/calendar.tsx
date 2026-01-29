'use client'

import { useState } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { clsx } from 'clsx'

type ViewType = 'day' | 'week' | 'month'

const hours = Array.from({ length: 24 }, (_, i) => i)

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const goToPrev = () => {
    if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1))
    }
  }

  const goToNext = () => {
    if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
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
              {format(weekStart, 'd MMMM', { locale: ru })} -{' '}
              {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: ru })}
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
                <div
                  key={`cell-${hour}-${dayIndex}`}
                  className="calendar-cell group relative"
                >
                  <button className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
