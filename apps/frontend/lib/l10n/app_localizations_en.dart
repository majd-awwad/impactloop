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
}
