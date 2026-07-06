const minPickupLeadTime = Duration(minutes: 30);
const minRemainingPickupWindow = Duration(minutes: 30);

/// @deprecated Use [minRemainingPickupWindow]
const minPickupNotice = minRemainingPickupWindow;

/// @deprecated Use [minPickupLeadTime]
const minCustomPickupStartNotice = minPickupLeadTime;

const pickupWindowTooCloseMessage =
    'This pickup window is too close to ending. Propose a new time.';
const learnerPickupWindowTooCloseMessage =
    'Preferred pickup window is too close to ending. Choose a window with at least 30 minutes remaining.';
const proposedPickupStartTooSoonMessage =
    'Proposed pickup time must start at least 30 minutes from now.';
