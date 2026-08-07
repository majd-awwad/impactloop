import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/learner_reservation.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailNotesCard extends StatelessWidget {
  const ReservationDetailNotesCard({
    super.key,
    required this.reservation,
  });

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final notes = <String>[];

    if (reservation.isPickupFulfillment && reservation.isAccepted) {
      notes.addAll([
        l10n.reservationDetailNotesPickupSafety,
        l10n.reservationDetailNotesPickupContact,
      ]);
    }

    final supplierNote = reservation.supplierNote?.trim();
    if (supplierNote != null && supplierNote.isNotEmpty) {
      notes.add(supplierNote);
    }

    final learnerMessage = reservation.message?.trim();
    if (learnerMessage != null && learnerMessage.isNotEmpty) {
      notes.add(learnerMessage);
    }

    if (notes.isEmpty) {
      return const SizedBox.shrink();
    }

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.neutral,
      title: reservation.isPickupFulfillment && reservation.isAccepted
          ? l10n.reservationDetailNotesPickupTitle
          : l10n.importantNotes,
      titleIcon: Icons.sticky_note_2_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final note in notes) ...[
            Text(
              '• $note',
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
            if (note != notes.last) const SizedBox(height: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}
