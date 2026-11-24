# Landing page video — credit and licence

The hero video in this folder is in the public domain under the
**Creative Commons CC0 1.0 Universal** dedication
(https://creativecommons.org/publicdomain/zero/1.0/): free for commercial
use, no permission and no attribution required. The credit below is kept
anyway, so anyone can trace the file back to its source.

| | |
|---|---|
| Title | Vidéo autoroute A6 française direction Paris aux environs de l'aire de la Repotte (Maconge) |
| Creator | Benoît Prieur (own work, filmed 2018-01-14 on an iPhone 7) |
| Source page | https://commons.wikimedia.org/wiki/File:Vid%C3%A9o_autoroute_A6_fran%C3%A7aise_direction_Paris_aux_environs_de_l%27aire_de_la_Repotte_(Maconge).webm |
| Licence | CC0 1.0 — `{{self\|cc-zero}}` on the file page; API `LicenseShortName: CC0`, `AttributionRequired: false` |
| Downloaded | 2026-11-24, original file (SHA-1 `ef51a9cf91ad91a02d4f77b85ebb802e566cf414`) |
| Original | 1920×1080, 61.2 s, VP8 + Vorbis, variable frame rate |

What was done (ffmpeg 6.0):

- Cut 45.0–56.6 s of the original, where the camera is steadiest.
- Made the loop seamless: the first 0.8 s of the cut (45.0–45.8 s) is
  crossfaded into its tail, so the video starts at 45.8 s and its last frame
  is that same frame. Result: 10.8 s.
- Cropped 1600×900 from the bottom centre (x 160, y 180) to drop some sky,
  scaled to 1280×720, 25 fps.
- Audio removed, metadata stripped.
- `hero.mp4`: H.264 High, CRF 24, `+faststart`. `hero.webm`: VP9, CRF 38.
- `hero-poster.webp`: the loop's first frame (original t = 45.8 s, which is
  `hero.mp4` t = 0), WebP quality 70.

Why it fits the rules: every vehicle is at least a lane ahead or across the
central reservation, so the plates are blurs about 16 px wide and the van
carries no lettering. There are no people and no brands. The only readable
text is public road signage (A6 kilometre markers, direction panels).
