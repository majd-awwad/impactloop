import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../data/comments_api.dart';
import '../domain/comment_models.dart';

final commentsApiProvider = Provider<CommentsApi>((ref) {
  return CommentsApi(ref.watch(apiClientProvider));
});

typedef CommentsTargetKey = ({CommentTargetType type, String targetId});

final rootCommentsProvider = FutureProvider.autoDispose
    .family<CommentsPage, CommentsTargetKey>((ref, key) async {
      final cancelToken = CancelToken();
      ref.onDispose(() => cancelToken.cancel('Comments provider disposed'));
      return ref
          .watch(commentsApiProvider)
          .listRootComments(
            type: key.type,
            targetId: key.targetId,
            cancelToken: cancelToken,
          );
    });
