import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/completion_image_picker.dart';

final completionImagePickerProvider = Provider<CompletionImagePicker>((ref) {
  return pickCompletionImage;
});
