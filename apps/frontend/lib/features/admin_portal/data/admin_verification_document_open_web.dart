import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

void openAdminVerificationDocumentBytes({
  required List<int> bytes,
  required String mimeType,
  required String filename,
}) {
  final data = Uint8List.fromList(bytes);
  final blob = web.Blob(
    <web.BlobPart>[data.toJS].toJS,
    web.BlobPropertyBag(type: mimeType),
  );
  final url = web.URL.createObjectURL(blob);
  web.window.open(url, '_blank');
  // Keep the blob URL alive long enough for the new tab to load.
  unawaited(
    Future<void>.delayed(const Duration(minutes: 2), () {
      web.URL.revokeObjectURL(url);
    }),
  );
}
