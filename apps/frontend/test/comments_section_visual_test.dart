import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/comments/application/comments_providers.dart';
import 'package:frontend/features/comments/data/comments_api.dart';
import 'package:frontend/features/comments/domain/comment_models.dart';
import 'package:frontend/features/comments/presentation/comments_section.dart';
import 'package:frontend/l10n/app_localizations.dart';

const _targetId = 'project-comments-visual';
const _rootId = 'root-comment';

void main() {
  testWidgets(
    'reply composer and refreshed replies stay attached to their root thread',
    (tester) async {
      final api = _ThreadCommentsApi();
      await tester.binding.setSurfaceSize(const Size(390, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthenticatedController.new),
            commentsApiProvider.overrideWithValue(api),
          ],
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

      final rootTile = find.byKey(const ValueKey('comment-root-$_rootId'));
      final toggle = find.byKey(
        const ValueKey('comment-replies-toggle-$_rootId'),
      );
      final rootReply = find.descendant(
        of: rootTile,
        matching: find.text('رد'),
      );

      expect(rootTile, findsOneWidget);
      expect(find.text('تعليق المتعلم'), findsOneWidget);
      expect(find.text('رد صاحب المشروع'), findsNothing);
      expect(find.text('رد أُعيد خطأً مع الجذور'), findsNothing);
      expect(find.ancestor(of: toggle, matching: rootTile), findsOneWidget);

      await tester.tap(rootReply);
      await tester.pump();

      final replyComposer = find.byKey(
        const ValueKey('comment-reply-composer-$_rootId'),
      );
      expect(replyComposer, findsOneWidget);
      expect(find.text('ردًا على متعلم'), findsOneWidget);
      expect(
        tester.getTopLeft(replyComposer).dy,
        greaterThan(tester.getTopLeft(rootTile).dy),
      );

      await tester.tap(find.text('إلغاء'));
      await tester.pump();
      expect(replyComposer, findsNothing);
      expect(find.text('0/1000'), findsOneWidget);

      await tester.tap(toggle);
      await tester.pumpAndSettle();
      expect(find.text('رد صاحب المشروع'), findsOneWidget);
      expect(find.text('تعليق علوي أُعيد خطأً مع الردود'), findsNothing);
      expect(find.text('إخفاء الردود'), findsOneWidget);

      final rootX = tester.getTopLeft(find.text('تعليق المتعلم')).dx;
      final replyX = tester.getTopLeft(find.text('رد صاحب المشروع')).dx;
      expect(replyX, lessThan(rootX));

      await tester.tap(find.text('إخفاء الردود'));
      await tester.pump();
      expect(find.text('رد صاحب المشروع'), findsNothing);

      await tester.tap(find.text('عرض الردود (1)'));
      await tester.pumpAndSettle();
      await tester.tap(rootReply);
      await tester.pump();
      await tester.enterText(find.byType(TextField), 'رد جديد');
      await tester.tap(find.widgetWithText(FilledButton, 'نشر'));
      await tester.pumpAndSettle();

      expect(api.lastParentCommentId, _rootId);
      expect(api.lastReplyToCommentId, _rootId);
      expect(api.rootLoads, greaterThanOrEqualTo(2));
      expect(api.replyLoads, greaterThanOrEqualTo(2));
      expect(find.text('رد جديد'), findsOneWidget);
      expect(
        find.ancestor(
          of: find.text('رد جديد'),
          matching: find.byKey(const ValueKey('comment-replies-$_rootId')),
        ),
        findsOneWidget,
      );
    },
  );
}

final _testDate = DateTime.fromMillisecondsSinceEpoch(0);

CommentItem _reply({required String id, required String body}) {
  return CommentItem(
    id: id,
    learningProjectId: _targetId,
    body: body,
    status: 'VISIBLE',
    isDeleted: false,
    createdAt: _testDate,
    updatedAt: _testDate,
    author: const CommentAuthor(id: 'owner', displayName: 'صاحب المشروع'),
    canEdit: false,
    canDelete: false,
    repliesCount: 0,
    parentCommentId: _rootId,
    rootCommentId: _rootId,
  );
}

class _ThreadCommentsApi extends CommentsApi {
  _ThreadCommentsApi() : super(Dio());

  int rootLoads = 0;
  int replyLoads = 0;
  bool replyCreated = false;
  String? lastParentCommentId;
  String? lastReplyToCommentId;

  CommentItem get _root => CommentItem(
    id: _rootId,
    learningProjectId: _targetId,
    body: 'تعليق المتعلم',
    status: 'VISIBLE',
    isDeleted: false,
    createdAt: _testDate,
    updatedAt: _testDate,
    author: const CommentAuthor(id: 'learner', displayName: 'متعلم'),
    canEdit: false,
    canDelete: false,
    repliesCount: replyCreated ? 2 : 1,
  );

  @override
  Future<CommentsPage> listRootComments({
    required CommentTargetType type,
    required String targetId,
    int page = 1,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    rootLoads += 1;
    return CommentsPage(
      items: [
        _root,
        _reply(id: 'stray-root-reply', body: 'رد أُعيد خطأً مع الجذور'),
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
        _reply(id: 'reply-comment', body: 'رد صاحب المشروع'),
        if (replyCreated) _reply(id: 'new-reply', body: 'رد جديد'),
        CommentItem(
          id: 'stray-top-level',
          learningProjectId: _targetId,
          body: 'تعليق علوي أُعيد خطأً مع الردود',
          status: 'VISIBLE',
          isDeleted: false,
          createdAt: _testDate,
          updatedAt: _testDate,
          author: const CommentAuthor(id: 'other', displayName: 'آخر'),
          canEdit: false,
          canDelete: false,
        ),
      ],
      pagination: const CommentsPagination(
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      ),
    );
  }

  @override
  Future<CommentItem> createComment({
    required CommentTargetType type,
    required String targetId,
    required String body,
    String? parentCommentId,
    String? replyToCommentId,
  }) async {
    replyCreated = true;
    lastParentCommentId = parentCommentId;
    lastReplyToCommentId = replyToCommentId;
    return _reply(id: 'new-reply', body: body);
  }
}

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'learner',
      displayName: 'متعلم',
      email: 'learner@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['LEARNER'],
      activeRole: 'LEARNER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'test-token',
    hasBootstrapped: true,
  );
}
