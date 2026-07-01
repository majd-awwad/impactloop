import { prisma } from '../src/database/prisma.js';

async function audit() {
  const mismatch = await prisma.$queryRaw<
    Array<{
      id: string;
      owner_id: string;
      supplier_profile_id: string | null;
      profile_user_id: string | null;
      title: string;
      status: string;
    }>
  >`
    SELECT m.id, m.owner_id, m.supplier_profile_id, sp.user_id as profile_user_id, m.title, m.status
    FROM materials m
    LEFT JOIN supplier_profiles sp ON sp.id = m.supplier_profile_id
    WHERE m.supplier_profile_id IS NOT NULL
      AND sp.user_id IS NOT NULL
      AND m.owner_id != sp.user_id
    LIMIT 20
  `;

  console.log('Materials with owner_id != profile user_id:', mismatch.length);
  console.log(JSON.stringify(mismatch, null, 2));

  const mismatchCount = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int as count FROM materials m
    INNER JOIN supplier_profiles sp ON sp.id = m.supplier_profile_id
    WHERE m.owner_id != sp.user_id
  `;
  console.log('Total mismatch count:', mismatchCount[0]?.count ?? 0);

  const profileOnlyNull = await prisma.material.count({
    where: { supplierProfileId: { not: null } },
  });
  const totalMaterials = await prisma.material.count();
  console.log('Materials with supplierProfileId:', profileOnlyNull, '/', totalMaterials);

  const duplicateProfiles = await prisma.$queryRaw<
    Array<{ user_id: string; count: number }>
  >`
    SELECT user_id, COUNT(*)::int as count
    FROM supplier_profiles
    GROUP BY user_id
    HAVING COUNT(*) > 1
  `;
  console.log('Duplicate supplier profiles per user:', duplicateProfiles);

  const suppliers = await prisma.user.findMany({
    where: {
      roles: { some: { role: 'SUPPLIER' } },
      supplierProfile: { isNot: null },
    },
    include: {
      supplierProfile: true,
      roles: true,
    },
    take: 20,
  });

  for (const user of suppliers) {
    const byOwner = await prisma.material.count({ where: { ownerId: user.id } });
    const byProfile = user.supplierProfile
      ? await prisma.material.count({
          where: { supplierProfileId: user.supplierProfile.id },
        })
      : 0;
    if (byOwner > 0 || byProfile > 0) {
      console.log('Supplier', user.email, {
        userId: user.id,
        profileId: user.supplierProfile?.id,
        materialsByOwnerId: byOwner,
        materialsByProfileId: byProfile,
        activeRole: user.activeRole,
        publicName: user.supplierProfile?.publicName,
      });
    }
  }

  const orphanedByProfile = await prisma.$queryRaw<
    Array<{ profile_user_id: string; email: string; count: number }>
  >`
    SELECT sp.user_id as profile_user_id, u.email, COUNT(m.id)::int as count
    FROM materials m
    INNER JOIN supplier_profiles sp ON sp.id = m.supplier_profile_id
    INNER JOIN users u ON u.id = sp.user_id
    LEFT JOIN materials mo ON mo.owner_id = sp.user_id
    GROUP BY sp.user_id, u.email
    HAVING COUNT(m.id) > COUNT(DISTINCT mo.id)
    LIMIT 10
  `;
  console.log('Profiles with more materials by profileId than ownerId:', orphanedByProfile);

  const orphanedProfileRefs = await prisma.$queryRaw<
    Array<{ id: string; owner_id: string; supplier_profile_id: string; title: string }>
  >`
    SELECT m.id, m.owner_id, m.supplier_profile_id, m.title
    FROM materials m
    LEFT JOIN supplier_profiles sp ON sp.id = m.supplier_profile_id
    WHERE m.supplier_profile_id IS NOT NULL AND sp.id IS NULL
    LIMIT 10
  `;
  console.log('Orphaned supplier_profile_id refs:', orphanedProfileRefs);

  const wrongProfileLink = await prisma.$queryRaw<
    Array<{ id: string; owner_id: string; supplier_profile_id: string; current_profile_id: string; email: string }>
  >`
    SELECT m.id, m.owner_id, m.supplier_profile_id, sp_current.id as current_profile_id, u.email
    FROM materials m
    JOIN users u ON u.id = m.owner_id
    JOIN supplier_profiles sp_current ON sp_current.user_id = m.owner_id
    WHERE m.supplier_profile_id IS NOT NULL
      AND m.supplier_profile_id != sp_current.id
    LIMIT 20
  `;
  console.log('Materials linked to stale supplier_profile_id:', wrongProfileLink.length);
  console.log(JSON.stringify(wrongProfileLink.slice(0, 5), null, 2));

  await prisma.$disconnect();
}

audit().catch((error) => {
  console.error(error);
  process.exit(1);
});
