import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Expeditop — Transport',
    short_name: 'Expeditop',
    description: 'Publiez une demande de transport, comparez les offres des transporteurs, choisissez et suivez la livraison.',
    start_url: '/?source=pwa',
    id: '/?source=pwa',
    display: 'standalone',
    display_override: ['window-controls-overlay'],
    background_color: '#ffffff',
    theme_color: '#0052FF',
    orientation: 'portrait',
    scope: '/',
    lang: 'fr',
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
        name: 'Suivre un envoi',
        short_name: 'Suivi',
        description: 'Suivez vos livraisons',
        url: '/deliveries?source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Trouver des missions',
        short_name: 'Missions',
        description: 'Parcourez les demandes de transport ouvertes aux offres',
        url: '/expedion?source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Mes messages',
        short_name: 'Messages',
        description: 'Ouvrez vos conversations',
        url: '/messages?source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
