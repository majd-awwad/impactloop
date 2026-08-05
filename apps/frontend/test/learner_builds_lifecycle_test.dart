import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'dart:typed_data';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/learner_builds_api.dart';
import 'package:frontend/features/learner_builds/data/models/learner_build_models.dart';
import 'package:frontend/features/learner_builds/presentation/l10n/learner_builds_l10n.dart';
import 'package:frontend/features/learner_builds/presentation/pages/my_builds_page.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

void main() {
  testWidgets('my builds page shows lifecycle tab labels', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp(
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Archived'), findsOneWidget);
  });

  testWidgets('my builds page shows Arabic tab labels', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('ar'),
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('ar'), Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('نشطة'), findsOneWidget);
    expect(find.text('مؤجلة'), findsOneWidget);
    expect(find.text('مكتملة'), findsOneWidget);
    expect(find.text('مؤرشفة'), findsOneWidget);
  });

  testWidgets('my builds active empty state offers learning hub action', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: GoRouter(
            routes: [
              GoRoute(
                path: '/',
                builder: (context, state) => const MyBuildsPage(),
              ),
              GoRoute(
                path: '/learning',
                builder: (context, state) =>
                    const Scaffold(body: Text('learning hub page')),
              ),
            ],
          ),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No builds here yet'), findsOneWidget);
    expect(find.text('Browse Learning Hub'), findsOneWidget);

    await tester.tap(find.text('Browse Learning Hub'));
    await tester.pumpAndSettle();

    expect(find.text('learning hub page'), findsOneWidget);
  });

  testWidgets('my builds list shows resume hint for paused build card', (
    tester,
  ) async {
    final pausedItem = LearnerBuildListItem(
      id: 'build-paused',
      projectId: 'project-1',
      attemptNumber: 1,
      status: ProjectBuildStatus.paused,
      project: const LearnerBuildListProject(
        id: 'project-1',
        title: 'Paused greenhouse kit',
        shortDescription: 'Paused build',
      ),
      startedAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 2),
      pausedAt: DateTime(2026, 1, 2),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => LearnerBuildListResult(
              items: [pausedItem],
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            ),
          ),
        ],
        child: MaterialApp(
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Paused greenhouse kit'), findsOneWidget);
    expect(find.text('Paused'), findsWidgets);
    expect(find.text('Resume build'), findsOneWidget);
  });

  testWidgets('archived tab shows empty archived copy', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsQueryProvider.overrideWith(_ArchivedQueryNotifier.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp(
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No archived builds yet.'), findsOneWidget);
  });

  testWidgets('archived tab selection uses ARCHIVED filter', (tester) async {
    String? requestedStatus;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith((ref) async {
            requestedStatus = ref.watch(learnerBuildsQueryProvider).status;
            return const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            );
          }),
        ],
        child: MaterialApp(
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Archived'));
    await tester.pumpAndSettle();

    expect(requestedStatus, 'ARCHIVED');
    expect(find.text('No archived builds yet.'), findsOneWidget);
  });

  test('completion photo mime validation rejects unsupported types', () {
    expect(
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(fileExtension: 'gif'),
      isNull,
    );
    expect(
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(fileExtension: 'jpg'),
      'image/jpeg',
    );
    expect(
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(fileExtension: 'png'),
      'image/png',
    );
  });

  test('completion photo mime derives from jpg extension when browser mime empty', () {
    expect(
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(
        fileExtension: 'jpg',
        reportedMimeType: null,
      ),
      'image/jpeg',
    );
    expect(
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(
        fileExtension: 'jpg',
        reportedMimeType: 'application/octet-stream',
      ),
      'image/jpeg',
    );
  });

  test('completion photo mime rejects extension and mime contradiction', () {
    expect(
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(
        fileExtension: 'png',
        reportedMimeType: 'image/jpeg',
      ),
      isNull,
    );
  });

  test('completion photo upload never shows validation failed in Arabic', () {
    const error = ApiException(
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
    );
    final message = LearnerBuildsL10n.completionPhotoUploadErrorMessage(
      error,
      'ar',
    );
    expect(message, isNot(contains('Validation failed')));
    expect(message, LearnerBuildsL10n.uploadFailed.ar);
  });

  test('completion photo upload maps validation size errors', () {
    const error = ApiException(
      message: 'Image exceeds the maximum allowed size.',
      code: 'VALIDATION_ERROR',
    );
    expect(
      LearnerBuildsL10n.completionPhotoUploadErrorMessage(error, 'en'),
      LearnerBuildsL10n.uploadTooLarge.en,
    );
    expect(
      LearnerBuildsL10n.completionPhotoUploadErrorMessage(error, 'ar'),
      LearnerBuildsL10n.uploadTooLarge.ar,
    );
  });

  test('completion photo upload maps unsupported type errors', () {
    const error = ApiException(
      message: 'Only JPG, PNG, and WebP images are allowed.',
      code: 'VALIDATION_ERROR',
    );
    expect(
      LearnerBuildsL10n.completionPhotoUploadErrorMessage(error, 'en'),
      LearnerBuildsL10n.uploadUnsupportedType.en,
    );
  });

  test('uploadCompletionPhoto sends multipart bytes with photo field', () async {
    final adapter = _CompletionPhotoUploadAdapter();
    final dio = Dio()..httpClientAdapter = adapter;
    final api = LearnerBuildsApi(dio);
    const bytes = [0xFF, 0xD8, 0xFF, 0xD9];

    final photo = await api.uploadCompletionPhoto(
      'build-1',
      bytes: bytes,
      fileName: 'result.jpg',
      mimeType: 'image/jpeg',
    );

    expect(adapter.path, '/api/learner/builds/build-1/completion-story/photos');
    expect(adapter.formData, isNotNull);
    final multipart = adapter.formData!.files.single;
    expect(multipart.key, 'photo');
    expect(multipart.value.filename, 'result.jpg');
    expect(multipart.value.contentType?.mimeType, 'image/jpeg');
    expect(multipart.value.length, bytes.length);
    expect(
      adapter.options?.extra['skipAuthRefresh'],
      isTrue,
    );
    expect(photo.imageUrl, '/uploads/build-completion/photo-1.jpg');
  });

  test('completion photo upload error avoids generic something went wrong', () {
    const validationError = ApiException(
      message: 'Only JPG, PNG, and WebP images are allowed.',
      code: 'VALIDATION_ERROR',
    );
    final message = LearnerBuildsL10n.completionPhotoUploadErrorMessage(
      validationError,
      'en',
    );
    expect(message, isNot(contains('Something went wrong')));
    expect(message, LearnerBuildsL10n.uploadUnsupportedType.en);
  });
}

class _TestAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        email: 'learner@example.com',
        displayName: 'Learner',
        accountStatus: 'ACTIVE',
        activeRole: 'LEARNER',
        roles: const ['LEARNER'],
        createdAt: DateTime(2026),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}

class _ArchivedQueryNotifier extends LearnerBuildsQueryNotifier {
  @override
  LearnerBuildsQuery build() => const LearnerBuildsQuery(status: 'ARCHIVED');
}

class _CompletionPhotoUploadAdapter implements HttpClientAdapter {
  String? path;
  FormData? formData;
  RequestOptions? options;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    this.options = options;
    path = options.path;
    formData = options.data as FormData?;
    return ResponseBody.fromString(
      '{"success":true,"data":{"photo":{"id":"photo-1","imageUrl":"/uploads/build-completion/photo-1.jpg","sortOrder":0}}}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
