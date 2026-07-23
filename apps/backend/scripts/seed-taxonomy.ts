import { prisma } from "../src/database/prisma.js";
import { seedTaxonomyFoundation } from "../src/modules/taxonomy/taxonomy-foundation.repository.js";

try {
  const result = await seedTaxonomyFoundation();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
