import 'package:flutter/material.dart';

enum MaterialEngagementChipTone { views, likes, neutral }

class MaterialEngagementChip extends StatelessWidget {
  const MaterialEngagementChip({
    super.key,
    required this.icon,
    required this.count,
    this.tone = MaterialEngagementChipTone.neutral,
  });

  final IconData icon;
  final int count;
  final MaterialEngagementChipTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = switch (tone) {
      MaterialEngagementChipTone.views => (
          background: const Color(0xFF0F4C5C).withValues(alpha: 0.82),
          foreground: Colors.white,
        ),
      MaterialEngagementChipTone.likes => (
          background: const Color(0xFFBE185D).withValues(alpha: 0.88),
          foreground: Colors.white,
        ),
      MaterialEngagementChipTone.neutral => (
          background: Colors.black.withValues(alpha: 0.55),
          foreground: Colors.white,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: palette.foreground),
          const SizedBox(width: 4),
          Text(
            '$count',
            style: TextStyle(
              color: palette.foreground,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
