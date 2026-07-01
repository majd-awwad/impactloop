import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/discovery_material_image.dart';

class MaterialDetailsGallery extends StatefulWidget {
  const MaterialDetailsGallery({
    super.key,
    required this.images,
    required this.imageAltText,
    required this.fallbackIcon,
    required this.gradientColors,
    this.compact = false,
  });

  final List<DiscoveryMaterialImage> images;
  final LocalizedText imageAltText;
  final IconData fallbackIcon;
  final List<Color> gradientColors;
  final bool compact;

  @override
  State<MaterialDetailsGallery> createState() => _MaterialDetailsGalleryState();
}

class _MaterialDetailsGalleryState extends State<MaterialDetailsGallery> {
  late int _selectedIndex;
  final Set<int> _failedIndexes = <int>{};

  @override
  void initState() {
    super.initState();
    _selectedIndex = _initialSelectedIndex(widget.images);
  }

  @override
  void didUpdateWidget(covariant MaterialDetailsGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_sameImageList(oldWidget.images, widget.images)) {
      _failedIndexes.clear();
      _selectedIndex = _initialSelectedIndex(widget.images);
    } else if (_selectedIndex >= widget.images.length) {
      _selectedIndex = _initialSelectedIndex(widget.images);
    }
  }

  int _initialSelectedIndex(List<DiscoveryMaterialImage> images) {
    if (images.isEmpty) {
      return 0;
    }

    final primaryIndex = images.indexWhere((image) => image.isPrimary);
    if (primaryIndex >= 0) {
      return primaryIndex;
    }

    final coverIndex = images.indexWhere((image) => image.isCover);
    if (coverIndex >= 0) {
      return coverIndex;
    }

    return 0;
  }

  bool _sameImageList(
    List<DiscoveryMaterialImage> left,
    List<DiscoveryMaterialImage> right,
  ) {
    if (left.length != right.length) {
      return false;
    }

    for (var index = 0; index < left.length; index++) {
      if (left[index].id != right[index].id ||
          left[index].url != right[index].url) {
        return false;
      }
    }

    return true;
  }

  bool _canShowImageAt(int index) {
    if (index < 0 || index >= widget.images.length) {
      return false;
    }

    final url = widget.images[index].url.trim();
    return url.isNotEmpty && !_failedIndexes.contains(index);
  }

  double _mainImageHeight(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;

    if (widget.compact) {
      return 200;
    }

    if (screenWidth >= 1100) {
      return 320;
    }

    if (screenWidth >= 980) {
      return 280;
    }

    return 260;
  }

  String _altTextForIndex(int index) {
    final title = widget.imageAltText.en.trim();
    if (widget.images.length <= 1) {
      return title.isEmpty ? 'Material photo' : title;
    }

    return title.isEmpty
        ? 'Material photo ${index + 1} of ${widget.images.length}'
        : '$title, photo ${index + 1} of ${widget.images.length}';
  }

  void _selectImage(int index) {
    if (index == _selectedIndex) {
      return;
    }

    setState(() => _selectedIndex = index);
  }

  void _markImageFailed(int index) {
    if (!mounted || _failedIndexes.contains(index)) {
      return;
    }

    setState(() => _failedIndexes.add(index));
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final images = widget.images;
    final showNetworkImage = _canShowImageAt(_selectedIndex);
    final mainHeight = _mainImageHeight(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: AppRadius.lgAll,
          child: SizedBox(
            height: mainHeight,
            width: double.infinity,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.bottomEnd,
                  colors: showNetworkImage
                      ? widget.gradientColors
                      : [
                          palette.fallbackStart,
                          palette.fallbackMid,
                          palette.fallbackEnd,
                        ],
                ),
                border: Border.all(color: palette.borderSubtle),
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (showNetworkImage)
                    Image.network(
                      images[_selectedIndex].url,
                      fit: BoxFit.cover,
                      semanticLabel: _altTextForIndex(_selectedIndex),
                      errorBuilder: (context, error, stackTrace) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          _markImageFailed(_selectedIndex);
                        });
                        return const SizedBox.shrink();
                      },
                    ),
                  if (!showNetworkImage)
                    Center(
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: palette.cardSurfaceAlt.withValues(alpha: 0.88),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: palette.borderStrong),
                        ),
                        child: Icon(
                          widget.fallbackIcon,
                          size: 34,
                          color: palette.mint,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        if (images.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                final isSelected = index == _selectedIndex;
                final canShowThumb = _canShowImageAt(index);

                return Semantics(
                  button: true,
                  selected: isSelected,
                  label: _altTextForIndex(index),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _selectImage(index),
                      borderRadius: AppRadius.mdAll,
                      child: Ink(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          borderRadius: AppRadius.mdAll,
                          border: Border.all(
                            color: isSelected
                                ? palette.mint
                                : palette.borderSubtle,
                            width: isSelected ? 2 : 1,
                          ),
                          gradient: LinearGradient(
                            begin: AlignmentDirectional.topStart,
                            end: AlignmentDirectional.bottomEnd,
                            colors: canShowThumb
                                ? widget.gradientColors
                                : [
                                    palette.fallbackStart,
                                    palette.fallbackMid,
                                  ],
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: AppRadius.mdAll,
                          child: canShowThumb
                              ? Image.network(
                                  images[index].url,
                                  fit: BoxFit.cover,
                                  semanticLabel: _altTextForIndex(index),
                                  errorBuilder: (context, error, stackTrace) {
                                    WidgetsBinding.instance.addPostFrameCallback(
                                      (_) => _markImageFailed(index),
                                    );
                                    return Center(
                                      child: Icon(
                                        widget.fallbackIcon,
                                        size: 20,
                                        color: palette.mint,
                                      ),
                                    );
                                  },
                                )
                              : Center(
                                  child: Icon(
                                    widget.fallbackIcon,
                                    size: 20,
                                    color: palette.mint,
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}
