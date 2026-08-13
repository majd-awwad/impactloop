import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_theme_colors.dart';
import '../../../l10n/l10n.dart';
import '../../../core/errors/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../../shared/widgets/supplier/supplier_identity_widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../application/comments_providers.dart';
import '../domain/comment_models.dart';
import 'comments_l10n.dart';

class CommentsSection extends ConsumerStatefulWidget {
  const CommentsSection({
    super.key,
    required this.targetType,
    required this.targetId,
    this.title,
  });

  final CommentTargetType targetType;
  final String targetId;
  final String? title;

  @override
  ConsumerState<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<CommentsSection> {
  final TextEditingController _composerController = TextEditingController();
  final Map<String, List<CommentItem>> _loadedReplies = {};
  final Map<String, CommentsPagination?> _replyPagination = {};
  final Set<String> _expandedRoots = {};
  final Set<String> _loadingReplies = {};
  final Map<String, CancelToken> _replyCancelTokens = {};

  CommentItem? _replyingTo;
  String? _editingCommentId;
  bool _submitting = false;

  CommentsTargetKey get _key =>
      (type: widget.targetType, targetId: widget.targetId);

  @override
  void dispose() {
    for (final token in _replyCancelTokens.values) {
      token.cancel('Comments section disposed');
    }
    _composerController.dispose();
    super.dispose();
  }

  String get _loginFromPath {
    switch (widget.targetType) {
      case CommentTargetType.material:
        return '/materials/${widget.targetId}';
      case CommentTargetType.learningProject:
        return '/learning/${widget.targetId}';
    }
  }

  bool _ensureAuthenticated() {
    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent(_loginFromPath);
      context.go('/login?from=$from');
      return false;
    }
    return true;
  }

  Future<void> _refreshRoots() async {
    final _ = await ref.refresh(rootCommentsProvider(_key).future);
  }

  bool _isTopLevelComment(CommentItem comment) {
    return comment.parentCommentId == null && comment.rootCommentId == null;
  }

  bool _belongsToRoot(CommentItem comment, String rootId) {
    return comment.id != rootId &&
        (comment.rootCommentId == rootId || comment.parentCommentId == rootId);
  }

  CommentItem _rootReference(String rootId) {
    return CommentItem(
      id: rootId,
      body: null,
      status: 'VISIBLE',
      isDeleted: false,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      author: const CommentAuthor(id: '', displayName: ''),
      canEdit: false,
      canDelete: false,
      repliesCount: 0,
    );
  }

  Future<void> _loadReplies(CommentItem root, {bool reset = false}) async {
    if (_loadingReplies.contains(root.id)) {
      return;
    }

    setState(() {
      _loadingReplies.add(root.id);
      if (reset) {
        _loadedReplies.remove(root.id);
        _replyPagination.remove(root.id);
      }
    });

    try {
      _replyCancelTokens[root.id]?.cancel('Reply request replaced');
      final cancelToken = CancelToken();
      _replyCancelTokens[root.id] = cancelToken;
      final currentPage = reset
          ? 1
          : ((_replyPagination[root.id]?.page ?? 0) + 1);
      final page = await ref
          .read(commentsApiProvider)
          .listReplies(
            type: widget.targetType,
            targetId: widget.targetId,
            rootCommentId: root.id,
            page: currentPage,
            cancelToken: cancelToken,
          );

      if (!mounted) {
        return;
      }

      setState(() {
        final validReplies = page.items
            .where((comment) => _belongsToRoot(comment, root.id))
            .toList();
        final existing = reset
            ? <CommentItem>[]
            : (_loadedReplies[root.id] ?? <CommentItem>[]);
        final repliesById = <String, CommentItem>{
          for (final reply in existing) reply.id: reply,
          for (final reply in validReplies) reply.id: reply,
        };
        _loadedReplies[root.id] = repliesById.values.toList();
        _replyPagination[root.id] = page.pagination;
        _expandedRoots.add(root.id);
      });
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error) && mounted) {
        showErrorSnackBar(context, error);
      }
    } on ApiException catch (error) {
      if (error.isCancellation) {
        return;
      }
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingReplies.remove(root.id);
        });
      }
      _replyCancelTokens.remove(root.id);
    }
  }

  Future<void> _toggleReplies(CommentItem root) async {
    if (_expandedRoots.contains(root.id)) {
      setState(() {
        _expandedRoots.remove(root.id);
        if (_replyingTo?.rootCommentId == root.id) {
          _replyingTo = null;
          _composerController.clear();
        }
      });
      return;
    }

    if (_loadedReplies.containsKey(root.id)) {
      setState(() => _expandedRoots.add(root.id));
      return;
    }

    await _loadReplies(root, reset: true);
  }

  Future<void> _submitComposer() async {
    if (_submitting || !_ensureAuthenticated()) {
      return;
    }

    final body = _composerController.text.trim();
    if (body.isEmpty) {
      showInfoSnackBar(context, CommentsL10n(context).writeBeforePosting);
      return;
    }
    if (body.length > 1000) {
      showInfoSnackBar(context, CommentsL10n(context).commentLimit);
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final api = ref.read(commentsApiProvider);
      String? replyRootId;

      if (_editingCommentId != null) {
        await api.updateComment(
          type: widget.targetType,
          targetId: widget.targetId,
          commentId: _editingCommentId!,
          body: body,
        );
      } else if (_replyingTo != null) {
        final replyTarget = _replyingTo!;
        final rootId = replyTarget.rootCommentId ?? replyTarget.id;
        replyRootId = rootId;
        await api.createComment(
          type: widget.targetType,
          targetId: widget.targetId,
          body: body,
          parentCommentId: rootId,
          replyToCommentId: replyTarget.id,
        );
      } else {
        await api.createComment(
          type: widget.targetType,
          targetId: widget.targetId,
          body: body,
        );
      }

      await _refreshRoots();
      if (replyRootId != null) {
        await _loadReplies(_rootReference(replyRootId), reset: true);
      }

      if (!mounted) {
        return;
      }

      _composerController.clear();
      setState(() {
        _replyingTo = null;
        _editingCommentId = null;
      });
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _deleteComment(CommentItem comment) async {
    if (!_ensureAuthenticated()) {
      return;
    }

    try {
      await ref
          .read(commentsApiProvider)
          .deleteComment(
            type: widget.targetType,
            targetId: widget.targetId,
            commentId: comment.id,
          );
      await _refreshRoots();
      final rootId = comment.rootCommentId ?? comment.id;
      if (_expandedRoots.contains(rootId)) {
        await _loadReplies(_rootReference(rootId), reset: true);
      }
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    }
  }

  void _startReply(CommentItem comment) {
    if (!_ensureAuthenticated()) {
      return;
    }
    if (_replyingTo?.id != comment.id) {
      _composerController.clear();
    }
    setState(() {
      _editingCommentId = null;
      _replyingTo = comment;
    });
  }

  void _startEdit(CommentItem comment) {
    setState(() {
      _replyingTo = null;
      _editingCommentId = comment.id;
      _composerController.text = comment.body ?? '';
    });
  }

  void _cancelComposerMode() {
    setState(() {
      _replyingTo = null;
      _editingCommentId = null;
      _composerController.clear();
    });
  }

  Widget _replyComposerFor(CommentItem comment) {
    if (_replyingTo?.id != comment.id) {
      return const SizedBox.shrink();
    }

    return Padding(
      key: ValueKey('comment-reply-composer-${comment.id}'),
      padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
      child: _Composer(
        controller: _composerController,
        submitting: _submitting,
        replyingTo: comment,
        editing: false,
        onCancel: _cancelComposerMode,
        onSubmit: _submitComposer,
      ),
    );
  }

  Widget _rootThread(
    CommentItem root,
    CommentsL10n l10n,
    AppThemeColors colors,
  ) {
    final expanded = _expandedRoots.contains(root.id);
    final loading = _loadingReplies.contains(root.id);
    final replies = (_loadedReplies[root.id] ?? const <CommentItem>[])
        .where((comment) => _belongsToRoot(comment, root.id))
        .toList();

    return Column(
      key: ValueKey('comment-thread-${root.id}'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CommentTile(
          comment: root,
          isReply: false,
          onReply: () => _startReply(root),
          onEdit: root.canEdit ? () => _startEdit(root) : null,
          onDelete: root.canDelete ? () => _deleteComment(root) : null,
          threadAction: root.repliesCount > 0
              ? Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    key: ValueKey('comment-replies-toggle-${root.id}'),
                    onPressed: loading ? null : () => _toggleReplies(root),
                    style: _commentActionStyle(context),
                    icon: Icon(
                      expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 18,
                    ),
                    label: Text(
                      expanded
                          ? l10n.hideReplies
                          : l10n.viewReplies(root.repliesCount),
                    ),
                  ),
                )
              : null,
        ),
        Padding(
          padding: const EdgeInsetsDirectional.only(start: AppSpacing.lg),
          child: _replyComposerFor(root),
        ),
        if (expanded || loading)
          Container(
            key: ValueKey('comment-replies-${root.id}'),
            margin: const EdgeInsetsDirectional.only(
              start: AppSpacing.lg,
              top: AppSpacing.sm,
            ),
            padding: const EdgeInsetsDirectional.only(start: AppSpacing.md),
            decoration: BoxDecoration(
              border: BorderDirectional(
                start: BorderSide(color: colors.borderSubtle),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final reply in replies) ...[
                  _CommentTile(
                    comment: reply,
                    isReply: true,
                    onReply: () => _startReply(reply),
                    onEdit: reply.canEdit ? () => _startEdit(reply) : null,
                    onDelete: reply.canDelete
                        ? () => _deleteComment(reply)
                        : null,
                  ),
                  _replyComposerFor(reply),
                  const SizedBox(height: AppSpacing.sm),
                ],
                if (loading)
                  const Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  ),
                if ((_replyPagination[root.id]?.hasMore ?? false) && !loading)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton(
                      onPressed: () => _loadReplies(root),
                      child: Text(l10n.loadMoreReplies),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = CommentsL10n(context);
    final rootsAsync = ref.watch(rootCommentsProvider(_key));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.title ?? l10n.comments,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.intro,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (_replyingTo == null) ...[
            _Composer(
              controller: _composerController,
              submitting: _submitting,
              replyingTo: null,
              editing: _editingCommentId != null,
              onCancel: _cancelComposerMode,
              onSubmit: _submitComposer,
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          rootsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => Text(
              error is ApiException
                  ? localizedApiErrorMessage(error, context.l10n)
                  : l10n.loadFailed,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
            data: (page) {
              final roots = page.items.where(_isTopLevelComment).toList();
              if (roots.isEmpty) {
                return Text(
                  l10n.empty,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final root in roots) ...[
                    _rootThread(root, l10n, colors),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.submitting,
    required this.replyingTo,
    required this.editing,
    required this.onCancel,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool submitting;
  final CommentItem? replyingTo;
  final bool editing;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = CommentsL10n(context);
    final modeLabel = editing
        ? l10n.editing
        : replyingTo != null
        ? l10n.replyingTo(replyingTo!.author.displayName)
        : null;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (modeLabel != null) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    modeLabel,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: colors.primary,
                    ),
                  ),
                ),
                TextButton(onPressed: onCancel, child: Text(l10n.cancel)),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          TextField(
            controller: controller,
            minLines: 2,
            maxLines: 4,
            maxLength: 1000,
            decoration: InputDecoration(
              hintText: editing
                  ? l10n.updateComment
                  : replyingTo != null
                  ? l10n.writeReply
                  : l10n.writeComment,
              counterText: '',
              filled: true,
              fillColor: colors.cardSurface,
              contentPadding: const EdgeInsetsDirectional.all(AppSpacing.md),
              border: OutlineInputBorder(borderRadius: AppRadius.mdAll),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: colors.borderSubtle),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) {
              return Row(
                children: [
                  Text(
                    '${value.text.runes.length}/1000',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.textMuted,
                    ),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: submitting ? null : onSubmit,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.md,
                      ),
                    ),
                    child: submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(editing ? l10n.save : l10n.post),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({
    required this.comment,
    required this.isReply,
    required this.onReply,
    this.onEdit,
    this.onDelete,
    this.threadAction,
  });

  final CommentItem comment;
  final bool isReply;
  final VoidCallback onReply;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final Widget? threadAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = CommentsL10n(context);
    final showMention =
        isReply &&
        comment.replyTo != null &&
        comment.replyTo!.id != (comment.rootCommentId ?? '');

    return Container(
      key: ValueKey('comment-${isReply ? 'reply' : 'root'}-${comment.id}'),
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: isReply
            ? Color.alphaBlend(
                colors.primary.withValues(alpha: 0.03),
                colors.cardSurface,
              )
            : colors.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SupplierIdentityAvatar(
            displayName: comment.author.displayName,
            avatarUrl: comment.author.avatarUrl,
            radius: isReply ? 14 : 18,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        comment.author.displayName,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (comment.editedAt != null && !comment.isDeleted)
                      Text(
                        l10n.edited,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                if (comment.isDeleted)
                  Text(
                    l10n.removed,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontStyle: FontStyle.italic,
                    ),
                  )
                else ...[
                  if (showMention)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(
                        bottom: AppSpacing.xs,
                      ),
                      child: Text(
                        l10n.replyingTo(comment.replyTo!.author.displayName),
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ),
                  Text(comment.body ?? '', style: theme.textTheme.bodyMedium),
                ],
                if (!comment.isDeleted) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      TextButton.icon(
                        onPressed: onReply,
                        style: _commentActionStyle(context),
                        icon: const Icon(Icons.reply_rounded, size: 16),
                        label: Text(l10n.reply),
                      ),
                      if (onEdit != null)
                        TextButton.icon(
                          onPressed: onEdit,
                          style: _commentActionStyle(context),
                          icon: const Icon(Icons.edit_outlined, size: 16),
                          label: Text(l10n.edit),
                        ),
                      if (onDelete != null)
                        TextButton.icon(
                          onPressed: onDelete,
                          style: _commentActionStyle(context, danger: true),
                          icon: const Icon(Icons.delete_outline, size: 16),
                          label: Text(l10n.delete),
                        ),
                    ],
                  ),
                  if (threadAction != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    threadAction!,
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

ButtonStyle _commentActionStyle(BuildContext context, {bool danger = false}) {
  final colors = AppThemeColors.of(context);
  return TextButton.styleFrom(
    foregroundColor: danger ? colors.danger : colors.textSecondary,
    visualDensity: VisualDensity.compact,
    padding: const EdgeInsetsDirectional.symmetric(
      horizontal: AppSpacing.sm,
      vertical: AppSpacing.xs,
    ),
    minimumSize: const Size(0, 32),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  );
}
