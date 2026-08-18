import { Inter } from 'next/font/google';
import '../styles/globals.css';

// Self-hosts Inter at build time instead of fetching from
// fonts.googleapis.com/fonts.gstatic.com at request time — removes two
// external network round-trips (DNS + TLS + download) from every page
// load, which matters more on Vercel's serverless functions than it would
// on a persistent server, since there's no warm connection to reuse
// between requests the way there might be on a long-running PHP host.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export default function App({ Component, pageProps }) {
  return (
    <div className={inter.className}>
      <Component {...pageProps} />
    </div>
  );
}
