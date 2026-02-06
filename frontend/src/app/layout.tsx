import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { LayoutWrapper } from '@/components/layout-wrapper'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Kerno — SMM планировщик с AI',
  description: 'Планируйте и публикуйте посты в Telegram и VK с помощью AI',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-icon.svg',
  },
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
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
      </body>
    </html>
  )
}
