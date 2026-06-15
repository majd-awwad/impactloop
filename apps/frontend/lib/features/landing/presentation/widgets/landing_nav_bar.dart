import 'package:flutter/material.dart';

import '../../../../app/widgets/entry_nav_bar.dart';

class LandingNavBar extends StatelessWidget {
  const LandingNavBar({
    super.key,
    required this.onSignIn,
    required this.onCreateAccount,
  });

  final VoidCallback onSignIn;
  final VoidCallback onCreateAccount;

  @override
  Widget build(BuildContext context) {
    return EntryNavBar(
      onSignIn: onSignIn,
      onCreateAccount: onCreateAccount,
    );
  }
}
