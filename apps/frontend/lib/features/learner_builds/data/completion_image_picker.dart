import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';

import '../presentation/l10n/learner_builds_l10n.dart';

class SelectedCompletionImage {
  const SelectedCompletionImage({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String mimeType;
}

enum CompletionImagePickError { invalidFile, unsupportedType, tooLarge }

class CompletionImagePickResult {
  const CompletionImagePickResult.cancelled() : image = null, error = null;

  const CompletionImagePickResult.selected(this.image) : error = null;

  const CompletionImagePickResult.rejected(this.error) : image = null;

  final SelectedCompletionImage? image;
  final CompletionImagePickError? error;

  bool get isCancelled => image == null && error == null;
}

typedef CompletionImagePicker = Future<CompletionImagePickResult> Function();

/// Reads image bytes from [file_picker] without assuming a durable filesystem
/// path. Uses in-memory bytes when present (Web), otherwise the plugin [XFile].
Future<Uint8List?> readPlatformFileBytes(PlatformFile file) async {
  final inline = file.bytes;
  if (inline != null && inline.isNotEmpty) {
    return inline;
  }

  try {
    final fromXFile = await file.xFile.readAsBytes();
    if (fromXFile.isNotEmpty) {
      return fromXFile is Uint8List
          ? fromXFile
          : Uint8List.fromList(fromXFile);
    }
  } catch (_) {
    return null;
  }

  return null;
}

String? sniffCompletionImageMime(List<int> bytes) {
  if (bytes.length >= 3 &&
      bytes[0] == 0xFF &&
      bytes[1] == 0xD8 &&
      bytes[2] == 0xFF) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4E &&
      bytes[3] == 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x45 &&
      bytes[10] == 0x42 &&
      bytes[11] == 0x50) {
    return 'image/webp';
  }
  return null;
}

String completionPhotoFileName({
  required String originalName,
  required String mimeType,
}) {
  final trimmed = originalName.trim();
  final hasKnownExtension = LearnerBuildsL10n.mimeTypeForCompletionPhoto(
        fileExtension: trimmed.contains('.') ? trimmed.split('.').last : null,
      ) !=
      null;
  if (trimmed.isNotEmpty && hasKnownExtension) {
    return trimmed;
  }

  final extension = switch (mimeType) {
    'image/png' => 'png',
    'image/webp' => 'webp',
    _ => 'jpg',
  };
  return 'result-photo.$extension';
}

CompletionImagePickResult selectedCompletionImageFromBytes({
  required Uint8List bytes,
  required String originalName,
  String? fileExtension,
  String? reportedMimeType,
}) {
  if (bytes.isEmpty) {
    return const CompletionImagePickResult.rejected(
      CompletionImagePickError.invalidFile,
    );
  }

  if (bytes.length > LearnerBuildsL10n.completionPhotoMaxBytes) {
    return const CompletionImagePickResult.rejected(
      CompletionImagePickError.tooLarge,
    );
  }

  final sniffed = sniffCompletionImageMime(bytes);
  final mimeType =
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(
        fileExtension: fileExtension,
        reportedMimeType: reportedMimeType,
      ) ??
      LearnerBuildsL10n.mimeTypeForCompletionPhoto(
        fileExtension: null,
        reportedMimeType: sniffed,
      );

  if (mimeType == null) {
    return const CompletionImagePickResult.rejected(
      CompletionImagePickError.unsupportedType,
    );
  }

  return CompletionImagePickResult.selected(
    SelectedCompletionImage(
      bytes: bytes,
      fileName: completionPhotoFileName(
        originalName: originalName,
        mimeType: mimeType,
      ),
      mimeType: mimeType,
    ),
  );
}

Future<CompletionImagePickResult> selectedCompletionImageFromPlatformFile(
  PlatformFile file,
) async {
  final bytes = await readPlatformFileBytes(file);
  if (bytes == null || bytes.isEmpty) {
    return const CompletionImagePickResult.rejected(
      CompletionImagePickError.invalidFile,
    );
  }

  return selectedCompletionImageFromBytes(
    bytes: bytes,
    originalName: file.name,
    fileExtension: file.extension,
  );
}

Future<CompletionImagePickResult> pickCompletionImage() async {
  final result = await FilePicker.platform.pickFiles(
    type: FileType.image,
    withData: true,
    allowMultiple: false,
  );

  if (result == null || result.files.isEmpty) {
    return const CompletionImagePickResult.cancelled();
  }

  return selectedCompletionImageFromPlatformFile(result.files.single);
}
