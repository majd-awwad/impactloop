import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project.dart';
import '../theme/learning_ui_palette.dart';

class ProjectReviewsSection extends ConsumerStatefulWidget {
  const ProjectReviewsSection({super.key, required this.project});

  final LearningProject project;

  @override
  ConsumerState<ProjectReviewsSection> createState() =>
      _ProjectReviewsSectionState();
}

class _ProjectReviewsSectionState extends ConsumerState<ProjectReviewsSection> {
  late final TextEditingController _commentController;
  int _rating = 0;
  bool _isSubmitting = false;
  bool _isDeleting = false;

  @override
  void initState() {
    super.initState();
    _commentController = TextEditingController();
    _syncFromProject();
  }

  @override
  void didUpdateWidget(covariant ProjectReviewsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.project.id != widget.project.id ||
        oldWidget.project.viewerReview?.id != widget.project.viewerReview?.id ||
        oldWidget.project.viewerReview?.rating !=
            widget.project.viewerReview?.rating ||
        oldWidget.project.viewerReview?.comment !=
            widget.project.viewerReview?.comment) {
      _syncFromProject();
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _syncFromProject() {
    final review = widget.project.viewerReview;
    _rating = review?.rating ?? 0;
    _commentController.text = review?.comment ?? '';
  }

  bool _ensureLearnerCanReview() {
    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/learning/${widget.project.id}');
      context.go('/login?from=$from');
      return false;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, 'Use a learner account to review projects.');
      return false;
    }

    return true;
  }

  Future<void> _submitReview() async {
    if (_isSubmitting || !_ensureLearnerCanReview()) {
      return;
    }

    if (_rating < 1 || _rating > 5) {
      showInfoSnackBar(context, 'Choose a rating from 1 to 5 stars.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      await ref
          .read(learningHubRepositoryProvider)
          .reviewProject(
            widget.project.id,
            rating: _rating,
            comment: _commentController.text,
          );

      if (!mounted) {
        return;
      }

      ref.invalidate(learningProjectProvider(widget.project.id));
      showInfoSnackBar(context, 'Review saved.');
    } catch (error) {
      if (!mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _deleteReview() async {
    if (_isDeleting || !_ensureLearnerCanReview()) {
      return;
    }

    setState(() {
      _isDeleting = true;
    });

    try {
      await ref
          .read(learningHubRepositoryProvider)
          .deleteProjectReview(widget.project.id);

      if (!mounted) {
        return;
      }

      ref.invalidate(learningProjectProvider(widget.project.id));
      setState(() {
        _rating = 0;
        _commentController.clear();
      });
      showInfoSnackBar(context, 'Review removed.');
    } catch (error) {
      if (!mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          _isDeleting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final hasReviews = widget.project.recentReviews.isNotEmpty;
    final hasViewerReview = widget.project.viewerReview != null;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 840;
          final form = _ReviewForm(
            rating: _rating,
            controller: _commentController,
            hasViewerReview: hasViewerReview,
            isSubmitting: _isSubmitting,
            isDeleting: _isDeleting,
            onRatingChanged: (rating) => setState(() {
              _rating = rating;
            }),
            onSubmit: _submitReview,
            onDelete: hasViewerReview ? _deleteReview : null,
          );
          final reviews = _RecentReviews(
            project: widget.project,
            hasReviews: hasReviews,
          );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ReviewsHeader(project: widget.project),
              const SizedBox(height: AppSpacing.lg),
              if (compact) ...[
                form,
                const SizedBox(height: AppSpacing.lg),
                reviews,
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 5, child: reviews),
                    const SizedBox(width: AppSpacing.lg),
                    Expanded(flex: 4, child: form),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ReviewsHeader extends StatelessWidget {
  const _ReviewsHeader({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final summary = project.hasRatings
        ? '${project.ratingValue.toStringAsFixed(1)} from ${project.ratingCount} ${project.ratingCount == 1 ? 'review' : 'reviews'}'
        : 'No learner reviews yet';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: palette.limeSoft,
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: palette.lime.withValues(alpha: 0.28)),
          ),
          child: Icon(Icons.star_rounded, color: palette.lime),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                const LocalizedText(
                  en: 'Learner reviews',
                  ar: 'مراجعات المتعلمين',
                ).resolve(context),
                style: textTheme.titleLarge?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                summary,
                style: textTheme.bodyMedium?.copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReviewForm extends StatelessWidget {
  const _ReviewForm({
    required this.rating,
    required this.controller,
    required this.hasViewerReview,
    required this.isSubmitting,
    required this.isDeleting,
    required this.onRatingChanged,
    required this.onSubmit,
    required this.onDelete,
  });

  final int rating;
  final TextEditingController controller;
  final bool hasViewerReview;
  final bool isSubmitting;
  final bool isDeleting;
  final ValueChanged<int> onRatingChanged;
  final VoidCallback onSubmit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              hasViewerReview ? 'Update your review' : 'Review this project',
              style: textTheme.labelLarge?.copyWith(
                color: palette.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            _StarRatingInput(value: rating, onChanged: onRatingChanged),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: controller,
              minLines: 3,
              maxLines: 5,
              maxLength: 1200,
              decoration: InputDecoration(
                hintText:
                    'What helped, what was missing, or what would you change?',
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton.icon(
                  onPressed: isSubmitting ? null : onSubmit,
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.primary,
                  ),
                  icon: isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_rounded),
                  label: Text(
                    hasViewerReview ? 'Update review' : 'Post review',
                  ),
                ),
                if (onDelete != null)
                  OutlinedButton.icon(
                    onPressed: isDeleting ? null : onDelete,
                    style: AppStatusButtonStyle.outlined(
                      context,
                      AppStatusTone.danger,
                    ),
                    icon: isDeleting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.delete_outline_rounded),
                    label: const Text('Remove'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StarRatingInput extends StatelessWidget {
  const _StarRatingInput({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final star = index + 1;
        final selected = star <= value;
        return IconButton(
          visualDensity: VisualDensity.compact,
          tooltip: '$star ${star == 1 ? 'star' : 'stars'}',
          onPressed: () => onChanged(star),
          icon: Icon(
            selected ? Icons.star_rounded : Icons.star_border_rounded,
            color: selected ? palette.lime : palette.textSecondary,
          ),
        );
      }),
    );
  }
}

class _RecentReviews extends StatelessWidget {
  const _RecentReviews({required this.project, required this.hasReviews});

  final LearningProject project;
  final bool hasReviews;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    if (!hasReviews) {
      return DecoratedBox(
        decoration: BoxDecoration(
          color: palette.cardSurfaceAlt,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Text(
            'No reviews yet. Be the first learner to rate this project.',
            style: textTheme.bodyMedium?.copyWith(
              color: palette.textSecondary,
              height: 1.45,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final review in project.recentReviews) ...[
          _ReviewTile(review: review),
          if (review != project.recentReviews.last)
            const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});

  final ProjectReviewItem review;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final comment = review.comment;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: review.isViewerReview
              ? palette.lime.withValues(alpha: 0.42)
              : palette.borderSubtle,
        ),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    review.isViewerReview ? 'Your review' : review.reviewerName,
                    style: textTheme.labelLarge?.copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                _ReadOnlyStars(rating: review.rating),
              ],
            ),
            if (comment != null && comment.trim().isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                comment,
                style: textTheme.bodyMedium?.copyWith(
                  color: palette.textSecondary,
                  height: 1.45,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReadOnlyStars extends StatelessWidget {
  const _ReadOnlyStars({required this.rating});

  final int rating;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final selected = index < rating;
        return Icon(
          selected ? Icons.star_rounded : Icons.star_border_rounded,
          size: 18,
          color: selected ? palette.lime : palette.textSecondary,
        );
      }),
    );
  }
}
