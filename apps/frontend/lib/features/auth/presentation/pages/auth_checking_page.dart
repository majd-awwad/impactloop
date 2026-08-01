import 'package:flutter/material.dart';

class AuthCheckingPage extends StatelessWidget {
  const AuthCheckingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(),
        ),
      ),
    );
  }
}
