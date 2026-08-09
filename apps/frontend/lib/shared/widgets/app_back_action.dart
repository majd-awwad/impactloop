import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/router/navigation_extensions.dart';
import '../../app/theme/app_theme_colors.dart';

/// The two intentional visual treatments for a true page-level Back action.
enum AppBackActionVariant {
  /// Chooses compact below [AppBackAction.compactBreakpoint], page-level above.
  adaptive,

  /// Direction-aware icon-only action for mobile headers and AppBars.
  compact,

  /// Direction-aware labeled action for desktop/web page headers.
  pageLevel,
}

/// A clickable ancestor rendered by [AppBackBreadcrumb].
class AppBackBreadcrumbItem {
  const AppBackBreadcrumbItem({required this.label, this.location, this.onTap})
    : assert(
        location != null || onTap != null,
        'A location or onTap callback is required.',
      );

  final String label;
  final String? location;
  final VoidCallback? onTap;
}

/// Canonical Back action with clickable route ancestry.
///
/// The Back button preserves history semantics, while each ancestor is an
/// explicit destination. Directional wrapping keeps the trail usable in LTR,
/// RTL, and narrow layouts.
class AppBackBreadcrumb extends StatelessWidget {
  const AppBackBreadcrumb({
    super.key,
    required this.ancestors,
    required this.currentLabel,
    this.fallbackLocation,
    this.onBack,
    this.variant = AppBackActionVariant.adaptive,
  }) : assert(
         onBack != null || fallbackLocation != null,
         'A fallbackLocation is required when onBack is not supplied.',
       );

  final List<AppBackBreadcrumbItem> ancestors;
  final String currentLabel;
  final String? fallbackLocation;
  final FutureOr<void> Function()? onBack;
  final AppBackActionVariant variant;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Wrap(
      key: const ValueKey('app-back-breadcrumb'),
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 4,
      runSpacing: 8,
      children: [
        AppBackAction(
          fallbackLocation: fallbackLocation,
          onBack: onBack,
          variant: variant,
        ),
        for (var index = 0; index < ancestors.length; index++) ...[
          TextButton(
            key: ValueKey('app-back-breadcrumb-ancestor-$index'),
            onPressed: () {
              final item = ancestors[index];
              final onTap = item.onTap;
              if (onTap != null) {
                onTap();
              } else {
                context.go(item.location!);
              }
            },
            style: TextButton.styleFrom(
              foregroundColor: colors.textSecondary,
              minimumSize: const Size(0, 40),
              padding: const EdgeInsetsDirectional.symmetric(horizontal: 8),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: textTheme.bodyMedium,
            ),
            child: Text(ancestors[index].label),
          ),
          Icon(Icons.chevron_right, size: 20, color: colors.textMuted),
        ],
        Padding(
          padding: const EdgeInsetsDirectional.symmetric(horizontal: 4),
          child: Text(
            currentLabel,
            key: const ValueKey('app-back-breadcrumb-current'),
            style: textTheme.bodyMedium?.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

/// Canonical true page-level Back action for ImpactLoop.
///
/// If [onBack] is supplied, it remains authoritative. Otherwise the action
/// requests a guard-aware pop and uses [fallbackLocation] only when there is no
/// usable in-app route to return to.
class AppBackAction extends StatefulWidget {
  const AppBackAction({
    super.key,
    this.fallbackLocation,
    this.onBack,
    this.variant = AppBackActionVariant.adaptive,
  }) : assert(
         onBack != null || fallbackLocation != null,
         'A fallbackLocation is required when onBack is not supplied.',
       );

  const AppBackAction.compact({super.key, this.fallbackLocation, this.onBack})
    : variant = AppBackActionVariant.compact,
      assert(
        onBack != null || fallbackLocation != null,
        'A fallbackLocation is required when onBack is not supplied.',
      );

  const AppBackAction.pageLevel({super.key, this.fallbackLocation, this.onBack})
    : variant = AppBackActionVariant.pageLevel,
      assert(
        onBack != null || fallbackLocation != null,
        'A fallbackLocation is required when onBack is not supplied.',
      );

  static const double compactBreakpoint = 768;

  final String? fallbackLocation;
  final FutureOr<void> Function()? onBack;
  final AppBackActionVariant variant;

  @override
  State<AppBackAction> createState() => _AppBackActionState();
}

class _AppBackActionState extends State<AppBackAction> {
  bool _navigationInFlight = false;

  Future<void> _handlePressed() async {
    if (_navigationInFlight) {
      return;
    }

    setState(() => _navigationInFlight = true);
    try {
      final onBack = widget.onBack;
      if (onBack != null) {
        await onBack();
        return;
      }

      await context.popOrGo(widget.fallbackLocation!);
    } finally {
      if (mounted) {
        setState(() => _navigationInFlight = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveVariant = switch (widget.variant) {
      AppBackActionVariant.adaptive =>
        MediaQuery.sizeOf(context).width < AppBackAction.compactBreakpoint
            ? AppBackActionVariant.compact
            : AppBackActionVariant.pageLevel,
      final variant => variant,
    };

    return switch (effectiveVariant) {
      AppBackActionVariant.compact => _CompactBackAction(
        onPressed: _navigationInFlight ? null : _handlePressed,
      ),
      AppBackActionVariant.pageLevel => _PageLevelBackAction(
        onPressed: _navigationInFlight ? null : _handlePressed,
      ),
      AppBackActionVariant.adaptive => throw StateError(
        'The adaptive Back variant must resolve before rendering.',
      ),
    };
  }
}

class _CompactBackAction extends StatelessWidget {
  const _CompactBackAction({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final label = MaterialLocalizations.of(context).backButtonTooltip;

    return IconButton(
      key: const ValueKey('app-back-compact'),
      tooltip: label,
      onPressed: onPressed,
      icon: const BackButtonIcon(),
      iconSize: 24,
      constraints: const BoxConstraints.tightFor(width: 48, height: 48),
      style: ButtonStyle(
        foregroundColor: WidgetStatePropertyAll(colors.textPrimary),
        overlayColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.pressed)) {
            return colors.primarySoft.withValues(alpha: 0.9);
          }
          if (states.contains(WidgetState.hovered) ||
              states.contains(WidgetState.focused)) {
            return colors.primarySoft.withValues(alpha: 0.65);
          }
          return null;
        }),
      ),
    );
  }
}

class _PageLevelBackAction extends StatelessWidget {
  const _PageLevelBackAction({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final label = MaterialLocalizations.of(context).backButtonTooltip;

    return Align(
      alignment: AlignmentDirectional.centerStart,
      widthFactor: 1,
      heightFactor: 1,
      child: Tooltip(
        message: label,
        child: OutlinedButton.icon(
          key: const ValueKey('app-back-page-level'),
          onPressed: onPressed,
          icon: const IconTheme(
            data: IconThemeData(size: 20),
            child: BackButtonIcon(),
          ),
          label: Text(label),
          style: ButtonStyle(
            minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
            padding: const WidgetStatePropertyAll(
              EdgeInsetsDirectional.symmetric(horizontal: 14),
            ),
            foregroundColor: WidgetStatePropertyAll(colors.textSecondary),
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.pressed)) {
                return colors.primarySoft.withValues(alpha: 0.95);
              }
              if (states.contains(WidgetState.hovered)) {
                return colors.primarySoft.withValues(alpha: 0.7);
              }
              if (states.contains(WidgetState.focused)) {
                return colors.primarySoft.withValues(alpha: 0.5);
              }
              return Colors.transparent;
            }),
            side: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.focused)) {
                return BorderSide(color: colors.primary, width: 2);
              }
              return BorderSide(color: colors.borderSubtle);
            }),
            shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(
                borderRadius: BorderRadius.all(Radius.circular(10)),
              ),
            ),
            elevation: const WidgetStatePropertyAll(0),
          ),
        ),
      ),
    );
  }
}
