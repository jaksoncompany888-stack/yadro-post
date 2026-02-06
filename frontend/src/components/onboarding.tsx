'use client'

import { useState, useEffect } from 'react'
import { X, Check, ChevronRight, Bot, Users, Sparkles, Send, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: any
  action?: {
    label: string
    href?: string
    external?: boolean
    onClick?: () => void
  }
  substeps?: string[]
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'bot',
    title: 'Добавьте бота в свой канал',
    description: 'Чтобы публиковать посты, нужно добавить нашего бота администратором в ваш Telegram канал',
    icon: Bot,
    action: {
      label: 'Открыть бота',
      href: 'https://t.me/YadroPost_bot',
      external: true,
    },
    substeps: [
      'Откройте @YadroPost_bot в Telegram',
      'Перейдите в настройки вашего канала',
      'Администраторы → Добавить администратора',
      'Найдите @YadroPost_bot и добавьте',
      'Дайте право "Публикация сообщений"',
    ],
  },
  {
    id: 'channel',
    title: 'Подключите свой канал',
    description: 'Добавьте ваш канал в "Мои ресурсы" для публикации постов',
    icon: Send,
    action: {
      label: 'Добавить канал',
      href: '/',
    },
    substeps: [
      'На главной странице нажмите кнопку ресурсов (справа вверху на мобильном)',
      'Выберите Telegram',
      'Введите @username вашего канала',
      'Нажмите "Добавить"',
    ],
  },
  {
    id: 'competitors',
    title: 'Добавьте конкурентов для анализа',
    description: 'AI анализирует контент конкурентов и генерирует посты в похожем стиле — это ключ к качественным генерациям',
    icon: Users,
    action: {
      label: 'Перейти к анализу',
      href: '/integrations',
    },
    substeps: [
      'Перейдите в раздел "Анализ"',
      'Нажмите "Добавить канал"',
      'Введите @username канала конкурента',
      'Добавьте 3-5 каналов в вашей нише',
      'Дождитесь завершения анализа',
    ],
  },
  {
    id: 'generate',
    title: 'Генерируйте контент',
    description: 'Теперь AI знает стиль вашей ниши и будет генерировать релевантные посты',
    icon: Sparkles,
    action: {
      label: 'Создать пост',
      href: '/create',
    },
    substeps: [
      'Нажмите "+" или перейдите в создание поста',
      'Введите тему или идею поста',
      'Нажмите "Сгенерировать"',
      'Отредактируйте результат при необходимости',
      'Опубликуйте сразу или запланируйте',
    ],
  },
]

const STORAGE_KEY = 'kerno-onboarding-completed'
const STEPS_KEY = 'kerno-onboarding-steps'

export function Onboarding() {
  const [isOpen, setIsOpen] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  // Load state from localStorage
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    const steps = localStorage.getItem(STEPS_KEY)

    if (completed === 'true') {
      setIsOpen(false)
    } else {
      // Show onboarding for new users after a short delay
      setTimeout(() => setIsOpen(true), 1000)
    }

    if (steps) {
      setCompletedSteps(JSON.parse(steps))
    }
  }, [])

  // Save completed steps
  const toggleStep = (stepId: string) => {
    const newCompleted = completedSteps.includes(stepId)
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId]

    setCompletedSteps(newCompleted)
    localStorage.setItem(STEPS_KEY, JSON.stringify(newCompleted))
  }

  // Mark onboarding as completed
  const completeOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsOpen(false)
  }

  // Reset onboarding (for testing)
  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STEPS_KEY)
    setCompletedSteps([])
  }

  if (!isOpen) {
    return (
      // Small button to reopen onboarding
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-4 right-4 z-40 w-10 h-10 bg-primary/20 hover:bg-primary/30 rounded-full flex items-center justify-center text-primary transition-colors"
        title="Инструкция"
      >
        <span className="text-lg">?</span>
      </button>
    )
  }

  const progress = (completedSteps.length / ONBOARDING_STEPS.length) * 100

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Быстрый старт</h2>
            <button
              onClick={completeOnboarding}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {completedSteps.length} из {ONBOARDING_STEPS.length} шагов выполнено
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {ONBOARDING_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id)
            const isExpanded = expandedStep === step.id
            const Icon = step.icon

            return (
              <div
                key={step.id}
                className={clsx(
                  'rounded-xl border transition-all',
                  isCompleted
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-secondary/30'
                )}
              >
                {/* Step header */}
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full p-4 flex items-start gap-3 text-left"
                >
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-primary/20 text-primary'
                  )}>
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <h3 className={clsx(
                        'font-medium',
                        isCompleted && 'line-through text-muted-foreground'
                      )}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>

                  <ChevronRight className={clsx(
                    'w-5 h-5 text-muted-foreground transition-transform flex-shrink-0',
                    isExpanded && 'rotate-90'
                  )} />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    {/* Substeps */}
                    {step.substeps && (
                      <ol className="space-y-2 mb-4 ml-12">
                        {step.substeps.map((substep, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-muted-foreground">{substep}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 ml-12">
                      {step.action && (
                        step.action.external ? (
                          <a
                            href={step.action.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
                          >
                            {step.action.label}
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <Link
                            href={step.action.href || '/'}
                            onClick={completeOnboarding}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
                          >
                            {step.action.label}
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        )
                      )}

                      <button
                        onClick={() => toggleStep(step.id)}
                        className={clsx(
                          'px-4 py-2 rounded-lg text-sm transition-colors',
                          isCompleted
                            ? 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                            : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                        )}
                      >
                        {isCompleted ? 'Отменить' : 'Готово'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          {completedSteps.length === ONBOARDING_STEPS.length ? (
            <button
              onClick={completeOnboarding}
              className="w-full py-3 btn-core text-white rounded-xl font-medium"
            >
              Начать работу
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={completeOnboarding}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Пропустить
              </button>
              <p className="text-xs text-muted-foreground">
                Без анализа конкурентов генерации будут хуже
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
