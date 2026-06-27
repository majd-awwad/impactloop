# ADR 0006: Frontend Theme And Reusable UI Direction

## Status
Accepted

## Context

The Flutter app has central theme files, raw color tokens, a semantic theme extension, shared widgets, app-level widgets, and feature-specific palettes. The current theme is not fully unified: supplier and legacy auth areas remain scoped and must be documented as such.

## Decision

Use a central frontend theme and reusable UI direction based on current code:

- Keep raw hex colors centralized in `AppColorTokens`.
- Use `AppTheme` and `AppThemeColors` for central light/dark theme semantics.
- Use shared widgets from `shared/widgets/` for cross-feature primitives.
- Keep app shell/brand widgets under `app/widgets/`.
- Keep feature-specific widgets inside their feature until they are proven reusable.
- Treat supplier theme and legacy auth compatibility colors as scoped, not unified.

## Consequences

- New raw `Color(0x...)` values belong in `apps/frontend/lib/app/theme/app_color_tokens.dart`, not pages or widgets.
- Shared widgets should avoid feature providers, DTOs, routes, and feature palettes.
- Supplier theme should not be imported into non-supplier features.
- Auth-specific widgets should not be reused outside auth without promotion.
- The theme refactor must not be described as complete while `AppColors`, legacy auth files, supplier theme, and feature palettes remain active.

## Current implementation evidence

- [docs/07-theme-system.md](../07-theme-system.md) documents the raw token source, central app theme, semantic extension, compatibility colors, supplier theme, feature palettes, dark/light mode, and raw color rules.
- [docs/frontend/reusable-widgets.md](../frontend/reusable-widgets.md) documents shared widgets, app-level widgets, feature-specific widgets, reuse rules, and promotion criteria.
- [docs/frontend/state-management.md](../frontend/state-management.md) documents current Riverpod/provider organization and warns that supplier providers are split between `application/` and `presentation/controllers/`.
- [apps/frontend/lib/app/theme/app_color_tokens.dart](../../apps/frontend/lib/app/theme/app_color_tokens.dart) centralizes raw color tokens.
- [apps/frontend/lib/app/theme/app_theme.dart](../../apps/frontend/lib/app/theme/app_theme.dart) defines `AppTheme.light` and `AppTheme.dark`.
- [apps/frontend/lib/app/theme/app_theme_colors.dart](../../apps/frontend/lib/app/theme/app_theme_colors.dart) defines the `AppThemeColors` theme extension.
- [apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_ui_palette.dart](../../apps/frontend/lib/features/supplier_portal/presentation/theme/supplier_ui_palette.dart) defines the supplier-specific palette.
- [apps/frontend/lib/shared/widgets/](../../apps/frontend/lib/shared/widgets/) contains current shared widgets.
- [apps/frontend/lib/app/widgets/](../../apps/frontend/lib/app/widgets/) contains current app-level widgets.

## Related docs

- [docs/07-theme-system.md](../07-theme-system.md)
- [docs/frontend/reusable-widgets.md](../frontend/reusable-widgets.md)
- [docs/frontend/state-management.md](../frontend/state-management.md)
- [docs/07-ui-style-guide.md](../07-ui-style-guide.md)
