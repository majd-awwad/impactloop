import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/api_config.dart';

Future<bool> launchProjectHelpSessionZoomUrl(String joinUrl) async {
  final uri = Uri.tryParse(joinUrl);
  if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
    return false;
  }
  if (kIsWeb) {
    ApiConfig.openExternalDocument(uri.toString());
    return true;
  }
  if (await canLaunchUrl(uri)) {
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
  return false;
}

Future<bool> launchProjectHelpSessionZoomStartUrl(String startUrl) =>
    launchProjectHelpSessionZoomUrl(startUrl);
