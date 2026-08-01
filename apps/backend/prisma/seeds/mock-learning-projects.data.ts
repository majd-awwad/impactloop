type MockLearningProjectInput = {
  title: string;
  shortDescription: string;
  description: string;
  categoryKey: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedDurationMinutes: number;
  coverImageUrl: string;
  status: "PUBLISHED";
  images: Array<{ imageUrl: string; sortOrder: number }>;
  requiredComponents: Array<{
    componentName: string;
    materialType: string;
    quantity: number;
    unit: string;
    componentRole: "REQUIRED_MATERIAL" | "TOOL" | "CONSUMABLE";
    isRequired: boolean;
    canBeSubstituted: boolean;
    categoryKey?: string;
    searchKeywords?: string[];
  }>;
  steps: Array<{ stepNumber: number; title: string; description: string }>;
  links: Array<{
    linkType: "ARTICLE" | "YOUTUBE";
    url: string;
    title: string;
    sourceName: string;
  }>;
  tags: string[];
};

const MOCK_COVER_IMAGES = [
  "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1561144257-e32e8efc6c4f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80",
];

const MOCK_CATEGORY_KEYS = [
  "robotics",
  "electronics",
  "recycling-crafts",
  "woodworking",
  "home-experiments",
] as const;

const MOCK_DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const MOCK_LEARNING_PROJECTS_FOR_PAGINATION: MockLearningProjectInput[] =
  Array.from({ length: 10 }, (_, index) => {
    const projectNumber = index + 1;
    const paddedNumber = String(projectNumber).padStart(2, "0");
    const categoryKey = MOCK_CATEGORY_KEYS[index % MOCK_CATEGORY_KEYS.length];
    const difficulty = MOCK_DIFFICULTIES[index % MOCK_DIFFICULTIES.length];
    const coverImageUrl =
      MOCK_COVER_IMAGES[index % MOCK_COVER_IMAGES.length] ??
      MOCK_COVER_IMAGES[0];

    return {
      title: `Pagination Mock Project ${paddedNumber}`,
      shortDescription: `Mock learning project ${paddedNumber} for pagination testing.`,
      description: `This seeded mock project exists only to populate the learning hub with enough published entries to exercise pagination. Project ${paddedNumber} covers basic reuse-friendly build steps and minimal component requirements.`,
      categoryKey,
      difficulty,
      estimatedDurationMinutes: 60 + projectNumber * 15,
      coverImageUrl,
      status: "PUBLISHED",
      images: [{ imageUrl: coverImageUrl, sortOrder: 0 }],
      requiredComponents: [
        {
          componentName: "Reusable base material",
          materialType: "Workshop surplus",
          quantity: 1,
          unit: "piece",
          componentRole: "REQUIRED_MATERIAL",
          isRequired: true,
          canBeSubstituted: true,
          searchKeywords: ["reuse", "surplus", "mock"],
        },
        {
          componentName: "Basic hand tool",
          materialType: "Hand tool",
          quantity: 1,
          unit: "piece",
          componentRole: "TOOL",
          isRequired: true,
          canBeSubstituted: true,
          searchKeywords: ["tool", "workshop"],
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Gather materials",
          description:
            "Collect the listed reusable components and confirm quantities before starting.",
        },
        {
          stepNumber: 2,
          title: "Assemble the mock build",
          description:
            "Follow the short assembly flow to complete the pagination test project.",
        },
      ],
      links: [
        {
          linkType: "ARTICLE",
          url: `https://example.com/mock-learning-project-${paddedNumber}`,
          title: `Mock project ${paddedNumber} reference`,
          sourceName: "ImpactLoop Seed",
        },
      ],
      tags: ["mock", "pagination", `project-${paddedNumber}`],
    };
  });
