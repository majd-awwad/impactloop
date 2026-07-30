import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/profile_providers.dart';
import '../../data/models/learner_profile_summary.dart';
import '../l10n/learner_profile_l10n.dart';
import '../widgets/learner_profile_dashboard_widgets.dart';

const _profileDashboardMaxWidth = 1040.0;

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  LearnerProfileSummary? _lastSummary;
  String? _lastSummaryUserId;
  Future<void>? _refreshInFlight;

  Future<void> _coalesceRefresh(Future<void> Function() operation) {
    final existing = _refreshInFlight;
    if (existing != null) {
      return existing;
    }

    late final Future<void> refresh;
    refresh = operation().whenComplete(() {
      if (identical(_refreshInFlight, refresh)) {
        _refreshInFlight = null;
      }
    });
    _refreshInFlight = refresh;
    return refresh;
  }

  Future<void> _refreshSummary({bool showFailure = true}) {
    return _coalesceRefresh(() async {
      try {
        final _ = await ref.refresh(learnerProfileSummaryProvider.future);
      } catch (_) {
        if (showFailure) {
          _showRefreshFailure();
        }
      }
    });
  }

  Future<void> _refreshAll() {
    return _coalesceRefresh(() async {
      var failed = false;
      try {
        await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      } catch (_) {
        failed = true;
      }

      try {
        final _ = await ref.refresh(learnerProfileSummaryProvider.future);
      } catch (_) {
        failed = true;
      }

      if (failed) {
        _showRefreshFailure();
      }
    });
  }

  void _showRefreshFailure() {
    if (!mounted) {
      return;
    }
    final l10n = LearnerProfileL10n.of(context);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.refreshFailed)));
  }

  Future<void> _openRoute(
    String route, {
    required bool refreshOnReturn,
  }) async {
    await context.push(route);
    if (!mounted || !refreshOnReturn) {
      return;
    }
    await _refreshSummary();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final user = ref.watch(authControllerProvider).user;
    final activeLearner =
        user?.isLearnerMode == true && user?.hasRole('LEARNER') == true;
    final summaryAsync = activeLearner
        ? ref.watch(learnerProfileSummaryProvider)
        : null;

    if (user == null || _lastSummaryUserId != user.id) {
      _lastSummary = null;
      _lastSummaryUserId = user?.id;
    }

    final latestSummary = summaryAsync?.asData?.value;
    if (latestSummary != null) {
      _lastSummary = latestSummary;
    }
    final visibleSummary = latestSummary ?? _lastSummary;

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
              child: user == null
                  ? SingleChildScrollView(
                      padding: appMobileAwareScrollPadding(
                        context,
                        top: 16,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            maxWidth: _profileDashboardMaxWidth,
                          ),
                          child: AppEmptyStateCard(
                            icon: Icons.person_outline_rounded,
                            title: l10n.pageTitle,
                            subtitle: l10n.signInToViewProfile,
                            compact: true,
                          ),
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _refreshAll,
                      color: colors.primary,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: appMobileAwareScrollPadding(
                          context,
                          top: 16,
                        ),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(
                              maxWidth: _profileDashboardMaxWidth,
                            ),
                            child: LearnerProfileDashboard(
                              user: user,
                              summary: visibleSummary,
                              isInitialLoading:
                                  summaryAsync?.isLoading == true &&
                                  visibleSummary == null,
                              isRefreshing:
                                  summaryAsync?.isLoading == true &&
                                  visibleSummary != null,
                              hasSummaryError: summaryAsync?.hasError == true,
                              onRetry: () => _refreshSummary(showFailure: false),
                              onOpenRoute: _openRoute,
                            ),
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
