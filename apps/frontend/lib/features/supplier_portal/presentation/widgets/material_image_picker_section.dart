import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../../core/config/api_config.dart';
import '../../../materials/data/models/material_draft_image.dart';

const _maxImages = 5;
const _maxBytes = 5 * 1024 * 1024;
const _allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

class MaterialImagePickerSection extends StatelessWidget {
  const MaterialImagePickerSection({
    super.key,
    required this.images,
    required this.isUploading,
    required this.onPickImages,
    required this.onRemoveImage,
  });

  final List<MaterialDraftImage> images;
  final bool isUploading;
  final VoidCallback onPickImages;
  final ValueChanged<int> onRemoveImage;

  bool get _canAddMore => !isUploading && images.length < _maxImages;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: SupplierDecorations.profileSectionPanel,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.photo_library_outlined,
                  color: AuthDarkColors.accent,
                  size: 22,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Material photos',
                        style: AuthDarkTextStyles.sectionTitle(context),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Add up to 5 photos. JPG, PNG, or WebP.',
                        style: AuthDarkTextStyles.body(
                          context,
                        ).copyWith(color: AuthDarkColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _UploadDropZone(
            isUploading: isUploading,
            canAddMore: _canAddMore,
            imageCount: images.length,
            onPickImages: onPickImages,
          ),
          if (images.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Selected photos',
              style: AuthDarkTextStyles.label(
                context,
              ).copyWith(color: AuthDarkColors.textPrimary),
            ),
            const SizedBox(height: AppSpacing.sm),
            LayoutBuilder(
              builder: (context, constraints) {
                final crossAxisCount = constraints.maxWidth >= 640 ? 4 : 3;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    crossAxisSpacing: AppSpacing.sm,
                    mainAxisSpacing: AppSpacing.sm,
                    childAspectRatio: 1,
                  ),
                  itemCount: images.length,
                  itemBuilder: (context, index) {
                    return _ThumbnailTile(
                      image: images[index],
                      isCover: index == 0,
                      isUploading: isUploading,
                      onRemove: () => onRemoveImage(index),
                    );
                  },
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  static Future<List<MaterialDraftImage>?> pickImages({
    required int currentCount,
    required void Function(String message) onError,
  }) async {
    final remaining = _maxImages - currentCount;
    if (remaining <= 0) {
      onError('You can add up to $_maxImages photos.');
      return null;
    }

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedExtensions,
      allowMultiple: true,
      withData: true,
    );

    if (result == null || result.files.isEmpty) {
      return null;
    }

    final selected = <MaterialDraftImage>[];
    for (final file in result.files) {
      if (selected.length >= remaining) {
        onError(
          'Only $remaining more photo${remaining == 1 ? '' : 's'} can be added.',
        );
        break;
      }

      final bytes = file.bytes;
      if (bytes == null || bytes.isEmpty) {
        onError('Could not read "${file.name}". Try another image.');
        continue;
      }

      if (bytes.length > _maxBytes) {
        onError('${file.name} is larger than 5 MB.');
        continue;
      }

      final mimeType = _mimeTypeForExtension(file.extension);
      if (mimeType == null) {
        onError('${file.name} must be JPG, PNG, or WebP.');
        continue;
      }

      selected.add(
        MaterialDraftImage.pending(
          bytes: bytes,
          fileName: file.name,
          mimeType: mimeType,
        ),
      );
    }

    return selected.isEmpty ? null : selected;
  }

  static String? _mimeTypeForExtension(String? extension) {
    switch (extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return null;
    }
  }
}

class _UploadDropZone extends StatelessWidget {
  const _UploadDropZone({
    required this.isUploading,
    required this.canAddMore,
    required this.imageCount,
    required this.onPickImages,
  });

  final bool isUploading;
  final bool canAddMore;
  final int imageCount;
  final VoidCallback onPickImages;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: canAddMore ? onPickImages : null,
        borderRadius: AppRadius.lgAll,
        child: CustomPaint(
          painter: _DashedBorderPainter(
            color: canAddMore
                ? AuthDarkColors.borderFocused.withValues(alpha: 0.55)
                : AuthDarkColors.border.withValues(alpha: 0.35),
            radius: AppRadius.lg,
            strokeWidth: 1.5,
          ),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.xl,
            ),
            decoration: BoxDecoration(
              color: AuthDarkColors.backgroundElevated.withValues(alpha: 0.55),
              borderRadius: AppRadius.lgAll,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.add_photo_alternate_outlined,
                  size: 40,
                  color: canAddMore
                      ? AuthDarkColors.accent
                      : AuthDarkColors.textSecondary,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Drag photos here or choose from your device',
                  textAlign: TextAlign.center,
                  style: AuthDarkTextStyles.body(
                    context,
                  ).copyWith(color: AuthDarkColors.textPrimary),
                ),
                const SizedBox(height: AppSpacing.lg),
                OutlinedButton.icon(
                  onPressed: canAddMore ? onPickImages : null,
                  icon: const Icon(Icons.photo_library_outlined),
                  label: Text(isUploading ? 'Uploading...' : 'Choose photos'),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '$imageCount/$_maxImages photos',
                  style: AuthDarkTextStyles.label(
                    context,
                  ).copyWith(color: AuthDarkColors.textSecondary),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ThumbnailTile extends StatelessWidget {
  const _ThumbnailTile({
    required this.image,
    required this.isCover,
    required this.isUploading,
    required this.onRemove,
  });

  final MaterialDraftImage image;
  final bool isCover;
  final bool isUploading;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRRect(
          borderRadius: AppRadius.mdAll,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(
                color: AuthDarkColors.border.withValues(alpha: 0.45),
              ),
              borderRadius: AppRadius.mdAll,
            ),
            child: _ImagePreview(image: image),
          ),
        ),
        if (isCover)
          Positioned(
            left: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Cover',
                style: TextStyle(color: Colors.white, fontSize: 10),
              ),
            ),
          ),
        Positioned(
          right: 4,
          top: 4,
          child: Material(
            color: Colors.black.withValues(alpha: 0.72),
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints.tightFor(width: 28, height: 28),
              onPressed: isUploading ? null : onRemove,
              icon: const Icon(Icons.close, size: 16, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}

class _ImagePreview extends StatelessWidget {
  const _ImagePreview({required this.image});

  final MaterialDraftImage image;

  @override
  Widget build(BuildContext context) {
    if (image.isPending) {
      return Image.memory(
        image.bytes!,
        width: double.infinity,
        height: double.infinity,
        fit: BoxFit.cover,
      );
    }

    return Image.network(
      ApiConfig.resolveMediaUrl(image.url!),
      width: double.infinity,
      height: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => Container(
        color: AuthDarkColors.surfaceSolid,
        child: const Icon(
          Icons.broken_image_outlined,
          color: AuthDarkColors.textSecondary,
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({
    required this.color,
    required this.radius,
    required this.strokeWidth,
  });

  final Color color;
  final double radius;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    const dashWidth = 7.0;
    const dashSpace = 5.0;

    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dashWidth;
        final extractPath = metric.extractPath(
          distance,
          next.clamp(0, metric.length),
        );
        canvas.drawPath(extractPath, paint);
        distance = next + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.radius != radius ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
