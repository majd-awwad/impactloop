The backend plan is approved only with schema alignment changes.

Do not implement the simplified Category/Material schema as originally proposed.

We need the backend read-only API to align with the expected ImpactLoop database design, while still keeping this step read-only and not overbuilding.

Scope remains:

* Backend read-only only
* No frontend changes
* No Supplier Add/Edit Material
* No reservations
* No delivery
* No AI
* No image upload

Endpoints remain:

* GET /api/materials
* GET /api/materials/:id
* GET /api/categories

Required Prisma models for this step:

1. Category

Use this structure:

* id UUID PK
* name_en String
* name_ar String
* parent_id UUID nullable self relation
* category_type enum: MATERIAL / PROJECT / BOTH
* icon_url String nullable
* created_at DateTime

Important:
Categories are shared by materials and learning projects, so do not create a material-only category shape.

2. Material

Use this structure as closely as possible:

* id UUID PK
* owner_id UUID FK -> users.id
* supplier_profile_id UUID nullable FK -> supplier_profiles.id if supplier_profiles exists
* category_id UUID FK -> categories.id
* title String
* description String/Text
* material_type String
* quantity Decimal
* unit String
* condition enum: NEW / LIKE_NEW / GOOD / USED / NEEDS_REPAIR
* source_type enum: STUDENT_LEFTOVER / WORKSHOP_SURPLUS / FACTORY_SURPLUS / EDUCATIONAL_INSTITUTION
* status enum: AVAILABLE / PENDING_RESERVATION / RESERVED / REUSED / UNAVAILABLE
* is_free Boolean
* price Decimal nullable
* currency String default "NIS"
* location_id UUID nullable FK -> locations.id
* pickup_allowed Boolean
* delivery_allowed Boolean
* pickup_notes Text nullable
* suggested_uses Text nullable
* views_count Int default 0
* reused_at DateTime nullable
* created_at DateTime
* updated_at DateTime

Do not add reused_by_reservation_id yet if reservations table does not exist.
We will add it later when reservations are implemented.

3. MaterialImage

Use:

* id UUID PK
* material_id UUID FK -> materials.id
* image_url String
* sort_order Int
* is_cover Boolean
* created_at DateTime

4. MaterialTag

Use:

* id UUID PK
* material_id UUID FK -> materials.id
* tag String

Reason:
Tags are useful for search and future AI matching, and they are part of the expected database design.

Do not add material_pickup_windows in this step.
It is useful later, but not required for read-only Material Discovery API.

Do not add user_saved_locations in this step.
It is not related to public material browsing.

Use the existing Location model.
Do not redesign the Location table.
Do not add PostGIS/geography changes in this step unless already working in the existing schema.

API behavior:

GET /api/materials

Query params:

* q
* categoryId
* condition
* status default AVAILABLE
* priceType: FREE | PAID | ANY
* deliveryAvailable
* city
* page
* limit

Search q should match:

* material title
* material description
* material_type
* tags
* category name_en/name_ar if practical

Return:

* success
* message
* data.items
* data.pagination

Each item should return raw fields close to docs/api/materials-api-contract.md:

* id
* title
* description
* category: { id, nameEn, nameAr }
* condition
* status
* quantity
* unit
* isFree
* price
* currency
* city
* area
* pickupAllowed
* deliveryAvailable
* imageUrl
* supplierName
* ratingSummary: null for now
* createdAt

GET /api/materials/:id

Return one material by id.
Include:

* cover image
* images
* tags
* category
* location city/area
* supplierName if possible
* ratingSummary null for now

If not found, return existing AppError/not-found style.

GET /api/categories

Return categories where category_type is MATERIAL or BOTH.

Backend architecture:
Keep the proposed structure:

materials:

* materials.routes.ts
* materials.controller.ts
* materials.service.ts
* materials.repository.ts
* materials.validation.ts

categories:

* categories.routes.ts
* categories.controller.ts
* categories.service.ts
* categories.repository.ts

Modify:

* app.ts
* prisma/schema.prisma

Migration:
Yes, create a Prisma migration only after the schema is updated.

Seeds:
If the project already has a seed file, add basic categories and a few demo materials only if it fits the existing seed pattern.
Do not create complex seed logic.

Before coding:
Return the revised plan showing:

1. Final Prisma models/enums to add.
2. Whether supplier_profiles exists and whether supplier_profile_id can be added now.
3. Whether reservations exists; if not, confirm reused_by_reservation_id is postponed.
4. Whether material_pickup_windows is postponed.
5. How GET /api/materials maps DB fields to the API contract.
6. Confirm no frontend changes.
7. Confirm no POST/PATCH/reservation/delivery/AI work.

Wait for approval before implementation.

---

Revised plan before implementation:

1. Final Prisma models and enums to add

Enums:

* `CategoryType`
  * `MATERIAL`
  * `PROJECT`
  * `BOTH`
* `MaterialCondition`
  * `NEW`
  * `LIKE_NEW`
  * `GOOD`
  * `USED`
  * `NEEDS_REPAIR`
* `MaterialSourceType`
  * `STUDENT_LEFTOVER`
  * `WORKSHOP_SURPLUS`
  * `FACTORY_SURPLUS`
  * `EDUCATIONAL_INSTITUTION`
* `MaterialStatus`
  * `AVAILABLE`
  * `PENDING_RESERVATION`
  * `RESERVED`
  * `REUSED`
  * `UNAVAILABLE`

Models:

* `Category`
  * UUID primary key
  * `nameEn`
  * `nameAr`
  * nullable self relation for `parentId`
  * `categoryType`
  * nullable `iconUrl`
  * `createdAt`
* `Material`
  * UUID primary key
  * `ownerId` -> `users.id`
  * nullable `supplierProfileId` -> `supplier_profiles.id`
  * `categoryId` -> `categories.id`
  * `title`
  * `description`
  * `materialType`
  * `quantity` as decimal
  * `unit`
  * `condition`
  * `sourceType`
  * `status`
  * `isFree`
  * nullable `price`
  * `currency` default `"NIS"`
  * nullable `locationId` -> `locations.id`
  * `pickupAllowed`
  * `deliveryAllowed`
  * nullable `pickupNotes`
  * nullable `suggestedUses`
  * `viewsCount` default `0`
  * nullable `reusedAt`
  * `createdAt`
  * `updatedAt`
* `MaterialImage`
  * UUID primary key
  * `materialId` -> `materials.id`
  * `imageUrl`
  * `sortOrder`
  * `isCover`
  * `createdAt`
* `MaterialTag`
  * UUID primary key
  * `materialId` -> `materials.id`
  * `tag`

I will reuse the existing `Location` model as-is and will not redesign it in this step.

2. Whether `supplier_profiles` exists and whether `supplier_profile_id` can be added now

Yes.

The current Prisma schema already contains `SupplierProfile` mapped to `supplier_profiles`, so `supplier_profile_id` can be added now as a nullable foreign key on `Material`.

3. Whether reservations exists; if not, confirm `reused_by_reservation_id` is postponed

Reservations do not exist yet in the current Prisma schema.

So:

* `reused_by_reservation_id` will be postponed
* no reservation foreign key will be added in this read-only step

4. Whether `material_pickup_windows` is postponed

Yes.

`material_pickup_windows` will be postponed because it is not required for the read-only Material Discovery API.

5. How `GET /api/materials` maps DB fields to the API contract

Query params to support:

* `q`
* `categoryId`
* `condition`
* `status` with default `AVAILABLE`
* `priceType` = `FREE | PAID | ANY`
* `deliveryAvailable`
* `city`
* `page`
* `limit`

Filtering/search behavior:

* `q` will match:
  * `materials.title`
  * `materials.description`
  * `materials.material_type`
  * related `material_tags.tag`
  * related category `name_en` and `name_ar` where practical
* `categoryId` filters by `materials.category_id`
* `condition` filters by `materials.condition`
* `status` filters by `materials.status`, defaulting to `AVAILABLE`
* `priceType=FREE` filters `is_free = true`
* `priceType=PAID` filters `is_free = false`
* `priceType=ANY` skips free/paid filtering
* `deliveryAvailable` filters `delivery_allowed`
* `city` filters related `locations.city`

Response shape:

* `success`
* `message`
* `data.items`
* `data.pagination`

Each list item will map as:

* `id` <- `materials.id`
* `title` <- `materials.title`
* `description` <- `materials.description`
* `category` <- related category object:
  * `id`
  * `nameEn`
  * `nameAr`
* `condition` <- `materials.condition`
* `status` <- `materials.status`
* `quantity` <- `materials.quantity`
* `unit` <- `materials.unit`
* `isFree` <- `materials.is_free`
* `price` <- `materials.price`
* `currency` <- `materials.currency`
* `city` <- related `locations.city` or `null`
* `area` <- related `locations.area` or `null`
* `pickupAllowed` <- `materials.pickup_allowed`
* `deliveryAvailable` <- `materials.delivery_allowed`
* `imageUrl` <- cover image from `material_images` if available, else `null`
* `supplierName` <- `supplier_profiles.public_name` if present, otherwise owner display name if appropriate, otherwise `null`
* `ratingSummary` <- `null` for now
* `createdAt` <- `materials.created_at`

For `GET /api/materials/:id`, the same base fields will be returned plus:

* `images`
* `tags`
* category object
* location city/area
* `supplierName`
* `ratingSummary: null`

6. Confirm no frontend changes

Confirmed.

This step remains backend-only:

* no Flutter UI changes
* no frontend repository changes
* no frontend API client changes

7. Confirm no POST/PATCH/reservation/delivery/AI work

Confirmed.

This step is limited to:

* `GET /api/materials`
* `GET /api/materials/:id`
* `GET /api/categories`

No:

* POST
* PATCH
* Supplier Add/Edit
* reservations work
* delivery workflow work
* AI work
