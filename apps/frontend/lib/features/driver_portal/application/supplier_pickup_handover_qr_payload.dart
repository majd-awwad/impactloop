import '../../../shared/handover/handover_qr_payload.dart';

/// Lightweight local format check for ImpactLoop supplier pickup handover QR payloads.
bool looksLikeImpactLoopSupplierPickupHandoverQr(String raw) {
  return looksLikeHandoverQr(
    raw: raw,
    type: HandoverQrType.supplierDriverPickup,
  );
}
