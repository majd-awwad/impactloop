import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../data/models/driver_delivery.dart';

class DriverLearnerContactCard extends StatelessWidget {
  const DriverLearnerContactCard({super.key, required this.learner});

  final DriverDeliveryParty? learner;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final phone = learner?.phone?.trim() ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.learnerContact,
          style: AppTextStyles.title(context).copyWith(fontSize: 16),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(learner?.displayName ?? l10n.driverLearnerUnavailable),
        const SizedBox(height: AppSpacing.xs),
        phone.isEmpty
            ? Text(l10n.noPhoneAvailable)
            : LtrPhoneText(phone, selectable: true),
        if (phone.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: () async {
              try {
                await launchUrl(Uri(scheme: 'tel', path: phone));
              } catch (_) {
                // The readable/selectable phone remains available on web.
              }
            },
            icon: const Icon(Icons.phone_outlined),
            label: Text(l10n.call),
          ),
        ],
      ],
    );
  }
}
