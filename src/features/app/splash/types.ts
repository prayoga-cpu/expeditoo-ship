/**
 * Splash feature types
 * Following SOLID principle - centralized type definitions
 */

export interface SplashConfig {
  logoUrl?: string;
  brandName: string;
  tagline?: string;
  backgroundColor?: string;
  duration: number; // in milliseconds
  redirectTo: string;
}

export interface SplashState {
  isVisible: boolean;
  progress: number; // 0-100
}
