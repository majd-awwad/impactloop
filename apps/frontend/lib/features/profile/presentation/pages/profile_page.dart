import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../../auth/data/models/user.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppThemeColors.of(context);
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;

    return Scaffold(
      backgroundColor: colors.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: appMobileAwareScrollPadding(context),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 900),
                    child: user == null
                        ? const _ProfileStatePanel()
                        : _ProfileContent(user: user),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileContent extends ConsumerWidget {
  const _ProfileContent({required this.user});

  final User user;

  String get _displayName {
    final name = user.displayName.trim();
    return name.isEmpty ? 'Account' : name;
  }

  String get _initial {
    final name = _displayName.trim();
    return name.isEmpty ? 'A' : name.characters.first.toUpperCase();
  }

  bool get _hasSupplierAccess {
    return user.hasRole('SUPPLIER') || user.supplierProfile != null;
  }

  String _clean(String? value) {
    return value?.trim() ?? '';
  }

  String _humanize(String value) {
    final words = value
        .trim()
        .replaceAll('_', ' ')
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .map((word) {
          final lower = word.toLowerCase();
          return lower.characters.first.toUpperCase() + lower.substring(1);
        })
        .toList();
    return words.isEmpty ? value : words.join(' ');
  }

  String? _memberSinceLabel(BuildContext context) {
    if (user.createdAt.millisecondsSinceEpoch == 0) {
      return null;
    }
    final date = MaterialLocalizations.of(context).formatMediumDate(
      user.createdAt,
    );
    return 'Member since $date';
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final logoutError = await ref
        .read(authControllerProvider.notifier)
        .logout();

    if (!context.mounted) {
      return;
    }

    context.go('/login');

    if (logoutError != null) {
      showInfoSnackBar(
        context,
        'You were signed out locally, but the server could not be reached.',
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppThemeColors.of(context);
    final learnerProfile = user.learnerProfile;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ProfileHeaderCard(
          initial: _initial,
          imageUrl: _clean(user.profileImageUrl),
          displayName: _displayName,
          email: user.email,
          accountStatus: _humanize(user.accountStatus),
          memberSince: _memberSinceLabel(context),
        ),
        const SizedBox(height: AppSpacing.md),
        _LearnerProfileCard(
          profile: learnerProfile,
          humanize: _humanize,
        ),
        const SizedBox(height: AppSpacing.md),
        _ProfileSection(
          title: 'Account actions',
          children: [
            _ProfileActionTile(
              icon: Icons.receipt_long_outlined,
              title: 'My reservations',
              subtitle: 'Track pickups and material requests.',
              onTap: () => context.go(learnerReservationsRoute),
            ),
            _ProfileDivider(),
            _ProfileActionTile(
              icon: _hasSupplierAccess
                  ? Icons.storefront_outlined
                  : Icons.add_business_outlined,
              title: _hasSupplierAccess
                  ? 'Supplier profile'
                  : 'Become a supplier',
              subtitle: _hasSupplierAccess
                  ? 'Manage your supplier details.'
                  : 'Start sharing reusable materials.',
              onTap: () => context.go(supplierEntryRouteForUser(user)),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        _ProfileSection(
          title: 'Account status',
          children: [
            _StatusLine(
              icon: user.emailVerifiedAt == null
                  ? Icons.mark_email_unread_outlined
                  : Icons.mark_email_read_outlined,
              label: 'Email',
              value: user.emailVerifiedAt == null ? 'Not verified' : 'Verified',
              emphasized: user.emailVerifiedAt != null,
            ),
            _ProfileDivider(),
            _StatusLine(
              icon: _clean(user.phone).isEmpty
                  ? Icons.phone_disabled_outlined
                  : Icons.phone_iphone_outlined,
              label: 'Phone',
              value: _clean(user.phone).isEmpty ? 'Not added' : user.phone!.trim(),
            ),
            _ProfileDivider(),
            _StatusLine(
              icon: Icons.verified_user_outlined,
              label: 'Account',
              value: _humanize(user.accountStatus),
              emphasized: user.accountStatus.toUpperCase() == 'ACTIVE',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        const _SettingsSection(),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: () => _logout(context, ref),
          style: OutlinedButton.styleFrom(
            foregroundColor: colors.danger,
            side: BorderSide(color: colors.danger.withValues(alpha: 0.42)),
            minimumSize: const Size(0, 48),
            shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          ),
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Logout'),
        ),
      ],
    );
  }
}

class _ProfileHeaderCard extends StatelessWidget {
  const _ProfileHeaderCard({
    required this.initial,
    required this.imageUrl,
    required this.displayName,
    required this.email,
    required this.accountStatus,
    required this.memberSince,
  });

  final String initial;
  final String imageUrl;
  final String displayName;
  final String email;
  final String accountStatus;
  final String? memberSince;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final imageProvider = imageUrl.isEmpty ? null : NetworkImage(imageUrl);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.1),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: colors.primarySoft,
            backgroundImage: imageProvider,
            child: imageProvider == null
                ? Text(
                    initial,
                    style: AppTextStyles.title(context).copyWith(
                      color: colors.primary,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: AppTextStyles.title(context).copyWith(
                    color: colors.textPrimary,
                    fontSize: 22,
                    letterSpacing: 0,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  email,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: colors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    const _RoleChip(label: 'Learner'),
                    _CompactBadge(label: accountStatus),
                    if (memberSince != null)
                      Text(
                        memberSince!,
                        style: AppTextStyles.label(context).copyWith(
                          color: colors.textMuted,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LearnerProfileCard extends StatelessWidget {
  const _LearnerProfileCard({
    required this.profile,
    required this.humanize,
  });

  final LearnerProfile? profile;
  final String Function(String value) humanize;

  @override
  Widget build(BuildContext context) {
    final learnerType = profile?.learnerType.trim() ?? '';
    final skillLevel = profile?.skillLevel.trim() ?? '';
    final bio = profile?.bio?.trim() ?? '';
    final interests =
        profile?.interests
            .map((interest) => interest.trim())
            .where((interest) => interest.isNotEmpty)
            .toList() ??
        const <String>[];
    final needsCompletion = interests.isEmpty || bio.isEmpty;

    final rows = <Widget>[];

    if (learnerType.isNotEmpty) {
      rows.add(
        _ProfileInfoRow(label: 'Learner type', value: humanize(learnerType)),
      );
    }
    if (skillLevel.isNotEmpty) {
      if (rows.isNotEmpty) rows.add(_ProfileDivider());
      rows.add(_ProfileInfoRow(label: 'Skill level', value: humanize(skillLevel)));
    }
    if (interests.isNotEmpty) {
      if (rows.isNotEmpty) rows.add(_ProfileDivider());
      rows.add(_InterestChips(interests: interests));
    }
    if (bio.isNotEmpty) {
      if (rows.isNotEmpty) rows.add(_ProfileDivider());
      rows.add(_ProfileBodyText(text: bio));
    }
    if (needsCompletion) {
      if (rows.isNotEmpty) rows.add(_ProfileDivider());
      rows.add(const _LearnerCompletionHint());
    }

    return _ProfileSection(
      title: 'Learner profile',
      trailingLabel: 'Coming soon',
      children: rows.isEmpty ? const [_LearnerCompletionHint()] : rows,
    );
  }
}

class _SettingsSection extends ConsumerWidget {
  const _SettingsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);

    return _ProfileSection(
      title: 'Settings',
      children: [
        _SettingChoice<ThemeMode>(
          icon: Icons.brightness_6_outlined,
          title: 'Appearance',
          value: settings.themeMode,
          values: ThemeMode.values,
          labelFor: themeModeLabel,
          onChanged: (value) {
            ref.read(appSettingsProvider.notifier).setThemeMode(value);
          },
        ),
        _SettingChoice<String>(
          icon: Icons.language_rounded,
          title: 'Language',
          value: settings.languageCode,
          values: const ['en', 'ar'],
          labelFor: languageLabel,
          onChanged: (value) {
            ref.read(appSettingsProvider.notifier).setLanguageCode(value);
          },
        ),
      ],
    );
  }
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({
    required this.title,
    required this.children,
    this.trailingLabel,
  });

  final String title;
  final List<Widget> children;
  final String? trailingLabel;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
              ),
              if (trailingLabel != null)
                Text(
                  trailingLabel!,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ...children,
        ],
      ),
    );
  }
}

class _ProfileActionTile extends StatelessWidget {
  const _ProfileActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.mdAll,
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: AppRadius.mdAll,
              ),
              child: Icon(icon, color: colors.primary, size: 20),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textSecondary,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(Icons.arrow_forward_rounded, color: colors.textMuted, size: 18),
          ],
        ),
      ),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  const _ProfileInfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textSecondary,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.icon,
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      children: [
        Icon(icon, color: emphasized ? colors.primary : colors.textMuted, size: 18),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textSecondary,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
            ),
          ),
        ),
        Text(
          value,
          style: AppTextStyles.label(context).copyWith(
            color: emphasized ? colors.primary : colors.textPrimary,
            fontWeight: FontWeight.w800,
            letterSpacing: 0,
          ),
        ),
      ],
    );
  }
}

class _ProfileDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: AppSpacing.sm),
      child: Divider(height: 1, thickness: 1, color: colors.borderSubtle),
    );
  }
}

class _CompactBadge extends StatelessWidget {
  const _CompactBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: colors.primary,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _RoleChip extends StatelessWidget {
  const _RoleChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _InterestChips extends StatelessWidget {
  const _InterestChips({required this.interests});

  final List<String> interests;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Interests',
          style: AppTextStyles.label(context).copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (final interest in interests)
              Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceMuted,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: colors.borderSubtle),
                ),
                child: Text(
                  interest,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _ProfileBodyText extends StatelessWidget {
  const _ProfileBodyText({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Text(
      text,
      style: AppTextStyles.body(context).copyWith(
        color: colors.textSecondary,
        height: 1.45,
      ),
    );
  }
}

class _LearnerCompletionHint extends StatelessWidget {
  const _LearnerCompletionHint();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lightbulb_outline_rounded, color: colors.primary, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Complete your learner profile',
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Add interests and a short bio to get better project suggestions.',
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingChoice<T> extends StatelessWidget {
  const _SettingChoice({
    required this.icon,
    required this.title,
    required this.value,
    required this.values,
    required this.labelFor,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final T value;
  final List<T> values;
  final String Function(T value) labelFor;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: colors.primary, size: 18),
              const SizedBox(width: AppSpacing.sm),
              Text(
                title,
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final item in values)
                ChoiceChip(
                  label: Text(labelFor(item)),
                  selected: item == value,
                  onSelected: (_) => onChanged(item),
                  checkmarkColor: colors.textOnPrimary,
                  labelStyle: TextStyle(
                    color: item == value
                        ? colors.textOnPrimary
                        : colors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                  selectedColor: colors.primary,
                  backgroundColor: colors.surfaceMuted,
                  side: BorderSide(
                    color: item == value ? colors.primary : colors.borderSubtle,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileStatePanel extends StatelessWidget {
  const _ProfileStatePanel();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        'Sign in to view your profile.',
        style: AppTextStyles.title(context).copyWith(color: colors.textPrimary),
        textAlign: TextAlign.center,
      ),
    );
  }
}
