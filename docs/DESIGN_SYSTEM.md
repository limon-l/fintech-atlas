# Design system

## Intent

ATLAS is designed to feel like an institutional product rather than a dashboard template: calm density, precise numbers, restrained color and explicit state. The visual language combines **financial clarity**, **digital luxury** and **institutional trust**.

Three rules drive most decisions:

1. **The ledger is the hero.** Balances, postings and status are shown with the same care as marketing surfaces.
2. **Color never carries meaning alone.** Every status color is paired with text or an icon.
3. **Density is earned.** Tables and ledgers are compact; empty states, disclosures and primary actions keep breathing room.

## Token architecture

All semantic tokens live in `src/app/globals.css`. Components consume Tailwind utilities mapped through `@theme inline`; they do not hard-code light or dark colors.

| Token group | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f4f7fb` | `#070e1a` | Page background |
| `--surface` | `#ffffff` | `#0f1a2b` | Cards and panels |
| `--surface-2` | `#eef3f9` | `#152238` | Inset rows, secondary controls |
| `--foreground` | `#0f1e35` | `#edf4ff` | Primary text |
| `--muted` | `#5a6b83` | `#9eb0c8` | Supporting copy |
| `--subtle` | `#7d8ca1` | `#7f92ab` | Metadata, labels |
| `--border` | `#dbe4ef` | `#243651` | Default hairlines |
| `--primary` | `#2246a8` | `#8fadff` | Primary action and links |
| `--teal` | `#087e79` | `#5fdccb` | Positive / ledger accents |
| `--violet` | `#6b4fd0` | `#bdaaff` | Reversals and secondary emphasis |
| `--success` | `#137a58` | `#4bd3a3` | Posted, approved, healthy |
| `--warning` | `#9a6108` | `#f0b45e` | Processing, pending review |
| `--danger` | `#b0233c` | `#ff8296` | Failed, rejected, exceptions |

Each accent has a soft companion token (`--primary-soft`, `--success-soft`, and so on) used for badges, alerts and selected states. `--ring` drives focus outlines.

Charts use `--chart-1` through `--chart-6` with `--chart-grid`. Chart labels always name the currency or metric; no chart relies on color alone.

## Typography

- **Manrope** for UI and headings. Headings use tight tracking (`-0.02em` to `-0.045em`) and weights between 600 and 650.
- **IBM Plex Mono** for references, account IDs, amounts in dense tables, API snippets and eyebrow labels.
- Financial values use `.amount` or `.tabular` for tabular lining numerals and stable column alignment.
- Body copy is 13–14px with relaxed leading. Metadata is 9–11px and never the only way to understand a state.

## Layout and spacing

- Maximum marketing width: `1240px`.
- App shell: sticky `252px` sidebar on desktop, top bar, and a fixed four-item mobile bottom navigation.
- Page sections use `space-y-5`; cards use 16–20px internal padding; compact rows use 10–14px.
- Forms collapse to one column on small screens. Filter bars use a grid that becomes stacked below `sm`.
- Tables are horizontally scrollable. Detail pages use a two-column layout at `lg`/`xl` and stack on mobile.
- Safe-area padding is applied to the mobile navigation via `.safe-bottom`.

## Shape and elevation

Radius tokens run from `6px` (`xs`) to `32px` (`2xl`). Controls use `9–10px`, cards `11–18px`, hero surfaces up to `32px`.

`--shadow-soft` is the default card lift. `--shadow-float` is reserved for popovers and hero mockups. Borders remain visible in both themes so surfaces do not rely on shadow alone.

## Components

| Component | Path | Notes |
|---|---|---|
| Button | `src/components/ui/button.tsx` | Variants: primary, secondary, outline, ghost, danger; sizes and `asChild` |
| Badge / status pill | `src/components/ui/badge.tsx` | Semantic variants and status-to-variant mapping |
| Form controls | `src/components/ui/form.tsx` | Label, input, select, textarea, field hint, error |
| Submit button | `src/components/ui/submit-button.tsx` | Uses `useFormStatus`, disables while pending |
| Panel / stat / empty state | `src/components/ui/misc.tsx` | Page headers, stats, key-value rows, disclosure, sandbox note, avatars |
| Money | `src/components/ui/money.tsx` | Integer minor units only; signed and compact modes |
| Table | `src/components/ui/table.tsx` | Semantic table primitives with overflow wrapper |
| Charts | `src/components/ui/charts.tsx` | Recharts cashflow and spend visualizations |
| Overlay / sheet | `src/components/ui/overlay.tsx` | Radix dialog and sheet primitives |
| Dropdown | `src/components/ui/dropdown.tsx` | Radix dropdown with portal and animation |
| Copy button | `src/components/ui/copy-button.tsx` | Clipboard action with success feedback |
| Docs markdown | `src/components/docs/markdown.tsx` | Renders local `docs/*.md` through `marked` |
| Marketing chrome | `src/components/marketing/chrome.tsx` | Shared navigation and footer |

Feature components live in `src/components/app`: transfer composer, FX converter, cards, budgets, goals, business forms, operations forms, assistant and ledger visualizations.

## Money presentation

- Every amount is stored and calculated as an integer in minor units.
- `formatMoney` handles currency exponents, narrow symbols and signed display.
- Negative values use a true minus sign where the component supports it.
- Ledger postings show **debit** and **credit** labels alongside signed amounts.
- Holds are shown separately from ledger balance; available funds are never implied to be the same number.
- Dense tables use mono/tabular numerals; hero balances use a larger proportional treatment with a smaller currency symbol.

## Status language

| Domain state | Presentation |
|---|---|
| `posted`, `approved`, `verified`, `delivered` | Success pill or badge |
| `processing`, `pending`, `reviewing`, `investigating` | Warning pill or badge |
| `failed`, `rejected`, `exception`, `escalated` | Danger pill or badge |
| `draft`, `open`, `active` | Neutral or outline badge |

Status text is written in sentence case. Internal enum values are never shown without human-readable context in primary UI.

## Motion

- Motion is short and functional: 140–220ms, `cubic-bezier(0.16, 1, 0.3, 1)`.
- Keyframes include rise, fade-up, shimmer, float, pulse-ring, marquee, overlay, dialog and sheet entry.
- Hover lift is limited to cards and primary calls to action.
- `prefers-reduced-motion: reduce` disables smooth scrolling and reduces animation to near-zero duration.
- Focus is always visible through a 2px `--ring` outline with offset.

## Forms and feedback

- Labels are always visible; placeholders are examples, not labels.
- Validation errors appear next to the field and are announced through the form error region.
- Destructive or financial actions require an authorization PIN and show a confirmation step where appropriate.
- Submit buttons show a spinner and pending label, and are disabled during submission.
- Server action results are surfaced with toasts and inline errors.
- Empty states explain what is missing and, where useful, link to the next action.
- Every sandbox surface includes a disclosure that the data is synthetic.

## Accessibility

Implemented:

- semantic landmarks, headings and table headers;
- visible `:focus-visible` outlines;
- `aria-current="page"` on active navigation;
- labels tied to every input through `htmlFor`/`id`;
- text alongside status colors;
- reduced-motion support;
- keyboard-accessible Radix overlays and dropdowns;
- horizontally scrollable data regions rather than clipped content.

Not yet verified:

- automated axe or Lighthouse accessibility scores;
- measured color contrast across every token pair;
- screen-reader walkthroughs;
- full keyboard-only regression coverage;
- zoom/reflow testing at 200% and 400%.

Do not claim WCAG conformance until those checks are run and recorded.

## Responsive behavior

- Marketing pages stack hero, proof and pricing sections.
- The app shell replaces the sidebar with a four-item bottom navigation below `lg`.
- Page headers stack actions below the title on small screens.
- Tables scroll horizontally; detail metadata stacks.
- Forms use one column on mobile and two or three on larger screens.
- The operations console uses the same shell and navigation rules as personal and business workspaces.

## Documentation surfaces

The `/docs` routes render the repository markdown directly. `.doc-prose` styles headings, tables, code blocks, blockquotes and links without a typography plugin. The source is escaped before markdown parsing so raw HTML in docs cannot inject markup.

## Non-claims

This is an original visual system, not a copied product layout. It has not been through a formal design audit, visual regression suite, accessibility certification or performance measurement. The palette, type scale and component set are implemented in code and should be treated as a working system, not a finished brand guideline.
