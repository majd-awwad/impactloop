import 'package:flutter/widgets.dart';

export '../../../../shared/models/localized_text.dart';

import '../../../../shared/models/localized_text.dart';

import 'project_material_coverage.dart';

class RatingBreakdown {
  const RatingBreakdown({required this.stars, required this.count});

  final int stars;
  final int count;
}

class ProjectLinkItem {
  const ProjectLinkItem({
    required this.label,
    required this.urlLabel,
    this.url,
  });

  final LocalizedText label;
  final LocalizedText urlLabel;
  final String? url;
}

class ProjectStep {
  const ProjectStep({required this.title});

  final LocalizedText title;
}

class ProjectReviewItem {
  const ProjectReviewItem({
    required this.id,
    required this.projectId,
    required this.reviewerName,
    required this.rating,
    required this.isViewerReview,
    this.comment,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String projectId;
  final String reviewerName;
  final int rating;
  final String? comment;
  final bool isViewerReview;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

class ProjectRequiredComponentItem {
  const ProjectRequiredComponentItem({
    required this.id,
    required this.name,
    required this.materialType,
    required this.quantity,
    required this.unit,
    required this.isRequired,
    required this.canBeSubstituted,
    this.categoryId,
    this.notes,
    this.publicAvailabilityStatus,
  });

  final String id;
  final LocalizedText name;
  final String materialType;
  final double quantity;
  final String unit;
  final bool isRequired;
  final bool canBeSubstituted;
  final String? categoryId;
  final String? notes;
  final ComponentPublicAvailabilityStatus? publicAvailabilityStatus;
}

class LearningProject {
  const LearningProject({
    required this.id,
    required this.category,
    required this.title,
    required this.summary,
    required this.difficulty,
    required this.duration,
    required this.ratingLabel,
    required this.ratingValue,
    required this.ratingCount,
    required this.componentCountLabel,
    required this.components,
    required this.steps,
    required this.links,
    required this.imageUrl,
    required this.heroIconData,
    required this.cardGradient,
    required this.isFeatured,
    this.likesCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.followersCount = 0,
    this.isFollowing = false,
    this.recentReviews = const <ProjectReviewItem>[],
    this.viewerReview,
    this.tags = const <String>[],
    this.requiredComponents = const <ProjectRequiredComponentItem>[],
    this.longDescription,
    this.hasRatings = false,
    this.recommendationImpressionId,
    this.materialCoverage,
    this.personalBuildReadiness,
    this.componentCoverage = const <ProjectComponentCoverageItem>[],
  });

  final String id;
  final LocalizedText category;
  final LocalizedText title;
  final LocalizedText summary;
  final LocalizedText? longDescription;
  final LocalizedText difficulty;
  final LocalizedText duration;
  final LocalizedText ratingLabel;
  final double ratingValue;
  final int ratingCount;
  final LocalizedText componentCountLabel;
  final List<LocalizedText> components;
  final List<ProjectRequiredComponentItem> requiredComponents;
  final List<ProjectStep> steps;
  final List<ProjectLinkItem> links;
  final String? imageUrl;
  final IconData heroIconData;
  final List<int> cardGradient;
  final bool isFeatured;
  final int likesCount;
  final bool isLiked;
  final bool isSaved;
  final int followersCount;
  final bool isFollowing;
  final List<ProjectReviewItem> recentReviews;
  final ProjectReviewItem? viewerReview;
  final List<String> tags;
  final bool hasRatings;
  final String? recommendationImpressionId;
  final ProjectMaterialCoverageSummary? materialCoverage;
  final ProjectPersonalBuildReadiness? personalBuildReadiness;
  final List<ProjectComponentCoverageItem> componentCoverage;

  LearningProject copyWith({
    int? likesCount,
    bool? isLiked,
    bool? isSaved,
    int? followersCount,
    bool? isFollowing,
    List<ProjectReviewItem>? recentReviews,
    ProjectReviewItem? viewerReview,
    String? recommendationImpressionId,
  }) {
    return LearningProject(
      id: id,
      category: category,
      title: title,
      summary: summary,
      longDescription: longDescription,
      difficulty: difficulty,
      duration: duration,
      ratingLabel: ratingLabel,
      ratingValue: ratingValue,
      ratingCount: ratingCount,
      hasRatings: hasRatings,
      recommendationImpressionId:
          recommendationImpressionId ?? this.recommendationImpressionId,
      componentCountLabel: componentCountLabel,
      components: components,
      requiredComponents: requiredComponents,
      steps: steps,
      links: links,
      imageUrl: imageUrl,
      heroIconData: heroIconData,
      cardGradient: cardGradient,
      isFeatured: isFeatured,
      likesCount: likesCount ?? this.likesCount,
      isLiked: isLiked ?? this.isLiked,
      isSaved: isSaved ?? this.isSaved,
      followersCount: followersCount ?? this.followersCount,
      isFollowing: isFollowing ?? this.isFollowing,
      recentReviews: recentReviews ?? this.recentReviews,
      viewerReview: viewerReview ?? this.viewerReview,
      tags: tags,
      materialCoverage: materialCoverage,
      personalBuildReadiness: personalBuildReadiness,
      componentCoverage: componentCoverage,
    );
  }
}
