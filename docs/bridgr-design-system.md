# Bridgr design system

Canonical values for product UI, Figma Tokens (`tokens/bridgr.tokens.json`), and Tailwind (`tailwind.config.ts`).

## Colour — Teal scale

| Token | Hex | Role |
|-------|-----|------|
| teal-50 | `#e8f5f2` | Light wash |
| teal-100 | `#c5ded6` | — |
| teal-200 | `#8fbfb8` | Muted text |
| teal-300 | `#5a9990` | Secondary labels |
| teal-400 | `#2f6b62` | Border emphasis |
| teal-500 | `#45887c` | — |
| teal-600 | `#2a5a52` | Surface / muted blocks |
| teal-700 | `#224843` | Surface 2 |
| teal-800 | `#1a3d38` | Card / surface |
| teal-850 | `#122f2b` | Elevated surface |
| teal-900 | `#0d2b27` | App background |
| teal-950 | `#081f1c` | Deepest background |

## Colour — Lime scale (brand accent)

| Token | Hex | Role |
|-------|-----|------|
| lime-50 | `#f0ffe8` | Light tint |
| lime-100 | `#d4ffbf` | — |
| lime-200 | `#aeff87` | Hover wash |
| lime-300 | `#7fff5f` | Primary accent |
| lime-400 | `#5fd944` | Pressed |
| lime-500 | `#44b32e` | — |
| lime-600 | `#2e8c1c` | Deep accent |
| lime-700 | `#1d6610` | Text on lime |

## Colour — Semantic

| Token | Hex | Notes |
|-------|-----|--------|
| white / foreground | `#e8f5f2` | Primary text on dark surfaces |
| muted | `#8fbfb8` | Secondary text |
| border | `#2f6b62` | Default borders, inputs |
| amber | `#ffd166` | Warnings, streaks |
| danger | `#c0392b` | Destructive default |
| danger-hover | `#a93226` | Destructive hover |
| danger-press | `#922b22` | Destructive pressed |
| background | `#0d2b27` | App background (teal-900) |
| card | `#1a3d38` | Cards (teal-800) |
| input | `#2f6b62` | Input border (semantic.border) |
| ring | `#7fff5f` | Focus ring (lime-300) |

## Typography

Font family: **Plus Jakarta Sans** (`typography.fontFamily.sans`).

| Role | Size | Weight | Line height | Letter spacing |
|------|------|--------|-------------|------------------|
| Display | 32px | 800 | 1.15 | -0.03em |
| Heading | 22px | 700 | 1.25 | 0em |
| Subheading | 16px | 600 | 1.35 | 0em |
| Body | 15px | 400 | 1.6 | 0em |
| Label | 12px | 700 | 1.3 | 0.08em (uppercase in UI) |
| Caption | 11px | 700 | 1.3 | 0.1em (uppercase in UI) |

## Spacing

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 12px |
| lg | 16px |
| xl | 20px |
| xxl | 24px |
| 3xl | 32px |

## Border radius

| Token | Value |
|-------|-------|
| sm | 8px |
| md | 12px |
| lg | 14px |
| xl | 20px |
| 2xl | 24px |
| pill | 9999px |

## Button padding

| Variant | Vertical | Horizontal |
|---------|----------|------------|
| Default | 14px | 28px |
| Small | 9px | 18px |

Use Tailwind spacing tokens `button-default-y`, `button-default-x`, `button-small-y`, `button-small-x`, or component classes `.btn-padding-default` / `.btn-padding-sm` in `app/globals.css`.
