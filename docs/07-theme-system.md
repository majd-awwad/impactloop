# ImpactLoop Theme System

Current Flutter theme inventory and direction. This documents code reality only; it does not mean the UI is fully redesigned or visually complete.

**Inspected source files:**
- `apps/frontend/lib/app/app.dart`
- `apps/frontend/lib/app/application/app_settings_notifier.dart`
- `apps/frontend/lib/app/application/app_settings_storage.dart`
- `apps/frontend/lib/app/theme/app_color_tokens.dart`
- `apps/frontend/lib/app/theme/app_theme_colors.dart`
- `apps/frontend/lib/app/theme/app_colors.dart`
- `apps/frontend/lib/app/theme/app_theme.dart`
- `apps/frontend/lib/app/theme/app_spacing.dart`
- `apps/frontend/lib/app/theme/app_radius.dart`
- `apps/frontend/lib/app/theme/app_text_styles.dart`
- `apps/frontend/lib/app/theme/app_decorations.dart`
- `apps/frontend/lib/app/theme/auth_dark_colors.dart`
- `apps/frontend/lib/app/theme/auth_dark_decorations.dart`
- `apps/frontend/lib/app/theme/auth_dark_text_styles.dart`
- `apps/frontend/lib/app/theme/landing_colors.dart`
- `apps/frontend/lib/shared/widgets/app_status_badge.dart`
- `apps/frontend/lib/shared/widgets/materials/materials_ui_palette.dart`
- `apps/frontend/lib/features/auth/presentation/widgets/auth_ui_palette.dart`
- `apps/frontend/lib/features/learning_hub/presentation/theme/learning_ui_palette.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_ui_palette.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_theme_extension.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_decoration_set.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_text_styles.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_locale_scope.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_color_scheme.dart`

## Current Layers

| Layer | Source | Current role |
|-------|--------|--------------|
| Raw token source | `app_color_tokens.dart` | Centralizes `Color(0x...)` values for app, legacy auth, learning, supplier, and material palettes. |
| Central app theme | `app_theme.dart` | Builds `ThemeData` for light and dark Material 3 themes and installs `AppThemeColors` as a theme extension. |
| Semantic app colors | `app_theme_colors.dart` | Primary semantic color source for new UI, consumed through `AppThemeColors.of(context)`. |
| Static compatibility colors | `app_colors.dart` | Static app color aliases still used by `AppTheme`, `AppTextStyles`, and `AppDecorations`; not fully replaced by `AppThemeColors`. |
| Shared spacing/radius/text/decorations | `app_spacing.dart`, `app_radius.dart`, `app_text_styles.dart`, `app_decorations.dart` | Shared primitives, with some auth-specific values still present. |
| Legacy dark auth compatibility | `auth_dark_colors.dart`, `auth_dark_decorations.dart`, `auth_dark_text_styles.dart` | Auth entry compatibility layer; comments explicitly direct new theme-aware UI toward `AppThemeColors` or feature palettes. |
| Landing palette | `landing_colors.dart` | Light/dark landing surface palette derived from `AppThemeColors`. |
| Shared status presentation | `shared/widgets/app_status_badge.dart` | Theme-aware semantic tones and compact badges for primary, success, warning, danger, info, and neutral meanings. |
| Materials palette | `shared/widgets/materials/materials_ui_palette.dart` | Shared material-card/discovery bridge palette derived from `AppThemeColors` for cards, badges, and material metadata surfaces. |
| Auth palette | `features/auth/presentation/widgets/auth_ui_palette.dart` | Auth-scoped bridge palette derived from `AppThemeColors`; feature-specific, not global. |
| Learning palette | `features/learning_hub/presentation/theme/learning_ui_palette.dart` | Learning Hub bridge palette derived from `AppThemeColors` for project cards, chips, detail widgets, and build panels. |
| Supplier palette | `features/supplier_portal/presentation/theme/supplier_ui_palette.dart` | Supplier-scoped bridge palette derived from `AppThemeColors` at runtime while preserving compatibility helpers for older supplier widgets. |

## Light And Dark Mode

`ImpactLoopApp` wires:

- `theme: AppTheme.light`
- `darkTheme: AppTheme.dark`
- `themeMode: settings.themeMode`

`settings.themeMode` comes from `appSettingsProvider` in `app_settings_notifier.dart`. The default is `ThemeMode.system`, and changes are persisted through `AppSettingsStorage` in `app_settings_storage.dart`.

Theme-aware code currently uses a mix of:

- `Theme.of(context).brightness`
- `Theme.of(context).colorScheme`
- `AppThemeColors.of(context)`
- Feature palette helpers such as `AuthUiPalette.of(context)`, `MaterialsUiPalette.of(context)`, `LearningUiPalette.of(context)`, and `SupplierUiPalette.of(context)`

`AppThemeColors` is the primary semantic source for new presentation work. Feature palettes remain useful when a feature needs local names or compatibility with existing widgets, but they should derive from `AppThemeColors` where possible.

## Where New Colors Go

Use this order:

1. Add new raw hex values only in `apps/frontend/lib/app/theme/app_color_tokens.dart`.
2. If the color is app-wide semantic UI, expose it through `AppThemeColors.light` and `AppThemeColors.dark`.
3. If `ThemeData` controls the widget globally, wire it in `app_theme.dart`.
4. If the color belongs only to one feature, add a feature palette entry derived from `AppThemeColors` or, only when necessary, from `AppColorTokens`.

Do not add raw `Color(0x...)` values directly in pages or widgets. The current accepted raw-color location is `app_color_tokens.dart`.

`Colors.transparent` is currently used in some widgets as a literal transparent value. Other `Colors.*` usage should be limited to framework semantics or replaced with theme/palette values when touching that UI.

## Central App Theme

`AppTheme.light` and `AppTheme.dark` define:

- Material 3 `ColorScheme`
- `AppThemeColors.light` / `AppThemeColors.dark` extension
- scaffold background
- text theme
- icon, divider, menu, input, filled button, text button, outlined button, card, and snackbar themes

`AppTheme` still uses `AppColors` and some `AppColorTokens` directly, so the central theme has not fully migrated to `AppThemeColors`.

## Raw Token Source

`AppColorTokens` is the only current raw hex inventory. It includes:

- brand colors: emerald, forest, teal, mint, amber, blue, lime
- light/dark surfaces, text, borders, shadows, overlays
- learning-specific tokens
- legacy auth compatibility tokens
- supplier portal compatibility tokens
- supplier dashboard, request, pickup, notification, dialog, image, and map tokens

When adding a new token, name it by durable role or feature scope. Avoid one-off names tied to a single widget unless the token is intentionally feature-specific.

## Semantic Theme Extension

`AppThemeColors` is the app-wide semantic color extension. It includes page, surface, panel, card, brand, text, border, shadow, overlay, warning, danger, success, info, hero, fallback, and purple gradient semantics.

Use `AppStatusTone` and `AppStatusBadge` when the same state can appear across roles. Domain presenters may own their status-to-tone mapping, but must preserve common meaning: pending/review is warning; accepted/completed is success; rejected/cancelled/failed is danger; active/available is primary; scheduled/in-progress is info; and non-actionable metadata is neutral.

Preferred usage in reusable or cross-feature widgets:

```dart
final colors = AppThemeColors.of(context);
final textTheme = Theme.of(context).textTheme;
```

Use `Theme.of(context).colorScheme` when the widget should follow Material component semantics, especially errors and snackbar surfaces.

## Legacy Compatibility Colors

`AppColors` is still active. It is not just historical: `AppTheme`, `AppTextStyles`, and `AppDecorations` use it today.

`AuthDarkColors`, `AuthDarkDecorations`, and `AuthDarkTextStyles` are explicitly legacy/auth compatibility layers. Do not use them for new cross-feature UI.

## Supplier-Specific Theme

Current source reality:

- `SupplierUiPalette.of(context)` derives current supplier colors from `AppThemeColors`.
- `SupplierThemeX` exposes `context.supplierColors`, `context.supplierDecorations`, supplier text styles, supplier l10n, and RTL helpers.
- `SupplierDecorationSet` builds supplier-specific page, shell, card, nav, form, profile, and map decorations.
- Supplier My Materials helpers now derive active colors, spacing, radius, and button styles from `AppThemeColors`, `AppSpacing`, `AppRadius`, and `Theme.of(context).textTheme`.
- `SupplierColorScheme` is only a typedef to `SupplierUiPalette`.

Treat supplier theme as a scoped compatibility/theme-bridge layer, not an independent design system and not a cross-feature palette.

## Feature-Specific Palettes

| Palette | Source | Status |
|---------|--------|--------|
| `AuthUiPalette` | `features/auth/presentation/widgets/auth_ui_palette.dart` | Auth-scoped bridge palette derived from `AppThemeColors`; keep scoped unless auth widgets are promoted. |
| `LandingColors` | `app/theme/landing_colors.dart` | App-level landing palette derived from `AppThemeColors`. |
| `MaterialsUiPalette` | `shared/widgets/materials/materials_ui_palette.dart` | Shared material-card/discovery bridge palette derived from `AppThemeColors`; used by shared material widgets and badges. |
| `LearningUiPalette` | `features/learning_hub/presentation/theme/learning_ui_palette.dart` | Learning Hub bridge palette derived from `AppThemeColors`; scoped to project cards, chips, detail/build panels, and Learning Hub pages. |
| `SupplierUiPalette` | `features/supplier_portal/presentation/theme/supplier_ui_palette.dart` | Supplier-only bridge palette derived from `AppThemeColors`; preserve scoped helpers for compatibility. |

## Practical Rules

- New shared widgets should use `Theme.of(context).textTheme`, `Theme.of(context).colorScheme` where appropriate, `AppThemeColors.of(context)`, `AppSpacing`, and `AppRadius` first.
- Shared dialogs use `AppDialogShell`, `AppCloseButton`, and `AppDialogFooter` from `shared/widgets/`. Form dialogs use the shell's directional top-end close button and one primary footer action. Decision dialogs retain an explicit secondary Cancel action through `AppDialogFooter.decision`.
- Dialog and modal placement must use directional alignment and padding (`AlignmentDirectional`, `EdgeInsetsDirectional`) so close controls remain at the logical end in RTL.
- Prefer existing shared widgets (`AppTextField`, `AppDropdownField`, `AppPrimaryButton`, material cards/badges, snackbar helpers) before custom local styling.
- New feature-specific palettes may exist only when a feature has enough distinct visual semantics or compatibility needs to justify them.
- Feature palettes must stay scoped. Do not import auth, supplier, or learning palettes into unrelated features.
- Do not import supplier theme into non-supplier features.
- Do not import auth palette into non-auth features.
- Do not use `AppMaterialCard` with raw API DTOs; map values before the widget layer.
- When touching legacy auth, supplier, learning, or material UI, prefer moving local colors/radii/shadows toward `AppThemeColors`, `AppSpacing`, `AppRadius`, and text theme without changing behavior.
- Do not add raw `Color(0x...)` values in presentation widgets; new raw colors belong in `app_color_tokens.dart`.

## Not Complete Yet

Remaining legacy or uncertain areas:

- `AppColors` remains in active use beside `AppThemeColors`.
- Legacy dark auth theme files still exist and are feature-scoped.
- Feature palettes exist for auth, materials, landing, supplier, and learning as scoped bridge/compatibility layers rather than one removed abstraction.
- Large full-page files still contain local layout and styling, especially in admin pages, material detail/discovery screens, Learning Hub pages, and supplier profile/detail pages.
- Some page-level widgets still override shared styling locally; continue cleanup in small slices rather than full-page rewrites.
- Some providers and feature controllers live under `presentation/controllers`, not only `application/`; see `docs/frontend/state-management.md`.
