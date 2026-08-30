/**
 * "à 12 km de Clermont-Ferrand".
 *
 * A job collected in Riom tells a driver very little; the same job placed
 * twelve kilometres from Clermont-Ferrand places itself on the map they
 * already carry in their head. Cocolis annotates every address this way and it
 * is the single thing that makes a list of communes readable.
 *
 * A static table rather than a lookup: it is forty rows, it never changes
 * inside a release, and a network call per card on a twenty-row board would be
 * absurd. France has ~35,000 communes and no driver knows them; they know
 * these.
 *
 * See docs/specs/board_route_search_spec.md §9.
 */

import { KM_PER_DEGREE } from "@/lib/route-corridor";

export interface ReferenceCity {
  name: string;
  lat: number;
  lng: number;
}

/**
 * The largest urban areas in metropolitan France, by population.
 *
 * Ordered loosely by size so that where two are equally near, the better-known
 * one is named — a job outside Villeurbanne reads better as "near Lyon".
 */
export const REFERENCE_CITIES: readonly ReferenceCity[] = [
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Marseille", lat: 43.2965, lng: 5.3698 },
  { name: "Lyon", lat: 45.764, lng: 4.8357 },
  { name: "Toulouse", lat: 43.6047, lng: 1.4442 },
  { name: "Nice", lat: 43.7102, lng: 7.262 },
  { name: "Nantes", lat: 47.2184, lng: -1.5536 },
  { name: "Montpellier", lat: 43.6108, lng: 3.8767 },
  { name: "Strasbourg", lat: 48.5734, lng: 7.7521 },
  { name: "Bordeaux", lat: 44.8378, lng: -0.5792 },
  { name: "Lille", lat: 50.6292, lng: 3.0573 },
  { name: "Rennes", lat: 48.1173, lng: -1.6778 },
  { name: "Reims", lat: 49.2583, lng: 4.0317 },
  { name: "Saint-Étienne", lat: 45.4397, lng: 4.3872 },
  { name: "Le Havre", lat: 49.4944, lng: 0.1079 },
  { name: "Toulon", lat: 43.1242, lng: 5.928 },
  { name: "Grenoble", lat: 45.1885, lng: 5.7245 },
  { name: "Dijon", lat: 47.322, lng: 5.0415 },
  { name: "Angers", lat: 47.4784, lng: -0.5632 },
  { name: "Nîmes", lat: 43.8367, lng: 4.3601 },
  { name: "Clermont-Ferrand", lat: 45.7772, lng: 3.087 },
  { name: "Le Mans", lat: 48.0061, lng: 0.1996 },
  { name: "Aix-en-Provence", lat: 43.5297, lng: 5.4474 },
  { name: "Brest", lat: 48.3904, lng: -4.4861 },
  { name: "Tours", lat: 47.3941, lng: 0.6848 },
  { name: "Amiens", lat: 49.8941, lng: 2.2958 },
  { name: "Limoges", lat: 45.8336, lng: 1.2611 },
  { name: "Annecy", lat: 45.8992, lng: 6.1294 },
  { name: "Perpignan", lat: 42.6887, lng: 2.8948 },
  { name: "Besançon", lat: 47.238, lng: 6.0243 },
  { name: "Metz", lat: 49.1193, lng: 6.1757 },
  { name: "Orléans", lat: 47.9029, lng: 1.9093 },
  { name: "Rouen", lat: 49.4432, lng: 1.0999 },
  { name: "Mulhouse", lat: 47.7508, lng: 7.3359 },
  { name: "Caen", lat: 49.1829, lng: -0.3707 },
  { name: "Nancy", lat: 48.6921, lng: 6.1844 },
  { name: "Avignon", lat: 43.9493, lng: 4.8055 },
  { name: "Poitiers", lat: 46.5802, lng: 0.3404 },
  { name: "La Rochelle", lat: 46.1591, lng: -1.1521 },
  { name: "Pau", lat: 43.2951, lng: -0.3708 },
  { name: "Bayonne", lat: 43.4933, lng: -1.4748 },
];

/**
 * Near enough that naming the city helps, far enough out that it is worth
 * saying. Beyond this the reference is not a landmark any more.
 */
export const MAX_REFERENCE_KM = 60;

export interface CityBearing {
  city: string;
  km: number;
}

/**
 * The well-known city this point sits near, and how far off it is.
 *
 * `null` when the place *is* the reference — repeating "Lyon, à 2 km de Lyon"
 * is noise — or when nothing well-known is close enough to mean anything.
 *
 * Equirectangular, like the corridor maths: at these distances the error is
 * metres, and the figure is rounded to the kilometre anyway.
 */
export function nearestReferenceCity(
  point: { lat: number; lng: number },
  ownCity?: string
): CityBearing | null {
  const lngScale = Math.cos((point.lat * Math.PI) / 180) * KM_PER_DEGREE;

  let best: CityBearing | null = null;

  for (const city of REFERENCE_CITIES) {
    const km = Math.hypot(
      (city.lng - point.lng) * lngScale,
      (city.lat - point.lat) * KM_PER_DEGREE
    );
    if (km > MAX_REFERENCE_KM) continue;
    if (best === null || km < best.km) best = { city: city.name, km };
  }

  if (best === null) return null;

  // Within a kilometre, or the same place by name: the annotation would be
  // repeating the line above it.
  const rounded = Math.round(best.km);
  if (rounded < 1) return null;
  if (ownCity && normalise(ownCity) === normalise(best.city)) return null;

  return { city: best.city, km: rounded };
}

const normalise = (value: string) =>
  value
    .normalize("NFD")
    // Escaped rather than literal: the combining marks are invisible in an
    // editor and a stray copy-paste would silently stop folding accents.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
