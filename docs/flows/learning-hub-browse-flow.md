# Learning Hub Browse Flow

**Sources inspected:** `learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_add_draft_page.dart`, `learning_hub_mock_data.dart`, `learning-projects.service.ts`, `learning-projects.repository.ts`

## Trigger

User opens **Learning Hub** from landing nav (`/learning`) or direct link to `/learning/:id`.

---

## Flow — Browse project list (current Flutter behavior)

### User path

1. Land on Learning Hub hero + category chips + featured card + project grid.
2. Tap **Load more** to reveal more mock projects (chunk size 4).
3. Tap a project card → detail page.

### Frontend path

`LearningHubPage` imports `learning_hub_mock_data.dart`:

- `learningProjects` list filtered locally (`isFeatured`, category).
- **No HTTP client**, **no** `ApiMaterialDiscoveryRepository`-style repository.

### Backend path

**Not invoked** by this flow today.

*(When integrated, expected path: `GET /api/learning-projects` → map DTOs to `LearningProject` domain model.)*

### Database changes

**None** in current UI flow.

### Success state

Grid shows cards; featured section populated from mock constants.

### Error states

N/A for static mock (no network). Future API: standard `ApiException` handling — **not implemented**.

### Files involved

`learning_hub_page.dart`, `learning_hub_mock_data.dart`, `learning_project_card.dart`, `featured_project_card.dart`, `learning_category_chips.dart`

---

## Flow — Project detail (mock)

### Trigger

Navigation to `/learning/:id`.

### User path

View description, mock rating summary, components, steps timeline, links, disabled AI panel.

### Frontend path

`learningProjectDetailsPage` → `learningProjectById(projectId)` from mock data.

If id unknown → “Project not found” scaffold.

### Backend path

**Not invoked.** Backend equivalent would be `GET /api/learning-projects/:id`.

### Database changes

None.

### Success state

Detail sections render from in-memory `LearningProject`.

### Error states

Unknown id → static not-found message (no API 404).

### Files involved

`learning_project_details_page.dart`, `learning_hub_mock_data.dart`, `mock_rating_summary_card.dart`, `disabled_ai_panel.dart`, `project_*` widgets

---

## Flow — Add draft (mock only)

### Trigger

User navigates to `/learning/add-draft`.

### User path

Fill title, summary, components, steps, links → UI indicates mock only → no persistence.

### Frontend path

`LearningAddDraftPage` uses mock copy and local controllers; clears legacy mock placeholder text on init.

### Backend path

**None.** No create/submit endpoint mounted.

### Database changes

**None.**

### Success state

Local form interaction only.

### Error states

None (no submit).

### Files involved

`learning_add_draft_page.dart`, `learning_hub_mock_data.dart`

---

## Backend-only reference flow (not wired to Flutter)

Documented for when UI integrates:

| Step | API | DB |
|------|-----|-----|
| List | `GET /api/learning-projects` | Read `learning_projects` where `status = PUBLISHED` + relations |
| Detail | `GET /api/learning-projects/:id` | Read single project + components/steps/links/images |

Source: `learning-projects.repository.ts`, `learning-projects.service.ts`

---

## Not implemented

- Flutter API integration
- Learner booking materials from project components
- AI material matching (`ai-agent`)
- Admin/moderator project review UI
- Submit draft for review

---

## Open questions

- Target Flutter repository pattern (new `LearningHubRepository` vs feature data layer)?
- Map API `difficulty` enum to localized labels?
- Remove or gate mock data behind feature flag during integration?
- Will ratings come from API or remain mock?
