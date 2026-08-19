import '../../../shared/handover/handover_qr_payload.dart';

/// Lightweight local format check for ImpactLoop pickup QR payloads.
///
/// Cryptographic validation remains on the backend.
bool looksLikeImpactLoopPickupQr(String raw) {
  return looksLikeHandoverQr(
    raw: raw,
    type: HandoverQrType.reservationPickup,
  );
}
