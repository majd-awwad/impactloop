import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_incoming_request.dart';

class IncomingRequestStatusStyle {
  const IncomingRequestStatusStyle._(this.tone);

  final AppStatusTone tone;

  AppStatusStyle resolve(BuildContext context) =>
      AppStatusStyle.of(context, tone);

  static IncomingRequestStatusStyle forStatus(
    SupplierIncomingRequestStatus status,
  ) {
    return switch (status) {
      SupplierIncomingRequestStatus.pending => _pending,
      SupplierIncomingRequestStatus.accepted => _accepted,
      SupplierIncomingRequestStatus.awaitingConfirmation => _accepted,
      SupplierIncomingRequestStatus.awaitingSupplierConfirmation => _accepted,
      SupplierIncomingRequestStatus.declined => _declined,
      SupplierIncomingRequestStatus.expired => _expired,
      SupplierIncomingRequestStatus.completed => _completed,
      SupplierIncomingRequestStatus.cancelled => _declined,
      SupplierIncomingRequestStatus.noShow => _declined,
      SupplierIncomingRequestStatus.fulfillmentFailed => _declined,
      SupplierIncomingRequestStatus.needsResolution => _pending,
    };
  }

  static IncomingRequestStatusStyle forTab(SupplierIncomingRequestTab tab) {
    return switch (tab) {
      SupplierIncomingRequestTab.all => _all,
      SupplierIncomingRequestTab.pending => _pending,
      SupplierIncomingRequestTab.needsLearner => _pending,
      SupplierIncomingRequestTab.accepted => _accepted,
      SupplierIncomingRequestTab.declined => _declined,
      SupplierIncomingRequestTab.completed => _completed,
      SupplierIncomingRequestTab.cancelled => _declined,
    };
  }

  static const _all = IncomingRequestStatusStyle._(AppStatusTone.neutral);
  static const _pending = IncomingRequestStatusStyle._(AppStatusTone.warning);
  static const _accepted = IncomingRequestStatusStyle._(AppStatusTone.success);
  static const _declined = IncomingRequestStatusStyle._(AppStatusTone.danger);
  static const _completed = IncomingRequestStatusStyle._(AppStatusTone.success);
  static const _expired = IncomingRequestStatusStyle._(AppStatusTone.danger);
}
