import 'package:flutter/material.dart';

/// Border radius tokens for ImpactLoop.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 10;
  static const double lg = 14;
  static const double xl = 20;
  static const double pill = 999;

  static BorderRadius get smAll => BorderRadius.circular(sm);
  static BorderRadius get mdAll => BorderRadius.circular(md);
  static BorderRadius get lgAll => BorderRadius.circular(lg);
  static BorderRadius get xlAll => BorderRadius.circular(xl);
  static BorderRadius get pillAll => BorderRadius.circular(pill);
}
