# OneOrigin Sans Font Reference

## Font Details

| Property | Value |
|----------|-------|
| **Name** | OneOrigin Sans |
| **Type** | Variable font (weight axis 100–900) |
| **Format** | woff2, ttf |
| **CDN Host** | `fonts.oneorigin.us` |

## CDN URLs

| Format | URL |
|--------|-----|
| Variable woff2 | `https://fonts.oneorigin.us/Variable/OneOriginSansVariable.woff2` |
| Variable ttf | `https://fonts.oneorigin.us/Variable/OneOriginSansVariable.ttf` |

## Available CDN Paths

| Path | Contents |
|------|----------|
| `/TTF/` | Static weight TTF files |
| `/WOFF2/` | Static weight WOFF2 files |
| `/Variable/` | Variable font files (used in this project) |
| `/packages/` | Bundled font packages |

## CSS Snippet

```css
@font-face {
  font-family: "OneOrigin Sans";
  src: url("https://fonts.oneorigin.us/Variable/OneOriginSansVariable.woff2") format("woff2"),
       url("https://fonts.oneorigin.us/Variable/OneOriginSansVariable.ttf") format("truetype");
  font-weight: 100 900;
  font-display: swap;
}
```

## Integration in This Project

- **`@font-face`** declared in `src/app/globals.css` (top of file, before `@layer base`)
- **Preload** via `<link rel="preload">` in `src/app/layout.tsx` for faster first paint
- **Tailwind** `font-sans`, `font-mono`, `font-serif` all resolve to `"OneOrigin Sans"` via `tailwind.config.ts`
- **CSS variables** `--font-serif` and `--font-mono` set to `"OneOrigin Sans"` in `:root` and `.dark`
- **Body** default `font-family` set to `"OneOrigin Sans", sans-serif`
