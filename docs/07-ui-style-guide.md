# ImpactLoop UI Style Guide

**Status:** auth-specific style reference. For current app-wide theme layers, raw tokens, semantic colors, dark/light mode, supplier theme, and feature palettes, use [07-theme-system.md](07-theme-system.md).

This file is kept because auth widgets still have feature-specific layout and palette rules. Do not treat it as the complete frontend theme system or as a separate design system from the central theme.

## Auth visual concept: Green loop, bright start

Auth screens use the same premium clean eco-tech direction as the rest of the app:

- Neutral form surfaces with green as the primary accent
- Feature badges/chips highlighting platform value
- Elevated form card with restrained border/shadow
- Distinct mobile and web layouts (mobile is not a squeezed desktop layout)
- Material 3 typography and controls

The Login screen is the reference implementation for auth layout. Future auth visual work should preserve behavior while deriving colors, type, spacing, and radius from central app theme primitives.

---

## Design tokens

### Color tokens

**Primary files:** `apps/frontend/lib/app/theme/app_theme_colors.dart`, `apps/frontend/lib/features/auth/presentation/widgets/auth_ui_palette.dart`

Auth widgets should use:

- `AppThemeColors.of(context)` for app-wide semantic colors
- `AuthUiPalette.of(context)` for auth-scoped compatibility names
- `Theme.of(context).textTheme` for typography
- `Theme.of(context).colorScheme` for Material component semantics where appropriate

`AppColors` and auth dark compatibility files still exist in code, but new auth styling should not add new dependencies on those legacy layers.

### Spacing tokens

**File:** `apps/frontend/lib/app/theme/app_spacing.dart`

| Token | Value | Purpose |
|-------|-------|---------|
| `xs`–`xxl` | 4–48 | General spacing scale |
| `authLayoutBreakpoint` | 700 | Web split vs mobile layout |
| `authFormMaxWidth` | 440 | Max width of form column |
| `authContentMaxWidth` | 520 | Max width of branding content |
| `authMobileHeroMinHeight` | 188 | Minimum mobile hero height |
| `authMobileHeroMaxHeightFraction` | 0.38 | Max hero height as screen fraction |
| `authBrandingPanelFlex` / `authFormPanelFlex` | 55 / 45 | Web split panel ratio |

### Radius tokens

**File:** `apps/frontend/lib/app/theme/app_radius.dart`

| Token | Value | Helpers |
|-------|-------|---------|
| `sm` | 8 | `smAll` |
| `md` | 12 | `mdAll` |
| `lg` | 16 | `lgAll` |
| `xl` | 24 | `xlAll` |
| `pill` | 999 | `pillAll` |

### Typography tokens

**File:** `apps/frontend/lib/app/theme/app_text_styles.dart`

| Style | Use |
|-------|-----|
| `display` | Auth screen titles (e.g. "Welcome back") |
| `title` | Section titles |
| `subtitle` | Auth screen subtitles |
| `body` | Body and footer text |
| `label` | Field labels |
| `link` | Text links (`AppLinkButton`) |
| `brandingTitle`, `brandingHeadline`, `brandingSubtitle` | Web branding panel |
| `mobileHeroTitle`, `mobileHeroSubtitle` | Mobile compact hero |
| `badgeLabel` | Feature badge/chip text |

Global Material 3 theme wiring: `apps/frontend/lib/app/theme/app_theme.dart`.

---

## Auth layout rules

### AuthShell

**File:** `apps/frontend/lib/features/auth/presentation/widgets/auth_shell.dart`

`AuthShell` is the root layout wrapper for every Auth screen.

| Layout enum | When | Structure |
|-------------|------|-----------|
| `AuthShellLayout.webSplit` | Width ≥ 700px | 55/45 horizontal split |
| `AuthShellLayout.mobile` | Width < 700px | Compact hero + scrollable form |

Each Auth page uses a `LayoutBuilder` at breakpoint `AppSpacing.authLayoutBreakpoint` to pick mobile or web view.

### Web auth layout

- Left: `AuthBrandingPanel(variant: full)` — gradient, blobs, headline, feature badges
- Right: `_FormPanel` — centered, scrollable form column (`authFormMaxWidth`)
- Background: central theme/auth palette surfaces
- Form content is passed as `formContent` — typically `AuthHeader` + `AuthFormCard`

### Mobile auth layout

- Top: compact `AuthBrandingPanel` inside a height constraint:
  - Minimum: `authMobileHeroMinHeight`
  - Maximum: `authMobileHeroMaxHeightFraction` of screen height
  - Content scrolls vertically inside the hero when text scale or small screens cause overflow
- Bottom: `Expanded` + `SingleChildScrollView` for the form area
- Horizontal chips scroll horizontally for feature badges
- Logo row uses `Expanded` on the title to avoid horizontal clipping

---

## Shared widgets

### AppTextField

**File:** `apps/frontend/lib/shared/widgets/app_text_field.dart`

- Wraps `TextFormField` with theme-driven `InputDecoration`
- Use for all auth form inputs
- Pair fields with `AppFieldGap` (vertical spacing between fields)
- Pass `validator`, `controller`, `keyboardType`, `obscureText`, and `autofillHints` as needed

### AppPrimaryButton

**File:** `apps/frontend/lib/shared/widgets/app_primary_button.dart`

- Full-width `FilledButton` for primary actions (e.g. "Sign in")
- Supports `isLoading` with inline spinner
- Use one primary button per form for the main submit action

### AppLinkButton

**File:** `apps/frontend/lib/shared/widgets/app_link_button.dart`

- Styled `TextButton` using `AppTextStyles.link`
- Use for secondary text actions (e.g. "Forgot password?", "Create account")
- Default alignment is `centerRight`; use `Alignment.center` for inline footer links

---

## Auth widgets

### AuthFormCard

**File:** `apps/frontend/lib/features/auth/presentation/widgets/auth_form_card.dart`

- Elevated card aligned to the central surface, radius, border, and shadow direction
- Wraps form fields and optional `footer` widget
- Inner padding: `AppSpacing.lg`
- Do not build custom card containers in Auth pages

### AuthBrandingPanel

**File:** `apps/frontend/lib/features/auth/presentation/widgets/auth_branding_panel.dart`

- Reusable branding panel for all Auth screens
- `AuthBrandingVariant.full` — web left panel
- `AuthBrandingVariant.compact` — mobile hero strip
- Includes gradient, blob layer, logo, tagline, and `AuthFeatureBadge` chips

### AuthHeader

**File:** `apps/frontend/lib/features/auth/presentation/widgets/auth_header.dart`

- Screen-specific `title` and `subtitle` above the form card
- Uses `AppTextStyles.display` and `AppTextStyles.subtitle`

---

## Rules for future Auth screens

1. **Reuse the shell** — Every Auth screen uses `AuthShell` + mobile/web views at breakpoint 700.
2. **Reuse form structure** — `AuthHeader` + `AuthFormCard` + screen-specific form widget + footer.
3. **Reuse shared widgets** — `AppTextField`, `AppPrimaryButton`, `AppLinkButton` only; no raw Material form controls in pages.
4. **Reuse branding** — Same `AuthBrandingPanel` on every Auth screen; only header, form, and footer copy change.
5. **No raw colors in presentation** — No `Color(0x…)` or non-semantic `Colors.*` in Auth pages, views, or widgets. Use `AppThemeColors`, `AuthUiPalette`, and central component themes.
6. **No magic spacing or radius** — Use `AppSpacing` and `AppRadius` in pages and views.
7. **No new dependencies** for visual-only Auth work unless explicitly approved.
8. **No generic admin UI** — No full-screen centered white card; always use the split/hero + elevated card pattern.
9. **Keep auth scoped** — Do not import auth palette/widgets into unrelated features unless a widget is promoted and documented as shared.

### RegisterPage reuse pattern

```
RegisterPage
  └─ LayoutBuilder (breakpoint 700)
       ├─ RegisterWebView
       │    └─ AuthShell(webSplit)
       │         └─ AuthHeader + AuthFormCard(RegisterForm, RegisterFooter)
       └─ RegisterMobileView
            └─ AuthShell(mobile)
                 └─ AuthHeader + AuthFormCard(RegisterForm, RegisterFooter)
```

Only `RegisterForm`, footer links, and `AuthHeader` copy differ from Login.

---

## File reference

| Concern | File |
|---------|------|
| Semantic colors | `app_theme_colors.dart` |
| Auth bridge palette | `auth_ui_palette.dart` |
| Spacing | `app_spacing.dart` |
| Radius | `app_radius.dart` |
| Typography | `app_text_styles.dart` |
| Gradients, shadows, blobs | `app_decorations.dart` |
| Material theme | `app_theme.dart` |
| Auth layout shell | `auth_shell.dart` |
| Branding panel | `auth_branding_panel.dart` |
| Form card | `auth_form_card.dart` |
| Login reference | `login_page.dart`, `login_mobile_view.dart`, `login_web_view.dart` |
