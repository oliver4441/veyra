import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Veyra - Your World of Movies',
    short_name: 'Veyra',
    description: 'A premium cinematic streaming experience with offline-first browsing.',
    start_url: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#0A0A0B',
    theme_color: '#0A0A0B',
    orientation: 'any',
    scope: '/',
    lang: 'en',
    dir: 'ltr',
    categories: ['entertainment', 'video', 'movies'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
      { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
      { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      { src: '/screenshots/desktop.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'Veyra Desktop - Browse Movies' },
      { src: '/screenshots/mobile.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Veyra Mobile - Home Screen' },
    ],
    shortcuts: [
      {
        name: 'Search Movies',
        short_name: 'Search',
        description: 'Search for movies and series',
        url: '/search',
        icons: [{ src: '/icons/search-96.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Continue Watching',
        short_name: 'Resume',
        description: 'Resume watching your shows',
        url: '/?section=continue-watching',
        icons: [{ src: '/icons/play-96.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
  };
}
