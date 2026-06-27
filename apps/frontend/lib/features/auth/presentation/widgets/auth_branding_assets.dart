/// Auth side-panel image paths.
///
/// Add your images under [apps/frontend/assets/images/auth/] using these
/// exact filenames, then run `flutter pub get` and hot restart:
///
/// - [loginImage] — shown on `/login` (wide layout)
/// - [registerImage] — shown on `/register` (wide layout)
///
/// Recommended size: at least 1200×800 px, landscape, rounded-crop friendly.
abstract final class AuthBrandingAssets {
  static const loginImage = 'assets/images/auth/auth_login.png';
  static const registerImage = 'assets/images/auth/auth_register.png';

  /// Used when a custom panel image is not found yet.
  static const fallbackImage = 'assets/images/landing/hero_workshop.png';
}
