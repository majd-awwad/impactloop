import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/comments/domain/comment_models.dart';

void main() {
  group('CommentItem.fromJson', () {
    test('maps visible comment with author projection', () {
      final comment = CommentItem.fromJson({
        'id': 'c1',
        'materialId': 'm1',
        'learningProjectId': null,
        'parentCommentId': null,
        'rootCommentId': null,
        'replyToCommentId': null,
        'body': 'Hello world',
        'status': 'VISIBLE',
        'isDeleted': false,
        'createdAt': '2026-07-27T10:00:00.000Z',
        'updatedAt': '2026-07-27T10:00:00.000Z',
        'editedAt': null,
        'deletedAt': null,
        'author': {
          'id': 'u1',
          'displayName': 'Amina',
          'avatarUrl': '/uploads/profiles/a.jpg',
        },
        'replyTo': null,
        'repliesCount': 3,
        'canEdit': true,
        'canDelete': true,
      });

      expect(comment.id, 'c1');
      expect(comment.body, 'Hello world');
      expect(comment.author.displayName, 'Amina');
      expect(comment.author.avatarUrl, '/uploads/profiles/a.jpg');
      expect(comment.repliesCount, 3);
      expect(comment.isDeleted, isFalse);
      expect(comment.canEdit, isTrue);
    });

    test('maps deleted placeholder and reply-to mention', () {
      final comment = CommentItem.fromJson({
        'id': 'c2',
        'body': null,
        'status': 'DELETED',
        'isDeleted': true,
        'createdAt': '2026-07-27T10:00:00.000Z',
        'updatedAt': '2026-07-27T11:00:00.000Z',
        'author': {'id': 'u2', 'displayName': 'Omar', 'avatarUrl': null},
        'replyTo': {
          'id': 'c1',
          'author': {'id': 'u1', 'displayName': 'Amina', 'avatarUrl': null},
        },
        'rootCommentId': 'root-1',
        'parentCommentId': 'root-1',
        'canEdit': false,
        'canDelete': false,
      });

      expect(comment.isDeleted, isTrue);
      expect(comment.body, isNull);
      expect(comment.replyTo?.author.displayName, 'Amina');
      expect(comment.rootCommentId, 'root-1');
    });
  });

  group('CommentsPage.fromJson', () {
    test('maps items and pagination', () {
      final page = CommentsPage.fromJson({
        'items': [
          {
            'id': 'c1',
            'body': 'One',
            'status': 'VISIBLE',
            'isDeleted': false,
            'createdAt': '2026-07-27T10:00:00.000Z',
            'updatedAt': '2026-07-27T10:00:00.000Z',
            'author': {
              'id': 'u1',
              'displayName': 'Amina',
              'avatarUrl': null,
            },
            'canEdit': false,
            'canDelete': false,
          },
        ],
        'pagination': {
          'page': 1,
          'limit': 20,
          'total': 1,
          'totalPages': 1,
        },
      });

      expect(page.items, hasLength(1));
      expect(page.pagination.total, 1);
      expect(page.pagination.hasMore, isFalse);
    });
  });
}
