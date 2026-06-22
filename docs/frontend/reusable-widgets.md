# Reusable Widgets

Widget inventory for Flutter UI reuse. **Source:** `apps/frontend/lib/shared/widgets/`, `apps/frontend/lib/app/widgets/`, and feature folders.

## Shared widgets (`lib/shared/widgets/`)

**Intended for reuse** across features. Prefer these before creating new form controls or material display primitives.

**Inspected:** all `.dart` files under `shared/widgets/`

### Form and feedback

| Widget | File | Purpose |
|--------|------|---------|
| `AppTextField` | `app_text_field.dart` | Themed text input; includes `AppFieldGap` |
| `AppTextArea` | `app_text_area.dart` | Multiline input |
| `AppDropdownField<T>` | `app_dropdown_field.dart` | Themed dropdown |
| `AppPrimaryButton` | `app_primary_button.dart` | Full-width primary action with loading state |
| `AppLinkButton` | `app_link_button.dart` | Text link button |
| `AppInlineError` | `app_inline_error.dart` | Inline error text |
| `showErrorSnackBar`, `showInfoSnackBar`, `showSuccessSnackBar` | `app_feedback.dart` | Snackbar helpers (functions, not widgets) |

### Materials (`shared/widgets/materials/`)

Designed for public discovery and any material list/detail surface.

| Widget | File | Purpose |
|--------|------|---------|
| `AppMaterialCard` | `app_material_card.dart` | Route-independent material card; **must not** import GoRouter or call APIs |
| `MaterialStatusBadge` | `material_status_badge.dart` | Status chip |
| `MaterialConditionBadge` | `material_condition_badge.dart` | Condition chip |
| `MaterialPriceBadge` | `material_price_badge.dart` | Price / free display |
| `MaterialsUiPalette` | `materials_ui_palette.dart` | Shared colors for material UIs |

**Architecture rule** (from supplementary [material-discovery-handoff.md](material-discovery-handoff.md), still valid): map API DTOs before passing data into `AppMaterialCard`. Canonical API list: [backend/api-catalog.md](../backend/api-catalog.md).

---

## App-level widgets (`lib/app/widgets/`)

Shared across entry/marketing surfaces — not feature-specific.

**Inspected:** all `.dart` files under `app/widgets/`

| Widget | File | Purpose |
|--------|------|---------|
| `EntryNavBar` | `entry_nav_bar.dart` | Top nav for landing, learning hub, materials discovery |
| `ImpactLoopLogo` | `impact_loop_logo.dart` | Brand logo |
| `HeroWorkshopVisual` | `hero_workshop_visual.dart` | Landing hero illustration |
| `NavPillMenu<T>` | `nav_pill_menu.dart` | Generic pill tab menu |

---

## Feature-specific widgets — **do not reuse yet**

These live inside feature folders and are tied to auth, supplier portal, or learning hub styling. Copying them into other features is discouraged until promoted to `shared/` or `app/widgets/`.

### Auth (`features/auth/presentation/widgets/`)

**Inspected:** public widget classes in auth widgets folder

Examples: `AuthShell`, `AuthBrandingPanel`, `AuthEntryBrandingPanel`, `AuthFormCard`, `AuthHeader`, `AuthTextField`, `LoginForm`, `UnifiedRegisterForm`, `CompleteLearnerProfileForm`, `CompleteSupplierProfileForm`, dark-auth variants (`DarkAuthShell`, `DarkAuthFormCard`, …).

Documented visually in [07-ui-style-guide.md](../07-ui-style-guide.md) — auth-only.

**Legacy / unwired:** `ChooseRoleForm` + `choose_role_page.dart` (page not in router).

### Supplier portal (`features/supplier_portal/presentation/widgets/`)

Large feature-specific set including shell (`supplier_shell.dart`, `supplier_sidebar.dart`), dashboard charts, pickup schedule, profile cards, dialogs.

**Not for cross-feature reuse yet:**

| Widget | File | Why |
|--------|------|-----|
| `SupplierMaterialCard` | `widgets/materials/supplier_material_card.dart` | Supplier-themed card; parallel to but separate from `AppMaterialCard` |
| `SupplierMaterialsGrid`, filter chips, summary row | `widgets/materials/*` | Supplier my-materials layout |
| Dashboard widgets | `widgets/dashboard/*` | Supplier dashboard only |
| Theme types | `presentation/theme/*` | `SupplierThemeExtension`, palettes — supplier scope only |

Supplier portal **does** reuse `AppMaterialCard` in some flows per handoff doc — prefer shared card when showing discovery-shaped data.

### Learning hub (`features/learning_hub/presentation/widgets/`)

All widgets assume mock data and learning-specific palette (`LearningUiPalette` in learning hub code).

Examples: `LearningProjectCard`, `FeaturedProjectCard`, `LearningHubHero`, `DisabledAiPanel`, `MockRatingSummaryCard`.

**Do not reuse** until learning hub is API-backed and widgets are decoupled from `learning_hub_mock_data.dart`.

### Landing / home (`features/landing/`, `features/home/`)

Presentation widgets are page-specific (hero sections, feature cards, spotlight). **Not promoted** to shared.

### Materials data feature (`features/materials/`)

No `presentation/pages/` routes — data layer + providers only. UI for listing lives in `supplier_portal` add-material flow.

---

## Promotion criteria (for future docs)

Move a widget to `shared/widgets/` when:

1. Used (or planned) in **two or more features**
2. No feature-specific theme extension required
3. No direct API calls inside the widget
4. Documented in this file

When promoting, update [00-ai-docs-router.md](../00-ai-docs-router.md) Flutter section pointers.
