import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/core/format/localized_formatters.dart';
import 'package:frontend/features/home/domain/learner_home_models.dart';
import 'package:frontend/features/home/presentation/learner_home_localization.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/learner_ui_labels.dart';
import 'package:frontend/shared/widgets/bidi_text.dart';

void main() {
  final ar = AppLocalizationsAr();
  final en = AppLocalizationsEn();

  test('Arabic formatting retains Western digits', () {
    final formatters = LocalizedFormatters(ar);

    expect(formatters.nis(1234.5, decimalDigits: 1), contains('شيكل'));
    expect(formatters.nis(1234.5, decimalDigits: 1), contains('1'));
    expect(formatters.nis(1234.5, decimalDigits: 1), isNot(matches('[٠-٩]')));
    expect(formatters.distanceKilometers(2.5), contains('2'));
    expect(formatters.distanceKilometers(2.5), contains('كم'));

    final date = formatters.dateTime(DateTime.utc(2026, 7, 31, 14, 30));
    expect(date, contains('2026'));
    expect(date, isNot(matches('[٠-٩]')));
  });

  test('status presenters never expose unknown raw identifiers', () {
    final labels = LearnerUiLabels(ar);

    expect(labels.deliveryStatus('FUTURE_DELIVERY_STATE'), ar.unknownStatus);
    expect(
      labels.reservationStatus('FUTURE_RESERVATION_STATE'),
      ar.unknownStatus,
    );
    expect(labels.deliveryStatus('ON_THE_WAY'), ar.statusOnTheWay);
  });

  test('localized field issues do not expose backend prose', () {
    const error = ApiException(
      message: 'title must be longer than 3 characters',
      code: 'VALIDATION_ERROR',
      details: {
        'issues': [
          {'path': 'title', 'message': 'title must be longer than 3 characters'},
        ],
      },
    );

    expect(
      localizedFieldIssueMessage(error.fieldIssues.first, ar),
      ar.projectSubmissionTitleRequired,
    );
    expect(
      localizedFieldIssueMessage(error.fieldIssues.first, en),
      en.projectSubmissionTitleRequired,
    );
    expect(
      localizedFieldIssueMessage(error.fieldIssues.first, ar),
      isNot(contains('characters')),
    );
  });

  test('localized API errors do not expose backend prose', () {
    const error = ApiException(
      message: 'Internal database detail that must not be shown',
      code: 'CONFLICT',
      statusCode: 409,
    );

    expect(localizedApiErrorMessage(error, ar), ar.conflictError);
    expect(localizedApiErrorMessage(error, en), en.conflictError);
    expect(localizedApiErrorMessage(error, ar), isNot(contains('database')));
  });

  test(
    'Arabic notifications use metadata templates and safe legacy fallback',
    () {
      final known = AppNotification(
        id: 'notification-1',
        notificationType: 'RESERVATION_ACCEPTED',
        title: 'Reservation accepted',
        body: 'English legacy body',
        isRead: false,
        createdAt: DateTime.utc(2026),
        metadata: const {'materialTitle': 'Arduino Uno'},
      );
      final unknown = AppNotification(
        id: 'notification-2',
        notificationType: 'LEGACY_UNKNOWN_EVENT',
        title: 'Legacy English title',
        body: 'Legacy English body',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      final knownCopy = localizedNotificationCopy(known, ar);
      final unknownCopy = localizedNotificationCopy(unknown, ar);
      expect(knownCopy.title, ar.reservationAcceptedTitle);
      expect(knownCopy.body, contains('Arduino Uno'));
      expect(unknownCopy.title, ar.notificationFallbackTitle);
      expect(unknownCopy.body, ar.notificationFallbackBody);
    },
  );

  test('Home section and recommendation reason codes localize in Arabic', () {
    final copy = learnerHomeSectionCopy(
      LearnerHomeSectionKey.suggestedMaterials,
      ar,
    );
    const item = LearnerHomeContinueProjectRecommendation(
      score: 10,
      reasons: ['Matches your Robotics interest'],
      reasonDetails: [
        LearnerHomeRecommendationReason(
          code: 'MATCHES_INTEREST',
          params: {'interest': 'الروبوتات'},
        ),
      ],
      projectId: 'project-1',
      projectTitle: 'Robot',
      shortDescription: '',
      coverImageUrl: null,
      progressPercent: 0,
      readyCount: 0,
      totalCount: 0,
    );

    expect(copy.title, ar.sectionSuggestedMaterialsTitle);
    expect(localizedLearnerHomeReason(item, ar), contains('الروبوتات'));
  });

  test('content direction isolates technical and Arabic values', () {
    expect(contentTextDirection('learner@example.com'), TextDirection.ltr);
    expect(contentTextDirection('+970 59 123 4567'), TextDirection.ltr);
    expect(contentTextDirection('+970568860223'), TextDirection.ltr);
    expect(contentTextDirection('عنوان التوصيل'), TextDirection.rtl);
  });
}
