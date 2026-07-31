import 'package:file_picker/file_picker.dart';

import '../../../core/errors/api_exception.dart';
import '../../profile/data/models/uploaded_profile_image.dart';
import '../../profile/data/profile_repository.dart';
import 'models/update_supplier_profile_images_request.dart';
import 'supplier_profile_repository.dart';

const _allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const _maxBytes = 5 * 1024 * 1024;

enum SupplierProfileImageKind { avatar, cover }

class SupplierProfileImageHelper {
  const SupplierProfileImageHelper(
    this._profileRepository,
    this._accountProfileRepository,
  );

  final SupplierProfileRepository _profileRepository;
  final ProfileRepository _accountProfileRepository;

  Future<void> pickUploadAndSave(SupplierProfileImageKind kind) async {
    final picked = await _pickSingleImage();
    if (picked == null) {
      return;
    }

    final uploaded = await _accountProfileRepository.uploadProfileImage(picked);
    if (uploaded.url.trim().isEmpty) {
      throw const ApiException(message: 'Image upload failed');
    }

    final url = uploaded.url;
    final request = switch (kind) {
      SupplierProfileImageKind.avatar => UpdateSupplierProfileImagesRequest(
        avatarImageUrl: url,
      ),
      SupplierProfileImageKind.cover => UpdateSupplierProfileImagesRequest(
        coverImageUrl: url,
      ),
    };

    await _profileRepository.updateProfileImages(request);
  }

  Future<PendingProfileImage?> _pickSingleImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedExtensions,
      allowMultiple: false,
      withData: true,
    );

    if (result == null || result.files.isEmpty) {
      return null;
    }

    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null || bytes.isEmpty) {
      throw const ApiException(message: 'Could not read the selected image.');
    }
    if (bytes.length > _maxBytes) {
      throw const ApiException(message: 'Image must be 5 MB or smaller.');
    }

    final fileName = file.name.trim().isNotEmpty ? file.name : 'profile.jpg';
    return PendingProfileImage(
      bytes: bytes,
      fileName: fileName,
      mimeType: _mimeFromFileName(fileName),
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
