import { describe, it, expect } from "vitest";
import { cargoSizeLabel } from "@/lib/cargo-size";
import { nearestReferenceCity } from "@/lib/french-cities";

describe("cargoSizeLabel", () => {
  it("labels a job by the smallest preset that still contains it", () => {
    // The `s` ceiling is 40×30×25.
    expect(
      cargoSizeLabel({ lengthCm: 40, widthCm: 30, heightCm: 25 })
    ).toBe("s");
    expect(cargoSizeLabel({ lengthCm: 41, widthCm: 30, heightCm: 25 })).toBe(
      "m"
    );
  });

  it("ignores which way round the sides were typed", () => {
    // A plank on its side is the same load.
    expect(cargoSizeLabel({ lengthCm: 180, widthCm: 80, heightCm: 120 })).toBe(
      cargoSizeLabel({ lengthCm: 120, widthCm: 180, heightCm: 80 })
    );
  });

  it("calls anything past the largest preset xxxl", () => {
    expect(
      cargoSizeLabel({ lengthCm: 400, widthCm: 200, heightCm: 250 })
    ).toBe("xxxl");
  });

  it("gives no badge when the job never said how big it is", () => {
    expect(
      cargoSizeLabel({ lengthCm: null, widthCm: null, heightCm: null })
    ).toBeNull();
  });

  it("gives no badge for a half-described load", () => {
    // The DTO rejects partial dimensions, so this is legacy data, not a form.
    expect(
      cargoSizeLabel({ lengthCm: 100, widthCm: null, heightCm: 40 })
    ).toBeNull();
  });
});

describe("nearestReferenceCity", () => {
  it("places a commune against the city a driver knows", () => {
    // Riom, the Cocolis example.
    const bearing = nearestReferenceCity({ lat: 45.894, lng: 3.113 }, "Riom");

    expect(bearing?.city).toBe("Clermont-Ferrand");
    expect(bearing?.km).toBeGreaterThan(8);
    expect(bearing?.km).toBeLessThan(20);
  });

  it("says nothing when the place is the reference", () => {
    expect(
      nearestReferenceCity({ lat: 45.764, lng: 4.8357 }, "Lyon")
    ).toBeNull();
  });

  it("says nothing when the nearest big city is not a landmark", () => {
    // Mid-Massif Central, far from everything on the list.
    expect(nearestReferenceCity({ lat: 44.9, lng: 2.4 })).toBeNull();
  });

  it("matches the own city despite accents and case", () => {
    // Deliberately a few km out: at the city's exact coordinates the "<1 km"
    // guard returns null first, and the accent-folding would never run.
    const outskirts = { lat: 45.475, lng: 4.42 };

    expect(nearestReferenceCity(outskirts)?.city).toBe("Saint-Étienne");
    expect(nearestReferenceCity(outskirts, "saint-etienne")).toBeNull();
    expect(nearestReferenceCity(outskirts, "SAINT-ÉTIENNE")).toBeNull();
  });

  it("still annotates a suburb whose name differs from the city", () => {
    // Villeurbanne is its own commune, next door to Lyon.
    const bearing = nearestReferenceCity(
      { lat: 45.7719, lng: 4.8902 },
      "Villeurbanne"
    );

    expect(bearing?.city).toBe("Lyon");
  });
});
