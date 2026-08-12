import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'project_help_session_canonical_cache.dart';
import 'project_help_sessions_providers.dart';

/// Clears every PHS state holder whose contents belong to an authenticated user.
/// Family invalidation applies to all currently-created session/project keys.
void invalidateProjectHelpSessionAuthScopedState(Ref ref) {
  ref.invalidate(learnerHelpSessionsQueryProvider);
  ref.invalidate(learnerHelpSessionsProvider);
  ref.invalidate(learnerHelpSessionDetailProvider);
  ref.invalidate(projectHelpSessionAvailabilityProvider);
  ref.invalidate(projectHelpSessionProjectOptionsProvider);
  ref.invalidate(activeHelpSessionForBuildProvider);

  ref.invalidate(authorHelpSessionsQueryProvider);
  ref.invalidate(authorHelpSessionsProvider);
  ref.invalidate(authorHelpSessionDetailProvider);
  ref.invalidate(projectHelpSessionSettingsProvider);
  ref.invalidate(hasAuthoredProjectSubmissionsProvider);
  ref.invalidate(authorHelpSessionsEntryVisibleProvider);

  ref.invalidate(projectHelpSessionActionControllerProvider);
  ref.invalidate(projectHelpSessionCanonicalCacheProvider);
  ref.invalidate(activeHelpSessionByBuildCacheProvider);
  ref.invalidate(projectHelpSessionSettingsCanonicalCacheProvider);
}
