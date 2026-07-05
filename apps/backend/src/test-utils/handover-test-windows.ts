/** Pickup window far enough ahead for supplier accept validation (30 min notice + buffer). */
export function safeSupplierAcceptPickupWindow(durationHours = 2) {
  const start = new Date(Date.now() + 35 * 60_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return { start, end };
}

export function activeHandoverWindow() {
  const start = new Date(Date.now() - 15 * 60_000);
  const end = new Date(Date.now() + 45 * 60_000);

  return { start, end };
}

export function activePickupWindowReservationUpdate() {
  const { start, end } = activeHandoverWindow();

  return {
    pickupWindowStart: start,
    pickupWindowEnd: end,
    supplierPickupWindowStart: start,
    supplierPickupWindowEnd: end,
  };
}

export function activeConfirmedDeliveryWindowUpdate() {
  const { start, end } = activeHandoverWindow();

  return {
    confirmedDeliveryWindowStart: start,
    confirmedDeliveryWindowEnd: end,
  };
}
