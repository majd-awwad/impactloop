import 'package:flutter/material.dart';

import '../views/forgot_password_view.dart';

class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key, this.initialEmail});

  final String? initialEmail;

  @override
  Widget build(BuildContext context) {
    return ForgotPasswordView(initialEmail: initialEmail);
  }
}
