import 'package:flutter/material.dart';

import '../../app/theme/app_text_styles.dart';

class AppLinkButton extends StatelessWidget {
  const AppLinkButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.alignment = Alignment.centerRight,
  });

  final String label;
  final VoidCallback? onPressed;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(textStyle: AppTextStyles.link(context)),
        child: Text(label),
      ),
    );
  }
}
