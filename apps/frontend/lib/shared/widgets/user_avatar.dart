import 'package:flutter/material.dart';

import '../../core/config/api_config.dart';
import '../utils/profile_avatar_url.dart';

class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.displayName,
    this.profileImageUrl,
    this.radius = 18,
    this.backgroundColor,
    this.foregroundColor,
    this.initialTextStyle,
  });

  final String displayName;
  final String? profileImageUrl;
  final double radius;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final TextStyle? initialTextStyle;

  String get _initial {
    final name = displayName.trim();
    return name.isEmpty ? 'A' : name.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = effectiveProfileAvatarUrl(profileImageUrl) ?? '';
    final size = radius * 2;

    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      child: ClipOval(
        child: imageUrl.isEmpty
            ? _InitialsAvatar(
                size: size,
                initial: _initial,
                backgroundColor: backgroundColor,
                foregroundColor: foregroundColor,
                textStyle: initialTextStyle,
              )
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl),
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return _InitialsAvatar(
                    size: size,
                    initial: _initial,
                    backgroundColor: backgroundColor,
                    foregroundColor: foregroundColor,
                    textStyle: initialTextStyle,
                  );
                },
              ),
      ),
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({
    required this.size,
    required this.initial,
    this.backgroundColor,
    this.foregroundColor,
    this.textStyle,
  });

  final double size;
  final String initial;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: backgroundColor,
      child: Text(
        initial,
        style:
            textStyle ??
            Theme.of(context).textTheme.labelLarge?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}
