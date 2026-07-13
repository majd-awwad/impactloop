# Reusable Widgets

Current Flutter widget reuse inventory. Prefer documented shared/app widgets before creating new reusable UI.

**Inspected source files:**
- `apps/frontend/lib/app/widgets/entry_nav_bar.dart`
- `apps/frontend/lib/app/widgets/app_mobile_bottom_nav_bar.dart`
- `apps/frontend/lib/app/widgets/hero_workshop_visual.dart`
- `apps/frontend/lib/app/widgets/impact_loop_logo.dart`
- `apps/frontend/lib/app/widgets/nav_pill_menu.dart`
- `apps/frontend/lib/shared/widgets/app_dropdown_field.dart`
- `apps/frontend/lib/shared/widgets/app_feedback.dart`
- `apps/frontend/lib/shared/widgets/app_inline_error.dart`
- `apps/frontend/lib/shared/widgets/app_link_button.dart`
- `apps/frontend/lib/shared/widgets/app_primary_button.dart`
- `apps/frontend/lib/shared/widgets/app_text_area.dart`
- `apps/frontend/lib/shared/widgets/app_text_field.dart`
- `apps/frontend/lib/shared/widgets/materials/app_material_card.dart`
- `apps/frontend/lib/shared/widgets/materials/material_condition_badge.dart`
- `apps/frontend/lib/shared/widgets/materials/material_price_badge.dart`
- `apps/frontend/lib/shared/widgets/materials/material_status_badge.dart`
- `apps/frontend/lib/shared/widgets/materials/materials_ui_palette.dart`
- `apps/frontend/lib/features/auth/presentation/widgets/**`
- `apps/frontend/lib/features/home/presentation/widgets/**`
- `apps/frontend/lib/features/landing/presentation/widgets/**`
- `apps/frontend/lib/features/learning_hub/presentation/widgets/**`
- `apps/frontend/lib/features/material_discovery/presentation/widgets/**`
- `apps/frontend/lib/features/supplier_portal/presentation/widgets/**`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/**`

Theme details are documented in [07-theme-system.md](../07-theme-system.md). State/provider placement is documented in [state-management.md](state-management.md).

New reusable UI should prefer `Theme.of(context).textTheme`, `Theme.of(context).colorScheme` where appropriate, `AppThemeColors.of(context)`, `AppSpacing`, and `AppRadius` before local styling. Raw `Color(0x...)` values do not belong in presentation widgets; add raw values only to `app_color_tokens.dart`.

## Shared Widgets

`apps/frontend/lib/shared/widgets/` is the current cross-feature reusable widget area.

### Form And Feedback

| Widget/helper | File | Current purpose |
|---------------|------|-----------------|
| `AppTextField` | `app_text_field.dart` | Themed single-line or controlled multiline `TextFormField`; supports validation, forced error text, autofill, submit, change callbacks, and optional `suffixIcon`. |
| `AppPasswordField` | `app_password_field.dart` | Password variant of `AppTextField` with per-field visibility toggle (or optional shared `obscureOverride` / `onToggleVisibility`), tooltip, and semantic labels. |
| `AppFieldGap` | `app_text_field.dart` | Standard vertical field gap using `AppSpacing.md`. |
| `AppTextArea` | `app_text_area.dart` | Themed multiline text field with label, hint, validation, forced error text, and callbacks. |
| `AppDropdownField<T>` | `app_dropdown_field.dart` | Themed `DropdownButtonFormField` using generic values, forced error text, and nullable `onChanged` for disabled/loading states. |
| `AppPrimaryButton` | `app_primary_button.dart` | Full-width `FilledButton`; disables itself and shows a spinner when `isLoading` is true. |
| `AppLinkButton` | `app_link_button.dart` | Aligned text button using `AppTextStyles.link`. |
| `AppInlineError` | `app_inline_error.dart` | Inline body-small error text using `Theme.of(context).colorScheme.error`. |
| `AppStatusBadge` / `AppStatusTone` / `AppStatusStyle` | `app_status_badge.dart` | Theme-aware, route-independent semantic status presentation for primary, success, warning, danger, info, and neutral states. |
| `AppSectionCard` | `app_section_card.dart` | Theme-aware, content-agnostic section surface with optional semantic tone and emphasis. |
| `showErrorSnackBar` | `app_feedback.dart` | Error snackbar using normalized API-friendly message text. |
| `showInfoSnackBar` | `app_feedback.dart` | Informational snackbar. |
| `UserAvatar` | `user_avatar.dart` | Circular user avatar from `profileImageUrl` with `ApiConfig.resolveMediaUrl`; falls back to display-name initial on empty URL or image load error. |

No `showSuccessSnackBar` exists in current code.

### Materials

`apps/frontend/lib/shared/widgets/materials/` contains route-independent material display primitives.

| Widget/type | File | Current purpose |
|-------------|------|-----------------|
| `ImpactMaterialGridCard` | `app_material_card.dart` | Compact marketplace-style public material grid card. It accepts display-ready material values, optional image URL, tap callback, variant, fallback icon, and renders image-first media, category/price overlays, metadata rows, status badge, and details affordance using central theme-derived material presentation tokens. |
| `ImpactMaterialCompactCard` | `app_material_card.dart` | Mobile-first horizontal public material card. It accepts the same display-ready values as the grid card and uses compact media, metadata, price/status badges, and details affordance for narrow layouts. |
| `AppMaterialCard` | `app_material_card.dart` | Backward-compatible wrapper around `ImpactMaterialGridCard` for existing discovery-shaped material card call sites. |
| `AppMaterialCardVariant` | `app_material_card.dart` | `standard` and `compact` card sizing. |
| `MaterialStatusBadge` / `MaterialStatusBadgeTone` / `materialLifecycleStatusTone` | `material_status_badge.dart` | Material lifecycle badge and canonical status mapper: available is primary, reservation states are warning, reused is success, unavailable is danger, and unknown/draft values are neutral. |
| `MaterialConditionBadge` / `MaterialConditionBadgeTone` | `material_condition_badge.dart` | Like-new/good/fair/mixed condition badge derived from `AppThemeColors`, shared spacing/radius, and text theme. |
| `MaterialPriceBadge` | `material_price_badge.dart` | Free/paid price badge derived from `AppThemeColors`, shared spacing/radius, and text theme. |
| `MaterialsUiPalette` and material constants | `materials_ui_palette.dart` | Shared material-card/discovery bridge palette and badge/card sizing constants derived from the central app theme. |

`AppMaterialCard` must stay API- and router-independent. Map API DTOs into labels, tones, booleans, and callbacks before passing them to the widget.

## App-Level Widgets

`apps/frontend/lib/app/widgets/` contains reusable app/entry-surface widgets, not feature business widgets.

| Widget | File | Current purpose |
|--------|------|-----------------|
| `EntryNavBar` | `entry_nav_bar.dart` | Consumer top nav for landing/entry surfaces. It watches auth/settings state. Desktop/tablet surfaces keep top navigation and utility controls; phone widths use a compact logo + account/menu app bar with theme/language inside the menu. |
| `AppMobileNavigationShell` / `AppMobileBottomNavBar` / `appMobileAwareScrollPadding` | `app_mobile_bottom_nav_bar.dart` | Phone-only shell and floating bottom navigation for primary learner/public destinations (`Home`, `Materials`, `Learning`, `Reservations`, `Profile`) plus a helper that adds safe bottom padding to scrollable pages. The shell returns the child unchanged at tablet/desktop widths. |
| `ImpactLoopLogo` | `impact_loop_logo.dart` | Brand mark/wordmark with optional colors and compact mode. |
| `HeroWorkshopVisual` | `hero_workshop_visual.dart` | Landing hero visual using landing assets/palette. App-level but landing-oriented. |
| `NavPillMenu<T>` | `nav_pill_menu.dart` | Generic pill-style menu for selecting one value from a typed list. |

`EntryNavBar` is app-level but not purely presentational because it watches `authControllerProvider` and `appSettingsProvider`.

## Feature-Specific Widgets

Widgets under `features/<feature>/presentation/widgets/` are not shared by default. Reuse them only inside their owning feature unless promoted.

### Auth

Source: `apps/frontend/lib/features/auth/presentation/widgets/`

Feature-specific widgets include:

- `AuthShell`
- `AuthBrandingPanel`
- `AuthEntryBrandingPanel`
- `AuthFormCard`
- `AuthHeader`
- `AuthFeatureBadge`
- `AuthTextField`
- `AuthPasswordField`
- `LoginForm`
- `UnifiedRegisterForm`
- `CompleteLearnerProfileForm`
- `CompleteSupplierProfileForm`
- auth branding assets and buttons
- `AuthUiPalette`

Auth widgets use auth-specific layout and bridge-palette rules derived from `AppThemeColors`. Keep them auth-scoped unless a widget is deliberately promoted and decoupled from auth copy, registration flow, and auth palette.

Candidate for future reuse:

| Candidate | Why not shared yet |
|-----------|--------------------|
| `AuthTextField` / `AuthPasswordField` | Auth palette and visual treatment are feature-specific; shared form controls already exist as `AppTextField` and `AppTextArea`. |
| `AuthFormCard` | Tied to auth screen composition and styling. |
| `AuthShell` | Tied to auth entry layouts and branding. |

### Supplier Portal

Source: `apps/frontend/lib/features/supplier_portal/presentation/widgets/` and `presentation/theme/`

Supplier widgets are supplier-feature UI and should not be reused across other features yet. The supplier palette/decorations are scoped bridge layers derived from `AppThemeColors` where possible, not independent shared design systems. Supplier widgets include:

- request dialogs and cards
- pickup schedule cards/dialogs/filter chips/status styles
- supplier profile cards/forms/location widgets
- dashboard cards/charts/panels
- supplier material cards/grid/filter/summary widgets
- supplier shell/top/sidebar/profile/navigation widgets outside the inspected widget folder
- supplier theme, palette, decoration, text, locale helpers

Candidate for future reuse:

| Candidate | Why not shared yet |
|-----------|--------------------|
| `SupplierMaterialCard` | Supplier-owned material actions and supplier palette differ from public `AppMaterialCard`. |
| supplier filter chip widgets | Tied to supplier enums, queries, and theme. |
| supplier dashboard/stat cards | Tied to supplier metrics and supplier theme extension. |
| `SupplierDarkFormField` | Supplier theme-specific; shared form fields already exist. |

Treat supplier theme as scoped/legacy-compatible; see [07-theme-system.md](../07-theme-system.md). Do not import supplier palette/helpers into non-supplier UI.

### Material Discovery

Source: `apps/frontend/lib/features/material_discovery/presentation/widgets/`

Feature widgets:

- `MaterialSearchFilters`
- `MaterialsHeroSection`
- `NearbyMapPlaceholder`

These are discovery-page composition widgets. Shared material card/badge primitives live under `shared/widgets/materials/`.

Candidate for future reuse:

| Candidate | Why not shared yet |
|-----------|--------------------|
| `MaterialSearchFilters` | Tied to discovery filter behavior and page state. |

### Learning Hub

Source: `apps/frontend/lib/features/learning_hub/presentation/widgets/`

Feature widgets include project cards, hero, category chips, text helpers, component/step/link sections, project build actions panel, project link list, and mock rating summary card.

Do not reuse these outside learning hub yet. The learning hub list/detail, add-draft submit flow, and admin moderation are API-backed, but these widgets are still coupled to learning-specific models and `LearningUiPalette`, which should remain an AppThemeColors-derived bridge layer.

### Home And Landing

Sources:

- `apps/frontend/lib/features/home/presentation/widgets/`
- `apps/frontend/lib/features/landing/presentation/widgets/`

Home widgets are learner-home section/card widgets. Landing widgets are page-specific hero/nav/feature/footer composition. They are not promoted to shared.

Candidate for future reuse:

| Candidate | Why not shared yet |
|-----------|--------------------|
| `HomeSectionHeader` | Looks generic, but currently belongs to learner home and should not be reused until another feature needs the same API. |
| landing feature cards | Marketing/landing-specific content and layout. |

## Where A Widget Belongs

Use `shared/widgets/` when all are true:

- It is needed by more than one feature or is clearly a cross-feature primitive.
- It does not import feature-specific providers, repositories, routes, DTOs, l10n, or palettes.
- It accepts display values and callbacks instead of fetching data.
- It works in light/dark mode through `Theme.of(context).textTheme`, `Theme.of(context).colorScheme`, `AppThemeColors`, shared spacing/radius, or a documented shared palette.
- It is documented in this file.

Use `app/widgets/` when the widget is app shell/entry/brand infrastructure rather than feature business UI.

Keep the widget inside a feature when:

- It uses feature-specific state, models, providers, or route assumptions.
- It needs a feature palette such as auth, learning, or supplier.
- It contains feature copy or user-flow assumptions.
- It has only one current feature consumer.

## Reuse Rules

- Reuse `AppTextField`, `AppTextArea`, `AppDropdownField`, `AppPrimaryButton`, `AppLinkButton`, `AppInlineError`, and snackbar helpers before creating feature form controls.
- Reuse `ImpactMaterialGridCard` for tablet/desktop public material grids, `ImpactMaterialCompactCard` for narrow mobile lists, and material badges for public/discovery-shaped material displays. Existing `AppMaterialCard` call sites can remain as compatibility wrappers.
- Do not import supplier widgets into learner/public features.
- Do not import auth widgets into non-auth features.
- Do not import learning-specific widgets or palettes into non-learning features without promotion.
- Do not add API calls to reusable widgets.
- Promote candidates only when a second real usage appears and the widget can be decoupled cleanly.

## Current Limitations

The UI rescue work moved several shared and feature bridge palettes toward the central theme, but the frontend is not fully redesigned. Large page files still contain local layout/styling, especially in admin pages, material detail/discovery screens, Learning Hub pages, and supplier profile/detail surfaces. Continue cleanup in scoped slices and prefer shared widgets before adding new local decorations.
