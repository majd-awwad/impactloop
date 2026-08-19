import '../../../shared/handover/handover_qr_payload.dart';

/// Lightweight local format check for ImpactLoop delivery handover QR payloads.
bool looksLikeImpactLoopDeliveryHandoverQr(String raw) {
  return looksLikeHandoverQr(
    raw: raw,
    type: HandoverQrType.deliveryHandover,
  );
}
