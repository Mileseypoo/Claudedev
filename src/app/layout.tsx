import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dictator — Sales Copilot',
  description: 'Real-time AI assistant for estate agency meetings',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
