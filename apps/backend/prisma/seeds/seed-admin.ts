import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { hashPassword } from "../../src/utils/password.js";

export const SEED_ADMIN_EMAIL = "admin@impactloop.test";
export const SEED_ADMIN_PASSWORD = "AdminPassword123!";

export type SeedAdminResult = {
  email: string;
  userId: string;
  mode: "created" | "reused-existing";
  roleEnsured: boolean;
};

export async function seedAdmin(
  prisma: PrismaClient,
): Promise<SeedAdminResult> {
  const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);

  let user = await prisma.user.findUnique({
    where: { email: SEED_ADMIN_EMAIL },
    include: {
      roles: true,
    },
  });

  let mode: SeedAdminResult["mode"] = "reused-existing";

  if (!user) {
    user = await prisma.user.create({
      data: {
        displayName: "ImpactLoop Admin",
        email: SEED_ADMIN_EMAIL,
        passwordHash,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ role: "ADMIN", isPrimary: true }],
        },
      },
      include: {
        roles: true,
      },
    });
    mode = "created";
  }

  const hasAdminRole = user.roles.some(
    (assignment) => assignment.role === "ADMIN",
  );
  let roleEnsured = hasAdminRole;

  if (!hasAdminRole) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        role: "ADMIN",
        isPrimary: user.roles.length === 0,
      },
    });
    roleEnsured = true;
  }

  if (user.accountStatus !== "ACTIVE") {
    await prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: "ACTIVE" },
    });
  }

  return {
    email: SEED_ADMIN_EMAIL,
    userId: user.id,
    mode,
    roleEnsured,
  };
}
