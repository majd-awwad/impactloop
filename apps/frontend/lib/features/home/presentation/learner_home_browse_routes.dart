import '../domain/learner_home_models.dart';

class LearnerHomeBrowseRoutes {
  const LearnerHomeBrowseRoutes._();

  static String forSection(LearnerHomeSectionKey key) {
    return '/home/recommendations/${key.apiValue}';
  }
}
