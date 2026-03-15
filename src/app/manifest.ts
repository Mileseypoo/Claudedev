import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dictator — Sales Copilot',
    short_name: 'Dictator',
    description: 'Real-time AI assistant for estate agency meetings',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0f1a',
    theme_color: '#0f0f1a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
