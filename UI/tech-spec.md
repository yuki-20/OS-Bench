# Tech Spec — OpenBench OS Website

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `^19.1` | UI framework |
| `react-dom` | `^19.1` | React DOM renderer |
| `vite` | `^6.3` | Build tool |
| `@vitejs/plugin-react` | `^4.5` | Vite React plugin |
| `tailwindcss` | `^4.1` | Utility-first CSS |
| `@tailwindcss/vite` | `^4.1` | Tailwind Vite integration |
| `gsap` | `^3.13` | Core animation engine (includes ScrollTrigger, SplitText) |
| `lenis` | `^1.3` | Smooth scroll with lerp |
| `lucide-react` | `^0.513` | Icon library |
| `clsx` | `^2.1` | Conditional class composition |
| `tailwind-merge` | `^3.3` | Tailwind class deduplication |
| `typescript` | `^5.8` | Type checking |
| `@types/react` | `^19.1` | React type definitions |
| `@types/react-dom` | `^19.1` | React DOM type definitions |

> **Fonts**: Suisse Intl is not freely available. Use Inter from Google Fonts as the geometric sans-serif alternative (loaded via `<link>` in `index.html`). Geist Mono from `@geist-ui/monofont` npm package.

---

## Component Inventory

### Layout (shared across page)

| Component | Source | Notes |
|-----------|--------|-------|
| `Navigation` | Custom | Fixed nav, appears after hero scroll. Mobile: Sheet slide-from-right. Contains scroll-aware show/hide. |
| `Footer` | Custom | Dark-themed, 3-column link layout + brand. |

### Sections (page-specific, one instance each)

| Component | Source | Notes |
|-----------|--------|-------|
| `HeroSection` | Custom | Pinned fullscreen. Contains WaveShader canvas + glass cards + title sequence. Most complex section. |
| `TrustedBySection` | Custom | Logo grid with grayscale hover effect. |
| `CapabilitiesSection` | Custom | 2x2 icon card grid. |
| `MetricsSection` | Custom | Dark background, 4-column animated counters. |
| `HowItWorksSection` | Custom | 4 alternating-layout steps with images. |
| `CoreFeaturesSection` | Custom | 3-column feature card grid (9 cards). |
| `UseCasesSection` | Custom | 3-column persona cards with image + benefits. |
| `TestimonialsSection` | Custom | Horizontal snap-scroll carousel with dot navigation. |
| `ArchitectureSection` | Custom | Diagram image + 3-column tech highlight grid. |
| `CtaBannerSection` | Custom | Cobalt background, inverted buttons. |

### Reusable Components (used by multiple sections)

| Component | Source | Used By | Notes |
|-----------|--------|---------|-------|
| `SectionLabel` | Custom | All content sections | Pill-shaped label with optional icon. Monospace uppercase text. |
| `GlassCard` | Custom | HeroSection | Glassmorphism card with backdrop-blur, sheen animation, 3D perspective. |
| `StatCard` | Custom | MetricsSection | Monospace number + divider + description. GSAP-animated count-up. |
| `PrimaryButton` | Custom (shadcn base) | Hero, Nav, CTA | Cobalt bg, hover lift + glow. Inverted variant for CTA section. |
| `SecondaryButton` | Custom (shadcn base) | Hero, Nav | Outlined cobalt. White-bordered variant for CTA section. |

### Hooks

| Hook | Purpose |
|------|---------|
| `useLenis` | Initialize Lenis, connect to GSAP ticker, provide scroll instance. |
| `useWaveShader` | WebGL setup, shader compilation, uniform updates, render loop, mouse tracking, resize handling. |

---

## Animation Implementation

| # | Animation | Library | Implementation Approach | Complexity |
|---|-----------|---------|------------------------|------------|
| 1 | **Wave field shader** (hero background) | Raw WebGL | Custom fragment shader with 5-octave simplex noise, mouse-driven Y/X rotation via uniforms. Dedicated `useWaveShader` hook manages GL context, buffer, program, render loop with rAF. Mouse position lerped at 0.05 factor per frame. | **High** 🔒 |
| 2 | **Hero pinned scroll sequence** | GSAP + ScrollTrigger | Single `gsap.timeline()` with `scrollTrigger: { pin: true, scrub: 0.5, end: "+=300%" }`. Timeline contains labeled phases: title reveal (0-15%), cards flip-in (15-30%), hold (30-70%), exit zoom (70-100%). | **High** 🔒 |
| 3 | **Headline word-by-word reveal** | GSAP + SplitText | SplitText splits H1 into words. `gsap.from(words, { yPercent: 60, opacity: 0, stagger: 0.08 })` scrubbed within hero timeline. | Medium |
| 4 | **Subtitle char-by-char reveal** | GSAP + SplitText | SplitText splits subtitle into chars. `gsap.from(chars, { opacity: 0, duration: 0.03, stagger: 0.02 })` scrubbed within hero timeline. | Medium |
| 5 | **Glass card 3D flip entrance** | GSAP | `gsap.from(cards, { rotationX: 45, z: -200, opacity: 0, stagger: 0.15, ease: "back.out(1.2)" })` with `perspective: 1000px` on container. Scrubbed in hero timeline. | Medium |
| 6 | **Hero exit animation** | GSAP + ScrollTrigger | Cards scale out + fade. Headline slides up + fades. Part of hero pinned timeline (70-100%). | Medium |
| 7 | **Smooth scrolling** | Lenis | `useLenis` hook initializes Lenis with `lerp: 0.08`. Connected to GSAP ticker via `gsap.ticker.add()`. | Low |
| 8 | **Navigation show/hide** | GSAP | ScrollTrigger watches hero section. On leave: `gsap.to(nav, { opacity: 1, y: 0 })`. Initial state: `opacity: 0, y: -20px`. | Low |
| 9 | **Section entrance — fade up** | GSAP + ScrollTrigger | Default pattern: `gsap.from(elements, { y: 40, opacity: 0, stagger: 0.1 })` with `start: "top 75%"`. Applied to all section headers. | Low |
| 10 | **Section entrance — staggered cards** | GSAP + ScrollTrigger | `gsap.from(cards, { y: 60, opacity: 0, stagger: 0.12 })` with `start: "top 80%"`. Applied to capability, feature, tech grids. | Low |
| 11 | **Counter animation** | GSAP + ScrollTrigger | `gsap.from(statNumbers, { textContent: 0, snap: { textContent: 1 }, duration: 1.5, stagger: 0.2 })`. `textContent` tween with snap to integers. Percentage symbols appended as separate text nodes. | Medium |
| 12 | **How It Works — alternating slide** | GSAP + ScrollTrigger | Per-step: text slides from left/right (`x: ±40`), image from opposite direction. Staggered within each step's ScrollTrigger at `start: "top 75%"`. | Medium |
| 13 | **Glass card sheen overlay** | CSS | `@keyframes sheen` animates `background-position` from `200% 200%` to `-200% -200%` over 8s, infinite. Pure CSS, no JS. | Low |
| 14 | **Card hover transitions** | CSS | `transform: translateY(-4px)` + shadow change. Pure CSS `transition: all 0.3s ease`. Applied to all card grids. | Low |
| 15 | **Testimonials — scroll snap** | CSS | `scroll-snap-type: x mandatory` on track, `scroll-snap-align: start` on cards. Dot navigation uses `scrollIntoView()`. No GSAP needed for carousel behavior. | Low |
| 16 | **Trusted By — logo hover** | CSS | `filter: grayscale(100%) opacity(0.5)` → `grayscale(0%) opacity(1)` on hover. Pure CSS `transition: 0.3s`. | Low |
| 17 | **Mobile menu slide** | GSAP | Sheet panel slides from right. Backdrop fade. Triggered by hamburger button. | Low |

---

## State & Logic Plan

### Wave Shader ↔ React Bridge

The WebGL context lives entirely outside React's render cycle. The `useWaveShader` hook:

- Creates a single `useRef<HTMLCanvasElement>` for the canvas element.
- Initializes WebGL context, compiles shaders, creates the fullscreen quad buffer inside a `useEffect`.
- Stores mouse target position in a `useRef` (not state) to avoid re-renders. Updates target on `mousemove` via a native event listener.
- Runs the render loop via `requestAnimationFrame`. Each frame: lerps live mouse toward target, uploads uniforms, draws.
- On unmount: cancels rAF, removes event listener, deletes GL resources.
- Exposes no React state — the shader is self-contained.

### Hero Pinned Timeline Architecture

The hero section must coordinate multiple GSAP animations across a single pinned ScrollTrigger. Approach:

- Create one `gsap.timeline({ scrollTrigger: { pin: true, scrub: 0.5, end: "+=300%" } })`.
- Use timeline position parameters (labels and relative offsets) to sequence all sub-animations.
- Sub-animations include: eyebrow fade, SplitText headline, SplitText subtitle, glass card flip, hold gap, card exit, headline exit.
- The WaveShader runs independently via rAF (not GSAP-controlled) — it continuously animates regardless of scroll position.
- All ScrollTrigger instances for the hero are created inside the hero component's `useEffect` and killed on cleanup.

### Lenis ↔ GSAP Ticker Integration

Lenis must drive both the page scroll and GSAP's ScrollTrigger updates:

- `useLenis` hook initializes Lenis once at app level.
- Registers `lenis.on('scroll', ScrollTrigger.update)`.
- Registers `gsap.ticker.add((time) => lenis.raf(time * 1000))`.
- Calls `gsap.ticker.lagSmoothing(0)` to prevent GSAP from skipping frames.
- Provides the Lenis instance via React context for programmatic scroll (nav anchor links).

### Testimonial Carousel Logic

No complex state needed:

- Horizontal scroll container with CSS `scroll-snap-type: x mandatory`.
- Each card has `scroll-snap-align: start`.
- Dot navigation buttons call `cardElement.scrollIntoView({ behavior: 'smooth' })`.
- Active dot tracked via `IntersectionObserver` on each card (or a scroll event handler reading `scrollLeft`).
- No animation library needed — native scroll + snap handles the interaction.

---

## Other Key Decisions

**Raw WebGL over Three.js / React Three Fiber**: The wave shader is a single fullscreen quad with a fragment shader. Three.js would add ~150KB+ to the bundle for no benefit. Raw WebGL keeps the bundle lean and gives direct control over the exact shader code specified in the design.

**GSAP SplitText over manual splitting**: SplitText handles edge cases (nesting, responsive reflow, cleanup) that manual string-splitting misses. It's a Club GSAP plugin included in the `gsap` package — import from `gsap/SplitText`.

**No shadcn/ui Card/Badge components**: The design specifies custom card styling (glassmorphism, custom shadows, 3D transforms, sheen overlay) that would require overriding nearly all shadcn defaults. Building custom components is cleaner. Only shadcn Button is used as a base (for the two button variants).

**Image assets**: All 20 images are AI-generated during the build phase and placed in `/public/images/`. The architecture diagram (`architecture-diagram`) is a generated image, not a coded SVG — the design specifies a complex 6-layer diagram that would be unnecessarily time-consuming to build with code.
