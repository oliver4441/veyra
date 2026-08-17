import type { Metadata, Viewport } from 'next';
import PWAProvider from '@/components/PWAProvider';
import Footer from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Veyra - Your World of Movies',
    template: '%s | Veyra',
  },
  description: 'A premium cinematic streaming experience. Watch movies and series in stunning quality.',
  keywords: ['streaming', 'movies', 'series', 'watch', 'cinema', 'entertainment', 'pwa'],
  authors: [{ name: 'Veyra' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://veyra.app',
    siteName: 'Veyra',
    title: 'Veyra - Your World of Movies',
    description: 'A premium cinematic streaming experience.',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Veyra',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veyra - Your World of Movies',
    description: 'A premium cinematic streaming experience.',
    images: ['/icons/icon-512.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  // PWA Meta Tags
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Veyra',
    startupImage: [
      {
        url: '/icons/icon-512.png',
        media: '(device-width: 1024px)',
      },
      {
        url: '/icons/icon-192.png',
        media: '(device-width: 320px)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'msapplication-TileColor': '#0A0A0B',
    'msapplication-tap-highlight': 'no',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A0B',
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* PWA Icons */}
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="icon" type="image/png" sizes="72x72" href="/icons/icon-72.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/icons/icon-96.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/icons/icon-128.png" />
        <link rel="icon" type="image/png" sizes="144x144" href="/icons/icon-144.png" />
        <link rel="icon" type="image/png" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="384x384" href="/icons/icon-384.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        {/* Splash screens */}
        <link rel="apple-touch-startup-image" href="/icons/icon-512.png" />
      </head>
      <body className="min-h-screen bg-background text-on-surface font-body-md text-body-md antialiased">
        <PWAProvider>
          {children}
          <Footer />
        </PWAProvider>
      </body>
    </html>
  );
}
