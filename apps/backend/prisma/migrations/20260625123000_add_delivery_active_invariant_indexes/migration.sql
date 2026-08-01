-- Enforce active internal delivery invariants at the database layer.
-- Many delivery attempts may exist, but only one can be active per reservation.
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_one_active_per_reservation_key"
ON "deliveries"("reservation_id")
WHERE "status" IN (
    'WAITING_FOR_DRIVER',
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF'
);

-- A driver can have only one active assigned delivery.
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_one_active_per_driver_key"
ON "deliveries"("assigned_driver_profile_id")
WHERE "assigned_driver_profile_id" IS NOT NULL
  AND "status" IN (
    'WAITING_FOR_DRIVER',
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF'
);
