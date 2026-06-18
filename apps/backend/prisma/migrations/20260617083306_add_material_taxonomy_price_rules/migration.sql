-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "custom_material_type" TEXT,
ADD COLUMN     "material_type_id" TEXT;

-- CreateTable
CREATE TABLE "material_types" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "default_unit" TEXT NOT NULL DEFAULT 'piece',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_type_aliases" (
    "id" TEXT NOT NULL,
    "material_type_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_type_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_price_rules" (
    "id" TEXT NOT NULL,
    "material_type_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NIS',
    "unit" TEXT NOT NULL,
    "max_allowed_unit_price_nis" DECIMAL(10,2),
    "max_allowed_total_price_nis" DECIMAL(10,2),
    "condition_factors_json" JSONB,
    "source_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source_note" TEXT,
    "confidence" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_type_requests" (
    "id" TEXT NOT NULL,
    "requested_name" TEXT NOT NULL,
    "normalized_requested_name" TEXT NOT NULL,
    "suggested_category_id" TEXT,
    "description" TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "moderator_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_type_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rule_requests" (
    "id" TEXT NOT NULL,
    "material_type_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ai_suggested_unit" TEXT,
    "ai_suggested_max_unit_price_nis" DECIMAL(10,2),
    "ai_suggested_max_total_price_nis" DECIMAL(10,2),
    "ai_suggested_aliases_json" JSONB,
    "ai_result_json" JSONB,
    "moderator_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_rule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_price_lookup_logs" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalized_query" TEXT NOT NULL,
    "result_json" JSONB,
    "status" TEXT NOT NULL,
    "cost_estimate" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_price_lookup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_types_category_id_idx" ON "material_types"("category_id");

-- CreateIndex
CREATE INDEX "material_types_name_en_idx" ON "material_types"("name_en");

-- CreateIndex
CREATE INDEX "material_types_is_active_idx" ON "material_types"("is_active");

-- CreateIndex
CREATE INDEX "material_type_aliases_material_type_id_idx" ON "material_type_aliases"("material_type_id");

-- CreateIndex
CREATE INDEX "material_type_aliases_normalized_alias_idx" ON "material_type_aliases"("normalized_alias");

-- CreateIndex
CREATE INDEX "material_price_rules_material_type_id_idx" ON "material_price_rules"("material_type_id");

-- CreateIndex
CREATE INDEX "material_price_rules_status_idx" ON "material_price_rules"("status");

-- CreateIndex
CREATE INDEX "material_price_rules_is_active_idx" ON "material_price_rules"("is_active");

-- CreateIndex
CREATE INDEX "material_price_rules_currency_idx" ON "material_price_rules"("currency");

-- CreateIndex
CREATE INDEX "material_price_rules_unit_idx" ON "material_price_rules"("unit");

-- CreateIndex
CREATE INDEX "material_type_requests_requested_by_user_id_idx" ON "material_type_requests"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "material_type_requests_suggested_category_id_idx" ON "material_type_requests"("suggested_category_id");

-- CreateIndex
CREATE INDEX "material_type_requests_status_idx" ON "material_type_requests"("status");

-- CreateIndex
CREATE INDEX "material_type_requests_normalized_requested_name_idx" ON "material_type_requests"("normalized_requested_name");

-- CreateIndex
CREATE INDEX "price_rule_requests_material_type_id_idx" ON "price_rule_requests"("material_type_id");

-- CreateIndex
CREATE INDEX "price_rule_requests_requested_by_user_id_idx" ON "price_rule_requests"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "price_rule_requests_status_idx" ON "price_rule_requests"("status");

-- CreateIndex
CREATE INDEX "ai_price_lookup_logs_normalized_query_idx" ON "ai_price_lookup_logs"("normalized_query");

-- CreateIndex
CREATE INDEX "ai_price_lookup_logs_status_idx" ON "ai_price_lookup_logs"("status");

-- CreateIndex
CREATE INDEX "materials_material_type_id_idx" ON "materials"("material_type_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_material_type_id_fkey" FOREIGN KEY ("material_type_id") REFERENCES "material_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_types" ADD CONSTRAINT "material_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_type_aliases" ADD CONSTRAINT "material_type_aliases_material_type_id_fkey" FOREIGN KEY ("material_type_id") REFERENCES "material_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_price_rules" ADD CONSTRAINT "material_price_rules_material_type_id_fkey" FOREIGN KEY ("material_type_id") REFERENCES "material_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_type_requests" ADD CONSTRAINT "material_type_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_type_requests" ADD CONSTRAINT "material_type_requests_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rule_requests" ADD CONSTRAINT "price_rule_requests_material_type_id_fkey" FOREIGN KEY ("material_type_id") REFERENCES "material_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rule_requests" ADD CONSTRAINT "price_rule_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
