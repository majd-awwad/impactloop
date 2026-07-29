import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../l10n/learner_profile_l10n.dart';
import '../widgets/learner_profile_hub_widgets.dart';

const _profileHubMaxWidth = 760.0;

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      backgroundColor: colors.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
              showPhoneAccountMenu: false,
              phoneTitle: l10n.pageTitle,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: appMobileAwareScrollPadding(context),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _profileHubMaxWidth,
                    ),
                    child: user == null
                        ? AppEmptyStateCard(
                            icon: Icons.person_outline_rounded,
                            title: l10n.pageTitle,
                            subtitle: l10n.signInToViewProfile,
                            compact: true,
                          )
                        : LearnerProfileHubContent(
                            user: user,
                            onOpenAccountSettings: () =>
                                context.push(accountSettingsRoute),
                          ),
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
