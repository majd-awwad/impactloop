class UpdateSupplierProfileImagesRequest {
  const UpdateSupplierProfileImagesRequest({
    this.avatarImageUrl,
    this.coverImageUrl,
  });

  final String? avatarImageUrl;
  final String? coverImageUrl;

  Map<String, dynamic> toJson() {
    return {
      if (avatarImageUrl != null) 'avatarImageUrl': avatarImageUrl,
      if (coverImageUrl != null) 'coverImageUrl': coverImageUrl,
    };
  }
}
