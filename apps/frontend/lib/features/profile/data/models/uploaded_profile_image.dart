class UploadedProfileImage {
  const UploadedProfileImage({
    required this.url,
    required this.filename,
    required this.mimeType,
    required this.sizeBytes,
  });

  final String url;
  final String filename;
  final String mimeType;
  final int sizeBytes;

  factory UploadedProfileImage.fromJson(Map<String, dynamic> json) {
    return UploadedProfileImage(
      url: json['url'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? '',
      sizeBytes: json['sizeBytes'] as int? ?? 0,
    );
  }
}

class PendingProfileImage {
  const PendingProfileImage({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final List<int> bytes;
  final String fileName;
  final String mimeType;
}
