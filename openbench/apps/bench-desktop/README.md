# OpenBench Bench Runtime — Tauri 2 Desktop Shell

This shell wraps the bench-runtime UI from `apps/web` (`/app/*`) into an installable
Windows-first desktop app per the v2 product spec.

## Build prerequisites

- Rust toolchain (`rustup` — stable channel)
- Node 20+ and pnpm
- Windows: WebView2 runtime (preinstalled on modern Windows 11)
- macOS: Xcode command-line tools
- Linux: standard `webkit2gtk` dependencies (see Tauri docs)

## Dev (live)

```bash
# In one terminal: run the API + web stack
cd ../..
docker compose up

# In another:
cd apps/bench-desktop
pnpm install
pnpm tauri:dev
```

The Tauri window points at `http://localhost:3000/app`. While the shell window is open,
all changes to the Next.js code hot-reload inside it.

## Build installers

```bash
pnpm tauri:build
```

Produces signed `.msi` / `.exe` installers on Windows under
`src-tauri/target/release/bundle/`. The bundle config also covers `.dmg` (macOS) and
`.deb`/`.AppImage` (Linux) when building on those platforms.

## Icons

Real (placeholder-branded) icons are committed under `src-tauri/icons/`. They were generated
by `scripts/gen-icons.js` (pure Node, no native deps). To regenerate or rebrand:

```bash
node scripts/gen-icons.js          # any platform with Node 20+
# or, if you have Docker but no Pillow locally:
bash scripts/gen-icons.sh          # macOS/Linux
pwsh scripts/gen-icons.ps1         # Windows
```

The generator emits `32x32.png`, `128x128.png`, `icon.png`, a multi-size `icon.ico`, and a
PNG-renamed `icon.icns` placeholder. For a real macOS bundle, replace `icon.icns` with a
proper Apple ICNS file produced by `iconutil`.

## Configuration

Edit `src-tauri/tauri.conf.json` to change the runtime URL, window size, or bundle targets.
By default the shell loads the bench runtime from the local web service; for a fully
hosted deployment, change `app.windows[0].url` to your production URL and rebuild.
