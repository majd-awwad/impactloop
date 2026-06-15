import 'dart:ui';

import 'package:flutter/material.dart';

import 'app_radius.dart';
import 'app_spacing.dart';
import 'auth_dark_colors.dart';

abstract final class AuthDarkDecorations {
  static const LinearGradient pageGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      AuthDarkColors.gradientStart,
      AuthDarkColors.gradientMid,
      AuthDarkColors.gradientEnd,
    ],
    stops: [0.0, 0.45, 1.0],
  );

  static const LinearGradient brandingGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      AuthDarkColors.gradientStart,
      Color(0xFF0F2922),
      AuthDarkColors.background,
    ],
  );

  static BoxDecoration glassCard({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: AuthDarkColors.surface,
      borderRadius: borderRadius ?? AppRadius.lgAll,
      border: Border.all(color: AuthDarkColors.border),
    );
  }

  static BoxDecoration navBarDecoration = BoxDecoration(
    color: AuthDarkColors.navBar,
    borderRadius: const BorderRadius.vertical(
      bottom: Radius.circular(AppRadius.xl),
    ),
    border: Border(
      bottom: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.6)),
    ),
  );

  static List<Widget> backgroundBlobs({bool compact = false}) {
    final size = compact ? 120.0 : 220.0;

    return [
      Positioned(
        top: compact ? -30 : -60,
        right: compact ? -20 : -40,
        child: _blob(size, AuthDarkColors.blobPrimary),
      ),
      Positioned(
        bottom: compact ? 40 : 80,
        left: compact ? -40 : -80,
        child: _blob(size * 0.85, AuthDarkColors.blobSecondary),
      ),
      Positioned(
        top: compact ? 100 : 180,
        left: compact ? 40 : 80,
        child: _blob(size * 0.55, AuthDarkColors.blobAccent),
      ),
    ];
  }

  static Widget _blob(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }

  static Widget glassSurface({
    required Widget child,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
  }) {
    return ClipRRect(
      borderRadius: borderRadius ?? AppRadius.lgAll,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: padding ?? const EdgeInsets.all(AppSpacing.lg),
          decoration: glassCard(borderRadius: borderRadius),
          child: child,
        ),
      ),
    );
  }
}
