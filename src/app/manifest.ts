import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Expeditoo - Transport Marketplace',
    short_name: 'Expeditoo',
    description: 'Post a transport job, compare competing carrier offers, pick your carrier and track the delivery.',
    start_url: '/?source=pwa',
    id: '/?source=pwa',
    display: 'standalone',
    display_override: ['window-controls-overlay'],
    background_color: '#ffffff',
    theme_color: '#0052FF',
    orientation: 'portrait',
    scope: '/',
    lang: 'en',
    categories: ['business', 'productivity', 'travel', 'finance'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/home-mobile.jpg',
        sizes: '1080x2400',
        type: 'image/jpeg',
      },
      {
        src: '/screenshots/home-desktop.jpg',
        sizes: '1920x1080',
        type: 'image/jpeg',
        form_factor: 'wide',
      },
      {
        src: '/screenshots/messages-mobile.jpg',
        sizes: '1080x2400',
        type: 'image/jpeg',
      },
      {
        src: '/screenshots/deliveries-mobile.jpg',
        sizes: '1080x2400',
        type: 'image/jpeg',
      },
      {
        src: '/screenshots/deliveries-desktop.jpg',
        sizes: '1920x1080',
        type: 'image/jpeg',
        form_factor: 'wide',
      },
      {
        src: '/screenshots/create-mobile.jpg',
        sizes: '1080x2400',
        type: 'image/jpeg',
      },
    ],
    shortcuts: [
      {
        name: 'Track Parcel',
        short_name: 'Tracking',
        description: 'Track your shipments',
        url: '/deliveries?source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Find Jobs',
        short_name: 'Jobs',
        description: 'Browse transport jobs open for bids',
        url: '/expedion?source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'My Messages',
        short_name: 'Chat',
        description: 'View your conversations',
        url: '/messages?source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
