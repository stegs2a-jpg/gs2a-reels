# gs2a-reels

## Reels (Node.js)

`reels/build.js` turns the square ads in `pubs-2026-11/` into vertical 9:16 Reels (1080×1920) with Playwright + ffmpeg:

```bash
cd reels
MUSIC=/path/to/music.wav npm run build   # MUSIC is optional
```

Output in `reels/out/`: one 8 s reel per ad (`reel_<name>.mp4`) and one 24.5 s reel with all ads (`reel_all.mp4`).
