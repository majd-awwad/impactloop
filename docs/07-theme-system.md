# ImpactLoop Theme System

Current Flutter theme inventory. This documents code reality only; it does not mean the UI theme refactor is complete.

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
- `apps/frontend/lib/shared/widgets/materials/materials_ui_palette.dart`
- `apps/frontend/lib/features/auth/presentation/widgets/auth_ui_palette.dart`
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
| Semantic app colors | `app_theme_colors.dart` | Light/dark semantic `ThemeExtension` consumed through `AppThemeColors.of(context)`. |
| Static compatibility colors | `app_colors.dart` | Static app color aliases still used by `AppTheme`, `AppTextStyles`, and `AppDecorations`; not fully replaced by `AppThemeColors`. |
| Shared spacing/radius/text/decorations | `app_spacing.dart`, `app_radius.dart`, `app_text_styles.dart`, `app_decorations.dart` | Shared primitives, with some auth-specific values still present. |
| Legacy dark auth compatibility | `auth_dark_colors.dart`, `auth_dark_decorations.dart`, `auth_dark_text_styles.dart` | Auth entry compatibility layer; comments explicitly direct new theme-aware UI toward `AppThemeColors` or feature palettes. |
| Landing palette | `landing_colors.dart` | Light/dark landing surface palette derived from `AppThemeColors`. |
| Materials palette | `shared/widgets/materials/materials_ui_palette.dart` | Material discovery/card palette with dark constants and light values derived mostly from `AppThemeColors`. |
| Auth palette | `features/auth/presentation/widgets/auth_ui_palette.dart` | Auth-scoped light/dark palette derived from `AppThemeColors`; feature-specific, not global. |
| Supplier palette | `features/supplier_portal/presentation/theme/supplier_ui_palette.dart` | Supplier-scoped palette preserving supplier portal visuals; dark mode reuses legacy auth tokens. |

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
- Feature palette helpers such as `MaterialsUiPalette.of(context)` and `SupplierUiPalette.of(context)`

This is not a single completed theme abstraction yet.

## Where New Colors Go

Use this order:

1. Add new raw hex values only in `apps/frontend/lib/app/theme/app_color_tokens.dart`.
2. If the color is app-wide semantic UI, expose it through `AppThemeColors.light` and `AppThemeColors.dark`.
3. If `ThemeData` controls the widget globally, wire it in `app_theme.dart`.
4. If the color belongs only to one feature, add a feature palette entry derived from tokens or `AppThemeColors`.

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

Preferred usage in reusable or cross-feature widgets:

```dart
final colors = AppThemeColors.of(context);
```

Use `Theme.of(context).colorScheme` when the widget should follow Material component semantics, especially errors and snackbar surfaces.

## Legacy Compatibility Colors

`AppColors` is still active. It is not just historical: `AppTheme`, `AppTextStyles`, and `AppDecorations` use it today.

`AuthDarkColors`, `AuthDarkDecorations`, and `AuthDarkTextStyles` are explicitly legacy/auth compatibility layers. Do not use them for new cross-feature UI.

## Supplier-Specific Theme

Supplier portal theme is separate and scoped to `features/supplier_portal/presentation/theme/`.

Current source reality:

- `SupplierUiPalette` chooses light or dark based on app brightness and `AppThemeColors`.
- Supplier dark values reuse legacy auth tokens.
- Supplier light values use supplier-specific tokens.
- `SupplierThemeX` exposes `context.supplierColors`, `context.supplierDecorations`, supplier text styles, supplier l10n, and RTL helpers.
- `SupplierDecorationSet` builds supplier-specific page, shell, card, nav, form, profile, and map decorations.
- `SupplierColorScheme` is only a typedef to `SupplierUiPalette`.

Treat supplier theme as scoped/legacy-compatible, not unified with the central app theme.

## Feature-Specific Palettes

| Palette | Source | Status |
|---------|--------|--------|
| `AuthUiPalette` | `features/auth/presentation/widgets/auth_ui_palette.dart` | Feature-specific auth palette; candidate to keep scoped unless auth widgets are promoted. |
| `LandingColors` | `app/theme/landing_colors.dart` | App-level landing palette derived from `AppThemeColors`. |
| `MaterialsUiPalette` | `shared/widgets/materials/materials_ui_palette.dart` | Shared material-card/discovery palette; used by shared material widgets. |
| `SupplierUiPalette` | `features/supplier_portal/presentation/theme/supplier_ui_palette.dart` | Supplier-only palette; separate from central theme. |
| Learning tokens | `app_color_tokens.dart`, `features/learning_hub/presentation/theme/learning_ui_palette.dart`, `features/learning_hub/data/learning_hub_mock_data.dart` | Learning Hub list/detail and submit flows are API-backed; legacy mock data remains for the unused sample catalog only. |

## Practical Rules

- New shared widgets should use `Theme.of(context).colorScheme` and `AppThemeColors.of(context)` first.
- New feature-specific palettes may exist only when a feature has enough distinct visual semantics to justify them.
- Do not import supplier theme into non-supplier features.
- Do not import auth palette into non-auth features.
- Do not use `AppMaterialCard` with raw API DTOs; map values before the widget layer.
- When touching legacy auth or supplier UI, preserve current visuals unless the task explicitly asks for unification.

## Not Complete Yet

Remaining legacy or uncertain areas:

- `AppColors` remains in active use beside `AppThemeColors`.
- Legacy dark auth theme files still exist and are feature-scoped.
- Supplier portal has a separate palette and decorations system.
- Feature palettes exist for auth, materials, landing, supplier, and learning rather than a single unified semantic system.
- Some providers and feature controllers live under `presentation/controllers`, not only `application/`; see `docs/frontend/state-management.md`.
