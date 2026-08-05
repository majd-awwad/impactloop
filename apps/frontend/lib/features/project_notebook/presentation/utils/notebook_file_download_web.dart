import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

void downloadNotebookPdfBytes({
  required List<int> bytes,
  required String filename,
}) {
  final blobParts = <web.BlobPart>[Uint8List.fromList(bytes).toJS].toJS;
  final blob = web.Blob(blobParts, web.BlobPropertyBag(type: 'application/pdf'));
  final url = web.URL.createObjectURL(blob);
  final anchor = web.HTMLAnchorElement()
    ..href = url
    ..download = filename
    ..style.display = 'none';
  web.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  web.URL.revokeObjectURL(url);
}
