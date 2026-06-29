import 'models/learning_project.dart';

class LearningProjectsResult {
  const LearningProjectsResult({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<LearningProject> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;
}

class LearningProjectsQuery {
  const LearningProjectsQuery({
    this.page = 1,
    this.limit = 20,
    this.q,
    this.categoryId,
    this.difficulty,
    this.tag,
  });

  final int page;
  final int limit;
  final String? q;
  final String? categoryId;
  final String? difficulty;
  final String? tag;

  @override
  bool operator ==(Object other) {
    return other is LearningProjectsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.q == q &&
        other.categoryId == categoryId &&
        other.difficulty == difficulty &&
        other.tag == tag;
  }

  @override
  int get hashCode => Object.hash(page, limit, q, categoryId, difficulty, tag);
}
