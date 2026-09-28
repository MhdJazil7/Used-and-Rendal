import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AuthModal } from '@/components/AuthModal';

export const metadata: Metadata = {
  title: 'KeralaDrive | Kerala-First WhatsApp-Friendly Vehicle Rental Marketplace',
  description: 'Rent self-drive and commercial vehicles across Kerala with verified owners, transparent pricing, and instant WhatsApp updates.',
  keywords: 'Kerala car rental, Kochi vehicle hire, Calicut self drive, Trivandrum car rental, WhatsApp vehicle booking Kerala',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col min-h-screen">
        <AppProvider>
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
          <AuthModal />
        </AppProvider>
      </body>
    </html>
  );
}
