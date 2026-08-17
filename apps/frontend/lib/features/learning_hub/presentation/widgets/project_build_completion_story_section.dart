import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/protected_media_image.dart';
import '../../../learner_builds/application/completion_image_picker_provider.dart';
import '../../../learner_builds/application/learner_builds_providers.dart';
import '../../../learner_builds/data/completion_image_picker.dart';
import '../../../learner_builds/data/learner_builds_api.dart';
import '../../../learner_builds/presentation/l10n/learner_builds_l10n.dart';
import '../../domain/models/project_build.dart';
import '../theme/learning_ui_palette.dart';

class _PendingCompletionPhoto {
  const _PendingCompletionPhoto({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String mimeType;
}

class ProjectBuildCompletionStorySection extends ConsumerStatefulWidget {
  const ProjectBuildCompletionStorySection({
    super.key,
    required this.build,
    required this.onUpdated,
    this.embedded = false,
  });

  final ProjectBuild build;
  final VoidCallback onUpdated;
  final bool embedded;

  @override
  ProjectBuildCompletionStorySectionState createState() =>
      ProjectBuildCompletionStorySectionState();
}

class ProjectBuildCompletionStorySectionState
    extends ConsumerState<ProjectBuildCompletionStorySection> {
  late final TextEditingController _reflectionController;
  late final TextEditingController _captionController;
  bool _isSaving = false;
  bool _isPickingPhoto = false;
  bool _isUploadingPhoto = false;
  bool _storySaved = false;
  bool _photoUploaded = false;
  String? _uploadError;
  _PendingCompletionPhoto? _pendingPhoto;
  ProjectBuildCompletionStoryPhoto? _optimisticPhoto;

  @override
  void initState() {
    super.initState();
    final story = widget.build.completionStory;
    final existing = story?.reflection?.trim() ?? '';
    _reflectionController = TextEditingController(
      text: existing.isNotEmpty ? existing : _localStoryDraft(widget.build),
    );
    _captionController = TextEditingController(text: story?.caption ?? '');
  }

  @override
  void didUpdateWidget(covariant ProjectBuildCompletionStorySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.build.id != widget.build.id) {
      final story = widget.build.completionStory;
      _reflectionController.text = story?.reflection ?? '';
      _captionController.text = story?.caption ?? '';
      _pendingPhoto = null;
      _optimisticPhoto = null;
      _uploadError = null;
      _photoUploaded = false;
      _storySaved = false;
    } else {
      final photos = widget.build.completionStory?.photos ?? const [];
      final optimistic = _optimisticPhoto;
      if (optimistic != null &&
          photos.any((photo) => photo.id == optimistic.id)) {
        _optimisticPhoto = null;
      }
    }
  }

  bool get _canEditDocumentation =>
      widget.build.status == ProjectBuildStatus.completed;

  bool get _isPhotoBusy => _isPickingPhoto || _isUploadingPhoto;

  List<ProjectBuildCompletionStoryPhoto> get _visiblePhotos {
    final photos = [
      ...?(widget.build.completionStory?.photos),
    ];
    final optimistic = _optimisticPhoto;
    if (optimistic != null &&
        photos.every((photo) => photo.id != optimistic.id)) {
      photos.add(optimistic);
    }
    return photos;
  }

  @override
  void dispose() {
    _reflectionController.dispose();
    _captionController.dispose();
    super.dispose();
  }

  String get _languageCode => Localizations.localeOf(context).languageCode;

  String _localStoryDraft(ProjectBuild build) {
    final title = build.project.title.trim();
    if (title.isEmpty) {
      return '';
    }
    final reused = build.impactSummary?.alreadyOwnedComponentCount ?? 0;
    if (reused > 0) {
      return 'I completed $title and reused $reused materials.';
    }
    return 'I completed $title.';
  }

  void _refreshAfterMutation() {
    widget.onUpdated();
    invalidateLearnerBuildsLists(ref);
  }

  Future<void> _saveStory() async {
    if (!_canEditDocumentation || _isSaving) {
      return;
    }
    setState(() {
      _isSaving = true;
      _storySaved = false;
    });
    try {
      await ref
          .read(learnerBuildsApiProvider)
          .updateCompletionStory(
            widget.build.id,
            UpdateCompletionStoryPayload(
              reflection: _reflectionController.text.trim(),
              caption: _captionController.text.trim(),
            ),
          );
      if (!mounted) {
        return;
      }
      setState(() => _storySaved = true);
      _refreshAfterMutation();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(
          context,
          error,
          message: LearnerBuildsL10n.genericActionFailed.resolve(context),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> pickResultPhoto() => _pickPhoto();

  Future<void> _pickPhoto() async {
    if (!_canEditDocumentation || _isPhotoBusy) {
      return;
    }

    setState(() {
      _isPickingPhoto = true;
      _uploadError = null;
    });

    try {
      final result = await ref.read(completionImagePickerProvider)();
      if (!mounted) {
        return;
      }
      if (result.isCancelled) {
        return;
      }
      if (result.error != null || result.image == null) {
        setState(() {
          _uploadError = _pickErrorMessage(result.error);
          _photoUploaded = false;
        });
        return;
      }

      final selected = result.image!;
      setState(() {
        _pendingPhoto = _PendingCompletionPhoto(
          bytes: selected.bytes,
          fileName: selected.fileName,
          mimeType: selected.mimeType,
        );
        _uploadError = null;
        _photoUploaded = false;
      });
      await _uploadPendingPhoto();
    } catch (error) {
      if (mounted) {
        setState(() {
          _uploadError = LearnerBuildsL10n.completionPhotoUploadErrorMessage(
            error,
            _languageCode,
          );
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isPickingPhoto = false);
      }
    }
  }

  String _pickErrorMessage(CompletionImagePickError? error) {
    return switch (error) {
      CompletionImagePickError.tooLarge =>
        LearnerBuildsL10n.uploadTooLarge.resolve(context),
      CompletionImagePickError.unsupportedType =>
        LearnerBuildsL10n.uploadUnsupportedType.resolve(context),
      CompletionImagePickError.invalidFile || null =>
        LearnerBuildsL10n.uploadInvalidFile.resolve(context),
    };
  }

  void _clearPendingPhoto() {
    if (_isPhotoBusy) {
      return;
    }
    setState(() {
      _pendingPhoto = null;
      _uploadError = null;
    });
  }

  Future<void> _uploadPendingPhoto() async {
    final pending = _pendingPhoto;
    if (!_canEditDocumentation || pending == null || _isUploadingPhoto) {
      return;
    }

    setState(() {
      _isUploadingPhoto = true;
      _uploadError = null;
      _photoUploaded = false;
    });

    try {
      final photo = await ref
          .read(learnerBuildsApiProvider)
          .uploadCompletionPhoto(
            widget.build.id,
            bytes: pending.bytes,
            fileName: pending.fileName,
            mimeType: pending.mimeType,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _pendingPhoto = null;
        _optimisticPhoto = photo;
        _photoUploaded = true;
      });
      _refreshAfterMutation();
    } catch (error) {
      if (mounted) {
        setState(() {
          _uploadError = LearnerBuildsL10n.completionPhotoUploadErrorMessage(
            error,
            _languageCode,
          );
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  Future<void> _deletePhoto(String photoId) async {
    if (!_canEditDocumentation) {
      return;
    }
    try {
      await ref
          .read(learnerBuildsApiProvider)
          .deleteCompletionPhoto(widget.build.id, photoId);
      _refreshAfterMutation();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(
          context,
          error,
          message: LearnerBuildsL10n.genericActionFailed.resolve(context),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final photos = _visiblePhotos;
    final pending = _pendingPhoto;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!widget.embedded) ...[
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
        ],
        if (widget.build.impactSummary != null) ...[
          const SizedBox(height: AppSpacing.md),
          _ImpactSummaryCard(summary: widget.build.impactSummary!),
        ],
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _reflectionController,
          maxLines: 4,
          maxLength: 3000,
          readOnly: !_canEditDocumentation,
          onChanged: (_) {
            if (_storySaved) {
              setState(() => _storySaved = false);
            }
          },
          decoration: InputDecoration(
            labelText: LearnerBuildsL10n.reflectionLabel.resolve(context),
            border: const OutlineInputBorder(),
            isDense: true,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _captionController,
          maxLength: 120,
          readOnly: !_canEditDocumentation,
          onChanged: (_) {
            if (_storySaved) {
              setState(() => _storySaved = false);
            }
          },
          decoration: InputDecoration(
            labelText: LearnerBuildsL10n.captionLabel.resolve(context),
            border: const OutlineInputBorder(),
            isDense: true,
          ),
        ),
        if (_canEditDocumentation) ...[
          const SizedBox(height: AppSpacing.sm),
          FilledButton(
            onPressed: _isSaving ? null : _saveStory,
            child: _isSaving
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(LearnerBuildsL10n.savingStory.resolve(context)),
                    ],
                  )
                : Text(LearnerBuildsL10n.saveStory.resolve(context)),
          ),
        ],
        if (_storySaved) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearnerBuildsL10n.storySavedNotice.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        Text(
          LearnerBuildsL10n.resultPhotosTitle.resolve(context),
          style: AppTextStyles.subtitle(context),
        ),
        if (photos.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: photos
                .map(
                  (photo) => _CompletionPhotoTile(
                    photo: photo,
                    onDelete: _canEditDocumentation
                        ? () => _deletePhoto(photo.id)
                        : null,
                  ),
                )
                .toList(growable: false),
          ),
        ],
        if (pending != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _PendingPhotoPreview(
            pending: pending,
            isUploading: _isPhotoBusy,
            onRemove: _clearPendingPhoto,
            onChange: _pickPhoto,
            onUpload: _uploadPendingPhoto,
          ),
        ] else if (_canEditDocumentation) ...[
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: _isPhotoBusy ? null : _pickPhoto,
            icon: _isPhotoBusy
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_photo_alternate_outlined),
            label: Text(
              _isPhotoBusy
                  ? LearnerBuildsL10n.uploadingPhoto.resolve(context)
                  : LearnerBuildsL10n.addPhoto.resolve(context),
            ),
          ),
        ],
        if (_isPhotoBusy && pending == null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearnerBuildsL10n.uploadingPhoto.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
        if (_photoUploaded) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearnerBuildsL10n.photoUploaded.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: Colors.green.shade700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearnerBuildsL10n.photoUploadedNotice.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
        if (_uploadError != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            _uploadError!,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: Theme.of(context).colorScheme.error),
          ),
        ],
      ],
    );

    if (widget.embedded) {
      return content;
    }

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: content,
    );
  }
}

class _PendingPhotoPreview extends StatelessWidget {
  const _PendingPhotoPreview({
    required this.pending,
    required this.isUploading,
    required this.onRemove,
    required this.onChange,
    required this.onUpload,
  });

  final _PendingCompletionPhoto pending;
  final bool isUploading;
  final VoidCallback onRemove;
  final VoidCallback onChange;
  final VoidCallback onUpload;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: AppRadius.mdAll,
                child: Image.memory(
                  pending.bytes,
                  width: 72,
                  height: 72,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const SizedBox(
                    width: 72,
                    height: 72,
                    child: ColoredBox(color: Colors.black12),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pending.fileName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.label(context),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      children: [
                        TextButton(
                          onPressed: isUploading ? null : onRemove,
                          child: Text(
                            LearnerBuildsL10n.removePhoto.resolve(context),
                          ),
                        ),
                        TextButton(
                          onPressed: isUploading ? null : onChange,
                          child: Text(
                            LearnerBuildsL10n.changePhoto.resolve(context),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton(
            onPressed: isUploading ? null : onUpload,
            child: isUploading
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(LearnerBuildsL10n.uploadingPhoto.resolve(context)),
                    ],
                  )
                : Text(LearnerBuildsL10n.uploadPhoto.resolve(context)),
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
  const _CompletionPhotoTile({required this.photo, this.onDelete});

  final ProjectBuildCompletionStoryPhoto photo;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: AppRadius.mdAll,
          child: ProtectedMediaImage(
            url: photo.imageUrl,
            width: 96,
            height: 96,
            fit: BoxFit.cover,
            errorBuilder: (_) => const SizedBox(
              width: 96,
              height: 96,
              child: ColoredBox(color: Colors.black12),
            ),
          ),
        ),
        if (onDelete != null)
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
