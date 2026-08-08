import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../application/learner_reservation_provider.dart';
import '../../data/models/learner_reservation.dart';
import '../../data/models/reservation_review.dart';
import '../../data/reservations_repository.dart';

class ReservationReviewsSection extends ConsumerStatefulWidget {
  const ReservationReviewsSection({
    super.key,
    required this.reservation,
  });

  final LearnerReservation reservation;

  @override
  ConsumerState<ReservationReviewsSection> createState() =>
      _ReservationReviewsSectionState();
}

class _ReservationReviewsSectionState
    extends ConsumerState<ReservationReviewsSection> {
  final _supplierCommentController = TextEditingController();
  final _driverCommentController = TextEditingController();
  int _supplierRating = 0;
  int _driverRating = 0;
  bool _isSubmittingSupplier = false;
  bool _isSubmittingDriver = false;

  @override
  void initState() {
    super.initState();
    _syncFromReservation();
  }

  @override
  void didUpdateWidget(covariant ReservationReviewsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reservation.id != widget.reservation.id ||
        oldWidget.reservation.reviews != widget.reservation.reviews) {
      _syncFromReservation();
    }
  }

  @override
  void dispose() {
    _supplierCommentController.dispose();
    _driverCommentController.dispose();
    super.dispose();
  }

  void _syncFromReservation() {
    final reviews = widget.reservation.reviews;
    _supplierRating = reviews?.supplier.review?.rating ?? 0;
    _driverRating = reviews?.driver?.review?.rating ?? 0;
    _supplierCommentController.text = reviews?.supplier.review?.comment ?? '';
    _driverCommentController.text = reviews?.driver?.review?.comment ?? '';
  }

  Future<void> _submitReview({
    required String targetType,
    required int rating,
    required String comment,
    required bool isSupplier,
  }) async {
    if (rating < 1 || rating > 5) {
      showInfoSnackBar(context, 'Choose a rating from 1 to 5 stars.');
      return;
    }

    setState(() {
      if (isSupplier) {
        _isSubmittingSupplier = true;
      } else {
        _isSubmittingDriver = true;
      }
    });

    try {
      await ref.read(reservationsRepositoryProvider).saveReservationReview(
            reservationId: widget.reservation.id,
            targetType: targetType,
            rating: rating,
            comment: comment,
          );

      if (!mounted) {
        return;
      }

      ref.invalidate(learnerReservationProvider(widget.reservation.id));
      showInfoSnackBar(context, 'Review saved.');
    } catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          if (isSupplier) {
            _isSubmittingSupplier = false;
          } else {
            _isSubmittingDriver = false;
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final reviews = widget.reservation.reviews;
    if (reviews == null || !reviews.hasReviewableTarget) {
      return const SizedBox.shrink();
    }

    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Rate your experience',
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Your feedback helps other learners choose trusted suppliers and drivers.',
            style: textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          if (reviews.supplier.canReview) ...[
            const SizedBox(height: AppSpacing.lg),
            _ReviewTargetForm(
              title: 'Supplier',
              subtitle: reviews.supplier.label,
              rating: _supplierRating,
              commentController: _supplierCommentController,
              isSubmitting: _isSubmittingSupplier,
              existingReview: reviews.supplier.review,
              onRatingChanged: (rating) => setState(() => _supplierRating = rating),
              onSubmit: () => _submitReview(
                targetType: 'SUPPLIER',
                rating: _supplierRating,
                comment: _supplierCommentController.text,
                isSupplier: true,
              ),
            ),
          ],
          if (reviews.driver?.canReview == true) ...[
            const SizedBox(height: AppSpacing.lg),
            _ReviewTargetForm(
              title: 'Driver',
              subtitle: reviews.driver!.label,
              rating: _driverRating,
              commentController: _driverCommentController,
              isSubmitting: _isSubmittingDriver,
              existingReview: reviews.driver!.review,
              onRatingChanged: (rating) => setState(() => _driverRating = rating),
              onSubmit: () => _submitReview(
                targetType: 'DRIVER',
                rating: _driverRating,
                comment: _driverCommentController.text,
                isSupplier: false,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReviewTargetForm extends StatelessWidget {
  const _ReviewTargetForm({
    required this.title,
    required this.subtitle,
    required this.rating,
    required this.commentController,
    required this.isSubmitting,
    required this.existingReview,
    required this.onRatingChanged,
    required this.onSubmit,
  });

  final String title;
  final String subtitle;
  final int rating;
  final TextEditingController commentController;
  final bool isSubmitting;
  final ReservationReview? existingReview;
  final ValueChanged<int> onRatingChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          subtitle,
          style: textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: List.generate(5, (index) {
            final starValue = index + 1;
            final isActive = starValue <= rating;
            return IconButton(
              onPressed: isSubmitting ? null : () => onRatingChanged(starValue),
              icon: Icon(
                isActive ? Icons.star_rounded : Icons.star_outline_rounded,
                color: isActive ? Colors.amber.shade700 : null,
              ),
            );
          }),
        ),
        TextField(
          controller: commentController,
          enabled: !isSubmitting,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Comment (optional)',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: FilledButton(
            onPressed: isSubmitting ? null : onSubmit,
            child: Text(existingReview == null ? 'Submit review' : 'Update review'),
          ),
        ),
      ],
    );
  }
}
