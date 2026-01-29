import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Sidebar } from '@/components/sidebar'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Ядро Post - СММ планировщик с AI',
  description: 'Планируйте и публикуйте посты в Telegram и VK с помощью AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto pb-20 md:pb-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
