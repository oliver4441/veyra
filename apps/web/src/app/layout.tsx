import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Veyra - Your World of Movies',
    template: '%s | Veyra',
  },
  description: 'A premium cinematic streaming experience. Watch movies and series in stunning quality.',
  keywords: ['streaming', 'movies', 'series', 'watch', 'cinema', 'entertainment'],
  authors: [{ name: 'Veyra' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://veyra.app',
    siteName: 'Veyra',
    title: 'Veyra - Your World of Movies',
    description: 'A premium cinematic streaming experience.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veyra - Your World of Movies',
    description: 'A premium cinematic streaming experience.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A0B',
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
      </head>
      <body className="min-h-screen bg-background text-on-surface font-body-md text-body-md antialiased">
        {children}
      </body>
    </html>
  );
}
