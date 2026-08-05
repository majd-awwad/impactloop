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
    this.availability,
    this.sort,
  });

  final int page;
  final int limit;
  final String? q;
  final String? categoryId;
  final String? difficulty;
  final String? tag;
  final String? availability;
  final String? sort;

  @override
  bool operator ==(Object other) {
    return other is LearningProjectsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.q == q &&
        other.categoryId == categoryId &&
        other.difficulty == difficulty &&
        other.tag == tag &&
        other.availability == availability &&
        other.sort == sort;
  }

  @override
  int get hashCode => Object.hash(
    page,
    limit,
    q,
    categoryId,
    difficulty,
    tag,
    availability,
    sort,
  );
}

extension LearningProjectsQueryApiSerialization on LearningProjectsQuery {
  Map<String, dynamic> toApiQueryParameters() {
    return {
      'page': page,
      'limit': limit,
      if (q != null && q!.trim().isNotEmpty) 'q': q,
      if (categoryId != null && categoryId!.trim().isNotEmpty)
        'categoryId': categoryId,
      if (difficulty != null && difficulty!.trim().isNotEmpty)
        'difficulty': difficulty,
      if (tag != null && tag!.trim().isNotEmpty) 'tag': tag,
      if (availability != null &&
          availability!.trim().isNotEmpty &&
          availability != 'ANY')
        'availability': availability,
      if (sort != null && sort!.trim().isNotEmpty && sort != 'DEFAULT')
        'sort': sort,
    };
  }
}
