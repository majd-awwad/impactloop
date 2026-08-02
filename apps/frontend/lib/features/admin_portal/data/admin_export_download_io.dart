void downloadAdminExportBytes({
  required List<int> bytes,
  required String filename,
  required String mimeType,
}) {
  throw UnsupportedError(
    'Admin export download is currently supported on web only.',
  );
}
