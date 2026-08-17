import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/core/network/api_client.dart';
import 'package:frontend/features/learner_builds/application/completion_image_picker_provider.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/completion_image_picker.dart';
import 'package:frontend/features/learner_builds/data/learner_builds_api.dart';
import 'package:frontend/features/learner_builds/presentation/l10n/learner_builds_l10n.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_completion_story_section.dart';
import 'package:frontend/shared/widgets/protected_media_image.dart';

final _jpegBytes = Uint8List.fromList(const [0xFF, 0xD8, 0xFF, 0xD9]);
final _pngBytes = Uint8List.fromList(const [
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

void main() {
  test('web-style in-memory bytes become a jpeg upload input', () async {
    final file = PlatformFile(
      name: 'result.jpg',
      size: _jpegBytes.length,
      bytes: _jpegBytes,
    );

    final result = await selectedCompletionImageFromPlatformFile(file);

    expect(result.isCancelled, isFalse);
    expect(result.error, isNull);
    expect(result.image?.mimeType, 'image/jpeg');
    expect(result.image?.fileName, 'result.jpg');
    expect(result.image?.bytes, _jpegBytes);
  });

  test('Android path-only files are read without requiring inline bytes', () async {
    final temp = File(
      '${Directory.systemTemp.path}/completion-android-photo.jpg',
    );
    await temp.writeAsBytes(_jpegBytes);
    addTearDown(() {
      if (temp.existsSync()) {
        temp.deleteSync();
      }
    });

    final file = PlatformFile(
      path: temp.path,
      name: '1000001234',
      size: _jpegBytes.length,
    );
    expect(file.bytes, isNull);

    final result = await selectedCompletionImageFromPlatformFile(file);

    expect(result.error, isNull);
    expect(result.image?.mimeType, 'image/jpeg');
    expect(result.image?.fileName, 'result-photo.jpg');
    expect(result.image?.bytes, isNotEmpty);
  });

  test('cancel result does not produce an upload input', () {
    const result = CompletionImagePickResult.cancelled();
    expect(result.isCancelled, isTrue);
    expect(result.image, isNull);
    expect(result.error, isNull);
  });

  test('sniffed bytes reject unsupported formats', () {
    final result = selectedCompletionImageFromBytes(
      bytes: Uint8List.fromList(const [0x47, 0x49, 0x46]),
      originalName: 'result.gif',
      fileExtension: 'gif',
    );
    expect(result.error, CompletionImagePickError.unsupportedType);
  });

  testWidgets('selecting an image uploads multipart bytes and shows the photo', (
    tester,
  ) async {
    final api = _RecordingBuildsApi();
    var pickerCalls = 0;
    var refreshed = 0;

    await tester.pumpWidget(
      _harness(
        api: api,
        picker: () async {
            pickerCalls += 1;
            return CompletionImagePickResult.selected(
              SelectedCompletionImage(
                bytes: _pngBytes,
                fileName: 'result.png',
                mimeType: 'image/png',
              ),
            );
          },
        child: ProjectBuildCompletionStorySection(
          build: _completedBuild(),
          embedded: true,
          onUpdated: () => refreshed += 1,
        ),
      ),
    );

    await tester.tap(find.text('إضافة صورة للنتيجة'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(pickerCalls, 1);
    expect(api.uploadCalls, 1);
    expect(api.lastFileName, 'result.png');
    expect(api.lastMimeType, 'image/png');
    expect(api.lastBytes, _pngBytes);
    expect(refreshed, 1);
    expect(find.byType(ProtectedMediaImage), findsOneWidget);
    expect(find.text('تم رفع الصورة'), findsOneWidget);
  });

  testWidgets('picker cancel does not call upload or show an error', (
    tester,
  ) async {
    final api = _RecordingBuildsApi();

    await tester.pumpWidget(
      _harness(
        api: api,
        picker: () async => const CompletionImagePickResult.cancelled(),
        child: ProjectBuildCompletionStorySection(
          build: _completedBuild(),
          embedded: true,
          onUpdated: () {},
        ),
      ),
    );

    await tester.tap(find.text('إضافة صورة للنتيجة'));
    await tester.pump();

    expect(api.uploadCalls, 0);
    expect(find.text('تعذر رفع الصورة. حاول مرة أخرى.'), findsNothing);
    expect(find.text('اختر صورة صالحة لرفعها.'), findsNothing);
  });

  testWidgets('failed upload shows localized Arabic copy', (tester) async {
    final api = _RecordingBuildsApi()
      ..uploadError = const ApiException(
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
      );

    await tester.pumpWidget(
      _harness(
        api: api,
        picker: () async => CompletionImagePickResult.selected(
              SelectedCompletionImage(
                bytes: _pngBytes,
                fileName: 'result.png',
                mimeType: 'image/png',
              ),
            ),
        child: ProjectBuildCompletionStorySection(
          build: _completedBuild(),
          embedded: true,
          onUpdated: () {},
        ),
      ),
    );

    await tester.tap(find.text('إضافة صورة للنتيجة'));
    await tester.pump();
    await tester.pump();

    expect(find.text('تعذر رفع الصورة. حاول مرة أخرى.'), findsOneWidget);
    expect(find.text('Validation failed'), findsNothing);
  });

  testWidgets('double tap cannot start two uploads', (tester) async {
    final api = _RecordingBuildsApi();
    final pickerStarted = Completer<void>();
    final releasePicker = Completer<CompletionImagePickResult>();
    var pickerCalls = 0;

    await tester.pumpWidget(
      _harness(
        api: api,
        picker: () async {
            pickerCalls += 1;
            pickerStarted.complete();
            return releasePicker.future;
          },
        child: ProjectBuildCompletionStorySection(
          build: _completedBuild(),
          embedded: true,
          onUpdated: () {},
        ),
      ),
    );

    await tester.tap(find.byType(OutlinedButton));
    await tester.pump();
    await pickerStarted.future;
    await tester.tap(find.byType(OutlinedButton));
    await tester.pump();

    expect(pickerCalls, 1);

    releasePicker.complete(
      CompletionImagePickResult.selected(
        SelectedCompletionImage(
          bytes: _pngBytes,
          fileName: 'result.png',
          mimeType: 'image/png',
        ),
      ),
    );
    await tester.pump();
    await tester.pumpAndSettle();

    expect(api.uploadCalls, 1);
  });

  test('localized failure never leaks backend English', () {
    const error = ApiException(
      message: 'Image exceeds the maximum allowed size.',
      code: 'VALIDATION_ERROR',
    );
    expect(
      LearnerBuildsL10n.completionPhotoUploadErrorMessage(error, 'ar'),
      LearnerBuildsL10n.uploadTooLarge.ar,
    );
    expect(
      LearnerBuildsL10n.completionPhotoUploadErrorMessage(
        const ApiException(message: 'disk C:\\tmp\\photo.jpg', code: 'X'),
        'ar',
      ),
      LearnerBuildsL10n.uploadFailed.ar,
    );
  });
}

Widget _harness({
  required Widget child,
  required LearnerBuildsApi api,
  required CompletionImagePicker picker,
}) {
  return ProviderScope(
    overrides: [
      apiClientProvider.overrideWithValue(
        Dio()..httpClientAdapter = _ImmediateImageAdapter(),
      ),
      learnerBuildsApiProvider.overrideWithValue(api),
      completionImagePickerProvider.overrideWithValue(picker),
    ],
    child: MaterialApp(
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
}

ProjectBuild _completedBuild({
  List<ProjectBuildCompletionStoryPhoto> photos = const [],
}) {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.completed,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: const ProjectBuildProgress(total: 2, ready: 2, percent: 100),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 2,
      linked: 2,
      reserved: 0,
      missing: 0,
      total: 2,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 2,
      total: 2,
      percent: 100,
      steps: [],
    ),
    items: const [],
    completionStory: ProjectBuildCompletionStory(photos: photos),
  );
}

class _ImmediateImageAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromBytes(
      _pngBytes,
      200,
      headers: {
        Headers.contentTypeHeader: ['image/png'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _RecordingBuildsApi extends LearnerBuildsApi {
  _RecordingBuildsApi() : super(Dio());

  int uploadCalls = 0;
  List<int>? lastBytes;
  String? lastFileName;
  String? lastMimeType;
  ApiException? uploadError;

  @override
  Future<ProjectBuildCompletionStoryPhoto> uploadCompletionPhoto(
    String buildId, {
    required List<int> bytes,
    required String fileName,
    required String mimeType,
    String? caption,
  }) async {
    uploadCalls += 1;
    lastBytes = bytes;
    lastFileName = fileName;
    lastMimeType = mimeType;
    final error = uploadError;
    if (error != null) {
      throw error;
    }
    return ProjectBuildCompletionStoryPhoto(
      id: 'photo-1',
      imageUrl:
          '/api/learner/builds/$buildId/completion-story/photos/photo-1/content',
      sortOrder: 0,
    );
  }
}
