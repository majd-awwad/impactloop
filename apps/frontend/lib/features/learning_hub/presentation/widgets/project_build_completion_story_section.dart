import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../learner_builds/application/learner_builds_providers.dart';
import '../../../learner_builds/data/learner_builds_api.dart';
import '../../../learner_builds/presentation/l10n/learner_builds_l10n.dart';
import '../../domain/models/project_build.dart';
import '../theme/learning_ui_palette.dart';

class ProjectBuildCompletionStorySection extends ConsumerStatefulWidget {
  const ProjectBuildCompletionStorySection({
    super.key,
    required this.build,
    required this.onUpdated,
  });

  final ProjectBuild build;
  final VoidCallback onUpdated;

  @override
  ConsumerState<ProjectBuildCompletionStorySection> createState() =>
      _ProjectBuildCompletionStorySectionState();
}

class _ProjectBuildCompletionStorySectionState
    extends ConsumerState<ProjectBuildCompletionStorySection> {
  late final TextEditingController _reflectionController;
  late final TextEditingController _captionController;
  bool _isSaving = false;
  bool _isUploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    final story = widget.build.completionStory;
    _reflectionController = TextEditingController(text: story?.reflection ?? '');
    _captionController = TextEditingController(text: story?.caption ?? '');
  }

  @override
  void didUpdateWidget(covariant ProjectBuildCompletionStorySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.build.id != widget.build.id) {
      final story = widget.build.completionStory;
      _reflectionController.text = story?.reflection ?? '';
      _captionController.text = story?.caption ?? '';
    }
  }

  @override
  void dispose() {
    _reflectionController.dispose();
    _captionController.dispose();
    super.dispose();
  }

  Future<void> _saveStory() async {
    setState(() => _isSaving = true);
    try {
      await ref.read(learnerBuildsApiProvider).updateCompletionStory(
        widget.build.id,
        UpdateCompletionStoryPayload(
          reflection: _reflectionController.text.trim(),
          caption: _captionController.text.trim(),
        ),
      );
      widget.onUpdated();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _addPhoto() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      withData: false,
    );
    final path = result?.files.single.path;
    if (path == null || path.trim().isEmpty) {
      return;
    }

    setState(() => _isUploadingPhoto = true);
    try {
      await ref.read(learnerBuildsApiProvider).uploadCompletionPhoto(
        widget.build.id,
        filePath: path,
      );
      widget.onUpdated();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  Future<void> _deletePhoto(String photoId) async {
    try {
      await ref
          .read(learnerBuildsApiProvider)
          .deleteCompletionPhoto(widget.build.id, photoId);
      widget.onUpdated();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final story = widget.build.completionStory;
    final photos = story?.photos ?? const [];

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LearnerBuildsL10n.completionStoryTitle.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearnerBuildsL10n.completionStorySubtitle.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary, height: 1.4),
          ),
          if (widget.build.impactSummary != null) ...[
            const SizedBox(height: AppSpacing.md),
            _ImpactSummaryCard(summary: widget.build.impactSummary!),
          ],
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: _reflectionController,
            maxLines: 5,
            maxLength: 3000,
            decoration: InputDecoration(
              labelText: LearnerBuildsL10n.reflectionLabel.resolve(context),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _captionController,
            maxLength: 120,
            decoration: InputDecoration(
              labelText: LearnerBuildsL10n.captionLabel.resolve(context),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: _isSaving ? null : _saveStory,
            child: _isSaving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(LearnerBuildsL10n.saveStory.resolve(context)),
          ),
          if (photos.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: photos
                  .map(
                    (photo) => _CompletionPhotoTile(
                      photo: photo,
                      onDelete: () => _deletePhoto(photo.id),
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: _isUploadingPhoto ? null : _addPhoto,
            icon: _isUploadingPhoto
                ? const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_photo_alternate_outlined),
            label: Text(LearnerBuildsL10n.addPhoto.resolve(context)),
          ),
        ],
      ),
    );
  }
}

class _ImpactSummaryCard extends StatelessWidget {
  const _ImpactSummaryCard({required this.summary});

  final ProjectBuildImpactSummary summary;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LearnerBuildsL10n.impactSummaryTitle.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            LearnerBuildsL10n.impactStepsCompleted(
              summary.completedStepCount,
              summary.totalStepCount,
            ).resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (summary.acquiredViaImpactLoopCount > 0) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              LearnerBuildsL10n.impactMaterialsAcquired(
                summary.acquiredViaImpactLoopCount,
              ).resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _CompletionPhotoTile extends StatelessWidget {
  const _CompletionPhotoTile({required this.photo, required this.onDelete});

  final ProjectBuildCompletionStoryPhoto photo;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: AppRadius.mdAll,
          child: Image.network(
            ApiConfig.resolveMediaUrl(photo.imageUrl),
            width: 96,
            height: 96,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => const SizedBox(
              width: 96,
              height: 96,
              child: ColoredBox(color: Colors.black12),
            ),
          ),
        ),
        PositionedDirectional(
          top: 4,
          end: 4,
          child: Material(
            color: Colors.black54,
            shape: const CircleBorder(),
            child: InkWell(
              onTap: onDelete,
              customBorder: const CircleBorder(),
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(Icons.close_rounded, size: 16, color: Colors.white),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
