import '../../auth/data/models/user.dart';
import 'models/learner_profile_summary.dart';
import 'models/uploaded_profile_image.dart';
import 'profile_api.dart';

class ProfileRepository {
  const ProfileRepository({required ProfileApi api}) : _api = api;

  final ProfileApi _api;

  Future<LearnerProfileSummary> fetchLearnerProfileSummary() {
    return _api.fetchLearnerProfileSummary();
  }

  Future<User> updateProfile({
    String? displayName,
    String? phone,
    String? profileImageUrl,
    bool updatePhone = false,
    bool updateProfileImage = false,
  }) {
    return _api.updateProfile(
      displayName: displayName,
      phone: phone,
      profileImageUrl: profileImageUrl,
      updatePhone: updatePhone,
      updateProfileImage: updateProfileImage,
    );
  }

  Future<User> updateLearnerProfile({
    required String learnerType,
    required String skillLevel,
    required List<String> interests,
    String? bio,
  }) {
    return _api.updateLearnerProfile(
      learnerType: learnerType,
      skillLevel: skillLevel,
      interests: interests,
      bio: bio,
    );
  }

  Future<UploadedProfileImage> uploadProfileImage(PendingProfileImage image) {
    return _api.uploadProfileImage(image);
  }
}
