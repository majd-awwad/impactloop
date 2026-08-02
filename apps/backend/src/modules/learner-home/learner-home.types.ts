export type LearnerHomeProfileCompletion = {
  hasInterests: boolean;
  hasSavedLocation: boolean;
  hasSavedProjects: boolean;
  hasActivity: boolean;
};

export type LearnerHomeSectionKey =
  | 'suggested_materials'
  | 'materials_for_saved_projects'
  | 'suggested_projects'
  | 'continue_projects'
  | 'saved_projects'
  | 'free_materials_near_you'
  | 'popular_projects';

export type LearnerHomeMaterialItem = {
  type: 'material';
  score: number;
  reasons: string[];
  reasonDetails?: LearnerHomeRecommendationReason[];
  material: Record<string, unknown>;
};

export type LearnerHomeProjectItem = {
  type: 'project';
  score: number;
  reasons: string[];
  reasonDetails?: LearnerHomeRecommendationReason[];
  project: Record<string, unknown>;
};

export type LearnerHomeContinueProjectItem = {
  type: 'continue_project';
  score: number;
  reasons: string[];
  reasonDetails?: LearnerHomeRecommendationReason[];
  build: Record<string, unknown>;
};

export type LearnerHomeRecommendationReason = {
  code: string;
  params: Record<string, string | number | boolean>;
};

export type LearnerHomeSectionItem =
  | LearnerHomeMaterialItem
  | LearnerHomeProjectItem
  | LearnerHomeContinueProjectItem;

export type LearnerHomeSection = {
  key: LearnerHomeSectionKey;
  title: string;
  items: LearnerHomeSectionItem[];
  emptyState: string;
};

export type LearnerHomeSectionDetails = {
  key: LearnerHomeSectionKey;
  title: string;
  subtitle: string;
  items: LearnerHomeSectionItem[];
  emptyState: string;
  nextCursor: null;
  nextOffset: number | null;
  hasMore: boolean;
};

export type LearnerHomeResponse = {
  profileCompletion: LearnerHomeProfileCompletion;
  sections: LearnerHomeSection[];
};

export type LearnerHomeSavedLocationContext = {
  city: string | null;
  area: string | null;
};

export type LearnerHomeSavedProjectComponent = {
  projectId: string;
  projectTitle: string;
  componentId: string;
  componentName: string;
  categoryId: string | null;
  materialType: string;
  searchKeywords: string[];
};

export type LearnerHomeMaterialCandidate = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  materialType: string;
  categoryId: string;
  categoryNameEn: string;
  categoryNameAr: string;
  status: string;
  isFree: boolean;
  deliveryAllowed: boolean;
  pickupAllowed: boolean;
  viewsCount: number;
  likesCount: number;
  city: string;
  area: string | null;
  tags: string[];
  createdAt: Date;
  availableQuantity: number;
  mapped: Record<string, unknown>;
};

export type LearnerHomeProjectCandidate = {
  id: string;
  title: string;
  shortDescription: string;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  coverImageUrl: string | null;
  categoryId: string;
  categoryNameEn: string;
  categoryNameAr: string;
  tags: string[];
  createdAt: Date;
  likesCount: number;
  savesCount: number;
  reviewCount: number;
  reviewAverage: number;
  requiredComponents: Array<{
    id: string;
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: string[];
  }>;
  mapped: Record<string, unknown>;
};

export type LearnerBehaviorMaterialSignal = {
  materialId: string;
  title: string;
  description: string;
  materialType: string;
  categoryNameEn: string;
  categoryNameAr: string;
  tags: string[];
};

export type LearnerBehaviorProjectComponentSignal = {
  componentName: string;
  materialType: string;
  categoryNameEn: string | null;
};

export type LearnerBehaviorProjectSignal = {
  projectId: string;
  title: string;
  shortDescription: string;
  categoryNameEn: string;
  categoryNameAr: string;
  tags: string[];
  components: LearnerBehaviorProjectComponentSignal[];
};

export type LearnerBehaviorContext = {
  likedMaterials: LearnerBehaviorMaterialSignal[];
  viewedMaterials: LearnerBehaviorMaterialSignal[];
  reservedMaterials: LearnerBehaviorMaterialSignal[];
  /** Reuses the first 12 ordered saved-project rows already loaded for behavior. */
  savedProjectComponents?: LearnerHomeSavedProjectComponent[];
  savedProjects: LearnerBehaviorProjectSignal[];
  likedProjects: LearnerBehaviorProjectSignal[];
  followedProjects: LearnerBehaviorProjectSignal[];
  inProgressBuildProjects: LearnerBehaviorProjectSignal[];
  recentRecommendationEvents?: Array<{
    entityKey: string;
    actionType: string;
    timestampUtc: string;
  }>;
};

export type LearnerAffinityProfile = Map<string, number>;
