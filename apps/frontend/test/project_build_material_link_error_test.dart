import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_project_build_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/project_build_material_link_error_message.dart';
import 'package:frontend/l10n/app_localizations.dart';

const _insufficientQuantityError = ApiException(
  message: 'Insufficient quantity to link this material.',
  code: 'INSUFFICIENT_QUANTITY',
  statusCode: 400,
  details: {
    'messageEn': '2 available, 4 required',
    'messageAr': 'المتوفر 2، المطلوب 4',
    'availableQuantity': 2,
    'requiredQuantity': 4,
  },
);

void main() {
  group('projectBuildMaterialLinkErrorMessage', () {
    test('maps INSUFFICIENT_QUANTITY to localized English message', () {
      expect(
        projectBuildMaterialLinkErrorMessage(
          _insufficientQuantityError,
          languageCode: 'en',
        ),
        'Insufficient quantity\n2 available, 4 required',
      );
    });

    test('renders English available and required quantities', () {
      expect(
        formatInsufficientQuantityLinkError(
          _insufficientQuantityError,
          languageCode: 'en',
        ),
        'Insufficient quantity\n2 available, 4 required',
      );
      expect(
        formatInsufficientQuantityLinkError(
          _insufficientQuantityError,
          languageCode: 'en',
        ),
        contains(LearningProjectBuildL10n.insufficientQuantity.en),
      );
    });

    test('renders Arabic available and required quantities', () {
      expect(
        formatInsufficientQuantityLinkError(
          _insufficientQuantityError,
          languageCode: 'ar',
        ),
        'الكمية غير كافية\nالمتوفر 2، المطلوب 4',
      );
      expect(
        formatInsufficientQuantityLinkError(
          _insufficientQuantityError,
          languageCode: 'ar',
        ),
        contains(LearningProjectBuildL10n.insufficientQuantity.ar),
      );
    });

    test('maps INCOMPATIBLE_UNIT to localized Arabic message', () {
      const error = ApiException(
        message:
            'Material unit is not compatible with the required component unit.',
        code: 'INCOMPATIBLE_UNIT',
        statusCode: 400,
      );

      expect(
        projectBuildMaterialLinkErrorMessage(error, languageCode: 'ar'),
        'الوحدة غير متوافقة\nهذه المادة لا تستخدم وحدة القياس المطلوبة لهذا المكوّن.',
      );
      expect(
        projectBuildMaterialLinkErrorMessage(error, languageCode: 'en'),
        contains(LearningProjectBuildL10n.incompatibleUnitTitle.en),
      );
    });

    test('keeps existing handling for other domain errors', () {
      const ownMaterialError = ApiException(
        message:
            'You cannot link your own material listing to a build checklist item',
        code: 'OWN_MATERIAL',
        statusCode: 400,
      );

      expect(
        projectBuildMaterialLinkErrorMessage(
          ownMaterialError,
          languageCode: 'en',
          l10n: lookupAppLocalizations(const Locale('en')),
        ),
        ownMaterialError.message,
      );

      const unavailableError = ApiException(
        message: 'Material is not available for linking',
        code: 'MATERIAL_NOT_AVAILABLE',
        statusCode: 400,
      );

      expect(
        projectBuildMaterialLinkErrorMessage(
          unavailableError,
          languageCode: 'en',
          l10n: lookupAppLocalizations(const Locale('en')),
        ),
        unavailableError.message,
      );
    });
  });
}
