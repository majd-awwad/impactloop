import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/supplier_reservation_history_notes.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

void main() {
  final en = AppLocalizationsEn();
  final ar = AppLocalizationsAr();

  test('localizes coded system history events', () {
    const entry = SupplierReservationHistoryEntry(
      eventCode: 'PICKUP_COMPLETED_BY_SUPPLIER',
      note: 'event:PICKUP_COMPLETED_BY_SUPPLIER',
    );

    expect(
      supplierReservationHistoryNoteLabel(en, entry),
      en.supplierHistoryEventPickupCompletedBySupplier,
    );
    expect(
      supplierReservationHistoryNoteLabel(ar, entry),
      ar.supplierHistoryEventPickupCompletedBySupplier,
    );
  });

  test('maps legacy English notes for Arabic locale', () {
    const entry = SupplierReservationHistoryEntry(
      note: 'Pickup completed by supplier',
    );

    expect(
      supplierReservationHistoryNoteLabel(ar, entry),
      ar.supplierHistoryEventPickupCompletedBySupplier,
    );
  });

  test('preserves user-authored decline reasons', () {
    const entry = SupplierReservationHistoryEntry(
      eventCode: 'DECLINED_BY_SUPPLIER',
      reasonText: 'Out of stock',
      note: 'event:DECLINED_BY_SUPPLIER|Out of stock',
    );

    expect(supplierReservationHistoryNoteLabel(en, entry), 'Out of stock');
    expect(supplierReservationHistoryNoteLabel(ar, entry), 'Out of stock');
  });
}
