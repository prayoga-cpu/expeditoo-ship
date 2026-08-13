/**
 * Map styles for MapLibre GL
 * Custom monochrome styles hosted locally
 * - Light: white/gray land, darker gray water
 * - Dark: dark blue land, darker water
 */

// Custom styles served from /public folder
export const MAP_STYLES = {
  light: "/map-styles/light.json",
  dark: "/map-styles/dark.json",
} as const;

/**
 * Get map style URL based on theme
 */
export function getMapStyle(isDark: boolean): string {
  return isDark ? MAP_STYLES.dark : MAP_STYLES.light;
}
