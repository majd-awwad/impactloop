// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'ImpactLoop';

  @override
  String get unknownStatus => 'Unknown status';

  @override
  String get somethingWentWrong => 'Something went wrong. Please try again.';

  @override
  String get networkError =>
      'We could not reach the server. Check your connection and try again.';

  @override
  String get timeoutError =>
      'The server took too long to respond. Please try again.';

  @override
  String get serverError =>
      'The server hit a problem. Please try again in a moment.';

  @override
  String get sessionExpired =>
      'Your session has expired. Please sign in again.';

  @override
  String get forbiddenError =>
      'You do not have permission to complete this action.';

  @override
  String get conflictError =>
      'This request conflicts with the current state. Please refresh and try again.';

  @override
  String get validationError =>
      'Check the highlighted information and try again.';

  @override
  String get accountSuspended =>
      'Your account has been suspended. Contact an administrator.';

  @override
  String get pickupWindowRequired =>
      'Choose a new pickup start and end time before sending a reschedule request.';

  @override
  String get invalidPickupWindow =>
      'The pickup window is not valid. Choose a different time.';

  @override
  String get invalidValue => 'Invalid value';

  @override
  String get completeRequiredDetail =>
      'Complete this required detail before continuing.';

  @override
  String currencyNis(String amount) {
    return '$amount NIS';
  }

  @override
  String distanceKilometers(String distance) {
    return '$distance km';
  }

  @override
  String quantityWithUnit(String quantity, String unit) {
    return '$quantity $unit';
  }

  @override
  String get notificationFallbackTitle => 'Notification';

  @override
  String get notificationFallbackBody => 'There is an update waiting for you.';

  @override
  String get material => 'Material';

  @override
  String get materials => 'Materials';

  @override
  String get supplier => 'Supplier';

  @override
  String get learner => 'Learner';

  @override
  String get learningHub => 'Learning Hub';

  @override
  String get learningProject => 'Learning project';

  @override
  String get requiredComponent => 'Required component';

  @override
  String get reservation => 'Reservation';

  @override
  String get reservationRequest => 'Reservation request';

  @override
  String get pickup => 'Pickup from supplier';

  @override
  String get delivery => 'Delivery';

  @override
  String get driver => 'Driver';

  @override
  String get available => 'Available';

  @override
  String get reserved => 'Reserved';

  @override
  String get reused => 'Reused';

  @override
  String get free => 'Free';

  @override
  String get paid => 'Paid';

  @override
  String get materialCondition => 'Material condition';

  @override
  String get sourceType => 'Source type';

  @override
  String get save => 'Save';

  @override
  String get saved => 'Saved';

  @override
  String get follow => 'Follow';

  @override
  String get following => 'Following';

  @override
  String get like => 'Like';

  @override
  String get buildProject => 'Build project';

  @override
  String get buildChecklist => 'Project build checklist';

  @override
  String get submission => 'Project submitted for review';

  @override
  String get changesRequested => 'Changes requested';

  @override
  String get pendingReview => 'Pending review';

  @override
  String get pickupMissed => 'Pickup missed';

  @override
  String get filterAll => 'All';

  @override
  String get filterActive => 'Active';

  @override
  String get filterNeedsAction => 'Needs action';

  @override
  String get filterPending => 'Pending';

  @override
  String get filterAccepted => 'Accepted';

  @override
  String get filterCompleted => 'Completed';

  @override
  String get filterClosed => 'Closed';

  @override
  String get statusPendingSupplier => 'Pending supplier response';

  @override
  String get statusNeedsConfirmation => 'Needs your confirmation';

  @override
  String get statusWaitingSupplier => 'Waiting for supplier response';

  @override
  String get statusWaitingSupplierWindow =>
      'Waiting for supplier to choose a new pickup window';

  @override
  String get statusAcceptedPickup => 'Accepted / Ready for pickup';

  @override
  String get statusAccepted => 'Accepted';

  @override
  String get statusRejected => 'Rejected';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusCancelled => 'Cancelled';

  @override
  String get statusClosedMissedPickup => 'Closed after missed pickup';

  @override
  String get statusCancelledNoDriver => 'Cancelled — no driver available';

  @override
  String get statusCancelledUnresolvedPickup =>
      'Admin cancelled due to unresolved pickup';

  @override
  String get statusExpiredNoResponse => 'Expired — no response';

  @override
  String get statusExpired => 'Expired';

  @override
  String get statusFulfillmentFailed => 'Fulfillment failed';

  @override
  String get statusPendingAdminReview => 'Pending admin review';

  @override
  String get statusReportVerified => 'Report verified';

  @override
  String get statusReportDismissed => 'Report dismissed';

  @override
  String get statusResolvedNoStrike => 'Resolved without strike';

  @override
  String get statusWaitingDriver => 'Waiting for driver';

  @override
  String get statusDriverAssigned => 'Driver assigned';

  @override
  String get statusDriverAtPickup => 'Driver at pickup';

  @override
  String get statusPickedUp => 'Picked up';

  @override
  String get statusOnTheWay => 'On the way';

  @override
  String get statusArrivedDropoff => 'Arrived at drop-off';

  @override
  String get statusDelivered => 'Delivered';

  @override
  String get statusDeliveryCancelled => 'Delivery cancelled';

  @override
  String get statusPickupFailed => 'Pickup failed';

  @override
  String get statusDeliveryFailed => 'Delivery failed';

  @override
  String get statusDriverNoShow => 'Driver no-show';

  @override
  String get statusLearnerNoShow => 'Learner no-show';

  @override
  String get statusNeedsAdminReview => 'Needs admin review';

  @override
  String get statusInDelivery => 'In delivery';

  @override
  String get statusNoDriverAvailable => 'No driver available';

  @override
  String get statusDriverPickupOverdue => 'Driver pickup overdue';

  @override
  String get statusDeliveryIssueReported => 'Delivery issue reported';

  @override
  String get statusDriverNotAssignedInTime => 'Driver not assigned in time';

  @override
  String get statusPickupNotCompleted => 'Pickup not completed';

  @override
  String get statusAtSupplierPickup => 'At supplier pickup';

  @override
  String get statusPickupWindowPassed => 'Pickup window passed';

  @override
  String get preferredDelivery => 'Preferred delivery';

  @override
  String get requestedPickup => 'Requested pickup';

  @override
  String additionalWindows(int count) {
    return '+$count more';
  }

  @override
  String deliveryAddressLabel(String address) {
    return 'Delivery address: $address';
  }

  @override
  String get safeDropoffAllowed => 'Safe drop-off allowed';

  @override
  String get safeDropoffNotAllowed => 'Safe drop-off not allowed';

  @override
  String get justNow => 'Just now';

  @override
  String minutesAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutes ago',
      one: '1 minute ago',
    );
    return '$_temp0';
  }

  @override
  String hoursAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count hours ago',
      one: '1 hour ago',
    );
    return '$_temp0';
  }

  @override
  String daysAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count days ago',
      one: '1 day ago',
    );
    return '$_temp0';
  }

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsSubtitle =>
      'Reservation, delivery, project, and account updates.';

  @override
  String get notificationsLoading => 'Loading notifications…';

  @override
  String get notificationsLoadingSubtitle => 'Fetching your latest updates.';

  @override
  String get notificationsLoadError => 'Could not load notifications.';

  @override
  String get tryAgain => 'Please try again.';

  @override
  String get retry => 'Retry';

  @override
  String get refresh => 'Refresh';

  @override
  String get markAllRead => 'Mark all read';

  @override
  String get filterUnread => 'Unread';

  @override
  String get filterRead => 'Read';

  @override
  String get noUnreadNotifications => 'No unread notifications.';

  @override
  String get allCaughtUp => 'You are all caught up for now.';

  @override
  String get noReadNotifications => 'No read notifications yet.';

  @override
  String get openedNotificationsAppearHere =>
      'Opened notifications will appear here.';

  @override
  String get noNotifications => 'No notifications yet.';

  @override
  String get notificationsAppearHere => 'Your updates will appear here.';

  @override
  String get loadMore => 'Load more';

  @override
  String notificationCount(int visible, int total) {
    return 'Showing $visible of $total notifications.';
  }

  @override
  String get notificationChipJob => 'Job';

  @override
  String get notificationChipReminder => 'Reminder';

  @override
  String get notificationChipDelivery => 'Delivery update';

  @override
  String get notificationChipAccount => 'Account';

  @override
  String get notificationChipUpdate => 'Update';

  @override
  String get viewJobs => 'View jobs';

  @override
  String get viewDetails => 'View details';

  @override
  String get viewDelivery => 'View delivery';

  @override
  String get viewReservation => 'View reservation';

  @override
  String get viewSubmission => 'View submission';

  @override
  String get open => 'Open';

  @override
  String get reservationAcceptedTitle => 'Reservation accepted';

  @override
  String reservationAcceptedBody(String materialTitle) {
    return '$materialTitle was accepted. Check your pickup or delivery details.';
  }

  @override
  String get reservationProposalTitle => 'Supplier proposed a new time';

  @override
  String reservationProposalBody(String materialTitle) {
    return 'Review the supplier proposal for $materialTitle.';
  }

  @override
  String get reservationDeclinedTitle => 'Reservation declined';

  @override
  String reservationDeclinedBody(String materialTitle) {
    return 'Your request for $materialTitle was declined.';
  }

  @override
  String get reservationExpiredTitle => 'Reservation expired';

  @override
  String reservationExpiredBody(String materialTitle) {
    return 'Your request for $materialTitle expired before the supplier responded.';
  }

  @override
  String get notificationReservationRequestedTitle => 'New reservation request';

  @override
  String notificationReservationRequestedBody(
    String learnerName,
    String materialTitle,
  ) {
    return '$learnerName requested $materialTitle.';
  }

  @override
  String get notificationReservationCancelledSupplierTitle =>
      'Reservation cancelled';

  @override
  String notificationReservationCancelledSupplierBody(
    String learnerName,
    String materialTitle,
  ) {
    return '$learnerName cancelled the request for $materialTitle.';
  }

  @override
  String get notificationReservationExpiredSupplierTitle =>
      'Reservation expired';

  @override
  String notificationReservationExpiredSupplierBody(String materialTitle) {
    return 'The pending request for $materialTitle expired.';
  }

  @override
  String get notificationChoosePickupWindowTitle =>
      'Choose a new pickup window';

  @override
  String notificationChoosePickupWindowBody(String materialTitle) {
    return 'Choose a new pickup window for $materialTitle.';
  }

  @override
  String get notificationNewPickupWindowNeededTitle =>
      'New pickup window needed';

  @override
  String notificationNewPickupWindowNeededBody(String materialTitle) {
    return 'A new pickup window is needed for $materialTitle.';
  }

  @override
  String get notificationCategoryRequestUpdateTitle =>
      'Category request update';

  @override
  String get notificationCategoryRequestUpdateBody =>
      'There is an update on your category request.';

  @override
  String get notificationPriceRequestUpdateTitle => 'Price review update';

  @override
  String get notificationPriceRequestUpdateBody =>
      'There is an update on your price review request.';

  @override
  String get notificationMaterialModerationUpdateTitle =>
      'Material review update';

  @override
  String get notificationMaterialModerationUpdateBody =>
      'There is an update on your material listing.';

  @override
  String get notificationSupplierVerificationUpdateTitle =>
      'Verification update';

  @override
  String get notificationSupplierVerificationUpdateBody =>
      'There is an update on your supplier verification.';

  @override
  String get reservationAlreadyAccepted =>
      'This reservation was already accepted.';

  @override
  String get reservationAlreadyDeclined =>
      'This reservation was already declined.';

  @override
  String get reservationExpiredError =>
      'This reservation expired before it could be updated.';

  @override
  String get reservationCancelledError =>
      'This reservation was cancelled and cannot be updated.';

  @override
  String get reservationNotPending =>
      'Only pending reservations can be updated.';

  @override
  String get projectModerationTitle => 'Project review updated';

  @override
  String projectModerationBody(String projectTitle) {
    return 'The review status for $projectTitle was updated.';
  }

  @override
  String get projectApprovedTitle => 'Learning project approved';

  @override
  String projectApprovedBody(String projectTitle) {
    return '$projectTitle was approved and is now published in the Learning Hub.';
  }

  @override
  String get projectChangesRequestedTitle =>
      'Changes requested for your project';

  @override
  String projectChangesRequestedBody(String projectTitle) {
    return '$projectTitle needs changes before it can be published.';
  }

  @override
  String get projectRejectedTitle => 'Learning project rejected';

  @override
  String projectRejectedBody(String projectTitle) {
    return '$projectTitle was not approved.';
  }

  @override
  String get projectHiddenTitle => 'Learning project unpublished';

  @override
  String projectHiddenBody(String projectTitle) {
    return '$projectTitle was hidden from the Learning Hub.';
  }

  @override
  String get projectRestoredTitle => 'Learning project restored';

  @override
  String projectRestoredBody(String projectTitle) {
    return '$projectTitle is published again in the Learning Hub.';
  }

  @override
  String get projectArchivedTitle => 'Learning project archived';

  @override
  String projectArchivedBody(String projectTitle) {
    return '$projectTitle was archived and removed from the Learning Hub.';
  }

  @override
  String projectModerationFeedback(String summary, String feedback) {
    return '$summary Reviewer feedback: $feedback';
  }

  @override
  String get addDraftPhoneTitle => 'Add project';

  @override
  String get draftCategoryLoadError => 'Could not load categories';

  @override
  String get draftCategoryLoading => 'Loading categories…';

  @override
  String get draftSelectCategory => 'Select a category';

  @override
  String get draftProjectTitleLabel => 'Project title';

  @override
  String get draftProjectTitleHint => 'Solar classroom weather station';

  @override
  String get draftCategoryLabel => 'Category';

  @override
  String get draftShortDescriptionLabel => 'Short description';

  @override
  String get draftShortDescriptionHint =>
      'Summarize what the learner will build.';

  @override
  String get draftFullDescriptionLabel => 'Full description (optional)';

  @override
  String get draftFullDescriptionHint =>
      'Explain the project goal and expected outcome.';

  @override
  String get draftStepsLabel => 'Implementation steps';

  @override
  String get draftStepsHint =>
      'One step per line. No need to write Step 1.\nConnect the sensor to the board.\nMount the components.\nTest readings.';

  @override
  String get draftLinksLabel => 'Helpful links';

  @override
  String get draftLinksHint => 'https://example.com/reference-guide';

  @override
  String get draftSaving => 'Saving draft…';

  @override
  String get draftSave => 'Save draft';

  @override
  String get draftSavedMessage =>
      'Draft saved. You can add images and submit it for review when it is ready.';

  @override
  String get draftSelectAvailableCategoryBeforeSave =>
      'Select an available project category before saving.';

  @override
  String get draftMinimumContentBeforeSave =>
      'Add at least 10 characters of project content before saving.';

  @override
  String get draftComponentRequired =>
      'Add at least one component with a name.';

  @override
  String get draftComponentLimit => 'Use 50 components or fewer.';

  @override
  String get draftComponentUnique => 'Each component must have a unique name.';

  @override
  String get draftFullDescriptionMinimum =>
      'Use at least 10 characters when adding a full description.';

  @override
  String get draftFullDescriptionMaximum =>
      'Keep the full description under 10000 characters.';

  @override
  String get draftTitleRequired => 'Project title is required.';

  @override
  String get draftMinimumThreeCharacters => 'Use at least 3 characters.';

  @override
  String get draftTitleMaximum => 'Keep the title under 200 characters.';

  @override
  String get draftSummaryRequired => 'Short description is required.';

  @override
  String get draftMinimumTenCharacters => 'Use at least 10 characters.';

  @override
  String get draftSummaryMaximum =>
      'Keep the short description under 500 characters.';

  @override
  String get draftCategoriesCouldNotLoad =>
      'Project categories could not load.';

  @override
  String get draftCategoriesUnavailable =>
      'Project categories are not available yet.';

  @override
  String get draftSelectAvailableCategory => 'Select an available category.';

  @override
  String get draftStepsMaximum => 'Use 100 steps or fewer.';

  @override
  String get draftStepMaximum => 'Keep each step under 5000 characters.';

  @override
  String get draftLinksMaximum => 'Use 20 links or fewer.';

  @override
  String get draftLinksInvalid =>
      'Use valid http or https links, one per line.';

  @override
  String get draftComponentNameRequired => 'Component name is required.';

  @override
  String get draftComponentNameMaximum =>
      'Keep each component name under 200 characters.';

  @override
  String get draftQuantityPositive => 'Quantity must be greater than zero.';

  @override
  String get draftValidUnit => 'Choose a valid unit.';

  @override
  String get draftNotesMaximum => 'Keep notes under 1000 characters.';

  @override
  String get draftKeywordsMaximum => 'Use up to 5 keywords per component.';

  @override
  String get draftKeywordMaximum => 'Keep each keyword under 80 characters.';

  @override
  String get draftValidMaterialCategory =>
      'Choose a valid material category or leave it as None.';

  @override
  String get pickupWindowNotSet => 'Pickup window not set';

  @override
  String yourPreferredPickupWindow(String window) {
    return 'Your preferred pickup: $window';
  }

  @override
  String supplierProposedPickupWindow(String window) {
    return 'Supplier proposed pickup: $window';
  }

  @override
  String supplierDriverPickupWindow(String window) {
    return 'Supplier driver pickup window: $window';
  }

  @override
  String earliestPossibleDelivery(String dateTime) {
    return 'Earliest possible delivery: $dateTime';
  }

  @override
  String supplierProposedDeliveryWindow(String window) {
    return 'Supplier proposed delivery: $window';
  }

  @override
  String confirmedDeliveryWindow(String window) {
    return 'Confirmed delivery: $window';
  }

  @override
  String supplierPickupWindow(String window) {
    return 'Supplier pickup window: $window';
  }

  @override
  String previousPreferredDeliveryWindow(String window) {
    return 'Your previous preferred delivery: $window';
  }

  @override
  String confirmedPickupWindow(String window) {
    return 'Confirmed pickup: $window';
  }

  @override
  String selectedDeliveryWindow(String window) {
    return 'Selected delivery window: $window';
  }

  @override
  String get learnerAccountRequired => 'Learner account required';

  @override
  String get learnerAccountRequiredReservations =>
      'Use a learner account to view material reservations.';

  @override
  String get myReservations => 'My reservations';

  @override
  String get reservationsSubtitle =>
      'Track requests, pickup windows, and delivery updates.';

  @override
  String get loadingReservations => 'Loading reservations';

  @override
  String get loadingReservationsSubtitle =>
      'Checking your latest reservation activity.';

  @override
  String get reservationsLoadError => 'Could not load reservations';

  @override
  String get noReservations => 'No reservations yet';

  @override
  String get noReservationsSubtitle =>
      'Reserve an available material and supplier updates will appear here.';

  @override
  String get browseMaterials => 'Browse materials';

  @override
  String get noMatchingReservations => 'No matching reservations';

  @override
  String get noMatchingReservationsSubtitle =>
      'Try another filter or browse materials to start a new request.';

  @override
  String get deliveryUpdatesUnavailable =>
      'Delivery updates are temporarily unavailable.';

  @override
  String get tryAgainAction => 'Try again';

  @override
  String get fulfillmentMethod => 'Fulfillment method';

  @override
  String get supplierIssueReportedAdmin => 'Supplier issue reported to admin.';

  @override
  String get noDriverReportedAdmin => 'No-driver case reported to admin.';

  @override
  String get supplierPickupCodeInstructions =>
      'Give this code to the supplier when you receive the material.';

  @override
  String pickupAddressValue(String address) {
    return 'Pickup address: $address';
  }

  @override
  String get pickupWindowPassedFollowup =>
      'Pickup window passed. Please contact the supplier or wait for follow-up.';

  @override
  String get viewMaterial => 'View material';

  @override
  String get cancelRequest => 'Cancel request';

  @override
  String get reservationCancelledFeedback => 'Reservation cancelled.';

  @override
  String get keepRequest => 'Keep request';

  @override
  String get cancelReservationQuestion => 'Cancel reservation?';

  @override
  String get close => 'Close';

  @override
  String get cancelReleasesQuantity =>
      'This will release the requested quantity back to the listing.';

  @override
  String requestedQuantityLabel(String quantity) {
    return 'Requested: $quantity';
  }

  @override
  String yourRescheduleRequest(String reason) {
    return 'Your reschedule request: $reason';
  }

  @override
  String get requestReschedule => 'Request reschedule';

  @override
  String get reasonRequired => 'Reason (required)';

  @override
  String get noteOptional => 'Note (optional)';

  @override
  String get noteRequired => 'Note (required)';

  @override
  String get pickProposedStart => 'Pick proposed start';

  @override
  String proposedStart(String dateTime) {
    return 'Start: $dateTime';
  }

  @override
  String get pickProposedEnd => 'Pick proposed end';

  @override
  String proposedEnd(String dateTime) {
    return 'End: $dateTime';
  }

  @override
  String get rescheduleReasonWindowRequired =>
      'Enter a reason and choose a pickup window.';

  @override
  String get endAfterStart => 'End time must be after start time.';

  @override
  String get pickupWindowTooClose =>
      'Choose a pickup window that leaves enough time to complete the handover.';

  @override
  String get sendRequest => 'Send request';

  @override
  String get rescheduleSent => 'Reschedule request sent to supplier.';

  @override
  String get supplierUnavailable => 'Supplier unavailable';

  @override
  String get materialNotReady => 'Material not ready';

  @override
  String get wrongPickupInformation => 'Wrong pickup information';

  @override
  String get other => 'Other';

  @override
  String get reportSupplierIssue => 'Report supplier issue';

  @override
  String get reportSupplierDescription =>
      'Report a supplier issue for admin review. The reservation will be closed pending review.';

  @override
  String get reason => 'Reason';

  @override
  String get describeWhatHappened => 'Describe what happened';

  @override
  String get submitReport => 'Submit report';

  @override
  String get reportNoDriverAvailable => 'Report no driver available';

  @override
  String get reportNoDriverDescription =>
      'No driver accepted this delivery. Submit a report for admin review.';

  @override
  String get actionRequired => 'Action required';

  @override
  String get pickupTimeAccepted => 'Pickup time accepted.';

  @override
  String get deliveryWindowAfterEarliest =>
      'Selected window must end after the earliest possible delivery time.';

  @override
  String get deliveryWindowSubmitted => 'Delivery window submitted.';

  @override
  String get cancelReservation => 'Cancel reservation';

  @override
  String get acceptProposedTime => 'Accept proposed time';

  @override
  String get newDeliveryWindow => 'New delivery window';

  @override
  String get submitNewDeliveryWindow => 'Submit new delivery window';

  @override
  String get pickupIncompleteAdminReview =>
      'Pickup was not completed before the supplier window ended. An admin may review if no one reports the issue.';

  @override
  String get driverPickupIncompleteAdminReview =>
      'The assigned driver has not completed supplier pickup before the window ended. An admin may review if no one reports the issue.';

  @override
  String schedulingConflict(String reason) {
    return 'Scheduling conflict: $reason';
  }

  @override
  String get reservationWaitingSupplierMessage =>
      'Waiting for supplier response.';

  @override
  String get reservationScheduleNeedsConfirmation =>
      'The supplier proposed a schedule that needs your confirmation.';

  @override
  String get reservationRescheduleWaitingSupplier =>
      'You requested a new pickup time. Waiting for the supplier to respond.';

  @override
  String get reservationReportedAwaitingAdmin =>
      'This reservation was reported and is awaiting admin review.';

  @override
  String get reservationReportVerifiedMessage =>
      'Your report was verified by an admin.';

  @override
  String get reservationReportDismissedMessage =>
      'Your report was reviewed and dismissed.';

  @override
  String get reservationIncidentResolvedMessage =>
      'This incident was resolved without a strike.';

  @override
  String get reservationAcceptedPickupMessage =>
      'Reservation accepted. Follow the pickup window from the supplier.';

  @override
  String get reservationRejectedSupplierMessage =>
      'The supplier rejected this reservation request.';

  @override
  String get reservationCompletedMessage => 'This reservation is completed.';

  @override
  String get reservationCancelledMessage => 'This reservation was cancelled.';

  @override
  String get reservationMissedPickupExpiredMessage =>
      'This reservation expired after the pickup window passed without follow-up. Create a new reservation if you still need the material.';

  @override
  String get reservationSupplierNoResponseExpired =>
      'This request expired because the supplier did not respond in time.';

  @override
  String get reservationExpiredMessage => 'This reservation expired.';

  @override
  String supplierQuantityLine(String supplier, String quantity) {
    return 'Supplier: $supplier · Requested: $quantity';
  }

  @override
  String get deliveryInProgress => 'Delivery in progress';

  @override
  String get deliveryScheduled => 'Delivery scheduled';

  @override
  String get deliveryReservation => 'Delivery reservation';

  @override
  String get deliverySelectedAtReservation =>
      'Delivery selected at reservation';

  @override
  String get deliveryRequestedStatus => 'Delivery requested';

  @override
  String get deliveryAvailable => 'Delivery available';

  @override
  String get pickupOnly => 'Pickup only';

  @override
  String get combinedDelivery => 'Combined delivery';

  @override
  String combinedDeliveryItems(int count) {
    return '$count items in this group';
  }

  @override
  String combinedDeliveryTotal(String currency, String amount) {
    return 'Group total $currency $amount';
  }

  @override
  String get combinedDeliveryFeeOnce =>
      'Delivery fee charged once for the group';

  @override
  String get welcomeBack => 'Welcome back';

  @override
  String get loginSubtitle =>
      'Sign in to continue discovering materials and building with less waste.';

  @override
  String get email => 'Email';

  @override
  String get emailHint => 'you@example.com';

  @override
  String get password => 'Password';

  @override
  String get emailRequired => 'Email is required';

  @override
  String get validEmailRequired => 'Enter a valid email address';

  @override
  String get passwordRequired => 'Password is required';

  @override
  String get invalidCredentials => 'Invalid email or password.';

  @override
  String get forgotPasswordQuestion => 'Forgot password?';

  @override
  String get signIn => 'Sign in';

  @override
  String get newToImpactLoop => 'New to ImpactLoop?';

  @override
  String get createAccount => 'Create account';

  @override
  String get resetYourPassword => 'Reset your password';

  @override
  String get forgotPasswordSubtitle =>
      'Enter your account email and we will send reset instructions if an account exists.';

  @override
  String get forgotPasswordSuccess =>
      'If an account exists for this email, reset instructions have been sent.';

  @override
  String get backToSignIn => 'Back to sign in';

  @override
  String get sendResetInstructions => 'Send reset instructions';

  @override
  String get createNewPassword => 'Create a new password';

  @override
  String get resetPasswordSubtitle =>
      'Choose a new password for your account. The reset link can only be used once.';

  @override
  String get resetLinkInvalid => 'Reset link is missing or invalid.';

  @override
  String get passwordUpdated =>
      'Your password has been updated. Sign in with your new password.';

  @override
  String get goToSignIn => 'Go to sign in';

  @override
  String get newPassword => 'New password';

  @override
  String get confirmPassword => 'Confirm password';

  @override
  String get newPasswordRequired => 'New password is required';

  @override
  String get passwordMinLength => 'Password must be at least 8 characters';

  @override
  String get confirmNewPassword => 'Confirm your new password';

  @override
  String get passwordsDoNotMatch => 'Passwords do not match';

  @override
  String get resetPasswordAction => 'Reset password';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get createYourAccount => 'Create your account';

  @override
  String get registerSubtitle =>
      'Tell us how you want to use ImpactLoop and set up your profile in one step.';

  @override
  String get alreadyHaveAccount => 'Already have an account?';

  @override
  String get home => 'Home';

  @override
  String get learning => 'Learning';

  @override
  String get reservations => 'Reservations';

  @override
  String get profile => 'Profile';

  @override
  String get settings => 'Settings';

  @override
  String get menu => 'Menu';

  @override
  String get account => 'Account';

  @override
  String get logout => 'Logout';

  @override
  String get loggingOut => 'Logging out…';

  @override
  String get signedOutOffline =>
      'You were signed out locally, but the server could not be reached.';

  @override
  String get learnReuseBuild => 'Learn. Reuse. Build.';

  @override
  String get themeSystem => 'System';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String homeGreeting(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get homeHeroTitle => 'Ready to build something today?';

  @override
  String get homeHeroSubtitle =>
      'Find reusable materials, explore project ideas, and manage reservation and delivery updates from one place.';

  @override
  String get browseMaterialsAction => 'Browse Materials';

  @override
  String get exploreLearningHub => 'Explore Learning Hub';

  @override
  String get quickActions => 'Quick actions';

  @override
  String get quickActionsSubtitle =>
      'Start with the areas that are available today.';

  @override
  String get browseAll => 'Browse all';

  @override
  String get browseProjects => 'Browse projects';

  @override
  String get openMaterials => 'Open materials';

  @override
  String get openLearningHub => 'Open Learning Hub';

  @override
  String get backToHome => 'Back to home';

  @override
  String get recommendationsLoadError => 'Could not load recommendations';

  @override
  String get recommendationsLoadErrorSubtitle =>
      'Try again in a moment or return to your home feed.';

  @override
  String get showUpTo => 'Show up to';

  @override
  String get addInterestsPrompt =>
      'Add your interests to improve recommendations.';

  @override
  String get editLearnerProfile => 'Edit learner profile';

  @override
  String get sectionSuggestedMaterialsTitle => 'Suggested materials for you';

  @override
  String get sectionSuggestedMaterialsSubtitle =>
      'Personalized from your interests, saved projects, and recent activity.';

  @override
  String get sectionSuggestedMaterialsEmpty =>
      'Choose interests to improve your suggestions.';

  @override
  String get sectionSavedProjectMaterialsTitle =>
      'Materials for your saved projects';

  @override
  String get sectionSavedProjectMaterialsSubtitle =>
      'Materials matched to components in your saved learning projects.';

  @override
  String get sectionSavedProjectMaterialsEmpty =>
      'Save a learning project to see matching materials.';

  @override
  String get sectionSuggestedProjectsTitle => 'Projects you may like';

  @override
  String get sectionSuggestedProjectsSubtitle =>
      'Recommended from your interests and available matching materials.';

  @override
  String get sectionSuggestedProjectsEmpty =>
      'Choose interests to see project recommendations.';

  @override
  String get sectionContinueProjectsTitle => 'Continue your projects';

  @override
  String get sectionContinueProjectsSubtitle =>
      'Pick up where you left off on in-progress project builds.';

  @override
  String get sectionContinueProjectsEmpty =>
      'Start a project build to continue here.';

  @override
  String get sectionSavedProjectsTitle => 'Saved projects';

  @override
  String get sectionSavedProjectsSubtitle => 'Projects you saved for later.';

  @override
  String get sectionSavedProjectsEmpty => 'Saved projects will appear here.';

  @override
  String get sectionFreeMaterialsTitle => 'Free materials near you';

  @override
  String get sectionFreeMaterialsSubtitle =>
      'Free materials available on ImpactLoop.';

  @override
  String get sectionFreeMaterialsEmpty => 'No free nearby materials found yet.';

  @override
  String get sectionPopularProjectsTitle => 'Popular projects';

  @override
  String get sectionPopularProjectsSubtitle =>
      'Popular learning projects across ImpactLoop.';

  @override
  String get sectionPopularProjectsEmpty => 'No popular projects found yet.';

  @override
  String get reasonSimilarReserved => 'Similar to materials you reserved';

  @override
  String get reasonRecentActivity => 'Matches your recent activity';

  @override
  String get reasonSavedProjects => 'Related to your saved projects';

  @override
  String get reasonLikedProjects => 'Based on projects you liked';

  @override
  String get reasonFollowedProjects => 'Related to projects you follow';

  @override
  String get reasonMaterialActivity => 'Related to materials in your activity';

  @override
  String get reasonNearLocation => 'Available near your saved location';

  @override
  String get reasonFreeMaterial => 'Free material';

  @override
  String get reasonFreeNearLocation => 'Free material near your saved location';

  @override
  String get reasonDeliveryAvailable => 'Delivery available';

  @override
  String get reasonPopularMaterial => 'Popular material';

  @override
  String get reasonRecentlyAdded => 'Recently added';

  @override
  String reasonMatchesInterest(String interest) {
    return 'Matches your $interest interest';
  }

  @override
  String reasonBuildingCategory(String category) {
    return 'Because you are building a $category project';
  }

  @override
  String reasonComponentsReady(int ready, int total) {
    return '$ready of $total components ready';
  }

  @override
  String get reasonRecommended => 'Recommended for you';

  @override
  String get findReusableMaterials => 'Find reusable materials';

  @override
  String get browseItems => 'Browse items';

  @override
  String get materialsActionDescription =>
      'Search currently listed materials from suppliers.';

  @override
  String get exploreLearningProjects => 'Explore learning projects';

  @override
  String get exploreProjects => 'Explore projects';

  @override
  String get learningActionDescription =>
      'Open the Learning Hub project catalog.';

  @override
  String get trackPickups => 'Track pickups';

  @override
  String get reservationsActionDescription =>
      'Track supplier responses and pickup windows for requested materials.';

  @override
  String get comingLater => 'Coming later';

  @override
  String get comingLaterSubtitle =>
      'Impact insights are planned but not available yet.';

  @override
  String get impactSnapshot => 'Impact snapshot';

  @override
  String get impactSnapshotDescription =>
      'Your reuse impact will appear here after you complete reservations and projects.';

  @override
  String get landingFutureBadge => 'Build a better future';

  @override
  String get landingHeroSubtitle =>
      'Discover reusable materials, share surplus resources, and turn surplus into projects with a cleaner, community-driven workflow.';

  @override
  String get landingCtaNote => 'No credit card. No noise. Just building.';

  @override
  String get materialsReused => 'Materials reused';

  @override
  String get activeMakers => 'Active makers';

  @override
  String get landingCommunity =>
      'Join a growing community of students, makers, and suppliers who are building with less waste.';

  @override
  String get landingFeatureFindTitle => 'Find reusable materials';

  @override
  String get landingFeatureFindBody =>
      'Browse a wide range of materials shared by your community.';

  @override
  String get exploreMaterials => 'Explore materials';

  @override
  String get landingFeatureShareTitle => 'Share surplus materials';

  @override
  String get landingFeatureShareBody =>
      'List what you no longer need and help others build more.';

  @override
  String get shareMaterials => 'Share materials';

  @override
  String get landingFeatureBuildTitle => 'Build with less waste';

  @override
  String get landingFeatureBuildBody =>
      'Save money, reduce waste, and bring creative projects to life.';

  @override
  String get startBuilding => 'Start building';

  @override
  String get landingFooter =>
      'Sustainable choices. Stronger communities. Smarter projects.';

  @override
  String get requestDelivery => 'Request delivery';

  @override
  String requestDeliveryForMaterial(String materialTitle) {
    return 'Choose where the driver should deliver $materialTitle.';
  }

  @override
  String get deliveryRequested => 'Delivery requested.';

  @override
  String get deliveryRequestFailed => 'Could not request delivery. Try again.';

  @override
  String get savedAddressesLoadFailed => 'Could not load saved addresses.';

  @override
  String get noSavedAddresses => 'No saved addresses yet. Enter one below.';

  @override
  String get newAddress => 'New address';

  @override
  String get savedDropoffAddress => 'Saved drop-off address';

  @override
  String get chooseSavedDropoffAddress => 'Choose a saved drop-off address.';

  @override
  String get country => 'Country';

  @override
  String get city => 'City';

  @override
  String get area => 'Area';

  @override
  String get address => 'Address';

  @override
  String get countryAndCityRequired => 'Country and city are required.';

  @override
  String get useCurrentLocation => 'Use current location';

  @override
  String get gettingLocation => 'Getting location…';

  @override
  String get currentLocationCaptured => 'Current location captured.';

  @override
  String get currentLocationFailed => 'Could not get your current location.';

  @override
  String coordinatesValue(String coordinates) {
    return 'Coordinates: $coordinates';
  }

  @override
  String get preciseLocationHelp =>
      'A precise location helps the driver find you. You can still submit only a city and address.';

  @override
  String get saveAddressForLater => 'Save this address for later';

  @override
  String get addressLabel => 'Address label';

  @override
  String get addressLabelHint => 'Home, campus, workshop…';

  @override
  String get addressLabelRequired => 'Enter a label to save this address.';

  @override
  String get driverNoteOptional => 'Note for the driver (optional)';

  @override
  String get supplierProfile => 'Supplier profile';

  @override
  String get supplierProfileNotFound => 'Supplier profile not found.';

  @override
  String get supplierProfileLoadFailed =>
      'Could not load the supplier profile.';

  @override
  String get supplierMaterialsLoadFailed =>
      'Could not load supplier materials.';

  @override
  String get learnerAccountFollowRequired =>
      'Use a learner account to follow suppliers.';

  @override
  String publicMaterialsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count public materials',
      one: '1 public material',
      zero: 'No public materials',
    );
    return '$_temp0';
  }

  @override
  String get noPublicMaterials =>
      'No public materials are available right now.';

  @override
  String get retryLoadingMore => 'Retry loading more';

  @override
  String get aboutSupplier => 'About this supplier';

  @override
  String get aboutSupplierDescription =>
      'Browse public materials from this supplier and follow updates when new stock is published.';

  @override
  String get deliveryQuoteFailed =>
      'Could not calculate the delivery price. Check the delivery location and try again.';

  @override
  String get cannotReserveOwnMaterial =>
      'You cannot reserve a material you listed yourself.';

  @override
  String get openReservationAlreadyExists =>
      'You already have an open reservation for this material. Check My Reservations.';

  @override
  String get materialUnavailableForReservation =>
      'This material is no longer available for new reservations.';

  @override
  String get invalidReservationQuantity =>
      'Enter a quantity greater than zero and no more than what is available.';

  @override
  String reservationQuantityUpTo(String quantity) {
    return 'That quantity is unavailable. You can request up to $quantity now.';
  }

  @override
  String get loadingDelivery => 'Loading delivery';

  @override
  String get checkingDeliveryStatus => 'Checking the latest delivery status.';

  @override
  String get deliveryLoadFailed => 'Could not load delivery';

  @override
  String get deliveryStatusTitle => 'Delivery status';

  @override
  String requestedAt(String dateTime) {
    return 'Requested $dateTime';
  }

  @override
  String get assignedDriver => 'Assigned driver';

  @override
  String get pickupWindow => 'Pickup window';

  @override
  String get pickupArea => 'Pickup area';

  @override
  String get dropoff => 'Drop-off';

  @override
  String get driverNote => 'Driver note';

  @override
  String get failureReason => 'Failure reason';

  @override
  String get deliveryCodeInstructions =>
      'Give this code to the driver when you receive the material.';

  @override
  String get backToReservations => 'Back to reservations';

  @override
  String get liveTracking => 'Live tracking';

  @override
  String get driverLocationUpdated => 'Driver location updated recently';

  @override
  String get trackDelivery => 'Track delivery';

  @override
  String get refreshStatus => 'Refresh status';

  @override
  String get statusTimeline => 'Status timeline';

  @override
  String get statusTimelineDescription => 'Delivery workflow updates.';

  @override
  String get loadingTracking => 'Loading delivery tracking…';

  @override
  String get fetchingTracking => 'Fetching the latest delivery location.';

  @override
  String get trackingLoadFailed => 'Could not load tracking.';

  @override
  String get trackingUnavailable => 'Tracking is not available yet';

  @override
  String get waitingDriverLocation => 'Waiting for the driver location';

  @override
  String get waitingDriverLocationDescription =>
      'The driver has picked up your material. The location will appear once it is shared.';

  @override
  String get driverLocationStale =>
      'The driver location has not updated recently.';

  @override
  String lastUpdatedAt(String dateTime) {
    return 'Last updated: $dateTime';
  }

  @override
  String get autoUpdateHint => 'Updates automatically while this page is open.';

  @override
  String get refreshing => 'Refreshing…';

  @override
  String get refreshTracking => 'Refresh tracking';

  @override
  String get viewDeliveryDetails => 'View delivery details';

  @override
  String driverName(String name) {
    return 'Driver: $name';
  }

  @override
  String deliveryRoute(String pickup, String dropoff) {
    return 'Pickup: $pickup → Drop-off: $dropoff';
  }

  @override
  String get pickupLocation => 'Pickup location';

  @override
  String get dropoffLocation => 'Drop-off location';

  @override
  String get waitingForDriver => 'Waiting for a driver.';

  @override
  String get driverAssigned => 'A driver has been assigned.';

  @override
  String get driverHeadingToPickup =>
      'The driver is heading to the supplier pickup.';

  @override
  String get trackingComplete => 'Tracking is complete for this delivery.';

  @override
  String get trackingAvailableAfterPickup =>
      'The driver location is available after pickup.';

  @override
  String get driverLocationNotShared =>
      'The driver has not shared a location yet. Location updates will appear here when shared.';

  @override
  String accuracyMeters(String meters) {
    return 'Accuracy: about $meters m';
  }

  @override
  String get trackingRefreshFailed =>
      'Could not refresh tracking. Showing the last known location.';

  @override
  String get supplierSupplierRole => 'Supplier role';

  @override
  String get supplierOverview => 'Overview';

  @override
  String get supplierMyMaterials => 'My Materials';

  @override
  String get supplierAddMaterial => 'Add Material';

  @override
  String get supplierAdd => 'Add';

  @override
  String get supplierIncomingRequests => 'Incoming Requests';

  @override
  String get supplierRequests => 'Requests';

  @override
  String get supplierPickupSchedule => 'Pickup Schedule';

  @override
  String get supplierSupplierPortal => 'Supplier Portal';

  @override
  String get supplierTheme => 'Theme';

  @override
  String get supplierViewSupplierProfile => 'View supplier profile';

  @override
  String get supplierTrackMaterialsRequestsAndImpact =>
      'Track materials, requests, and impact.';

  @override
  String get supplierListSurplusMaterialsForReuseBy =>
      'List surplus materials for reuse by learners and makers.';

  @override
  String get supplierManagePublicSupplierDetailsAndPickup =>
      'Manage public supplier details and pickup location.';

  @override
  String get supplierReviewLearnerRequestsAndSchedulePickups =>
      'Review learner requests and schedule pickups.';

  @override
  String get supplierTrackAcceptedPickupsAndUpcomingHandovers =>
      'Track accepted pickups and upcoming handovers.';

  @override
  String get supplierReviewUpdatesAndActionsThatNeed =>
      'Review updates and actions that need your attention.';

  @override
  String get supplierComingSoonInTheSupplierPortal =>
      'Coming soon in the Supplier Portal.';

  @override
  String get supplierManageYourSupplierActivity =>
      'Manage your supplier activity.';

  @override
  String get supplierManageYourListedSurplusMaterials =>
      'Manage your listed surplus materials.';

  @override
  String get supplierSearchYourMaterials => 'Search your materials';

  @override
  String get supplierTotal => 'Total';

  @override
  String get supplierPendingReserved => 'Pending / Reserved';

  @override
  String get supplierUnavailable2 => 'Unavailable';

  @override
  String get supplierYouHaveNotListedAnyMaterials =>
      'You have not listed any materials yet.';

  @override
  String get supplierShareSurplusMaterialsWithLearnersAnd =>
      'Share surplus materials with learners and makers from your workshop.';

  @override
  String get supplierAddYourFirstMaterial => 'Add your first material';

  @override
  String get supplierWeCouldNotLoadYourMaterials =>
      'We could not load your materials.';

  @override
  String get supplierNoMaterialsMatchYourFilters =>
      'No materials match your filters.';

  @override
  String get supplierTryClearingFiltersOrAdjustingYour =>
      'Try clearing filters or adjusting your search.';

  @override
  String get supplierLikes => 'Likes';

  @override
  String get supplierEngagement => 'Engagement';

  @override
  String get supplierActiveDemand => 'Active demand';

  @override
  String get supplierDemandInterestScore => 'Demand / interest score';

  @override
  String get supplierReuseHistory => 'Reuse history';

  @override
  String get supplierReservationsForThisMaterial =>
      'Reservations for this material';

  @override
  String get supplierDemandIndicators => 'Demand indicators';

  @override
  String get supplierNoReservationsForThisMaterialYet =>
      'No reservations for this material yet.';

  @override
  String get supplierNoDemandSignalsYet => 'No demand signals yet.';

  @override
  String get supplierNoActiveRequestsRightNowThis =>
      'No active requests right now. This material has already been reused.';

  @override
  String get supplierThisMaterialHasActiveDemand =>
      'This material has active demand.';

  @override
  String get supplierLearnersAreShowingInterestButNo =>
      'Learners are showing interest, but no reservations yet.';

  @override
  String get supplierNoActiveDemandYet => 'No active demand yet.';

  @override
  String get supplierActiveDemandScore => 'Active demand score';

  @override
  String get supplierOverallDemandScore => 'Overall demand score';

  @override
  String supplierPercent(String percent) {
    return '$percent%';
  }

  @override
  String get supplierBasedOnViewsLikesActiveRequests =>
      'Based on views, likes, active requests, and completed reuses.';

  @override
  String get supplierCompletedReservations => 'Completed reservations';

  @override
  String get supplierCompletedReuses => 'Completed reuses';

  @override
  String get supplierLastCompleted => 'Last completed';

  @override
  String get supplierMarkUnavailable => 'Mark unavailable';

  @override
  String get supplierRestoreAvailable => 'Restore available';

  @override
  String get supplierHighDemand => 'High demand';

  @override
  String get supplierOpenReservation => 'Open reservation';

  @override
  String get supplierPendingReservations => 'Pending reservations';

  @override
  String get supplierReservedReservations => 'Reserved reservations';

  @override
  String get supplierTotalActiveRequests => 'Total active requests';

  @override
  String get supplierDemandScore => 'Demand score';

  @override
  String get supplierAllPrices => 'All prices';

  @override
  String get supplierStatus => 'Status';

  @override
  String get supplierPrice => 'Price';

  @override
  String get supplierAllCategories => 'All categories';

  @override
  String get supplierManage => 'Manage';

  @override
  String get supplierEdit => 'Edit';

  @override
  String get supplierEditMaterial => 'Edit material';

  @override
  String get supplierUpdateSafeListingDetailsPriceAnd =>
      'Update safe listing details. Price and category changes require review.';

  @override
  String get supplierPriceCategoryLocationAndImagesAre =>
      'Price, category, location, and images are not editable here yet.';

  @override
  String get supplierMaterialUpdatedSuccessfully =>
      'Material updated successfully.';

  @override
  String get supplierCouldNotUpdateMaterialPleaseTry =>
      'Could not update material. Please try again.';

  @override
  String get supplierDelete => 'Delete';

  @override
  String get supplierDeleteMaterial => 'Delete material?';

  @override
  String get supplierThisWillRemoveTheMaterialFrom =>
      'This will remove the material from your listings. This action cannot be undone.';

  @override
  String get supplierMaterialDeletedSuccessfully =>
      'Material deleted successfully.';

  @override
  String get supplierCouldNotDeleteMaterialPleaseTry =>
      'Could not delete material. Please try again.';

  @override
  String get supplierReusedMaterialsCannotBeDeletedBecause =>
      'Reused materials cannot be deleted because they are part of reuse history.';

  @override
  String get supplierCannotDeleteAMaterialWithActive =>
      'Cannot delete a material with active requests.';

  @override
  String get supplierThisMaterialCannotBeDeletedRight =>
      'This material cannot be deleted right now.';

  @override
  String get supplierReusedMaterialsCannotBeEditedBecause =>
      'Reused materials cannot be edited because they are part of reuse history.';

  @override
  String get supplierCannotEditAMaterialWithActive =>
      'Cannot edit a material with active requests or blocked status.';

  @override
  String get supplierThisMaterialCannotBeEditedRight =>
      'This material cannot be edited right now.';

  @override
  String get supplierEditingNotAvailable => 'Editing not available';

  @override
  String get supplierSaveChanges => 'Save changes';

  @override
  String get supplierReadOnly => 'Read-only';

  @override
  String get supplierMaterialType => 'Material type';

  @override
  String get supplierEditingListingsIsComingSoon =>
      'Editing listings is coming soon.';

  @override
  String get supplierPrevious => 'Previous';

  @override
  String get supplierNext => 'Next';

  @override
  String supplierPagePageOfTotalpages(String page, String totalPages) {
    return 'Page $page of $totalPages';
  }

  @override
  String supplierListedDate(String date) {
    return 'Listed $date';
  }

  @override
  String get supplierMaterialNotFound => 'Material not found';

  @override
  String get supplierThisListingMayHaveBeenRemoved =>
      'This listing may have been removed or is no longer available.';

  @override
  String get supplierBackToMyMaterials => 'Back to My Materials';

  @override
  String get supplierViews => 'Views';

  @override
  String get supplierCreated => 'Created';

  @override
  String get supplierUpdated => 'Updated';

  @override
  String get supplierSupplierProfile => 'Supplier Profile';

  @override
  String get supplierCancel => 'Cancel';

  @override
  String get supplierBack => 'Back';

  @override
  String get supplierBackToDashboard => 'Back to dashboard';

  @override
  String get supplierAccept => 'Accept';

  @override
  String get supplierDecline => 'Decline';

  @override
  String get supplierLoading => 'Loading…';

  @override
  String get supplierRequired => 'Required';

  @override
  String get supplierOptional => 'Optional';

  @override
  String get supplierComingSoon => 'Coming soon';

  @override
  String supplierWelcomeBackName(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get supplierTrackYourMaterialsRespondToRequests =>
      'Track your materials, respond to requests, and grow reuse impact.';

  @override
  String get supplierAddMaterial2 => 'Add material';

  @override
  String get supplierViewRequests => 'View requests';

  @override
  String get supplierActiveMaterials => 'Active materials';

  @override
  String get supplierPendingRequests => 'Pending requests';

  @override
  String get supplierScheduledPickups => 'Scheduled pickups';

  @override
  String get supplierReusedMaterials => 'Reused materials';

  @override
  String get supplierTotalMaterials => 'Total materials';

  @override
  String get supplierAvailableMaterials => 'Available materials';

  @override
  String get supplierReservedMaterials => 'Reserved materials';

  @override
  String get supplierTotalMaterialViews => 'Total material views';

  @override
  String get supplierTotalMaterialLikes => 'Total material likes';

  @override
  String get supplierFollowers => 'Followers';

  @override
  String get supplierRecentReservationRequests => 'Recent reservation requests';

  @override
  String get supplierNoReservationRequestsYet => 'No reservation requests yet.';

  @override
  String get supplierMostViewedMaterial => 'Most viewed material';

  @override
  String get supplierSupplierEngagement => 'Supplier engagement';

  @override
  String get supplierAccountTotals => 'Account totals';

  @override
  String get supplierNoViewedMaterialsYet => 'No viewed materials yet.';

  @override
  String get supplierHighDemandMaterials => 'High demand materials';

  @override
  String get supplierMaterialsWithActiveReservationInterest =>
      'Materials with active reservation interest.';

  @override
  String get supplierNoHighDemandMaterialsYet =>
      'No high-demand materials yet.';

  @override
  String get supplierViewAllRequests => 'View all requests';

  @override
  String get supplierUnknownLearner => 'Unknown learner';

  @override
  String get supplierOperationsSnapshot => 'Operations snapshot';

  @override
  String supplierRequesterStatusDateQtyQuantity(
    String requester,
    String status,
    String date,
    String quantity,
  ) {
    return '$requester · $status · $date · qty $quantity';
  }

  @override
  String supplierCountViews(String count) {
    return '$count views';
  }

  @override
  String get supplierSelectMaterialConditionBeforeVerifyingThe =>
      'Select material condition before verifying the price.';

  @override
  String supplierReferenceMaxCurrencysymbolBasemaxConditionConditionlabe(
    String currencySymbol,
    String baseMax,
    String conditionLabel,
    String adjustedMax,
  ) {
    return 'Reference max: $currencySymbol$baseMax · Condition: $conditionLabel · Adjusted max: $currencySymbol$adjustedMax';
  }

  @override
  String get supplierSomeMaterialsAreGettingStrongDemand =>
      'Some materials are getting strong demand.';

  @override
  String get supplierYourMaterialsAreGettingViewsImprove =>
      'Your materials are getting views. Improve titles/images to increase engagement.';

  @override
  String get supplierAddYourFirstMaterialToStart =>
      'Add your first material to start receiving requests.';

  @override
  String get supplierReservationStatus => 'Reservation status';

  @override
  String get supplierMaterialsStatus => 'Materials status';

  @override
  String get supplierRecentActivity => 'Recent activity';

  @override
  String get supplierCuratedHighlightsFromYourLatestOperations =>
      'Curated highlights from your latest operations';

  @override
  String get supplierViewAllActivity => 'View all activity';

  @override
  String get supplierActionableInsights => 'Actionable insights';

  @override
  String get supplierRecommendedNextStepsBasedOnYour =>
      'Recommended next steps based on your current supplier activity.';

  @override
  String get supplierRequestsNeedAttention => 'Requests need attention';

  @override
  String get supplierNoPendingRequestsRightNow =>
      'No pending requests right now.';

  @override
  String get supplierReviewRequests => 'Review requests';

  @override
  String get supplierPickupReadiness => 'Pickup readiness';

  @override
  String get supplierPickupLocationIsSetSelfPickup =>
      'Pickup location is set. Self pickup is enabled.';

  @override
  String get supplierAddOrConfirmYourPickupLocation =>
      'Add or confirm your pickup location so learners know where to collect materials.';

  @override
  String get supplierCompleteYourSupplierProfileAndPickup =>
      'Complete your supplier profile and pickup location to start accepting requests.';

  @override
  String get supplierUpdateProfile => 'Update profile';

  @override
  String get supplierGrowReuse => 'Grow reuse';

  @override
  String get supplierYouHaveActiveListingsReadyFor =>
      'You have active listings ready for learners. Completed pickups will increase reuse impact.';

  @override
  String get supplierReuseActivityIsStartingKeepMaterials =>
      'Reuse activity is starting. Keep materials updated to improve requests.';

  @override
  String get supplierListMaterialsToStartBuildingReuse =>
      'List materials to start building reuse impact when learners complete pickups.';

  @override
  String get supplierViewMaterials => 'View materials';

  @override
  String get supplierAllCaughtUpNewLearnerRequests =>
      'All caught up. New learner requests and pickup updates will appear here.';

  @override
  String get supplierNoRecentActivityYet => 'No recent activity yet.';

  @override
  String get supplierCheckNotifications => 'Check notifications';

  @override
  String get supplierOpenPickupSchedule => 'Open pickup schedule';

  @override
  String get supplierEditProfile => 'Edit profile';

  @override
  String get supplierSupplierHub => 'Supplier Hub';

  @override
  String get supplierShareUnusedPartsReduceWasteAnd =>
      'Share unused parts, reduce waste, and help learners build faster.';

  @override
  String supplierPickupCity(String city) {
    return 'Pickup: $city';
  }

  @override
  String supplierPickupCityArea(String city, String area) {
    return 'Pickup: $city, $area';
  }

  @override
  String get supplierNoMaterialsListedYet => 'No materials listed yet';

  @override
  String get supplierStartBySharingUnusedPartsProject =>
      'Start by sharing unused parts, project leftovers, or surplus components.';

  @override
  String get supplierCompleteYourSupplierProfile =>
      'Complete your supplier profile';

  @override
  String get supplierAddYourPublicSupplierNameAnd =>
      'Add your public supplier name and pickup location before listing materials.';

  @override
  String get supplierCompleteProfile => 'Complete profile';

  @override
  String get supplierWeCouldNotLoadYourSupplier =>
      'We could not load your supplier dashboard.';

  @override
  String get supplierPleaseCheckYourConnectionAndTry =>
      'Please check your connection and try again.';

  @override
  String get supplierReuseImpact => 'Reuse impact';

  @override
  String supplierCountReusedQuantityUnits(String count, String quantity) {
    return '$count reused · $quantity units';
  }

  @override
  String get supplierImpactIsCalculatedFromCompletedReuse =>
      'Impact is calculated from completed reuse data.';

  @override
  String get supplierProjectImpact => 'Project impact';

  @override
  String get supplierYourMaterialsHelpedLearnersCompleteReal =>
      'Your materials helped learners complete real project components.';

  @override
  String get supplierYourCompletedProjectImpactWillAppear =>
      'Your completed project impact will appear here when learners finish components using your materials.';

  @override
  String get supplierProjectsSupported => 'Projects supported';

  @override
  String get supplierComponentsCompleted => 'Components completed';

  @override
  String get supplierLearnerBuildsHelped => 'Learner builds helped';

  @override
  String get supplierRecentSupportedProjects => 'Recent supported projects';

  @override
  String get supplierNoReviewsYet => 'No reviews yet';

  @override
  String get supplierRating => 'Rating';

  @override
  String supplierCountReviews(String count) {
    return '$count reviews';
  }

  @override
  String get supplierMaterialLifecycle => 'Material lifecycle';

  @override
  String get supplierListed => 'Listed';

  @override
  String get supplierActionNeeded => 'Action needed';

  @override
  String get supplierResolved => 'Resolved';

  @override
  String supplierNoFilterlabelNotifications(String filterLabel) {
    return 'No $filterLabel notifications.';
  }

  @override
  String get supplierWeCouldNotLoadNotifications =>
      'We could not load notifications.';

  @override
  String get supplierNoActionAvailableForThisItem =>
      'No action available for this item.';

  @override
  String get supplierCouldNotOpenListingTryAgain =>
      'Could not open listing. Try again from Notifications.';

  @override
  String get supplierApproved => 'Approved';

  @override
  String supplierMaxFormatnisamountMaxNisUnit(String max, String unit) {
    return 'Max $max NIS/$unit';
  }

  @override
  String get supplierEditListing => 'Edit listing';

  @override
  String get supplierEditPrice => 'Edit price';

  @override
  String get supplierReviewRequest => 'Review request';

  @override
  String get supplierChoosePickupWindow => 'Choose pickup window';

  @override
  String get supplierOpenMaterial => 'Open material';

  @override
  String get supplierOpenProfile => 'Open profile';

  @override
  String get supplierSupplierActive => 'Supplier active';

  @override
  String get supplierPickupEnabled => 'Pickup enabled';

  @override
  String get supplierNisListings => 'NIS listings';

  @override
  String get supplierPendingAcceptedAndCompletedRequests =>
      'Pending, accepted, and completed requests';

  @override
  String get supplierInventoryBreakdownAcrossLifecycleStates =>
      'Inventory breakdown across lifecycle states';

  @override
  String get supplierAcceptedPickups => 'Accepted pickups';

  @override
  String get supplierCompletedReuse => 'Completed reuse';

  @override
  String get supplierAcceptedHandovers => 'Accepted handovers';

  @override
  String get supplierReservationActivityWillAppearHereOnce =>
      'Reservation activity will appear here once requests arrive.';

  @override
  String get supplierReservedPending => 'Reserved / pending';

  @override
  String get supplierMaterialStatusBreakdownWillAppearAfter =>
      'Material status breakdown will appear after your first listing.';

  @override
  String get supplierPendingRequestWaiting => 'Pending request waiting';

  @override
  String get supplierNextScheduledPickup => 'Next scheduled pickup';

  @override
  String supplierAcceptedPickupWithName(String name) {
    return 'Accepted pickup with $name';
  }

  @override
  String get supplierLatestCompletedReuse => 'Latest completed reuse';

  @override
  String get supplierChooseSupplierType => 'Choose supplier type';

  @override
  String get supplierChoosePhotosFromYourDevice =>
      'Choose photos from your device';

  @override
  String get supplierMaterialCouldNotBeListed =>
      'Material could not be listed.';

  @override
  String get supplierChooseACategoryFirst => 'Choose a category first.';

  @override
  String get supplierEnterAMaterialNameFirst => 'Enter a material name first.';

  @override
  String get supplierEnterAValidQuantityAndPrice =>
      'Enter a valid quantity and price.';

  @override
  String get supplierPriceReviewRequestFailed => 'Price review request failed.';

  @override
  String get supplierSavedListingDraftWasNotFound =>
      'Saved listing draft was not found.';

  @override
  String get supplierCategoryApprovedContinueYourListing =>
      'Category approved. Continue your listing.';

  @override
  String get supplierContinueEditingYourSavedListingDraft =>
      'Continue editing your saved listing draft.';

  @override
  String get supplierContinueYourListingFromWhereYou =>
      'Continue your listing from where you stopped.';

  @override
  String get supplierCategoryRequestSubmittedYourListingDraft =>
      'Category request submitted. Your listing draft was saved. You can continue after admin approval.';

  @override
  String get supplierCategoryRequestSubmittedYourListingDraft2 =>
      'Category request submitted. Your listing draft was saved.';

  @override
  String get supplierPriceReviewSubmittedAGeminiAssisted =>
      'Price review submitted. A Gemini-assisted price suggestion was generated for admin review.';

  @override
  String supplierPriceVerificationFailedError(String error) {
    return 'Price verification failed: $error';
  }

  @override
  String get supplierSubmitPriceReview => 'Submit price review';

  @override
  String get supplierPleaseClarifyTheMaterialName =>
      'Please clarify the material name';

  @override
  String get supplierDidYouMeanOneOfThese => 'Did you mean one of these?';

  @override
  String supplierMatchedPriceReferenceLabel(String label) {
    return 'Matched price reference: $label';
  }

  @override
  String supplierMaximumAllowedUnitPriceSymbolPrice(
    String symbol,
    String price,
  ) {
    return 'Maximum allowed unit price: $symbol$price';
  }

  @override
  String supplierMaximumAllowedUnitPriceSymbolPrice2(
    String symbol,
    String price,
    String unit,
  ) {
    return 'Maximum allowed unit price: $symbol$price per $unit';
  }

  @override
  String supplierApprovedUnitUnit(String unit) {
    return 'Approved unit: $unit';
  }

  @override
  String get supplierPriceReviewIsRequiredBeforePaid =>
      'Price review is required before paid publishing. A Gemini-assisted price suggestion will be generated for admin review.';

  @override
  String get supplierPriceIsAboveTheAllowedLimit =>
      'Price is above the allowed limit';

  @override
  String get supplierPriceBlocked => 'Price blocked';

  @override
  String get supplierMyMaterials2 => 'My materials';

  @override
  String get supplierIncomingRequests2 => 'Incoming requests';

  @override
  String get supplierCurrentlyVisibleToLearners =>
      'Currently visible to learners';

  @override
  String get supplierWaitingForYourResponse => 'Waiting for your response';

  @override
  String get supplierAction => 'Action';

  @override
  String get supplierPickup => 'Pickup';

  @override
  String get supplierListReusableParts => 'List reusable parts';

  @override
  String get supplierRespondToLearners => 'Respond to learners';

  @override
  String get supplierUpdatesActions => 'Updates & actions';

  @override
  String get supplierLoadingIncomingRequests => 'Loading incoming requests…';

  @override
  String get supplierWeCouldNotLoadRequests => 'We could not load requests.';

  @override
  String get supplierRequestAccepted => 'Request accepted.';

  @override
  String get supplierCouldNotAcceptTheRequest =>
      'Could not accept the request.';

  @override
  String get supplierRequestDeclined => 'Request declined.';

  @override
  String get supplierCouldNotDeclineTheRequest =>
      'Could not decline the request.';

  @override
  String get supplierPickupMarkedAsCompleted => 'Pickup marked as completed.';

  @override
  String get supplierCouldNotMarkPickupAsCompleted =>
      'Could not mark pickup as completed.';

  @override
  String get supplierNeedsLearnerConfirmation => 'Needs learner confirmation';

  @override
  String get supplierNeedsLearner => 'Needs learner';

  @override
  String get supplierDeclined => 'Declined';

  @override
  String get supplierNoRequestsYet => 'No requests yet.';

  @override
  String get supplierNoRequestsMatchThisFilter =>
      'No requests match this filter.';

  @override
  String get supplierNoPendingRequests => 'No pending requests';

  @override
  String get supplierNoAcceptedPickupsYet => 'No accepted pickups yet.';

  @override
  String get supplierNoDeclinedRequests => 'No declined requests.';

  @override
  String get supplierNoCompletedPickupsYet => 'No completed pickups yet.';

  @override
  String get supplierNewLearnerRequestsWillAppearHere =>
      'New learner requests will appear here.';

  @override
  String get supplierAcceptedRequestsWithPickupWindowsWill =>
      'Accepted requests with pickup windows will show here.';

  @override
  String get supplierRequestsYouDeclineWillBeListed =>
      'Requests you decline will be listed here.';

  @override
  String get supplierFinishedPickupsWillAppearHere =>
      'Finished pickups will appear here.';

  @override
  String get supplierNoLearnerNote => 'No learner note.';

  @override
  String get supplierSelfPickup => 'Self pickup';

  @override
  String supplierPickupWindow2(String window) {
    return 'Pickup: $window';
  }

  @override
  String get supplierNoRequestsWaitingForLearner =>
      'No requests waiting for learner';

  @override
  String get supplierNoCancelledRequests => 'No cancelled requests';

  @override
  String get supplierReservationsAwaitingLearnerConfirmationAppearHere =>
      'Reservations awaiting learner confirmation appear here.';

  @override
  String get supplierCancelledReservationsWillAppearHere =>
      'Cancelled reservations will appear here.';

  @override
  String get supplierWaitingForSupplier => 'Waiting for supplier';

  @override
  String get supplierLoadingPickupSchedule => 'Loading pickup schedule…';

  @override
  String get supplierWeCouldNotLoadPickupSchedule =>
      'We could not load pickup schedule.';

  @override
  String get supplierNoPickupsScheduledYet => 'No pickups scheduled yet.';

  @override
  String get supplierNoPickupsMatchThisFilter =>
      'No pickups match this filter.';

  @override
  String get supplierMarkCompleted => 'Mark completed';

  @override
  String get supplierUpcoming => 'Upcoming';

  @override
  String get supplierPast => 'Past';

  @override
  String get supplierToday => 'Today';

  @override
  String get supplierDone => 'Done';

  @override
  String get supplierNoPickupsScheduledForToday =>
      'No pickups scheduled for today.';

  @override
  String get supplierNoUpcomingPickups => 'No upcoming pickups.';

  @override
  String get supplierNoPickupScheduleYet => 'No pickup schedule yet.';

  @override
  String get supplierCreateYourProfile => 'Create your profile';

  @override
  String get supplierUpdateYourPublicIdentityAndPickup =>
      'Update your public identity and pickup settings.';

  @override
  String get supplierUpdateHowLearnersDiscoverYouAnd =>
      'Update how learners discover you and where materials can be collected.';

  @override
  String get supplierPublicSupplierDetails => 'Public supplier details';

  @override
  String get supplierTheseDetailsAppearOnYourPublic =>
      'These details appear on your public supplier profile.';

  @override
  String get supplierPublicSupplierName => 'Public supplier name';

  @override
  String get supplierHowLearnersWillSeeYou => 'How learners will see you';

  @override
  String get supplierAboutYourMaterials => 'About your materials';

  @override
  String get supplierShareTheMaterialTypesYouUsually =>
      'Share the material types you usually offer.';

  @override
  String get supplierDefaultPickupArea => 'Default pickup area';

  @override
  String get supplierUseAGeneralPickupAreaExact =>
      'Use a general pickup area. Exact addresses stay hidden until needed.';

  @override
  String get supplierChooseManually => 'Choose manually';

  @override
  String get supplierPickupLocationSelectionMethod =>
      'Pickup location selection method';

  @override
  String get supplierEnterTheAddressDetailsOrMove =>
      'Enter the address details or move the map pin to choose the exact pickup location.';

  @override
  String get supplierLocationSelected => 'Location selected';

  @override
  String get supplierFindingAddress => 'Finding address…';

  @override
  String get supplierRefreshCurrentLocation => 'Refresh current location';

  @override
  String get supplierOptionalAddressDetails => 'Optional address details';

  @override
  String get supplierCoordinatesAreTheSourceOfTruth =>
      'Coordinates are the source of truth. These fields help learners find you.';

  @override
  String get supplierPalestine => 'Palestine';

  @override
  String get supplierNeighborhoodOrDistrict => 'Neighborhood or district';

  @override
  String get supplierAddressLine => 'Address line';

  @override
  String get supplierStreetOrBuildingKeptPrivate =>
      'Street or building (kept private)';

  @override
  String get supplierLocationPrivacy => 'Location privacy';

  @override
  String get supplierSetYourExactPickupLocationYour =>
      'Set your exact pickup location. Your visibility settings control what learners can see.';

  @override
  String get supplierLocationVisibility => 'Location visibility';

  @override
  String get supplierPublicArea => 'Public area';

  @override
  String get supplierOrderOnly => 'Order only';

  @override
  String get supplierPrivate => 'Private';

  @override
  String get supplierShowAsApproximate => 'Show as approximate';

  @override
  String get supplierLearnersSeeAGeneralAreaNot =>
      'Learners see a general area, not an exact pin.';

  @override
  String get supplierOrganizationDetails => 'Organization details';

  @override
  String get supplierForWorkshopsFactoriesAndEducationalInstitutions =>
      'For workshops, factories, and educational institutions only.';

  @override
  String get supplierOrganizationName => 'Organization name';

  @override
  String get supplierLegalOrPublicOrganizationName =>
      'Legal or public organization name';

  @override
  String get supplierContactPerson => 'Contact person';

  @override
  String get supplierOptionalContactName => 'Optional contact name';

  @override
  String get supplierSaveProfile => 'Save profile';

  @override
  String get supplierSaving => 'Saving…';

  @override
  String get supplierDiscardChanges => 'Discard changes';

  @override
  String get supplierKeepYourPublicSupplierDetailsAccurate =>
      'Keep your public supplier details accurate, trustworthy, and easy for learners to understand.';

  @override
  String get supplierCreateYourSupplierProfileSoLearners =>
      'Create your supplier profile so learners know where and how to collect materials.';

  @override
  String get supplierProfileUnavailable => 'Profile unavailable';

  @override
  String get supplierProfileCouldNotBeSaved => 'Profile could not be saved.';

  @override
  String get supplierSupplierProfileUpdated => 'Supplier profile updated';

  @override
  String get supplierPleaseCaptureYourCurrentLocationBefore =>
      'Please capture your current location before saving.';

  @override
  String get supplierCouldNotGetCurrentLocationPlease =>
      'Could not get current location. Please try again or enter it manually.';

  @override
  String get supplierCurrentLocation => 'Current location';

  @override
  String get supplierWeFoundThisAddressFromYour =>
      'We found this address from your current location. Please review and edit if needed.';

  @override
  String get supplierCurrentLocationCapturedButAddressLookup =>
      'Current location captured, but address lookup failed. You can add city or area manually.';

  @override
  String get supplierCurrentLocationCapturedYouCanOptionally =>
      'Current location captured. You can optionally add city, area, or address details.';

  @override
  String get supplierChooseVisibility => 'Choose visibility';

  @override
  String get supplierWorkingDays => 'Working days';

  @override
  String get supplierMonTueWed => 'Mon, Tue, Wed';

  @override
  String get supplierOpenFrom => 'Open from';

  @override
  String get supplierOpenUntil => 'Open until';

  @override
  String get supplierUseASeparateOrganizationAddress =>
      'Use a separate organization address';

  @override
  String get supplierEnableThisWhenYourOrganizationAddress =>
      'Enable this when your organization address is different from the default pickup location.';

  @override
  String get supplierBusinessCountry => 'Business country';

  @override
  String get supplierBusinessCity => 'Business city';

  @override
  String get supplierBusinessArea => 'Business area';

  @override
  String get supplierBusinessAddressLine => 'Business address line';

  @override
  String get supplierCountryOptional => 'Country (optional)';

  @override
  String get supplierCityOptional => 'City (optional)';

  @override
  String get supplierAreaOptional => 'Area (optional)';

  @override
  String get supplierAddressLineOptional => 'Address line (optional)';

  @override
  String get supplierOptionalNeighborhoodOrDistrict =>
      'Optional neighborhood or district';

  @override
  String get supplierOptionalStreetOrBuilding => 'Optional street or building';

  @override
  String get supplierCompleteYourSupplierProfileFirst =>
      'Complete your supplier profile first.';

  @override
  String get supplierSupplierDetailsAreRequiredBeforeYou =>
      'Supplier details are required before you can publish reusable materials.';

  @override
  String get supplierGoToSupplierProfile => 'Go to Supplier Profile';

  @override
  String get supplierSetYourPickupLocationBeforeListing =>
      'Set your pickup location before listing materials.';

  @override
  String get supplierPickupLocationComesFromYourSupplier =>
      'Pickup location comes from your Supplier Profile and is used for every material in this step.';

  @override
  String get supplierEditSupplierProfile => 'Edit Supplier Profile';

  @override
  String get supplierMaterialCategoriesAreUnavailable =>
      'Material categories are unavailable.';

  @override
  String get supplierPleaseTryAgainAfterTheBackend =>
      'Please try again after the backend is reachable.';

  @override
  String get supplierSupplierProfileCouldNotLoad =>
      'Supplier profile could not load.';

  @override
  String get supplierPleaseRefreshOrCompleteYourProfile =>
      'Please refresh or complete your profile first.';

  @override
  String get supplierWhatAreYouListing => 'What are you listing?';

  @override
  String get supplierDescribeTheSurplusMaterialClearly =>
      'Describe the surplus material clearly.';

  @override
  String get supplierMaterialTypeName => 'Material type/name';

  @override
  String get supplierWaxMoldsArduinoUnoFabricScraps =>
      'Wax molds, Arduino Uno, fabric scraps...';

  @override
  String get supplierUseTheCommonMaterialTypeOr =>
      'Use the common material type or alias. We use this for matching and paid price checks.';

  @override
  String get supplierChooseACategoryFirstToSearch =>
      'Choose a category first to search reviewed material types.';

  @override
  String get supplierNoReviewedMaterialTypesFoundFree =>
      'No reviewed material types found. Free listings can continue with this name.';

  @override
  String get supplierReviewedPriceAvailable => 'Reviewed price available';

  @override
  String get supplierNoReviewedPrice => 'No reviewed price';

  @override
  String get supplierPaidListingsNeedAReviewedMaterial =>
      'Paid listings need a reviewed material type with an active price rule.';

  @override
  String supplierAliasesAliases(String aliases) {
    return 'Aliases: $aliases';
  }

  @override
  String get supplierListingTitle => 'Listing title';

  @override
  String get supplierUsedWaxMolds8Pieces => 'Used wax molds - 8 pieces';

  @override
  String get supplierDescription => 'Description';

  @override
  String get supplierDescribeConditionQuantityAndWhatIs =>
      'Describe condition, quantity, and what is included.';

  @override
  String get supplierChooseSource => 'Choose source';

  @override
  String get supplierCondition => 'Condition';

  @override
  String get supplierChooseCondition => 'Choose condition';

  @override
  String get supplierSuggestedUses => 'Suggested uses';

  @override
  String get supplierCandlesResinCastingCraftProjects =>
      'Candles, resin casting, craft projects.';

  @override
  String get supplierChooseTheClosestBroadCategory =>
      'Choose the closest broad category.';

  @override
  String get supplierBroadCategory => 'Broad category';

  @override
  String get supplierChooseCategory => 'Choose category';

  @override
  String get supplierCategoryIsRequired => 'Category is required';

  @override
  String get supplierPublishMaterial => 'Publish material';

  @override
  String get supplierPublishing => 'Publishing…';

  @override
  String get supplierHideCategoryRequest => 'Hide category request';

  @override
  String get supplierCannotFindYourCategory => 'Cannot find your category?';

  @override
  String get supplierCategoryRequest => 'Category request';

  @override
  String get supplierSendThisCategoryNameToAdmin =>
      'Send this category name to admin for approval. Your current listing form will be saved so you can continue later.';

  @override
  String get supplierRequestedCategoryName => 'Requested category name';

  @override
  String get supplierExampleCandleMakingTools => 'Example: Candle Making Tools';

  @override
  String get supplierSending => 'Sending…';

  @override
  String get supplierSendCategoryRequest => 'Send category request';

  @override
  String get supplierFreeListingsMayUseOtherWhen =>
      'Free listings may use Other when no reviewed category fits.';

  @override
  String get supplierPaidListingsCannotUseOtherUse =>
      'Paid listings cannot use Other. Use Cannot find your category? to request a reviewed category first.';

  @override
  String get supplierQuantityAndPricing => 'Quantity and pricing';

  @override
  String get supplierEnterThePriceForOneUnit =>
      'Enter the price for one unit. Quantity is handled separately.';

  @override
  String get supplierQuantity => 'Quantity';

  @override
  String get supplierUnit => 'Unit';

  @override
  String get supplierPiece => 'piece';

  @override
  String get supplierPricePerUnit => 'Price per unit (₪)';

  @override
  String get supplierVerifyPrice => 'Verify price';

  @override
  String supplierMaximumAllowedPricePerUnitIs(String unit, String max) {
    return 'Maximum allowed price per $unit is $max NIS.';
  }

  @override
  String get supplierPickupLocationComesFromYourSupplier2 =>
      'Pickup location comes from your Supplier Profile.';

  @override
  String get supplierOrganizationListingsUseYourProfilePickup =>
      'Organization listings use your profile pickup location.';

  @override
  String get supplierThisFixedPickupLocationFromYour =>
      'This fixed pickup location from your profile is used for every listing. Update it in Supplier Profile if your workshop or business address changes.';

  @override
  String get supplierEditPickupInProfile => 'Edit pickup in profile';

  @override
  String get supplierUseProfilePickupLocation => 'Use profile pickup location';

  @override
  String get supplierUseYourDefaultPickupAreaOr =>
      'Use your default pickup area, or set a different pickup point for this material only.';

  @override
  String get supplierMaterialPickupLocation => 'Material pickup location';

  @override
  String get supplierSetWhereLearnersShouldPickUp =>
      'Set where learners should pick up this material.';

  @override
  String get supplierEnterACityOrCaptureYour =>
      'Enter a city or capture your current location for pickup.';

  @override
  String get supplierPickupAllowed => 'Pickup allowed';

  @override
  String get supplierLearnersCanRequestSelfPickupFor =>
      'Learners can request self pickup for this material.';

  @override
  String get supplierDeliveryAllowed => 'Delivery allowed';

  @override
  String get supplierLearnersCanRequestInternalDeliveryAfter =>
      'Learners can request internal delivery after you accept a reservation.';

  @override
  String get supplierYes => 'Yes';

  @override
  String get supplierNo => 'No';

  @override
  String get supplierPickupNotes => 'Pickup notes';

  @override
  String get supplierPickupNearCampus => 'Pickup near campus.';

  @override
  String get supplierPaidListingsCannotUseOther =>
      'Paid listings cannot use Other.';

  @override
  String get supplierPaidListingsMustPassPriceVerification =>
      'Paid listings must pass price verification before publishing.';

  @override
  String get supplierNisOnly => 'NIS only';

  @override
  String get supplierFreeOtherAllowed => 'Free Other allowed';

  @override
  String get supplierPaidNeedsPriceVerification =>
      'Paid needs price verification';

  @override
  String get supplierCouldNotRestoreListingDraft =>
      'Could not restore listing draft';

  @override
  String get supplierBackToNotifications => 'Back to Notifications';

  @override
  String get supplierMaterialListedSuccessfully =>
      'Material listed successfully.';

  @override
  String get supplierAddAnotherMaterial => 'Add another material';

  @override
  String supplierTitleCategoryPrice(
    String title,
    String category,
    String price,
  ) {
    return '$title • $category • $price';
  }

  @override
  String get supplierNew => 'New';

  @override
  String get supplierLikeNew => 'Like new';

  @override
  String get supplierGood => 'Good';

  @override
  String get supplierUsed => 'Used';

  @override
  String get supplierNeedsRepair => 'Needs repair';

  @override
  String get supplierStudentLeftover => 'Student leftover';

  @override
  String get supplierWorkshopSurplus => 'Workshop surplus';

  @override
  String get supplierFactorySurplus => 'Factory surplus';

  @override
  String get supplierEducationalInstitution => 'Educational institution';

  @override
  String get supplierIndividualSupplier => 'Individual supplier';

  @override
  String get supplierStudentSupplier => 'Student supplier';

  @override
  String get supplierWorkshop => 'Workshop';

  @override
  String get supplierFactory => 'Factory';

  @override
  String get supplierVerified => 'Verified';

  @override
  String get supplierPendingVerification => 'Pending verification';

  @override
  String get supplierNotRequired => 'Not required';

  @override
  String get supplierAdminNote => 'Admin note';

  @override
  String get supplierSupplierType => 'Supplier type';

  @override
  String get supplierPickupCountryCity => 'Pickup country & city';

  @override
  String get supplierListingPreview => 'Listing preview';

  @override
  String get supplierProfileCompletion => 'Profile completion';

  @override
  String get supplierSelectedCoordinates => 'Selected coordinates';

  @override
  String supplierLatitudeValue(String value) {
    return 'Latitude: $value';
  }

  @override
  String supplierLongitudeValue(String value) {
    return 'Longitude: $value';
  }

  @override
  String supplierCompleteOfTotalEssentialsComplete(
    String complete,
    String total,
  ) {
    return '$complete of $total essentials complete';
  }

  @override
  String get supplierLearnerPreview => 'Learner preview';

  @override
  String get supplierHowLearnersMayDiscoverYourSupplier =>
      'How learners may discover your supplier profile later.';

  @override
  String get supplierPickupAreaNotSet => 'Pickup area not set';

  @override
  String get supplierSharesReusableMaterialsForStudentAnd =>
      'Shares reusable materials for student and maker projects.';

  @override
  String supplierLocationVisibilityVisibility(String visibility) {
    return 'Location visibility: $visibility';
  }

  @override
  String get supplierYourPublicName => 'Your public name';

  @override
  String supplierCurrentValue(String value) {
    return 'Current: $value';
  }

  @override
  String get supplierVerification => 'Verification';

  @override
  String get supplierVerificationIsReadOnlyForNow =>
      'Verification is read-only for now. Document upload and review workflows will come later.';

  @override
  String get supplierAccountSecurity => 'Account Security';

  @override
  String get supplierKeepYourAccountProtected => 'Keep your account protected.';

  @override
  String get supplierChangePassword => 'Change password';

  @override
  String get supplierEnterYourCurrentPasswordThenChoose =>
      'Enter your current password, then choose a new one.';

  @override
  String get supplierCurrentPassword => 'Current password';

  @override
  String get supplierConfirmNewPassword => 'Confirm new password';

  @override
  String get supplierUpdatePassword => 'Update password';

  @override
  String get supplierPasswordUpdatedSuccessfully =>
      'Password updated successfully.';

  @override
  String get supplierPasswordCouldNotBeUpdatedPlease =>
      'Password could not be updated. Please try again.';

  @override
  String get supplierThisFieldIsRequired => 'This field is required';

  @override
  String get supplierPasswordMustBeAtLeast8 =>
      'Password must be at least 8 characters.';

  @override
  String get supplierNewPasswordMustBeDifferentFrom =>
      'New password must be different from your current password.';

  @override
  String get supplierPasswordsDoNotMatch => 'Passwords do not match.';

  @override
  String get supplierUpcomingPickups => 'Upcoming pickups';

  @override
  String get supplierRecentMaterials => 'Recent materials';

  @override
  String get supplierMaterialPhotos => 'Material photos';

  @override
  String get supplierAdd1To5PhotosJpg =>
      'Add 1 to 5 photos. JPG, PNG, or WebP.';

  @override
  String get supplierAddAtLeastOneMaterialPhoto =>
      'Add at least one material photo before publishing.';

  @override
  String get supplierSelectedPhotos => 'Selected photos';

  @override
  String get supplierAddImages => 'Add images';

  @override
  String get supplierUploading => 'Uploading...';

  @override
  String supplierCountMaxPhotos(String count, String max) {
    return '$count/$max photos';
  }

  @override
  String get supplierPickupDetails => 'Pickup details';

  @override
  String get supplierSendMessage => 'Send message';

  @override
  String get supplierPickupWindowPassedChooseAFollow =>
      'Pickup window passed. Choose a follow-up action.';

  @override
  String get supplierReschedulePickup => 'Reschedule pickup';

  @override
  String get supplierReportNoShow => 'Report no-show';

  @override
  String get supplierNoShowReportAlreadySubmittedFor =>
      'No-show report already submitted for this reservation.';

  @override
  String get supplierFollowUpMessages => 'Follow-up messages';

  @override
  String get supplierNoFollowUpMessagesYet => 'No follow-up messages yet.';

  @override
  String get supplierWriteAShortFollowUpMessage =>
      'Write a short follow-up message…';

  @override
  String get supplierCouldNotLoadMessages => 'Could not load messages.';

  @override
  String get supplierCouldNotSendMessage => 'Could not send the message.';

  @override
  String get supplierNeedsFollowUp => 'Needs follow-up';

  @override
  String get supplierOverdue => 'Overdue';

  @override
  String get supplierThisWillCancelTheReservationAnd =>
      'This will cancel the reservation and release the material.';

  @override
  String get supplierSubmitANoShowReportFor =>
      'Submit a no-show report for admin review. This does not suspend the learner automatically.';

  @override
  String get supplierMarkPickupAsCompleted => 'Mark pickup as completed?';

  @override
  String get supplierThisWillMoveTheReservationTo =>
      'This will move the reservation to Completed and mark the material as reused.';

  @override
  String get supplierAcceptRequest => 'Accept request';

  @override
  String get supplierChooseAPickupWindowForThe =>
      'Choose a pickup window for the learner.';

  @override
  String get supplierDeclineRequest => 'Decline request';

  @override
  String get supplierYouCanAddAnOptionalReason =>
      'You can add an optional reason for the learner.';

  @override
  String get supplierReasonOptional => 'Reason (optional)';

  @override
  String get supplierPickupDate => 'Pickup date';

  @override
  String get supplierDriverPickupWindowFromSupplier =>
      'Driver pickup window from supplier';

  @override
  String get supplierByAcceptingYouAgreeToHand =>
      'By accepting, you agree to hand the material to the driver during this pickup window. We will check this against the learner’s preferred delivery windows.';

  @override
  String get supplierWeWillCheckThisAgainstThe =>
      'We will check this against the learner’s preferred delivery windows.';

  @override
  String supplierEarliestDeliveryAfterPickupTime(String time) {
    return 'Earliest delivery after pickup: $time';
  }

  @override
  String supplierConfirmedLearnerDeliveryWindowWindow(String window) {
    return 'Confirmed learner delivery window: $window';
  }

  @override
  String get supplierNoFeasibleLearnerDeliveryWindowThis =>
      'No feasible learner delivery window. This will wait for learner confirmation.';

  @override
  String get supplierThisScheduleCanBeAcceptedDirectly =>
      'This schedule can be accepted directly.';

  @override
  String get supplierThisDeliveryWindowIsNotFeasible =>
      'This delivery window is not feasible after supplier pickup and travel buffer. Learner confirmation will be required.';

  @override
  String get supplierSelectedLearnerPreferredWindow =>
      'Selected learner preferred window';

  @override
  String get supplierCustomProposedWindow => 'Custom proposed window';

  @override
  String get supplierLearnerPreferredPickupWindows =>
      'Learner preferred pickup windows';

  @override
  String get supplierLearnerPreferredDeliveryWindows =>
      'Learner preferred delivery windows';

  @override
  String get supplierDeliveryNote => 'Delivery note';

  @override
  String get supplierSelectedLearnerDeliveryWindowWillBe =>
      'Selected learner delivery window will be used when feasible.';

  @override
  String get supplierProposeCustomDeliveryWindow =>
      'Propose custom delivery window';

  @override
  String get supplierProposedLearnerDeliveryWindow =>
      'Proposed learner delivery window';

  @override
  String get supplierChooseTheProposedDeliveryDateAnd =>
      'Choose the proposed delivery date and time.';

  @override
  String get supplierProposedPickupTimeWaitingForLearner =>
      'Proposed pickup time — waiting for learner confirmation';

  @override
  String get supplierSchedulingConflictWaitingForLearnerConfirmation =>
      'Scheduling conflict — waiting for learner confirmation';

  @override
  String get supplierRequestSubmittedAwaitingLearnerConfirmation =>
      'Request submitted — awaiting learner confirmation';

  @override
  String get supplierStartTime => 'Start time';

  @override
  String get supplierEndTime => 'End time';

  @override
  String get supplierPickupNoteOptional => 'Pickup note (optional)';

  @override
  String get supplierTapToChoose => 'Tap to choose';

  @override
  String get supplierPriceVerified => 'Price verified';

  @override
  String get supplierVerifyPriceBeforePublishing =>
      'Verify price before publishing';

  @override
  String get supplierPriceVerificationRequired => 'Price verification required';

  @override
  String get supplierWithinApprovedCapVerifyPriceTo =>
      'Within approved cap — verify price to publish';

  @override
  String get supplierCategoryRequests => 'Category requests';

  @override
  String supplierApprovedAsName(String name) {
    return 'Approved as $name';
  }

  @override
  String get supplierWaitingForAdminApproval => 'Waiting for admin approval.';

  @override
  String get supplierContinueListing => 'Continue listing';

  @override
  String get supplierDefaultPickupLocation => 'Default pickup location';

  @override
  String get supplierVisibility => 'Visibility';

  @override
  String get supplierLocationCaptured => 'Location captured';

  @override
  String get supplierNoAreaSelectedYet => 'No area selected yet';

  @override
  String supplierVisibilityValue(String value) {
    return 'Visibility: $value';
  }

  @override
  String supplierTodayTodayUpcomingUpcomingCompletedCompleted(
    String today,
    String upcoming,
    String completed,
  ) {
    return 'Today: $today   Upcoming: $upcoming   Completed: $completed';
  }

  @override
  String supplierRequesterName(String name) {
    return 'Requester: $name';
  }

  @override
  String supplierQtyQty(String qty) {
    return 'Qty: $qty';
  }

  @override
  String get supplierChooseAPickupDateAndTime =>
      'Choose a pickup date and time window.';

  @override
  String get supplierSchedulePending => 'Schedule pending';

  @override
  String get supplierAcceptedReservationsWithPickupWindowsWill =>
      'Accepted reservations with pickup windows will show up here.';

  @override
  String get supplierRecentListingsWillAppearHereAfter =>
      'Recent listings will appear here after you add reusable materials.';

  @override
  String get supplierActivityFromReservationsAndNotificationsWill =>
      'Activity from reservations and notifications will collect here.';

  @override
  String get supplierOrganizationProfile => 'Organization profile';

  @override
  String get supplierRingTheWorkshopBellWhenYou =>
      'Ring the workshop bell when you arrive.';

  @override
  String get supplierAlreadyReservedForAnotherLearner =>
      'Already reserved for another learner.';

  @override
  String get supplierMaterialListingFoundationReady =>
      'Material listing foundation ready';

  @override
  String supplierCountMaterialCategoriesLoaded(String count) {
    return '$count material categories loaded.';
  }

  @override
  String get supplierLoadingCategories => 'Loading categories...';

  @override
  String get supplierCategoriesCouldNotBeLoadedYet =>
      'Categories could not be loaded yet.';

  @override
  String get supplierLoadingListingPolicy => 'Loading listing policy...';

  @override
  String get supplierListingPolicyUnavailable => 'Listing policy unavailable.';

  @override
  String get supplierUseYourCurrentLocationOrEnter =>
      'Use your current location or enter pickup details manually.';

  @override
  String get supplierTapTheMapToPlaceThe =>
      'Tap the map to place the pickup pin';

  @override
  String get supplierPickupPinSelectedOnMap => 'Pickup pin selected on map';

  @override
  String get supplierPickupType => 'Pickup type';

  @override
  String get supplierDate => 'Date';

  @override
  String get supplierTime => 'Time';

  @override
  String get supplierMaterialRequest => 'Material & request';

  @override
  String supplierPickupWindowRange(String range) {
    return 'Pickup window: $range';
  }

  @override
  String get supplierInstructions => 'Instructions';

  @override
  String get supplierNoPickupInstructions => 'No pickup instructions.';

  @override
  String get supplierNoDeclineReasonProvided => 'No decline reason provided.';

  @override
  String get supplierThisRequestExpiredBecauseYouDid =>
      'This request expired because you did not accept or decline in time.';

  @override
  String get supplierSupplierNote => 'Supplier note';

  @override
  String get supplierLearnerMessage => 'Learner message';

  @override
  String get supplierCover => 'Cover';

  @override
  String get supplierDismiss => 'Dismiss';

  @override
  String get supplierAccountApprovedBanner =>
      'Your supplier account has been approved. You can now publish materials.';

  @override
  String get supplierWaitingForAdminApprovalPublish =>
      'Your supplier account is waiting for admin approval. You can publish materials after approval.';

  @override
  String get supplierCommonSupplierTasks => 'Common supplier tasks';

  @override
  String get supplierActivityWillAppearAsLearners =>
      'Activity will appear as learners request and collect your materials.';

  @override
  String supplierPendingReservationsWaitingResponse(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'You have $count pending reservations waiting for a response.',
      one: 'You have 1 pending reservation waiting for a response.',
    );
    return '$_temp0';
  }

  @override
  String supplierCountRequestsNeedResponse(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count requests need your response.',
      one: '1 request needs your response.',
    );
    return '$_temp0';
  }

  @override
  String supplierCountReservationsCompleted(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count reservations completed successfully.',
      one: '1 reservation completed successfully.',
    );
    return '$_temp0';
  }

  @override
  String get supplierBasicInformation => 'Basic information';

  @override
  String get supplierTellLearnersWhatMaterial =>
      'Tell learners what material you are offering.';

  @override
  String get supplierWhyExistingCategoriesDoNotFit =>
      'Why existing categories do not fit';

  @override
  String get supplierExplainMaterialKindAndWhy =>
      'Explain what kind of material this is and why none of the current categories work.';

  @override
  String get supplierMaterialTypeSlashName => 'Material type / name';

  @override
  String get supplierSearchOrTypeMaterialName => 'Search or type material name';

  @override
  String get supplierClearSpecificTitlesHelp =>
      'Clear, specific titles help learners understand your item.';

  @override
  String get supplierIncludeDetailsHelpLearners =>
      'Include details that help learners decide whether it fits their project.';

  @override
  String get supplierSetQuantityAndPrice =>
      'Set how much is available and the price.';

  @override
  String get supplierPickupAndDelivery => 'Pickup and delivery';

  @override
  String get supplierSetHowLearnersReceive =>
      'Set how learners can receive this material.';

  @override
  String get supplierPhotosSectionSubtitle =>
      'Add photos to help learners see the material clearly.';

  @override
  String get supplierChecklist => 'Checklist';

  @override
  String get supplierReadyToPublish => 'Ready to publish';

  @override
  String get supplierChooseCategoryChecklist => 'Choose a category';

  @override
  String get supplierEnterMaterialTypeChecklist => 'Enter material type/name';

  @override
  String get supplierEnterListingTitleChecklist => 'Enter listing title';

  @override
  String get supplierAddDescriptionChecklist => 'Add description';

  @override
  String get supplierSetConditionChecklist => 'Set condition';

  @override
  String get supplierAddQuantityUnitChecklist => 'Add quantity and unit';

  @override
  String get supplierSelectFreeOrPriceChecklist =>
      'Select Free or enter a valid price';

  @override
  String get supplierVerifyPaidPriceChecklist => 'Verify the paid price';

  @override
  String get supplierChooseFulfillmentChecklist =>
      'Choose at least one fulfillment option';

  @override
  String get supplierAddPhotoChecklist => 'Add at least one photo';

  @override
  String get supplierGeneralCategory => 'General';

  @override
  String get supplierImageUploadFailed => 'Image upload failed';

  @override
  String get supplierEnterMaterialNameBeforeCategory =>
      'Enter the material name before requesting a new category.';

  @override
  String get supplierDescribeMaterialForCategory =>
      'Describe the material so admin can review the category request.';

  @override
  String get supplierEnterRequestedCategoryName =>
      'Enter the requested category name.';

  @override
  String get supplierExplainWhyCategoriesDoNotFit =>
      'Explain why existing categories do not fit.';

  @override
  String get supplierEnterValidQuantityForMaterial =>
      'Enter a valid quantity for this material.';

  @override
  String get supplierEnterUnitForMaterial =>
      'Enter the unit for this material.';

  @override
  String get supplierCouldNotUploadImages =>
      'We could not upload the images. Please try again.';

  @override
  String get supplierCategoryStillPendingReview =>
      'Your category request is still pending admin review.';

  @override
  String get supplierCategoryNoLongerAvailable =>
      'The selected category is no longer available. Refresh categories and choose again.';

  @override
  String get supplierDetailsNotSavedComplete =>
      'Some material details were not saved. Please complete the missing fields.';

  @override
  String get supplierCouldNotLoadSavedDraft =>
      'Could not load saved listing draft. Please try again.';

  @override
  String supplierUseForListing(String name) {
    return 'Use $name for this listing.';
  }

  @override
  String supplierCategoryRejectedUseSuggested(String name) {
    return 'Your category request was rejected. Use $name for this listing.';
  }

  @override
  String get supplierCategoryRejectedChooseExisting =>
      'Your category request was rejected. Choose an existing category and continue.';

  @override
  String get supplierResolveCategoryBeforePriceReview =>
      'Resolve the category request before submitting price review.';

  @override
  String get supplierSelectValidCategoryBeforePriceReview =>
      'Please select a valid category before submitting price review.';

  @override
  String get supplierEnterMaterialNameBeforePriceReview =>
      'Enter material name before submitting price review.';

  @override
  String get supplierEnterDescriptionBeforePriceReview =>
      'Enter material description before submitting price review.';

  @override
  String get supplierQuantityUnitRequiredBeforePriceReview =>
      'Quantity and unit are required before submitting price review.';

  @override
  String get supplierEnterValidPaidPriceBeforePriceReview =>
      'Enter a valid paid price before submitting price review.';

  @override
  String get supplierEnterMaterialNameBeforePriceReview2 =>
      'Enter a material name before submitting price review.';

  @override
  String supplierPriceAcceptedMaxAllowed(String max) {
    return 'Price accepted. Maximum allowed price is $max NIS.';
  }

  @override
  String supplierMaxAllowedPriceEnterLess(String max) {
    return 'The maximum allowed price is $max NIS. Please enter $max NIS or less.';
  }

  @override
  String supplierMaxAllowedPricePerUnitEnterLess(String max, String unit) {
    return 'Maximum allowed price is $max NIS per $unit. Please enter $max NIS or less.';
  }

  @override
  String get supplierPaidMaterialNeedsPriceReview =>
      'This paid material needs admin price review before publishing.';

  @override
  String get supplierMaterialBeingPublished =>
      'This material is already being published. Please wait a moment.';

  @override
  String get supplierPublishAttemptMismatch =>
      'This publish attempt no longer matches the saved request. Reset the form or try again from a new Add Material page.';

  @override
  String get supplierSelectValidCategoryBeforePublishing =>
      'Please select a valid category before publishing.';

  @override
  String get supplierEnterNumberGreaterThanZero =>
      'Enter a number greater than zero';

  @override
  String supplierUnitPriceMustBeOrLess(String max) {
    return 'Unit price must be $max NIS or less.';
  }

  @override
  String get supplierListingTitleHintExample =>
      'e.g., Half-Size Breadboard Kits (Spare Batch)';

  @override
  String get supplierInventoryOverview => 'Inventory overview';

  @override
  String get supplierMonitorMaterialAvailability =>
      'Monitor your material availability, requests, and listing status.';

  @override
  String get supplierClearSearch => 'Clear search';

  @override
  String get supplierResetFilters => 'Reset filters';

  @override
  String get supplierReset => 'Reset';

  @override
  String get supplierClearAll => 'Clear all';

  @override
  String get supplierMaterialsSection => 'Materials';

  @override
  String supplierShownOfTotal(int shown, int total) {
    return '$shown shown of $total';
  }

  @override
  String get supplierListingPreviewSubtitle =>
      'This is how your material will appear to learners.';

  @override
  String get supplierMaterialTitlePlaceholder =>
      'Material title will appear here';

  @override
  String get supplierShortDescriptionPlaceholder =>
      'Short description of your material will appear here.';

  @override
  String get supplierQuantityPlaceholder => 'Quantity will appear here';

  @override
  String get supplierPickupLocationPlaceholder =>
      'Pickup location will appear here';

  @override
  String get supplierPickupAvailable => 'Pickup available';

  @override
  String get supplierPickupUnavailable => 'Pickup unavailable';

  @override
  String get supplierInternalDeliveryAvailable => 'Internal delivery available';

  @override
  String get supplierDeliveryUnavailable => 'Delivery unavailable';

  @override
  String get supplierNoImageYet => 'No image yet';

  @override
  String get supplierAddPhotosToSeePreview => 'Add photos to see preview';

  @override
  String supplierYouCanAddUpToPhotos(int max) {
    return 'You can add up to $max photos.';
  }

  @override
  String supplierOnlyMorePhotosCanBeAdded(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Only $count more photos can be added.',
      one: 'Only 1 more photo can be added.',
    );
    return '$_temp0';
  }

  @override
  String supplierCouldNotReadImage(String name) {
    return 'Could not read \"$name\". Try another image.';
  }

  @override
  String supplierFileLargerThan5Mb(String name) {
    return '$name is larger than 5 MB.';
  }

  @override
  String supplierFileMustBeJpgPngWebp(String name) {
    return '$name must be JPG, PNG, or WebP.';
  }

  @override
  String get supplierReuseHistoryWillAppear =>
      'Reuse history will appear here after completed reservations.';

  @override
  String supplierAvailableOfTotal(String available, String total, String unit) {
    return 'Available: $available of $total $unit';
  }

  @override
  String get supplierAccessDenied => 'Access denied';

  @override
  String get supplierYouNeedASupplierAccountTo =>
      'You need a supplier account to access this area.';

  @override
  String get supplierSupplierAccessRequired => 'Supplier access required';

  @override
  String get supplierYouNeedASupplierRoleTo =>
      'You need a Supplier role to access the Supplier Portal.';

  @override
  String get supplierGoToHome => 'Go to home';

  @override
  String get supplierDeliveryRequested => 'Delivery requested';

  @override
  String get supplierAttentionNeedsYourResponse => 'Needs your response';

  @override
  String get supplierAttentionWaitingForLearner => 'Waiting for learner';

  @override
  String get supplierAttentionInProgress => 'In progress';

  @override
  String get supplierAttentionAdminReview => 'Admin review';

  @override
  String get supplierAttentionNoFurtherAction => 'No further action';

  @override
  String get supplierAttentionTerminal => 'Terminal';

  @override
  String supplierAttentionNextActor(String attention, String actor) {
    return '$attention · Next: $actor';
  }

  @override
  String get supplierNextActorAdmin => 'Admin';

  @override
  String get supplierNextActorSystem => 'System';

  @override
  String get supplierNextActorNone => 'No actor';

  @override
  String get supplierRecoveryNextAdmin => 'Recovery · Next: Admin';

  @override
  String get supplierWorkflowInitialDecision => 'Initial decision';

  @override
  String get supplierWorkflowScheduling => 'Scheduling';

  @override
  String get supplierWorkflowSelfPickup => 'Self pickup';

  @override
  String get supplierWorkflowDelivery => 'Delivery';

  @override
  String get supplierWorkflowRecovery => 'Recovery';

  @override
  String get supplierCompletedSuccessfully => 'Completed successfully';

  @override
  String get supplierNoResponseBeforeDeadline =>
      'No response before the deadline';

  @override
  String get supplierCompletedFulfillment => 'Completed fulfillment';

  @override
  String get supplierCancelledBeforeFulfillment =>
      'Cancelled before fulfillment';

  @override
  String get supplierExpiredBeforeFulfillment => 'Expired before fulfillment';

  @override
  String get supplierClosedAfterNoShow => 'Closed after no-show';

  @override
  String get supplierRejectedBeforeFulfillment => 'Rejected before fulfillment';

  @override
  String get supplierFinalReservationOutcome => 'Final reservation outcome';

  @override
  String get supplierTerminalVerbCancelled => 'cancelled';

  @override
  String get supplierTerminalVerbExpired => 'expired';

  @override
  String get supplierTerminalVerbCompleted => 'completed';

  @override
  String get supplierTerminalVerbClosed => 'closed';

  @override
  String get supplierActionAcceptLearnerTime => 'Accept learner time';

  @override
  String get supplierActionCompleteSelfPickup => 'Complete self pickup';

  @override
  String get supplierProposeNewTime => 'Propose different time';

  @override
  String get supplierAcceptNewTime => 'Accept new time';

  @override
  String get supplierActionMarkLearnerNoShow => 'Mark learner no-show';

  @override
  String get supplierActionReportIncident => 'Report incident';

  @override
  String get supplierActionReportNoDriver => 'Report no driver';

  @override
  String get supplierActionMarkPickupExpired => 'Mark pickup expired';

  @override
  String get supplierActionReportDriverNoShow => 'Report driver no-show';

  @override
  String get supplierActionSubmitRecoveryWindow =>
      'Submit recovery pickup window';

  @override
  String get supplierConfirmPickup => 'Confirm pickup';

  @override
  String get supplierSubmitPickupWindow => 'Submit pickup window';

  @override
  String get supplierReviewReschedule => 'Review reschedule';

  @override
  String get supplierReportToAdmin => 'Report to admin';

  @override
  String get supplierStatusFilterAwaitingLearner => 'Awaiting learner';

  @override
  String get supplierStatusFilterAwaitingSupplier => 'Awaiting supplier';

  @override
  String get supplierStatusFilterAwaitingResolution => 'Awaiting resolution';

  @override
  String get supplierNoShowReasonLearnerDidNotArrive =>
      'Learner did not arrive';

  @override
  String get supplierNoShowReasonRepeatedDelay => 'Repeated delay';

  @override
  String get supplierNoShowReasonWrongInformation => 'Wrong information';

  @override
  String get supplierNoShowReasonSafetyConcern => 'Safety or trust concern';

  @override
  String get supplierNoShowReasonOther => 'Other';

  @override
  String get supplierNotProposed => 'Not proposed';

  @override
  String supplierWindowUntil(String time) {
    return 'Until $time';
  }

  @override
  String supplierWindowFrom(String time) {
    return 'From $time';
  }

  @override
  String get supplierTomorrow => 'Tomorrow';

  @override
  String get supplierNeedsAttention => 'Needs attention';

  @override
  String get supplierOperationalOverview => 'Operational overview';

  @override
  String get supplierAllAttention => 'All attention';

  @override
  String get supplierAllFulfillment => 'All fulfillment';

  @override
  String get supplierAllStatuses => 'All statuses';

  @override
  String get supplierMoreFilters => 'More filters';

  @override
  String supplierFiltersCount(String count) {
    return 'Filters $count';
  }

  @override
  String get supplierDateRange => 'Date range';

  @override
  String get supplierSearchRequestsHint =>
      'Search material, learner, or reservation ID';

  @override
  String get supplierHistoryActive => 'Active';

  @override
  String get supplierHistoryTerminal => 'History';

  @override
  String supplierCompletedCount(String count) {
    return 'Completed $count';
  }

  @override
  String supplierClosedCount(String count) {
    return 'Closed $count';
  }

  @override
  String supplierShowingRange(String start, String end, String total) {
    return 'Showing $start–$end of $total';
  }

  @override
  String supplierShowingRangeRequests(String start, String end, String total) {
    return 'Showing $start–$end of $total requests';
  }

  @override
  String supplierActiveFiltersCount(String count) {
    return '$count filters';
  }

  @override
  String get supplierColumnRequest => 'Request';

  @override
  String get supplierColumnFulfillmentSchedule => 'Fulfillment & schedule';

  @override
  String get supplierColumnStatusAttention => 'Status & attention';

  @override
  String get supplierColumnDetails => 'Details';

  @override
  String supplierPerPage(String count) {
    return '$count per page';
  }

  @override
  String get supplierViewRequestDetails => 'View request details';

  @override
  String supplierViewRequestDetailsForMaterial(String material) {
    return 'View $material request details';
  }

  @override
  String get supplierNoConfirmedTimeYet => 'No confirmed time yet';

  @override
  String get supplierAdminRecoveryInProgress => 'Admin recovery in progress';

  @override
  String get supplierDeliveryHandledByDriver =>
      'This reservation is handled by delivery. The driver will mark it completed.';

  @override
  String get supplierMessagesWorkspaceNote =>
      'Request messages will remain available in the request workspace.';

  @override
  String get supplierNoFurtherActionRequired =>
      'No further action is required for this request.';

  @override
  String get supplierRequestDetails => 'Request details';

  @override
  String get supplierBackToIncomingRequests => 'Back to Incoming Requests';

  @override
  String get supplierAvailableActions => 'Available actions';

  @override
  String get supplierMore => 'More';

  @override
  String get supplierMarkLearnerNoShowTitle => 'Mark learner as no-show?';

  @override
  String get supplierMarkLearnerNoShowMessage =>
      'This will record the learner no-show for this reservation.';

  @override
  String get supplierMarkLearnerNoShowConfirm => 'Mark no-show';

  @override
  String get supplierCouldNotUpdateRequest => 'Could not update this request.';

  @override
  String get supplierRequestSummary => 'Request summary';

  @override
  String supplierLearnerLine(String name) {
    return 'Learner: $name';
  }

  @override
  String get supplierOriginalLearnerNote => 'Original learner note';

  @override
  String get supplierDeliveryAddressLabel => 'Delivery address';

  @override
  String supplierDeliveryAddressPrefix(String address) {
    return 'Delivery address: $address';
  }

  @override
  String get supplierSupplierProposal => 'Supplier proposal';

  @override
  String get supplierLearnerProposal => 'Learner proposal';

  @override
  String get supplierConfirmedPickupWindow => 'Confirmed pickup window';

  @override
  String get supplierScheduleNegotiation => 'Schedule & negotiation';

  @override
  String get supplierAdminInitiatedRecovery => 'Admin-initiated recovery';

  @override
  String get supplierPendingReschedule => 'Pending reschedule';

  @override
  String get supplierNoWindowProposed =>
      'No pickup or delivery window is currently proposed.';

  @override
  String get supplierSchedulingContext => 'Scheduling context';

  @override
  String supplierEarliestFeasibleDelivery(String time) {
    return 'Earliest feasible delivery: $time';
  }

  @override
  String get supplierNoWindowConfirmedPickup =>
      'No pickup or delivery window was confirmed for this request.';

  @override
  String supplierNoWindowConfirmedBeforeTerminal(String verb) {
    return 'No pickup window was confirmed before this request was $verb.';
  }

  @override
  String get supplierScheduleHistory => 'Schedule history';

  @override
  String get supplierFulfillmentAndDelivery => 'Fulfillment & delivery';

  @override
  String get supplierHandoverCodeAvailable => 'Code available';

  @override
  String get supplierFailureRecovery => 'Failure / recovery';

  @override
  String get supplierDeliveryNotCreated =>
      'Delivery has not been selected or created for this reservation.';

  @override
  String get supplierAttentionTitle => 'Attention';

  @override
  String get supplierAwaitingAdminResolution =>
      'This request is awaiting admin resolution. Supplier controls are read-only unless an available action is provided.';

  @override
  String get supplierIncidentAdminReview => 'Incident / admin review';

  @override
  String get supplierReportIdLabel => 'Report ID';

  @override
  String get supplierOperationalStateLabel => 'Operational state';

  @override
  String get supplierSupplierExplanation => 'Supplier explanation';

  @override
  String get supplierAdminReviewNote => 'Admin review note';

  @override
  String get supplierGroupContext => 'Group context';

  @override
  String get supplierItemsInGroup => 'Items in group';

  @override
  String get supplierGroupedReservationItem => 'Grouped reservation item';

  @override
  String get supplierMoreGroupItems => 'More items are available in the group.';

  @override
  String get supplierMessagesTitle => 'Messages';

  @override
  String supplierMessagesTitleWithCount(int count) {
    return 'Messages ($count)';
  }

  @override
  String get supplierNoMessagesYet => 'No messages yet.';

  @override
  String get supplierTypeMessageHint => 'Type a message…';

  @override
  String get supplierSendMessageTooltip => 'Send message';

  @override
  String get supplierYou => 'You';

  @override
  String get supplierReservationUpdated => 'Reservation updated';

  @override
  String supplierHistoryStatusChange(String from, String to) {
    return '$from → $to';
  }

  @override
  String get supplierRequestNotFound => 'Request not found';

  @override
  String get supplierRequestUnavailable => 'This request is unavailable.';

  @override
  String get supplierCouldNotLoadRequestTitle => 'Could not load request';

  @override
  String get supplierCouldNotLoadRequest =>
      'We could not load this request. Please try again.';

  @override
  String get supplierFulfillmentLabel => 'Fulfillment';

  @override
  String get supplierLearnerEmail => 'Learner email';

  @override
  String get supplierMethodLabel => 'Method';

  @override
  String get supplierDeliveryStatusLabel => 'Delivery status';

  @override
  String get supplierGroupLabel => 'Group';

  @override
  String get supplierHandoverLabel => 'Handover';

  @override
  String get supplierOutcomeLabel => 'Outcome';

  @override
  String get supplierGroupIdLabel => 'Group ID';

  @override
  String get supplierItemsLabel => 'Items';

  @override
  String get supplierConfirmedDeliveryWindow => 'Confirmed delivery window';

  @override
  String get supplierSupplierDeliveryPickupWindow =>
      'Supplier delivery pickup window';

  @override
  String get supplierNewWindowAwaiting =>
      'A new window is awaiting the next response.';

  @override
  String supplierActorRequestedReschedule(String actor) {
    return '$actor requested reschedule';
  }

  @override
  String supplierNextActorLine(String actor) {
    return 'Next actor: $actor';
  }

  @override
  String get supplierReservationHistory => 'Reservation history';

  @override
  String get supplierNoHistoryEvents => 'No history events were returned.';

  @override
  String get supplierWorkflowField => 'Workflow';

  @override
  String get supplierRescheduleReasonLabel => 'Reason';

  @override
  String get supplierRescheduleReasonHint =>
      'Why are you requesting a new time?';

  @override
  String get supplierSendRequest => 'Send request';

  @override
  String get supplierRescheduleRequestSent =>
      'Reschedule request sent to learner.';

  @override
  String get supplierChooseNewPickupWindow => 'Choose new pickup window';

  @override
  String get supplierPickupWindowSubmittedWaiting =>
      'Pickup window submitted. Waiting for driver again.';

  @override
  String get supplierNewPickupTimeAccepted => 'New pickup time accepted.';

  @override
  String get supplierReservationClosed => 'Reservation closed.';

  @override
  String get supplierReportToAdminTitle => 'Report to admin';

  @override
  String get supplierReportToAdminMessage =>
      'Submit a report for admin review. The reservation will be closed.';

  @override
  String get supplierReportAndClose => 'Report and close';

  @override
  String get supplierDescribeWhatHappened => 'Describe what happened';

  @override
  String get supplierNoteRequired => 'Note (required)';

  @override
  String get supplierSubmitReport => 'Submit report';

  @override
  String get supplierMarkPickupExpiredTitle => 'Mark pickup window expired';

  @override
  String get supplierMarkPickupExpiredMessage =>
      'No driver accepted this delivery before the supplier pickup window ended. This will close the delivery attempt and send the case to admin review.';

  @override
  String get supplierMarkExpired => 'Mark expired';

  @override
  String get supplierPickupExpiredAdminReview =>
      'Pickup window marked expired. Admin review is in progress.';

  @override
  String get supplierReportNoDriverTitle => 'Report no driver available';

  @override
  String get supplierReportNoDriverHint =>
      'Describe why no driver accepted this delivery';

  @override
  String get supplierNoDriverReported => 'No-driver case reported to admin.';

  @override
  String get supplierReportDriverNoShowTitle => 'Report driver no-show';

  @override
  String get supplierReportDriverNoShowHint =>
      'Describe what happened at supplier pickup';

  @override
  String get supplierDriverNoShowReported =>
      'Driver no-show reported to admin.';

  @override
  String get supplierPickupConfirmationCodeLabel => 'Pickup confirmation code';

  @override
  String get supplierPickupConfirmationCodeHint =>
      'Enter the pickup confirmation code the learner gives you when they receive the material.';

  @override
  String get supplierPickupConfirmationCodeError =>
      'Enter the 6-digit pickup code from the learner.';

  @override
  String get supplierDeliveryWindowMustStartFuture =>
      'Delivery window must start in the future.';

  @override
  String get supplierInboxRefreshFailed =>
      'We could not refresh incoming requests.';

  @override
  String get supplierEmptyAllCaughtUp => 'You are all caught up';

  @override
  String get supplierEmptyNoWaitingLearnerSubtitle =>
      'No requests currently need your response.';

  @override
  String get supplierEmptyNoWaitingLearner =>
      'No requests are waiting for learner confirmation.';

  @override
  String get supplierEmptyNoActiveFulfillment =>
      'No active pickups or deliveries.';

  @override
  String get supplierEmptyNoAdminReview =>
      'No requests are currently under admin review.';

  @override
  String get supplierEmptyNoTerminalHistory =>
      'No completed or closed requests found.';

  @override
  String get supplierEmptyNoFilterMatch =>
      'No requests match the selected filters.';

  @override
  String get supplierIncidentsDriverNotCompletedPickup =>
      'The assigned driver has not completed supplier pickup after the window ended. Report driver no-show so an admin can review.';

  @override
  String get supplierIncidentsNoDriverBeforeWindow =>
      'No driver accepted this delivery before the supplier pickup window ended. Report it so an admin can review next steps.';

  @override
  String get supplierIncidentsNoDriverWaitHint =>
      'No driver yet. You can report no driver available 30 minutes after the scheduled pickup window ends.';

  @override
  String get supplierIncidentsReportNoDriver => 'Report no driver available';

  @override
  String get supplierIncidentsReportDriverNoShow => 'Report driver no-show';

  @override
  String get supplierDriverHandoverCodeInstructions =>
      'Give this code to the driver after handing over the material.';

  @override
  String get supplierReportedToAdmin => 'Reported to admin';

  @override
  String supplierRequestLine(String id, String status) {
    return 'Request $id · $status';
  }

  @override
  String get actionContinue => 'Continue';

  @override
  String get checkStatus => 'Check status';

  @override
  String get about => 'About';

  @override
  String get review => 'Review';

  @override
  String get description => 'Description';

  @override
  String get document => 'Document';

  @override
  String get submitted => 'Submitted';

  @override
  String get organization => 'Organization';

  @override
  String get notSelected => 'Not selected';

  @override
  String get becomeSupplierTitle => 'Become a supplier';

  @override
  String get becomeSupplierSubtitle =>
      'Keep your learner access and add a supplier profile on the same account.';

  @override
  String get becomeSupplierOpenSupplierPortal => 'Open Supplier Portal';

  @override
  String becomeSupplierProgressSemantic(int step, int total) {
    return 'Become supplier progress, step $step of $total';
  }

  @override
  String get becomeSupplierSupplierTypeRequired => 'Supplier type is required';

  @override
  String get becomeSupplierSupplierNameRequired => 'Supplier name is required';

  @override
  String get becomeSupplierCityRequired => 'City is required';

  @override
  String get becomeSupplierSupplierNameLabel => 'Supplier name';

  @override
  String get becomeSupplierSupplierNameHint => 'How others will see you';

  @override
  String get becomeSupplierAboutDescriptionOptional =>
      'About / description (optional)';

  @override
  String get becomeSupplierAboutDescriptionHint =>
      'What kinds of materials do you usually share?';

  @override
  String get becomeSupplierLocationHelpText =>
      'City and area help learners understand where pickup usually happens. Exact pickup details can stay private until a reservation is accepted.';

  @override
  String get becomeSupplierPickupLocationNoteOptional =>
      'Pickup location note (optional)';

  @override
  String get becomeSupplierPickupLocationHint =>
      'Near university gate, workshop entrance, etc.';

  @override
  String get becomeSupplierWorkingHoursOptional => 'Working hours (optional)';

  @override
  String get becomeSupplierWorkingHoursHint => 'Mon-Fri 4pm-7pm';

  @override
  String get becomeSupplierPickupNotesHint =>
      'Call before pickup, bring student ID, etc.';

  @override
  String get becomeSupplierWorkshopsVerificationNote =>
      'Workshops, factories, and institutions require a separate verification flow.';

  @override
  String becomeSupplierReviewPickupLocation(String location) {
    return 'Pickup location: $location';
  }

  @override
  String becomeSupplierReviewWorkingHours(String hours) {
    return 'Working hours: $hours';
  }

  @override
  String becomeSupplierReviewPickupNotes(String notes) {
    return 'Pickup notes: $notes';
  }

  @override
  String get becomeSupplierStepSupplierTypeSubtitle =>
      'Choose how you will share materials as a supplier.';

  @override
  String get becomeSupplierStepProfileSubtitle =>
      'Tell others who you are and what you usually share.';

  @override
  String get becomeSupplierStepLocationSubtitle =>
      'Set the city and area where pickup usually happens.';

  @override
  String get becomeSupplierStepPickupDetailsSubtitle =>
      'Add optional pickup hours and notes for learners.';

  @override
  String get becomeSupplierStepVerificationSubtitle =>
      'Upload proof of your organization for admin review.';

  @override
  String get becomeSupplierStepReviewSubtitle =>
      'Review your supplier details, then open the Supplier Portal.';

  @override
  String get supplierStudentSupplierDescription =>
      'For students sharing extra parts or materials. No verification document.';

  @override
  String get supplierIndividualSupplierDescription =>
      'For personal surplus materials. No verification document.';

  @override
  String get supplierWorkshopSupplierDescription =>
      'For workshops or labs. Verification document required.';

  @override
  String get supplierFactorySupplierDescription =>
      'For factories or companies. Verification document required.';

  @override
  String get supplierEducationalInstitutionSupplierDescription =>
      'For schools, universities, or centers. Verification document required.';

  @override
  String get supplierChooseSupplierTypeFallback =>
      'Choose who owns the materials you will share.';

  @override
  String get completeSupplierProfileTitle => 'Complete your supplier profile';

  @override
  String get completeSupplierProfileSubtitle =>
      'Tell others what materials you share and where pickup works.';

  @override
  String get selectYourSupplierType => 'Select your supplier type';

  @override
  String get publicNameRequired => 'Public name is required';

  @override
  String get pickupAreaRequired => 'Pickup area is required';

  @override
  String get shortDescriptionOptional => 'Short description (optional)';

  @override
  String get pickupAreaLocationLabel => 'Pickup area / location';

  @override
  String get organizationSupplierVerificationNote =>
      'Organization suppliers are treated as supplier organizations and may need verification before listing materials.';

  @override
  String get individualSupplierCanSwitchNote =>
      'Student and individual suppliers can still switch back to learner mode after setup.';

  @override
  String get completeSupplierProfileFooterNote =>
      'You can start as an individual and update your supplier details later.';

  @override
  String get verificationDocument => 'Verification document';

  @override
  String get verificationDocumentRequired =>
      'Verification document is required';

  @override
  String get verificationFileSizeLimit => 'File must be 5MB or smaller';

  @override
  String get verificationAllowedFileTypes =>
      'Allowed file types: PDF, PNG, JPG, JPEG';

  @override
  String get verificationDocumentHint => 'PDF, PNG, JPG, or JPEG (max 5MB)';

  @override
  String get verificationDocumentUploadHint =>
      'Upload a document that proves your organization identity, such as a workshop license, factory document, or university/institution proof.';

  @override
  String get noFileSelected => 'No file selected';

  @override
  String get selectFile => 'Select file';

  @override
  String get changeFile => 'Change file';

  @override
  String get registrationDetailsIncomplete =>
      'Registration details are incomplete. Please start again.';

  @override
  String get switchToLearner => 'Switch to Learner';

  @override
  String get switchToSupplier => 'Switch to Supplier';

  @override
  String get becomeLearner => 'Become a Learner';

  @override
  String get organizationSupplierStaysInSupplierMode =>
      'Organization supplier accounts stay in supplier mode.';

  @override
  String get learnerMode => 'Learner mode';

  @override
  String get supplierMode => 'Supplier mode';

  @override
  String get supplierVerifySubmittedTitle => 'Supplier verification submitted';

  @override
  String get supplierVerifyLoadStatusFailed =>
      'We could not load your verification status.';

  @override
  String get supplierVerifyPendingSubtitle =>
      'Your supplier account is waiting for admin approval. You will be able to publish materials after your account is approved.';

  @override
  String get supplierVerifyStillWaitingApproval =>
      'Your supplier account is still waiting for admin approval.';

  @override
  String get supplierVerifyRejectedTitle => 'Supplier verification rejected';

  @override
  String get supplierVerifyChangesRequestedTitle => 'Changes requested';

  @override
  String get supplierVerifyStatusTitle => 'Supplier verification status';

  @override
  String get supplierVerifyRejectedBody =>
      'Your supplier verification was rejected. Publishing materials is blocked until your organization is approved.';

  @override
  String get supplierVerifyChangesRequestedBody =>
      'An admin requested changes to your verification submission. Update your document and resubmit for review.';

  @override
  String get supplierVerifyStatusBody =>
      'Publishing materials is blocked until your organization is approved by an admin.';

  @override
  String get supplierVerifyStatusRefreshed =>
      'Your verification status has been refreshed.';

  @override
  String get supplierVerifySelectDocumentToUpload =>
      'Select a verification document to upload.';

  @override
  String get resubmitVerification => 'Resubmit verification';

  @override
  String get chooseVerificationDocument => 'Choose verification document';

  @override
  String get supplierProfilePhotoUpdated => 'Profile photo updated';

  @override
  String get supplierCoverImageUpdated => 'Cover image updated';

  @override
  String get supplierDiscardChangesQuestion => 'Discard changes?';

  @override
  String get supplierUnsavedEditsWillBeLost =>
      'Your unsaved edits will be lost.';

  @override
  String get supplierKeepEditing => 'Keep editing';

  @override
  String get registerSupplierTypeControlsVerification =>
      'This controls verification requirements and how your material listings are introduced to requesters.';

  @override
  String get registerSupplierPublicNameHelp =>
      'Public name appears on material listings and reservation messages. Use a workshop, institution, or personal display name that requesters can recognize.';

  @override
  String get registerSupplierDisplayNameOptional =>
      'Supplier display name (optional)';

  @override
  String get registerSupplierUsesFullNameDefault =>
      'Uses your full name by default';

  @override
  String get registerSupplierShareMaterialsGoals =>
      'What do you want to accomplish by sharing materials?';

  @override
  String get registerSupplierBasicsSubtitle =>
      'Choose the supplier profile that matches who owns the materials and how it should appear publicly.';

  @override
  String get registerSupplierVerificationSubtitle =>
      'Organization suppliers need a document so admins can review the account before publishing materials.';

  @override
  String get registerSupplierReviewSupplierSubtitle =>
      'Review your supplier account and pickup area before creating it.';

  @override
  String get registerSupplierReviewBothSubtitle =>
      'Review your learner and supplier details before creating the account.';

  @override
  String get registerSupplierLocationBothSubtitle =>
      'Set the general pickup area for materials you share. Learner delivery details are handled later when needed.';

  @override
  String get registerSupplierLocationSubtitle =>
      'Set the general pickup area for materials you share.';

  @override
  String get registerSupplierNoVerificationRequired =>
      'No verification document is required for this supplier type.';

  @override
  String get registerSupplierNoVerificationBody =>
      'You can review your account details next and create the account without uploading a file.';

  @override
  String get registerAccountReadyUploadVerification =>
      'Your account is ready. Upload your verification document to continue.';

  @override
  String get registerSupplierSetupDescription =>
      'You will set supplier goals, pickup area, supplier type, public name, and verification when needed.';

  @override
  String get registerBothSupplierSetupDescription =>
      'You will set learner interests and learning level, plus supplier pickup and profile details.';

  @override
  String get registerSupplierLocationHelperBoth =>
      'This is the general pickup area for materials you share. It does not expose an exact address publicly, and learner delivery details stay separate.';

  @override
  String get registerSupplierLocationHelper =>
      'Suppliers need a city and area so requesters can understand pickup feasibility. Exact pickup details can stay private until a reservation or delivery is arranged.';

  @override
  String get registerSupplierReviewHelper =>
      'Supplier goals stay in onboarding only. The server receives your account, supplier profile, and pickup area.';

  @override
  String get registerBothReviewHelper =>
      'Goals stay in onboarding only. The server receives your account, learner profile, supplier profile, and pickup area.';

  @override
  String get retryVerification => 'Retry verification';

  @override
  String get conditionNew => 'New';

  @override
  String get conditionLikeNew => 'Like new';

  @override
  String get conditionGood => 'Good';

  @override
  String get conditionUsed => 'Used';

  @override
  String get conditionNeedsRepair => 'Needs repair';

  @override
  String get sourceTypeStudentLeftover => 'Student leftover';

  @override
  String get sourceTypeWorkshopSurplus => 'Workshop surplus';

  @override
  String get sourceTypeFactorySurplus => 'Factory surplus';

  @override
  String get sourceTypeEducationalInstitution => 'Educational institution';

  @override
  String get materialStatusAvailable => 'Available';

  @override
  String get materialStatusPendingReservation => 'Pending reservation';

  @override
  String get materialStatusReserved => 'Reserved';

  @override
  String get materialStatusReused => 'Reused';

  @override
  String get materialStatusUnavailable => 'Unavailable';

  @override
  String get supplierApply => 'Apply';

  @override
  String get supplierSelectScheduleRange => 'Select schedule range';

  @override
  String get supplierActionCouldNotComplete =>
      'The action could not be completed.';

  @override
  String get supplierHandovers => 'Handovers';

  @override
  String get supplierSearchScheduleHint =>
      'Search by material, learner, or reservation ID...';

  @override
  String get supplierDeliveryPickup => 'Delivery pickup';

  @override
  String get supplierNoAttention => 'No attention';

  @override
  String get supplierScheduleColumnSchedule => 'Schedule';

  @override
  String get supplierScheduleColumnMaterialLearner => 'Material & learner';

  @override
  String get supplierScheduleColumnFulfillment => 'Fulfillment';

  @override
  String get supplierScheduleColumnWindow => 'Window';

  @override
  String get supplierScheduleColumnNextActor => 'Next actor';

  @override
  String get supplierScheduleColumnActions => 'Actions';

  @override
  String get supplierNoConfirmedWindow => 'No confirmed window';

  @override
  String supplierGroupReservationsQuantity(String count, String quantity) {
    return '$count reservations · $quantity';
  }

  @override
  String supplierGroupReservationsCount(String count) {
    return '$count reservations';
  }

  @override
  String get supplierConfirmed => 'Confirmed';

  @override
  String get supplierSupplierPickup => 'Supplier pickup';

  @override
  String get supplierConfirmedPickup => 'Confirmed pickup';

  @override
  String get supplierWaitingForDriver => 'Waiting for driver';

  @override
  String get supplierDriverAssigned => 'Driver assigned';

  @override
  String get supplierArrivedAtSupplier => 'Arrived at supplier';

  @override
  String get supplierDriverOnTheWay => 'Driver on the way';

  @override
  String get supplierPickedUp => 'Picked up';

  @override
  String get supplierView => 'View';

  @override
  String get supplierMoreActions => 'More actions';

  @override
  String supplierShowingHandoversRange(String start, String end, String total) {
    return 'Showing $start–$end of $total handovers';
  }

  @override
  String get supplierRowsPerPage => 'Rows per page';

  @override
  String get supplierPickupScheduleLoadFailedTitle =>
      'Could not load pickup schedule';

  @override
  String get supplierPleaseTryAgain => 'Please try again.';

  @override
  String get supplierNoHandoversMatchFilters =>
      'No handovers match the selected filters.';

  @override
  String get supplierNoHandoversToday => 'No handovers scheduled for today.';

  @override
  String get supplierNoHandoversUpcoming => 'No upcoming handovers.';

  @override
  String get supplierNoHandoversOverdue => 'No overdue handovers.';

  @override
  String get supplierNoHandoversCompletedPeriod =>
      'No completed handovers in this period.';

  @override
  String get supplierNoHandoversClosedPeriod =>
      'No closed handovers in this period.';

  @override
  String get supplierNoHandoversScheduled => 'No scheduled handovers yet.';

  @override
  String get supplierResetFiltersToSeeMore =>
      'Try resetting the filters to see more handovers.';

  @override
  String get supplierConfirmedHandoversAppearHere =>
      'Confirmed self-pickups and driver pickup appointments will appear here.';

  @override
  String get supplierOpenIncomingRequests => 'Open Incoming Requests';

  @override
  String get supplierFiltersTitle => 'Filters';

  @override
  String get supplierFilterOverdue => 'Overdue';

  @override
  String get supplierUnscheduledAction => 'Unscheduled action';

  @override
  String get supplierNeedsScheduling => 'Needs scheduling';

  @override
  String get supplierAwaitingResolution => 'Awaiting resolution';

  @override
  String get supplierPastDue => 'Past due';

  @override
  String get supplierScheduled => 'Scheduled';

  @override
  String get supplierHandoverCompleted => 'Handover completed';

  @override
  String get supplierNeedsReview => 'Needs review';

  @override
  String get supplierExpired => 'Expired';

  @override
  String get supplierNoShow => 'No-show';

  @override
  String get supplierFulfillmentFailed => 'Fulfillment failed';

  @override
  String get supplierCancelled => 'Cancelled';

  @override
  String get supplierAdminReview => 'Admin review';

  @override
  String get supplierNextActorYou => 'You';

  @override
  String get supplierNextActorLearner => 'Learner';

  @override
  String get supplierNextActorDriver => 'Driver';

  @override
  String get supplierCompletePickup => 'Complete pickup';

  @override
  String get supplierReportLearnerNoShow => 'Report learner no-show';

  @override
  String get supplierCloseReservation => 'Close reservation';

  @override
  String get supplierMessage => 'Message';

  @override
  String get supplierEditCover => 'Edit cover';

  @override
  String get supplierEditProfilePhoto => 'Edit supplier profile photo';

  @override
  String get supplierEssentialsCompleteTitle => 'Essentials complete';

  @override
  String get supplierEditProfileCompletionDetails =>
      'Edit supplier profile completion details';

  @override
  String supplierProfileCompletionPercent(String percent) {
    return 'Profile completion $percent percent';
  }

  @override
  String supplierMissingFields(String fields) {
    return 'Missing: $fields';
  }

  @override
  String get supplierBusinessIdentity => 'Business identity';

  @override
  String get supplierWorkingAvailability => 'Working availability';

  @override
  String get supplierWorkingAvailabilityMissing =>
      'Working availability has not been added.';

  @override
  String get supplierWorkingHours => 'Working hours';

  @override
  String get supplierPickupLocationAndPrivacy => 'Pickup location & privacy';

  @override
  String get supplierCityArea => 'City / area';

  @override
  String get supplierPickupAddress => 'Pickup address';

  @override
  String get supplierPickupLocationMap => 'Pickup location map';

  @override
  String get supplierSavedPickupLocation => 'Your saved pickup location.';

  @override
  String get supplierSubmitForReview => 'Submit for review';

  @override
  String get supplierResubmit => 'Resubmit';

  @override
  String get supplierThanksVerificationCommunity =>
      'Thanks for helping make ImpactLoop trusted and safe for our community.';

  @override
  String get supplierReviewedDate => 'Reviewed date';

  @override
  String get supplierSubmittedDate => 'Submitted date';

  @override
  String get supplierAwaitingReview => 'Awaiting review';

  @override
  String get supplierChangesRequired => 'Changes required';

  @override
  String get supplierVerificationNotRequired => 'Verification not required';

  @override
  String get supplierNotVerified => 'Not verified';

  @override
  String get supplierVerificationUnavailable => 'Verification unavailable';

  @override
  String get supplierProfileVerified => 'Profile verified';

  @override
  String get supplierProfileAwaitingReview =>
      'Your profile is awaiting review.';

  @override
  String get supplierChangesRequiredBeforeApproval =>
      'Changes are required before approval.';

  @override
  String get supplierVerificationRejected => 'Your verification was rejected.';

  @override
  String get supplierVerificationNotRequiredMessage =>
      'Verification is not required.';

  @override
  String get supplierProfileNotVerifiedYet =>
      'Your profile is not verified yet.';

  @override
  String get supplierVerificationStatusUnavailable =>
      'Verification status is unavailable.';

  @override
  String get supplierPickupLocationLabel => 'Pickup location';

  @override
  String get supplierPublicAreaApproximateTitle =>
      'Public area — approximate location';

  @override
  String get supplierPublicAreaApproximateExplanation =>
      'Learners see the general area before acceptance. The exact pickup address is shared only when the workflow permits it.';

  @override
  String get supplierPublicExactLocation => 'Public exact location';

  @override
  String get supplierPublicExactLocationExplanation =>
      'The pickup location is publicly visible.';

  @override
  String get supplierSharedAfterAcceptanceTitle =>
      'Shared after reservation acceptance';

  @override
  String get supplierSharedAfterAcceptanceExplanation =>
      'Learners do not see the exact pickup address before the reservation is accepted.';

  @override
  String get supplierPrivateLocation => 'Private location';

  @override
  String get supplierPrivateLocationExplanation =>
      'The pickup location is not shown publicly.';

  @override
  String get supplierLocationPrivacyUnavailable =>
      'Location privacy unavailable';

  @override
  String get supplierLocationPrivacyUnavailableExplanation =>
      'Visibility details are not available right now.';

  @override
  String get supplierDaySun => 'Sun';

  @override
  String get supplierDayMon => 'Mon';

  @override
  String get supplierDayTue => 'Tue';

  @override
  String get supplierDayWed => 'Wed';

  @override
  String get supplierDayThu => 'Thu';

  @override
  String get supplierDayFri => 'Fri';

  @override
  String get supplierDaySat => 'Sat';

  @override
  String get supplierSummaryClosed => 'Closed';

  @override
  String get supplierNotifCategoryMaterialReview => 'Material review';

  @override
  String get supplierNotifCategoryDeliveryRecovery => 'Delivery recovery';

  @override
  String get supplierNotifCategorySystem => 'System';

  @override
  String get supplierNotifStateWaiting => 'Waiting';

  @override
  String get supplierChooseTime => 'Choose time';

  @override
  String get supplierPublicProfileSection => 'Public profile';

  @override
  String get supplierOrganizationAvailabilitySection =>
      'Organization & availability';

  @override
  String get supplierOrganizationNameHelp =>
      'Organization name identifies the organization; it may match the public supplier name.';

  @override
  String get supplierAvailabilityInformationalHelp =>
      'Availability is informational and helps learners plan pickup.';

  @override
  String get supplierSeparateOrganizationAddress =>
      'Separate organization address';

  @override
  String get supplierVisibilityPublicApproximate =>
      'Learners see the general area. The exact pickup address is shared after the reservation is accepted.';

  @override
  String get supplierVisibilityPublicExact =>
      'Learners can see the saved pickup location according to your public visibility settings.';

  @override
  String get supplierVisibilityOrderOnly =>
      'Learners see the exact pickup address only after the reservation is accepted.';

  @override
  String get supplierVisibilityPrivate =>
      'The pickup location remains private.';

  @override
  String get supplierVisibilityUnavailable =>
      'Location visibility details are unavailable.';

  @override
  String get supplierChooseValidTime => 'Choose a valid time.';

  @override
  String get supplierPickupMapUnavailable => 'Pickup map unavailable';

  @override
  String get supplierAddPickupLocationForMap =>
      'Add a pickup location to display the map.';

  @override
  String get supplierCouldNotLoadSupplierProfile =>
      'Couldn’t load supplier profile';

  @override
  String supplierMaterialRequestsBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count requests',
      one: '1 request',
    );
    return '$_temp0';
  }

  @override
  String supplierMaterialsResultCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count materials shown',
      one: '1 material shown',
    );
    return '$_temp0';
  }

  @override
  String supplierActiveRequestsLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count active requests',
      one: '1 active request',
    );
    return '$_temp0';
  }

  @override
  String supplierDemandCountLabel(int demand, int views) {
    String _temp0 = intl.Intl.pluralLogic(
      demand,
      locale: localeName,
      other: '$demand reservations',
      one: '1 reservation',
    );
    String _temp1 = intl.Intl.pluralLogic(
      views,
      locale: localeName,
      other: '$views views',
      one: '1 view',
    );
    return '$_temp0 · $_temp1';
  }
}
