import type { Prisma } from '../../generated/prisma/client.js';

export const projectBuildInclude = {
  project: {
    select: {
      id: true,
      title: true,
      shortDescription: true,
      coverImageUrl: true,
      steps: {
        select: {
          id: true,
          stepNumber: true,
          title: true,
          description: true,
          imageUrl: true,
        },
        orderBy: {
          stepNumber: 'asc' as const,
        },
      },
    },
  },
  stepProgress: {
    select: {
      id: true,
      projectStepId: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: {
      projectStep: {
        stepNumber: 'asc' as const,
      },
    },
  },
  items: {
    include: {
      linkedMaterial: {
        select: {
          id: true,
          title: true,
          condition: true,
          status: true,
          isFree: true,
          price: true,
          currency: true,
          pickupAllowed: true,
          deliveryAllowed: true,
          ownerId: true,
          materialType: true,
          unit: true,
          category: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
            },
          },
          location: {
            select: {
              city: true,
              area: true,
            },
          },
          images: {
            orderBy: [{ isCover: 'desc' as const }, { sortOrder: 'asc' as const }],
            take: 1,
            select: {
              imageUrl: true,
              isCover: true,
            },
          },
          supplierProfile: {
            select: {
              publicName: true,
              supplierType: true,
              verificationStatus: true,
              user: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          owner: {
            select: {
              displayName: true,
            },
          },
        },
      },
      linkedReservation: {
        select: {
          id: true,
          status: true,
          materialId: true,
          quantityRequested: true,
        },
      },
      requiredComponent: {
        select: {
          id: true,
          categoryId: true,
          componentName: true,
          materialType: true,
          quantity: true,
          unit: true,
          componentRole: true,
          isRequired: true,
          canBeSubstituted: true,
          notes: true,
          searchKeywords: true,
          alternativeKeywords: true,
          category: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
            },
          },
          createdAt: true,
        },
      },
    },
    orderBy: {
      requiredComponent: {
        createdAt: 'asc' as const,
      },
    },
  },
  completionStory: {
    include: {
      photos: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  completionSnapshot: {
    select: {
      snapshot: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProjectBuildInclude;
