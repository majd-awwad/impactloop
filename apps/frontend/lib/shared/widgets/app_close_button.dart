import 'package:flutter/material.dart';

/// A localized, accessible close affordance for dialogs and modal sheets.
class AppCloseButton extends StatelessWidget {
  const AppCloseButton({
    super.key,
    required this.onPressed,
    this.semanticLabel,
    this.tooltip,
  });

  final VoidCallback? onPressed;
  final String? semanticLabel;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final localizedLabel = MaterialLocalizations.of(context).closeButtonTooltip;
    final label = semanticLabel ?? tooltip ?? localizedLabel;

    return Semantics(
      button: true,
      label: label,
      child: Tooltip(
        message: tooltip ?? localizedLabel,
        child: IconButton(
          onPressed: onPressed,
          icon: const Icon(Icons.close_rounded),
        ),
      ),
    );
  }
}
