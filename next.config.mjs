import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Mirrors `resolveAppEnv` in src/lib/env.ts — duplicated, not imported,
 * because this file runs as plain Node before webpack exists to compile a
 * `.ts` import. Keep the two in sync if the logic ever changes.
 *
 * Computed once at build time and injected below as `NEXT_PUBLIC_APP_ENV` so
 * the server and the browser bundle land on the exact same value: `APP_ENV`
 * and `VERCEL_ENV` are invisible in the browser, so without this a client
 * component (an Ably channel name, e.g.) would have no way to agree with the
 * server on which environment it is in.
 */
function resolveAppEnvForBuild() {
  const known = ['local', 'preview', 'production'];
  if (known.includes(process.env.APP_ENV)) return process.env.APP_ENV;
  if (!process.env.VERCEL) return 'local';
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'local';
}

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_ENV: resolveAppEnvForBuild(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.prayoga.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['ably'],
};

export default withPWA(withNextIntl(nextConfig));
