import 'package:flutter/material.dart';

import '../views/reset_password_view.dart';

class ResetPasswordPage extends StatelessWidget {
  const ResetPasswordPage({super.key, required this.token});

  final String? token;

  @override
  Widget build(BuildContext context) {
    return ResetPasswordView(token: token);
  }
}
