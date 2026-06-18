import 'dart:typed_data';

class MaterialDraftImage {
  const MaterialDraftImage.pending({
    required Uint8List bytes,
    required this.fileName,
    required this.mimeType,
  })  : bytes = bytes,
        url = null,
        sizeBytes = bytes.length;

  const MaterialDraftImage.uploaded({
    required this.url,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
  }) : bytes = null;

  final Uint8List? bytes;
  final String? url;
  final String fileName;
  final String mimeType;
  final int sizeBytes;

  bool get isPending => bytes != null;
  bool get isUploaded => url != null;

  factory MaterialDraftImage.fromUrl(String url) {
    final fileName = url.split('/').last;
    return MaterialDraftImage.uploaded(
      url: url,
      fileName: fileName,
      mimeType: _mimeFromFileName(fileName),
      sizeBytes: 0,
    );
  }

  static String _mimeFromFileName(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp';
    }
    return 'image/jpeg';
  }
}

class UploadedMaterialImage {
  const UploadedMaterialImage({
    required this.url,
    required this.filename,
    required this.mimeType,
    required this.sizeBytes,
  });

  final String url;
  final String filename;
  final String mimeType;
  final int sizeBytes;

  factory UploadedMaterialImage.fromJson(Map<String, dynamic> json) {
    return UploadedMaterialImage(
      url: json['url'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? 'image/jpeg',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
    );
  }
}
