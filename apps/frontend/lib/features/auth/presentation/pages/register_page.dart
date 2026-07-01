import 'package:flutter/material.dart';

import '../models/registration_intent.dart';
import '../views/unified_register_views.dart';

class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key, this.initialIntent});

  final RegistrationIntent? initialIntent;

  @override
  Widget build(BuildContext context) {
    return UnifiedRegisterView(initialIntent: initialIntent);
  }
}
