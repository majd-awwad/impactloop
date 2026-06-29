import 'package:web/web.dart' as web;

void openExternalDocumentUrl(String url) {
  web.window.open(url, '_blank');
}
