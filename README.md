# fancybuild (isolated copy)

Isolated bundle of the Collapse web app served under `/fancybuild/`. Fancybuild-specific scripts now live only in this copy; the main `collapse_web` package no longer carries fancybuild commands.

## Development

```bash
cd collapse_web_new
npm install
npm run dev             # or npm run dev:fancybuild
```

## Build & Deploy

```bash
cd collapse_web_new
npm run build           # or npm run build:fancybuild
# Output: docs/ (base already set to /fancybuild/)
```

If you publish this to GitHub Pages, point it at `docs/` from this folder.
