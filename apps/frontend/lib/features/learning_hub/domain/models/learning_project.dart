import 'package:flutter/widgets.dart';

export '../../../../shared/models/localized_text.dart';

import '../../../../shared/models/localized_text.dart';

class RatingBreakdown {
  const RatingBreakdown({required this.stars, required this.count});

  final int stars;
  final int count;
}

class ProjectLinkItem {
  const ProjectLinkItem({required this.label, required this.urlLabel});

  final LocalizedText label;
  final LocalizedText urlLabel;
}

class ProjectStep {
  const ProjectStep({required this.title});

  final LocalizedText title;
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
  });

  final String id;
  final LocalizedText category;
  final LocalizedText title;
  final LocalizedText summary;
  final LocalizedText difficulty;
  final LocalizedText duration;
  final LocalizedText ratingLabel;
  final double ratingValue;
  final int ratingCount;
  final LocalizedText componentCountLabel;
  final List<LocalizedText> components;
  final List<ProjectStep> steps;
  final List<ProjectLinkItem> links;
  final String? imageUrl;
  final IconData heroIconData;
  final List<int> cardGradient;
  final bool isFeatured;
}
