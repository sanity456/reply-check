import type { Metadata } from 'next';
import './globals.css';
import './reply.css';

export const metadata: Metadata = {
  title: 'ReplyCheck — Clarity before you reply',
  description:
    'Reference-led reply reviews and versioned knowledge for GenLayer Studionet.',
  icons: {
    icon: [{ url: '/brand/replycheck-mark.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Skip to workspace
        </a>
        {children}
      </body>
    </html>
  );
}
