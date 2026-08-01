-- DropForeignKey
ALTER TABLE "no_show_reports" DROP CONSTRAINT "no_show_reports_target_user_id_fkey";

-- AddForeignKey
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
