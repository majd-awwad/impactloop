# Critical-route accessibility checklist

This checklist tracks semantics, tooltips, text-scale stability, and RTL coverage for routes that most users touch daily. It complements the route inventory in [routes-map.md](routes-map.md).

**CI gate:** `apps/frontend/test/a11y/critical_route_smoke_test.dart` (run via Baseline CI `flutter-a11y-smoke` job).

**Harness:** `apps/frontend/test/support/a11y_test_harness.dart` — mobile viewport `390×844`, text scale `1.4`.

## Legend

| Column | Meaning |
|--------|---------|
| **Semantics** | Icon-only or composite controls expose merged `Semantics` labels for screen readers |
| **Tooltips** | Icon-only actions have `Tooltip` text (or equivalent semantics hint) |
| **Text scale** | No layout overflow at scale 1.4 on mobile (`320–390px` width) |
| **RTL AR** | Arabic locale renders without English leakage on payment/reservation surfaces |
| **CI smoke** | Covered by `critical_route_smoke_test.dart` |

## Auth entry

| Route | Semantics | Tooltips | Text scale | RTL AR | CI smoke | Deep tests |
|-------|-----------|----------|------------|--------|----------|------------|
| `/login` | Form fields labeled | — | Pending (nav overflow at 1.3+) | — | Render smoke | `widget_test.dart` |
| `/register` | Intent + form fields | — | Pending (nav overflow at 1.3+) | — | Render smoke | `widget_test.dart` |

## Learner mobile shell

| Route | Semantics | Tooltips | Text scale | RTL AR | CI smoke | Deep tests |
|-------|-----------|----------|------------|--------|----------|------------|
| `/home` | Nav + notification bell | Bell tooltip | Yes | — | Yes | `learner_notifications_navigation_test.dart` |
| `/materials` | Discovery filters/cards | Refresh where icon-only | Yes | — | Yes | `material_discovery_*` |
| `/learning` | Hub cards + nav | — | Yes | — | Yes | `learning_hub_*` |
| `/learner/reservations` | Status badges, CTAs | Refresh (`تحديث` AR) | Yes | Yes | Yes | `learner_reservations_page_pay05a_r_test.dart` |
| `/profile` | Dashboard destinations | — | Yes | — | Yes | `profile_page_test.dart` |

## Authenticated detail flows

| Route | Semantics | Tooltips | Text scale | RTL AR | CI smoke | Deep tests |
|-------|-----------|----------|------------|--------|----------|------------|
| `/notifications` | Payment row labels | — | Yes | Yes | Yes | `pay06_ar_mobile_acceptance_test.dart` |
| `/profile/account` | Merged destination rows | Theme selector | Yes | — | Yes | `account_settings_page_test.dart` |
| `/profile/locations` | Location actions | Delete/edit icons | Yes | — | — | `saved_locations_page_test.dart` |
| `/learner/reservations/:id` | Primary CTA semantics | Refresh | Yes | Yes | — | `learner_reservation_detail_pay05b_test.dart` |
| `/learner/checkout/reservation/:id` | Payment summary | — | Yes | Yes | — | `learner_checkout_pay05c_test.dart` |

## Role portals

| Route | Semantics | Tooltips | Text scale | RTL AR | CI smoke | Deep tests |
|-------|-----------|----------|------------|--------|----------|------------|
| `/driver/jobs` (shell) | Mobile nav items | Nav icons | Yes | Yes | Yes | `driver_portal_first_release_test.dart` |
| `/supplier/overview` | Dashboard cards | — | — | — | — | `supplier_portal_*` |
| `/admin` | Overview metrics | — | — | — | — | `admin_portal_pages_render_test.dart` |

## Golden / screenshot regression (manual / optional CI)

Payment and location flows also have golden tests. These are **not** in the CI smoke job until PNG baselines are committed under `test/goldens/`:

| Test file | Surfaces |
|-----------|----------|
| `learner_reservations_page_pay05a_goldens_test.dart` | Reservations list |
| `learner_reservation_detail_pay05b_goldens_test.dart` | Reservation detail |
| `learner_checkout_pay05c_goldens_test.dart` | Checkout |
| `learner_notifications_pay05e_test.dart` | Notifications (tagged `golden`) |
| `saved_locations_screenshot_test.dart` | Saved locations |

Run locally: `flutter test --tags golden` (after generating or checking in baselines).

## Adding coverage

When shipping a new critical route:

1. Add a row to the table above.
2. Extend `critical_route_smoke_test.dart` with a pump at `a11ySmokeTextScale` and `expectNoLayoutExceptions`.
3. Add semantics/tooltip assertions for icon-only controls.
4. Link the row to the widget test file that owns deeper coverage.
