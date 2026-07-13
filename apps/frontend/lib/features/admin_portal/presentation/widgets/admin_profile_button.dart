import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_settings_controls.dart';

class AdminProfileButton extends ConsumerWidget {
  const AdminProfileButton({
    super.key,
    required this.displayName,
    this.email,
    this.showSettingsControls = false,
  });

  final String displayName;
  final String? email;
  final bool showSettingsControls;

  String get _initial {
    final trimmed = displayName.trim();
    return trimmed.isEmpty ? 'A' : trimmed.characters.first.toUpperCase();
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    await ref.read(authControllerProvider.notifier).logout();
    if (context.mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final decorations = context.adminDecorations;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openMenu(context, ref),
        borderRadius: AppRadius.pillAll,
        child: Ink(
          padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 10, 6),
          decoration: decorations.topBarPill,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: decorations.avatarCircle,
                child: Text(
                  _initial,
                  style: TextStyle(
                    color: palette.primaryTeal,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (!showSettingsControls) ...[
                const SizedBox(width: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 120),
                  child: Text(
                    displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _openMenu(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final compact = MediaQuery.sizeOf(context).width < 920;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: palette.surfaceElevated,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.border),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  displayName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: palette.textPrimary,
                      ),
                ),
                if (email != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    email!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                  ),
                ],
                if (compact || showSettingsControls) ...[
                  const SizedBox(height: AppSpacing.md),
                  const AdminSettingsControls(compact: true),
                ],
                const SizedBox(height: AppSpacing.md),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _logout(context, ref);
                  },
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Logout'),
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.danger,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
