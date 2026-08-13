import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/comments/application/comments_providers.dart';
import 'package:frontend/features/comments/data/comments_api.dart';
import 'package:frontend/features/comments/domain/comment_models.dart';
import 'package:frontend/features/comments/presentation/comments_section.dart';
import 'package:frontend/l10n/app_localizations.dart';

const _targetId = 'project-comments-visual';

void main() {
  testWidgets('comment thread keeps replies nested with localized actions', (
    tester,
  ) async {
    final api = _ThreadCommentsApi();
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [commentsApiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          locale: Locale('ar'),
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: SingleChildScrollView(
              child: CommentsSection(
                targetType: CommentTargetType.learningProject,
                targetId: _targetId,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('تعليق المتعلم'), findsOneWidget);
    expect(find.text('رد صاحب المشروع'), findsNothing);
    expect(find.text('0/1000'), findsOneWidget);

    await tester.tap(find.text('عرض الردود (1)'));
    await tester.pumpAndSettle();

    expect(find.text('رد صاحب المشروع'), findsOneWidget);
    expect(find.text('رد'), findsNWidgets(2));
    expect(api.replyLoads, 1);

    final rootX = tester.getTopLeft(find.text('تعليق المتعلم')).dx;
    final replyX = tester.getTopLeft(find.text('رد صاحب المشروع')).dx;
    expect(replyX, lessThan(rootX));
  });
}

final _testDate = DateTime.fromMillisecondsSinceEpoch(0);

class _ThreadCommentsApi extends CommentsApi {
  _ThreadCommentsApi() : super(Dio());

  int replyLoads = 0;

  @override
  Future<CommentsPage> listRootComments({
    required CommentTargetType type,
    required String targetId,
    int page = 1,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    return CommentsPage(
      items: [
        CommentItem(
          id: 'root-comment',
          learningProjectId: _targetId,
          body: 'تعليق المتعلم',
          status: 'VISIBLE',
          isDeleted: false,
          createdAt: _testDate,
          updatedAt: _testDate,
          author: const CommentAuthor(id: 'learner', displayName: 'متعلم'),
          canEdit: false,
          canDelete: false,
          repliesCount: 1,
        ),
      ],
      pagination: const CommentsPagination(
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      ),
    );
  }

  @override
  Future<CommentsPage> listReplies({
    required CommentTargetType type,
    required String targetId,
    required String rootCommentId,
    int page = 1,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    replyLoads += 1;
    return CommentsPage(
      items: [
        CommentItem(
          id: 'reply-comment',
          learningProjectId: _targetId,
          body: 'رد صاحب المشروع',
          status: 'VISIBLE',
          isDeleted: false,
          createdAt: _testDate,
          updatedAt: _testDate,
          author: const CommentAuthor(id: 'owner', displayName: 'صاحب المشروع'),
          canEdit: false,
          canDelete: false,
          repliesCount: 0,
          rootCommentId: 'root-comment',
        ),
      ],
      pagination: const CommentsPagination(
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      ),
    );
  }
}
