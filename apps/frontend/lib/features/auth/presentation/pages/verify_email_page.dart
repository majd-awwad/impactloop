import 'package:flutter/material.dart';

import '../views/verify_email_view.dart';

class VerifyEmailPage extends StatelessWidget {
  const VerifyEmailPage({super.key, required this.token});

  final String? token;

  @override
  Widget build(BuildContext context) {
    return VerifyEmailView(token: token);
  }
}
