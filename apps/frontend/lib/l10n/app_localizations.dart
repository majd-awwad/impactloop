import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'ImpactLoop'**
  String get appTitle;

  /// No description provided for @unknownStatus.
  ///
  /// In en, this message translates to:
  /// **'Unknown status'**
  String get unknownStatus;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get somethingWentWrong;

  /// No description provided for @networkError.
  ///
  /// In en, this message translates to:
  /// **'We could not reach the server. Check your connection and try again.'**
  String get networkError;

  /// No description provided for @timeoutError.
  ///
  /// In en, this message translates to:
  /// **'The server took too long to respond. Please try again.'**
  String get timeoutError;

  /// No description provided for @serverError.
  ///
  /// In en, this message translates to:
  /// **'The server hit a problem. Please try again in a moment.'**
  String get serverError;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please sign in again.'**
  String get sessionExpired;

  /// No description provided for @forbiddenError.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to complete this action.'**
  String get forbiddenError;

  /// No description provided for @conflictError.
  ///
  /// In en, this message translates to:
  /// **'This request conflicts with the current state. Please refresh and try again.'**
  String get conflictError;

  /// No description provided for @validationError.
  ///
  /// In en, this message translates to:
  /// **'Check the highlighted information and try again.'**
  String get validationError;

  /// No description provided for @accountSuspended.
  ///
  /// In en, this message translates to:
  /// **'Your account has been suspended. Contact an administrator.'**
  String get accountSuspended;

  /// No description provided for @pickupWindowRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose a new pickup start and end time before sending a reschedule request.'**
  String get pickupWindowRequired;

  /// No description provided for @invalidPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'The pickup window is not valid. Choose a different time.'**
  String get invalidPickupWindow;

  /// No description provided for @invalidValue.
  ///
  /// In en, this message translates to:
  /// **'Invalid value'**
  String get invalidValue;

  /// No description provided for @completeRequiredDetail.
  ///
  /// In en, this message translates to:
  /// **'Complete this required detail before continuing.'**
  String get completeRequiredDetail;

  /// No description provided for @currencyNis.
  ///
  /// In en, this message translates to:
  /// **'{amount} NIS'**
  String currencyNis(String amount);

  /// No description provided for @distanceKilometers.
  ///
  /// In en, this message translates to:
  /// **'{distance} km'**
  String distanceKilometers(String distance);

  /// No description provided for @quantityWithUnit.
  ///
  /// In en, this message translates to:
  /// **'{quantity} {unit}'**
  String quantityWithUnit(String quantity, String unit);

  /// No description provided for @notificationFallbackTitle.
  ///
  /// In en, this message translates to:
  /// **'Notification'**
  String get notificationFallbackTitle;

  /// No description provided for @notificationFallbackBody.
  ///
  /// In en, this message translates to:
  /// **'There is an update waiting for you.'**
  String get notificationFallbackBody;

  /// No description provided for @material.
  ///
  /// In en, this message translates to:
  /// **'Material'**
  String get material;

  /// No description provided for @materials.
  ///
  /// In en, this message translates to:
  /// **'Materials'**
  String get materials;

  /// No description provided for @supplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get supplier;

  /// No description provided for @learner.
  ///
  /// In en, this message translates to:
  /// **'Learner'**
  String get learner;

  /// No description provided for @learningHub.
  ///
  /// In en, this message translates to:
  /// **'Learning Hub'**
  String get learningHub;

  /// No description provided for @learningProject.
  ///
  /// In en, this message translates to:
  /// **'Learning project'**
  String get learningProject;

  /// No description provided for @requiredComponent.
  ///
  /// In en, this message translates to:
  /// **'Required component'**
  String get requiredComponent;

  /// No description provided for @reservation.
  ///
  /// In en, this message translates to:
  /// **'Reservation'**
  String get reservation;

  /// No description provided for @reservationRequest.
  ///
  /// In en, this message translates to:
  /// **'Reservation request'**
  String get reservationRequest;

  /// No description provided for @pickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup from supplier'**
  String get pickup;

  /// No description provided for @delivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get delivery;

  /// No description provided for @driver.
  ///
  /// In en, this message translates to:
  /// **'Driver'**
  String get driver;

  /// No description provided for @available.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get available;

  /// No description provided for @reserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get reserved;

  /// No description provided for @reused.
  ///
  /// In en, this message translates to:
  /// **'Reused'**
  String get reused;

  /// No description provided for @free.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get free;

  /// No description provided for @paid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get paid;

  /// No description provided for @materialCondition.
  ///
  /// In en, this message translates to:
  /// **'Material condition'**
  String get materialCondition;

  /// No description provided for @sourceType.
  ///
  /// In en, this message translates to:
  /// **'Source type'**
  String get sourceType;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @saved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get saved;

  /// No description provided for @follow.
  ///
  /// In en, this message translates to:
  /// **'Follow'**
  String get follow;

  /// No description provided for @following.
  ///
  /// In en, this message translates to:
  /// **'Following'**
  String get following;

  /// No description provided for @like.
  ///
  /// In en, this message translates to:
  /// **'Like'**
  String get like;

  /// No description provided for @buildProject.
  ///
  /// In en, this message translates to:
  /// **'Build project'**
  String get buildProject;

  /// No description provided for @buildChecklist.
  ///
  /// In en, this message translates to:
  /// **'Project build checklist'**
  String get buildChecklist;

  /// No description provided for @submission.
  ///
  /// In en, this message translates to:
  /// **'Project submitted for review'**
  String get submission;

  /// No description provided for @changesRequested.
  ///
  /// In en, this message translates to:
  /// **'Changes requested'**
  String get changesRequested;

  /// No description provided for @pendingReview.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get pendingReview;

  /// No description provided for @pickupMissed.
  ///
  /// In en, this message translates to:
  /// **'Pickup missed'**
  String get pickupMissed;

  /// No description provided for @filterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get filterAll;

  /// No description provided for @filterActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get filterActive;

  /// No description provided for @filterNeedsAction.
  ///
  /// In en, this message translates to:
  /// **'Needs action'**
  String get filterNeedsAction;

  /// No description provided for @filterPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get filterPending;

  /// No description provided for @filterAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get filterAccepted;

  /// No description provided for @filterCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get filterCompleted;

  /// No description provided for @filterClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get filterClosed;

  /// No description provided for @statusPendingSupplier.
  ///
  /// In en, this message translates to:
  /// **'Pending supplier response'**
  String get statusPendingSupplier;

  /// No description provided for @statusNeedsConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Needs your confirmation'**
  String get statusNeedsConfirmation;

  /// No description provided for @statusWaitingSupplier.
  ///
  /// In en, this message translates to:
  /// **'Waiting for supplier response'**
  String get statusWaitingSupplier;

  /// No description provided for @statusWaitingSupplierWindow.
  ///
  /// In en, this message translates to:
  /// **'Waiting for supplier to choose a new pickup window'**
  String get statusWaitingSupplierWindow;

  /// No description provided for @statusAcceptedPickup.
  ///
  /// In en, this message translates to:
  /// **'Accepted / Ready for pickup'**
  String get statusAcceptedPickup;

  /// No description provided for @statusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get statusAccepted;

  /// No description provided for @statusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get statusRejected;

  /// No description provided for @statusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// No description provided for @statusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get statusCancelled;

  /// No description provided for @statusClosedMissedPickup.
  ///
  /// In en, this message translates to:
  /// **'Closed after missed pickup'**
  String get statusClosedMissedPickup;

  /// No description provided for @statusCancelledNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Cancelled — no driver available'**
  String get statusCancelledNoDriver;

  /// No description provided for @statusCancelledUnresolvedPickup.
  ///
  /// In en, this message translates to:
  /// **'Admin cancelled due to unresolved pickup'**
  String get statusCancelledUnresolvedPickup;

  /// No description provided for @statusExpiredNoResponse.
  ///
  /// In en, this message translates to:
  /// **'Expired — no response'**
  String get statusExpiredNoResponse;

  /// No description provided for @statusExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get statusExpired;

  /// No description provided for @statusFulfillmentFailed.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment failed'**
  String get statusFulfillmentFailed;

  /// No description provided for @statusPendingAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Pending admin review'**
  String get statusPendingAdminReview;

  /// No description provided for @statusReportVerified.
  ///
  /// In en, this message translates to:
  /// **'Report verified'**
  String get statusReportVerified;

  /// No description provided for @statusReportDismissed.
  ///
  /// In en, this message translates to:
  /// **'Report dismissed'**
  String get statusReportDismissed;

  /// No description provided for @statusResolvedNoStrike.
  ///
  /// In en, this message translates to:
  /// **'Resolved without strike'**
  String get statusResolvedNoStrike;

  /// No description provided for @statusWaitingDriver.
  ///
  /// In en, this message translates to:
  /// **'Waiting for driver'**
  String get statusWaitingDriver;

  /// No description provided for @statusDriverAssigned.
  ///
  /// In en, this message translates to:
  /// **'Driver assigned'**
  String get statusDriverAssigned;

  /// No description provided for @statusDriverAtPickup.
  ///
  /// In en, this message translates to:
  /// **'Driver at pickup'**
  String get statusDriverAtPickup;

  /// No description provided for @statusPickedUp.
  ///
  /// In en, this message translates to:
  /// **'Picked up'**
  String get statusPickedUp;

  /// No description provided for @statusOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'On the way'**
  String get statusOnTheWay;

  /// No description provided for @statusArrivedDropoff.
  ///
  /// In en, this message translates to:
  /// **'Arrived at drop-off'**
  String get statusArrivedDropoff;

  /// No description provided for @statusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get statusDelivered;

  /// No description provided for @statusDeliveryCancelled.
  ///
  /// In en, this message translates to:
  /// **'Delivery cancelled'**
  String get statusDeliveryCancelled;

  /// No description provided for @statusPickupFailed.
  ///
  /// In en, this message translates to:
  /// **'Pickup failed'**
  String get statusPickupFailed;

  /// No description provided for @statusDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivery failed'**
  String get statusDeliveryFailed;

  /// No description provided for @statusDriverNoShow.
  ///
  /// In en, this message translates to:
  /// **'Driver no-show'**
  String get statusDriverNoShow;

  /// No description provided for @statusLearnerNoShow.
  ///
  /// In en, this message translates to:
  /// **'Learner no-show'**
  String get statusLearnerNoShow;

  /// No description provided for @statusNeedsAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Needs admin review'**
  String get statusNeedsAdminReview;

  /// No description provided for @statusInDelivery.
  ///
  /// In en, this message translates to:
  /// **'In delivery'**
  String get statusInDelivery;

  /// No description provided for @statusNoDriverAvailable.
  ///
  /// In en, this message translates to:
  /// **'No driver available'**
  String get statusNoDriverAvailable;

  /// No description provided for @statusDriverPickupOverdue.
  ///
  /// In en, this message translates to:
  /// **'Driver pickup overdue'**
  String get statusDriverPickupOverdue;

  /// No description provided for @statusDeliveryIssueReported.
  ///
  /// In en, this message translates to:
  /// **'Delivery issue reported'**
  String get statusDeliveryIssueReported;

  /// No description provided for @statusDriverNotAssignedInTime.
  ///
  /// In en, this message translates to:
  /// **'Driver not assigned in time'**
  String get statusDriverNotAssignedInTime;

  /// No description provided for @statusPickupNotCompleted.
  ///
  /// In en, this message translates to:
  /// **'Pickup not completed'**
  String get statusPickupNotCompleted;

  /// No description provided for @statusAtSupplierPickup.
  ///
  /// In en, this message translates to:
  /// **'At supplier pickup'**
  String get statusAtSupplierPickup;

  /// No description provided for @statusPickupWindowPassed.
  ///
  /// In en, this message translates to:
  /// **'Pickup window passed'**
  String get statusPickupWindowPassed;

  /// No description provided for @preferredDelivery.
  ///
  /// In en, this message translates to:
  /// **'Preferred delivery'**
  String get preferredDelivery;

  /// No description provided for @requestedPickup.
  ///
  /// In en, this message translates to:
  /// **'Requested pickup'**
  String get requestedPickup;

  /// No description provided for @additionalWindows.
  ///
  /// In en, this message translates to:
  /// **'+{count} more'**
  String additionalWindows(int count);

  /// No description provided for @deliveryAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery address: {address}'**
  String deliveryAddressLabel(String address);

  /// No description provided for @safeDropoffAllowed.
  ///
  /// In en, this message translates to:
  /// **'Safe drop-off allowed'**
  String get safeDropoffAllowed;

  /// No description provided for @safeDropoffNotAllowed.
  ///
  /// In en, this message translates to:
  /// **'Safe drop-off not allowed'**
  String get safeDropoffNotAllowed;

  /// No description provided for @justNow.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get justNow;

  /// No description provided for @minutesAgo.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 minute ago} other{{count} minutes ago}}'**
  String minutesAgo(int count);

  /// No description provided for @hoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 hour ago} other{{count} hours ago}}'**
  String hoursAgo(int count);

  /// No description provided for @daysAgo.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 day ago} other{{count} days ago}}'**
  String daysAgo(int count);

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @notificationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation, delivery, project, and account updates.'**
  String get notificationsSubtitle;

  /// No description provided for @notificationsLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading notifications…'**
  String get notificationsLoading;

  /// No description provided for @notificationsLoadingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Fetching your latest updates.'**
  String get notificationsLoadingSubtitle;

  /// No description provided for @notificationsLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load notifications.'**
  String get notificationsLoadError;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Please try again.'**
  String get tryAgain;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @markAllRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all read'**
  String get markAllRead;

  /// No description provided for @filterUnread.
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get filterUnread;

  /// No description provided for @filterRead.
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get filterRead;

  /// No description provided for @noUnreadNotifications.
  ///
  /// In en, this message translates to:
  /// **'No unread notifications.'**
  String get noUnreadNotifications;

  /// No description provided for @allCaughtUp.
  ///
  /// In en, this message translates to:
  /// **'You are all caught up for now.'**
  String get allCaughtUp;

  /// No description provided for @noReadNotifications.
  ///
  /// In en, this message translates to:
  /// **'No read notifications yet.'**
  String get noReadNotifications;

  /// No description provided for @openedNotificationsAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Opened notifications will appear here.'**
  String get openedNotificationsAppearHere;

  /// No description provided for @noNotifications.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.'**
  String get noNotifications;

  /// No description provided for @notificationsAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Your updates will appear here.'**
  String get notificationsAppearHere;

  /// No description provided for @loadMore.
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get loadMore;

  /// No description provided for @notificationCount.
  ///
  /// In en, this message translates to:
  /// **'Showing {visible} of {total} notifications.'**
  String notificationCount(int visible, int total);

  /// No description provided for @notificationChipJob.
  ///
  /// In en, this message translates to:
  /// **'Job'**
  String get notificationChipJob;

  /// No description provided for @notificationChipReminder.
  ///
  /// In en, this message translates to:
  /// **'Reminder'**
  String get notificationChipReminder;

  /// No description provided for @notificationChipDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery update'**
  String get notificationChipDelivery;

  /// No description provided for @notificationChipAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get notificationChipAccount;

  /// No description provided for @notificationChipUpdate.
  ///
  /// In en, this message translates to:
  /// **'Update'**
  String get notificationChipUpdate;

  /// No description provided for @viewJobs.
  ///
  /// In en, this message translates to:
  /// **'View jobs'**
  String get viewJobs;

  /// No description provided for @viewDetails.
  ///
  /// In en, this message translates to:
  /// **'View details'**
  String get viewDetails;

  /// No description provided for @viewDelivery.
  ///
  /// In en, this message translates to:
  /// **'View delivery'**
  String get viewDelivery;

  /// No description provided for @viewReservation.
  ///
  /// In en, this message translates to:
  /// **'View reservation'**
  String get viewReservation;

  /// No description provided for @viewSubmission.
  ///
  /// In en, this message translates to:
  /// **'View submission'**
  String get viewSubmission;

  /// No description provided for @open.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get open;

  /// No description provided for @reservationAcceptedTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation accepted'**
  String get reservationAcceptedTitle;

  /// No description provided for @reservationAcceptedBody.
  ///
  /// In en, this message translates to:
  /// **'{materialTitle} was accepted. Check your pickup or delivery details.'**
  String reservationAcceptedBody(String materialTitle);

  /// No description provided for @reservationProposalTitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier proposed a new time'**
  String get reservationProposalTitle;

  /// No description provided for @reservationProposalBody.
  ///
  /// In en, this message translates to:
  /// **'Review the supplier proposal for {materialTitle}.'**
  String reservationProposalBody(String materialTitle);

  /// No description provided for @reservationDeclinedTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation declined'**
  String get reservationDeclinedTitle;

  /// No description provided for @reservationDeclinedBody.
  ///
  /// In en, this message translates to:
  /// **'Your request for {materialTitle} was declined.'**
  String reservationDeclinedBody(String materialTitle);

  /// No description provided for @reservationExpiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation expired'**
  String get reservationExpiredTitle;

  /// No description provided for @reservationExpiredBody.
  ///
  /// In en, this message translates to:
  /// **'Your request for {materialTitle} expired before the supplier responded.'**
  String reservationExpiredBody(String materialTitle);

  /// No description provided for @projectModerationTitle.
  ///
  /// In en, this message translates to:
  /// **'Project review updated'**
  String get projectModerationTitle;

  /// No description provided for @projectModerationBody.
  ///
  /// In en, this message translates to:
  /// **'The review status for {projectTitle} was updated.'**
  String projectModerationBody(String projectTitle);

  /// No description provided for @projectApprovedTitle.
  ///
  /// In en, this message translates to:
  /// **'Learning project approved'**
  String get projectApprovedTitle;

  /// No description provided for @projectApprovedBody.
  ///
  /// In en, this message translates to:
  /// **'{projectTitle} was approved and is now published in the Learning Hub.'**
  String projectApprovedBody(String projectTitle);

  /// No description provided for @projectChangesRequestedTitle.
  ///
  /// In en, this message translates to:
  /// **'Changes requested for your project'**
  String get projectChangesRequestedTitle;

  /// No description provided for @projectChangesRequestedBody.
  ///
  /// In en, this message translates to:
  /// **'{projectTitle} needs changes before it can be published.'**
  String projectChangesRequestedBody(String projectTitle);

  /// No description provided for @projectRejectedTitle.
  ///
  /// In en, this message translates to:
  /// **'Learning project rejected'**
  String get projectRejectedTitle;

  /// No description provided for @projectRejectedBody.
  ///
  /// In en, this message translates to:
  /// **'{projectTitle} was not approved.'**
  String projectRejectedBody(String projectTitle);

  /// No description provided for @projectHiddenTitle.
  ///
  /// In en, this message translates to:
  /// **'Learning project unpublished'**
  String get projectHiddenTitle;

  /// No description provided for @projectHiddenBody.
  ///
  /// In en, this message translates to:
  /// **'{projectTitle} was hidden from the Learning Hub.'**
  String projectHiddenBody(String projectTitle);

  /// No description provided for @projectRestoredTitle.
  ///
  /// In en, this message translates to:
  /// **'Learning project restored'**
  String get projectRestoredTitle;

  /// No description provided for @projectRestoredBody.
  ///
  /// In en, this message translates to:
  /// **'{projectTitle} is published again in the Learning Hub.'**
  String projectRestoredBody(String projectTitle);

  /// No description provided for @projectArchivedTitle.
  ///
  /// In en, this message translates to:
  /// **'Learning project archived'**
  String get projectArchivedTitle;

  /// No description provided for @projectArchivedBody.
  ///
  /// In en, this message translates to:
  /// **'{projectTitle} was archived and removed from the Learning Hub.'**
  String projectArchivedBody(String projectTitle);

  /// No description provided for @projectModerationFeedback.
  ///
  /// In en, this message translates to:
  /// **'{summary} Reviewer feedback: {feedback}'**
  String projectModerationFeedback(String summary, String feedback);

  /// No description provided for @addDraftPhoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Add project'**
  String get addDraftPhoneTitle;

  /// No description provided for @draftCategoryLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load categories'**
  String get draftCategoryLoadError;

  /// No description provided for @draftCategoryLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading categories…'**
  String get draftCategoryLoading;

  /// No description provided for @draftSelectCategory.
  ///
  /// In en, this message translates to:
  /// **'Select a category'**
  String get draftSelectCategory;

  /// No description provided for @draftProjectTitleLabel.
  ///
  /// In en, this message translates to:
  /// **'Project title'**
  String get draftProjectTitleLabel;

  /// No description provided for @draftProjectTitleHint.
  ///
  /// In en, this message translates to:
  /// **'Solar classroom weather station'**
  String get draftProjectTitleHint;

  /// No description provided for @draftCategoryLabel.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get draftCategoryLabel;

  /// No description provided for @draftShortDescriptionLabel.
  ///
  /// In en, this message translates to:
  /// **'Short description'**
  String get draftShortDescriptionLabel;

  /// No description provided for @draftShortDescriptionHint.
  ///
  /// In en, this message translates to:
  /// **'Summarize what the learner will build.'**
  String get draftShortDescriptionHint;

  /// No description provided for @draftFullDescriptionLabel.
  ///
  /// In en, this message translates to:
  /// **'Full description (optional)'**
  String get draftFullDescriptionLabel;

  /// No description provided for @draftFullDescriptionHint.
  ///
  /// In en, this message translates to:
  /// **'Explain the project goal and expected outcome.'**
  String get draftFullDescriptionHint;

  /// No description provided for @draftStepsLabel.
  ///
  /// In en, this message translates to:
  /// **'Implementation steps'**
  String get draftStepsLabel;

  /// No description provided for @draftStepsHint.
  ///
  /// In en, this message translates to:
  /// **'One step per line. No need to write Step 1.\nConnect the sensor to the board.\nMount the components.\nTest readings.'**
  String get draftStepsHint;

  /// No description provided for @draftLinksLabel.
  ///
  /// In en, this message translates to:
  /// **'Helpful links'**
  String get draftLinksLabel;

  /// No description provided for @draftLinksHint.
  ///
  /// In en, this message translates to:
  /// **'https://example.com/reference-guide'**
  String get draftLinksHint;

  /// No description provided for @draftSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving draft…'**
  String get draftSaving;

  /// No description provided for @draftSave.
  ///
  /// In en, this message translates to:
  /// **'Save draft'**
  String get draftSave;

  /// No description provided for @draftSavedMessage.
  ///
  /// In en, this message translates to:
  /// **'Draft saved. You can add images and submit it for review when it is ready.'**
  String get draftSavedMessage;

  /// No description provided for @draftSelectAvailableCategoryBeforeSave.
  ///
  /// In en, this message translates to:
  /// **'Select an available project category before saving.'**
  String get draftSelectAvailableCategoryBeforeSave;

  /// No description provided for @draftMinimumContentBeforeSave.
  ///
  /// In en, this message translates to:
  /// **'Add at least 10 characters of project content before saving.'**
  String get draftMinimumContentBeforeSave;

  /// No description provided for @draftComponentRequired.
  ///
  /// In en, this message translates to:
  /// **'Add at least one component with a name.'**
  String get draftComponentRequired;

  /// No description provided for @draftComponentLimit.
  ///
  /// In en, this message translates to:
  /// **'Use 50 components or fewer.'**
  String get draftComponentLimit;

  /// No description provided for @draftComponentUnique.
  ///
  /// In en, this message translates to:
  /// **'Each component must have a unique name.'**
  String get draftComponentUnique;

  /// No description provided for @draftFullDescriptionMinimum.
  ///
  /// In en, this message translates to:
  /// **'Use at least 10 characters when adding a full description.'**
  String get draftFullDescriptionMinimum;

  /// No description provided for @draftFullDescriptionMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep the full description under 10000 characters.'**
  String get draftFullDescriptionMaximum;

  /// No description provided for @draftTitleRequired.
  ///
  /// In en, this message translates to:
  /// **'Project title is required.'**
  String get draftTitleRequired;

  /// No description provided for @draftMinimumThreeCharacters.
  ///
  /// In en, this message translates to:
  /// **'Use at least 3 characters.'**
  String get draftMinimumThreeCharacters;

  /// No description provided for @draftTitleMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep the title under 200 characters.'**
  String get draftTitleMaximum;

  /// No description provided for @draftSummaryRequired.
  ///
  /// In en, this message translates to:
  /// **'Short description is required.'**
  String get draftSummaryRequired;

  /// No description provided for @draftMinimumTenCharacters.
  ///
  /// In en, this message translates to:
  /// **'Use at least 10 characters.'**
  String get draftMinimumTenCharacters;

  /// No description provided for @draftSummaryMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep the short description under 500 characters.'**
  String get draftSummaryMaximum;

  /// No description provided for @draftCategoriesCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Project categories could not load.'**
  String get draftCategoriesCouldNotLoad;

  /// No description provided for @draftCategoriesUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Project categories are not available yet.'**
  String get draftCategoriesUnavailable;

  /// No description provided for @draftSelectAvailableCategory.
  ///
  /// In en, this message translates to:
  /// **'Select an available category.'**
  String get draftSelectAvailableCategory;

  /// No description provided for @draftStepsMaximum.
  ///
  /// In en, this message translates to:
  /// **'Use 100 steps or fewer.'**
  String get draftStepsMaximum;

  /// No description provided for @draftStepMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep each step under 5000 characters.'**
  String get draftStepMaximum;

  /// No description provided for @draftLinksMaximum.
  ///
  /// In en, this message translates to:
  /// **'Use 20 links or fewer.'**
  String get draftLinksMaximum;

  /// No description provided for @draftLinksInvalid.
  ///
  /// In en, this message translates to:
  /// **'Use valid http or https links, one per line.'**
  String get draftLinksInvalid;

  /// No description provided for @draftComponentNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Component name is required.'**
  String get draftComponentNameRequired;

  /// No description provided for @draftComponentNameMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep each component name under 200 characters.'**
  String get draftComponentNameMaximum;

  /// No description provided for @draftQuantityPositive.
  ///
  /// In en, this message translates to:
  /// **'Quantity must be greater than zero.'**
  String get draftQuantityPositive;

  /// No description provided for @draftValidUnit.
  ///
  /// In en, this message translates to:
  /// **'Choose a valid unit.'**
  String get draftValidUnit;

  /// No description provided for @draftNotesMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep notes under 1000 characters.'**
  String get draftNotesMaximum;

  /// No description provided for @draftKeywordsMaximum.
  ///
  /// In en, this message translates to:
  /// **'Use up to 5 keywords per component.'**
  String get draftKeywordsMaximum;

  /// No description provided for @draftKeywordMaximum.
  ///
  /// In en, this message translates to:
  /// **'Keep each keyword under 80 characters.'**
  String get draftKeywordMaximum;

  /// No description provided for @draftValidMaterialCategory.
  ///
  /// In en, this message translates to:
  /// **'Choose a valid material category or leave it as None.'**
  String get draftValidMaterialCategory;

  /// No description provided for @pickupWindowNotSet.
  ///
  /// In en, this message translates to:
  /// **'Pickup window not set'**
  String get pickupWindowNotSet;

  /// No description provided for @yourPreferredPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Your preferred pickup: {window}'**
  String yourPreferredPickupWindow(String window);

  /// No description provided for @supplierProposedPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Supplier proposed pickup: {window}'**
  String supplierProposedPickupWindow(String window);

  /// No description provided for @supplierDriverPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Supplier driver pickup window: {window}'**
  String supplierDriverPickupWindow(String window);

  /// No description provided for @earliestPossibleDelivery.
  ///
  /// In en, this message translates to:
  /// **'Earliest possible delivery: {dateTime}'**
  String earliestPossibleDelivery(String dateTime);

  /// No description provided for @supplierProposedDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Supplier proposed delivery: {window}'**
  String supplierProposedDeliveryWindow(String window);

  /// No description provided for @confirmedDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Confirmed delivery: {window}'**
  String confirmedDeliveryWindow(String window);

  /// No description provided for @supplierPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Supplier pickup window: {window}'**
  String supplierPickupWindow(String window);

  /// No description provided for @previousPreferredDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Your previous preferred delivery: {window}'**
  String previousPreferredDeliveryWindow(String window);

  /// No description provided for @confirmedPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Confirmed pickup: {window}'**
  String confirmedPickupWindow(String window);

  /// No description provided for @selectedDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Selected delivery window: {window}'**
  String selectedDeliveryWindow(String window);

  /// No description provided for @learnerAccountRequired.
  ///
  /// In en, this message translates to:
  /// **'Learner account required'**
  String get learnerAccountRequired;

  /// No description provided for @learnerAccountRequiredReservations.
  ///
  /// In en, this message translates to:
  /// **'Use a learner account to view material reservations.'**
  String get learnerAccountRequiredReservations;

  /// No description provided for @myReservations.
  ///
  /// In en, this message translates to:
  /// **'My reservations'**
  String get myReservations;

  /// No description provided for @reservationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track requests, pickup windows, and delivery updates.'**
  String get reservationsSubtitle;

  /// No description provided for @loadingReservations.
  ///
  /// In en, this message translates to:
  /// **'Loading reservations'**
  String get loadingReservations;

  /// No description provided for @loadingReservationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Checking your latest reservation activity.'**
  String get loadingReservationsSubtitle;

  /// No description provided for @reservationsLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load reservations'**
  String get reservationsLoadError;

  /// No description provided for @noReservations.
  ///
  /// In en, this message translates to:
  /// **'No reservations yet'**
  String get noReservations;

  /// No description provided for @noReservationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Reserve an available material and supplier updates will appear here.'**
  String get noReservationsSubtitle;

  /// No description provided for @browseMaterials.
  ///
  /// In en, this message translates to:
  /// **'Browse materials'**
  String get browseMaterials;

  /// No description provided for @noMatchingReservations.
  ///
  /// In en, this message translates to:
  /// **'No matching reservations'**
  String get noMatchingReservations;

  /// No description provided for @noMatchingReservationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Try another filter or browse materials to start a new request.'**
  String get noMatchingReservationsSubtitle;

  /// No description provided for @deliveryUpdatesUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Delivery updates are temporarily unavailable.'**
  String get deliveryUpdatesUnavailable;

  /// No description provided for @tryAgainAction.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgainAction;

  /// No description provided for @fulfillmentMethod.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment method'**
  String get fulfillmentMethod;

  /// No description provided for @supplierIssueReportedAdmin.
  ///
  /// In en, this message translates to:
  /// **'Supplier issue reported to admin.'**
  String get supplierIssueReportedAdmin;

  /// No description provided for @noDriverReportedAdmin.
  ///
  /// In en, this message translates to:
  /// **'No-driver case reported to admin.'**
  String get noDriverReportedAdmin;

  /// No description provided for @supplierPickupCodeInstructions.
  ///
  /// In en, this message translates to:
  /// **'Give this code to the supplier when you receive the material.'**
  String get supplierPickupCodeInstructions;

  /// No description provided for @pickupAddressValue.
  ///
  /// In en, this message translates to:
  /// **'Pickup address: {address}'**
  String pickupAddressValue(String address);

  /// No description provided for @pickupWindowPassedFollowup.
  ///
  /// In en, this message translates to:
  /// **'Pickup window passed. Please contact the supplier or wait for follow-up.'**
  String get pickupWindowPassedFollowup;

  /// No description provided for @viewMaterial.
  ///
  /// In en, this message translates to:
  /// **'View material'**
  String get viewMaterial;

  /// No description provided for @cancelRequest.
  ///
  /// In en, this message translates to:
  /// **'Cancel request'**
  String get cancelRequest;

  /// No description provided for @reservationCancelledFeedback.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled.'**
  String get reservationCancelledFeedback;

  /// No description provided for @keepRequest.
  ///
  /// In en, this message translates to:
  /// **'Keep request'**
  String get keepRequest;

  /// No description provided for @cancelReservationQuestion.
  ///
  /// In en, this message translates to:
  /// **'Cancel reservation?'**
  String get cancelReservationQuestion;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @cancelReleasesQuantity.
  ///
  /// In en, this message translates to:
  /// **'This will release the requested quantity back to the listing.'**
  String get cancelReleasesQuantity;

  /// No description provided for @requestedQuantityLabel.
  ///
  /// In en, this message translates to:
  /// **'Requested: {quantity}'**
  String requestedQuantityLabel(String quantity);

  /// No description provided for @yourRescheduleRequest.
  ///
  /// In en, this message translates to:
  /// **'Your reschedule request: {reason}'**
  String yourRescheduleRequest(String reason);

  /// No description provided for @requestReschedule.
  ///
  /// In en, this message translates to:
  /// **'Request reschedule'**
  String get requestReschedule;

  /// No description provided for @reasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Reason (required)'**
  String get reasonRequired;

  /// No description provided for @noteOptional.
  ///
  /// In en, this message translates to:
  /// **'Note (optional)'**
  String get noteOptional;

  /// No description provided for @noteRequired.
  ///
  /// In en, this message translates to:
  /// **'Note (required)'**
  String get noteRequired;

  /// No description provided for @pickProposedStart.
  ///
  /// In en, this message translates to:
  /// **'Pick proposed start'**
  String get pickProposedStart;

  /// No description provided for @proposedStart.
  ///
  /// In en, this message translates to:
  /// **'Start: {dateTime}'**
  String proposedStart(String dateTime);

  /// No description provided for @pickProposedEnd.
  ///
  /// In en, this message translates to:
  /// **'Pick proposed end'**
  String get pickProposedEnd;

  /// No description provided for @proposedEnd.
  ///
  /// In en, this message translates to:
  /// **'End: {dateTime}'**
  String proposedEnd(String dateTime);

  /// No description provided for @rescheduleReasonWindowRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a reason and choose a pickup window.'**
  String get rescheduleReasonWindowRequired;

  /// No description provided for @endAfterStart.
  ///
  /// In en, this message translates to:
  /// **'End time must be after start time.'**
  String get endAfterStart;

  /// No description provided for @pickupWindowTooClose.
  ///
  /// In en, this message translates to:
  /// **'Choose a pickup window that leaves enough time to complete the handover.'**
  String get pickupWindowTooClose;

  /// No description provided for @sendRequest.
  ///
  /// In en, this message translates to:
  /// **'Send request'**
  String get sendRequest;

  /// No description provided for @rescheduleSent.
  ///
  /// In en, this message translates to:
  /// **'Reschedule request sent to supplier.'**
  String get rescheduleSent;

  /// No description provided for @supplierUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Supplier unavailable'**
  String get supplierUnavailable;

  /// No description provided for @materialNotReady.
  ///
  /// In en, this message translates to:
  /// **'Material not ready'**
  String get materialNotReady;

  /// No description provided for @wrongPickupInformation.
  ///
  /// In en, this message translates to:
  /// **'Wrong pickup information'**
  String get wrongPickupInformation;

  /// No description provided for @other.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get other;

  /// No description provided for @reportSupplierIssue.
  ///
  /// In en, this message translates to:
  /// **'Report supplier issue'**
  String get reportSupplierIssue;

  /// No description provided for @reportSupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'Report a supplier issue for admin review. The reservation will be closed pending review.'**
  String get reportSupplierDescription;

  /// No description provided for @reason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reason;

  /// No description provided for @describeWhatHappened.
  ///
  /// In en, this message translates to:
  /// **'Describe what happened'**
  String get describeWhatHappened;

  /// No description provided for @submitReport.
  ///
  /// In en, this message translates to:
  /// **'Submit report'**
  String get submitReport;

  /// No description provided for @reportNoDriverAvailable.
  ///
  /// In en, this message translates to:
  /// **'Report no driver available'**
  String get reportNoDriverAvailable;

  /// No description provided for @reportNoDriverDescription.
  ///
  /// In en, this message translates to:
  /// **'No driver accepted this delivery. Submit a report for admin review.'**
  String get reportNoDriverDescription;

  /// No description provided for @actionRequired.
  ///
  /// In en, this message translates to:
  /// **'Action required'**
  String get actionRequired;

  /// No description provided for @pickupTimeAccepted.
  ///
  /// In en, this message translates to:
  /// **'Pickup time accepted.'**
  String get pickupTimeAccepted;

  /// No description provided for @deliveryWindowAfterEarliest.
  ///
  /// In en, this message translates to:
  /// **'Selected window must end after the earliest possible delivery time.'**
  String get deliveryWindowAfterEarliest;

  /// No description provided for @deliveryWindowSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Delivery window submitted.'**
  String get deliveryWindowSubmitted;

  /// No description provided for @cancelReservation.
  ///
  /// In en, this message translates to:
  /// **'Cancel reservation'**
  String get cancelReservation;

  /// No description provided for @acceptProposedTime.
  ///
  /// In en, this message translates to:
  /// **'Accept proposed time'**
  String get acceptProposedTime;

  /// No description provided for @newDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'New delivery window'**
  String get newDeliveryWindow;

  /// No description provided for @submitNewDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Submit new delivery window'**
  String get submitNewDeliveryWindow;

  /// No description provided for @pickupIncompleteAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Pickup was not completed before the supplier window ended. An admin may review if no one reports the issue.'**
  String get pickupIncompleteAdminReview;

  /// No description provided for @driverPickupIncompleteAdminReview.
  ///
  /// In en, this message translates to:
  /// **'The assigned driver has not completed supplier pickup before the window ended. An admin may review if no one reports the issue.'**
  String get driverPickupIncompleteAdminReview;

  /// No description provided for @schedulingConflict.
  ///
  /// In en, this message translates to:
  /// **'Scheduling conflict: {reason}'**
  String schedulingConflict(String reason);

  /// No description provided for @reservationWaitingSupplierMessage.
  ///
  /// In en, this message translates to:
  /// **'Waiting for supplier response.'**
  String get reservationWaitingSupplierMessage;

  /// No description provided for @reservationScheduleNeedsConfirmation.
  ///
  /// In en, this message translates to:
  /// **'The supplier proposed a schedule that needs your confirmation.'**
  String get reservationScheduleNeedsConfirmation;

  /// No description provided for @reservationRescheduleWaitingSupplier.
  ///
  /// In en, this message translates to:
  /// **'You requested a new pickup time. Waiting for the supplier to respond.'**
  String get reservationRescheduleWaitingSupplier;

  /// No description provided for @reservationReportedAwaitingAdmin.
  ///
  /// In en, this message translates to:
  /// **'This reservation was reported and is awaiting admin review.'**
  String get reservationReportedAwaitingAdmin;

  /// No description provided for @reservationReportVerifiedMessage.
  ///
  /// In en, this message translates to:
  /// **'Your report was verified by an admin.'**
  String get reservationReportVerifiedMessage;

  /// No description provided for @reservationReportDismissedMessage.
  ///
  /// In en, this message translates to:
  /// **'Your report was reviewed and dismissed.'**
  String get reservationReportDismissedMessage;

  /// No description provided for @reservationIncidentResolvedMessage.
  ///
  /// In en, this message translates to:
  /// **'This incident was resolved without a strike.'**
  String get reservationIncidentResolvedMessage;

  /// No description provided for @reservationAcceptedPickupMessage.
  ///
  /// In en, this message translates to:
  /// **'Reservation accepted. Follow the pickup window from the supplier.'**
  String get reservationAcceptedPickupMessage;

  /// No description provided for @reservationRejectedSupplierMessage.
  ///
  /// In en, this message translates to:
  /// **'The supplier rejected this reservation request.'**
  String get reservationRejectedSupplierMessage;

  /// No description provided for @reservationCompletedMessage.
  ///
  /// In en, this message translates to:
  /// **'This reservation is completed.'**
  String get reservationCompletedMessage;

  /// No description provided for @reservationCancelledMessage.
  ///
  /// In en, this message translates to:
  /// **'This reservation was cancelled.'**
  String get reservationCancelledMessage;

  /// No description provided for @reservationMissedPickupExpiredMessage.
  ///
  /// In en, this message translates to:
  /// **'This reservation expired after the pickup window passed without follow-up. Create a new reservation if you still need the material.'**
  String get reservationMissedPickupExpiredMessage;

  /// No description provided for @reservationSupplierNoResponseExpired.
  ///
  /// In en, this message translates to:
  /// **'This request expired because the supplier did not respond in time.'**
  String get reservationSupplierNoResponseExpired;

  /// No description provided for @reservationExpiredMessage.
  ///
  /// In en, this message translates to:
  /// **'This reservation expired.'**
  String get reservationExpiredMessage;

  /// No description provided for @supplierQuantityLine.
  ///
  /// In en, this message translates to:
  /// **'Supplier: {supplier} · Requested: {quantity}'**
  String supplierQuantityLine(String supplier, String quantity);

  /// No description provided for @deliveryInProgress.
  ///
  /// In en, this message translates to:
  /// **'Delivery in progress'**
  String get deliveryInProgress;

  /// No description provided for @deliveryScheduled.
  ///
  /// In en, this message translates to:
  /// **'Delivery scheduled'**
  String get deliveryScheduled;

  /// No description provided for @deliveryReservation.
  ///
  /// In en, this message translates to:
  /// **'Delivery reservation'**
  String get deliveryReservation;

  /// No description provided for @deliverySelectedAtReservation.
  ///
  /// In en, this message translates to:
  /// **'Delivery selected at reservation'**
  String get deliverySelectedAtReservation;

  /// No description provided for @deliveryRequestedStatus.
  ///
  /// In en, this message translates to:
  /// **'Delivery requested'**
  String get deliveryRequestedStatus;

  /// No description provided for @deliveryAvailable.
  ///
  /// In en, this message translates to:
  /// **'Delivery available'**
  String get deliveryAvailable;

  /// No description provided for @pickupOnly.
  ///
  /// In en, this message translates to:
  /// **'Pickup only'**
  String get pickupOnly;

  /// No description provided for @combinedDelivery.
  ///
  /// In en, this message translates to:
  /// **'Combined delivery'**
  String get combinedDelivery;

  /// No description provided for @combinedDeliveryItems.
  ///
  /// In en, this message translates to:
  /// **'{count} items in this group'**
  String combinedDeliveryItems(int count);

  /// No description provided for @combinedDeliveryTotal.
  ///
  /// In en, this message translates to:
  /// **'Group total {currency} {amount}'**
  String combinedDeliveryTotal(String currency, String amount);

  /// No description provided for @combinedDeliveryFeeOnce.
  ///
  /// In en, this message translates to:
  /// **'Delivery fee charged once for the group'**
  String get combinedDeliveryFeeOnce;

  /// No description provided for @welcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get welcomeBack;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to continue discovering materials and building with less waste.'**
  String get loginSubtitle;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @emailHint.
  ///
  /// In en, this message translates to:
  /// **'you@example.com'**
  String get emailHint;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @emailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email is required'**
  String get emailRequired;

  /// No description provided for @validEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address'**
  String get validEmailRequired;

  /// No description provided for @passwordRequired.
  ///
  /// In en, this message translates to:
  /// **'Password is required'**
  String get passwordRequired;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password.'**
  String get invalidCredentials;

  /// No description provided for @forgotPasswordQuestion.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get forgotPasswordQuestion;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @newToImpactLoop.
  ///
  /// In en, this message translates to:
  /// **'New to ImpactLoop?'**
  String get newToImpactLoop;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get createAccount;

  /// No description provided for @resetYourPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset your password'**
  String get resetYourPassword;

  /// No description provided for @forgotPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your account email and we will send reset instructions if an account exists.'**
  String get forgotPasswordSubtitle;

  /// No description provided for @forgotPasswordSuccess.
  ///
  /// In en, this message translates to:
  /// **'If an account exists for this email, reset instructions have been sent.'**
  String get forgotPasswordSuccess;

  /// No description provided for @backToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get backToSignIn;

  /// No description provided for @sendResetInstructions.
  ///
  /// In en, this message translates to:
  /// **'Send reset instructions'**
  String get sendResetInstructions;

  /// No description provided for @createNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Create a new password'**
  String get createNewPassword;

  /// No description provided for @resetPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a new password for your account. The reset link can only be used once.'**
  String get resetPasswordSubtitle;

  /// No description provided for @resetLinkInvalid.
  ///
  /// In en, this message translates to:
  /// **'Reset link is missing or invalid.'**
  String get resetLinkInvalid;

  /// No description provided for @passwordUpdated.
  ///
  /// In en, this message translates to:
  /// **'Your password has been updated. Sign in with your new password.'**
  String get passwordUpdated;

  /// No description provided for @goToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Go to sign in'**
  String get goToSignIn;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get newPassword;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get confirmPassword;

  /// No description provided for @newPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'New password is required'**
  String get newPasswordRequired;

  /// No description provided for @passwordMinLength.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters'**
  String get passwordMinLength;

  /// No description provided for @confirmNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm your new password'**
  String get confirmNewPassword;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match'**
  String get passwordsDoNotMatch;

  /// No description provided for @resetPasswordAction.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get resetPasswordAction;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// No description provided for @createYourAccount.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get createYourAccount;

  /// No description provided for @registerSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell us how you want to use ImpactLoop and set up your profile in one step.'**
  String get registerSubtitle;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get alreadyHaveAccount;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @learning.
  ///
  /// In en, this message translates to:
  /// **'Learning'**
  String get learning;

  /// No description provided for @reservations.
  ///
  /// In en, this message translates to:
  /// **'Reservations'**
  String get reservations;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @menu.
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get menu;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @loggingOut.
  ///
  /// In en, this message translates to:
  /// **'Logging out…'**
  String get loggingOut;

  /// No description provided for @signedOutOffline.
  ///
  /// In en, this message translates to:
  /// **'You were signed out locally, but the server could not be reached.'**
  String get signedOutOffline;

  /// No description provided for @learnReuseBuild.
  ///
  /// In en, this message translates to:
  /// **'Learn. Reuse. Build.'**
  String get learnReuseBuild;

  /// No description provided for @themeSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get themeSystem;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get themeDark;

  /// No description provided for @homeGreeting.
  ///
  /// In en, this message translates to:
  /// **'Welcome back, {name}'**
  String homeGreeting(String name);

  /// No description provided for @homeHeroTitle.
  ///
  /// In en, this message translates to:
  /// **'Ready to build something today?'**
  String get homeHeroTitle;

  /// No description provided for @homeHeroSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Find reusable materials, explore project ideas, and manage reservation and delivery updates from one place.'**
  String get homeHeroSubtitle;

  /// No description provided for @browseMaterialsAction.
  ///
  /// In en, this message translates to:
  /// **'Browse Materials'**
  String get browseMaterialsAction;

  /// No description provided for @exploreLearningHub.
  ///
  /// In en, this message translates to:
  /// **'Explore Learning Hub'**
  String get exploreLearningHub;

  /// No description provided for @quickActions.
  ///
  /// In en, this message translates to:
  /// **'Quick actions'**
  String get quickActions;

  /// No description provided for @quickActionsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Start with the areas that are available today.'**
  String get quickActionsSubtitle;

  /// No description provided for @browseAll.
  ///
  /// In en, this message translates to:
  /// **'Browse all'**
  String get browseAll;

  /// No description provided for @browseProjects.
  ///
  /// In en, this message translates to:
  /// **'Browse projects'**
  String get browseProjects;

  /// No description provided for @openMaterials.
  ///
  /// In en, this message translates to:
  /// **'Open materials'**
  String get openMaterials;

  /// No description provided for @openLearningHub.
  ///
  /// In en, this message translates to:
  /// **'Open Learning Hub'**
  String get openLearningHub;

  /// No description provided for @backToHome.
  ///
  /// In en, this message translates to:
  /// **'Back to home'**
  String get backToHome;

  /// No description provided for @recommendationsLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load recommendations'**
  String get recommendationsLoadError;

  /// No description provided for @recommendationsLoadErrorSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Try again in a moment or return to your home feed.'**
  String get recommendationsLoadErrorSubtitle;

  /// No description provided for @showUpTo.
  ///
  /// In en, this message translates to:
  /// **'Show up to'**
  String get showUpTo;

  /// No description provided for @addInterestsPrompt.
  ///
  /// In en, this message translates to:
  /// **'Add your interests to improve recommendations.'**
  String get addInterestsPrompt;

  /// No description provided for @editLearnerProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit learner profile'**
  String get editLearnerProfile;

  /// No description provided for @sectionSuggestedMaterialsTitle.
  ///
  /// In en, this message translates to:
  /// **'Suggested materials for you'**
  String get sectionSuggestedMaterialsTitle;

  /// No description provided for @sectionSuggestedMaterialsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Personalized from your interests, saved projects, and recent activity.'**
  String get sectionSuggestedMaterialsSubtitle;

  /// No description provided for @sectionSuggestedMaterialsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Choose interests to improve your suggestions.'**
  String get sectionSuggestedMaterialsEmpty;

  /// No description provided for @sectionSavedProjectMaterialsTitle.
  ///
  /// In en, this message translates to:
  /// **'Materials for your saved projects'**
  String get sectionSavedProjectMaterialsTitle;

  /// No description provided for @sectionSavedProjectMaterialsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Materials matched to components in your saved learning projects.'**
  String get sectionSavedProjectMaterialsSubtitle;

  /// No description provided for @sectionSavedProjectMaterialsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Save a learning project to see matching materials.'**
  String get sectionSavedProjectMaterialsEmpty;

  /// No description provided for @sectionSuggestedProjectsTitle.
  ///
  /// In en, this message translates to:
  /// **'Projects you may like'**
  String get sectionSuggestedProjectsTitle;

  /// No description provided for @sectionSuggestedProjectsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Recommended from your interests and available matching materials.'**
  String get sectionSuggestedProjectsSubtitle;

  /// No description provided for @sectionSuggestedProjectsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Choose interests to see project recommendations.'**
  String get sectionSuggestedProjectsEmpty;

  /// No description provided for @sectionContinueProjectsTitle.
  ///
  /// In en, this message translates to:
  /// **'Continue your projects'**
  String get sectionContinueProjectsTitle;

  /// No description provided for @sectionContinueProjectsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick up where you left off on in-progress project builds.'**
  String get sectionContinueProjectsSubtitle;

  /// No description provided for @sectionContinueProjectsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Start a project build to continue here.'**
  String get sectionContinueProjectsEmpty;

  /// No description provided for @sectionSavedProjectsTitle.
  ///
  /// In en, this message translates to:
  /// **'Saved projects'**
  String get sectionSavedProjectsTitle;

  /// No description provided for @sectionSavedProjectsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Projects you saved for later.'**
  String get sectionSavedProjectsSubtitle;

  /// No description provided for @sectionSavedProjectsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Saved projects will appear here.'**
  String get sectionSavedProjectsEmpty;

  /// No description provided for @sectionFreeMaterialsTitle.
  ///
  /// In en, this message translates to:
  /// **'Free materials near you'**
  String get sectionFreeMaterialsTitle;

  /// No description provided for @sectionFreeMaterialsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Free materials available on ImpactLoop.'**
  String get sectionFreeMaterialsSubtitle;

  /// No description provided for @sectionFreeMaterialsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No free nearby materials found yet.'**
  String get sectionFreeMaterialsEmpty;

  /// No description provided for @sectionPopularProjectsTitle.
  ///
  /// In en, this message translates to:
  /// **'Popular projects'**
  String get sectionPopularProjectsTitle;

  /// No description provided for @sectionPopularProjectsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Popular learning projects across ImpactLoop.'**
  String get sectionPopularProjectsSubtitle;

  /// No description provided for @sectionPopularProjectsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No popular projects found yet.'**
  String get sectionPopularProjectsEmpty;

  /// No description provided for @reasonSimilarReserved.
  ///
  /// In en, this message translates to:
  /// **'Similar to materials you reserved'**
  String get reasonSimilarReserved;

  /// No description provided for @reasonRecentActivity.
  ///
  /// In en, this message translates to:
  /// **'Matches your recent activity'**
  String get reasonRecentActivity;

  /// No description provided for @reasonSavedProjects.
  ///
  /// In en, this message translates to:
  /// **'Related to your saved projects'**
  String get reasonSavedProjects;

  /// No description provided for @reasonLikedProjects.
  ///
  /// In en, this message translates to:
  /// **'Based on projects you liked'**
  String get reasonLikedProjects;

  /// No description provided for @reasonFollowedProjects.
  ///
  /// In en, this message translates to:
  /// **'Related to projects you follow'**
  String get reasonFollowedProjects;

  /// No description provided for @reasonMaterialActivity.
  ///
  /// In en, this message translates to:
  /// **'Related to materials in your activity'**
  String get reasonMaterialActivity;

  /// No description provided for @reasonNearLocation.
  ///
  /// In en, this message translates to:
  /// **'Available near your saved location'**
  String get reasonNearLocation;

  /// No description provided for @reasonFreeMaterial.
  ///
  /// In en, this message translates to:
  /// **'Free material'**
  String get reasonFreeMaterial;

  /// No description provided for @reasonFreeNearLocation.
  ///
  /// In en, this message translates to:
  /// **'Free material near your saved location'**
  String get reasonFreeNearLocation;

  /// No description provided for @reasonDeliveryAvailable.
  ///
  /// In en, this message translates to:
  /// **'Delivery available'**
  String get reasonDeliveryAvailable;

  /// No description provided for @reasonPopularMaterial.
  ///
  /// In en, this message translates to:
  /// **'Popular material'**
  String get reasonPopularMaterial;

  /// No description provided for @reasonRecentlyAdded.
  ///
  /// In en, this message translates to:
  /// **'Recently added'**
  String get reasonRecentlyAdded;

  /// No description provided for @reasonMatchesInterest.
  ///
  /// In en, this message translates to:
  /// **'Matches your {interest} interest'**
  String reasonMatchesInterest(String interest);

  /// No description provided for @reasonBuildingCategory.
  ///
  /// In en, this message translates to:
  /// **'Because you are building a {category} project'**
  String reasonBuildingCategory(String category);

  /// No description provided for @reasonComponentsReady.
  ///
  /// In en, this message translates to:
  /// **'{ready} of {total} components ready'**
  String reasonComponentsReady(int ready, int total);

  /// No description provided for @reasonRecommended.
  ///
  /// In en, this message translates to:
  /// **'Recommended for you'**
  String get reasonRecommended;

  /// No description provided for @findReusableMaterials.
  ///
  /// In en, this message translates to:
  /// **'Find reusable materials'**
  String get findReusableMaterials;

  /// No description provided for @browseItems.
  ///
  /// In en, this message translates to:
  /// **'Browse items'**
  String get browseItems;

  /// No description provided for @materialsActionDescription.
  ///
  /// In en, this message translates to:
  /// **'Search currently listed materials from suppliers.'**
  String get materialsActionDescription;

  /// No description provided for @exploreLearningProjects.
  ///
  /// In en, this message translates to:
  /// **'Explore learning projects'**
  String get exploreLearningProjects;

  /// No description provided for @exploreProjects.
  ///
  /// In en, this message translates to:
  /// **'Explore projects'**
  String get exploreProjects;

  /// No description provided for @learningActionDescription.
  ///
  /// In en, this message translates to:
  /// **'Open the Learning Hub project catalog.'**
  String get learningActionDescription;

  /// No description provided for @trackPickups.
  ///
  /// In en, this message translates to:
  /// **'Track pickups'**
  String get trackPickups;

  /// No description provided for @reservationsActionDescription.
  ///
  /// In en, this message translates to:
  /// **'Track supplier responses and pickup windows for requested materials.'**
  String get reservationsActionDescription;

  /// No description provided for @comingLater.
  ///
  /// In en, this message translates to:
  /// **'Coming later'**
  String get comingLater;

  /// No description provided for @comingLaterSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Impact insights are planned but not available yet.'**
  String get comingLaterSubtitle;

  /// No description provided for @impactSnapshot.
  ///
  /// In en, this message translates to:
  /// **'Impact snapshot'**
  String get impactSnapshot;

  /// No description provided for @impactSnapshotDescription.
  ///
  /// In en, this message translates to:
  /// **'Your reuse impact will appear here after you complete reservations and projects.'**
  String get impactSnapshotDescription;

  /// No description provided for @landingFutureBadge.
  ///
  /// In en, this message translates to:
  /// **'Build a better future'**
  String get landingFutureBadge;

  /// No description provided for @landingHeroSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Discover reusable materials, share surplus resources, and turn surplus into projects with a cleaner, community-driven workflow.'**
  String get landingHeroSubtitle;

  /// No description provided for @landingCtaNote.
  ///
  /// In en, this message translates to:
  /// **'No credit card. No noise. Just building.'**
  String get landingCtaNote;

  /// No description provided for @materialsReused.
  ///
  /// In en, this message translates to:
  /// **'Materials reused'**
  String get materialsReused;

  /// No description provided for @activeMakers.
  ///
  /// In en, this message translates to:
  /// **'Active makers'**
  String get activeMakers;

  /// No description provided for @landingCommunity.
  ///
  /// In en, this message translates to:
  /// **'Join a growing community of students, makers, and suppliers who are building with less waste.'**
  String get landingCommunity;

  /// No description provided for @landingFeatureFindTitle.
  ///
  /// In en, this message translates to:
  /// **'Find reusable materials'**
  String get landingFeatureFindTitle;

  /// No description provided for @landingFeatureFindBody.
  ///
  /// In en, this message translates to:
  /// **'Browse a wide range of materials shared by your community.'**
  String get landingFeatureFindBody;

  /// No description provided for @exploreMaterials.
  ///
  /// In en, this message translates to:
  /// **'Explore materials'**
  String get exploreMaterials;

  /// No description provided for @landingFeatureShareTitle.
  ///
  /// In en, this message translates to:
  /// **'Share surplus materials'**
  String get landingFeatureShareTitle;

  /// No description provided for @landingFeatureShareBody.
  ///
  /// In en, this message translates to:
  /// **'List what you no longer need and help others build more.'**
  String get landingFeatureShareBody;

  /// No description provided for @shareMaterials.
  ///
  /// In en, this message translates to:
  /// **'Share materials'**
  String get shareMaterials;

  /// No description provided for @landingFeatureBuildTitle.
  ///
  /// In en, this message translates to:
  /// **'Build with less waste'**
  String get landingFeatureBuildTitle;

  /// No description provided for @landingFeatureBuildBody.
  ///
  /// In en, this message translates to:
  /// **'Save money, reduce waste, and bring creative projects to life.'**
  String get landingFeatureBuildBody;

  /// No description provided for @startBuilding.
  ///
  /// In en, this message translates to:
  /// **'Start building'**
  String get startBuilding;

  /// No description provided for @landingFooter.
  ///
  /// In en, this message translates to:
  /// **'Sustainable choices. Stronger communities. Smarter projects.'**
  String get landingFooter;

  /// No description provided for @requestDelivery.
  ///
  /// In en, this message translates to:
  /// **'Request delivery'**
  String get requestDelivery;

  /// No description provided for @requestDeliveryForMaterial.
  ///
  /// In en, this message translates to:
  /// **'Choose where the driver should deliver {materialTitle}.'**
  String requestDeliveryForMaterial(String materialTitle);

  /// No description provided for @deliveryRequested.
  ///
  /// In en, this message translates to:
  /// **'Delivery requested.'**
  String get deliveryRequested;

  /// No description provided for @deliveryRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not request delivery. Try again.'**
  String get deliveryRequestFailed;

  /// No description provided for @savedAddressesLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load saved addresses.'**
  String get savedAddressesLoadFailed;

  /// No description provided for @noSavedAddresses.
  ///
  /// In en, this message translates to:
  /// **'No saved addresses yet. Enter one below.'**
  String get noSavedAddresses;

  /// No description provided for @newAddress.
  ///
  /// In en, this message translates to:
  /// **'New address'**
  String get newAddress;

  /// No description provided for @savedDropoffAddress.
  ///
  /// In en, this message translates to:
  /// **'Saved drop-off address'**
  String get savedDropoffAddress;

  /// No description provided for @chooseSavedDropoffAddress.
  ///
  /// In en, this message translates to:
  /// **'Choose a saved drop-off address.'**
  String get chooseSavedDropoffAddress;

  /// No description provided for @country.
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get country;

  /// No description provided for @city.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get city;

  /// No description provided for @area.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get area;

  /// No description provided for @address.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get address;

  /// No description provided for @countryAndCityRequired.
  ///
  /// In en, this message translates to:
  /// **'Country and city are required.'**
  String get countryAndCityRequired;

  /// No description provided for @useCurrentLocation.
  ///
  /// In en, this message translates to:
  /// **'Use current location'**
  String get useCurrentLocation;

  /// No description provided for @gettingLocation.
  ///
  /// In en, this message translates to:
  /// **'Getting location…'**
  String get gettingLocation;

  /// No description provided for @currentLocationCaptured.
  ///
  /// In en, this message translates to:
  /// **'Current location captured.'**
  String get currentLocationCaptured;

  /// No description provided for @currentLocationFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not get your current location.'**
  String get currentLocationFailed;

  /// No description provided for @coordinatesValue.
  ///
  /// In en, this message translates to:
  /// **'Coordinates: {coordinates}'**
  String coordinatesValue(String coordinates);

  /// No description provided for @preciseLocationHelp.
  ///
  /// In en, this message translates to:
  /// **'A precise location helps the driver find you. You can still submit only a city and address.'**
  String get preciseLocationHelp;

  /// No description provided for @saveAddressForLater.
  ///
  /// In en, this message translates to:
  /// **'Save this address for later'**
  String get saveAddressForLater;

  /// No description provided for @addressLabel.
  ///
  /// In en, this message translates to:
  /// **'Address label'**
  String get addressLabel;

  /// No description provided for @addressLabelHint.
  ///
  /// In en, this message translates to:
  /// **'Home, campus, workshop…'**
  String get addressLabelHint;

  /// No description provided for @addressLabelRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a label to save this address.'**
  String get addressLabelRequired;

  /// No description provided for @driverNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Note for the driver (optional)'**
  String get driverNoteOptional;

  /// No description provided for @supplierProfile.
  ///
  /// In en, this message translates to:
  /// **'Supplier profile'**
  String get supplierProfile;

  /// No description provided for @supplierProfileNotFound.
  ///
  /// In en, this message translates to:
  /// **'Supplier profile not found.'**
  String get supplierProfileNotFound;

  /// No description provided for @supplierProfileLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load the supplier profile.'**
  String get supplierProfileLoadFailed;

  /// No description provided for @supplierMaterialsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load supplier materials.'**
  String get supplierMaterialsLoadFailed;

  /// No description provided for @learnerAccountFollowRequired.
  ///
  /// In en, this message translates to:
  /// **'Use a learner account to follow suppliers.'**
  String get learnerAccountFollowRequired;

  /// No description provided for @publicMaterialsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No public materials} =1{1 public material} other{{count} public materials}}'**
  String publicMaterialsCount(int count);

  /// No description provided for @noPublicMaterials.
  ///
  /// In en, this message translates to:
  /// **'No public materials are available right now.'**
  String get noPublicMaterials;

  /// No description provided for @retryLoadingMore.
  ///
  /// In en, this message translates to:
  /// **'Retry loading more'**
  String get retryLoadingMore;

  /// No description provided for @aboutSupplier.
  ///
  /// In en, this message translates to:
  /// **'About this supplier'**
  String get aboutSupplier;

  /// No description provided for @aboutSupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'Browse public materials from this supplier and follow updates when new stock is published.'**
  String get aboutSupplierDescription;

  /// No description provided for @deliveryQuoteFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not calculate the delivery price. Check the delivery location and try again.'**
  String get deliveryQuoteFailed;

  /// No description provided for @cannotReserveOwnMaterial.
  ///
  /// In en, this message translates to:
  /// **'You cannot reserve a material you listed yourself.'**
  String get cannotReserveOwnMaterial;

  /// No description provided for @openReservationAlreadyExists.
  ///
  /// In en, this message translates to:
  /// **'You already have an open reservation for this material. Check My Reservations.'**
  String get openReservationAlreadyExists;

  /// No description provided for @materialUnavailableForReservation.
  ///
  /// In en, this message translates to:
  /// **'This material is no longer available for new reservations.'**
  String get materialUnavailableForReservation;

  /// No description provided for @invalidReservationQuantity.
  ///
  /// In en, this message translates to:
  /// **'Enter a quantity greater than zero and no more than what is available.'**
  String get invalidReservationQuantity;

  /// No description provided for @reservationQuantityUpTo.
  ///
  /// In en, this message translates to:
  /// **'That quantity is unavailable. You can request up to {quantity} now.'**
  String reservationQuantityUpTo(String quantity);

  /// No description provided for @loadingDelivery.
  ///
  /// In en, this message translates to:
  /// **'Loading delivery'**
  String get loadingDelivery;

  /// No description provided for @checkingDeliveryStatus.
  ///
  /// In en, this message translates to:
  /// **'Checking the latest delivery status.'**
  String get checkingDeliveryStatus;

  /// No description provided for @deliveryLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load delivery'**
  String get deliveryLoadFailed;

  /// No description provided for @deliveryStatusTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery status'**
  String get deliveryStatusTitle;

  /// No description provided for @requestedAt.
  ///
  /// In en, this message translates to:
  /// **'Requested {dateTime}'**
  String requestedAt(String dateTime);

  /// No description provided for @assignedDriver.
  ///
  /// In en, this message translates to:
  /// **'Assigned driver'**
  String get assignedDriver;

  /// No description provided for @pickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Pickup window'**
  String get pickupWindow;

  /// No description provided for @pickupArea.
  ///
  /// In en, this message translates to:
  /// **'Pickup area'**
  String get pickupArea;

  /// No description provided for @dropoff.
  ///
  /// In en, this message translates to:
  /// **'Drop-off'**
  String get dropoff;

  /// No description provided for @driverNote.
  ///
  /// In en, this message translates to:
  /// **'Driver note'**
  String get driverNote;

  /// No description provided for @failureReason.
  ///
  /// In en, this message translates to:
  /// **'Failure reason'**
  String get failureReason;

  /// No description provided for @deliveryCodeInstructions.
  ///
  /// In en, this message translates to:
  /// **'Give this code to the driver when you receive the material.'**
  String get deliveryCodeInstructions;

  /// No description provided for @backToReservations.
  ///
  /// In en, this message translates to:
  /// **'Back to reservations'**
  String get backToReservations;

  /// No description provided for @liveTracking.
  ///
  /// In en, this message translates to:
  /// **'Live tracking'**
  String get liveTracking;

  /// No description provided for @driverLocationUpdated.
  ///
  /// In en, this message translates to:
  /// **'Driver location updated recently'**
  String get driverLocationUpdated;

  /// No description provided for @trackDelivery.
  ///
  /// In en, this message translates to:
  /// **'Track delivery'**
  String get trackDelivery;

  /// No description provided for @refreshStatus.
  ///
  /// In en, this message translates to:
  /// **'Refresh status'**
  String get refreshStatus;

  /// No description provided for @statusTimeline.
  ///
  /// In en, this message translates to:
  /// **'Status timeline'**
  String get statusTimeline;

  /// No description provided for @statusTimelineDescription.
  ///
  /// In en, this message translates to:
  /// **'Delivery workflow updates.'**
  String get statusTimelineDescription;

  /// No description provided for @loadingTracking.
  ///
  /// In en, this message translates to:
  /// **'Loading delivery tracking…'**
  String get loadingTracking;

  /// No description provided for @fetchingTracking.
  ///
  /// In en, this message translates to:
  /// **'Fetching the latest delivery location.'**
  String get fetchingTracking;

  /// No description provided for @trackingLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load tracking.'**
  String get trackingLoadFailed;

  /// No description provided for @trackingUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Tracking is not available yet'**
  String get trackingUnavailable;

  /// No description provided for @waitingDriverLocation.
  ///
  /// In en, this message translates to:
  /// **'Waiting for the driver location'**
  String get waitingDriverLocation;

  /// No description provided for @waitingDriverLocationDescription.
  ///
  /// In en, this message translates to:
  /// **'The driver has picked up your material. The location will appear once it is shared.'**
  String get waitingDriverLocationDescription;

  /// No description provided for @driverLocationStale.
  ///
  /// In en, this message translates to:
  /// **'The driver location has not updated recently.'**
  String get driverLocationStale;

  /// No description provided for @lastUpdatedAt.
  ///
  /// In en, this message translates to:
  /// **'Last updated: {dateTime}'**
  String lastUpdatedAt(String dateTime);

  /// No description provided for @autoUpdateHint.
  ///
  /// In en, this message translates to:
  /// **'Updates automatically while this page is open.'**
  String get autoUpdateHint;

  /// No description provided for @refreshing.
  ///
  /// In en, this message translates to:
  /// **'Refreshing…'**
  String get refreshing;

  /// No description provided for @refreshTracking.
  ///
  /// In en, this message translates to:
  /// **'Refresh tracking'**
  String get refreshTracking;

  /// No description provided for @viewDeliveryDetails.
  ///
  /// In en, this message translates to:
  /// **'View delivery details'**
  String get viewDeliveryDetails;

  /// No description provided for @driverName.
  ///
  /// In en, this message translates to:
  /// **'Driver: {name}'**
  String driverName(String name);

  /// No description provided for @deliveryRoute.
  ///
  /// In en, this message translates to:
  /// **'Pickup: {pickup} → Drop-off: {dropoff}'**
  String deliveryRoute(String pickup, String dropoff);

  /// No description provided for @pickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Pickup location'**
  String get pickupLocation;

  /// No description provided for @dropoffLocation.
  ///
  /// In en, this message translates to:
  /// **'Drop-off location'**
  String get dropoffLocation;

  /// No description provided for @waitingForDriver.
  ///
  /// In en, this message translates to:
  /// **'Waiting for a driver.'**
  String get waitingForDriver;

  /// No description provided for @driverAssigned.
  ///
  /// In en, this message translates to:
  /// **'A driver has been assigned.'**
  String get driverAssigned;

  /// No description provided for @driverHeadingToPickup.
  ///
  /// In en, this message translates to:
  /// **'The driver is heading to the supplier pickup.'**
  String get driverHeadingToPickup;

  /// No description provided for @trackingComplete.
  ///
  /// In en, this message translates to:
  /// **'Tracking is complete for this delivery.'**
  String get trackingComplete;

  /// No description provided for @trackingAvailableAfterPickup.
  ///
  /// In en, this message translates to:
  /// **'The driver location is available after pickup.'**
  String get trackingAvailableAfterPickup;

  /// No description provided for @driverLocationNotShared.
  ///
  /// In en, this message translates to:
  /// **'The driver has not shared a location yet. Location updates will appear here when shared.'**
  String get driverLocationNotShared;

  /// No description provided for @accuracyMeters.
  ///
  /// In en, this message translates to:
  /// **'Accuracy: about {meters} m'**
  String accuracyMeters(String meters);

  /// No description provided for @trackingRefreshFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not refresh tracking. Showing the last known location.'**
  String get trackingRefreshFailed;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
