import 'package:flutter/material.dart';

import '../../domain/models/learning_project.dart';

List<Color> projectGradient(LearningProject project) {
  return project.cardGradient.map(Color.new).toList();
}
