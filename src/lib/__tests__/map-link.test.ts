import { describe, expect, it } from "vitest";

import {
  isAllowedMapLinkHost,
  parseCoordinatesFromMapLink,
} from "../map-link";

/**
 * Covers the "can't find it? paste a map link" escape hatch on the pickup /
 * dropoff picker. A short share link (maps.app.goo.gl) carries no coordinates
 * of its own — resolving one is `map-link.service.ts`'s job, not this
 * function's — so it is deliberately not covered here.
 */

describe("parseCoordinatesFromMapLink", () => {
  it("reads a bare 'lat,lng' pair", () => {
    expect(parseCoordinatesFromMapLink("48.8584, 2.2945")).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("reads a negative pair with no spacing", () => {
    expect(parseCoordinatesFromMapLink("-33.8688,151.2093")).toEqual({
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  it("reads Google Maps' @lat,lng,zoom segment", () => {
    const url =
      "https://www.google.com/maps/place/Tour+Eiffel/@48.8584,2.2945,17z/data=!3m1!4b1";
    expect(parseCoordinatesFromMapLink(url)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("reads Google Maps' !3d!4d place data blob when there is no @ segment", () => {
    const url = "https://www.google.com/maps?q=place_id:abc!3d48.8584!4d2.2945";
    expect(parseCoordinatesFromMapLink(url)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("reads a Google Maps ?q=lat,lng link", () => {
    const url = "https://www.google.com/maps?q=48.8584,2.2945";
    expect(parseCoordinatesFromMapLink(url)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("reads an Apple Maps ll= link", () => {
    const url = "https://maps.apple.com/?ll=48.8584,2.2945&q=Tour+Eiffel";
    expect(parseCoordinatesFromMapLink(url)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("reads an OpenStreetMap permalink", () => {
    const url = "https://www.openstreetmap.org/#map=17/48.8584/2.2945";
    expect(parseCoordinatesFromMapLink(url)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("reads OpenStreetMap mlat/mlon params in either order", () => {
    const a = "https://www.openstreetmap.org/?mlat=48.8584&mlon=2.2945#map=17";
    const b = "https://www.openstreetmap.org/?mlon=2.2945&mlat=48.8584#map=17";
    expect(parseCoordinatesFromMapLink(a)).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(parseCoordinatesFromMapLink(b)).toEqual({ lat: 48.8584, lng: 2.2945 });
  });

  it("reads a Bing Maps cp= link", () => {
    const url = "https://www.bing.com/maps?cp=48.8584~2.2945&lvl=16";
    expect(parseCoordinatesFromMapLink(url)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it("returns null for a link carrying no coordinates", () => {
    expect(
      parseCoordinatesFromMapLink("https://maps.app.goo.gl/xyz123")
    ).toBeNull();
  });

  it("returns null for empty or unrelated text", () => {
    expect(parseCoordinatesFromMapLink("")).toBeNull();
    expect(parseCoordinatesFromMapLink("   ")).toBeNull();
    expect(parseCoordinatesFromMapLink("Sofa, ground floor")).toBeNull();
  });

  it("rejects a pair outside plausible lat/lng ranges", () => {
    expect(parseCoordinatesFromMapLink("948.8584, 2.2945")).toBeNull();
  });
});

describe("isAllowedMapLinkHost", () => {
  it("allows the known map providers and their subdomains", () => {
    expect(isAllowedMapLinkHost("www.google.com")).toBe(true);
    expect(isAllowedMapLinkHost("maps.app.goo.gl")).toBe(true);
    expect(isAllowedMapLinkHost("maps.apple.com")).toBe(true);
    expect(isAllowedMapLinkHost("openstreetmap.org")).toBe(true);
    expect(isAllowedMapLinkHost("www.openstreetmap.org")).toBe(true);
  });

  it("refuses anything else, including a lookalike host", () => {
    expect(isAllowedMapLinkHost("evil.com")).toBe(false);
    // A host merely containing the word must not slip past a substring check.
    expect(isAllowedMapLinkHost("notgoogle.com.evil.com")).toBe(false);
    expect(isAllowedMapLinkHost("google.com.evil.com")).toBe(false);
  });
});
