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

  /// No description provided for @projectSubmissionCoverImageRequired.
  ///
  /// In en, this message translates to:
  /// **'Add at least one project image before submitting for review.'**
  String get projectSubmissionCoverImageRequired;

  /// No description provided for @projectSubmissionRequiredComponentsRequired.
  ///
  /// In en, this message translates to:
  /// **'Add at least one required component before submitting.'**
  String get projectSubmissionRequiredComponentsRequired;

  /// No description provided for @projectSubmissionStepsRequired.
  ///
  /// In en, this message translates to:
  /// **'Add at least one project step before submitting.'**
  String get projectSubmissionStepsRequired;

  /// No description provided for @projectSubmissionCategoryRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose a project category before submitting.'**
  String get projectSubmissionCategoryRequired;

  /// No description provided for @projectSubmissionTitleRequired.
  ///
  /// In en, this message translates to:
  /// **'Add a project title before submitting.'**
  String get projectSubmissionTitleRequired;

  /// No description provided for @projectSubmissionShortDescriptionRequired.
  ///
  /// In en, this message translates to:
  /// **'Add a short description before submitting.'**
  String get projectSubmissionShortDescriptionRequired;

  /// No description provided for @projectSubmissionDescriptionRequired.
  ///
  /// In en, this message translates to:
  /// **'Add a full project description before submitting.'**
  String get projectSubmissionDescriptionRequired;

  /// No description provided for @projectSubmissionDifficultyRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose a difficulty level before submitting.'**
  String get projectSubmissionDifficultyRequired;

  /// No description provided for @projectSubmissionDurationRequired.
  ///
  /// In en, this message translates to:
  /// **'Add an estimated project duration before submitting.'**
  String get projectSubmissionDurationRequired;

  /// No description provided for @projectSubmissionDetailsRequired.
  ///
  /// In en, this message translates to:
  /// **'Complete the required project details before submitting.'**
  String get projectSubmissionDetailsRequired;

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
  /// **'Action required'**
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
  /// **'Payment, reservation, delivery, project, and account updates.'**
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

  /// No description provided for @notificationChipReservation.
  ///
  /// In en, this message translates to:
  /// **'Reservation'**
  String get notificationChipReservation;

  /// No description provided for @notificationChipMaterial.
  ///
  /// In en, this message translates to:
  /// **'Material'**
  String get notificationChipMaterial;

  /// No description provided for @notificationChipLearning.
  ///
  /// In en, this message translates to:
  /// **'Learning'**
  String get notificationChipLearning;

  /// No description provided for @notificationChipMaterialRequest.
  ///
  /// In en, this message translates to:
  /// **'Material request'**
  String get notificationChipMaterialRequest;

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

  /// No description provided for @notificationChipPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get notificationChipPayment;

  /// No description provided for @notificationChipRefund.
  ///
  /// In en, this message translates to:
  /// **'Refund'**
  String get notificationChipRefund;

  /// No description provided for @notificationsFilterPayments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get notificationsFilterPayments;

  /// No description provided for @notificationsFilterDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get notificationsFilterDelivery;

  /// No description provided for @notificationsFilterRefunds.
  ///
  /// In en, this message translates to:
  /// **'Refunds'**
  String get notificationsFilterRefunds;

  /// No description provided for @notificationsUnreadCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No unread} =1{1 unread} other{{count} unread}}'**
  String notificationsUnreadCount(int count);

  /// No description provided for @notificationPaymentRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment required'**
  String get notificationPaymentRequiredTitle;

  /// No description provided for @notificationPaymentRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'Complete payment for {materialTitle} to continue.'**
  String notificationPaymentRequiredBody(String materialTitle);

  /// No description provided for @notificationPaymentRequiredBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount} for {materialTitle} to continue.'**
  String notificationPaymentRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentDeliveryFeeRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery fee required'**
  String get notificationPaymentDeliveryFeeRequiredTitle;

  /// No description provided for @notificationPaymentDeliveryFeeRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'A delivery fee is required before delivery for {materialTitle} can proceed.'**
  String notificationPaymentDeliveryFeeRequiredBody(String materialTitle);

  /// No description provided for @notificationPaymentDeliveryFeeRequiredBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay the delivery fee of {amount} before delivery for {materialTitle} can proceed.'**
  String notificationPaymentDeliveryFeeRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentCompletedTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment completed'**
  String get notificationPaymentCompletedTitle;

  /// No description provided for @notificationPaymentCompletedBody.
  ///
  /// In en, this message translates to:
  /// **'Payment for {materialTitle} was received.'**
  String notificationPaymentCompletedBody(String materialTitle);

  /// No description provided for @notificationPaymentCompletedBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'Payment of {amount} for {materialTitle} was received.'**
  String notificationPaymentCompletedBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentCompletedMoreRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment received — more still due'**
  String get notificationPaymentCompletedMoreRequiredTitle;

  /// No description provided for @notificationPaymentCompletedMoreRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'We received a payment for {materialTitle}, but more payment is still required before fulfillment can continue.'**
  String notificationPaymentCompletedMoreRequiredBody(String materialTitle);

  /// No description provided for @notificationPaymentCompletedMoreRequiredBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'We received {amount} for {materialTitle}, but more payment is still required before fulfillment can continue.'**
  String notificationPaymentCompletedMoreRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentFulfillmentReadyTitle.
  ///
  /// In en, this message translates to:
  /// **'Ready for delivery'**
  String get notificationPaymentFulfillmentReadyTitle;

  /// No description provided for @notificationPaymentFulfillmentReadyBody.
  ///
  /// In en, this message translates to:
  /// **'{materialTitle} is ready to move to fulfillment.'**
  String notificationPaymentFulfillmentReadyBody(String materialTitle);

  /// No description provided for @notificationPaymentPickupReadyTitle.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get notificationPaymentPickupReadyTitle;

  /// No description provided for @notificationPaymentPickupReadyBody.
  ///
  /// In en, this message translates to:
  /// **'{materialTitle} is ready for pickup. Show your pickup code.'**
  String notificationPaymentPickupReadyBody(String materialTitle);

  /// No description provided for @notificationPaymentRefundRequestedTitle.
  ///
  /// In en, this message translates to:
  /// **'Refund processing'**
  String get notificationPaymentRefundRequestedTitle;

  /// No description provided for @notificationPaymentRefundRequestedBody.
  ///
  /// In en, this message translates to:
  /// **'A refund for {materialTitle} is being processed.'**
  String notificationPaymentRefundRequestedBody(String materialTitle);

  /// No description provided for @notificationPaymentRefundRequestedBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'A refund of {amount} for {materialTitle} is being processed.'**
  String notificationPaymentRefundRequestedBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentRefundedTitle.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get notificationPaymentRefundedTitle;

  /// No description provided for @notificationPaymentRefundedBody.
  ///
  /// In en, this message translates to:
  /// **'Your refund for {materialTitle} is complete.'**
  String notificationPaymentRefundedBody(String materialTitle);

  /// No description provided for @notificationPaymentRefundedBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'Your refund of {amount} for {materialTitle} is complete.'**
  String notificationPaymentRefundedBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentRefundedNewCycleTitle.
  ///
  /// In en, this message translates to:
  /// **'Refunded — new payment required'**
  String get notificationPaymentRefundedNewCycleTitle;

  /// No description provided for @notificationPaymentRefundedNewCycleBody.
  ///
  /// In en, this message translates to:
  /// **'Your previous payment for {materialTitle} was refunded. A new payment is now required to continue.'**
  String notificationPaymentRefundedNewCycleBody(String materialTitle);

  /// No description provided for @notificationPaymentRefundedNewCycleBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'Your previous payment of {amount} for {materialTitle} was refunded. A new payment is now required to continue.'**
  String notificationPaymentRefundedNewCycleBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentRefundFailedTitle.
  ///
  /// In en, this message translates to:
  /// **'Refund needs attention'**
  String get notificationPaymentRefundFailedTitle;

  /// No description provided for @notificationPaymentRefundFailedBody.
  ///
  /// In en, this message translates to:
  /// **'The refund for {materialTitle} could not be completed. Review reservation details.'**
  String notificationPaymentRefundFailedBody(String materialTitle);

  /// No description provided for @notificationPaymentLateSuccessRefundTitle.
  ///
  /// In en, this message translates to:
  /// **'Late payment refunded'**
  String get notificationPaymentLateSuccessRefundTitle;

  /// No description provided for @notificationPaymentLateSuccessRefundBody.
  ///
  /// In en, this message translates to:
  /// **'A late payment for {materialTitle} was automatically refunded.'**
  String notificationPaymentLateSuccessRefundBody(String materialTitle);

  /// No description provided for @notificationPaymentNewCycleRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'New payment cycle required'**
  String get notificationPaymentNewCycleRequiredTitle;

  /// No description provided for @notificationPaymentNewCycleRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'A new payment cycle is required for {materialTitle}.'**
  String notificationPaymentNewCycleRequiredBody(String materialTitle);

  /// No description provided for @notificationPaymentNewCycleRequiredBodyWithAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount} for the new cycle of {materialTitle}.'**
  String notificationPaymentNewCycleRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  );

  /// No description provided for @notificationPaymentResolutionRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment resolution required'**
  String get notificationPaymentResolutionRequiredTitle;

  /// No description provided for @notificationPaymentResolutionRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'Your reservation for {materialTitle} needs payment resolution.'**
  String notificationPaymentResolutionRequiredBody(String materialTitle);

  /// No description provided for @notificationPaymentShowPickupCode.
  ///
  /// In en, this message translates to:
  /// **'Show pickup code'**
  String get notificationPaymentShowPickupCode;

  /// No description provided for @notificationPaymentStatusUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Not paid yet'**
  String get notificationPaymentStatusUnpaid;

  /// No description provided for @notificationPaymentStatusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get notificationPaymentStatusPaid;

  /// No description provided for @notificationPaymentStatusRefundProcessing.
  ///
  /// In en, this message translates to:
  /// **'Refund processing'**
  String get notificationPaymentStatusRefundProcessing;

  /// No description provided for @notificationPaymentStatusRefunded.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get notificationPaymentStatusRefunded;

  /// No description provided for @notificationPaymentStatusRefundFailed.
  ///
  /// In en, this message translates to:
  /// **'Refund failed'**
  String get notificationPaymentStatusRefundFailed;

  /// No description provided for @notificationPaymentStatusResolutionRequired.
  ///
  /// In en, this message translates to:
  /// **'Resolution required'**
  String get notificationPaymentStatusResolutionRequired;

  /// No description provided for @notificationPaymentStatusLateRefund.
  ///
  /// In en, this message translates to:
  /// **'Late payment refunded'**
  String get notificationPaymentStatusLateRefund;

  /// No description provided for @notificationPaymentStatusPickupReady.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get notificationPaymentStatusPickupReady;

  /// No description provided for @notificationPaymentStatusFulfillmentReady.
  ///
  /// In en, this message translates to:
  /// **'Ready for fulfillment'**
  String get notificationPaymentStatusFulfillmentReady;

  /// No description provided for @notificationPaymentNextStepPay.
  ///
  /// In en, this message translates to:
  /// **'Continue to checkout to complete this payment.'**
  String get notificationPaymentNextStepPay;

  /// No description provided for @notificationPaymentNextStepViewReservation.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to review payment history.'**
  String get notificationPaymentNextStepViewReservation;

  /// No description provided for @notificationPaymentNextStepPickup.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to show your pickup code.'**
  String get notificationPaymentNextStepPickup;

  /// No description provided for @notificationPaymentNextStepTrack.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to follow fulfillment.'**
  String get notificationPaymentNextStepTrack;

  /// No description provided for @notificationPaymentNextStepRefundProcessing.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to follow the refund.'**
  String get notificationPaymentNextStepRefundProcessing;

  /// No description provided for @notificationPaymentNextStepRefunded.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to review the refunded payment.'**
  String get notificationPaymentNextStepRefunded;

  /// No description provided for @notificationPaymentNextStepResolution.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to resolve this payment issue.'**
  String get notificationPaymentNextStepResolution;

  /// No description provided for @notificationPaymentNextStepLateRefund.
  ///
  /// In en, this message translates to:
  /// **'Open reservation details to review the automatic refund.'**
  String get notificationPaymentNextStepLateRefund;

  /// No description provided for @notificationPaymentDetailSecondary.
  ///
  /// In en, this message translates to:
  /// **'Reservation details'**
  String get notificationPaymentDetailSecondary;

  /// No description provided for @notificationPaymentAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get notificationPaymentAmountLabel;

  /// No description provided for @notificationsBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get notificationsBack;

  /// No description provided for @refreshNotifications.
  ///
  /// In en, this message translates to:
  /// **'Refresh notifications'**
  String get refreshNotifications;

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

  /// No description provided for @notificationReservationRequestedTitle.
  ///
  /// In en, this message translates to:
  /// **'New reservation request'**
  String get notificationReservationRequestedTitle;

  /// No description provided for @notificationReservationRequestedBody.
  ///
  /// In en, this message translates to:
  /// **'{learnerName} requested {materialTitle}.'**
  String notificationReservationRequestedBody(
    String learnerName,
    String materialTitle,
  );

  /// No description provided for @notificationReservationCancelledSupplierTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled'**
  String get notificationReservationCancelledSupplierTitle;

  /// No description provided for @notificationReservationCancelledSupplierBody.
  ///
  /// In en, this message translates to:
  /// **'{learnerName} cancelled the request for {materialTitle}.'**
  String notificationReservationCancelledSupplierBody(
    String learnerName,
    String materialTitle,
  );

  /// No description provided for @notificationReservationExpiredSupplierTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation expired'**
  String get notificationReservationExpiredSupplierTitle;

  /// No description provided for @notificationReservationExpiredSupplierBody.
  ///
  /// In en, this message translates to:
  /// **'The pending request for {materialTitle} expired.'**
  String notificationReservationExpiredSupplierBody(String materialTitle);

  /// No description provided for @notificationChoosePickupWindowTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a new pickup window'**
  String get notificationChoosePickupWindowTitle;

  /// No description provided for @notificationChoosePickupWindowBody.
  ///
  /// In en, this message translates to:
  /// **'Choose a new pickup window for {materialTitle}.'**
  String notificationChoosePickupWindowBody(String materialTitle);

  /// No description provided for @notificationNewPickupWindowNeededTitle.
  ///
  /// In en, this message translates to:
  /// **'New pickup window needed'**
  String get notificationNewPickupWindowNeededTitle;

  /// No description provided for @notificationNewPickupWindowNeededBody.
  ///
  /// In en, this message translates to:
  /// **'A new pickup window is needed for {materialTitle}.'**
  String notificationNewPickupWindowNeededBody(String materialTitle);

  /// No description provided for @notificationCategoryRequestUpdateTitle.
  ///
  /// In en, this message translates to:
  /// **'Category request update'**
  String get notificationCategoryRequestUpdateTitle;

  /// No description provided for @notificationCategoryRequestUpdateBody.
  ///
  /// In en, this message translates to:
  /// **'There is an update on your category request.'**
  String get notificationCategoryRequestUpdateBody;

  /// No description provided for @notificationPriceRequestUpdateTitle.
  ///
  /// In en, this message translates to:
  /// **'Price review update'**
  String get notificationPriceRequestUpdateTitle;

  /// No description provided for @notificationPriceRequestUpdateBody.
  ///
  /// In en, this message translates to:
  /// **'There is an update on your price review request.'**
  String get notificationPriceRequestUpdateBody;

  /// No description provided for @notificationMaterialModerationUpdateTitle.
  ///
  /// In en, this message translates to:
  /// **'Material review update'**
  String get notificationMaterialModerationUpdateTitle;

  /// No description provided for @notificationMaterialModerationUpdateBody.
  ///
  /// In en, this message translates to:
  /// **'There is an update on your material listing.'**
  String get notificationMaterialModerationUpdateBody;

  /// No description provided for @notificationSupplierVerificationUpdateTitle.
  ///
  /// In en, this message translates to:
  /// **'Verification update'**
  String get notificationSupplierVerificationUpdateTitle;

  /// No description provided for @notificationSupplierVerificationUpdateBody.
  ///
  /// In en, this message translates to:
  /// **'There is an update on your supplier verification.'**
  String get notificationSupplierVerificationUpdateBody;

  /// No description provided for @reservationAlreadyAccepted.
  ///
  /// In en, this message translates to:
  /// **'This reservation was already accepted.'**
  String get reservationAlreadyAccepted;

  /// No description provided for @reservationAlreadyDeclined.
  ///
  /// In en, this message translates to:
  /// **'This reservation was already declined.'**
  String get reservationAlreadyDeclined;

  /// No description provided for @reservationExpiredError.
  ///
  /// In en, this message translates to:
  /// **'This reservation expired before it could be updated.'**
  String get reservationExpiredError;

  /// No description provided for @reservationCancelledError.
  ///
  /// In en, this message translates to:
  /// **'This reservation was cancelled and cannot be updated.'**
  String get reservationCancelledError;

  /// No description provided for @reservationNotPending.
  ///
  /// In en, this message translates to:
  /// **'Only pending reservations can be updated.'**
  String get reservationNotPending;

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
  /// **'Track all your reservations, pickup, delivery, and payment actions from here.'**
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

  /// No description provided for @reservationsSummaryActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get reservationsSummaryActive;

  /// No description provided for @reservationsSummaryActionRequired.
  ///
  /// In en, this message translates to:
  /// **'Action required'**
  String get reservationsSummaryActionRequired;

  /// No description provided for @reservationsSummaryPaymentsRequired.
  ///
  /// In en, this message translates to:
  /// **'Payments required'**
  String get reservationsSummaryPaymentsRequired;

  /// No description provided for @reservationsSummaryDeliveries.
  ///
  /// In en, this message translates to:
  /// **'Delivery ready'**
  String get reservationsSummaryDeliveries;

  /// No description provided for @reservationsSummaryTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get reservationsSummaryTotal;

  /// No description provided for @reservationsSummaryLoadedHint.
  ///
  /// In en, this message translates to:
  /// **'Counts reflect currently loaded reservations.'**
  String get reservationsSummaryLoadedHint;

  /// No description provided for @reservationsTimezoneNote.
  ///
  /// In en, this message translates to:
  /// **'All dates and times use your local time zone.'**
  String get reservationsTimezoneNote;

  /// No description provided for @reservationsFilter.
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get reservationsFilter;

  /// No description provided for @viewAllReservations.
  ///
  /// In en, this message translates to:
  /// **'View all reservations'**
  String get viewAllReservations;

  /// No description provided for @reservationMoneyAmountDue.
  ///
  /// In en, this message translates to:
  /// **'Amount due'**
  String get reservationMoneyAmountDue;

  /// No description provided for @reservationMoneyRemaining.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get reservationMoneyRemaining;

  /// No description provided for @reservationMoneyPaidInFull.
  ///
  /// In en, this message translates to:
  /// **'Paid in full'**
  String get reservationMoneyPaidInFull;

  /// No description provided for @reservationMoneyOrdersRemaining.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 payment remaining} other{{count} payments remaining}}'**
  String reservationMoneyOrdersRemaining(int count);

  /// No description provided for @reservationMoneyMaterialPaidDeliveryDue.
  ///
  /// In en, this message translates to:
  /// **'Material payment received. Delivery fee is still required.'**
  String get reservationMoneyMaterialPaidDeliveryDue;

  /// No description provided for @reservationMoneyDeliveryPaidMaterialDue.
  ///
  /// In en, this message translates to:
  /// **'Delivery fee settled. Material payment is still required.'**
  String get reservationMoneyDeliveryPaidMaterialDue;

  /// No description provided for @reservationMoneyBothOutstanding.
  ///
  /// In en, this message translates to:
  /// **'Material and delivery are paid together in one checkout.'**
  String get reservationMoneyBothOutstanding;

  /// No description provided for @reservationNextStepPayTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete payment to confirm the reservation'**
  String get reservationNextStepPayTitle;

  /// No description provided for @reservationNextStepPaySupporting.
  ///
  /// In en, this message translates to:
  /// **'The pickup code appears after payment and once the pickup window starts.'**
  String get reservationNextStepPaySupporting;

  /// No description provided for @reservationNextStepPaySupportingDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery starts only after the required payment is complete.'**
  String get reservationNextStepPaySupportingDelivery;

  /// No description provided for @reservationNextStepPartialTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete the remaining payment'**
  String get reservationNextStepPartialTitle;

  /// No description provided for @reservationNextStepPartialSupporting.
  ///
  /// In en, this message translates to:
  /// **'A payment was received; the delivery fee is still required.'**
  String get reservationNextStepPartialSupporting;

  /// No description provided for @paymentStatusNotRequired.
  ///
  /// In en, this message translates to:
  /// **'Payment not required'**
  String get paymentStatusNotRequired;

  /// No description provided for @reservationNextStepPayToConfirm.
  ///
  /// In en, this message translates to:
  /// **'Pay to confirm the reservation and reveal the pickup code.'**
  String get reservationNextStepPayToConfirm;

  /// No description provided for @reservationNextStepPayToConfirmDelivery.
  ///
  /// In en, this message translates to:
  /// **'Pay to confirm the reservation and continue to delivery.'**
  String get reservationNextStepPayToConfirmDelivery;

  /// No description provided for @materialDetailViewReservation.
  ///
  /// In en, this message translates to:
  /// **'View reservation'**
  String get materialDetailViewReservation;

  /// No description provided for @materialDetailViewPickupDetails.
  ///
  /// In en, this message translates to:
  /// **'View pickup details'**
  String get materialDetailViewPickupDetails;

  /// No description provided for @materialDetailViewDeliveryDetails.
  ///
  /// In en, this message translates to:
  /// **'View delivery details'**
  String get materialDetailViewDeliveryDetails;

  /// No description provided for @materialDetailRequestDeliveryInReservations.
  ///
  /// In en, this message translates to:
  /// **'Request delivery in My Reservations'**
  String get materialDetailRequestDeliveryInReservations;

  /// No description provided for @materialDetailViewDeliveryStatus.
  ///
  /// In en, this message translates to:
  /// **'View delivery status'**
  String get materialDetailViewDeliveryStatus;

  /// No description provided for @materialDetailViewReservationRequest.
  ///
  /// In en, this message translates to:
  /// **'View reservation request'**
  String get materialDetailViewReservationRequest;

  /// No description provided for @materialDetailViewReservationHistory.
  ///
  /// In en, this message translates to:
  /// **'View reservation history'**
  String get materialDetailViewReservationHistory;

  /// No description provided for @materialDetailViewReservationStatus.
  ///
  /// In en, this message translates to:
  /// **'View reservation status'**
  String get materialDetailViewReservationStatus;

  /// No description provided for @materialDetailAcceptedPickupReady.
  ///
  /// In en, this message translates to:
  /// **'Reservation accepted. Pickup details are ready.'**
  String get materialDetailAcceptedPickupReady;

  /// No description provided for @materialDetailAcceptedDeliveryReady.
  ///
  /// In en, this message translates to:
  /// **'Reservation accepted. Open reservation details for delivery and payment status.'**
  String get materialDetailAcceptedDeliveryReady;

  /// No description provided for @materialDetailAcceptedRequestDelivery.
  ///
  /// In en, this message translates to:
  /// **'Reservation accepted. Internal delivery is available from My Reservations.'**
  String get materialDetailAcceptedRequestDelivery;

  /// No description provided for @materialDetailPreviousDeliveryRequestAgain.
  ///
  /// In en, this message translates to:
  /// **'Previous delivery status: {status}. Request delivery from My Reservations.'**
  String materialDetailPreviousDeliveryRequestAgain(String status);

  /// No description provided for @materialDetailDeliveryStatusLine.
  ///
  /// In en, this message translates to:
  /// **'Delivery status: {status}.'**
  String materialDetailDeliveryStatusLine(String status);

  /// No description provided for @materialDetailPaymentRequired.
  ///
  /// In en, this message translates to:
  /// **'Payment is still required. Open the reservation to continue checkout.'**
  String get materialDetailPaymentRequired;

  /// No description provided for @materialDetailReservationPending.
  ///
  /// In en, this message translates to:
  /// **'Reservation request sent. Waiting for supplier response.'**
  String get materialDetailReservationPending;

  /// No description provided for @notificationPaymentOpenCheckout.
  ///
  /// In en, this message translates to:
  /// **'Open checkout'**
  String get notificationPaymentOpenCheckout;

  /// No description provided for @notificationPaymentStatusCheckPayment.
  ///
  /// In en, this message translates to:
  /// **'Check current payment status'**
  String get notificationPaymentStatusCheckPayment;

  /// No description provided for @reservationMoneyAmountWithCurrency.
  ///
  /// In en, this message translates to:
  /// **'{amount} ₪'**
  String reservationMoneyAmountWithCurrency(String amount);

  /// No description provided for @reservationDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation details'**
  String get reservationDetailsTitle;

  /// No description provided for @reservationSummaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation summary'**
  String get reservationSummaryTitle;

  /// No description provided for @reservationReference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get reservationReference;

  /// No description provided for @reservationStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get reservationStatusLabel;

  /// No description provided for @reservationLocationLabel.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get reservationLocationLabel;

  /// No description provided for @importantNotes.
  ///
  /// In en, this message translates to:
  /// **'Important notes'**
  String get importantNotes;

  /// No description provided for @pickupCodeTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup code'**
  String get pickupCodeTitle;

  /// No description provided for @pickupCodeLockedPayment.
  ///
  /// In en, this message translates to:
  /// **'Complete payment to unlock your pickup code.'**
  String get pickupCodeLockedPayment;

  /// No description provided for @pickupCodeWaitingWindow.
  ///
  /// In en, this message translates to:
  /// **'Your pickup code will appear when the pickup window opens.'**
  String get pickupCodeWaitingWindow;

  /// No description provided for @pickupCodeAvailableLabel.
  ///
  /// In en, this message translates to:
  /// **'Show this code to the supplier at pickup.'**
  String get pickupCodeAvailableLabel;

  /// No description provided for @pickupCodeSafetyNote.
  ///
  /// In en, this message translates to:
  /// **'Do not share this code before you are at the pickup location.'**
  String get pickupCodeSafetyNote;

  /// No description provided for @pickupCodeClosed.
  ///
  /// In en, this message translates to:
  /// **'Pickup code is no longer available for this reservation.'**
  String get pickupCodeClosed;

  /// No description provided for @pickupCodeProcessing.
  ///
  /// In en, this message translates to:
  /// **'Pickup code will be available after payment is confirmed.'**
  String get pickupCodeProcessing;

  /// No description provided for @pickupCodeUnderReview.
  ///
  /// In en, this message translates to:
  /// **'Pickup code is paused while this case is under review.'**
  String get pickupCodeUnderReview;

  /// No description provided for @pickupCodeRefundProcessing.
  ///
  /// In en, this message translates to:
  /// **'Pickup code is unavailable while your refund is processed.'**
  String get pickupCodeRefundProcessing;

  /// No description provided for @pickupCodeRefunded.
  ///
  /// In en, this message translates to:
  /// **'This reservation was refunded. No pickup code is required.'**
  String get pickupCodeRefunded;

  /// No description provided for @pickupCodeNotApplicable.
  ///
  /// In en, this message translates to:
  /// **'Pickup code does not apply to this reservation.'**
  String get pickupCodeNotApplicable;

  /// No description provided for @pickupWindowNotStarted.
  ///
  /// In en, this message translates to:
  /// **'Not started yet'**
  String get pickupWindowNotStarted;

  /// No description provided for @pickupWindowActiveNow.
  ///
  /// In en, this message translates to:
  /// **'Available now'**
  String get pickupWindowActiveNow;

  /// No description provided for @pickupWindowEnded.
  ///
  /// In en, this message translates to:
  /// **'Window ended'**
  String get pickupWindowEnded;

  /// No description provided for @openInMaps.
  ///
  /// In en, this message translates to:
  /// **'Open in maps'**
  String get openInMaps;

  /// No description provided for @mapApproximateNote.
  ///
  /// In en, this message translates to:
  /// **'Map shows an approximate pickup area.'**
  String get mapApproximateNote;

  /// No description provided for @followUpMessagesTitle.
  ///
  /// In en, this message translates to:
  /// **'Follow-up messages'**
  String get followUpMessagesTitle;

  /// No description provided for @noFollowUpMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No follow-up messages yet.'**
  String get noFollowUpMessagesYet;

  /// No description provided for @writeShortFollowUpMessage.
  ///
  /// In en, this message translates to:
  /// **'Send a short follow-up to the supplier…'**
  String get writeShortFollowUpMessage;

  /// No description provided for @sendFollowUpMessage.
  ///
  /// In en, this message translates to:
  /// **'Send message'**
  String get sendFollowUpMessage;

  /// No description provided for @followUpMessagesLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load follow-up messages.'**
  String get followUpMessagesLoadError;

  /// No description provided for @showFullHistory.
  ///
  /// In en, this message translates to:
  /// **'Show full history'**
  String get showFullHistory;

  /// No description provided for @showLessHistory.
  ///
  /// In en, this message translates to:
  /// **'Show less'**
  String get showLessHistory;

  /// No description provided for @paymentHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment history'**
  String get paymentHistoryTitle;

  /// No description provided for @currentPaymentCycle.
  ///
  /// In en, this message translates to:
  /// **'Current payment cycle'**
  String get currentPaymentCycle;

  /// No description provided for @previousPaymentCycleCancelled.
  ///
  /// In en, this message translates to:
  /// **'Previous payment cycle was cancelled.'**
  String get previousPaymentCycleCancelled;

  /// No description provided for @previousPaymentCycleRefunded.
  ///
  /// In en, this message translates to:
  /// **'Previous payment cycle was refunded.'**
  String get previousPaymentCycleRefunded;

  /// No description provided for @reservationDetailNotesPickupTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup notes'**
  String get reservationDetailNotesPickupTitle;

  /// No description provided for @reservationDetailNotesPickupSafety.
  ///
  /// In en, this message translates to:
  /// **'Bring a valid ID and arrive within the confirmed pickup window.'**
  String get reservationDetailNotesPickupSafety;

  /// No description provided for @reservationDetailNotesPickupContact.
  ///
  /// In en, this message translates to:
  /// **'Contact the supplier through follow-up messages if you are delayed.'**
  String get reservationDetailNotesPickupContact;

  /// No description provided for @reservationDetailTimelineCreated.
  ///
  /// In en, this message translates to:
  /// **'Reservation created'**
  String get reservationDetailTimelineCreated;

  /// No description provided for @reservationDetailTimelinePending.
  ///
  /// In en, this message translates to:
  /// **'Waiting for supplier response'**
  String get reservationDetailTimelinePending;

  /// No description provided for @reservationDetailTimelineAwaitingConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Needs your confirmation'**
  String get reservationDetailTimelineAwaitingConfirmation;

  /// No description provided for @reservationDetailTimelinePaymentRequired.
  ///
  /// In en, this message translates to:
  /// **'Payment required'**
  String get reservationDetailTimelinePaymentRequired;

  /// No description provided for @reservationDetailTimelinePaymentCompleted.
  ///
  /// In en, this message translates to:
  /// **'Payment completed'**
  String get reservationDetailTimelinePaymentCompleted;

  /// No description provided for @reservationDetailTimelineReadyPickup.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get reservationDetailTimelineReadyPickup;

  /// No description provided for @reservationDetailTimelineReadyDelivery.
  ///
  /// In en, this message translates to:
  /// **'Ready for delivery'**
  String get reservationDetailTimelineReadyDelivery;

  /// No description provided for @reservationDetailTimelineCompleted.
  ///
  /// In en, this message translates to:
  /// **'Reservation completed'**
  String get reservationDetailTimelineCompleted;

  /// No description provided for @reservationDetailTimelineCancelled.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled'**
  String get reservationDetailTimelineCancelled;

  /// No description provided for @reservationDetailTimelineRefunded.
  ///
  /// In en, this message translates to:
  /// **'Payment refunded'**
  String get reservationDetailTimelineRefunded;

  /// No description provided for @reservationDetailTimelineUnderReview.
  ///
  /// In en, this message translates to:
  /// **'Under admin review'**
  String get reservationDetailTimelineUnderReview;

  /// No description provided for @reservationDetailPaymentTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get reservationDetailPaymentTitle;

  /// No description provided for @reservationDetailPaymentRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment required'**
  String get reservationDetailPaymentRequiredTitle;

  /// No description provided for @reservationDetailMaterialAmount.
  ///
  /// In en, this message translates to:
  /// **'Material amount'**
  String get reservationDetailMaterialAmount;

  /// No description provided for @reservationDetailDeliveryFeeAmount.
  ///
  /// In en, this message translates to:
  /// **'Delivery fee'**
  String get reservationDetailDeliveryFeeAmount;

  /// No description provided for @reservationDetailPickupFeeAmount.
  ///
  /// In en, this message translates to:
  /// **'Pickup fee'**
  String get reservationDetailPickupFeeAmount;

  /// No description provided for @reservationDetailRemainingAmount.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get reservationDetailRemainingAmount;

  /// No description provided for @reservationDetailTotalRequired.
  ///
  /// In en, this message translates to:
  /// **'Total required'**
  String get reservationDetailTotalRequired;

  /// No description provided for @contactSupplier.
  ///
  /// In en, this message translates to:
  /// **'Contact supplier'**
  String get contactSupplier;

  /// No description provided for @viewSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'View supplier profile'**
  String get viewSupplierProfile;

  /// No description provided for @reservationDetailFulfillmentTitle.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment'**
  String get reservationDetailFulfillmentTitle;

  /// No description provided for @reservationDetailQuickActionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Quick actions'**
  String get reservationDetailQuickActionsTitle;

  /// No description provided for @reservationDetailOverdueBanner.
  ///
  /// In en, this message translates to:
  /// **'Pickup window passed. Please contact the supplier or wait for follow-up.'**
  String get reservationDetailOverdueBanner;

  /// No description provided for @allReservations.
  ///
  /// In en, this message translates to:
  /// **'All reservations'**
  String get allReservations;

  /// No description provided for @loadingReservation.
  ///
  /// In en, this message translates to:
  /// **'Loading reservation'**
  String get loadingReservation;

  /// No description provided for @loadingReservationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Checking the latest reservation status.'**
  String get loadingReservationSubtitle;

  /// No description provided for @reservationLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load reservation'**
  String get reservationLoadError;

  /// No description provided for @checkoutComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Checkout will be available soon. Your payment order is ready.'**
  String get checkoutComingSoon;

  /// No description provided for @checkoutPageTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete payment'**
  String get checkoutPageTitle;

  /// No description provided for @checkoutPageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm this reservation by paying the required amount securely.'**
  String get checkoutPageSubtitle;

  /// No description provided for @checkoutBreadcrumbHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get checkoutBreadcrumbHome;

  /// No description provided for @checkoutBreadcrumbReservations.
  ///
  /// In en, this message translates to:
  /// **'My reservations'**
  String get checkoutBreadcrumbReservations;

  /// No description provided for @checkoutBreadcrumbDetails.
  ///
  /// In en, this message translates to:
  /// **'Reservation details'**
  String get checkoutBreadcrumbDetails;

  /// No description provided for @checkoutBreadcrumbCheckout.
  ///
  /// In en, this message translates to:
  /// **'Checkout'**
  String get checkoutBreadcrumbCheckout;

  /// No description provided for @checkoutStepSummary.
  ///
  /// In en, this message translates to:
  /// **'Payment summary'**
  String get checkoutStepSummary;

  /// No description provided for @checkoutStepMethod.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get checkoutStepMethod;

  /// No description provided for @checkoutStepConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm order'**
  String get checkoutStepConfirm;

  /// No description provided for @checkoutStepResult.
  ///
  /// In en, this message translates to:
  /// **'Result'**
  String get checkoutStepResult;

  /// No description provided for @checkoutReservationInfo.
  ///
  /// In en, this message translates to:
  /// **'Reservation information'**
  String get checkoutReservationInfo;

  /// No description provided for @checkoutOrderIdLabel.
  ///
  /// In en, this message translates to:
  /// **'Reservation'**
  String get checkoutOrderIdLabel;

  /// No description provided for @checkoutReservationDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get checkoutReservationDateLabel;

  /// No description provided for @checkoutReservationStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get checkoutReservationStatusLabel;

  /// No description provided for @checkoutPickupWindowLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup window'**
  String get checkoutPickupWindowLabel;

  /// No description provided for @checkoutViewReservationDetails.
  ///
  /// In en, this message translates to:
  /// **'View reservation details'**
  String get checkoutViewReservationDetails;

  /// No description provided for @checkoutQuantityLabel.
  ///
  /// In en, this message translates to:
  /// **'{count} unit(s)'**
  String checkoutQuantityLabel(int count);

  /// No description provided for @checkoutFulfillmentPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup from supplier'**
  String get checkoutFulfillmentPickup;

  /// No description provided for @checkoutFulfillmentDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get checkoutFulfillmentDelivery;

  /// No description provided for @checkoutVerifiedSupplier.
  ///
  /// In en, this message translates to:
  /// **'Verified supplier'**
  String get checkoutVerifiedSupplier;

  /// No description provided for @checkoutAmountSummaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Amount summary'**
  String get checkoutAmountSummaryTitle;

  /// No description provided for @checkoutItemPrice.
  ///
  /// In en, this message translates to:
  /// **'Item price'**
  String get checkoutItemPrice;

  /// No description provided for @checkoutDeliveryFees.
  ///
  /// In en, this message translates to:
  /// **'Delivery fees'**
  String get checkoutDeliveryFees;

  /// No description provided for @checkoutTotalRequired.
  ///
  /// In en, this message translates to:
  /// **'Total required'**
  String get checkoutTotalRequired;

  /// No description provided for @checkoutPreviouslyPaid.
  ///
  /// In en, this message translates to:
  /// **'Previously paid'**
  String get checkoutPreviouslyPaid;

  /// No description provided for @checkoutRemainingAmount.
  ///
  /// In en, this message translates to:
  /// **'Remaining amount'**
  String get checkoutRemainingAmount;

  /// No description provided for @checkoutChooseWhatToPay.
  ///
  /// In en, this message translates to:
  /// **'Choose what you want to pay'**
  String get checkoutChooseWhatToPay;

  /// No description provided for @checkoutCombinedPaymentTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment covers'**
  String get checkoutCombinedPaymentTitle;

  /// No description provided for @checkoutCombinedPaymentHint.
  ///
  /// In en, this message translates to:
  /// **'Outstanding material and delivery amounts are collected together in one checkout session.'**
  String get checkoutCombinedPaymentHint;

  /// No description provided for @checkoutPurposeMaterialTitle.
  ///
  /// In en, this message translates to:
  /// **'Material subtotal'**
  String get checkoutPurposeMaterialTitle;

  /// No description provided for @checkoutPurposeMaterialHint.
  ///
  /// In en, this message translates to:
  /// **'Pays the outstanding material amount for this reservation.'**
  String get checkoutPurposeMaterialHint;

  /// No description provided for @checkoutPurposeDeliveryTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery fee'**
  String get checkoutPurposeDeliveryTitle;

  /// No description provided for @checkoutPurposeDeliveryHint.
  ///
  /// In en, this message translates to:
  /// **'Pays the remaining delivery fee for this reservation.'**
  String get checkoutPurposeDeliveryHint;

  /// No description provided for @checkoutOtherOrderHint.
  ///
  /// In en, this message translates to:
  /// **'Any remaining amounts for this reservation are included in this checkout session.'**
  String get checkoutOtherOrderHint;

  /// No description provided for @checkoutPaymentIncludesTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment includes'**
  String get checkoutPaymentIncludesTitle;

  /// No description provided for @checkoutIncludesConfirmReservation.
  ///
  /// In en, this message translates to:
  /// **'Confirming the reservation'**
  String get checkoutIncludesConfirmReservation;

  /// No description provided for @checkoutIncludesPickupCode.
  ///
  /// In en, this message translates to:
  /// **'Unlocking the pickup code when ready'**
  String get checkoutIncludesPickupCode;

  /// No description provided for @checkoutIncludesDeliveryDispatch.
  ///
  /// In en, this message translates to:
  /// **'Allowing delivery dispatch when ready'**
  String get checkoutIncludesDeliveryDispatch;

  /// No description provided for @checkoutSecurePaymentTitle.
  ///
  /// In en, this message translates to:
  /// **'Secure payment'**
  String get checkoutSecurePaymentTitle;

  /// No description provided for @checkoutSecurePaymentBody.
  ///
  /// In en, this message translates to:
  /// **'Your payment session is encrypted. ImpactLoop never stores card details — checkout runs through the secure Mock payment provider for this environment.'**
  String get checkoutSecurePaymentBody;

  /// No description provided for @checkoutContinueToPayment.
  ///
  /// In en, this message translates to:
  /// **'Continue to payment'**
  String get checkoutContinueToPayment;

  /// No description provided for @checkoutReviewOrder.
  ///
  /// In en, this message translates to:
  /// **'Review order'**
  String get checkoutReviewOrder;

  /// No description provided for @checkoutConfirmPayment.
  ///
  /// In en, this message translates to:
  /// **'Confirm payment'**
  String get checkoutConfirmPayment;

  /// No description provided for @checkoutMockProviderTitle.
  ///
  /// In en, this message translates to:
  /// **'Mock payment provider'**
  String get checkoutMockProviderTitle;

  /// No description provided for @checkoutMockProviderBody.
  ///
  /// In en, this message translates to:
  /// **'This environment uses ImpactLoop’s secure Mock provider. Completing payment updates verified backend payment state — a button press alone is not success.'**
  String get checkoutMockProviderBody;

  /// No description provided for @checkoutMockPaySecurely.
  ///
  /// In en, this message translates to:
  /// **'Complete mock payment'**
  String get checkoutMockPaySecurely;

  /// No description provided for @checkoutMockSimulateDecline.
  ///
  /// In en, this message translates to:
  /// **'Simulate decline'**
  String get checkoutMockSimulateDecline;

  /// No description provided for @checkoutMockCancelAttempt.
  ///
  /// In en, this message translates to:
  /// **'Cancel this attempt'**
  String get checkoutMockCancelAttempt;

  /// No description provided for @checkoutReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Review order'**
  String get checkoutReviewTitle;

  /// No description provided for @checkoutReviewMethodLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get checkoutReviewMethodLabel;

  /// No description provided for @checkoutReviewMethodValue.
  ///
  /// In en, this message translates to:
  /// **'ImpactLoop Mock provider'**
  String get checkoutReviewMethodValue;

  /// No description provided for @checkoutReviewAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount to pay'**
  String get checkoutReviewAmountLabel;

  /// No description provided for @checkoutProcessingTitle.
  ///
  /// In en, this message translates to:
  /// **'Processing payment…'**
  String get checkoutProcessingTitle;

  /// No description provided for @checkoutProcessingBody.
  ///
  /// In en, this message translates to:
  /// **'Please do not close this page. This may take a few seconds while we verify the payment with the provider.'**
  String get checkoutProcessingBody;

  /// No description provided for @checkoutSuccessTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment successful!'**
  String get checkoutSuccessTitle;

  /// No description provided for @checkoutSuccessBody.
  ///
  /// In en, this message translates to:
  /// **'Reservation payment is confirmed. Return to reservation details for the next step.'**
  String get checkoutSuccessBody;

  /// No description provided for @checkoutSuccessTransactionLabel.
  ///
  /// In en, this message translates to:
  /// **'Checkout session'**
  String get checkoutSuccessTransactionLabel;

  /// No description provided for @checkoutBackToReservation.
  ///
  /// In en, this message translates to:
  /// **'Back to reservation details'**
  String get checkoutBackToReservation;

  /// No description provided for @checkoutViewAllReservations.
  ///
  /// In en, this message translates to:
  /// **'View all my reservations'**
  String get checkoutViewAllReservations;

  /// No description provided for @checkoutFailureTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment failed'**
  String get checkoutFailureTitle;

  /// No description provided for @checkoutFailureBody.
  ///
  /// In en, this message translates to:
  /// **'We could not complete this payment. You can retry securely without creating a duplicate submission.'**
  String get checkoutFailureBody;

  /// No description provided for @checkoutRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get checkoutRetry;

  /// No description provided for @checkoutChangeMethod.
  ///
  /// In en, this message translates to:
  /// **'Return to payment method'**
  String get checkoutChangeMethod;

  /// No description provided for @checkoutCancelledTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment cancelled'**
  String get checkoutCancelledTitle;

  /// No description provided for @checkoutCancelledBody.
  ///
  /// In en, this message translates to:
  /// **'This payment attempt was cancelled. You can start a new secure checkout when ready.'**
  String get checkoutCancelledBody;

  /// No description provided for @checkoutExpiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Checkout expired'**
  String get checkoutExpiredTitle;

  /// No description provided for @checkoutExpiredBody.
  ///
  /// In en, this message translates to:
  /// **'This payment attempt expired before completion. Start a new checkout to continue.'**
  String get checkoutExpiredBody;

  /// No description provided for @checkoutAlreadyPaidTitle.
  ///
  /// In en, this message translates to:
  /// **'Already paid'**
  String get checkoutAlreadyPaidTitle;

  /// No description provided for @checkoutAlreadyPaidBody.
  ///
  /// In en, this message translates to:
  /// **'This reservation payment is already settled. No further payment is required.'**
  String get checkoutAlreadyPaidBody;

  /// No description provided for @checkoutRefundPendingTitle.
  ///
  /// In en, this message translates to:
  /// **'Refund pending'**
  String get checkoutRefundPendingTitle;

  /// No description provided for @checkoutRefundPendingBody.
  ///
  /// In en, this message translates to:
  /// **'A refund is in progress for this reservation payment. Checkout is not available.'**
  String get checkoutRefundPendingBody;

  /// No description provided for @checkoutPartiallyRefundedTitle.
  ///
  /// In en, this message translates to:
  /// **'Partial refund'**
  String get checkoutPartiallyRefundedTitle;

  /// No description provided for @checkoutPartiallyRefundedBody.
  ///
  /// In en, this message translates to:
  /// **'A refund is in progress or partially completed for this reservation. Checkout is not available until payment state is clear.'**
  String get checkoutPartiallyRefundedBody;

  /// No description provided for @checkoutRefundedTitle.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get checkoutRefundedTitle;

  /// No description provided for @checkoutRefundedBody.
  ///
  /// In en, this message translates to:
  /// **'This reservation payment was refunded. A new payment cycle may be required from reservation details.'**
  String get checkoutRefundedBody;

  /// No description provided for @checkoutOrderCancelledTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment cancelled'**
  String get checkoutOrderCancelledTitle;

  /// No description provided for @checkoutOrderCancelledBody.
  ///
  /// In en, this message translates to:
  /// **'This reservation payment was cancelled and cannot be checked out.'**
  String get checkoutOrderCancelledBody;

  /// No description provided for @checkoutInvariantBlockedTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment needs review'**
  String get checkoutInvariantBlockedTitle;

  /// No description provided for @checkoutInvariantBlockedBody.
  ///
  /// In en, this message translates to:
  /// **'Checkout is blocked until this reservation’s payment state is reviewed. Return to reservation details or contact support.'**
  String get checkoutInvariantBlockedBody;

  /// No description provided for @checkoutLoadErrorTitle.
  ///
  /// In en, this message translates to:
  /// **'Could not load checkout'**
  String get checkoutLoadErrorTitle;

  /// No description provided for @checkoutLoadErrorBody.
  ///
  /// In en, this message translates to:
  /// **'We could not load this reservation checkout. Check your connection and try again.'**
  String get checkoutLoadErrorBody;

  /// No description provided for @checkoutMissingTitle.
  ///
  /// In en, this message translates to:
  /// **'Checkout unavailable'**
  String get checkoutMissingTitle;

  /// No description provided for @checkoutMissingBody.
  ///
  /// In en, this message translates to:
  /// **'This reservation checkout was not found or you do not have access to it.'**
  String get checkoutMissingBody;

  /// No description provided for @checkoutRetryLoad.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get checkoutRetryLoad;

  /// No description provided for @checkoutSubmittingGuard.
  ///
  /// In en, this message translates to:
  /// **'Payment is already in progress. Please wait.'**
  String get checkoutSubmittingGuard;

  /// No description provided for @checkoutableOrderReadyHint.
  ///
  /// In en, this message translates to:
  /// **'A checkoutable payment is ready for this reservation.'**
  String get checkoutableOrderReadyHint;

  /// No description provided for @paymentStatusRequired.
  ///
  /// In en, this message translates to:
  /// **'Payment required'**
  String get paymentStatusRequired;

  /// No description provided for @paymentStatusPartial.
  ///
  /// In en, this message translates to:
  /// **'Partial payment'**
  String get paymentStatusPartial;

  /// No description provided for @paymentStatusProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing'**
  String get paymentStatusProcessing;

  /// No description provided for @paymentStatusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get paymentStatusPaid;

  /// No description provided for @paymentStatusRefundPending.
  ///
  /// In en, this message translates to:
  /// **'Refund pending'**
  String get paymentStatusRefundPending;

  /// No description provided for @paymentStatusRefunded.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get paymentStatusRefunded;

  /// No description provided for @paymentStatusNeedsReview.
  ///
  /// In en, this message translates to:
  /// **'Needs review'**
  String get paymentStatusNeedsReview;

  /// No description provided for @paymentSummaryUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Payment status unavailable'**
  String get paymentSummaryUnavailable;

  /// No description provided for @paymentSummaryUnavailableHint.
  ///
  /// In en, this message translates to:
  /// **'Reservation details are still available. Pull to refresh or try again.'**
  String get paymentSummaryUnavailableHint;

  /// No description provided for @reservationListStatusWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get reservationListStatusWaiting;

  /// No description provided for @reservationListStatusNeedsAction.
  ///
  /// In en, this message translates to:
  /// **'Action required'**
  String get reservationListStatusNeedsAction;

  /// No description provided for @reservationListStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get reservationListStatusAccepted;

  /// No description provided for @reservationListStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get reservationListStatusCompleted;

  /// No description provided for @reservationListStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get reservationListStatusClosed;

  /// No description provided for @reservationListStatusNeedsReview.
  ///
  /// In en, this message translates to:
  /// **'Needs review'**
  String get reservationListStatusNeedsReview;

  /// No description provided for @reservationNextStepDeliveryFeeRemaining.
  ///
  /// In en, this message translates to:
  /// **'A payment was received, and the delivery fee is still required.'**
  String get reservationNextStepDeliveryFeeRemaining;

  /// No description provided for @reservationNextStepWaitingSupplier.
  ///
  /// In en, this message translates to:
  /// **'Waiting for supplier approval.'**
  String get reservationNextStepWaitingSupplier;

  /// No description provided for @reservationNextStepConfirmProposal.
  ///
  /// In en, this message translates to:
  /// **'Review and confirm the supplier proposal.'**
  String get reservationNextStepConfirmProposal;

  /// No description provided for @reservationNextStepPickupCodeWindow.
  ///
  /// In en, this message translates to:
  /// **'Payment received. The pickup code will become available inside the pickup window.'**
  String get reservationNextStepPickupCodeWindow;

  /// No description provided for @reservationNextStepPickupCodeReady.
  ///
  /// In en, this message translates to:
  /// **'Pickup code is ready on the reservation details page.'**
  String get reservationNextStepPickupCodeReady;

  /// No description provided for @reservationNextStepFindingDriver.
  ///
  /// In en, this message translates to:
  /// **'Looking for a driver.'**
  String get reservationNextStepFindingDriver;

  /// No description provided for @reservationNextStepTrackDelivery.
  ///
  /// In en, this message translates to:
  /// **'Your delivery is in progress. Track it for live updates.'**
  String get reservationNextStepTrackDelivery;

  /// No description provided for @reservationNextStepRefundProcessing.
  ///
  /// In en, this message translates to:
  /// **'Your refund is being processed.'**
  String get reservationNextStepRefundProcessing;

  /// No description provided for @reservationNextStepRefunded.
  ///
  /// In en, this message translates to:
  /// **'This payment was refunded.'**
  String get reservationNextStepRefunded;

  /// No description provided for @reservationNextStepUnderReview.
  ///
  /// In en, this message translates to:
  /// **'This case is under review. No action is required from you right now.'**
  String get reservationNextStepUnderReview;

  /// No description provided for @reservationNextStepPaymentProcessing.
  ///
  /// In en, this message translates to:
  /// **'Payment is being processed.'**
  String get reservationNextStepPaymentProcessing;

  /// No description provided for @reservationNextStepPaymentUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Payment status is temporarily unavailable. Open details or refresh.'**
  String get reservationNextStepPaymentUnavailable;

  /// No description provided for @reservationNextStepReadyPickup.
  ///
  /// In en, this message translates to:
  /// **'Your reservation is accepted. Open details for pickup information.'**
  String get reservationNextStepReadyPickup;

  /// No description provided for @reservationNextStepAcceptedDelivery.
  ///
  /// In en, this message translates to:
  /// **'Your reservation is accepted. Delivery will continue once ready.'**
  String get reservationNextStepAcceptedDelivery;

  /// No description provided for @reservationNextStepDelivered.
  ///
  /// In en, this message translates to:
  /// **'Materials were delivered successfully.'**
  String get reservationNextStepDelivered;

  /// No description provided for @reservationNextStepCompletedPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup was completed successfully.'**
  String get reservationNextStepCompletedPickup;

  /// No description provided for @reservationNextStepClosed.
  ///
  /// In en, this message translates to:
  /// **'This reservation is closed.'**
  String get reservationNextStepClosed;

  /// No description provided for @reservationNextStepViewDetails.
  ///
  /// In en, this message translates to:
  /// **'Open details for the full status.'**
  String get reservationNextStepViewDetails;

  /// No description provided for @payNow.
  ///
  /// In en, this message translates to:
  /// **'Pay now'**
  String get payNow;

  /// No description provided for @completePayment.
  ///
  /// In en, this message translates to:
  /// **'Complete payment'**
  String get completePayment;

  /// No description provided for @viewPickupCode.
  ///
  /// In en, this message translates to:
  /// **'View pickup code'**
  String get viewPickupCode;

  /// No description provided for @reservationDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Reservation date'**
  String get reservationDateLabel;

  /// No description provided for @supplierLabel.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get supplierLabel;

  /// No description provided for @quantityLabelShort.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get quantityLabelShort;

  /// No description provided for @fulfillmentPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get fulfillmentPickup;

  /// No description provided for @fulfillmentDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get fulfillmentDelivery;

  /// No description provided for @skeletonLoadingReservations.
  ///
  /// In en, this message translates to:
  /// **'Loading your reservations'**
  String get skeletonLoadingReservations;

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

  /// No description provided for @confirmFlexibleDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Confirm delivery window'**
  String get confirmFlexibleDeliveryWindow;

  /// No description provided for @flexibleDeliveryNeedsWindowHint.
  ///
  /// In en, this message translates to:
  /// **'You left delivery timing open. Confirm the supplier proposal or choose any delivery window after the earliest time below.'**
  String get flexibleDeliveryNeedsWindowHint;

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

  /// No description provided for @reservationFlexibleScheduleReady.
  ///
  /// In en, this message translates to:
  /// **'The supplier set a schedule. Confirm the delivery window to continue.'**
  String get reservationFlexibleScheduleReady;

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

  /// No description provided for @becomeSupplierActionDescription.
  ///
  /// In en, this message translates to:
  /// **'Start the supplier setup path for your account.'**
  String get becomeSupplierActionDescription;

  /// No description provided for @supplierProfileActionDescription.
  ///
  /// In en, this message translates to:
  /// **'Update your supplier profile and pickup details.'**
  String get supplierProfileActionDescription;

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

  /// No description provided for @impactSnapshotSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Reuse progress from completed pickups and project builds.'**
  String get impactSnapshotSubtitle;

  /// No description provided for @impactSnapshotDescription.
  ///
  /// In en, this message translates to:
  /// **'Complete material pickups and project builds to start tracking your reuse impact.'**
  String get impactSnapshotDescription;

  /// No description provided for @impactSnapshotCompletedPickups.
  ///
  /// In en, this message translates to:
  /// **'Completed pickups'**
  String get impactSnapshotCompletedPickups;

  /// No description provided for @impactSnapshotCompletedBuilds.
  ///
  /// In en, this message translates to:
  /// **'Completed builds'**
  String get impactSnapshotCompletedBuilds;

  /// No description provided for @impactSnapshotActiveReservations.
  ///
  /// In en, this message translates to:
  /// **'Active reservations'**
  String get impactSnapshotActiveReservations;

  /// No description provided for @impactSnapshotActiveBuilds.
  ///
  /// In en, this message translates to:
  /// **'Builds in progress'**
  String get impactSnapshotActiveBuilds;

  /// No description provided for @impactSnapshotInProgressNote.
  ///
  /// In en, this message translates to:
  /// **'{activeReservations} active reservations and {activeBuilds} builds in progress.'**
  String impactSnapshotInProgressNote(
    String activeReservations,
    String activeBuilds,
  );

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

  /// No description provided for @deliveryRequestedFree.
  ///
  /// In en, this message translates to:
  /// **'Delivery requested. Delivery is free for this order.'**
  String get deliveryRequestedFree;

  /// No description provided for @deliveryFeePaymentRequired.
  ///
  /// In en, this message translates to:
  /// **'Delivery was set up. Pay the delivery fee to start fulfillment.'**
  String get deliveryFeePaymentRequired;

  /// No description provided for @freeDeliveryLabel.
  ///
  /// In en, this message translates to:
  /// **'Free delivery'**
  String get freeDeliveryLabel;

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

  /// No description provided for @supplierSupplierRole.
  ///
  /// In en, this message translates to:
  /// **'Supplier role'**
  String get supplierSupplierRole;

  /// No description provided for @supplierOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get supplierOverview;

  /// No description provided for @supplierMyMaterials.
  ///
  /// In en, this message translates to:
  /// **'My Materials'**
  String get supplierMyMaterials;

  /// No description provided for @supplierAddMaterial.
  ///
  /// In en, this message translates to:
  /// **'Add Material'**
  String get supplierAddMaterial;

  /// No description provided for @supplierAdd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get supplierAdd;

  /// No description provided for @supplierIncomingRequests.
  ///
  /// In en, this message translates to:
  /// **'Incoming Requests'**
  String get supplierIncomingRequests;

  /// No description provided for @supplierRequests.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get supplierRequests;

  /// No description provided for @supplierPickupSchedule.
  ///
  /// In en, this message translates to:
  /// **'Pickup Schedule'**
  String get supplierPickupSchedule;

  /// No description provided for @supplierSupplierPortal.
  ///
  /// In en, this message translates to:
  /// **'Supplier Portal'**
  String get supplierSupplierPortal;

  /// No description provided for @supplierTheme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get supplierTheme;

  /// No description provided for @supplierViewSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'View supplier profile'**
  String get supplierViewSupplierProfile;

  /// No description provided for @supplierTrackMaterialsRequestsAndImpact.
  ///
  /// In en, this message translates to:
  /// **'Track materials, requests, and impact.'**
  String get supplierTrackMaterialsRequestsAndImpact;

  /// No description provided for @supplierListSurplusMaterialsForReuseBy.
  ///
  /// In en, this message translates to:
  /// **'List surplus materials for reuse by learners and makers.'**
  String get supplierListSurplusMaterialsForReuseBy;

  /// No description provided for @supplierManagePublicSupplierDetailsAndPickup.
  ///
  /// In en, this message translates to:
  /// **'Manage public supplier details and pickup location.'**
  String get supplierManagePublicSupplierDetailsAndPickup;

  /// No description provided for @supplierReviewLearnerRequestsAndSchedulePickups.
  ///
  /// In en, this message translates to:
  /// **'Review learner requests and schedule pickups.'**
  String get supplierReviewLearnerRequestsAndSchedulePickups;

  /// No description provided for @supplierTrackAcceptedPickupsAndUpcomingHandovers.
  ///
  /// In en, this message translates to:
  /// **'Track accepted pickups and upcoming handovers.'**
  String get supplierTrackAcceptedPickupsAndUpcomingHandovers;

  /// No description provided for @supplierReviewUpdatesAndActionsThatNeed.
  ///
  /// In en, this message translates to:
  /// **'Review updates and actions that need your attention.'**
  String get supplierReviewUpdatesAndActionsThatNeed;

  /// No description provided for @supplierComingSoonInTheSupplierPortal.
  ///
  /// In en, this message translates to:
  /// **'Coming soon in the Supplier Portal.'**
  String get supplierComingSoonInTheSupplierPortal;

  /// No description provided for @supplierManageYourSupplierActivity.
  ///
  /// In en, this message translates to:
  /// **'Manage your supplier activity.'**
  String get supplierManageYourSupplierActivity;

  /// No description provided for @supplierManageYourListedSurplusMaterials.
  ///
  /// In en, this message translates to:
  /// **'Manage your listed surplus materials.'**
  String get supplierManageYourListedSurplusMaterials;

  /// No description provided for @supplierSearchYourMaterials.
  ///
  /// In en, this message translates to:
  /// **'Search your materials'**
  String get supplierSearchYourMaterials;

  /// No description provided for @supplierTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get supplierTotal;

  /// No description provided for @supplierPendingReserved.
  ///
  /// In en, this message translates to:
  /// **'Pending / Reserved'**
  String get supplierPendingReserved;

  /// No description provided for @supplierUnavailable2.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get supplierUnavailable2;

  /// No description provided for @supplierYouHaveNotListedAnyMaterials.
  ///
  /// In en, this message translates to:
  /// **'You have not listed any materials yet.'**
  String get supplierYouHaveNotListedAnyMaterials;

  /// No description provided for @supplierShareSurplusMaterialsWithLearnersAnd.
  ///
  /// In en, this message translates to:
  /// **'Share surplus materials with learners and makers from your workshop.'**
  String get supplierShareSurplusMaterialsWithLearnersAnd;

  /// No description provided for @supplierAddYourFirstMaterial.
  ///
  /// In en, this message translates to:
  /// **'Add your first material'**
  String get supplierAddYourFirstMaterial;

  /// No description provided for @supplierWeCouldNotLoadYourMaterials.
  ///
  /// In en, this message translates to:
  /// **'We could not load your materials.'**
  String get supplierWeCouldNotLoadYourMaterials;

  /// No description provided for @supplierNoMaterialsMatchYourFilters.
  ///
  /// In en, this message translates to:
  /// **'No materials match your filters.'**
  String get supplierNoMaterialsMatchYourFilters;

  /// No description provided for @supplierTryClearingFiltersOrAdjustingYour.
  ///
  /// In en, this message translates to:
  /// **'Try clearing filters or adjusting your search.'**
  String get supplierTryClearingFiltersOrAdjustingYour;

  /// No description provided for @supplierLikes.
  ///
  /// In en, this message translates to:
  /// **'Likes'**
  String get supplierLikes;

  /// No description provided for @supplierEngagement.
  ///
  /// In en, this message translates to:
  /// **'Engagement'**
  String get supplierEngagement;

  /// No description provided for @supplierActiveDemand.
  ///
  /// In en, this message translates to:
  /// **'Active demand'**
  String get supplierActiveDemand;

  /// No description provided for @supplierDemandInterestScore.
  ///
  /// In en, this message translates to:
  /// **'Demand / interest score'**
  String get supplierDemandInterestScore;

  /// No description provided for @supplierReuseHistory.
  ///
  /// In en, this message translates to:
  /// **'Reuse history'**
  String get supplierReuseHistory;

  /// No description provided for @supplierReservationsForThisMaterial.
  ///
  /// In en, this message translates to:
  /// **'Reservations for this material'**
  String get supplierReservationsForThisMaterial;

  /// No description provided for @supplierDemandIndicators.
  ///
  /// In en, this message translates to:
  /// **'Demand indicators'**
  String get supplierDemandIndicators;

  /// No description provided for @supplierNoReservationsForThisMaterialYet.
  ///
  /// In en, this message translates to:
  /// **'No reservations for this material yet.'**
  String get supplierNoReservationsForThisMaterialYet;

  /// No description provided for @supplierNoDemandSignalsYet.
  ///
  /// In en, this message translates to:
  /// **'No demand signals yet.'**
  String get supplierNoDemandSignalsYet;

  /// No description provided for @supplierNoActiveRequestsRightNowThis.
  ///
  /// In en, this message translates to:
  /// **'No active requests right now. This material has already been reused.'**
  String get supplierNoActiveRequestsRightNowThis;

  /// No description provided for @supplierThisMaterialHasActiveDemand.
  ///
  /// In en, this message translates to:
  /// **'This material has active demand.'**
  String get supplierThisMaterialHasActiveDemand;

  /// No description provided for @supplierLearnersAreShowingInterestButNo.
  ///
  /// In en, this message translates to:
  /// **'Learners are showing interest, but no reservations yet.'**
  String get supplierLearnersAreShowingInterestButNo;

  /// No description provided for @supplierNoActiveDemandYet.
  ///
  /// In en, this message translates to:
  /// **'No active demand yet.'**
  String get supplierNoActiveDemandYet;

  /// No description provided for @supplierActiveDemandScore.
  ///
  /// In en, this message translates to:
  /// **'Active demand score'**
  String get supplierActiveDemandScore;

  /// No description provided for @supplierOverallDemandScore.
  ///
  /// In en, this message translates to:
  /// **'Overall demand score'**
  String get supplierOverallDemandScore;

  /// No description provided for @supplierPercent.
  ///
  /// In en, this message translates to:
  /// **'{percent}%'**
  String supplierPercent(String percent);

  /// No description provided for @supplierBasedOnViewsLikesActiveRequests.
  ///
  /// In en, this message translates to:
  /// **'Based on views, likes, active requests, and completed reuses.'**
  String get supplierBasedOnViewsLikesActiveRequests;

  /// No description provided for @supplierCompletedReservations.
  ///
  /// In en, this message translates to:
  /// **'Completed reservations'**
  String get supplierCompletedReservations;

  /// No description provided for @supplierCompletedReuses.
  ///
  /// In en, this message translates to:
  /// **'Completed reuses'**
  String get supplierCompletedReuses;

  /// No description provided for @supplierLastCompleted.
  ///
  /// In en, this message translates to:
  /// **'Last completed'**
  String get supplierLastCompleted;

  /// No description provided for @supplierMarkUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Mark unavailable'**
  String get supplierMarkUnavailable;

  /// No description provided for @supplierRestoreAvailable.
  ///
  /// In en, this message translates to:
  /// **'Restore available'**
  String get supplierRestoreAvailable;

  /// No description provided for @supplierHighDemand.
  ///
  /// In en, this message translates to:
  /// **'High demand'**
  String get supplierHighDemand;

  /// No description provided for @supplierOpenReservation.
  ///
  /// In en, this message translates to:
  /// **'Open reservation'**
  String get supplierOpenReservation;

  /// No description provided for @supplierPendingReservations.
  ///
  /// In en, this message translates to:
  /// **'Pending reservations'**
  String get supplierPendingReservations;

  /// No description provided for @supplierReservedReservations.
  ///
  /// In en, this message translates to:
  /// **'Reserved reservations'**
  String get supplierReservedReservations;

  /// No description provided for @supplierTotalActiveRequests.
  ///
  /// In en, this message translates to:
  /// **'Total active requests'**
  String get supplierTotalActiveRequests;

  /// No description provided for @supplierDemandScore.
  ///
  /// In en, this message translates to:
  /// **'Demand score'**
  String get supplierDemandScore;

  /// No description provided for @supplierAllPrices.
  ///
  /// In en, this message translates to:
  /// **'All prices'**
  String get supplierAllPrices;

  /// No description provided for @supplierStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get supplierStatus;

  /// No description provided for @supplierPrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get supplierPrice;

  /// No description provided for @supplierAllCategories.
  ///
  /// In en, this message translates to:
  /// **'All categories'**
  String get supplierAllCategories;

  /// No description provided for @supplierManage.
  ///
  /// In en, this message translates to:
  /// **'Manage'**
  String get supplierManage;

  /// No description provided for @supplierEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get supplierEdit;

  /// No description provided for @supplierEditMaterial.
  ///
  /// In en, this message translates to:
  /// **'Edit material'**
  String get supplierEditMaterial;

  /// No description provided for @supplierUpdateSafeListingDetailsPriceAnd.
  ///
  /// In en, this message translates to:
  /// **'Update safe listing details. Price and category changes require review.'**
  String get supplierUpdateSafeListingDetailsPriceAnd;

  /// No description provided for @supplierPriceCategoryLocationAndImagesAre.
  ///
  /// In en, this message translates to:
  /// **'Price, category, and location are not editable here yet.'**
  String get supplierPriceCategoryLocationAndImagesAre;

  /// No description provided for @supplierMaterialUpdatedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Material updated successfully.'**
  String get supplierMaterialUpdatedSuccessfully;

  /// No description provided for @supplierCouldNotUpdateMaterialPleaseTry.
  ///
  /// In en, this message translates to:
  /// **'Could not update material. Please try again.'**
  String get supplierCouldNotUpdateMaterialPleaseTry;

  /// No description provided for @supplierDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get supplierDelete;

  /// No description provided for @supplierDeleteMaterial.
  ///
  /// In en, this message translates to:
  /// **'Delete material?'**
  String get supplierDeleteMaterial;

  /// No description provided for @supplierThisWillRemoveTheMaterialFrom.
  ///
  /// In en, this message translates to:
  /// **'This will remove the material from your listings. This action cannot be undone.'**
  String get supplierThisWillRemoveTheMaterialFrom;

  /// No description provided for @supplierMaterialDeletedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Material deleted successfully.'**
  String get supplierMaterialDeletedSuccessfully;

  /// No description provided for @supplierCouldNotDeleteMaterialPleaseTry.
  ///
  /// In en, this message translates to:
  /// **'Could not delete material. Please try again.'**
  String get supplierCouldNotDeleteMaterialPleaseTry;

  /// No description provided for @supplierReusedMaterialsCannotBeDeletedBecause.
  ///
  /// In en, this message translates to:
  /// **'Reused materials cannot be deleted because they are part of reuse history.'**
  String get supplierReusedMaterialsCannotBeDeletedBecause;

  /// No description provided for @supplierCannotDeleteAMaterialWithActive.
  ///
  /// In en, this message translates to:
  /// **'Cannot delete a material with active requests.'**
  String get supplierCannotDeleteAMaterialWithActive;

  /// No description provided for @supplierThisMaterialCannotBeDeletedRight.
  ///
  /// In en, this message translates to:
  /// **'This material cannot be deleted right now.'**
  String get supplierThisMaterialCannotBeDeletedRight;

  /// No description provided for @supplierReusedMaterialsCannotBeEditedBecause.
  ///
  /// In en, this message translates to:
  /// **'Reused materials cannot be edited because they are part of reuse history.'**
  String get supplierReusedMaterialsCannotBeEditedBecause;

  /// No description provided for @supplierCannotEditAMaterialWithActive.
  ///
  /// In en, this message translates to:
  /// **'Cannot edit a material with active requests or blocked status.'**
  String get supplierCannotEditAMaterialWithActive;

  /// No description provided for @supplierThisMaterialCannotBeEditedRight.
  ///
  /// In en, this message translates to:
  /// **'This material cannot be edited right now.'**
  String get supplierThisMaterialCannotBeEditedRight;

  /// No description provided for @supplierEditingNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Editing not available'**
  String get supplierEditingNotAvailable;

  /// No description provided for @supplierSaveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get supplierSaveChanges;

  /// No description provided for @supplierReadOnly.
  ///
  /// In en, this message translates to:
  /// **'Read-only'**
  String get supplierReadOnly;

  /// No description provided for @supplierMaterialType.
  ///
  /// In en, this message translates to:
  /// **'Material type'**
  String get supplierMaterialType;

  /// No description provided for @supplierEditingListingsIsComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Editing listings is coming soon.'**
  String get supplierEditingListingsIsComingSoon;

  /// No description provided for @supplierPrevious.
  ///
  /// In en, this message translates to:
  /// **'Previous'**
  String get supplierPrevious;

  /// No description provided for @supplierNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get supplierNext;

  /// No description provided for @supplierPagePageOfTotalpages.
  ///
  /// In en, this message translates to:
  /// **'Page {page} of {totalPages}'**
  String supplierPagePageOfTotalpages(String page, String totalPages);

  /// No description provided for @supplierListedDate.
  ///
  /// In en, this message translates to:
  /// **'Listed {date}'**
  String supplierListedDate(String date);

  /// No description provided for @supplierMaterialNotFound.
  ///
  /// In en, this message translates to:
  /// **'Material not found'**
  String get supplierMaterialNotFound;

  /// No description provided for @supplierThisListingMayHaveBeenRemoved.
  ///
  /// In en, this message translates to:
  /// **'This listing may have been removed or is no longer available.'**
  String get supplierThisListingMayHaveBeenRemoved;

  /// No description provided for @supplierBackToMyMaterials.
  ///
  /// In en, this message translates to:
  /// **'Back to My Materials'**
  String get supplierBackToMyMaterials;

  /// No description provided for @supplierViews.
  ///
  /// In en, this message translates to:
  /// **'Views'**
  String get supplierViews;

  /// No description provided for @supplierCreated.
  ///
  /// In en, this message translates to:
  /// **'Created'**
  String get supplierCreated;

  /// No description provided for @supplierUpdated.
  ///
  /// In en, this message translates to:
  /// **'Updated'**
  String get supplierUpdated;

  /// No description provided for @supplierSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'Supplier Profile'**
  String get supplierSupplierProfile;

  /// No description provided for @supplierCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get supplierCancel;

  /// No description provided for @supplierBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get supplierBack;

  /// No description provided for @supplierBackToDashboard.
  ///
  /// In en, this message translates to:
  /// **'Back to dashboard'**
  String get supplierBackToDashboard;

  /// No description provided for @supplierAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get supplierAccept;

  /// No description provided for @supplierDecline.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get supplierDecline;

  /// No description provided for @supplierLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get supplierLoading;

  /// No description provided for @supplierRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get supplierRequired;

  /// No description provided for @supplierOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get supplierOptional;

  /// No description provided for @supplierComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get supplierComingSoon;

  /// No description provided for @supplierWelcomeBackName.
  ///
  /// In en, this message translates to:
  /// **'Welcome back, {name}'**
  String supplierWelcomeBackName(String name);

  /// No description provided for @supplierTrackYourMaterialsRespondToRequests.
  ///
  /// In en, this message translates to:
  /// **'Track your materials, respond to requests, and grow reuse impact.'**
  String get supplierTrackYourMaterialsRespondToRequests;

  /// No description provided for @supplierAddMaterial2.
  ///
  /// In en, this message translates to:
  /// **'Add material'**
  String get supplierAddMaterial2;

  /// No description provided for @supplierViewRequests.
  ///
  /// In en, this message translates to:
  /// **'View requests'**
  String get supplierViewRequests;

  /// No description provided for @supplierActiveMaterials.
  ///
  /// In en, this message translates to:
  /// **'Active materials'**
  String get supplierActiveMaterials;

  /// No description provided for @supplierPendingRequests.
  ///
  /// In en, this message translates to:
  /// **'Pending requests'**
  String get supplierPendingRequests;

  /// No description provided for @supplierScheduledPickups.
  ///
  /// In en, this message translates to:
  /// **'Scheduled pickups'**
  String get supplierScheduledPickups;

  /// No description provided for @supplierReusedMaterials.
  ///
  /// In en, this message translates to:
  /// **'Reused materials'**
  String get supplierReusedMaterials;

  /// No description provided for @supplierTotalMaterials.
  ///
  /// In en, this message translates to:
  /// **'Total materials'**
  String get supplierTotalMaterials;

  /// No description provided for @supplierAvailableMaterials.
  ///
  /// In en, this message translates to:
  /// **'Available materials'**
  String get supplierAvailableMaterials;

  /// No description provided for @supplierReservedMaterials.
  ///
  /// In en, this message translates to:
  /// **'Reserved materials'**
  String get supplierReservedMaterials;

  /// No description provided for @supplierTotalMaterialViews.
  ///
  /// In en, this message translates to:
  /// **'Total material views'**
  String get supplierTotalMaterialViews;

  /// No description provided for @supplierTotalMaterialLikes.
  ///
  /// In en, this message translates to:
  /// **'Total material likes'**
  String get supplierTotalMaterialLikes;

  /// No description provided for @supplierFollowers.
  ///
  /// In en, this message translates to:
  /// **'Followers'**
  String get supplierFollowers;

  /// No description provided for @supplierRecentReservationRequests.
  ///
  /// In en, this message translates to:
  /// **'Recent reservation requests'**
  String get supplierRecentReservationRequests;

  /// No description provided for @supplierNoReservationRequestsYet.
  ///
  /// In en, this message translates to:
  /// **'No reservation requests yet.'**
  String get supplierNoReservationRequestsYet;

  /// No description provided for @supplierMostViewedMaterial.
  ///
  /// In en, this message translates to:
  /// **'Most viewed material'**
  String get supplierMostViewedMaterial;

  /// No description provided for @supplierSupplierEngagement.
  ///
  /// In en, this message translates to:
  /// **'Supplier engagement'**
  String get supplierSupplierEngagement;

  /// No description provided for @supplierAccountTotals.
  ///
  /// In en, this message translates to:
  /// **'Account totals'**
  String get supplierAccountTotals;

  /// No description provided for @supplierNoViewedMaterialsYet.
  ///
  /// In en, this message translates to:
  /// **'No viewed materials yet.'**
  String get supplierNoViewedMaterialsYet;

  /// No description provided for @supplierHighDemandMaterials.
  ///
  /// In en, this message translates to:
  /// **'High demand materials'**
  String get supplierHighDemandMaterials;

  /// No description provided for @supplierMaterialsWithActiveReservationInterest.
  ///
  /// In en, this message translates to:
  /// **'Materials with active reservation interest.'**
  String get supplierMaterialsWithActiveReservationInterest;

  /// No description provided for @supplierNoHighDemandMaterialsYet.
  ///
  /// In en, this message translates to:
  /// **'No high-demand materials yet.'**
  String get supplierNoHighDemandMaterialsYet;

  /// No description provided for @supplierViewAllRequests.
  ///
  /// In en, this message translates to:
  /// **'View all requests'**
  String get supplierViewAllRequests;

  /// No description provided for @supplierUnknownLearner.
  ///
  /// In en, this message translates to:
  /// **'Unknown learner'**
  String get supplierUnknownLearner;

  /// No description provided for @supplierOperationsSnapshot.
  ///
  /// In en, this message translates to:
  /// **'Operations snapshot'**
  String get supplierOperationsSnapshot;

  /// No description provided for @supplierRequesterStatusDateQtyQuantity.
  ///
  /// In en, this message translates to:
  /// **'{requester} · {status} · {date} · qty {quantity}'**
  String supplierRequesterStatusDateQtyQuantity(
    String requester,
    String status,
    String date,
    String quantity,
  );

  /// No description provided for @supplierCountViews.
  ///
  /// In en, this message translates to:
  /// **'{count} views'**
  String supplierCountViews(String count);

  /// No description provided for @supplierSelectMaterialConditionBeforeVerifyingThe.
  ///
  /// In en, this message translates to:
  /// **'Select material condition before verifying the price.'**
  String get supplierSelectMaterialConditionBeforeVerifyingThe;

  /// No description provided for @supplierReferenceMaxCurrencysymbolBasemaxConditionConditionlabe.
  ///
  /// In en, this message translates to:
  /// **'Reference max: {currencySymbol}{baseMax} · Condition: {conditionLabel} · Adjusted max: {currencySymbol}{adjustedMax}'**
  String supplierReferenceMaxCurrencysymbolBasemaxConditionConditionlabe(
    String currencySymbol,
    String baseMax,
    String conditionLabel,
    String adjustedMax,
  );

  /// No description provided for @supplierSomeMaterialsAreGettingStrongDemand.
  ///
  /// In en, this message translates to:
  /// **'Some materials are getting strong demand.'**
  String get supplierSomeMaterialsAreGettingStrongDemand;

  /// No description provided for @supplierYourMaterialsAreGettingViewsImprove.
  ///
  /// In en, this message translates to:
  /// **'Your materials are getting views. Improve titles/images to increase engagement.'**
  String get supplierYourMaterialsAreGettingViewsImprove;

  /// No description provided for @supplierAddYourFirstMaterialToStart.
  ///
  /// In en, this message translates to:
  /// **'Add your first material to start receiving requests.'**
  String get supplierAddYourFirstMaterialToStart;

  /// No description provided for @supplierReservationStatus.
  ///
  /// In en, this message translates to:
  /// **'Reservation status'**
  String get supplierReservationStatus;

  /// No description provided for @supplierMaterialsStatus.
  ///
  /// In en, this message translates to:
  /// **'Materials status'**
  String get supplierMaterialsStatus;

  /// No description provided for @supplierRecentActivity.
  ///
  /// In en, this message translates to:
  /// **'Recent activity'**
  String get supplierRecentActivity;

  /// No description provided for @supplierCuratedHighlightsFromYourLatestOperations.
  ///
  /// In en, this message translates to:
  /// **'Curated highlights from your latest operations'**
  String get supplierCuratedHighlightsFromYourLatestOperations;

  /// No description provided for @supplierViewAllActivity.
  ///
  /// In en, this message translates to:
  /// **'View all activity'**
  String get supplierViewAllActivity;

  /// No description provided for @supplierActionableInsights.
  ///
  /// In en, this message translates to:
  /// **'Actionable insights'**
  String get supplierActionableInsights;

  /// No description provided for @supplierRecommendedNextStepsBasedOnYour.
  ///
  /// In en, this message translates to:
  /// **'Recommended next steps based on your current supplier activity.'**
  String get supplierRecommendedNextStepsBasedOnYour;

  /// No description provided for @supplierRequestsNeedAttention.
  ///
  /// In en, this message translates to:
  /// **'Requests need attention'**
  String get supplierRequestsNeedAttention;

  /// No description provided for @supplierNoPendingRequestsRightNow.
  ///
  /// In en, this message translates to:
  /// **'No pending requests right now.'**
  String get supplierNoPendingRequestsRightNow;

  /// No description provided for @supplierReviewRequests.
  ///
  /// In en, this message translates to:
  /// **'Review requests'**
  String get supplierReviewRequests;

  /// No description provided for @supplierPickupReadiness.
  ///
  /// In en, this message translates to:
  /// **'Pickup readiness'**
  String get supplierPickupReadiness;

  /// No description provided for @supplierPickupLocationIsSetSelfPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup location is set. Self pickup is enabled.'**
  String get supplierPickupLocationIsSetSelfPickup;

  /// No description provided for @supplierAddOrConfirmYourPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Add or confirm your pickup location so learners know where to collect materials.'**
  String get supplierAddOrConfirmYourPickupLocation;

  /// No description provided for @supplierCompleteYourSupplierProfileAndPickup.
  ///
  /// In en, this message translates to:
  /// **'Complete your supplier profile and pickup location to start accepting requests.'**
  String get supplierCompleteYourSupplierProfileAndPickup;

  /// No description provided for @supplierUpdateProfile.
  ///
  /// In en, this message translates to:
  /// **'Update profile'**
  String get supplierUpdateProfile;

  /// No description provided for @supplierGrowReuse.
  ///
  /// In en, this message translates to:
  /// **'Grow reuse'**
  String get supplierGrowReuse;

  /// No description provided for @supplierYouHaveActiveListingsReadyFor.
  ///
  /// In en, this message translates to:
  /// **'You have active listings ready for learners. Completed pickups will increase reuse impact.'**
  String get supplierYouHaveActiveListingsReadyFor;

  /// No description provided for @supplierReuseActivityIsStartingKeepMaterials.
  ///
  /// In en, this message translates to:
  /// **'Reuse activity is starting. Keep materials updated to improve requests.'**
  String get supplierReuseActivityIsStartingKeepMaterials;

  /// No description provided for @supplierListMaterialsToStartBuildingReuse.
  ///
  /// In en, this message translates to:
  /// **'List materials to start building reuse impact when learners complete pickups.'**
  String get supplierListMaterialsToStartBuildingReuse;

  /// No description provided for @supplierViewMaterials.
  ///
  /// In en, this message translates to:
  /// **'View materials'**
  String get supplierViewMaterials;

  /// No description provided for @supplierAllCaughtUpNewLearnerRequests.
  ///
  /// In en, this message translates to:
  /// **'All caught up. New learner requests and pickup updates will appear here.'**
  String get supplierAllCaughtUpNewLearnerRequests;

  /// No description provided for @supplierNoRecentActivityYet.
  ///
  /// In en, this message translates to:
  /// **'No recent activity yet.'**
  String get supplierNoRecentActivityYet;

  /// No description provided for @supplierCheckNotifications.
  ///
  /// In en, this message translates to:
  /// **'Check notifications'**
  String get supplierCheckNotifications;

  /// No description provided for @supplierOpenPickupSchedule.
  ///
  /// In en, this message translates to:
  /// **'Open pickup schedule'**
  String get supplierOpenPickupSchedule;

  /// No description provided for @supplierEditProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get supplierEditProfile;

  /// No description provided for @supplierSupplierHub.
  ///
  /// In en, this message translates to:
  /// **'Supplier Hub'**
  String get supplierSupplierHub;

  /// No description provided for @supplierShareUnusedPartsReduceWasteAnd.
  ///
  /// In en, this message translates to:
  /// **'Share unused parts, reduce waste, and help learners build faster.'**
  String get supplierShareUnusedPartsReduceWasteAnd;

  /// No description provided for @supplierPickupCity.
  ///
  /// In en, this message translates to:
  /// **'Pickup: {city}'**
  String supplierPickupCity(String city);

  /// No description provided for @supplierPickupCityArea.
  ///
  /// In en, this message translates to:
  /// **'Pickup: {city}, {area}'**
  String supplierPickupCityArea(String city, String area);

  /// No description provided for @supplierNoMaterialsListedYet.
  ///
  /// In en, this message translates to:
  /// **'No materials listed yet'**
  String get supplierNoMaterialsListedYet;

  /// No description provided for @supplierStartBySharingUnusedPartsProject.
  ///
  /// In en, this message translates to:
  /// **'Start by sharing unused parts, project leftovers, or surplus components.'**
  String get supplierStartBySharingUnusedPartsProject;

  /// No description provided for @supplierCompleteYourSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'Complete your supplier profile'**
  String get supplierCompleteYourSupplierProfile;

  /// No description provided for @supplierAddYourPublicSupplierNameAnd.
  ///
  /// In en, this message translates to:
  /// **'Add your public supplier name and pickup location before listing materials.'**
  String get supplierAddYourPublicSupplierNameAnd;

  /// No description provided for @supplierCompleteProfile.
  ///
  /// In en, this message translates to:
  /// **'Complete profile'**
  String get supplierCompleteProfile;

  /// No description provided for @supplierWeCouldNotLoadYourSupplier.
  ///
  /// In en, this message translates to:
  /// **'We could not load your supplier dashboard.'**
  String get supplierWeCouldNotLoadYourSupplier;

  /// No description provided for @supplierPleaseCheckYourConnectionAndTry.
  ///
  /// In en, this message translates to:
  /// **'Please check your connection and try again.'**
  String get supplierPleaseCheckYourConnectionAndTry;

  /// No description provided for @supplierReuseImpact.
  ///
  /// In en, this message translates to:
  /// **'Reuse impact'**
  String get supplierReuseImpact;

  /// No description provided for @supplierCountReusedQuantityUnits.
  ///
  /// In en, this message translates to:
  /// **'{count} reused · {quantity} units'**
  String supplierCountReusedQuantityUnits(String count, String quantity);

  /// No description provided for @supplierImpactIsCalculatedFromCompletedReuse.
  ///
  /// In en, this message translates to:
  /// **'Impact is calculated from completed reuse data.'**
  String get supplierImpactIsCalculatedFromCompletedReuse;

  /// No description provided for @supplierProjectImpact.
  ///
  /// In en, this message translates to:
  /// **'Project impact'**
  String get supplierProjectImpact;

  /// No description provided for @supplierYourMaterialsHelpedLearnersCompleteReal.
  ///
  /// In en, this message translates to:
  /// **'Your materials helped learners complete real project components.'**
  String get supplierYourMaterialsHelpedLearnersCompleteReal;

  /// No description provided for @supplierYourCompletedProjectImpactWillAppear.
  ///
  /// In en, this message translates to:
  /// **'Your completed project impact will appear here when learners finish components using your materials.'**
  String get supplierYourCompletedProjectImpactWillAppear;

  /// No description provided for @supplierProjectsSupported.
  ///
  /// In en, this message translates to:
  /// **'Projects supported'**
  String get supplierProjectsSupported;

  /// No description provided for @supplierComponentsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Components completed'**
  String get supplierComponentsCompleted;

  /// No description provided for @supplierLearnerBuildsHelped.
  ///
  /// In en, this message translates to:
  /// **'Learner builds helped'**
  String get supplierLearnerBuildsHelped;

  /// No description provided for @supplierRecentSupportedProjects.
  ///
  /// In en, this message translates to:
  /// **'Recent supported projects'**
  String get supplierRecentSupportedProjects;

  /// No description provided for @supplierNoReviewsYet.
  ///
  /// In en, this message translates to:
  /// **'No reviews yet'**
  String get supplierNoReviewsYet;

  /// No description provided for @supplierRating.
  ///
  /// In en, this message translates to:
  /// **'Rating'**
  String get supplierRating;

  /// No description provided for @supplierCountReviews.
  ///
  /// In en, this message translates to:
  /// **'{count} reviews'**
  String supplierCountReviews(String count);

  /// No description provided for @supplierMaterialLifecycle.
  ///
  /// In en, this message translates to:
  /// **'Material lifecycle'**
  String get supplierMaterialLifecycle;

  /// No description provided for @supplierListed.
  ///
  /// In en, this message translates to:
  /// **'Listed'**
  String get supplierListed;

  /// No description provided for @supplierActionNeeded.
  ///
  /// In en, this message translates to:
  /// **'Action needed'**
  String get supplierActionNeeded;

  /// No description provided for @supplierResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get supplierResolved;

  /// No description provided for @supplierNoFilterlabelNotifications.
  ///
  /// In en, this message translates to:
  /// **'No {filterLabel} notifications.'**
  String supplierNoFilterlabelNotifications(String filterLabel);

  /// No description provided for @supplierWeCouldNotLoadNotifications.
  ///
  /// In en, this message translates to:
  /// **'We could not load notifications.'**
  String get supplierWeCouldNotLoadNotifications;

  /// No description provided for @supplierNoActionAvailableForThisItem.
  ///
  /// In en, this message translates to:
  /// **'No action available for this item.'**
  String get supplierNoActionAvailableForThisItem;

  /// No description provided for @supplierCouldNotOpenListingTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Could not open listing. Try again from Notifications.'**
  String get supplierCouldNotOpenListingTryAgain;

  /// No description provided for @supplierApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get supplierApproved;

  /// No description provided for @supplierMaxFormatnisamountMaxNisUnit.
  ///
  /// In en, this message translates to:
  /// **'Max {max} NIS/{unit}'**
  String supplierMaxFormatnisamountMaxNisUnit(String max, String unit);

  /// No description provided for @supplierEditListing.
  ///
  /// In en, this message translates to:
  /// **'Edit listing'**
  String get supplierEditListing;

  /// No description provided for @supplierEditPrice.
  ///
  /// In en, this message translates to:
  /// **'Edit price'**
  String get supplierEditPrice;

  /// No description provided for @supplierReviewRequest.
  ///
  /// In en, this message translates to:
  /// **'Review request'**
  String get supplierReviewRequest;

  /// No description provided for @supplierChoosePickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Choose pickup window'**
  String get supplierChoosePickupWindow;

  /// No description provided for @supplierOpenMaterial.
  ///
  /// In en, this message translates to:
  /// **'Open material'**
  String get supplierOpenMaterial;

  /// No description provided for @supplierOpenProfile.
  ///
  /// In en, this message translates to:
  /// **'Open profile'**
  String get supplierOpenProfile;

  /// No description provided for @supplierSupplierActive.
  ///
  /// In en, this message translates to:
  /// **'Supplier active'**
  String get supplierSupplierActive;

  /// No description provided for @supplierPickupEnabled.
  ///
  /// In en, this message translates to:
  /// **'Pickup enabled'**
  String get supplierPickupEnabled;

  /// No description provided for @supplierNisListings.
  ///
  /// In en, this message translates to:
  /// **'NIS listings'**
  String get supplierNisListings;

  /// No description provided for @supplierPendingAcceptedAndCompletedRequests.
  ///
  /// In en, this message translates to:
  /// **'Pending, accepted, and completed requests'**
  String get supplierPendingAcceptedAndCompletedRequests;

  /// No description provided for @supplierInventoryBreakdownAcrossLifecycleStates.
  ///
  /// In en, this message translates to:
  /// **'Inventory breakdown across lifecycle states'**
  String get supplierInventoryBreakdownAcrossLifecycleStates;

  /// No description provided for @supplierAcceptedPickups.
  ///
  /// In en, this message translates to:
  /// **'Accepted pickups'**
  String get supplierAcceptedPickups;

  /// No description provided for @supplierCompletedReuse.
  ///
  /// In en, this message translates to:
  /// **'Completed reuse'**
  String get supplierCompletedReuse;

  /// No description provided for @supplierAcceptedHandovers.
  ///
  /// In en, this message translates to:
  /// **'Accepted handovers'**
  String get supplierAcceptedHandovers;

  /// No description provided for @supplierReservationActivityWillAppearHereOnce.
  ///
  /// In en, this message translates to:
  /// **'Reservation activity will appear here once requests arrive.'**
  String get supplierReservationActivityWillAppearHereOnce;

  /// No description provided for @supplierReservedPending.
  ///
  /// In en, this message translates to:
  /// **'Reserved / pending'**
  String get supplierReservedPending;

  /// No description provided for @supplierMaterialStatusBreakdownWillAppearAfter.
  ///
  /// In en, this message translates to:
  /// **'Material status breakdown will appear after your first listing.'**
  String get supplierMaterialStatusBreakdownWillAppearAfter;

  /// No description provided for @supplierPendingRequestWaiting.
  ///
  /// In en, this message translates to:
  /// **'Pending request waiting'**
  String get supplierPendingRequestWaiting;

  /// No description provided for @supplierNextScheduledPickup.
  ///
  /// In en, this message translates to:
  /// **'Next scheduled pickup'**
  String get supplierNextScheduledPickup;

  /// No description provided for @supplierAcceptedPickupWithName.
  ///
  /// In en, this message translates to:
  /// **'Accepted pickup with {name}'**
  String supplierAcceptedPickupWithName(String name);

  /// No description provided for @supplierLatestCompletedReuse.
  ///
  /// In en, this message translates to:
  /// **'Latest completed reuse'**
  String get supplierLatestCompletedReuse;

  /// No description provided for @supplierChooseSupplierType.
  ///
  /// In en, this message translates to:
  /// **'Choose supplier type'**
  String get supplierChooseSupplierType;

  /// No description provided for @supplierChoosePhotosFromYourDevice.
  ///
  /// In en, this message translates to:
  /// **'Choose photos from your device'**
  String get supplierChoosePhotosFromYourDevice;

  /// No description provided for @supplierMaterialCouldNotBeListed.
  ///
  /// In en, this message translates to:
  /// **'Material could not be listed.'**
  String get supplierMaterialCouldNotBeListed;

  /// No description provided for @supplierChooseACategoryFirst.
  ///
  /// In en, this message translates to:
  /// **'Choose a category first.'**
  String get supplierChooseACategoryFirst;

  /// No description provided for @supplierEnterAMaterialNameFirst.
  ///
  /// In en, this message translates to:
  /// **'Enter a material name first.'**
  String get supplierEnterAMaterialNameFirst;

  /// No description provided for @supplierEnterAValidQuantityAndPrice.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid quantity and price.'**
  String get supplierEnterAValidQuantityAndPrice;

  /// No description provided for @supplierPriceReviewRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'Price review request failed.'**
  String get supplierPriceReviewRequestFailed;

  /// No description provided for @supplierSavedListingDraftWasNotFound.
  ///
  /// In en, this message translates to:
  /// **'Saved listing draft was not found.'**
  String get supplierSavedListingDraftWasNotFound;

  /// No description provided for @supplierCategoryApprovedContinueYourListing.
  ///
  /// In en, this message translates to:
  /// **'Category approved. Continue your listing.'**
  String get supplierCategoryApprovedContinueYourListing;

  /// No description provided for @supplierContinueEditingYourSavedListingDraft.
  ///
  /// In en, this message translates to:
  /// **'Continue editing your saved listing draft.'**
  String get supplierContinueEditingYourSavedListingDraft;

  /// No description provided for @supplierContinueYourListingFromWhereYou.
  ///
  /// In en, this message translates to:
  /// **'Continue your listing from where you stopped.'**
  String get supplierContinueYourListingFromWhereYou;

  /// No description provided for @supplierCategoryRequestSubmittedYourListingDraft.
  ///
  /// In en, this message translates to:
  /// **'Category request submitted. Your listing draft was saved. You can continue after admin approval.'**
  String get supplierCategoryRequestSubmittedYourListingDraft;

  /// No description provided for @supplierCategoryRequestSubmittedYourListingDraft2.
  ///
  /// In en, this message translates to:
  /// **'Category request submitted. Your listing draft was saved.'**
  String get supplierCategoryRequestSubmittedYourListingDraft2;

  /// No description provided for @supplierPriceReviewSubmittedAGeminiAssisted.
  ///
  /// In en, this message translates to:
  /// **'Price review submitted. A Gemini-assisted price suggestion was generated for admin review.'**
  String get supplierPriceReviewSubmittedAGeminiAssisted;

  /// No description provided for @supplierPriceVerificationFailedError.
  ///
  /// In en, this message translates to:
  /// **'Price verification failed: {error}'**
  String supplierPriceVerificationFailedError(String error);

  /// No description provided for @supplierSubmitPriceReview.
  ///
  /// In en, this message translates to:
  /// **'Submit price review'**
  String get supplierSubmitPriceReview;

  /// No description provided for @supplierPleaseClarifyTheMaterialName.
  ///
  /// In en, this message translates to:
  /// **'Please clarify the material name'**
  String get supplierPleaseClarifyTheMaterialName;

  /// No description provided for @supplierDidYouMeanOneOfThese.
  ///
  /// In en, this message translates to:
  /// **'Did you mean one of these?'**
  String get supplierDidYouMeanOneOfThese;

  /// No description provided for @supplierMatchedPriceReferenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Matched price reference: {label}'**
  String supplierMatchedPriceReferenceLabel(String label);

  /// No description provided for @supplierMaximumAllowedUnitPriceSymbolPrice.
  ///
  /// In en, this message translates to:
  /// **'Maximum allowed unit price: {symbol}{price}'**
  String supplierMaximumAllowedUnitPriceSymbolPrice(
    String symbol,
    String price,
  );

  /// No description provided for @supplierMaximumAllowedUnitPriceSymbolPrice2.
  ///
  /// In en, this message translates to:
  /// **'Maximum allowed unit price: {symbol}{price} per {unit}'**
  String supplierMaximumAllowedUnitPriceSymbolPrice2(
    String symbol,
    String price,
    String unit,
  );

  /// No description provided for @supplierApprovedUnitUnit.
  ///
  /// In en, this message translates to:
  /// **'Approved unit: {unit}'**
  String supplierApprovedUnitUnit(String unit);

  /// No description provided for @supplierPriceReviewIsRequiredBeforePaid.
  ///
  /// In en, this message translates to:
  /// **'Price review is required before paid publishing. A Gemini-assisted price suggestion will be generated for admin review.'**
  String get supplierPriceReviewIsRequiredBeforePaid;

  /// No description provided for @supplierPriceIsAboveTheAllowedLimit.
  ///
  /// In en, this message translates to:
  /// **'Price is above the allowed limit'**
  String get supplierPriceIsAboveTheAllowedLimit;

  /// No description provided for @supplierPriceBlocked.
  ///
  /// In en, this message translates to:
  /// **'Price blocked'**
  String get supplierPriceBlocked;

  /// No description provided for @supplierMyMaterials2.
  ///
  /// In en, this message translates to:
  /// **'My materials'**
  String get supplierMyMaterials2;

  /// No description provided for @supplierIncomingRequests2.
  ///
  /// In en, this message translates to:
  /// **'Incoming requests'**
  String get supplierIncomingRequests2;

  /// No description provided for @supplierCurrentlyVisibleToLearners.
  ///
  /// In en, this message translates to:
  /// **'Currently visible to learners'**
  String get supplierCurrentlyVisibleToLearners;

  /// No description provided for @supplierWaitingForYourResponse.
  ///
  /// In en, this message translates to:
  /// **'Waiting for your response'**
  String get supplierWaitingForYourResponse;

  /// No description provided for @supplierAction.
  ///
  /// In en, this message translates to:
  /// **'Action'**
  String get supplierAction;

  /// No description provided for @supplierPickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get supplierPickup;

  /// No description provided for @supplierListReusableParts.
  ///
  /// In en, this message translates to:
  /// **'List reusable parts'**
  String get supplierListReusableParts;

  /// No description provided for @supplierRespondToLearners.
  ///
  /// In en, this message translates to:
  /// **'Respond to learners'**
  String get supplierRespondToLearners;

  /// No description provided for @supplierUpdatesActions.
  ///
  /// In en, this message translates to:
  /// **'Updates & actions'**
  String get supplierUpdatesActions;

  /// No description provided for @supplierLoadingIncomingRequests.
  ///
  /// In en, this message translates to:
  /// **'Loading incoming requests…'**
  String get supplierLoadingIncomingRequests;

  /// No description provided for @supplierWeCouldNotLoadRequests.
  ///
  /// In en, this message translates to:
  /// **'We could not load requests.'**
  String get supplierWeCouldNotLoadRequests;

  /// No description provided for @supplierRequestAccepted.
  ///
  /// In en, this message translates to:
  /// **'Request accepted.'**
  String get supplierRequestAccepted;

  /// No description provided for @supplierCouldNotAcceptTheRequest.
  ///
  /// In en, this message translates to:
  /// **'Could not accept the request.'**
  String get supplierCouldNotAcceptTheRequest;

  /// No description provided for @supplierRequestDeclined.
  ///
  /// In en, this message translates to:
  /// **'Request declined.'**
  String get supplierRequestDeclined;

  /// No description provided for @supplierCouldNotDeclineTheRequest.
  ///
  /// In en, this message translates to:
  /// **'Could not decline the request.'**
  String get supplierCouldNotDeclineTheRequest;

  /// No description provided for @supplierPickupMarkedAsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Pickup marked as completed.'**
  String get supplierPickupMarkedAsCompleted;

  /// No description provided for @supplierCouldNotMarkPickupAsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Could not mark pickup as completed.'**
  String get supplierCouldNotMarkPickupAsCompleted;

  /// No description provided for @supplierNeedsLearnerConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Needs learner confirmation'**
  String get supplierNeedsLearnerConfirmation;

  /// No description provided for @supplierNeedsLearner.
  ///
  /// In en, this message translates to:
  /// **'Needs learner'**
  String get supplierNeedsLearner;

  /// No description provided for @supplierDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined'**
  String get supplierDeclined;

  /// No description provided for @supplierNoRequestsYet.
  ///
  /// In en, this message translates to:
  /// **'No requests yet.'**
  String get supplierNoRequestsYet;

  /// No description provided for @supplierNoRequestsMatchThisFilter.
  ///
  /// In en, this message translates to:
  /// **'No requests match this filter.'**
  String get supplierNoRequestsMatchThisFilter;

  /// No description provided for @supplierNoPendingRequests.
  ///
  /// In en, this message translates to:
  /// **'No pending requests'**
  String get supplierNoPendingRequests;

  /// No description provided for @supplierNoAcceptedPickupsYet.
  ///
  /// In en, this message translates to:
  /// **'No accepted pickups yet.'**
  String get supplierNoAcceptedPickupsYet;

  /// No description provided for @supplierNoDeclinedRequests.
  ///
  /// In en, this message translates to:
  /// **'No declined requests.'**
  String get supplierNoDeclinedRequests;

  /// No description provided for @supplierNoCompletedPickupsYet.
  ///
  /// In en, this message translates to:
  /// **'No completed pickups yet.'**
  String get supplierNoCompletedPickupsYet;

  /// No description provided for @supplierNewLearnerRequestsWillAppearHere.
  ///
  /// In en, this message translates to:
  /// **'New learner requests will appear here.'**
  String get supplierNewLearnerRequestsWillAppearHere;

  /// No description provided for @supplierAcceptedRequestsWithPickupWindowsWill.
  ///
  /// In en, this message translates to:
  /// **'Accepted requests with pickup windows will show here.'**
  String get supplierAcceptedRequestsWithPickupWindowsWill;

  /// No description provided for @supplierRequestsYouDeclineWillBeListed.
  ///
  /// In en, this message translates to:
  /// **'Requests you decline will be listed here.'**
  String get supplierRequestsYouDeclineWillBeListed;

  /// No description provided for @supplierFinishedPickupsWillAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Finished pickups will appear here.'**
  String get supplierFinishedPickupsWillAppearHere;

  /// No description provided for @supplierNoLearnerNote.
  ///
  /// In en, this message translates to:
  /// **'No learner note.'**
  String get supplierNoLearnerNote;

  /// No description provided for @supplierSelfPickup.
  ///
  /// In en, this message translates to:
  /// **'Self pickup'**
  String get supplierSelfPickup;

  /// No description provided for @supplierPickupWindow2.
  ///
  /// In en, this message translates to:
  /// **'Pickup: {window}'**
  String supplierPickupWindow2(String window);

  /// No description provided for @supplierNoRequestsWaitingForLearner.
  ///
  /// In en, this message translates to:
  /// **'No requests waiting for learner'**
  String get supplierNoRequestsWaitingForLearner;

  /// No description provided for @supplierNoCancelledRequests.
  ///
  /// In en, this message translates to:
  /// **'No cancelled requests'**
  String get supplierNoCancelledRequests;

  /// No description provided for @supplierReservationsAwaitingLearnerConfirmationAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Reservations awaiting learner confirmation appear here.'**
  String get supplierReservationsAwaitingLearnerConfirmationAppearHere;

  /// No description provided for @supplierCancelledReservationsWillAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Cancelled reservations will appear here.'**
  String get supplierCancelledReservationsWillAppearHere;

  /// No description provided for @supplierWaitingForSupplier.
  ///
  /// In en, this message translates to:
  /// **'Waiting for supplier'**
  String get supplierWaitingForSupplier;

  /// No description provided for @supplierLoadingPickupSchedule.
  ///
  /// In en, this message translates to:
  /// **'Loading pickup schedule…'**
  String get supplierLoadingPickupSchedule;

  /// No description provided for @supplierWeCouldNotLoadPickupSchedule.
  ///
  /// In en, this message translates to:
  /// **'We could not load pickup schedule.'**
  String get supplierWeCouldNotLoadPickupSchedule;

  /// No description provided for @supplierNoPickupsScheduledYet.
  ///
  /// In en, this message translates to:
  /// **'No pickups scheduled yet.'**
  String get supplierNoPickupsScheduledYet;

  /// No description provided for @supplierNoPickupsMatchThisFilter.
  ///
  /// In en, this message translates to:
  /// **'No pickups match this filter.'**
  String get supplierNoPickupsMatchThisFilter;

  /// No description provided for @supplierMarkCompleted.
  ///
  /// In en, this message translates to:
  /// **'Mark completed'**
  String get supplierMarkCompleted;

  /// No description provided for @supplierUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get supplierUpcoming;

  /// No description provided for @supplierPast.
  ///
  /// In en, this message translates to:
  /// **'Past'**
  String get supplierPast;

  /// No description provided for @supplierToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get supplierToday;

  /// No description provided for @supplierDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get supplierDone;

  /// No description provided for @supplierNoPickupsScheduledForToday.
  ///
  /// In en, this message translates to:
  /// **'No pickups scheduled for today.'**
  String get supplierNoPickupsScheduledForToday;

  /// No description provided for @supplierNoUpcomingPickups.
  ///
  /// In en, this message translates to:
  /// **'No upcoming pickups.'**
  String get supplierNoUpcomingPickups;

  /// No description provided for @supplierNoPickupScheduleYet.
  ///
  /// In en, this message translates to:
  /// **'No pickup schedule yet.'**
  String get supplierNoPickupScheduleYet;

  /// No description provided for @supplierCreateYourProfile.
  ///
  /// In en, this message translates to:
  /// **'Create your profile'**
  String get supplierCreateYourProfile;

  /// No description provided for @supplierUpdateYourPublicIdentityAndPickup.
  ///
  /// In en, this message translates to:
  /// **'Update your public identity and pickup settings.'**
  String get supplierUpdateYourPublicIdentityAndPickup;

  /// No description provided for @supplierUpdateHowLearnersDiscoverYouAnd.
  ///
  /// In en, this message translates to:
  /// **'Update how learners discover you and where materials can be collected.'**
  String get supplierUpdateHowLearnersDiscoverYouAnd;

  /// No description provided for @supplierPublicSupplierDetails.
  ///
  /// In en, this message translates to:
  /// **'Public supplier details'**
  String get supplierPublicSupplierDetails;

  /// No description provided for @supplierTheseDetailsAppearOnYourPublic.
  ///
  /// In en, this message translates to:
  /// **'These details appear on your public supplier profile.'**
  String get supplierTheseDetailsAppearOnYourPublic;

  /// No description provided for @supplierPublicSupplierName.
  ///
  /// In en, this message translates to:
  /// **'Public supplier name'**
  String get supplierPublicSupplierName;

  /// No description provided for @supplierHowLearnersWillSeeYou.
  ///
  /// In en, this message translates to:
  /// **'How learners will see you'**
  String get supplierHowLearnersWillSeeYou;

  /// No description provided for @supplierAboutYourMaterials.
  ///
  /// In en, this message translates to:
  /// **'About your materials'**
  String get supplierAboutYourMaterials;

  /// No description provided for @supplierShareTheMaterialTypesYouUsually.
  ///
  /// In en, this message translates to:
  /// **'Share the material types you usually offer.'**
  String get supplierShareTheMaterialTypesYouUsually;

  /// No description provided for @supplierDefaultPickupArea.
  ///
  /// In en, this message translates to:
  /// **'Default pickup area'**
  String get supplierDefaultPickupArea;

  /// No description provided for @supplierUseAGeneralPickupAreaExact.
  ///
  /// In en, this message translates to:
  /// **'Use a general pickup area. Exact addresses stay hidden until needed.'**
  String get supplierUseAGeneralPickupAreaExact;

  /// No description provided for @supplierChooseManually.
  ///
  /// In en, this message translates to:
  /// **'Choose manually'**
  String get supplierChooseManually;

  /// No description provided for @supplierPickupLocationSelectionMethod.
  ///
  /// In en, this message translates to:
  /// **'Pickup location selection method'**
  String get supplierPickupLocationSelectionMethod;

  /// No description provided for @supplierEnterTheAddressDetailsOrMove.
  ///
  /// In en, this message translates to:
  /// **'Enter the address details or move the map pin to choose the exact pickup location.'**
  String get supplierEnterTheAddressDetailsOrMove;

  /// No description provided for @supplierLocationSelected.
  ///
  /// In en, this message translates to:
  /// **'Location selected'**
  String get supplierLocationSelected;

  /// No description provided for @supplierFindingAddress.
  ///
  /// In en, this message translates to:
  /// **'Finding address…'**
  String get supplierFindingAddress;

  /// No description provided for @supplierRefreshCurrentLocation.
  ///
  /// In en, this message translates to:
  /// **'Refresh current location'**
  String get supplierRefreshCurrentLocation;

  /// No description provided for @supplierOptionalAddressDetails.
  ///
  /// In en, this message translates to:
  /// **'Optional address details'**
  String get supplierOptionalAddressDetails;

  /// No description provided for @supplierCoordinatesAreTheSourceOfTruth.
  ///
  /// In en, this message translates to:
  /// **'Coordinates are the source of truth. These fields help learners find you.'**
  String get supplierCoordinatesAreTheSourceOfTruth;

  /// No description provided for @supplierPalestine.
  ///
  /// In en, this message translates to:
  /// **'Palestine'**
  String get supplierPalestine;

  /// No description provided for @supplierNeighborhoodOrDistrict.
  ///
  /// In en, this message translates to:
  /// **'Neighborhood or district'**
  String get supplierNeighborhoodOrDistrict;

  /// No description provided for @supplierAddressLine.
  ///
  /// In en, this message translates to:
  /// **'Address line'**
  String get supplierAddressLine;

  /// No description provided for @supplierStreetOrBuildingKeptPrivate.
  ///
  /// In en, this message translates to:
  /// **'Street or building (kept private)'**
  String get supplierStreetOrBuildingKeptPrivate;

  /// No description provided for @supplierLocationPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Location privacy'**
  String get supplierLocationPrivacy;

  /// No description provided for @supplierSetYourExactPickupLocationYour.
  ///
  /// In en, this message translates to:
  /// **'Set your exact pickup location. Your visibility settings control what learners can see.'**
  String get supplierSetYourExactPickupLocationYour;

  /// No description provided for @supplierLocationVisibility.
  ///
  /// In en, this message translates to:
  /// **'Location visibility'**
  String get supplierLocationVisibility;

  /// No description provided for @supplierPublicArea.
  ///
  /// In en, this message translates to:
  /// **'Public area'**
  String get supplierPublicArea;

  /// No description provided for @supplierOrderOnly.
  ///
  /// In en, this message translates to:
  /// **'Order only'**
  String get supplierOrderOnly;

  /// No description provided for @supplierPrivate.
  ///
  /// In en, this message translates to:
  /// **'Private'**
  String get supplierPrivate;

  /// No description provided for @supplierShowAsApproximate.
  ///
  /// In en, this message translates to:
  /// **'Show as approximate'**
  String get supplierShowAsApproximate;

  /// No description provided for @supplierLearnersSeeAGeneralAreaNot.
  ///
  /// In en, this message translates to:
  /// **'Learners see a general area, not an exact pin.'**
  String get supplierLearnersSeeAGeneralAreaNot;

  /// No description provided for @supplierOrganizationDetails.
  ///
  /// In en, this message translates to:
  /// **'Organization details'**
  String get supplierOrganizationDetails;

  /// No description provided for @supplierForWorkshopsFactoriesAndEducationalInstitutions.
  ///
  /// In en, this message translates to:
  /// **'For workshops, factories, and educational institutions only.'**
  String get supplierForWorkshopsFactoriesAndEducationalInstitutions;

  /// No description provided for @supplierOrganizationName.
  ///
  /// In en, this message translates to:
  /// **'Organization name'**
  String get supplierOrganizationName;

  /// No description provided for @supplierLegalOrPublicOrganizationName.
  ///
  /// In en, this message translates to:
  /// **'Legal or public organization name'**
  String get supplierLegalOrPublicOrganizationName;

  /// No description provided for @supplierContactPerson.
  ///
  /// In en, this message translates to:
  /// **'Contact person'**
  String get supplierContactPerson;

  /// No description provided for @supplierOptionalContactName.
  ///
  /// In en, this message translates to:
  /// **'Optional contact name'**
  String get supplierOptionalContactName;

  /// No description provided for @supplierSaveProfile.
  ///
  /// In en, this message translates to:
  /// **'Save profile'**
  String get supplierSaveProfile;

  /// No description provided for @supplierSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get supplierSaving;

  /// No description provided for @supplierDiscardChanges.
  ///
  /// In en, this message translates to:
  /// **'Discard changes'**
  String get supplierDiscardChanges;

  /// No description provided for @supplierKeepYourPublicSupplierDetailsAccurate.
  ///
  /// In en, this message translates to:
  /// **'Keep your public supplier details accurate, trustworthy, and easy for learners to understand.'**
  String get supplierKeepYourPublicSupplierDetailsAccurate;

  /// No description provided for @supplierCreateYourSupplierProfileSoLearners.
  ///
  /// In en, this message translates to:
  /// **'Create your supplier profile so learners know where and how to collect materials.'**
  String get supplierCreateYourSupplierProfileSoLearners;

  /// No description provided for @supplierProfileUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Profile unavailable'**
  String get supplierProfileUnavailable;

  /// No description provided for @supplierProfileCouldNotBeSaved.
  ///
  /// In en, this message translates to:
  /// **'Profile could not be saved.'**
  String get supplierProfileCouldNotBeSaved;

  /// No description provided for @supplierSupplierProfileUpdated.
  ///
  /// In en, this message translates to:
  /// **'Supplier profile updated'**
  String get supplierSupplierProfileUpdated;

  /// No description provided for @supplierPleaseCaptureYourCurrentLocationBefore.
  ///
  /// In en, this message translates to:
  /// **'Please capture your current location before saving.'**
  String get supplierPleaseCaptureYourCurrentLocationBefore;

  /// No description provided for @supplierCouldNotGetCurrentLocationPlease.
  ///
  /// In en, this message translates to:
  /// **'Could not get current location. Please try again or enter it manually.'**
  String get supplierCouldNotGetCurrentLocationPlease;

  /// No description provided for @supplierCurrentLocation.
  ///
  /// In en, this message translates to:
  /// **'Current location'**
  String get supplierCurrentLocation;

  /// No description provided for @supplierWeFoundThisAddressFromYour.
  ///
  /// In en, this message translates to:
  /// **'We found this address from your current location. Please review and edit if needed.'**
  String get supplierWeFoundThisAddressFromYour;

  /// No description provided for @supplierCurrentLocationCapturedButAddressLookup.
  ///
  /// In en, this message translates to:
  /// **'Current location captured, but address lookup failed. You can add city or area manually.'**
  String get supplierCurrentLocationCapturedButAddressLookup;

  /// No description provided for @supplierCurrentLocationCapturedYouCanOptionally.
  ///
  /// In en, this message translates to:
  /// **'Current location captured. You can optionally add city, area, or address details.'**
  String get supplierCurrentLocationCapturedYouCanOptionally;

  /// No description provided for @supplierChooseVisibility.
  ///
  /// In en, this message translates to:
  /// **'Choose visibility'**
  String get supplierChooseVisibility;

  /// No description provided for @supplierWorkingDays.
  ///
  /// In en, this message translates to:
  /// **'Working days'**
  String get supplierWorkingDays;

  /// No description provided for @supplierMonTueWed.
  ///
  /// In en, this message translates to:
  /// **'Mon, Tue, Wed'**
  String get supplierMonTueWed;

  /// No description provided for @supplierOpenFrom.
  ///
  /// In en, this message translates to:
  /// **'Open from'**
  String get supplierOpenFrom;

  /// No description provided for @supplierOpenUntil.
  ///
  /// In en, this message translates to:
  /// **'Open until'**
  String get supplierOpenUntil;

  /// No description provided for @supplierUseASeparateOrganizationAddress.
  ///
  /// In en, this message translates to:
  /// **'Use a separate organization address'**
  String get supplierUseASeparateOrganizationAddress;

  /// No description provided for @supplierEnableThisWhenYourOrganizationAddress.
  ///
  /// In en, this message translates to:
  /// **'Enable this when your organization address is different from the default pickup location.'**
  String get supplierEnableThisWhenYourOrganizationAddress;

  /// No description provided for @supplierBusinessCountry.
  ///
  /// In en, this message translates to:
  /// **'Business country'**
  String get supplierBusinessCountry;

  /// No description provided for @supplierBusinessCity.
  ///
  /// In en, this message translates to:
  /// **'Business city'**
  String get supplierBusinessCity;

  /// No description provided for @supplierBusinessArea.
  ///
  /// In en, this message translates to:
  /// **'Business area'**
  String get supplierBusinessArea;

  /// No description provided for @supplierBusinessAddressLine.
  ///
  /// In en, this message translates to:
  /// **'Business address line'**
  String get supplierBusinessAddressLine;

  /// No description provided for @supplierCountryOptional.
  ///
  /// In en, this message translates to:
  /// **'Country (optional)'**
  String get supplierCountryOptional;

  /// No description provided for @supplierCityOptional.
  ///
  /// In en, this message translates to:
  /// **'City (optional)'**
  String get supplierCityOptional;

  /// No description provided for @supplierAreaOptional.
  ///
  /// In en, this message translates to:
  /// **'Area (optional)'**
  String get supplierAreaOptional;

  /// No description provided for @supplierAddressLineOptional.
  ///
  /// In en, this message translates to:
  /// **'Address line (optional)'**
  String get supplierAddressLineOptional;

  /// No description provided for @supplierOptionalNeighborhoodOrDistrict.
  ///
  /// In en, this message translates to:
  /// **'Optional neighborhood or district'**
  String get supplierOptionalNeighborhoodOrDistrict;

  /// No description provided for @supplierOptionalStreetOrBuilding.
  ///
  /// In en, this message translates to:
  /// **'Optional street or building'**
  String get supplierOptionalStreetOrBuilding;

  /// No description provided for @supplierCompleteYourSupplierProfileFirst.
  ///
  /// In en, this message translates to:
  /// **'Complete your supplier profile first.'**
  String get supplierCompleteYourSupplierProfileFirst;

  /// No description provided for @supplierSupplierDetailsAreRequiredBeforeYou.
  ///
  /// In en, this message translates to:
  /// **'Supplier details are required before you can publish reusable materials.'**
  String get supplierSupplierDetailsAreRequiredBeforeYou;

  /// No description provided for @supplierGoToSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'Go to Supplier Profile'**
  String get supplierGoToSupplierProfile;

  /// No description provided for @supplierSetYourPickupLocationBeforeListing.
  ///
  /// In en, this message translates to:
  /// **'Set your pickup location before listing materials.'**
  String get supplierSetYourPickupLocationBeforeListing;

  /// No description provided for @supplierPickupLocationComesFromYourSupplier.
  ///
  /// In en, this message translates to:
  /// **'Pickup location comes from your Supplier Profile and is used for every material in this step.'**
  String get supplierPickupLocationComesFromYourSupplier;

  /// No description provided for @supplierEditSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit Supplier Profile'**
  String get supplierEditSupplierProfile;

  /// No description provided for @supplierMaterialCategoriesAreUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Material categories are unavailable.'**
  String get supplierMaterialCategoriesAreUnavailable;

  /// No description provided for @supplierPleaseTryAgainAfterTheBackend.
  ///
  /// In en, this message translates to:
  /// **'Please try again after the backend is reachable.'**
  String get supplierPleaseTryAgainAfterTheBackend;

  /// No description provided for @supplierSupplierProfileCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Supplier profile could not load.'**
  String get supplierSupplierProfileCouldNotLoad;

  /// No description provided for @supplierPleaseRefreshOrCompleteYourProfile.
  ///
  /// In en, this message translates to:
  /// **'Please refresh or complete your profile first.'**
  String get supplierPleaseRefreshOrCompleteYourProfile;

  /// No description provided for @supplierWhatAreYouListing.
  ///
  /// In en, this message translates to:
  /// **'What are you listing?'**
  String get supplierWhatAreYouListing;

  /// No description provided for @supplierDescribeTheSurplusMaterialClearly.
  ///
  /// In en, this message translates to:
  /// **'Describe the surplus material clearly.'**
  String get supplierDescribeTheSurplusMaterialClearly;

  /// No description provided for @supplierMaterialTypeName.
  ///
  /// In en, this message translates to:
  /// **'Material type/name'**
  String get supplierMaterialTypeName;

  /// No description provided for @supplierWaxMoldsArduinoUnoFabricScraps.
  ///
  /// In en, this message translates to:
  /// **'Wax molds, Arduino Uno, fabric scraps...'**
  String get supplierWaxMoldsArduinoUnoFabricScraps;

  /// No description provided for @supplierUseTheCommonMaterialTypeOr.
  ///
  /// In en, this message translates to:
  /// **'Use the common material type or alias. We use this for matching and paid price checks.'**
  String get supplierUseTheCommonMaterialTypeOr;

  /// No description provided for @supplierChooseACategoryFirstToSearch.
  ///
  /// In en, this message translates to:
  /// **'Choose a category first to search reviewed material types.'**
  String get supplierChooseACategoryFirstToSearch;

  /// No description provided for @supplierNoReviewedMaterialTypesFoundFree.
  ///
  /// In en, this message translates to:
  /// **'No reviewed material types found. Free listings can continue with this name.'**
  String get supplierNoReviewedMaterialTypesFoundFree;

  /// No description provided for @supplierReviewedPriceAvailable.
  ///
  /// In en, this message translates to:
  /// **'Reviewed price available'**
  String get supplierReviewedPriceAvailable;

  /// No description provided for @supplierNoReviewedPrice.
  ///
  /// In en, this message translates to:
  /// **'No reviewed price'**
  String get supplierNoReviewedPrice;

  /// No description provided for @supplierPaidListingsNeedAReviewedMaterial.
  ///
  /// In en, this message translates to:
  /// **'Paid listings need a reviewed material type with an active price rule.'**
  String get supplierPaidListingsNeedAReviewedMaterial;

  /// No description provided for @supplierAliasesAliases.
  ///
  /// In en, this message translates to:
  /// **'Aliases: {aliases}'**
  String supplierAliasesAliases(String aliases);

  /// No description provided for @supplierListingTitle.
  ///
  /// In en, this message translates to:
  /// **'Listing title'**
  String get supplierListingTitle;

  /// No description provided for @supplierUsedWaxMolds8Pieces.
  ///
  /// In en, this message translates to:
  /// **'Used wax molds - 8 pieces'**
  String get supplierUsedWaxMolds8Pieces;

  /// No description provided for @supplierDescription.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get supplierDescription;

  /// No description provided for @supplierDescribeConditionQuantityAndWhatIs.
  ///
  /// In en, this message translates to:
  /// **'Describe condition, quantity, and what is included.'**
  String get supplierDescribeConditionQuantityAndWhatIs;

  /// No description provided for @supplierChooseSource.
  ///
  /// In en, this message translates to:
  /// **'Choose source'**
  String get supplierChooseSource;

  /// No description provided for @supplierCondition.
  ///
  /// In en, this message translates to:
  /// **'Condition'**
  String get supplierCondition;

  /// No description provided for @supplierChooseCondition.
  ///
  /// In en, this message translates to:
  /// **'Choose condition'**
  String get supplierChooseCondition;

  /// No description provided for @supplierSuggestedUses.
  ///
  /// In en, this message translates to:
  /// **'Suggested uses'**
  String get supplierSuggestedUses;

  /// No description provided for @supplierCandlesResinCastingCraftProjects.
  ///
  /// In en, this message translates to:
  /// **'Candles, resin casting, craft projects.'**
  String get supplierCandlesResinCastingCraftProjects;

  /// No description provided for @supplierChooseTheClosestBroadCategory.
  ///
  /// In en, this message translates to:
  /// **'Choose the closest broad category.'**
  String get supplierChooseTheClosestBroadCategory;

  /// No description provided for @supplierBroadCategory.
  ///
  /// In en, this message translates to:
  /// **'Broad category'**
  String get supplierBroadCategory;

  /// No description provided for @supplierChooseCategory.
  ///
  /// In en, this message translates to:
  /// **'Choose category'**
  String get supplierChooseCategory;

  /// No description provided for @supplierCategoryIsRequired.
  ///
  /// In en, this message translates to:
  /// **'Category is required'**
  String get supplierCategoryIsRequired;

  /// No description provided for @supplierPublishMaterial.
  ///
  /// In en, this message translates to:
  /// **'Publish material'**
  String get supplierPublishMaterial;

  /// No description provided for @supplierPublishing.
  ///
  /// In en, this message translates to:
  /// **'Publishing…'**
  String get supplierPublishing;

  /// No description provided for @supplierHideCategoryRequest.
  ///
  /// In en, this message translates to:
  /// **'Hide category request'**
  String get supplierHideCategoryRequest;

  /// No description provided for @supplierCannotFindYourCategory.
  ///
  /// In en, this message translates to:
  /// **'Cannot find your category?'**
  String get supplierCannotFindYourCategory;

  /// No description provided for @supplierCategoryRequest.
  ///
  /// In en, this message translates to:
  /// **'Category request'**
  String get supplierCategoryRequest;

  /// No description provided for @supplierSendThisCategoryNameToAdmin.
  ///
  /// In en, this message translates to:
  /// **'Send this category name to admin for approval. Your current listing form will be saved so you can continue later.'**
  String get supplierSendThisCategoryNameToAdmin;

  /// No description provided for @supplierRequestedCategoryName.
  ///
  /// In en, this message translates to:
  /// **'Requested category name'**
  String get supplierRequestedCategoryName;

  /// No description provided for @supplierExampleCandleMakingTools.
  ///
  /// In en, this message translates to:
  /// **'Example: Candle Making Tools'**
  String get supplierExampleCandleMakingTools;

  /// No description provided for @supplierSending.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get supplierSending;

  /// No description provided for @supplierSendCategoryRequest.
  ///
  /// In en, this message translates to:
  /// **'Send category request'**
  String get supplierSendCategoryRequest;

  /// No description provided for @supplierFreeListingsMayUseOtherWhen.
  ///
  /// In en, this message translates to:
  /// **'Free listings may use Other when no reviewed category fits.'**
  String get supplierFreeListingsMayUseOtherWhen;

  /// No description provided for @supplierPaidListingsCannotUseOtherUse.
  ///
  /// In en, this message translates to:
  /// **'Paid listings cannot use Other. Use Cannot find your category? to request a reviewed category first.'**
  String get supplierPaidListingsCannotUseOtherUse;

  /// No description provided for @supplierQuantityAndPricing.
  ///
  /// In en, this message translates to:
  /// **'Quantity and pricing'**
  String get supplierQuantityAndPricing;

  /// No description provided for @supplierEnterThePriceForOneUnit.
  ///
  /// In en, this message translates to:
  /// **'Enter the price for one unit. Quantity is handled separately.'**
  String get supplierEnterThePriceForOneUnit;

  /// No description provided for @supplierQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get supplierQuantity;

  /// No description provided for @supplierUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get supplierUnit;

  /// No description provided for @supplierPiece.
  ///
  /// In en, this message translates to:
  /// **'piece'**
  String get supplierPiece;

  /// No description provided for @supplierPricePerUnit.
  ///
  /// In en, this message translates to:
  /// **'Price per unit (₪)'**
  String get supplierPricePerUnit;

  /// No description provided for @supplierVerifyPrice.
  ///
  /// In en, this message translates to:
  /// **'Verify price'**
  String get supplierVerifyPrice;

  /// No description provided for @supplierMaximumAllowedPricePerUnitIs.
  ///
  /// In en, this message translates to:
  /// **'Maximum allowed price per {unit} is {max} NIS.'**
  String supplierMaximumAllowedPricePerUnitIs(String unit, String max);

  /// No description provided for @supplierPickupLocationComesFromYourSupplier2.
  ///
  /// In en, this message translates to:
  /// **'Pickup location comes from your Supplier Profile.'**
  String get supplierPickupLocationComesFromYourSupplier2;

  /// No description provided for @supplierOrganizationListingsUseYourProfilePickup.
  ///
  /// In en, this message translates to:
  /// **'Organization listings use your profile pickup location.'**
  String get supplierOrganizationListingsUseYourProfilePickup;

  /// No description provided for @supplierThisFixedPickupLocationFromYour.
  ///
  /// In en, this message translates to:
  /// **'This fixed pickup location from your profile is used for every listing. Update it in Supplier Profile if your workshop or business address changes.'**
  String get supplierThisFixedPickupLocationFromYour;

  /// No description provided for @supplierEditPickupInProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit pickup in profile'**
  String get supplierEditPickupInProfile;

  /// No description provided for @supplierUseProfilePickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Use profile pickup location'**
  String get supplierUseProfilePickupLocation;

  /// No description provided for @supplierUseYourDefaultPickupAreaOr.
  ///
  /// In en, this message translates to:
  /// **'Use your default pickup area, or set a different pickup point for this material only.'**
  String get supplierUseYourDefaultPickupAreaOr;

  /// No description provided for @supplierMaterialPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Material pickup location'**
  String get supplierMaterialPickupLocation;

  /// No description provided for @supplierSetWhereLearnersShouldPickUp.
  ///
  /// In en, this message translates to:
  /// **'Set where learners should pick up this material.'**
  String get supplierSetWhereLearnersShouldPickUp;

  /// No description provided for @supplierEnterACityOrCaptureYour.
  ///
  /// In en, this message translates to:
  /// **'Enter a city or capture your current location for pickup.'**
  String get supplierEnterACityOrCaptureYour;

  /// No description provided for @supplierPickupAllowed.
  ///
  /// In en, this message translates to:
  /// **'Pickup allowed'**
  String get supplierPickupAllowed;

  /// No description provided for @supplierLearnersCanRequestSelfPickupFor.
  ///
  /// In en, this message translates to:
  /// **'Learners can request self pickup for this material.'**
  String get supplierLearnersCanRequestSelfPickupFor;

  /// No description provided for @supplierDeliveryAllowed.
  ///
  /// In en, this message translates to:
  /// **'Delivery allowed'**
  String get supplierDeliveryAllowed;

  /// No description provided for @supplierLearnersCanRequestInternalDeliveryAfter.
  ///
  /// In en, this message translates to:
  /// **'Learners can request internal delivery after you accept a reservation.'**
  String get supplierLearnersCanRequestInternalDeliveryAfter;

  /// No description provided for @supplierYes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get supplierYes;

  /// No description provided for @supplierNo.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get supplierNo;

  /// No description provided for @supplierPickupNotes.
  ///
  /// In en, this message translates to:
  /// **'Pickup notes'**
  String get supplierPickupNotes;

  /// No description provided for @supplierPickupNearCampus.
  ///
  /// In en, this message translates to:
  /// **'Pickup near campus.'**
  String get supplierPickupNearCampus;

  /// No description provided for @supplierPaidListingsCannotUseOther.
  ///
  /// In en, this message translates to:
  /// **'Paid listings cannot use Other.'**
  String get supplierPaidListingsCannotUseOther;

  /// No description provided for @supplierPaidListingsMustPassPriceVerification.
  ///
  /// In en, this message translates to:
  /// **'Paid listings must pass price verification before publishing.'**
  String get supplierPaidListingsMustPassPriceVerification;

  /// No description provided for @supplierNisOnly.
  ///
  /// In en, this message translates to:
  /// **'NIS only'**
  String get supplierNisOnly;

  /// No description provided for @supplierFreeOtherAllowed.
  ///
  /// In en, this message translates to:
  /// **'Free Other allowed'**
  String get supplierFreeOtherAllowed;

  /// No description provided for @supplierPaidNeedsPriceVerification.
  ///
  /// In en, this message translates to:
  /// **'Paid needs price verification'**
  String get supplierPaidNeedsPriceVerification;

  /// No description provided for @supplierCouldNotRestoreListingDraft.
  ///
  /// In en, this message translates to:
  /// **'Could not restore listing draft'**
  String get supplierCouldNotRestoreListingDraft;

  /// No description provided for @supplierBackToNotifications.
  ///
  /// In en, this message translates to:
  /// **'Back to Notifications'**
  String get supplierBackToNotifications;

  /// No description provided for @supplierMaterialListedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Material listed successfully.'**
  String get supplierMaterialListedSuccessfully;

  /// No description provided for @supplierAddAnotherMaterial.
  ///
  /// In en, this message translates to:
  /// **'Add another material'**
  String get supplierAddAnotherMaterial;

  /// No description provided for @supplierTitleCategoryPrice.
  ///
  /// In en, this message translates to:
  /// **'{title} • {category} • {price}'**
  String supplierTitleCategoryPrice(
    String title,
    String category,
    String price,
  );

  /// No description provided for @supplierNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get supplierNew;

  /// No description provided for @supplierLikeNew.
  ///
  /// In en, this message translates to:
  /// **'Like new'**
  String get supplierLikeNew;

  /// No description provided for @supplierGood.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get supplierGood;

  /// No description provided for @supplierUsed.
  ///
  /// In en, this message translates to:
  /// **'Used'**
  String get supplierUsed;

  /// No description provided for @supplierNeedsRepair.
  ///
  /// In en, this message translates to:
  /// **'Needs repair'**
  String get supplierNeedsRepair;

  /// No description provided for @supplierStudentLeftover.
  ///
  /// In en, this message translates to:
  /// **'Student leftover'**
  String get supplierStudentLeftover;

  /// No description provided for @supplierWorkshopSurplus.
  ///
  /// In en, this message translates to:
  /// **'Workshop surplus'**
  String get supplierWorkshopSurplus;

  /// No description provided for @supplierFactorySurplus.
  ///
  /// In en, this message translates to:
  /// **'Factory surplus'**
  String get supplierFactorySurplus;

  /// No description provided for @supplierEducationalInstitution.
  ///
  /// In en, this message translates to:
  /// **'Educational institution'**
  String get supplierEducationalInstitution;

  /// No description provided for @supplierIndividualSupplier.
  ///
  /// In en, this message translates to:
  /// **'Individual supplier'**
  String get supplierIndividualSupplier;

  /// No description provided for @supplierStudentSupplier.
  ///
  /// In en, this message translates to:
  /// **'Student supplier'**
  String get supplierStudentSupplier;

  /// No description provided for @supplierWorkshop.
  ///
  /// In en, this message translates to:
  /// **'Workshop'**
  String get supplierWorkshop;

  /// No description provided for @supplierFactory.
  ///
  /// In en, this message translates to:
  /// **'Factory'**
  String get supplierFactory;

  /// No description provided for @supplierVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get supplierVerified;

  /// No description provided for @supplierPendingVerification.
  ///
  /// In en, this message translates to:
  /// **'Pending verification'**
  String get supplierPendingVerification;

  /// No description provided for @supplierNotRequired.
  ///
  /// In en, this message translates to:
  /// **'Not required'**
  String get supplierNotRequired;

  /// No description provided for @supplierAdminNote.
  ///
  /// In en, this message translates to:
  /// **'Admin note'**
  String get supplierAdminNote;

  /// No description provided for @supplierSupplierType.
  ///
  /// In en, this message translates to:
  /// **'Supplier type'**
  String get supplierSupplierType;

  /// No description provided for @supplierPickupCountryCity.
  ///
  /// In en, this message translates to:
  /// **'Pickup country & city'**
  String get supplierPickupCountryCity;

  /// No description provided for @supplierListingPreview.
  ///
  /// In en, this message translates to:
  /// **'Listing preview'**
  String get supplierListingPreview;

  /// No description provided for @supplierProfileCompletion.
  ///
  /// In en, this message translates to:
  /// **'Profile completion'**
  String get supplierProfileCompletion;

  /// No description provided for @supplierSelectedCoordinates.
  ///
  /// In en, this message translates to:
  /// **'Selected coordinates'**
  String get supplierSelectedCoordinates;

  /// No description provided for @supplierLatitudeValue.
  ///
  /// In en, this message translates to:
  /// **'Latitude: {value}'**
  String supplierLatitudeValue(String value);

  /// No description provided for @supplierLongitudeValue.
  ///
  /// In en, this message translates to:
  /// **'Longitude: {value}'**
  String supplierLongitudeValue(String value);

  /// No description provided for @supplierCompleteOfTotalEssentialsComplete.
  ///
  /// In en, this message translates to:
  /// **'{complete} of {total} essentials complete'**
  String supplierCompleteOfTotalEssentialsComplete(
    String complete,
    String total,
  );

  /// No description provided for @supplierLearnerPreview.
  ///
  /// In en, this message translates to:
  /// **'Learner preview'**
  String get supplierLearnerPreview;

  /// No description provided for @supplierHowLearnersMayDiscoverYourSupplier.
  ///
  /// In en, this message translates to:
  /// **'How learners may discover your supplier profile later.'**
  String get supplierHowLearnersMayDiscoverYourSupplier;

  /// No description provided for @supplierPickupAreaNotSet.
  ///
  /// In en, this message translates to:
  /// **'Pickup area not set'**
  String get supplierPickupAreaNotSet;

  /// No description provided for @supplierSharesReusableMaterialsForStudentAnd.
  ///
  /// In en, this message translates to:
  /// **'Shares reusable materials for student and maker projects.'**
  String get supplierSharesReusableMaterialsForStudentAnd;

  /// No description provided for @supplierLocationVisibilityVisibility.
  ///
  /// In en, this message translates to:
  /// **'Location visibility: {visibility}'**
  String supplierLocationVisibilityVisibility(String visibility);

  /// No description provided for @supplierYourPublicName.
  ///
  /// In en, this message translates to:
  /// **'Your public name'**
  String get supplierYourPublicName;

  /// No description provided for @supplierCurrentValue.
  ///
  /// In en, this message translates to:
  /// **'Current: {value}'**
  String supplierCurrentValue(String value);

  /// No description provided for @supplierVerification.
  ///
  /// In en, this message translates to:
  /// **'Verification'**
  String get supplierVerification;

  /// No description provided for @supplierVerificationIsReadOnlyForNow.
  ///
  /// In en, this message translates to:
  /// **'Verification is read-only for now. Document upload and review workflows will come later.'**
  String get supplierVerificationIsReadOnlyForNow;

  /// No description provided for @supplierAccountSecurity.
  ///
  /// In en, this message translates to:
  /// **'Account Security'**
  String get supplierAccountSecurity;

  /// No description provided for @supplierKeepYourAccountProtected.
  ///
  /// In en, this message translates to:
  /// **'Keep your account protected.'**
  String get supplierKeepYourAccountProtected;

  /// No description provided for @supplierChangePassword.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get supplierChangePassword;

  /// No description provided for @supplierEnterYourCurrentPasswordThenChoose.
  ///
  /// In en, this message translates to:
  /// **'Enter your current password, then choose a new one.'**
  String get supplierEnterYourCurrentPasswordThenChoose;

  /// No description provided for @supplierCurrentPassword.
  ///
  /// In en, this message translates to:
  /// **'Current password'**
  String get supplierCurrentPassword;

  /// No description provided for @supplierConfirmNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm new password'**
  String get supplierConfirmNewPassword;

  /// No description provided for @supplierUpdatePassword.
  ///
  /// In en, this message translates to:
  /// **'Update password'**
  String get supplierUpdatePassword;

  /// No description provided for @supplierPasswordUpdatedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Password updated successfully.'**
  String get supplierPasswordUpdatedSuccessfully;

  /// No description provided for @supplierPasswordCouldNotBeUpdatedPlease.
  ///
  /// In en, this message translates to:
  /// **'Password could not be updated. Please try again.'**
  String get supplierPasswordCouldNotBeUpdatedPlease;

  /// No description provided for @supplierThisFieldIsRequired.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get supplierThisFieldIsRequired;

  /// No description provided for @supplierPasswordMustBeAtLeast8.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters.'**
  String get supplierPasswordMustBeAtLeast8;

  /// No description provided for @supplierNewPasswordMustBeDifferentFrom.
  ///
  /// In en, this message translates to:
  /// **'New password must be different from your current password.'**
  String get supplierNewPasswordMustBeDifferentFrom;

  /// No description provided for @supplierPasswordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get supplierPasswordsDoNotMatch;

  /// No description provided for @supplierUpcomingPickups.
  ///
  /// In en, this message translates to:
  /// **'Upcoming pickups'**
  String get supplierUpcomingPickups;

  /// No description provided for @supplierRecentMaterials.
  ///
  /// In en, this message translates to:
  /// **'Recent materials'**
  String get supplierRecentMaterials;

  /// No description provided for @supplierMaterialPhotos.
  ///
  /// In en, this message translates to:
  /// **'Material photos'**
  String get supplierMaterialPhotos;

  /// No description provided for @supplierAdd1To5PhotosJpg.
  ///
  /// In en, this message translates to:
  /// **'Add 1 to 5 photos. JPG, PNG, or WebP.'**
  String get supplierAdd1To5PhotosJpg;

  /// No description provided for @supplierAddAtLeastOneMaterialPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add at least one material photo before publishing.'**
  String get supplierAddAtLeastOneMaterialPhoto;

  /// No description provided for @supplierSelectedPhotos.
  ///
  /// In en, this message translates to:
  /// **'Selected photos'**
  String get supplierSelectedPhotos;

  /// No description provided for @supplierAddImages.
  ///
  /// In en, this message translates to:
  /// **'Add images'**
  String get supplierAddImages;

  /// No description provided for @supplierUploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading...'**
  String get supplierUploading;

  /// No description provided for @supplierCountMaxPhotos.
  ///
  /// In en, this message translates to:
  /// **'{count}/{max} photos'**
  String supplierCountMaxPhotos(String count, String max);

  /// No description provided for @supplierPickupDetails.
  ///
  /// In en, this message translates to:
  /// **'Pickup details'**
  String get supplierPickupDetails;

  /// No description provided for @supplierSendMessage.
  ///
  /// In en, this message translates to:
  /// **'Send message'**
  String get supplierSendMessage;

  /// No description provided for @supplierPickupWindowPassedChooseAFollow.
  ///
  /// In en, this message translates to:
  /// **'Pickup window passed. Choose a follow-up action.'**
  String get supplierPickupWindowPassedChooseAFollow;

  /// No description provided for @supplierReschedulePickup.
  ///
  /// In en, this message translates to:
  /// **'Reschedule pickup'**
  String get supplierReschedulePickup;

  /// No description provided for @supplierReportNoShow.
  ///
  /// In en, this message translates to:
  /// **'Report no-show'**
  String get supplierReportNoShow;

  /// No description provided for @supplierNoShowReportAlreadySubmittedFor.
  ///
  /// In en, this message translates to:
  /// **'No-show report already submitted for this reservation.'**
  String get supplierNoShowReportAlreadySubmittedFor;

  /// No description provided for @supplierFollowUpMessages.
  ///
  /// In en, this message translates to:
  /// **'Follow-up messages'**
  String get supplierFollowUpMessages;

  /// No description provided for @supplierNoFollowUpMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No follow-up messages yet.'**
  String get supplierNoFollowUpMessagesYet;

  /// No description provided for @supplierWriteAShortFollowUpMessage.
  ///
  /// In en, this message translates to:
  /// **'Write a short follow-up message…'**
  String get supplierWriteAShortFollowUpMessage;

  /// No description provided for @supplierCouldNotLoadMessages.
  ///
  /// In en, this message translates to:
  /// **'Could not load messages.'**
  String get supplierCouldNotLoadMessages;

  /// No description provided for @supplierCouldNotSendMessage.
  ///
  /// In en, this message translates to:
  /// **'Could not send the message.'**
  String get supplierCouldNotSendMessage;

  /// No description provided for @supplierNeedsFollowUp.
  ///
  /// In en, this message translates to:
  /// **'Needs follow-up'**
  String get supplierNeedsFollowUp;

  /// No description provided for @supplierOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get supplierOverdue;

  /// No description provided for @supplierThisWillCancelTheReservationAnd.
  ///
  /// In en, this message translates to:
  /// **'This will cancel the reservation and release the material.'**
  String get supplierThisWillCancelTheReservationAnd;

  /// No description provided for @supplierSubmitANoShowReportFor.
  ///
  /// In en, this message translates to:
  /// **'Submit a no-show report for admin review. This does not suspend the learner automatically.'**
  String get supplierSubmitANoShowReportFor;

  /// No description provided for @supplierMarkPickupAsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Mark pickup as completed?'**
  String get supplierMarkPickupAsCompleted;

  /// No description provided for @supplierThisWillMoveTheReservationTo.
  ///
  /// In en, this message translates to:
  /// **'This will move the reservation to Completed and mark the material as reused.'**
  String get supplierThisWillMoveTheReservationTo;

  /// No description provided for @supplierAcceptRequest.
  ///
  /// In en, this message translates to:
  /// **'Accept request'**
  String get supplierAcceptRequest;

  /// No description provided for @supplierChooseAPickupWindowForThe.
  ///
  /// In en, this message translates to:
  /// **'Choose a pickup window for the learner.'**
  String get supplierChooseAPickupWindowForThe;

  /// No description provided for @supplierDeclineRequest.
  ///
  /// In en, this message translates to:
  /// **'Decline request'**
  String get supplierDeclineRequest;

  /// No description provided for @supplierYouCanAddAnOptionalReason.
  ///
  /// In en, this message translates to:
  /// **'You can add an optional reason for the learner.'**
  String get supplierYouCanAddAnOptionalReason;

  /// No description provided for @supplierReasonOptional.
  ///
  /// In en, this message translates to:
  /// **'Reason (optional)'**
  String get supplierReasonOptional;

  /// No description provided for @supplierPickupDate.
  ///
  /// In en, this message translates to:
  /// **'Pickup date'**
  String get supplierPickupDate;

  /// No description provided for @supplierDriverPickupWindowFromSupplier.
  ///
  /// In en, this message translates to:
  /// **'Driver pickup window from supplier'**
  String get supplierDriverPickupWindowFromSupplier;

  /// No description provided for @supplierByAcceptingYouAgreeToHand.
  ///
  /// In en, this message translates to:
  /// **'By accepting, you agree to hand the material to the driver during this pickup window. We will check this against the learner’s preferred delivery windows.'**
  String get supplierByAcceptingYouAgreeToHand;

  /// No description provided for @supplierWeWillCheckThisAgainstThe.
  ///
  /// In en, this message translates to:
  /// **'We will check this against the learner’s preferred delivery windows.'**
  String get supplierWeWillCheckThisAgainstThe;

  /// No description provided for @supplierEarliestDeliveryAfterPickupTime.
  ///
  /// In en, this message translates to:
  /// **'Earliest delivery after pickup: {time}'**
  String supplierEarliestDeliveryAfterPickupTime(String time);

  /// No description provided for @supplierConfirmedLearnerDeliveryWindowWindow.
  ///
  /// In en, this message translates to:
  /// **'Confirmed learner delivery window: {window}'**
  String supplierConfirmedLearnerDeliveryWindowWindow(String window);

  /// No description provided for @supplierNoFeasibleLearnerDeliveryWindowThis.
  ///
  /// In en, this message translates to:
  /// **'No feasible learner delivery window. This will wait for learner confirmation.'**
  String get supplierNoFeasibleLearnerDeliveryWindowThis;

  /// No description provided for @supplierThisScheduleCanBeAcceptedDirectly.
  ///
  /// In en, this message translates to:
  /// **'This schedule can be accepted directly.'**
  String get supplierThisScheduleCanBeAcceptedDirectly;

  /// No description provided for @supplierThisDeliveryWindowIsNotFeasible.
  ///
  /// In en, this message translates to:
  /// **'This delivery window is not feasible after supplier pickup and travel buffer. Learner confirmation will be required.'**
  String get supplierThisDeliveryWindowIsNotFeasible;

  /// No description provided for @supplierSelectedLearnerPreferredWindow.
  ///
  /// In en, this message translates to:
  /// **'Selected learner preferred window'**
  String get supplierSelectedLearnerPreferredWindow;

  /// No description provided for @supplierCustomProposedWindow.
  ///
  /// In en, this message translates to:
  /// **'Custom proposed window'**
  String get supplierCustomProposedWindow;

  /// No description provided for @supplierLearnerPreferredPickupWindows.
  ///
  /// In en, this message translates to:
  /// **'Learner preferred pickup windows'**
  String get supplierLearnerPreferredPickupWindows;

  /// No description provided for @supplierLearnerPreferredDeliveryWindows.
  ///
  /// In en, this message translates to:
  /// **'Learner preferred delivery windows'**
  String get supplierLearnerPreferredDeliveryWindows;

  /// No description provided for @supplierDeliveryNote.
  ///
  /// In en, this message translates to:
  /// **'Delivery note'**
  String get supplierDeliveryNote;

  /// No description provided for @supplierSelectedLearnerDeliveryWindowWillBe.
  ///
  /// In en, this message translates to:
  /// **'Selected learner delivery window will be used when feasible.'**
  String get supplierSelectedLearnerDeliveryWindowWillBe;

  /// No description provided for @supplierProposeCustomDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Propose custom delivery window'**
  String get supplierProposeCustomDeliveryWindow;

  /// No description provided for @supplierFlexibleLearnerNeedsDeliveryProposal.
  ///
  /// In en, this message translates to:
  /// **'This learner left delivery timing open. Propose a delivery window to accept — it will be confirmed automatically if it fits after pickup.'**
  String get supplierFlexibleLearnerNeedsDeliveryProposal;

  /// No description provided for @supplierProposedLearnerDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Proposed learner delivery window'**
  String get supplierProposedLearnerDeliveryWindow;

  /// No description provided for @supplierChooseTheProposedDeliveryDateAnd.
  ///
  /// In en, this message translates to:
  /// **'Choose the proposed delivery date and time.'**
  String get supplierChooseTheProposedDeliveryDateAnd;

  /// No description provided for @supplierProposedPickupTimeWaitingForLearner.
  ///
  /// In en, this message translates to:
  /// **'Proposed pickup time — waiting for learner confirmation'**
  String get supplierProposedPickupTimeWaitingForLearner;

  /// No description provided for @supplierSchedulingConflictWaitingForLearnerConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Scheduling conflict — waiting for learner confirmation'**
  String get supplierSchedulingConflictWaitingForLearnerConfirmation;

  /// No description provided for @supplierRequestSubmittedAwaitingLearnerConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Request submitted — awaiting learner confirmation'**
  String get supplierRequestSubmittedAwaitingLearnerConfirmation;

  /// No description provided for @supplierStartTime.
  ///
  /// In en, this message translates to:
  /// **'Start time'**
  String get supplierStartTime;

  /// No description provided for @supplierEndTime.
  ///
  /// In en, this message translates to:
  /// **'End time'**
  String get supplierEndTime;

  /// No description provided for @supplierPickupNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Pickup note (optional)'**
  String get supplierPickupNoteOptional;

  /// No description provided for @supplierTapToChoose.
  ///
  /// In en, this message translates to:
  /// **'Tap to choose'**
  String get supplierTapToChoose;

  /// No description provided for @supplierPriceVerified.
  ///
  /// In en, this message translates to:
  /// **'Price verified'**
  String get supplierPriceVerified;

  /// No description provided for @supplierVerifyPriceBeforePublishing.
  ///
  /// In en, this message translates to:
  /// **'Verify price before publishing'**
  String get supplierVerifyPriceBeforePublishing;

  /// No description provided for @supplierPriceVerificationRequired.
  ///
  /// In en, this message translates to:
  /// **'Price verification required'**
  String get supplierPriceVerificationRequired;

  /// No description provided for @supplierWithinApprovedCapVerifyPriceTo.
  ///
  /// In en, this message translates to:
  /// **'Within approved cap — verify price to publish'**
  String get supplierWithinApprovedCapVerifyPriceTo;

  /// No description provided for @supplierCategoryRequests.
  ///
  /// In en, this message translates to:
  /// **'Category requests'**
  String get supplierCategoryRequests;

  /// No description provided for @supplierApprovedAsName.
  ///
  /// In en, this message translates to:
  /// **'Approved as {name}'**
  String supplierApprovedAsName(String name);

  /// No description provided for @supplierWaitingForAdminApproval.
  ///
  /// In en, this message translates to:
  /// **'Waiting for admin approval.'**
  String get supplierWaitingForAdminApproval;

  /// No description provided for @supplierContinueListing.
  ///
  /// In en, this message translates to:
  /// **'Continue listing'**
  String get supplierContinueListing;

  /// No description provided for @supplierDefaultPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Default pickup location'**
  String get supplierDefaultPickupLocation;

  /// No description provided for @supplierVisibility.
  ///
  /// In en, this message translates to:
  /// **'Visibility'**
  String get supplierVisibility;

  /// No description provided for @supplierLocationCaptured.
  ///
  /// In en, this message translates to:
  /// **'Location captured'**
  String get supplierLocationCaptured;

  /// No description provided for @supplierNoAreaSelectedYet.
  ///
  /// In en, this message translates to:
  /// **'No area selected yet'**
  String get supplierNoAreaSelectedYet;

  /// No description provided for @supplierVisibilityValue.
  ///
  /// In en, this message translates to:
  /// **'Visibility: {value}'**
  String supplierVisibilityValue(String value);

  /// No description provided for @supplierTodayTodayUpcomingUpcomingCompletedCompleted.
  ///
  /// In en, this message translates to:
  /// **'Today: {today}   Upcoming: {upcoming}   Completed: {completed}'**
  String supplierTodayTodayUpcomingUpcomingCompletedCompleted(
    String today,
    String upcoming,
    String completed,
  );

  /// No description provided for @supplierRequesterName.
  ///
  /// In en, this message translates to:
  /// **'Requester: {name}'**
  String supplierRequesterName(String name);

  /// No description provided for @supplierQtyQty.
  ///
  /// In en, this message translates to:
  /// **'Qty: {qty}'**
  String supplierQtyQty(String qty);

  /// No description provided for @supplierChooseAPickupDateAndTime.
  ///
  /// In en, this message translates to:
  /// **'Choose a pickup date and time window.'**
  String get supplierChooseAPickupDateAndTime;

  /// No description provided for @supplierSchedulePending.
  ///
  /// In en, this message translates to:
  /// **'Schedule pending'**
  String get supplierSchedulePending;

  /// No description provided for @supplierAcceptedReservationsWithPickupWindowsWill.
  ///
  /// In en, this message translates to:
  /// **'Accepted reservations with pickup windows will show up here.'**
  String get supplierAcceptedReservationsWithPickupWindowsWill;

  /// No description provided for @supplierRecentListingsWillAppearHereAfter.
  ///
  /// In en, this message translates to:
  /// **'Recent listings will appear here after you add reusable materials.'**
  String get supplierRecentListingsWillAppearHereAfter;

  /// No description provided for @supplierActivityFromReservationsAndNotificationsWill.
  ///
  /// In en, this message translates to:
  /// **'Activity from reservations and notifications will collect here.'**
  String get supplierActivityFromReservationsAndNotificationsWill;

  /// No description provided for @supplierOrganizationProfile.
  ///
  /// In en, this message translates to:
  /// **'Organization profile'**
  String get supplierOrganizationProfile;

  /// No description provided for @supplierRingTheWorkshopBellWhenYou.
  ///
  /// In en, this message translates to:
  /// **'Ring the workshop bell when you arrive.'**
  String get supplierRingTheWorkshopBellWhenYou;

  /// No description provided for @supplierAlreadyReservedForAnotherLearner.
  ///
  /// In en, this message translates to:
  /// **'Already reserved for another learner.'**
  String get supplierAlreadyReservedForAnotherLearner;

  /// No description provided for @supplierMaterialListingFoundationReady.
  ///
  /// In en, this message translates to:
  /// **'Material listing foundation ready'**
  String get supplierMaterialListingFoundationReady;

  /// No description provided for @supplierCountMaterialCategoriesLoaded.
  ///
  /// In en, this message translates to:
  /// **'{count} material categories loaded.'**
  String supplierCountMaterialCategoriesLoaded(String count);

  /// No description provided for @supplierLoadingCategories.
  ///
  /// In en, this message translates to:
  /// **'Loading categories...'**
  String get supplierLoadingCategories;

  /// No description provided for @supplierCategoriesCouldNotBeLoadedYet.
  ///
  /// In en, this message translates to:
  /// **'Categories could not be loaded yet.'**
  String get supplierCategoriesCouldNotBeLoadedYet;

  /// No description provided for @supplierLoadingListingPolicy.
  ///
  /// In en, this message translates to:
  /// **'Loading listing policy...'**
  String get supplierLoadingListingPolicy;

  /// No description provided for @supplierListingPolicyUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Listing policy unavailable.'**
  String get supplierListingPolicyUnavailable;

  /// No description provided for @supplierUseYourCurrentLocationOrEnter.
  ///
  /// In en, this message translates to:
  /// **'Use your current location or enter pickup details manually.'**
  String get supplierUseYourCurrentLocationOrEnter;

  /// No description provided for @supplierTapTheMapToPlaceThe.
  ///
  /// In en, this message translates to:
  /// **'Tap the map to place the pickup pin'**
  String get supplierTapTheMapToPlaceThe;

  /// No description provided for @supplierPickupPinSelectedOnMap.
  ///
  /// In en, this message translates to:
  /// **'Pickup pin selected on map'**
  String get supplierPickupPinSelectedOnMap;

  /// No description provided for @supplierPickupType.
  ///
  /// In en, this message translates to:
  /// **'Pickup type'**
  String get supplierPickupType;

  /// No description provided for @supplierDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get supplierDate;

  /// No description provided for @supplierTime.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get supplierTime;

  /// No description provided for @supplierMaterialRequest.
  ///
  /// In en, this message translates to:
  /// **'Material & request'**
  String get supplierMaterialRequest;

  /// No description provided for @supplierPickupWindowRange.
  ///
  /// In en, this message translates to:
  /// **'Pickup window: {range}'**
  String supplierPickupWindowRange(String range);

  /// No description provided for @supplierInstructions.
  ///
  /// In en, this message translates to:
  /// **'Instructions'**
  String get supplierInstructions;

  /// No description provided for @supplierNoPickupInstructions.
  ///
  /// In en, this message translates to:
  /// **'No pickup instructions.'**
  String get supplierNoPickupInstructions;

  /// No description provided for @supplierNoDeclineReasonProvided.
  ///
  /// In en, this message translates to:
  /// **'No decline reason provided.'**
  String get supplierNoDeclineReasonProvided;

  /// No description provided for @supplierThisRequestExpiredBecauseYouDid.
  ///
  /// In en, this message translates to:
  /// **'This request expired because you did not accept or decline in time.'**
  String get supplierThisRequestExpiredBecauseYouDid;

  /// No description provided for @supplierSupplierNote.
  ///
  /// In en, this message translates to:
  /// **'Supplier note'**
  String get supplierSupplierNote;

  /// No description provided for @supplierLearnerMessage.
  ///
  /// In en, this message translates to:
  /// **'Learner message'**
  String get supplierLearnerMessage;

  /// No description provided for @supplierCover.
  ///
  /// In en, this message translates to:
  /// **'Cover'**
  String get supplierCover;

  /// No description provided for @supplierDismiss.
  ///
  /// In en, this message translates to:
  /// **'Dismiss'**
  String get supplierDismiss;

  /// No description provided for @supplierAccountApprovedBanner.
  ///
  /// In en, this message translates to:
  /// **'Your supplier account has been approved. You can now publish materials.'**
  String get supplierAccountApprovedBanner;

  /// No description provided for @supplierWaitingForAdminApprovalPublish.
  ///
  /// In en, this message translates to:
  /// **'Your supplier account is waiting for admin approval. You can publish materials after approval.'**
  String get supplierWaitingForAdminApprovalPublish;

  /// No description provided for @supplierCommonSupplierTasks.
  ///
  /// In en, this message translates to:
  /// **'Common supplier tasks'**
  String get supplierCommonSupplierTasks;

  /// No description provided for @supplierActivityWillAppearAsLearners.
  ///
  /// In en, this message translates to:
  /// **'Activity will appear as learners request and collect your materials.'**
  String get supplierActivityWillAppearAsLearners;

  /// No description provided for @supplierPendingReservationsWaitingResponse.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{You have 1 pending reservation waiting for a response.} other{You have {count} pending reservations waiting for a response.}}'**
  String supplierPendingReservationsWaitingResponse(int count);

  /// No description provided for @supplierCountRequestsNeedResponse.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 request needs your response.} other{{count} requests need your response.}}'**
  String supplierCountRequestsNeedResponse(int count);

  /// No description provided for @supplierCountReservationsCompleted.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 reservation completed successfully.} other{{count} reservations completed successfully.}}'**
  String supplierCountReservationsCompleted(int count);

  /// No description provided for @supplierBasicInformation.
  ///
  /// In en, this message translates to:
  /// **'Basic information'**
  String get supplierBasicInformation;

  /// No description provided for @supplierTellLearnersWhatMaterial.
  ///
  /// In en, this message translates to:
  /// **'Tell learners what material you are offering.'**
  String get supplierTellLearnersWhatMaterial;

  /// No description provided for @supplierWhyExistingCategoriesDoNotFit.
  ///
  /// In en, this message translates to:
  /// **'Why existing categories do not fit'**
  String get supplierWhyExistingCategoriesDoNotFit;

  /// No description provided for @supplierExplainMaterialKindAndWhy.
  ///
  /// In en, this message translates to:
  /// **'Explain what kind of material this is and why none of the current categories work.'**
  String get supplierExplainMaterialKindAndWhy;

  /// No description provided for @supplierMaterialTypeSlashName.
  ///
  /// In en, this message translates to:
  /// **'Material type / name'**
  String get supplierMaterialTypeSlashName;

  /// No description provided for @supplierSearchOrTypeMaterialName.
  ///
  /// In en, this message translates to:
  /// **'Search or type material name'**
  String get supplierSearchOrTypeMaterialName;

  /// No description provided for @supplierClearSpecificTitlesHelp.
  ///
  /// In en, this message translates to:
  /// **'Clear, specific titles help learners understand your item.'**
  String get supplierClearSpecificTitlesHelp;

  /// No description provided for @supplierIncludeDetailsHelpLearners.
  ///
  /// In en, this message translates to:
  /// **'Include details that help learners decide whether it fits their project.'**
  String get supplierIncludeDetailsHelpLearners;

  /// No description provided for @supplierSetQuantityAndPrice.
  ///
  /// In en, this message translates to:
  /// **'Set how much is available and the price.'**
  String get supplierSetQuantityAndPrice;

  /// No description provided for @supplierPickupAndDelivery.
  ///
  /// In en, this message translates to:
  /// **'Pickup and delivery'**
  String get supplierPickupAndDelivery;

  /// No description provided for @supplierSetHowLearnersReceive.
  ///
  /// In en, this message translates to:
  /// **'Set how learners can receive this material.'**
  String get supplierSetHowLearnersReceive;

  /// No description provided for @supplierPhotosSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add photos to help learners see the material clearly.'**
  String get supplierPhotosSectionSubtitle;

  /// No description provided for @supplierChecklist.
  ///
  /// In en, this message translates to:
  /// **'Checklist'**
  String get supplierChecklist;

  /// No description provided for @supplierReadyToPublish.
  ///
  /// In en, this message translates to:
  /// **'Ready to publish'**
  String get supplierReadyToPublish;

  /// No description provided for @supplierChooseCategoryChecklist.
  ///
  /// In en, this message translates to:
  /// **'Choose a category'**
  String get supplierChooseCategoryChecklist;

  /// No description provided for @supplierEnterMaterialTypeChecklist.
  ///
  /// In en, this message translates to:
  /// **'Enter material type/name'**
  String get supplierEnterMaterialTypeChecklist;

  /// No description provided for @supplierEnterListingTitleChecklist.
  ///
  /// In en, this message translates to:
  /// **'Enter listing title'**
  String get supplierEnterListingTitleChecklist;

  /// No description provided for @supplierAddDescriptionChecklist.
  ///
  /// In en, this message translates to:
  /// **'Add description'**
  String get supplierAddDescriptionChecklist;

  /// No description provided for @supplierSetConditionChecklist.
  ///
  /// In en, this message translates to:
  /// **'Set condition'**
  String get supplierSetConditionChecklist;

  /// No description provided for @supplierAddQuantityUnitChecklist.
  ///
  /// In en, this message translates to:
  /// **'Add quantity and unit'**
  String get supplierAddQuantityUnitChecklist;

  /// No description provided for @supplierSelectFreeOrPriceChecklist.
  ///
  /// In en, this message translates to:
  /// **'Select Free or enter a valid price'**
  String get supplierSelectFreeOrPriceChecklist;

  /// No description provided for @supplierVerifyPaidPriceChecklist.
  ///
  /// In en, this message translates to:
  /// **'Verify the paid price'**
  String get supplierVerifyPaidPriceChecklist;

  /// No description provided for @supplierChooseFulfillmentChecklist.
  ///
  /// In en, this message translates to:
  /// **'Choose at least one fulfillment option'**
  String get supplierChooseFulfillmentChecklist;

  /// No description provided for @supplierAddPhotoChecklist.
  ///
  /// In en, this message translates to:
  /// **'Add at least one photo'**
  String get supplierAddPhotoChecklist;

  /// No description provided for @supplierGeneralCategory.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get supplierGeneralCategory;

  /// No description provided for @supplierImageUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Image upload failed'**
  String get supplierImageUploadFailed;

  /// No description provided for @supplierEnterMaterialNameBeforeCategory.
  ///
  /// In en, this message translates to:
  /// **'Enter the material name before requesting a new category.'**
  String get supplierEnterMaterialNameBeforeCategory;

  /// No description provided for @supplierDescribeMaterialForCategory.
  ///
  /// In en, this message translates to:
  /// **'Describe the material so admin can review the category request.'**
  String get supplierDescribeMaterialForCategory;

  /// No description provided for @supplierEnterRequestedCategoryName.
  ///
  /// In en, this message translates to:
  /// **'Enter the requested category name.'**
  String get supplierEnterRequestedCategoryName;

  /// No description provided for @supplierExplainWhyCategoriesDoNotFit.
  ///
  /// In en, this message translates to:
  /// **'Explain why existing categories do not fit.'**
  String get supplierExplainWhyCategoriesDoNotFit;

  /// No description provided for @supplierEnterValidQuantityForMaterial.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid quantity for this material.'**
  String get supplierEnterValidQuantityForMaterial;

  /// No description provided for @supplierEnterUnitForMaterial.
  ///
  /// In en, this message translates to:
  /// **'Enter the unit for this material.'**
  String get supplierEnterUnitForMaterial;

  /// No description provided for @supplierCouldNotUploadImages.
  ///
  /// In en, this message translates to:
  /// **'We could not upload the images. Please try again.'**
  String get supplierCouldNotUploadImages;

  /// No description provided for @supplierCategoryStillPendingReview.
  ///
  /// In en, this message translates to:
  /// **'Your category request is still pending admin review.'**
  String get supplierCategoryStillPendingReview;

  /// No description provided for @supplierCategoryNoLongerAvailable.
  ///
  /// In en, this message translates to:
  /// **'The selected category is no longer available. Refresh categories and choose again.'**
  String get supplierCategoryNoLongerAvailable;

  /// No description provided for @supplierDetailsNotSavedComplete.
  ///
  /// In en, this message translates to:
  /// **'Some material details were not saved. Please complete the missing fields.'**
  String get supplierDetailsNotSavedComplete;

  /// No description provided for @supplierCouldNotLoadSavedDraft.
  ///
  /// In en, this message translates to:
  /// **'Could not load saved listing draft. Please try again.'**
  String get supplierCouldNotLoadSavedDraft;

  /// No description provided for @supplierUseForListing.
  ///
  /// In en, this message translates to:
  /// **'Use {name} for this listing.'**
  String supplierUseForListing(String name);

  /// No description provided for @supplierCategoryRejectedUseSuggested.
  ///
  /// In en, this message translates to:
  /// **'Your category request was rejected. Use {name} for this listing.'**
  String supplierCategoryRejectedUseSuggested(String name);

  /// No description provided for @supplierCategoryRejectedChooseExisting.
  ///
  /// In en, this message translates to:
  /// **'Your category request was rejected. Choose an existing category and continue.'**
  String get supplierCategoryRejectedChooseExisting;

  /// No description provided for @supplierResolveCategoryBeforePriceReview.
  ///
  /// In en, this message translates to:
  /// **'Resolve the category request before submitting price review.'**
  String get supplierResolveCategoryBeforePriceReview;

  /// No description provided for @supplierSelectValidCategoryBeforePriceReview.
  ///
  /// In en, this message translates to:
  /// **'Please select a valid category before submitting price review.'**
  String get supplierSelectValidCategoryBeforePriceReview;

  /// No description provided for @supplierEnterMaterialNameBeforePriceReview.
  ///
  /// In en, this message translates to:
  /// **'Enter material name before submitting price review.'**
  String get supplierEnterMaterialNameBeforePriceReview;

  /// No description provided for @supplierEnterDescriptionBeforePriceReview.
  ///
  /// In en, this message translates to:
  /// **'Enter material description before submitting price review.'**
  String get supplierEnterDescriptionBeforePriceReview;

  /// No description provided for @supplierQuantityUnitRequiredBeforePriceReview.
  ///
  /// In en, this message translates to:
  /// **'Quantity and unit are required before submitting price review.'**
  String get supplierQuantityUnitRequiredBeforePriceReview;

  /// No description provided for @supplierEnterValidPaidPriceBeforePriceReview.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid paid price before submitting price review.'**
  String get supplierEnterValidPaidPriceBeforePriceReview;

  /// No description provided for @supplierEnterMaterialNameBeforePriceReview2.
  ///
  /// In en, this message translates to:
  /// **'Enter a material name before submitting price review.'**
  String get supplierEnterMaterialNameBeforePriceReview2;

  /// No description provided for @supplierPriceAcceptedMaxAllowed.
  ///
  /// In en, this message translates to:
  /// **'Price accepted. Maximum allowed price is {max} NIS.'**
  String supplierPriceAcceptedMaxAllowed(String max);

  /// No description provided for @supplierMaxAllowedPriceEnterLess.
  ///
  /// In en, this message translates to:
  /// **'The maximum allowed price is {max} NIS. Please enter {max} NIS or less.'**
  String supplierMaxAllowedPriceEnterLess(String max);

  /// No description provided for @supplierMaxAllowedPricePerUnitEnterLess.
  ///
  /// In en, this message translates to:
  /// **'Maximum allowed price is {max} NIS per {unit}. Please enter {max} NIS or less.'**
  String supplierMaxAllowedPricePerUnitEnterLess(String max, String unit);

  /// No description provided for @supplierPaidMaterialNeedsPriceReview.
  ///
  /// In en, this message translates to:
  /// **'This paid material needs admin price review before publishing.'**
  String get supplierPaidMaterialNeedsPriceReview;

  /// No description provided for @supplierMaterialBeingPublished.
  ///
  /// In en, this message translates to:
  /// **'This material is already being published. Please wait a moment.'**
  String get supplierMaterialBeingPublished;

  /// No description provided for @supplierPublishAttemptMismatch.
  ///
  /// In en, this message translates to:
  /// **'This publish attempt no longer matches the saved request. Reset the form or try again from a new Add Material page.'**
  String get supplierPublishAttemptMismatch;

  /// No description provided for @supplierSelectValidCategoryBeforePublishing.
  ///
  /// In en, this message translates to:
  /// **'Please select a valid category before publishing.'**
  String get supplierSelectValidCategoryBeforePublishing;

  /// No description provided for @supplierEnterNumberGreaterThanZero.
  ///
  /// In en, this message translates to:
  /// **'Enter a number greater than zero'**
  String get supplierEnterNumberGreaterThanZero;

  /// No description provided for @supplierUnitPriceMustBeOrLess.
  ///
  /// In en, this message translates to:
  /// **'Unit price must be {max} NIS or less.'**
  String supplierUnitPriceMustBeOrLess(String max);

  /// No description provided for @supplierListingTitleHintExample.
  ///
  /// In en, this message translates to:
  /// **'e.g., Half-Size Breadboard Kits (Spare Batch)'**
  String get supplierListingTitleHintExample;

  /// No description provided for @supplierInventoryOverview.
  ///
  /// In en, this message translates to:
  /// **'Inventory overview'**
  String get supplierInventoryOverview;

  /// No description provided for @supplierMonitorMaterialAvailability.
  ///
  /// In en, this message translates to:
  /// **'Monitor your material availability, requests, and listing status.'**
  String get supplierMonitorMaterialAvailability;

  /// No description provided for @supplierClearSearch.
  ///
  /// In en, this message translates to:
  /// **'Clear search'**
  String get supplierClearSearch;

  /// No description provided for @supplierResetFilters.
  ///
  /// In en, this message translates to:
  /// **'Reset filters'**
  String get supplierResetFilters;

  /// No description provided for @supplierReset.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get supplierReset;

  /// No description provided for @supplierClearAll.
  ///
  /// In en, this message translates to:
  /// **'Clear all'**
  String get supplierClearAll;

  /// No description provided for @supplierMaterialsSection.
  ///
  /// In en, this message translates to:
  /// **'Materials'**
  String get supplierMaterialsSection;

  /// No description provided for @supplierShownOfTotal.
  ///
  /// In en, this message translates to:
  /// **'{shown} shown of {total}'**
  String supplierShownOfTotal(int shown, int total);

  /// No description provided for @supplierListingPreviewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This is how your material will appear to learners.'**
  String get supplierListingPreviewSubtitle;

  /// No description provided for @supplierMaterialTitlePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Material title will appear here'**
  String get supplierMaterialTitlePlaceholder;

  /// No description provided for @supplierShortDescriptionPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Short description of your material will appear here.'**
  String get supplierShortDescriptionPlaceholder;

  /// No description provided for @supplierQuantityPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Quantity will appear here'**
  String get supplierQuantityPlaceholder;

  /// No description provided for @supplierPickupLocationPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Pickup location will appear here'**
  String get supplierPickupLocationPlaceholder;

  /// No description provided for @supplierPickupAvailable.
  ///
  /// In en, this message translates to:
  /// **'Pickup available'**
  String get supplierPickupAvailable;

  /// No description provided for @supplierPickupUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Pickup unavailable'**
  String get supplierPickupUnavailable;

  /// No description provided for @supplierInternalDeliveryAvailable.
  ///
  /// In en, this message translates to:
  /// **'Internal delivery available'**
  String get supplierInternalDeliveryAvailable;

  /// No description provided for @supplierDeliveryUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Delivery unavailable'**
  String get supplierDeliveryUnavailable;

  /// No description provided for @supplierNoImageYet.
  ///
  /// In en, this message translates to:
  /// **'No image yet'**
  String get supplierNoImageYet;

  /// No description provided for @supplierAddPhotosToSeePreview.
  ///
  /// In en, this message translates to:
  /// **'Add photos to see preview'**
  String get supplierAddPhotosToSeePreview;

  /// No description provided for @supplierYouCanAddUpToPhotos.
  ///
  /// In en, this message translates to:
  /// **'You can add up to {max} photos.'**
  String supplierYouCanAddUpToPhotos(int max);

  /// No description provided for @supplierOnlyMorePhotosCanBeAdded.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Only 1 more photo can be added.} other{Only {count} more photos can be added.}}'**
  String supplierOnlyMorePhotosCanBeAdded(int count);

  /// No description provided for @supplierCouldNotReadImage.
  ///
  /// In en, this message translates to:
  /// **'Could not read \"{name}\". Try another image.'**
  String supplierCouldNotReadImage(String name);

  /// No description provided for @supplierFileLargerThan5Mb.
  ///
  /// In en, this message translates to:
  /// **'{name} is larger than 5 MB.'**
  String supplierFileLargerThan5Mb(String name);

  /// No description provided for @supplierFileMustBeJpgPngWebp.
  ///
  /// In en, this message translates to:
  /// **'{name} must be JPG, PNG, or WebP.'**
  String supplierFileMustBeJpgPngWebp(String name);

  /// No description provided for @supplierReuseHistoryWillAppear.
  ///
  /// In en, this message translates to:
  /// **'Reuse history will appear here after completed reservations.'**
  String get supplierReuseHistoryWillAppear;

  /// No description provided for @supplierAvailableOfTotal.
  ///
  /// In en, this message translates to:
  /// **'Available: {available} of {total} {unit}'**
  String supplierAvailableOfTotal(String available, String total, String unit);

  /// No description provided for @supplierAccessDenied.
  ///
  /// In en, this message translates to:
  /// **'Access denied'**
  String get supplierAccessDenied;

  /// No description provided for @supplierYouNeedASupplierAccountTo.
  ///
  /// In en, this message translates to:
  /// **'You need a supplier account to access this area.'**
  String get supplierYouNeedASupplierAccountTo;

  /// No description provided for @supplierSupplierAccessRequired.
  ///
  /// In en, this message translates to:
  /// **'Supplier access required'**
  String get supplierSupplierAccessRequired;

  /// No description provided for @supplierYouNeedASupplierRoleTo.
  ///
  /// In en, this message translates to:
  /// **'You need a Supplier role to access the Supplier Portal.'**
  String get supplierYouNeedASupplierRoleTo;

  /// No description provided for @supplierGoToHome.
  ///
  /// In en, this message translates to:
  /// **'Go to home'**
  String get supplierGoToHome;

  /// No description provided for @supplierDeliveryRequested.
  ///
  /// In en, this message translates to:
  /// **'Delivery requested'**
  String get supplierDeliveryRequested;

  /// No description provided for @supplierAttentionNeedsYourResponse.
  ///
  /// In en, this message translates to:
  /// **'Needs your response'**
  String get supplierAttentionNeedsYourResponse;

  /// No description provided for @supplierAttentionWaitingForLearner.
  ///
  /// In en, this message translates to:
  /// **'Waiting for learner'**
  String get supplierAttentionWaitingForLearner;

  /// No description provided for @supplierAttentionInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get supplierAttentionInProgress;

  /// No description provided for @supplierAttentionAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Admin review'**
  String get supplierAttentionAdminReview;

  /// No description provided for @supplierAttentionNoFurtherAction.
  ///
  /// In en, this message translates to:
  /// **'No further action'**
  String get supplierAttentionNoFurtherAction;

  /// No description provided for @supplierAttentionTerminal.
  ///
  /// In en, this message translates to:
  /// **'Terminal'**
  String get supplierAttentionTerminal;

  /// No description provided for @supplierAttentionNextActor.
  ///
  /// In en, this message translates to:
  /// **'{attention} · Next: {actor}'**
  String supplierAttentionNextActor(String attention, String actor);

  /// No description provided for @supplierNextActorAdmin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get supplierNextActorAdmin;

  /// No description provided for @supplierNextActorSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get supplierNextActorSystem;

  /// No description provided for @supplierNextActorNone.
  ///
  /// In en, this message translates to:
  /// **'No actor'**
  String get supplierNextActorNone;

  /// No description provided for @supplierRecoveryNextAdmin.
  ///
  /// In en, this message translates to:
  /// **'Recovery · Next: Admin'**
  String get supplierRecoveryNextAdmin;

  /// No description provided for @supplierWorkflowInitialDecision.
  ///
  /// In en, this message translates to:
  /// **'Initial decision'**
  String get supplierWorkflowInitialDecision;

  /// No description provided for @supplierWorkflowScheduling.
  ///
  /// In en, this message translates to:
  /// **'Scheduling'**
  String get supplierWorkflowScheduling;

  /// No description provided for @supplierWorkflowSelfPickup.
  ///
  /// In en, this message translates to:
  /// **'Self pickup'**
  String get supplierWorkflowSelfPickup;

  /// No description provided for @supplierWorkflowDelivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get supplierWorkflowDelivery;

  /// No description provided for @supplierWorkflowRecovery.
  ///
  /// In en, this message translates to:
  /// **'Recovery'**
  String get supplierWorkflowRecovery;

  /// No description provided for @supplierCompletedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Completed successfully'**
  String get supplierCompletedSuccessfully;

  /// No description provided for @supplierNoResponseBeforeDeadline.
  ///
  /// In en, this message translates to:
  /// **'No response before the deadline'**
  String get supplierNoResponseBeforeDeadline;

  /// No description provided for @supplierCompletedFulfillment.
  ///
  /// In en, this message translates to:
  /// **'Completed fulfillment'**
  String get supplierCompletedFulfillment;

  /// No description provided for @supplierCancelledBeforeFulfillment.
  ///
  /// In en, this message translates to:
  /// **'Cancelled before fulfillment'**
  String get supplierCancelledBeforeFulfillment;

  /// No description provided for @supplierExpiredBeforeFulfillment.
  ///
  /// In en, this message translates to:
  /// **'Expired before fulfillment'**
  String get supplierExpiredBeforeFulfillment;

  /// No description provided for @supplierClosedAfterNoShow.
  ///
  /// In en, this message translates to:
  /// **'Closed after no-show'**
  String get supplierClosedAfterNoShow;

  /// No description provided for @supplierRejectedBeforeFulfillment.
  ///
  /// In en, this message translates to:
  /// **'Rejected before fulfillment'**
  String get supplierRejectedBeforeFulfillment;

  /// No description provided for @supplierFinalReservationOutcome.
  ///
  /// In en, this message translates to:
  /// **'Final reservation outcome'**
  String get supplierFinalReservationOutcome;

  /// No description provided for @supplierTerminalVerbCancelled.
  ///
  /// In en, this message translates to:
  /// **'cancelled'**
  String get supplierTerminalVerbCancelled;

  /// No description provided for @supplierTerminalVerbExpired.
  ///
  /// In en, this message translates to:
  /// **'expired'**
  String get supplierTerminalVerbExpired;

  /// No description provided for @supplierTerminalVerbCompleted.
  ///
  /// In en, this message translates to:
  /// **'completed'**
  String get supplierTerminalVerbCompleted;

  /// No description provided for @supplierTerminalVerbClosed.
  ///
  /// In en, this message translates to:
  /// **'closed'**
  String get supplierTerminalVerbClosed;

  /// No description provided for @supplierActionAcceptLearnerTime.
  ///
  /// In en, this message translates to:
  /// **'Accept learner time'**
  String get supplierActionAcceptLearnerTime;

  /// No description provided for @supplierActionCompleteSelfPickup.
  ///
  /// In en, this message translates to:
  /// **'Complete self pickup'**
  String get supplierActionCompleteSelfPickup;

  /// No description provided for @supplierProposeNewTime.
  ///
  /// In en, this message translates to:
  /// **'Propose different time'**
  String get supplierProposeNewTime;

  /// No description provided for @supplierAcceptNewTime.
  ///
  /// In en, this message translates to:
  /// **'Accept new time'**
  String get supplierAcceptNewTime;

  /// No description provided for @supplierActionMarkLearnerNoShow.
  ///
  /// In en, this message translates to:
  /// **'Mark learner no-show'**
  String get supplierActionMarkLearnerNoShow;

  /// No description provided for @supplierActionReportIncident.
  ///
  /// In en, this message translates to:
  /// **'Report incident'**
  String get supplierActionReportIncident;

  /// No description provided for @supplierActionReportNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Report no driver'**
  String get supplierActionReportNoDriver;

  /// No description provided for @supplierActionMarkPickupExpired.
  ///
  /// In en, this message translates to:
  /// **'Mark pickup expired'**
  String get supplierActionMarkPickupExpired;

  /// No description provided for @supplierActionReportDriverNoShow.
  ///
  /// In en, this message translates to:
  /// **'Report driver no-show'**
  String get supplierActionReportDriverNoShow;

  /// No description provided for @supplierActionSubmitRecoveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Submit recovery pickup window'**
  String get supplierActionSubmitRecoveryWindow;

  /// No description provided for @supplierConfirmPickup.
  ///
  /// In en, this message translates to:
  /// **'Confirm pickup'**
  String get supplierConfirmPickup;

  /// No description provided for @supplierSubmitPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Submit pickup window'**
  String get supplierSubmitPickupWindow;

  /// No description provided for @supplierReviewReschedule.
  ///
  /// In en, this message translates to:
  /// **'Review reschedule'**
  String get supplierReviewReschedule;

  /// No description provided for @supplierReportToAdmin.
  ///
  /// In en, this message translates to:
  /// **'Report to admin'**
  String get supplierReportToAdmin;

  /// No description provided for @supplierStatusFilterAwaitingLearner.
  ///
  /// In en, this message translates to:
  /// **'Awaiting learner'**
  String get supplierStatusFilterAwaitingLearner;

  /// No description provided for @supplierStatusFilterAwaitingSupplier.
  ///
  /// In en, this message translates to:
  /// **'Awaiting supplier'**
  String get supplierStatusFilterAwaitingSupplier;

  /// No description provided for @supplierStatusFilterAwaitingResolution.
  ///
  /// In en, this message translates to:
  /// **'Awaiting resolution'**
  String get supplierStatusFilterAwaitingResolution;

  /// No description provided for @supplierNoShowReasonLearnerDidNotArrive.
  ///
  /// In en, this message translates to:
  /// **'Learner did not arrive'**
  String get supplierNoShowReasonLearnerDidNotArrive;

  /// No description provided for @supplierNoShowReasonRepeatedDelay.
  ///
  /// In en, this message translates to:
  /// **'Repeated delay'**
  String get supplierNoShowReasonRepeatedDelay;

  /// No description provided for @supplierNoShowReasonWrongInformation.
  ///
  /// In en, this message translates to:
  /// **'Wrong information'**
  String get supplierNoShowReasonWrongInformation;

  /// No description provided for @supplierNoShowReasonSafetyConcern.
  ///
  /// In en, this message translates to:
  /// **'Safety or trust concern'**
  String get supplierNoShowReasonSafetyConcern;

  /// No description provided for @supplierNoShowReasonOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get supplierNoShowReasonOther;

  /// No description provided for @supplierNotProposed.
  ///
  /// In en, this message translates to:
  /// **'Not proposed'**
  String get supplierNotProposed;

  /// No description provided for @supplierWindowUntil.
  ///
  /// In en, this message translates to:
  /// **'Until {time}'**
  String supplierWindowUntil(String time);

  /// No description provided for @supplierWindowFrom.
  ///
  /// In en, this message translates to:
  /// **'From {time}'**
  String supplierWindowFrom(String time);

  /// No description provided for @supplierTomorrow.
  ///
  /// In en, this message translates to:
  /// **'Tomorrow'**
  String get supplierTomorrow;

  /// No description provided for @supplierNeedsAttention.
  ///
  /// In en, this message translates to:
  /// **'Needs attention'**
  String get supplierNeedsAttention;

  /// No description provided for @supplierOperationalOverview.
  ///
  /// In en, this message translates to:
  /// **'Operational overview'**
  String get supplierOperationalOverview;

  /// No description provided for @supplierAllAttention.
  ///
  /// In en, this message translates to:
  /// **'All attention'**
  String get supplierAllAttention;

  /// No description provided for @supplierAllFulfillment.
  ///
  /// In en, this message translates to:
  /// **'All fulfillment'**
  String get supplierAllFulfillment;

  /// No description provided for @supplierAllStatuses.
  ///
  /// In en, this message translates to:
  /// **'All statuses'**
  String get supplierAllStatuses;

  /// No description provided for @supplierMoreFilters.
  ///
  /// In en, this message translates to:
  /// **'More filters'**
  String get supplierMoreFilters;

  /// No description provided for @supplierFiltersCount.
  ///
  /// In en, this message translates to:
  /// **'Filters {count}'**
  String supplierFiltersCount(String count);

  /// No description provided for @supplierDateRange.
  ///
  /// In en, this message translates to:
  /// **'Date range'**
  String get supplierDateRange;

  /// No description provided for @supplierSearchRequestsHint.
  ///
  /// In en, this message translates to:
  /// **'Search material, learner, or reservation ID'**
  String get supplierSearchRequestsHint;

  /// No description provided for @supplierHistoryActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get supplierHistoryActive;

  /// No description provided for @supplierHistoryTerminal.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get supplierHistoryTerminal;

  /// No description provided for @supplierCompletedCount.
  ///
  /// In en, this message translates to:
  /// **'Completed {count}'**
  String supplierCompletedCount(String count);

  /// No description provided for @supplierClosedCount.
  ///
  /// In en, this message translates to:
  /// **'Closed {count}'**
  String supplierClosedCount(String count);

  /// No description provided for @supplierShowingRange.
  ///
  /// In en, this message translates to:
  /// **'Showing {start}–{end} of {total}'**
  String supplierShowingRange(String start, String end, String total);

  /// No description provided for @supplierShowingRangeRequests.
  ///
  /// In en, this message translates to:
  /// **'Showing {start}–{end} of {total} requests'**
  String supplierShowingRangeRequests(String start, String end, String total);

  /// No description provided for @supplierActiveFiltersCount.
  ///
  /// In en, this message translates to:
  /// **'{count} filters'**
  String supplierActiveFiltersCount(String count);

  /// No description provided for @supplierColumnRequest.
  ///
  /// In en, this message translates to:
  /// **'Request'**
  String get supplierColumnRequest;

  /// No description provided for @supplierColumnFulfillmentSchedule.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment & schedule'**
  String get supplierColumnFulfillmentSchedule;

  /// No description provided for @supplierColumnStatusAttention.
  ///
  /// In en, this message translates to:
  /// **'Status & attention'**
  String get supplierColumnStatusAttention;

  /// No description provided for @supplierColumnDetails.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get supplierColumnDetails;

  /// No description provided for @supplierPerPage.
  ///
  /// In en, this message translates to:
  /// **'{count} per page'**
  String supplierPerPage(String count);

  /// No description provided for @supplierViewRequestDetails.
  ///
  /// In en, this message translates to:
  /// **'View request details'**
  String get supplierViewRequestDetails;

  /// No description provided for @supplierViewRequestDetailsForMaterial.
  ///
  /// In en, this message translates to:
  /// **'View {material} request details'**
  String supplierViewRequestDetailsForMaterial(String material);

  /// No description provided for @supplierNoConfirmedTimeYet.
  ///
  /// In en, this message translates to:
  /// **'No confirmed time yet'**
  String get supplierNoConfirmedTimeYet;

  /// No description provided for @supplierAdminRecoveryInProgress.
  ///
  /// In en, this message translates to:
  /// **'Admin recovery in progress'**
  String get supplierAdminRecoveryInProgress;

  /// No description provided for @supplierDeliveryHandledByDriver.
  ///
  /// In en, this message translates to:
  /// **'This reservation is handled by delivery. The driver will mark it completed.'**
  String get supplierDeliveryHandledByDriver;

  /// No description provided for @supplierMessagesWorkspaceNote.
  ///
  /// In en, this message translates to:
  /// **'Request messages will remain available in the request workspace.'**
  String get supplierMessagesWorkspaceNote;

  /// No description provided for @supplierNoFurtherActionRequired.
  ///
  /// In en, this message translates to:
  /// **'No further action is required for this request.'**
  String get supplierNoFurtherActionRequired;

  /// No description provided for @supplierRequestDetails.
  ///
  /// In en, this message translates to:
  /// **'Request details'**
  String get supplierRequestDetails;

  /// No description provided for @supplierBackToIncomingRequests.
  ///
  /// In en, this message translates to:
  /// **'Back to Incoming Requests'**
  String get supplierBackToIncomingRequests;

  /// No description provided for @supplierAvailableActions.
  ///
  /// In en, this message translates to:
  /// **'Available actions'**
  String get supplierAvailableActions;

  /// No description provided for @supplierMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get supplierMore;

  /// No description provided for @supplierMarkLearnerNoShowTitle.
  ///
  /// In en, this message translates to:
  /// **'Mark learner as no-show?'**
  String get supplierMarkLearnerNoShowTitle;

  /// No description provided for @supplierMarkLearnerNoShowMessage.
  ///
  /// In en, this message translates to:
  /// **'This will record the learner no-show for this reservation.'**
  String get supplierMarkLearnerNoShowMessage;

  /// No description provided for @supplierMarkLearnerNoShowConfirm.
  ///
  /// In en, this message translates to:
  /// **'Mark no-show'**
  String get supplierMarkLearnerNoShowConfirm;

  /// No description provided for @supplierCouldNotUpdateRequest.
  ///
  /// In en, this message translates to:
  /// **'Could not update this request.'**
  String get supplierCouldNotUpdateRequest;

  /// No description provided for @supplierRequestSummary.
  ///
  /// In en, this message translates to:
  /// **'Request summary'**
  String get supplierRequestSummary;

  /// No description provided for @supplierLearnerLine.
  ///
  /// In en, this message translates to:
  /// **'Learner: {name}'**
  String supplierLearnerLine(String name);

  /// No description provided for @supplierOriginalLearnerNote.
  ///
  /// In en, this message translates to:
  /// **'Original learner note'**
  String get supplierOriginalLearnerNote;

  /// No description provided for @supplierDeliveryAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery address'**
  String get supplierDeliveryAddressLabel;

  /// No description provided for @supplierDeliveryAddressPrefix.
  ///
  /// In en, this message translates to:
  /// **'Delivery address: {address}'**
  String supplierDeliveryAddressPrefix(String address);

  /// No description provided for @supplierSupplierProposal.
  ///
  /// In en, this message translates to:
  /// **'Supplier proposal'**
  String get supplierSupplierProposal;

  /// No description provided for @supplierLearnerProposal.
  ///
  /// In en, this message translates to:
  /// **'Learner proposal'**
  String get supplierLearnerProposal;

  /// No description provided for @supplierConfirmedPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Confirmed pickup window'**
  String get supplierConfirmedPickupWindow;

  /// No description provided for @supplierScheduleNegotiation.
  ///
  /// In en, this message translates to:
  /// **'Schedule & negotiation'**
  String get supplierScheduleNegotiation;

  /// No description provided for @supplierAdminInitiatedRecovery.
  ///
  /// In en, this message translates to:
  /// **'Admin-initiated recovery'**
  String get supplierAdminInitiatedRecovery;

  /// No description provided for @supplierPendingReschedule.
  ///
  /// In en, this message translates to:
  /// **'Pending reschedule'**
  String get supplierPendingReschedule;

  /// No description provided for @supplierNoWindowProposed.
  ///
  /// In en, this message translates to:
  /// **'No pickup or delivery window is currently proposed.'**
  String get supplierNoWindowProposed;

  /// No description provided for @supplierSchedulingContext.
  ///
  /// In en, this message translates to:
  /// **'Scheduling context'**
  String get supplierSchedulingContext;

  /// No description provided for @supplierEarliestFeasibleDelivery.
  ///
  /// In en, this message translates to:
  /// **'Earliest feasible delivery: {time}'**
  String supplierEarliestFeasibleDelivery(String time);

  /// No description provided for @supplierNoWindowConfirmedPickup.
  ///
  /// In en, this message translates to:
  /// **'No pickup or delivery window was confirmed for this request.'**
  String get supplierNoWindowConfirmedPickup;

  /// No description provided for @supplierNoWindowConfirmedBeforeTerminal.
  ///
  /// In en, this message translates to:
  /// **'No pickup window was confirmed before this request was {verb}.'**
  String supplierNoWindowConfirmedBeforeTerminal(String verb);

  /// No description provided for @supplierScheduleHistory.
  ///
  /// In en, this message translates to:
  /// **'Schedule history'**
  String get supplierScheduleHistory;

  /// No description provided for @supplierFulfillmentAndDelivery.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment & delivery'**
  String get supplierFulfillmentAndDelivery;

  /// No description provided for @supplierHandoverCodeAvailable.
  ///
  /// In en, this message translates to:
  /// **'Code available'**
  String get supplierHandoverCodeAvailable;

  /// No description provided for @supplierFailureRecovery.
  ///
  /// In en, this message translates to:
  /// **'Failure / recovery'**
  String get supplierFailureRecovery;

  /// No description provided for @supplierDeliveryNotCreated.
  ///
  /// In en, this message translates to:
  /// **'Delivery has not been selected or created for this reservation.'**
  String get supplierDeliveryNotCreated;

  /// No description provided for @supplierAttentionTitle.
  ///
  /// In en, this message translates to:
  /// **'Attention'**
  String get supplierAttentionTitle;

  /// No description provided for @supplierAwaitingAdminResolution.
  ///
  /// In en, this message translates to:
  /// **'This request is awaiting admin resolution. Supplier controls are read-only unless an available action is provided.'**
  String get supplierAwaitingAdminResolution;

  /// No description provided for @supplierIncidentAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Incident / admin review'**
  String get supplierIncidentAdminReview;

  /// No description provided for @supplierReportIdLabel.
  ///
  /// In en, this message translates to:
  /// **'Report ID'**
  String get supplierReportIdLabel;

  /// No description provided for @supplierOperationalStateLabel.
  ///
  /// In en, this message translates to:
  /// **'Operational state'**
  String get supplierOperationalStateLabel;

  /// No description provided for @supplierSupplierExplanation.
  ///
  /// In en, this message translates to:
  /// **'Supplier explanation'**
  String get supplierSupplierExplanation;

  /// No description provided for @supplierAdminReviewNote.
  ///
  /// In en, this message translates to:
  /// **'Admin review note'**
  String get supplierAdminReviewNote;

  /// No description provided for @supplierGroupContext.
  ///
  /// In en, this message translates to:
  /// **'Group context'**
  String get supplierGroupContext;

  /// No description provided for @supplierItemsInGroup.
  ///
  /// In en, this message translates to:
  /// **'Items in group'**
  String get supplierItemsInGroup;

  /// No description provided for @supplierGroupedReservationItem.
  ///
  /// In en, this message translates to:
  /// **'Grouped reservation item'**
  String get supplierGroupedReservationItem;

  /// No description provided for @supplierMoreGroupItems.
  ///
  /// In en, this message translates to:
  /// **'More items are available in the group.'**
  String get supplierMoreGroupItems;

  /// No description provided for @supplierMessagesTitle.
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get supplierMessagesTitle;

  /// No description provided for @supplierMessagesTitleWithCount.
  ///
  /// In en, this message translates to:
  /// **'Messages ({count})'**
  String supplierMessagesTitleWithCount(int count);

  /// No description provided for @supplierNoMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No messages yet.'**
  String get supplierNoMessagesYet;

  /// No description provided for @supplierTypeMessageHint.
  ///
  /// In en, this message translates to:
  /// **'Type a message…'**
  String get supplierTypeMessageHint;

  /// No description provided for @supplierSendMessageTooltip.
  ///
  /// In en, this message translates to:
  /// **'Send message'**
  String get supplierSendMessageTooltip;

  /// No description provided for @supplierYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get supplierYou;

  /// No description provided for @supplierReservationUpdated.
  ///
  /// In en, this message translates to:
  /// **'Reservation updated'**
  String get supplierReservationUpdated;

  /// No description provided for @supplierHistoryStatusChange.
  ///
  /// In en, this message translates to:
  /// **'{from} → {to}'**
  String supplierHistoryStatusChange(String from, String to);

  /// No description provided for @supplierRequestNotFound.
  ///
  /// In en, this message translates to:
  /// **'Request not found'**
  String get supplierRequestNotFound;

  /// No description provided for @supplierRequestUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This request is unavailable.'**
  String get supplierRequestUnavailable;

  /// No description provided for @supplierCouldNotLoadRequestTitle.
  ///
  /// In en, this message translates to:
  /// **'Could not load request'**
  String get supplierCouldNotLoadRequestTitle;

  /// No description provided for @supplierCouldNotLoadRequest.
  ///
  /// In en, this message translates to:
  /// **'We could not load this request. Please try again.'**
  String get supplierCouldNotLoadRequest;

  /// No description provided for @supplierFulfillmentLabel.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment'**
  String get supplierFulfillmentLabel;

  /// No description provided for @supplierLearnerEmail.
  ///
  /// In en, this message translates to:
  /// **'Learner email'**
  String get supplierLearnerEmail;

  /// No description provided for @supplierMethodLabel.
  ///
  /// In en, this message translates to:
  /// **'Method'**
  String get supplierMethodLabel;

  /// No description provided for @supplierDeliveryStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery status'**
  String get supplierDeliveryStatusLabel;

  /// No description provided for @supplierGroupLabel.
  ///
  /// In en, this message translates to:
  /// **'Group'**
  String get supplierGroupLabel;

  /// No description provided for @supplierHandoverLabel.
  ///
  /// In en, this message translates to:
  /// **'Handover'**
  String get supplierHandoverLabel;

  /// No description provided for @supplierOutcomeLabel.
  ///
  /// In en, this message translates to:
  /// **'Outcome'**
  String get supplierOutcomeLabel;

  /// No description provided for @supplierGroupIdLabel.
  ///
  /// In en, this message translates to:
  /// **'Group ID'**
  String get supplierGroupIdLabel;

  /// No description provided for @supplierItemsLabel.
  ///
  /// In en, this message translates to:
  /// **'Items'**
  String get supplierItemsLabel;

  /// No description provided for @supplierConfirmedDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Confirmed delivery window'**
  String get supplierConfirmedDeliveryWindow;

  /// No description provided for @supplierSupplierDeliveryPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Supplier delivery pickup window'**
  String get supplierSupplierDeliveryPickupWindow;

  /// No description provided for @supplierNewWindowAwaiting.
  ///
  /// In en, this message translates to:
  /// **'A new window is awaiting the next response.'**
  String get supplierNewWindowAwaiting;

  /// No description provided for @supplierActorRequestedReschedule.
  ///
  /// In en, this message translates to:
  /// **'{actor} requested reschedule'**
  String supplierActorRequestedReschedule(String actor);

  /// No description provided for @supplierNextActorLine.
  ///
  /// In en, this message translates to:
  /// **'Next actor: {actor}'**
  String supplierNextActorLine(String actor);

  /// No description provided for @supplierReservationHistory.
  ///
  /// In en, this message translates to:
  /// **'Reservation history'**
  String get supplierReservationHistory;

  /// No description provided for @supplierNoHistoryEvents.
  ///
  /// In en, this message translates to:
  /// **'No history events were returned.'**
  String get supplierNoHistoryEvents;

  /// No description provided for @supplierHistoryEventAcceptedBySupplier.
  ///
  /// In en, this message translates to:
  /// **'Accepted by supplier'**
  String get supplierHistoryEventAcceptedBySupplier;

  /// No description provided for @supplierHistoryEventDeclinedBySupplier.
  ///
  /// In en, this message translates to:
  /// **'Declined by supplier'**
  String get supplierHistoryEventDeclinedBySupplier;

  /// No description provided for @supplierHistoryEventPickupCompletedBySupplier.
  ///
  /// In en, this message translates to:
  /// **'Pickup completed by supplier'**
  String get supplierHistoryEventPickupCompletedBySupplier;

  /// No description provided for @supplierHistoryEventSupplierRequestedReschedule.
  ///
  /// In en, this message translates to:
  /// **'Supplier requested reschedule'**
  String get supplierHistoryEventSupplierRequestedReschedule;

  /// No description provided for @supplierHistoryEventSupplierAcceptedLearnerReschedule.
  ///
  /// In en, this message translates to:
  /// **'Supplier accepted learner reschedule proposal'**
  String get supplierHistoryEventSupplierAcceptedLearnerReschedule;

  /// No description provided for @supplierHistoryEventSupplierCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled by supplier'**
  String get supplierHistoryEventSupplierCancelled;

  /// No description provided for @supplierHistoryEventSupplierCancelledPendingReschedule.
  ///
  /// In en, this message translates to:
  /// **'Cancelled by supplier after reschedule request'**
  String get supplierHistoryEventSupplierCancelledPendingReschedule;

  /// No description provided for @supplierHistoryEventReportedAfterMissedPickup.
  ///
  /// In en, this message translates to:
  /// **'Reported to admin after missed pickup window'**
  String get supplierHistoryEventReportedAfterMissedPickup;

  /// No description provided for @supplierHistoryEventRequestedByLearner.
  ///
  /// In en, this message translates to:
  /// **'Reservation requested by learner'**
  String get supplierHistoryEventRequestedByLearner;

  /// No description provided for @supplierHistoryEventCancelledByLearner.
  ///
  /// In en, this message translates to:
  /// **'Cancelled by learner'**
  String get supplierHistoryEventCancelledByLearner;

  /// No description provided for @supplierHistoryEventCancelledByLearnerAwaitingConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Cancelled by learner while awaiting confirmation'**
  String get supplierHistoryEventCancelledByLearnerAwaitingConfirmation;

  /// No description provided for @supplierHistoryEventLearnerAcceptedSupplierPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Learner accepted supplier proposed pickup window'**
  String get supplierHistoryEventLearnerAcceptedSupplierPickupWindow;

  /// No description provided for @supplierHistoryEventLearnerConfirmedDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Learner confirmed feasible delivery window'**
  String get supplierHistoryEventLearnerConfirmedDeliveryWindow;

  /// No description provided for @supplierHistoryEventLearnerRequestedReschedule.
  ///
  /// In en, this message translates to:
  /// **'Learner requested reschedule'**
  String get supplierHistoryEventLearnerRequestedReschedule;

  /// No description provided for @supplierHistoryEventLearnerCancelledAfterReschedule.
  ///
  /// In en, this message translates to:
  /// **'Learner cancelled after reschedule request'**
  String get supplierHistoryEventLearnerCancelledAfterReschedule;

  /// No description provided for @supplierHistoryEventLearnerNoShowAfterPickup.
  ///
  /// In en, this message translates to:
  /// **'Learner no-show after pickup window'**
  String get supplierHistoryEventLearnerNoShowAfterPickup;

  /// No description provided for @supplierHistoryEventLearnerReportedSupplierIssue.
  ///
  /// In en, this message translates to:
  /// **'Learner reported supplier issue after pickup window'**
  String get supplierHistoryEventLearnerReportedSupplierIssue;

  /// No description provided for @supplierHistoryEventPendingExpiredAfterPreferredWindow.
  ///
  /// In en, this message translates to:
  /// **'Expired after the last preferred scheduling window passed without supplier response'**
  String get supplierHistoryEventPendingExpiredAfterPreferredWindow;

  /// No description provided for @supplierHistoryEventPendingExpiredAfterTimeout.
  ///
  /// In en, this message translates to:
  /// **'Expired after timeout without supplier response'**
  String get supplierHistoryEventPendingExpiredAfterTimeout;

  /// No description provided for @supplierHistoryEventMissedPickupAutoExpired.
  ///
  /// In en, this message translates to:
  /// **'Automatically expired after missed pickup window'**
  String get supplierHistoryEventMissedPickupAutoExpired;

  /// No description provided for @supplierHistoryEventNoDriverAvailable.
  ///
  /// In en, this message translates to:
  /// **'No driver available'**
  String get supplierHistoryEventNoDriverAvailable;

  /// No description provided for @supplierHistoryEventNoDriverAutoEscalated.
  ///
  /// In en, this message translates to:
  /// **'No driver auto-escalated'**
  String get supplierHistoryEventNoDriverAutoEscalated;

  /// No description provided for @supplierHistoryEventAssignedDriverPickupAutoEscalated.
  ///
  /// In en, this message translates to:
  /// **'Assigned-driver pickup auto-escalated'**
  String get supplierHistoryEventAssignedDriverPickupAutoEscalated;

  /// No description provided for @supplierHistoryEventDeliveryPickupWindowExpired.
  ///
  /// In en, this message translates to:
  /// **'Delivery pickup window expired'**
  String get supplierHistoryEventDeliveryPickupWindowExpired;

  /// No description provided for @supplierHistoryEventDriverNoShowAtSupplier.
  ///
  /// In en, this message translates to:
  /// **'Driver no-show at supplier pickup'**
  String get supplierHistoryEventDriverNoShowAtSupplier;

  /// No description provided for @supplierHistoryEventDriverNoShowReportedBySupplier.
  ///
  /// In en, this message translates to:
  /// **'Driver no-show reported by supplier'**
  String get supplierHistoryEventDriverNoShowReportedBySupplier;

  /// No description provided for @supplierHistoryEventSupplierMarkedPickupExpired.
  ///
  /// In en, this message translates to:
  /// **'Supplier marked pickup window expired'**
  String get supplierHistoryEventSupplierMarkedPickupExpired;

  /// No description provided for @supplierHistoryEventSupplierPickupWindowExpiredNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Supplier pickup window expired with no driver assigned'**
  String get supplierHistoryEventSupplierPickupWindowExpiredNoDriver;

  /// No description provided for @supplierHistoryEventDeliveryCompletedByDriver.
  ///
  /// In en, this message translates to:
  /// **'Delivery completed by driver'**
  String get supplierHistoryEventDeliveryCompletedByDriver;

  /// No description provided for @supplierHistoryEventGroupedDeliveryCompletedByDriver.
  ///
  /// In en, this message translates to:
  /// **'Grouped delivery completed by driver'**
  String get supplierHistoryEventGroupedDeliveryCompletedByDriver;

  /// No description provided for @supplierHistoryEventSupplierSubmittedPickupWindowNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Supplier submitted new pickup window after no driver available'**
  String get supplierHistoryEventSupplierSubmittedPickupWindowNoDriver;

  /// No description provided for @supplierHistoryEventSupplierSubmittedReplacementPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Supplier submitted replacement pickup window after partial pickup'**
  String get supplierHistoryEventSupplierSubmittedReplacementPickupWindow;

  /// No description provided for @supplierHistoryEventSupplierSubmittedPickupWindowAdminRecovery.
  ///
  /// In en, this message translates to:
  /// **'Supplier submitted new pickup window after admin recovery'**
  String get supplierHistoryEventSupplierSubmittedPickupWindowAdminRecovery;

  /// No description provided for @supplierHistoryEventAdminRequestedNewPickupWindowNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Admin asked supplier to choose a new pickup window after no driver was available'**
  String get supplierHistoryEventAdminRequestedNewPickupWindowNoDriver;

  /// No description provided for @supplierHistoryEventAdminRequestedNewPickupWindowPickupIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Admin asked supplier to choose a new pickup window after pickup was not completed'**
  String get supplierHistoryEventAdminRequestedNewPickupWindowPickupIncomplete;

  /// No description provided for @supplierHistoryEventAdminCancelledNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Admin cancelled and released hold after no driver available'**
  String get supplierHistoryEventAdminCancelledNoDriver;

  /// No description provided for @supplierHistoryEventAdminCancelledPickupIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Admin cancelled and released hold after pickup was not completed'**
  String get supplierHistoryEventAdminCancelledPickupIncomplete;

  /// No description provided for @supplierHistoryEventFulfillmentIssueReported.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment issue reported'**
  String get supplierHistoryEventFulfillmentIssueReported;

  /// No description provided for @supplierWorkflowField.
  ///
  /// In en, this message translates to:
  /// **'Workflow'**
  String get supplierWorkflowField;

  /// No description provided for @supplierRescheduleReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get supplierRescheduleReasonLabel;

  /// No description provided for @supplierRescheduleReasonHint.
  ///
  /// In en, this message translates to:
  /// **'Why are you requesting a new time?'**
  String get supplierRescheduleReasonHint;

  /// No description provided for @supplierSendRequest.
  ///
  /// In en, this message translates to:
  /// **'Send request'**
  String get supplierSendRequest;

  /// No description provided for @supplierRescheduleRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Reschedule request sent to learner.'**
  String get supplierRescheduleRequestSent;

  /// No description provided for @supplierChooseNewPickupWindow.
  ///
  /// In en, this message translates to:
  /// **'Choose new pickup window'**
  String get supplierChooseNewPickupWindow;

  /// No description provided for @supplierPickupWindowSubmittedWaiting.
  ///
  /// In en, this message translates to:
  /// **'Pickup window submitted. Waiting for driver again.'**
  String get supplierPickupWindowSubmittedWaiting;

  /// No description provided for @supplierNewPickupTimeAccepted.
  ///
  /// In en, this message translates to:
  /// **'New pickup time accepted.'**
  String get supplierNewPickupTimeAccepted;

  /// No description provided for @supplierReservationClosed.
  ///
  /// In en, this message translates to:
  /// **'Reservation closed.'**
  String get supplierReservationClosed;

  /// No description provided for @supplierReportToAdminTitle.
  ///
  /// In en, this message translates to:
  /// **'Report to admin'**
  String get supplierReportToAdminTitle;

  /// No description provided for @supplierReportToAdminMessage.
  ///
  /// In en, this message translates to:
  /// **'Submit a report for admin review. The reservation will be closed.'**
  String get supplierReportToAdminMessage;

  /// No description provided for @supplierReportAndClose.
  ///
  /// In en, this message translates to:
  /// **'Report and close'**
  String get supplierReportAndClose;

  /// No description provided for @supplierDescribeWhatHappened.
  ///
  /// In en, this message translates to:
  /// **'Describe what happened'**
  String get supplierDescribeWhatHappened;

  /// No description provided for @supplierNoteRequired.
  ///
  /// In en, this message translates to:
  /// **'Note (required)'**
  String get supplierNoteRequired;

  /// No description provided for @supplierSubmitReport.
  ///
  /// In en, this message translates to:
  /// **'Submit report'**
  String get supplierSubmitReport;

  /// No description provided for @supplierMarkPickupExpiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Mark pickup window expired'**
  String get supplierMarkPickupExpiredTitle;

  /// No description provided for @supplierMarkPickupExpiredMessage.
  ///
  /// In en, this message translates to:
  /// **'No driver accepted this delivery before the supplier pickup window ended. This will close the delivery attempt and send the case to admin review.'**
  String get supplierMarkPickupExpiredMessage;

  /// No description provided for @supplierMarkExpired.
  ///
  /// In en, this message translates to:
  /// **'Mark expired'**
  String get supplierMarkExpired;

  /// No description provided for @supplierPickupExpiredAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Pickup window marked expired. Admin review is in progress.'**
  String get supplierPickupExpiredAdminReview;

  /// No description provided for @supplierReportNoDriverTitle.
  ///
  /// In en, this message translates to:
  /// **'Report no driver available'**
  String get supplierReportNoDriverTitle;

  /// No description provided for @supplierReportNoDriverHint.
  ///
  /// In en, this message translates to:
  /// **'Describe why no driver accepted this delivery'**
  String get supplierReportNoDriverHint;

  /// No description provided for @supplierNoDriverReported.
  ///
  /// In en, this message translates to:
  /// **'No-driver case reported to admin.'**
  String get supplierNoDriverReported;

  /// No description provided for @supplierReportDriverNoShowTitle.
  ///
  /// In en, this message translates to:
  /// **'Report driver no-show'**
  String get supplierReportDriverNoShowTitle;

  /// No description provided for @supplierReportDriverNoShowHint.
  ///
  /// In en, this message translates to:
  /// **'Describe what happened at supplier pickup'**
  String get supplierReportDriverNoShowHint;

  /// No description provided for @supplierDriverNoShowReported.
  ///
  /// In en, this message translates to:
  /// **'Driver no-show reported to admin.'**
  String get supplierDriverNoShowReported;

  /// No description provided for @supplierPickupConfirmationCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup confirmation code'**
  String get supplierPickupConfirmationCodeLabel;

  /// No description provided for @supplierPickupConfirmationCodeHint.
  ///
  /// In en, this message translates to:
  /// **'Enter the pickup confirmation code the learner gives you when they receive the material.'**
  String get supplierPickupConfirmationCodeHint;

  /// No description provided for @supplierPickupConfirmationCodeError.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit pickup code from the learner.'**
  String get supplierPickupConfirmationCodeError;

  /// No description provided for @supplierDeliveryWindowMustStartFuture.
  ///
  /// In en, this message translates to:
  /// **'Delivery window must start in the future.'**
  String get supplierDeliveryWindowMustStartFuture;

  /// No description provided for @supplierInboxRefreshFailed.
  ///
  /// In en, this message translates to:
  /// **'We could not refresh incoming requests.'**
  String get supplierInboxRefreshFailed;

  /// No description provided for @supplierEmptyAllCaughtUp.
  ///
  /// In en, this message translates to:
  /// **'You are all caught up'**
  String get supplierEmptyAllCaughtUp;

  /// No description provided for @supplierEmptyNoWaitingLearnerSubtitle.
  ///
  /// In en, this message translates to:
  /// **'No requests currently need your response.'**
  String get supplierEmptyNoWaitingLearnerSubtitle;

  /// No description provided for @supplierEmptyNoWaitingLearner.
  ///
  /// In en, this message translates to:
  /// **'No requests are waiting for learner confirmation.'**
  String get supplierEmptyNoWaitingLearner;

  /// No description provided for @supplierEmptyNoActiveFulfillment.
  ///
  /// In en, this message translates to:
  /// **'No active pickups or deliveries.'**
  String get supplierEmptyNoActiveFulfillment;

  /// No description provided for @supplierEmptyNoAdminReview.
  ///
  /// In en, this message translates to:
  /// **'No requests are currently under admin review.'**
  String get supplierEmptyNoAdminReview;

  /// No description provided for @supplierEmptyNoTerminalHistory.
  ///
  /// In en, this message translates to:
  /// **'No completed or closed requests found.'**
  String get supplierEmptyNoTerminalHistory;

  /// No description provided for @supplierEmptyNoFilterMatch.
  ///
  /// In en, this message translates to:
  /// **'No requests match the selected filters.'**
  String get supplierEmptyNoFilterMatch;

  /// No description provided for @supplierIncidentsDriverNotCompletedPickup.
  ///
  /// In en, this message translates to:
  /// **'The assigned driver has not completed supplier pickup after the window ended. Report driver no-show so an admin can review.'**
  String get supplierIncidentsDriverNotCompletedPickup;

  /// No description provided for @supplierIncidentsNoDriverBeforeWindow.
  ///
  /// In en, this message translates to:
  /// **'No driver accepted this delivery before the supplier pickup window ended. Report it so an admin can review next steps.'**
  String get supplierIncidentsNoDriverBeforeWindow;

  /// No description provided for @supplierIncidentsNoDriverWaitHint.
  ///
  /// In en, this message translates to:
  /// **'No driver yet. You can report no driver available 30 minutes after the scheduled pickup window ends.'**
  String get supplierIncidentsNoDriverWaitHint;

  /// No description provided for @supplierIncidentsReportNoDriver.
  ///
  /// In en, this message translates to:
  /// **'Report no driver available'**
  String get supplierIncidentsReportNoDriver;

  /// No description provided for @supplierIncidentsReportDriverNoShow.
  ///
  /// In en, this message translates to:
  /// **'Report driver no-show'**
  String get supplierIncidentsReportDriverNoShow;

  /// No description provided for @supplierDriverHandoverCodeInstructions.
  ///
  /// In en, this message translates to:
  /// **'Give this code to the driver after handing over the material.'**
  String get supplierDriverHandoverCodeInstructions;

  /// No description provided for @supplierReportedToAdmin.
  ///
  /// In en, this message translates to:
  /// **'Reported to admin'**
  String get supplierReportedToAdmin;

  /// No description provided for @supplierRequestLine.
  ///
  /// In en, this message translates to:
  /// **'Request {id} · {status}'**
  String supplierRequestLine(String id, String status);

  /// No description provided for @actionContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get actionContinue;

  /// No description provided for @checkStatus.
  ///
  /// In en, this message translates to:
  /// **'Check status'**
  String get checkStatus;

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @review.
  ///
  /// In en, this message translates to:
  /// **'Review'**
  String get review;

  /// No description provided for @description.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get description;

  /// No description provided for @document.
  ///
  /// In en, this message translates to:
  /// **'Document'**
  String get document;

  /// No description provided for @submitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get submitted;

  /// No description provided for @organization.
  ///
  /// In en, this message translates to:
  /// **'Organization'**
  String get organization;

  /// No description provided for @notSelected.
  ///
  /// In en, this message translates to:
  /// **'Not selected'**
  String get notSelected;

  /// No description provided for @becomeSupplierTitle.
  ///
  /// In en, this message translates to:
  /// **'Become a supplier'**
  String get becomeSupplierTitle;

  /// No description provided for @becomeSupplierSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Keep your learner access and add a supplier profile on the same account.'**
  String get becomeSupplierSubtitle;

  /// No description provided for @becomeSupplierOpenSupplierPortal.
  ///
  /// In en, this message translates to:
  /// **'Open Supplier Portal'**
  String get becomeSupplierOpenSupplierPortal;

  /// No description provided for @becomeSupplierProgressSemantic.
  ///
  /// In en, this message translates to:
  /// **'Become supplier progress, step {step} of {total}'**
  String becomeSupplierProgressSemantic(int step, int total);

  /// No description provided for @becomeSupplierSupplierTypeRequired.
  ///
  /// In en, this message translates to:
  /// **'Supplier type is required'**
  String get becomeSupplierSupplierTypeRequired;

  /// No description provided for @becomeSupplierSupplierNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Supplier name is required'**
  String get becomeSupplierSupplierNameRequired;

  /// No description provided for @becomeSupplierCityRequired.
  ///
  /// In en, this message translates to:
  /// **'City is required'**
  String get becomeSupplierCityRequired;

  /// No description provided for @becomeSupplierSupplierNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Supplier name'**
  String get becomeSupplierSupplierNameLabel;

  /// No description provided for @becomeSupplierSupplierNameHint.
  ///
  /// In en, this message translates to:
  /// **'How others will see you'**
  String get becomeSupplierSupplierNameHint;

  /// No description provided for @becomeSupplierAboutDescriptionOptional.
  ///
  /// In en, this message translates to:
  /// **'About / description (optional)'**
  String get becomeSupplierAboutDescriptionOptional;

  /// No description provided for @becomeSupplierAboutDescriptionHint.
  ///
  /// In en, this message translates to:
  /// **'What kinds of materials do you usually share?'**
  String get becomeSupplierAboutDescriptionHint;

  /// No description provided for @becomeSupplierLocationHelpText.
  ///
  /// In en, this message translates to:
  /// **'City and area help learners understand where pickup usually happens. Exact pickup details can stay private until a reservation is accepted.'**
  String get becomeSupplierLocationHelpText;

  /// No description provided for @becomeSupplierPickupLocationNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Pickup location note (optional)'**
  String get becomeSupplierPickupLocationNoteOptional;

  /// No description provided for @becomeSupplierPickupLocationHint.
  ///
  /// In en, this message translates to:
  /// **'Near university gate, workshop entrance, etc.'**
  String get becomeSupplierPickupLocationHint;

  /// No description provided for @becomeSupplierWorkingHoursOptional.
  ///
  /// In en, this message translates to:
  /// **'Working hours (optional)'**
  String get becomeSupplierWorkingHoursOptional;

  /// No description provided for @becomeSupplierWorkingHoursHint.
  ///
  /// In en, this message translates to:
  /// **'Mon-Fri 4pm-7pm'**
  String get becomeSupplierWorkingHoursHint;

  /// No description provided for @becomeSupplierPickupNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Call before pickup, bring student ID, etc.'**
  String get becomeSupplierPickupNotesHint;

  /// No description provided for @becomeSupplierWorkshopsVerificationNote.
  ///
  /// In en, this message translates to:
  /// **'Workshops, factories, and institutions require a separate verification flow.'**
  String get becomeSupplierWorkshopsVerificationNote;

  /// No description provided for @becomeSupplierReviewPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Pickup location: {location}'**
  String becomeSupplierReviewPickupLocation(String location);

  /// No description provided for @becomeSupplierReviewWorkingHours.
  ///
  /// In en, this message translates to:
  /// **'Working hours: {hours}'**
  String becomeSupplierReviewWorkingHours(String hours);

  /// No description provided for @becomeSupplierReviewPickupNotes.
  ///
  /// In en, this message translates to:
  /// **'Pickup notes: {notes}'**
  String becomeSupplierReviewPickupNotes(String notes);

  /// No description provided for @becomeSupplierStepSupplierTypeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose how you will share materials as a supplier.'**
  String get becomeSupplierStepSupplierTypeSubtitle;

  /// No description provided for @becomeSupplierStepProfileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell others who you are and what you usually share.'**
  String get becomeSupplierStepProfileSubtitle;

  /// No description provided for @becomeSupplierStepLocationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Set the city and area where pickup usually happens.'**
  String get becomeSupplierStepLocationSubtitle;

  /// No description provided for @becomeSupplierStepPickupDetailsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add optional pickup hours and notes for learners.'**
  String get becomeSupplierStepPickupDetailsSubtitle;

  /// No description provided for @becomeSupplierStepVerificationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Upload proof of your organization for admin review.'**
  String get becomeSupplierStepVerificationSubtitle;

  /// No description provided for @becomeSupplierStepReviewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review your supplier details, then open the Supplier Portal.'**
  String get becomeSupplierStepReviewSubtitle;

  /// No description provided for @supplierStudentSupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'For students sharing extra parts or materials. No verification document.'**
  String get supplierStudentSupplierDescription;

  /// No description provided for @supplierIndividualSupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'For personal surplus materials. No verification document.'**
  String get supplierIndividualSupplierDescription;

  /// No description provided for @supplierWorkshopSupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'For workshops or labs. Verification document required.'**
  String get supplierWorkshopSupplierDescription;

  /// No description provided for @supplierFactorySupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'For factories or companies. Verification document required.'**
  String get supplierFactorySupplierDescription;

  /// No description provided for @supplierEducationalInstitutionSupplierDescription.
  ///
  /// In en, this message translates to:
  /// **'For schools, universities, or centers. Verification document required.'**
  String get supplierEducationalInstitutionSupplierDescription;

  /// No description provided for @supplierChooseSupplierTypeFallback.
  ///
  /// In en, this message translates to:
  /// **'Choose who owns the materials you will share.'**
  String get supplierChooseSupplierTypeFallback;

  /// No description provided for @completeSupplierProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete your supplier profile'**
  String get completeSupplierProfileTitle;

  /// No description provided for @completeSupplierProfileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell others what materials you share and where pickup works.'**
  String get completeSupplierProfileSubtitle;

  /// No description provided for @selectYourSupplierType.
  ///
  /// In en, this message translates to:
  /// **'Select your supplier type'**
  String get selectYourSupplierType;

  /// No description provided for @publicNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Public name is required'**
  String get publicNameRequired;

  /// No description provided for @pickupAreaRequired.
  ///
  /// In en, this message translates to:
  /// **'Pickup area is required'**
  String get pickupAreaRequired;

  /// No description provided for @shortDescriptionOptional.
  ///
  /// In en, this message translates to:
  /// **'Short description (optional)'**
  String get shortDescriptionOptional;

  /// No description provided for @pickupAreaLocationLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup area / location'**
  String get pickupAreaLocationLabel;

  /// No description provided for @organizationSupplierVerificationNote.
  ///
  /// In en, this message translates to:
  /// **'Organization suppliers are treated as supplier organizations and may need verification before listing materials.'**
  String get organizationSupplierVerificationNote;

  /// No description provided for @individualSupplierCanSwitchNote.
  ///
  /// In en, this message translates to:
  /// **'Student and individual suppliers can still switch back to learner mode after setup.'**
  String get individualSupplierCanSwitchNote;

  /// No description provided for @completeSupplierProfileFooterNote.
  ///
  /// In en, this message translates to:
  /// **'You can start as an individual and update your supplier details later.'**
  String get completeSupplierProfileFooterNote;

  /// No description provided for @verificationDocument.
  ///
  /// In en, this message translates to:
  /// **'Verification document'**
  String get verificationDocument;

  /// No description provided for @verificationDocumentRequired.
  ///
  /// In en, this message translates to:
  /// **'Verification document is required'**
  String get verificationDocumentRequired;

  /// No description provided for @verificationFileSizeLimit.
  ///
  /// In en, this message translates to:
  /// **'File must be 5MB or smaller'**
  String get verificationFileSizeLimit;

  /// No description provided for @verificationAllowedFileTypes.
  ///
  /// In en, this message translates to:
  /// **'Allowed file types: PDF, PNG, JPG, JPEG'**
  String get verificationAllowedFileTypes;

  /// No description provided for @verificationDocumentHint.
  ///
  /// In en, this message translates to:
  /// **'PDF, PNG, JPG, or JPEG (max 5MB)'**
  String get verificationDocumentHint;

  /// No description provided for @verificationDocumentUploadHint.
  ///
  /// In en, this message translates to:
  /// **'Upload a document that proves your organization identity, such as a workshop license, factory document, or university/institution proof.'**
  String get verificationDocumentUploadHint;

  /// No description provided for @noFileSelected.
  ///
  /// In en, this message translates to:
  /// **'No file selected'**
  String get noFileSelected;

  /// No description provided for @selectFile.
  ///
  /// In en, this message translates to:
  /// **'Select file'**
  String get selectFile;

  /// No description provided for @changeFile.
  ///
  /// In en, this message translates to:
  /// **'Change file'**
  String get changeFile;

  /// No description provided for @registrationDetailsIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Registration details are incomplete. Please start again.'**
  String get registrationDetailsIncomplete;

  /// No description provided for @switchToLearner.
  ///
  /// In en, this message translates to:
  /// **'Switch to Learner'**
  String get switchToLearner;

  /// No description provided for @switchToSupplier.
  ///
  /// In en, this message translates to:
  /// **'Switch to Supplier'**
  String get switchToSupplier;

  /// No description provided for @becomeLearner.
  ///
  /// In en, this message translates to:
  /// **'Become a Learner'**
  String get becomeLearner;

  /// No description provided for @organizationSupplierStaysInSupplierMode.
  ///
  /// In en, this message translates to:
  /// **'Organization supplier accounts stay in supplier mode.'**
  String get organizationSupplierStaysInSupplierMode;

  /// No description provided for @learnerMode.
  ///
  /// In en, this message translates to:
  /// **'Learner mode'**
  String get learnerMode;

  /// No description provided for @supplierMode.
  ///
  /// In en, this message translates to:
  /// **'Supplier mode'**
  String get supplierMode;

  /// No description provided for @driverMode.
  ///
  /// In en, this message translates to:
  /// **'Driver mode'**
  String get driverMode;

  /// No description provided for @adminMode.
  ///
  /// In en, this message translates to:
  /// **'Admin mode'**
  String get adminMode;

  /// No description provided for @moderatorMode.
  ///
  /// In en, this message translates to:
  /// **'Moderator mode'**
  String get moderatorMode;

  /// No description provided for @supplierDashboard.
  ///
  /// In en, this message translates to:
  /// **'Supplier dashboard'**
  String get supplierDashboard;

  /// No description provided for @adminPortalNav.
  ///
  /// In en, this message translates to:
  /// **'Admin Portal'**
  String get adminPortalNav;

  /// No description provided for @materialRequestsNav.
  ///
  /// In en, this message translates to:
  /// **'Material requests'**
  String get materialRequestsNav;

  /// No description provided for @supplierVerifySubmittedTitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification submitted'**
  String get supplierVerifySubmittedTitle;

  /// No description provided for @supplierVerifyLoadStatusFailed.
  ///
  /// In en, this message translates to:
  /// **'We could not load your verification status.'**
  String get supplierVerifyLoadStatusFailed;

  /// No description provided for @supplierVerifyPendingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your supplier account is waiting for admin approval. You will be able to publish materials after your account is approved.'**
  String get supplierVerifyPendingSubtitle;

  /// No description provided for @supplierVerifyStillWaitingApproval.
  ///
  /// In en, this message translates to:
  /// **'Your supplier account is still waiting for admin approval.'**
  String get supplierVerifyStillWaitingApproval;

  /// No description provided for @supplierVerifyRejectedTitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification rejected'**
  String get supplierVerifyRejectedTitle;

  /// No description provided for @supplierVerifyChangesRequestedTitle.
  ///
  /// In en, this message translates to:
  /// **'Changes requested'**
  String get supplierVerifyChangesRequestedTitle;

  /// No description provided for @supplierVerifyStatusTitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification status'**
  String get supplierVerifyStatusTitle;

  /// No description provided for @supplierVerifyRejectedBody.
  ///
  /// In en, this message translates to:
  /// **'Your supplier verification was rejected. Publishing materials is blocked until your organization is approved.'**
  String get supplierVerifyRejectedBody;

  /// No description provided for @supplierVerifyChangesRequestedBody.
  ///
  /// In en, this message translates to:
  /// **'An admin requested changes to your verification submission. Update your document and resubmit for review.'**
  String get supplierVerifyChangesRequestedBody;

  /// No description provided for @supplierVerifyStatusBody.
  ///
  /// In en, this message translates to:
  /// **'Publishing materials is blocked until your organization is approved by an admin.'**
  String get supplierVerifyStatusBody;

  /// No description provided for @supplierVerifyStatusRefreshed.
  ///
  /// In en, this message translates to:
  /// **'Your verification status has been refreshed.'**
  String get supplierVerifyStatusRefreshed;

  /// No description provided for @supplierVerifySelectDocumentToUpload.
  ///
  /// In en, this message translates to:
  /// **'Select a verification document to upload.'**
  String get supplierVerifySelectDocumentToUpload;

  /// No description provided for @resubmitVerification.
  ///
  /// In en, this message translates to:
  /// **'Resubmit verification'**
  String get resubmitVerification;

  /// No description provided for @chooseVerificationDocument.
  ///
  /// In en, this message translates to:
  /// **'Choose verification document'**
  String get chooseVerificationDocument;

  /// No description provided for @supplierProfilePhotoUpdated.
  ///
  /// In en, this message translates to:
  /// **'Profile photo updated'**
  String get supplierProfilePhotoUpdated;

  /// No description provided for @supplierCoverImageUpdated.
  ///
  /// In en, this message translates to:
  /// **'Cover image updated'**
  String get supplierCoverImageUpdated;

  /// No description provided for @supplierDiscardChangesQuestion.
  ///
  /// In en, this message translates to:
  /// **'Discard changes?'**
  String get supplierDiscardChangesQuestion;

  /// No description provided for @supplierUnsavedEditsWillBeLost.
  ///
  /// In en, this message translates to:
  /// **'Your unsaved edits will be lost.'**
  String get supplierUnsavedEditsWillBeLost;

  /// No description provided for @supplierKeepEditing.
  ///
  /// In en, this message translates to:
  /// **'Keep editing'**
  String get supplierKeepEditing;

  /// No description provided for @registerSupplierTypeControlsVerification.
  ///
  /// In en, this message translates to:
  /// **'This controls verification requirements and how your material listings are introduced to requesters.'**
  String get registerSupplierTypeControlsVerification;

  /// No description provided for @registerSupplierPublicNameHelp.
  ///
  /// In en, this message translates to:
  /// **'Public name appears on material listings and reservation messages. Use a workshop, institution, or personal display name that requesters can recognize.'**
  String get registerSupplierPublicNameHelp;

  /// No description provided for @registerSupplierDisplayNameOptional.
  ///
  /// In en, this message translates to:
  /// **'Supplier display name (optional)'**
  String get registerSupplierDisplayNameOptional;

  /// No description provided for @registerSupplierUsesFullNameDefault.
  ///
  /// In en, this message translates to:
  /// **'Uses your full name by default'**
  String get registerSupplierUsesFullNameDefault;

  /// No description provided for @registerSupplierShareMaterialsGoals.
  ///
  /// In en, this message translates to:
  /// **'What do you want to accomplish by sharing materials?'**
  String get registerSupplierShareMaterialsGoals;

  /// No description provided for @registerSupplierBasicsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose the supplier profile that matches who owns the materials and how it should appear publicly.'**
  String get registerSupplierBasicsSubtitle;

  /// No description provided for @registerSupplierVerificationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Organization suppliers need a document so admins can review the account before publishing materials.'**
  String get registerSupplierVerificationSubtitle;

  /// No description provided for @registerSupplierReviewSupplierSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review your supplier account and pickup area before creating it.'**
  String get registerSupplierReviewSupplierSubtitle;

  /// No description provided for @registerSupplierReviewBothSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review your learner and supplier details before creating the account.'**
  String get registerSupplierReviewBothSubtitle;

  /// No description provided for @registerSupplierLocationBothSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Set the general pickup area for materials you share. Learner delivery details are handled later when needed.'**
  String get registerSupplierLocationBothSubtitle;

  /// No description provided for @registerSupplierLocationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Set the general pickup area for materials you share.'**
  String get registerSupplierLocationSubtitle;

  /// No description provided for @registerSupplierNoVerificationRequired.
  ///
  /// In en, this message translates to:
  /// **'No verification document is required for this supplier type.'**
  String get registerSupplierNoVerificationRequired;

  /// No description provided for @registerSupplierNoVerificationBody.
  ///
  /// In en, this message translates to:
  /// **'You can review your account details next and create the account without uploading a file.'**
  String get registerSupplierNoVerificationBody;

  /// No description provided for @registerAccountReadyUploadVerification.
  ///
  /// In en, this message translates to:
  /// **'Your account is ready. Upload your verification document to continue.'**
  String get registerAccountReadyUploadVerification;

  /// No description provided for @registerSupplierSetupDescription.
  ///
  /// In en, this message translates to:
  /// **'You will set supplier goals, pickup area, supplier type, public name, and verification when needed.'**
  String get registerSupplierSetupDescription;

  /// No description provided for @registerBothSupplierSetupDescription.
  ///
  /// In en, this message translates to:
  /// **'You will set learner interests and learning level, plus supplier pickup and profile details.'**
  String get registerBothSupplierSetupDescription;

  /// No description provided for @registerSupplierLocationHelperBoth.
  ///
  /// In en, this message translates to:
  /// **'This is the general pickup area for materials you share. It does not expose an exact address publicly, and learner delivery details stay separate.'**
  String get registerSupplierLocationHelperBoth;

  /// No description provided for @registerSupplierLocationHelper.
  ///
  /// In en, this message translates to:
  /// **'Suppliers need a city and area so requesters can understand pickup feasibility. Exact pickup details can stay private until a reservation or delivery is arranged.'**
  String get registerSupplierLocationHelper;

  /// No description provided for @registerSupplierReviewHelper.
  ///
  /// In en, this message translates to:
  /// **'Supplier goals stay in onboarding only. The server receives your account, supplier profile, and pickup area.'**
  String get registerSupplierReviewHelper;

  /// No description provided for @registerBothReviewHelper.
  ///
  /// In en, this message translates to:
  /// **'Goals stay in onboarding only. The server receives your account, learner profile, supplier profile, and pickup area.'**
  String get registerBothReviewHelper;

  /// No description provided for @retryVerification.
  ///
  /// In en, this message translates to:
  /// **'Retry verification'**
  String get retryVerification;

  /// No description provided for @conditionNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get conditionNew;

  /// No description provided for @conditionLikeNew.
  ///
  /// In en, this message translates to:
  /// **'Like new'**
  String get conditionLikeNew;

  /// No description provided for @conditionGood.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get conditionGood;

  /// No description provided for @conditionUsed.
  ///
  /// In en, this message translates to:
  /// **'Used'**
  String get conditionUsed;

  /// No description provided for @conditionNeedsRepair.
  ///
  /// In en, this message translates to:
  /// **'Needs repair'**
  String get conditionNeedsRepair;

  /// No description provided for @sourceTypeStudentLeftover.
  ///
  /// In en, this message translates to:
  /// **'Student leftover'**
  String get sourceTypeStudentLeftover;

  /// No description provided for @sourceTypeWorkshopSurplus.
  ///
  /// In en, this message translates to:
  /// **'Workshop surplus'**
  String get sourceTypeWorkshopSurplus;

  /// No description provided for @sourceTypeFactorySurplus.
  ///
  /// In en, this message translates to:
  /// **'Factory surplus'**
  String get sourceTypeFactorySurplus;

  /// No description provided for @sourceTypeEducationalInstitution.
  ///
  /// In en, this message translates to:
  /// **'Educational institution'**
  String get sourceTypeEducationalInstitution;

  /// No description provided for @materialStatusAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get materialStatusAvailable;

  /// No description provided for @materialStatusPendingReservation.
  ///
  /// In en, this message translates to:
  /// **'Pending reservation'**
  String get materialStatusPendingReservation;

  /// No description provided for @materialStatusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get materialStatusReserved;

  /// No description provided for @materialStatusReused.
  ///
  /// In en, this message translates to:
  /// **'Reused'**
  String get materialStatusReused;

  /// No description provided for @materialStatusUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get materialStatusUnavailable;

  /// No description provided for @supplierApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get supplierApply;

  /// No description provided for @supplierSelectScheduleRange.
  ///
  /// In en, this message translates to:
  /// **'Select schedule range'**
  String get supplierSelectScheduleRange;

  /// No description provided for @supplierActionCouldNotComplete.
  ///
  /// In en, this message translates to:
  /// **'The action could not be completed.'**
  String get supplierActionCouldNotComplete;

  /// No description provided for @supplierHandovers.
  ///
  /// In en, this message translates to:
  /// **'Handovers'**
  String get supplierHandovers;

  /// No description provided for @supplierSearchScheduleHint.
  ///
  /// In en, this message translates to:
  /// **'Search by material, learner, or reservation ID...'**
  String get supplierSearchScheduleHint;

  /// No description provided for @supplierDeliveryPickup.
  ///
  /// In en, this message translates to:
  /// **'Delivery pickup'**
  String get supplierDeliveryPickup;

  /// No description provided for @supplierNoAttention.
  ///
  /// In en, this message translates to:
  /// **'No attention'**
  String get supplierNoAttention;

  /// No description provided for @supplierScheduleColumnSchedule.
  ///
  /// In en, this message translates to:
  /// **'Schedule'**
  String get supplierScheduleColumnSchedule;

  /// No description provided for @supplierScheduleColumnMaterialLearner.
  ///
  /// In en, this message translates to:
  /// **'Material & learner'**
  String get supplierScheduleColumnMaterialLearner;

  /// No description provided for @supplierScheduleColumnFulfillment.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment'**
  String get supplierScheduleColumnFulfillment;

  /// No description provided for @supplierScheduleColumnWindow.
  ///
  /// In en, this message translates to:
  /// **'Window'**
  String get supplierScheduleColumnWindow;

  /// No description provided for @supplierScheduleColumnNextActor.
  ///
  /// In en, this message translates to:
  /// **'Next actor'**
  String get supplierScheduleColumnNextActor;

  /// No description provided for @supplierScheduleColumnActions.
  ///
  /// In en, this message translates to:
  /// **'Actions'**
  String get supplierScheduleColumnActions;

  /// No description provided for @supplierNoConfirmedWindow.
  ///
  /// In en, this message translates to:
  /// **'No confirmed window'**
  String get supplierNoConfirmedWindow;

  /// No description provided for @supplierGroupReservationsQuantity.
  ///
  /// In en, this message translates to:
  /// **'{count} reservations · {quantity}'**
  String supplierGroupReservationsQuantity(String count, String quantity);

  /// No description provided for @supplierGroupReservationsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} reservations'**
  String supplierGroupReservationsCount(String count);

  /// No description provided for @supplierConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get supplierConfirmed;

  /// No description provided for @supplierSupplierPickup.
  ///
  /// In en, this message translates to:
  /// **'Supplier pickup'**
  String get supplierSupplierPickup;

  /// No description provided for @supplierConfirmedPickup.
  ///
  /// In en, this message translates to:
  /// **'Confirmed pickup'**
  String get supplierConfirmedPickup;

  /// No description provided for @supplierWaitingForDriver.
  ///
  /// In en, this message translates to:
  /// **'Waiting for driver'**
  String get supplierWaitingForDriver;

  /// No description provided for @supplierDriverAssigned.
  ///
  /// In en, this message translates to:
  /// **'Driver assigned'**
  String get supplierDriverAssigned;

  /// No description provided for @supplierArrivedAtSupplier.
  ///
  /// In en, this message translates to:
  /// **'Arrived at supplier'**
  String get supplierArrivedAtSupplier;

  /// No description provided for @supplierDriverOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'Driver on the way'**
  String get supplierDriverOnTheWay;

  /// No description provided for @supplierPickedUp.
  ///
  /// In en, this message translates to:
  /// **'Picked up'**
  String get supplierPickedUp;

  /// No description provided for @supplierView.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get supplierView;

  /// No description provided for @supplierMoreActions.
  ///
  /// In en, this message translates to:
  /// **'More actions'**
  String get supplierMoreActions;

  /// No description provided for @supplierShowingHandoversRange.
  ///
  /// In en, this message translates to:
  /// **'Showing {start}–{end} of {total} handovers'**
  String supplierShowingHandoversRange(String start, String end, String total);

  /// No description provided for @supplierRowsPerPage.
  ///
  /// In en, this message translates to:
  /// **'Rows per page'**
  String get supplierRowsPerPage;

  /// No description provided for @supplierPickupScheduleLoadFailedTitle.
  ///
  /// In en, this message translates to:
  /// **'Could not load pickup schedule'**
  String get supplierPickupScheduleLoadFailedTitle;

  /// No description provided for @supplierPleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Please try again.'**
  String get supplierPleaseTryAgain;

  /// No description provided for @supplierNoHandoversMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No handovers match the selected filters.'**
  String get supplierNoHandoversMatchFilters;

  /// No description provided for @supplierNoHandoversToday.
  ///
  /// In en, this message translates to:
  /// **'No handovers scheduled for today.'**
  String get supplierNoHandoversToday;

  /// No description provided for @supplierNoHandoversUpcoming.
  ///
  /// In en, this message translates to:
  /// **'No upcoming handovers.'**
  String get supplierNoHandoversUpcoming;

  /// No description provided for @supplierNoHandoversOverdue.
  ///
  /// In en, this message translates to:
  /// **'No overdue handovers.'**
  String get supplierNoHandoversOverdue;

  /// No description provided for @supplierNoHandoversCompletedPeriod.
  ///
  /// In en, this message translates to:
  /// **'No completed handovers in this period.'**
  String get supplierNoHandoversCompletedPeriod;

  /// No description provided for @supplierNoHandoversClosedPeriod.
  ///
  /// In en, this message translates to:
  /// **'No closed handovers in this period.'**
  String get supplierNoHandoversClosedPeriod;

  /// No description provided for @supplierNoHandoversScheduled.
  ///
  /// In en, this message translates to:
  /// **'No scheduled handovers yet.'**
  String get supplierNoHandoversScheduled;

  /// No description provided for @supplierResetFiltersToSeeMore.
  ///
  /// In en, this message translates to:
  /// **'Try resetting the filters to see more handovers.'**
  String get supplierResetFiltersToSeeMore;

  /// No description provided for @supplierConfirmedHandoversAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Confirmed self-pickups and driver pickup appointments will appear here.'**
  String get supplierConfirmedHandoversAppearHere;

  /// No description provided for @supplierOpenIncomingRequests.
  ///
  /// In en, this message translates to:
  /// **'Open Incoming Requests'**
  String get supplierOpenIncomingRequests;

  /// No description provided for @supplierFiltersTitle.
  ///
  /// In en, this message translates to:
  /// **'Filters'**
  String get supplierFiltersTitle;

  /// No description provided for @supplierFilterOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get supplierFilterOverdue;

  /// No description provided for @supplierUnscheduledAction.
  ///
  /// In en, this message translates to:
  /// **'Unscheduled action'**
  String get supplierUnscheduledAction;

  /// No description provided for @supplierNeedsScheduling.
  ///
  /// In en, this message translates to:
  /// **'Needs scheduling'**
  String get supplierNeedsScheduling;

  /// No description provided for @supplierAwaitingResolution.
  ///
  /// In en, this message translates to:
  /// **'Awaiting resolution'**
  String get supplierAwaitingResolution;

  /// No description provided for @supplierPastDue.
  ///
  /// In en, this message translates to:
  /// **'Past due'**
  String get supplierPastDue;

  /// No description provided for @supplierScheduled.
  ///
  /// In en, this message translates to:
  /// **'Scheduled'**
  String get supplierScheduled;

  /// No description provided for @supplierHandoverCompleted.
  ///
  /// In en, this message translates to:
  /// **'Handover completed'**
  String get supplierHandoverCompleted;

  /// No description provided for @supplierNeedsReview.
  ///
  /// In en, this message translates to:
  /// **'Needs review'**
  String get supplierNeedsReview;

  /// No description provided for @supplierExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get supplierExpired;

  /// No description provided for @supplierNoShow.
  ///
  /// In en, this message translates to:
  /// **'No-show'**
  String get supplierNoShow;

  /// No description provided for @supplierFulfillmentFailed.
  ///
  /// In en, this message translates to:
  /// **'Fulfillment failed'**
  String get supplierFulfillmentFailed;

  /// No description provided for @supplierCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get supplierCancelled;

  /// No description provided for @supplierAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Admin review'**
  String get supplierAdminReview;

  /// No description provided for @supplierNextActorYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get supplierNextActorYou;

  /// No description provided for @supplierNextActorLearner.
  ///
  /// In en, this message translates to:
  /// **'Learner'**
  String get supplierNextActorLearner;

  /// No description provided for @supplierNextActorDriver.
  ///
  /// In en, this message translates to:
  /// **'Driver'**
  String get supplierNextActorDriver;

  /// No description provided for @supplierCompletePickup.
  ///
  /// In en, this message translates to:
  /// **'Complete pickup'**
  String get supplierCompletePickup;

  /// No description provided for @supplierReportLearnerNoShow.
  ///
  /// In en, this message translates to:
  /// **'Report learner no-show'**
  String get supplierReportLearnerNoShow;

  /// No description provided for @supplierCloseReservation.
  ///
  /// In en, this message translates to:
  /// **'Close reservation'**
  String get supplierCloseReservation;

  /// No description provided for @supplierMessage.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get supplierMessage;

  /// No description provided for @supplierEditCover.
  ///
  /// In en, this message translates to:
  /// **'Edit cover'**
  String get supplierEditCover;

  /// No description provided for @supplierEditProfilePhoto.
  ///
  /// In en, this message translates to:
  /// **'Edit supplier profile photo'**
  String get supplierEditProfilePhoto;

  /// No description provided for @supplierEssentialsCompleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Essentials complete'**
  String get supplierEssentialsCompleteTitle;

  /// No description provided for @supplierEditProfileCompletionDetails.
  ///
  /// In en, this message translates to:
  /// **'Edit supplier profile completion details'**
  String get supplierEditProfileCompletionDetails;

  /// No description provided for @supplierProfileCompletionPercent.
  ///
  /// In en, this message translates to:
  /// **'Profile completion {percent} percent'**
  String supplierProfileCompletionPercent(String percent);

  /// No description provided for @supplierMissingFields.
  ///
  /// In en, this message translates to:
  /// **'Missing: {fields}'**
  String supplierMissingFields(String fields);

  /// No description provided for @supplierBusinessIdentity.
  ///
  /// In en, this message translates to:
  /// **'Business identity'**
  String get supplierBusinessIdentity;

  /// No description provided for @supplierWorkingAvailability.
  ///
  /// In en, this message translates to:
  /// **'Working availability'**
  String get supplierWorkingAvailability;

  /// No description provided for @supplierWorkingAvailabilityMissing.
  ///
  /// In en, this message translates to:
  /// **'Working availability has not been added.'**
  String get supplierWorkingAvailabilityMissing;

  /// No description provided for @supplierWorkingHours.
  ///
  /// In en, this message translates to:
  /// **'Working hours'**
  String get supplierWorkingHours;

  /// No description provided for @supplierPickupLocationAndPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Pickup location & privacy'**
  String get supplierPickupLocationAndPrivacy;

  /// No description provided for @supplierCityArea.
  ///
  /// In en, this message translates to:
  /// **'City / area'**
  String get supplierCityArea;

  /// No description provided for @supplierPickupAddress.
  ///
  /// In en, this message translates to:
  /// **'Pickup address'**
  String get supplierPickupAddress;

  /// No description provided for @supplierPickupLocationMap.
  ///
  /// In en, this message translates to:
  /// **'Pickup location map'**
  String get supplierPickupLocationMap;

  /// No description provided for @supplierSavedPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Your saved pickup location.'**
  String get supplierSavedPickupLocation;

  /// No description provided for @supplierSubmitForReview.
  ///
  /// In en, this message translates to:
  /// **'Submit for review'**
  String get supplierSubmitForReview;

  /// No description provided for @supplierResubmit.
  ///
  /// In en, this message translates to:
  /// **'Resubmit'**
  String get supplierResubmit;

  /// No description provided for @supplierThanksVerificationCommunity.
  ///
  /// In en, this message translates to:
  /// **'Thanks for helping make ImpactLoop trusted and safe for our community.'**
  String get supplierThanksVerificationCommunity;

  /// No description provided for @supplierReviewedDate.
  ///
  /// In en, this message translates to:
  /// **'Reviewed date'**
  String get supplierReviewedDate;

  /// No description provided for @supplierSubmittedDate.
  ///
  /// In en, this message translates to:
  /// **'Submitted date'**
  String get supplierSubmittedDate;

  /// No description provided for @supplierAwaitingReview.
  ///
  /// In en, this message translates to:
  /// **'Awaiting review'**
  String get supplierAwaitingReview;

  /// No description provided for @supplierChangesRequired.
  ///
  /// In en, this message translates to:
  /// **'Changes required'**
  String get supplierChangesRequired;

  /// No description provided for @supplierVerificationNotRequired.
  ///
  /// In en, this message translates to:
  /// **'Verification not required'**
  String get supplierVerificationNotRequired;

  /// No description provided for @supplierNotVerified.
  ///
  /// In en, this message translates to:
  /// **'Not verified'**
  String get supplierNotVerified;

  /// No description provided for @supplierVerificationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Verification unavailable'**
  String get supplierVerificationUnavailable;

  /// No description provided for @supplierProfileVerified.
  ///
  /// In en, this message translates to:
  /// **'Profile verified'**
  String get supplierProfileVerified;

  /// No description provided for @supplierProfileAwaitingReview.
  ///
  /// In en, this message translates to:
  /// **'Your profile is awaiting review.'**
  String get supplierProfileAwaitingReview;

  /// No description provided for @supplierChangesRequiredBeforeApproval.
  ///
  /// In en, this message translates to:
  /// **'Changes are required before approval.'**
  String get supplierChangesRequiredBeforeApproval;

  /// No description provided for @supplierVerificationRejected.
  ///
  /// In en, this message translates to:
  /// **'Your verification was rejected.'**
  String get supplierVerificationRejected;

  /// No description provided for @supplierVerificationNotRequiredMessage.
  ///
  /// In en, this message translates to:
  /// **'Verification is not required.'**
  String get supplierVerificationNotRequiredMessage;

  /// No description provided for @supplierProfileNotVerifiedYet.
  ///
  /// In en, this message translates to:
  /// **'Your profile is not verified yet.'**
  String get supplierProfileNotVerifiedYet;

  /// No description provided for @supplierVerificationStatusUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Verification status is unavailable.'**
  String get supplierVerificationStatusUnavailable;

  /// No description provided for @supplierPickupLocationLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup location'**
  String get supplierPickupLocationLabel;

  /// No description provided for @supplierPublicAreaApproximateTitle.
  ///
  /// In en, this message translates to:
  /// **'Public area — approximate location'**
  String get supplierPublicAreaApproximateTitle;

  /// No description provided for @supplierPublicAreaApproximateExplanation.
  ///
  /// In en, this message translates to:
  /// **'Learners see the general area before acceptance. The exact pickup address is shared only when the workflow permits it.'**
  String get supplierPublicAreaApproximateExplanation;

  /// No description provided for @supplierPublicExactLocation.
  ///
  /// In en, this message translates to:
  /// **'Public exact location'**
  String get supplierPublicExactLocation;

  /// No description provided for @supplierPublicExactLocationExplanation.
  ///
  /// In en, this message translates to:
  /// **'The pickup location is publicly visible.'**
  String get supplierPublicExactLocationExplanation;

  /// No description provided for @supplierSharedAfterAcceptanceTitle.
  ///
  /// In en, this message translates to:
  /// **'Shared after reservation acceptance'**
  String get supplierSharedAfterAcceptanceTitle;

  /// No description provided for @supplierSharedAfterAcceptanceExplanation.
  ///
  /// In en, this message translates to:
  /// **'Learners do not see the exact pickup address before the reservation is accepted.'**
  String get supplierSharedAfterAcceptanceExplanation;

  /// No description provided for @supplierPrivateLocation.
  ///
  /// In en, this message translates to:
  /// **'Private location'**
  String get supplierPrivateLocation;

  /// No description provided for @supplierPrivateLocationExplanation.
  ///
  /// In en, this message translates to:
  /// **'The pickup location is not shown publicly.'**
  String get supplierPrivateLocationExplanation;

  /// No description provided for @supplierLocationPrivacyUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Location privacy unavailable'**
  String get supplierLocationPrivacyUnavailable;

  /// No description provided for @supplierLocationPrivacyUnavailableExplanation.
  ///
  /// In en, this message translates to:
  /// **'Visibility details are not available right now.'**
  String get supplierLocationPrivacyUnavailableExplanation;

  /// No description provided for @supplierDaySun.
  ///
  /// In en, this message translates to:
  /// **'Sun'**
  String get supplierDaySun;

  /// No description provided for @supplierDayMon.
  ///
  /// In en, this message translates to:
  /// **'Mon'**
  String get supplierDayMon;

  /// No description provided for @supplierDayTue.
  ///
  /// In en, this message translates to:
  /// **'Tue'**
  String get supplierDayTue;

  /// No description provided for @supplierDayWed.
  ///
  /// In en, this message translates to:
  /// **'Wed'**
  String get supplierDayWed;

  /// No description provided for @supplierDayThu.
  ///
  /// In en, this message translates to:
  /// **'Thu'**
  String get supplierDayThu;

  /// No description provided for @supplierDayFri.
  ///
  /// In en, this message translates to:
  /// **'Fri'**
  String get supplierDayFri;

  /// No description provided for @supplierDaySat.
  ///
  /// In en, this message translates to:
  /// **'Sat'**
  String get supplierDaySat;

  /// No description provided for @supplierSummaryClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get supplierSummaryClosed;

  /// No description provided for @supplierNotifCategoryMaterialReview.
  ///
  /// In en, this message translates to:
  /// **'Material review'**
  String get supplierNotifCategoryMaterialReview;

  /// No description provided for @supplierNotifCategoryDeliveryRecovery.
  ///
  /// In en, this message translates to:
  /// **'Delivery recovery'**
  String get supplierNotifCategoryDeliveryRecovery;

  /// No description provided for @supplierNotifCategorySystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get supplierNotifCategorySystem;

  /// No description provided for @supplierNotifStateWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get supplierNotifStateWaiting;

  /// No description provided for @supplierChooseTime.
  ///
  /// In en, this message translates to:
  /// **'Choose time'**
  String get supplierChooseTime;

  /// No description provided for @supplierPublicProfileSection.
  ///
  /// In en, this message translates to:
  /// **'Public profile'**
  String get supplierPublicProfileSection;

  /// No description provided for @supplierOrganizationAvailabilitySection.
  ///
  /// In en, this message translates to:
  /// **'Organization & availability'**
  String get supplierOrganizationAvailabilitySection;

  /// No description provided for @supplierOrganizationNameHelp.
  ///
  /// In en, this message translates to:
  /// **'Organization name identifies the organization; it may match the public supplier name.'**
  String get supplierOrganizationNameHelp;

  /// No description provided for @supplierAvailabilityInformationalHelp.
  ///
  /// In en, this message translates to:
  /// **'Availability is informational and helps learners plan pickup.'**
  String get supplierAvailabilityInformationalHelp;

  /// No description provided for @supplierSeparateOrganizationAddress.
  ///
  /// In en, this message translates to:
  /// **'Separate organization address'**
  String get supplierSeparateOrganizationAddress;

  /// No description provided for @supplierVisibilityPublicApproximate.
  ///
  /// In en, this message translates to:
  /// **'Learners see the general area. The exact pickup address is shared after the reservation is accepted.'**
  String get supplierVisibilityPublicApproximate;

  /// No description provided for @supplierVisibilityPublicExact.
  ///
  /// In en, this message translates to:
  /// **'Learners can see the saved pickup location according to your public visibility settings.'**
  String get supplierVisibilityPublicExact;

  /// No description provided for @supplierVisibilityOrderOnly.
  ///
  /// In en, this message translates to:
  /// **'Learners see the exact pickup address only after the reservation is accepted.'**
  String get supplierVisibilityOrderOnly;

  /// No description provided for @supplierVisibilityPrivate.
  ///
  /// In en, this message translates to:
  /// **'The pickup location remains private.'**
  String get supplierVisibilityPrivate;

  /// No description provided for @supplierVisibilityUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Location visibility details are unavailable.'**
  String get supplierVisibilityUnavailable;

  /// No description provided for @supplierChooseValidTime.
  ///
  /// In en, this message translates to:
  /// **'Choose a valid time.'**
  String get supplierChooseValidTime;

  /// No description provided for @supplierPickupMapUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Pickup map unavailable'**
  String get supplierPickupMapUnavailable;

  /// No description provided for @supplierAddPickupLocationForMap.
  ///
  /// In en, this message translates to:
  /// **'Add a pickup location to display the map.'**
  String get supplierAddPickupLocationForMap;

  /// No description provided for @supplierCouldNotLoadSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'Couldn’t load supplier profile'**
  String get supplierCouldNotLoadSupplierProfile;

  /// No description provided for @supplierMaterialRequestsBadge.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 request} other{{count} requests}}'**
  String supplierMaterialRequestsBadge(int count);

  /// No description provided for @supplierMaterialsResultCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 material shown} other{{count} materials shown}}'**
  String supplierMaterialsResultCount(int count);

  /// No description provided for @supplierActiveRequestsLabel.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 active request} other{{count} active requests}}'**
  String supplierActiveRequestsLabel(int count);

  /// No description provided for @supplierDemandCountLabel.
  ///
  /// In en, this message translates to:
  /// **'{demand, plural, =1{1 reservation} other{{demand} reservations}} · {views, plural, =1{1 view} other{{views} views}}'**
  String supplierDemandCountLabel(int demand, int views);

  /// No description provided for @driverPortal.
  ///
  /// In en, this message translates to:
  /// **'Driver portal'**
  String get driverPortal;

  /// No description provided for @driverInternalDelivery.
  ///
  /// In en, this message translates to:
  /// **'Internal delivery'**
  String get driverInternalDelivery;

  /// No description provided for @driverJobs.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get driverJobs;

  /// No description provided for @driverJobsTitle.
  ///
  /// In en, this message translates to:
  /// **'Driver jobs'**
  String get driverJobsTitle;

  /// No description provided for @driverJobsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick up supplier materials and deliver them to learners.'**
  String get driverJobsSubtitle;

  /// No description provided for @driverActiveDeliveriesCount.
  ///
  /// In en, this message translates to:
  /// **'Active deliveries: {active}/{max}'**
  String driverActiveDeliveriesCount(int active, int max);

  /// No description provided for @driverAvailableJobsCount.
  ///
  /// In en, this message translates to:
  /// **'Available jobs: {count}'**
  String driverAvailableJobsCount(int count);

  /// No description provided for @driverAvailableJobsCountLoading.
  ///
  /// In en, this message translates to:
  /// **'Available jobs: …'**
  String get driverAvailableJobsCountLoading;

  /// No description provided for @driverTotalAvailable.
  ///
  /// In en, this message translates to:
  /// **'Total available: {count}'**
  String driverTotalAvailable(int count);

  /// No description provided for @driverAreaChip.
  ///
  /// In en, this message translates to:
  /// **'Area: {area}'**
  String driverAreaChip(String area);

  /// No description provided for @driverCouldNotLoadActive.
  ///
  /// In en, this message translates to:
  /// **'Could not load active deliveries'**
  String get driverCouldNotLoadActive;

  /// No description provided for @driverRefreshBeforeAccept.
  ///
  /// In en, this message translates to:
  /// **'Refresh before accepting a new job.'**
  String get driverRefreshBeforeAccept;

  /// No description provided for @driverMyActiveDeliveries.
  ///
  /// In en, this message translates to:
  /// **'My active deliveries'**
  String get driverMyActiveDeliveries;

  /// No description provided for @driverLoadingActive.
  ///
  /// In en, this message translates to:
  /// **'Loading active deliveries…'**
  String get driverLoadingActive;

  /// No description provided for @driverNoActiveDeliveries.
  ///
  /// In en, this message translates to:
  /// **'No active deliveries yet.'**
  String get driverNoActiveDeliveries;

  /// No description provided for @driverNoActiveDeliveriesHint.
  ///
  /// In en, this message translates to:
  /// **'You can accept available jobs when you are ready.'**
  String get driverNoActiveDeliveriesHint;

  /// No description provided for @driverAvailableNearbyJobs.
  ///
  /// In en, this message translates to:
  /// **'Available nearby jobs'**
  String get driverAvailableNearbyJobs;

  /// No description provided for @driverActiveLimitReached.
  ///
  /// In en, this message translates to:
  /// **'You reached the active delivery limit.'**
  String get driverActiveLimitReached;

  /// No description provided for @driverActiveLimitHint.
  ///
  /// In en, this message translates to:
  /// **'Complete one delivery before accepting another.'**
  String get driverActiveLimitHint;

  /// No description provided for @driverCompleteOneFirst.
  ///
  /// In en, this message translates to:
  /// **'Complete one delivery before accepting another.'**
  String get driverCompleteOneFirst;

  /// No description provided for @driverLoadingAvailable.
  ///
  /// In en, this message translates to:
  /// **'Loading available jobs…'**
  String get driverLoadingAvailable;

  /// No description provided for @driverLookingForWaiting.
  ///
  /// In en, this message translates to:
  /// **'Looking for waiting delivery requests.'**
  String get driverLookingForWaiting;

  /// No description provided for @driverCouldNotLoadAvailable.
  ///
  /// In en, this message translates to:
  /// **'Could not load available jobs.'**
  String get driverCouldNotLoadAvailable;

  /// No description provided for @driverOpenDelivery.
  ///
  /// In en, this message translates to:
  /// **'Open delivery'**
  String get driverOpenDelivery;

  /// No description provided for @driverFindNearbyJobs.
  ///
  /// In en, this message translates to:
  /// **'Find nearby jobs'**
  String get driverFindNearbyJobs;

  /// No description provided for @driverDistanceToPickupHint.
  ///
  /// In en, this message translates to:
  /// **'Distance is calculated to the pickup location.'**
  String get driverDistanceToPickupHint;

  /// No description provided for @driverAnyDistance.
  ///
  /// In en, this message translates to:
  /// **'Any distance'**
  String get driverAnyDistance;

  /// No description provided for @driverWithinKm.
  ///
  /// In en, this message translates to:
  /// **'Within {km} km'**
  String driverWithinKm(int km);

  /// No description provided for @driverNearest.
  ///
  /// In en, this message translates to:
  /// **'Nearest'**
  String get driverNearest;

  /// No description provided for @driverNewest.
  ///
  /// In en, this message translates to:
  /// **'Newest'**
  String get driverNewest;

  /// No description provided for @driverDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get driverDone;

  /// No description provided for @driverCityLabel.
  ///
  /// In en, this message translates to:
  /// **'City:'**
  String get driverCityLabel;

  /// No description provided for @driverAllCities.
  ///
  /// In en, this message translates to:
  /// **'All cities'**
  String get driverAllCities;

  /// No description provided for @driverAreaLabel.
  ///
  /// In en, this message translates to:
  /// **'Area:'**
  String get driverAreaLabel;

  /// No description provided for @driverAllAreas.
  ///
  /// In en, this message translates to:
  /// **'All areas'**
  String get driverAllAreas;

  /// No description provided for @driverResetFilters.
  ///
  /// In en, this message translates to:
  /// **'Reset filters'**
  String get driverResetFilters;

  /// No description provided for @driverLocationNeeded.
  ///
  /// In en, this message translates to:
  /// **'Location needed for distance filter.'**
  String get driverLocationNeeded;

  /// No description provided for @driverLocationLabel.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get driverLocationLabel;

  /// No description provided for @driverSort.
  ///
  /// In en, this message translates to:
  /// **'Sort'**
  String get driverSort;

  /// No description provided for @driverAcceptJob.
  ///
  /// In en, this message translates to:
  /// **'Accept job'**
  String get driverAcceptJob;

  /// No description provided for @driverAccepting.
  ///
  /// In en, this message translates to:
  /// **'Accepting…'**
  String get driverAccepting;

  /// No description provided for @driverActiveLimitReachedButton.
  ///
  /// In en, this message translates to:
  /// **'Active delivery limit reached'**
  String get driverActiveLimitReachedButton;

  /// No description provided for @driverDeliveryAccepted.
  ///
  /// In en, this message translates to:
  /// **'Delivery accepted.'**
  String get driverDeliveryAccepted;

  /// No description provided for @driverDeliveryNoLongerAvailable.
  ///
  /// In en, this message translates to:
  /// **'This delivery is no longer available.'**
  String get driverDeliveryNoLongerAvailable;

  /// No description provided for @driverReachedActiveLimit.
  ///
  /// In en, this message translates to:
  /// **'You have reached the active delivery limit.'**
  String get driverReachedActiveLimit;

  /// No description provided for @driverDistanceToPickup.
  ///
  /// In en, this message translates to:
  /// **'Distance to pickup'**
  String get driverDistanceToPickup;

  /// No description provided for @driverPickupLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get driverPickupLabel;

  /// No description provided for @driverIncreaseRadius.
  ///
  /// In en, this message translates to:
  /// **'Increase radius'**
  String get driverIncreaseRadius;

  /// No description provided for @driverShowAnyDistance.
  ///
  /// In en, this message translates to:
  /// **'Show any distance'**
  String get driverShowAnyDistance;

  /// No description provided for @driverLoadingLocation.
  ///
  /// In en, this message translates to:
  /// **'Loading location…'**
  String get driverLoadingLocation;

  /// No description provided for @driverUsingCurrentLocation.
  ///
  /// In en, this message translates to:
  /// **'Using your current location'**
  String get driverUsingCurrentLocation;

  /// No description provided for @driverUsingProfileArea.
  ///
  /// In en, this message translates to:
  /// **'Using profile area: {location}'**
  String driverUsingProfileArea(String location);

  /// No description provided for @driverLocationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Location unavailable — showing all available jobs'**
  String get driverLocationUnavailable;

  /// No description provided for @driverSearchRadiusAny.
  ///
  /// In en, this message translates to:
  /// **'Search radius: Any distance'**
  String get driverSearchRadiusAny;

  /// No description provided for @driverSearchRadiusWithin.
  ///
  /// In en, this message translates to:
  /// **'Search radius: Within {km} km'**
  String driverSearchRadiusWithin(int km);

  /// No description provided for @driverPickupDistanceUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Pickup distance unavailable'**
  String get driverPickupDistanceUnavailable;

  /// No description provided for @driverKmToPickup.
  ///
  /// In en, this message translates to:
  /// **'{distance} km to pickup'**
  String driverKmToPickup(String distance);

  /// No description provided for @driverNoJobsWithinRadius.
  ///
  /// In en, this message translates to:
  /// **'No jobs within {radius} km.'**
  String driverNoJobsWithinRadius(String radius);

  /// No description provided for @driverJobsAvailableOutsideRadius.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 job is} other{{count} jobs are}} available outside your current radius. Try increasing the radius or choosing Any distance.'**
  String driverJobsAvailableOutsideRadius(int count);

  /// No description provided for @driverTryIncreaseRadius.
  ///
  /// In en, this message translates to:
  /// **'Try increasing the radius or choosing Any distance.'**
  String get driverTryIncreaseRadius;

  /// No description provided for @driverNoJobsInArea.
  ///
  /// In en, this message translates to:
  /// **'No jobs found in this area.'**
  String get driverNoJobsInArea;

  /// No description provided for @driverJobsAvailableBroaderFilters.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 job is} other{{count} jobs are}} available with broader filters. Try all areas or reset filters.'**
  String driverJobsAvailableBroaderFilters(int count);

  /// No description provided for @driverTryAllAreasOrReset.
  ///
  /// In en, this message translates to:
  /// **'Try all areas or reset filters.'**
  String get driverTryAllAreasOrReset;

  /// No description provided for @driverNoJobsNearby.
  ///
  /// In en, this message translates to:
  /// **'No available jobs near you right now.'**
  String get driverNoJobsNearby;

  /// No description provided for @driverTryChangeFilters.
  ///
  /// In en, this message translates to:
  /// **'Try changing the city, area, or distance filter.'**
  String get driverTryChangeFilters;

  /// No description provided for @driverCheckingActiveDelivery.
  ///
  /// In en, this message translates to:
  /// **'Checking your active assigned delivery.'**
  String get driverCheckingActiveDelivery;

  /// No description provided for @driverCouldNotLoadDetails.
  ///
  /// In en, this message translates to:
  /// **'Could not load delivery details.'**
  String get driverCouldNotLoadDetails;

  /// No description provided for @driverMovedToAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Delivery moved to admin review'**
  String get driverMovedToAdminReview;

  /// No description provided for @driverNoLongerActive.
  ///
  /// In en, this message translates to:
  /// **'Delivery no longer active'**
  String get driverNoLongerActive;

  /// No description provided for @driverNoLongerActiveDefault.
  ///
  /// In en, this message translates to:
  /// **'This delivery is no longer active. It was moved to admin review.'**
  String get driverNoLongerActiveDefault;

  /// No description provided for @driverBackToJobs.
  ///
  /// In en, this message translates to:
  /// **'Back to jobs'**
  String get driverBackToJobs;

  /// No description provided for @driverNotAssigned.
  ///
  /// In en, this message translates to:
  /// **'Delivery not active or not assigned to you'**
  String get driverNotAssigned;

  /// No description provided for @driverOpenJobsBoard.
  ///
  /// In en, this message translates to:
  /// **'Open the jobs board to view your current assigned delivery.'**
  String get driverOpenJobsBoard;

  /// No description provided for @driverActiveDelivery.
  ///
  /// In en, this message translates to:
  /// **'Active delivery'**
  String get driverActiveDelivery;

  /// No description provided for @driverLearnerUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Learner unavailable'**
  String get driverLearnerUnavailable;

  /// No description provided for @driverDeliveryWindow.
  ///
  /// In en, this message translates to:
  /// **'Delivery window'**
  String get driverDeliveryWindow;

  /// No description provided for @driverLearnerNote.
  ///
  /// In en, this message translates to:
  /// **'Learner note'**
  String get driverLearnerNote;

  /// No description provided for @driverNoNextAction.
  ///
  /// In en, this message translates to:
  /// **'No next action'**
  String get driverNoNextAction;

  /// No description provided for @driverCannotAdvance.
  ///
  /// In en, this message translates to:
  /// **'This delivery cannot be advanced from its current status.'**
  String get driverCannotAdvance;

  /// No description provided for @driverCannotAdvanceFurther.
  ///
  /// In en, this message translates to:
  /// **'This delivery cannot be advanced further.'**
  String get driverCannotAdvanceFurther;

  /// No description provided for @driverTimingNote.
  ///
  /// In en, this message translates to:
  /// **'Timing note'**
  String get driverTimingNote;

  /// No description provided for @driverOptionalNote.
  ///
  /// In en, this message translates to:
  /// **'Optional driver note'**
  String get driverOptionalNote;

  /// No description provided for @driverOptionalNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Add a short note for this status update'**
  String get driverOptionalNoteHint;

  /// No description provided for @driverUpdating.
  ///
  /// In en, this message translates to:
  /// **'Updating...'**
  String get driverUpdating;

  /// No description provided for @driverReportPickupFailed.
  ///
  /// In en, this message translates to:
  /// **'Report pickup failed'**
  String get driverReportPickupFailed;

  /// No description provided for @driverReportDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Report delivery failed'**
  String get driverReportDeliveryFailed;

  /// No description provided for @driverReportDriverIssue.
  ///
  /// In en, this message translates to:
  /// **'Report that I cannot continue'**
  String get driverReportDriverIssue;

  /// No description provided for @driverSupplierHandoverCode.
  ///
  /// In en, this message translates to:
  /// **'Supplier handover code'**
  String get driverSupplierHandoverCode;

  /// No description provided for @driverSupplierHandoverCodeMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter the code the supplier gives you after handing over the material.'**
  String get driverSupplierHandoverCodeMessage;

  /// No description provided for @driverMarkPickedUp.
  ///
  /// In en, this message translates to:
  /// **'Mark picked up'**
  String get driverMarkPickedUp;

  /// No description provided for @driverLearnerDeliveryCode.
  ///
  /// In en, this message translates to:
  /// **'Learner delivery code'**
  String get driverLearnerDeliveryCode;

  /// No description provided for @driverLearnerDeliveryCodeMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter the code the learner gives you when they receive the material.'**
  String get driverLearnerDeliveryCodeMessage;

  /// No description provided for @driverMarkDelivered.
  ///
  /// In en, this message translates to:
  /// **'Mark delivered'**
  String get driverMarkDelivered;

  /// No description provided for @driverDeliveryMarkedDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivery marked delivered.'**
  String get driverDeliveryMarkedDelivered;

  /// No description provided for @driverStatusUpdated.
  ///
  /// In en, this message translates to:
  /// **'Delivery status updated.'**
  String get driverStatusUpdated;

  /// No description provided for @driverStatusArrivedPickupSuccess.
  ///
  /// In en, this message translates to:
  /// **'Arrived at pickup.'**
  String get driverStatusArrivedPickupSuccess;

  /// No description provided for @driverStatusPickedUpSuccess.
  ///
  /// In en, this message translates to:
  /// **'Marked as picked up.'**
  String get driverStatusPickedUpSuccess;

  /// No description provided for @driverStatusOnTheWaySuccess.
  ///
  /// In en, this message translates to:
  /// **'On the way to the learner.'**
  String get driverStatusOnTheWaySuccess;

  /// No description provided for @driverStatusArrivedDropoffSuccess.
  ///
  /// In en, this message translates to:
  /// **'Arrived at drop-off.'**
  String get driverStatusArrivedDropoffSuccess;

  /// No description provided for @driverStatusChangedRefresh.
  ///
  /// In en, this message translates to:
  /// **'Delivery status changed. Refresh and try the next valid action.'**
  String get driverStatusChangedRefresh;

  /// No description provided for @driverInvalidConfirmationCode.
  ///
  /// In en, this message translates to:
  /// **'That confirmation code is incorrect. Check the code and try again.'**
  String get driverInvalidConfirmationCode;

  /// No description provided for @driverHandoverWindowNotStarted.
  ///
  /// In en, this message translates to:
  /// **'The handover window has not started yet.'**
  String get driverHandoverWindowNotStarted;

  /// No description provided for @driverHandoverWindowExpired.
  ///
  /// In en, this message translates to:
  /// **'The handover window has already ended.'**
  String get driverHandoverWindowExpired;

  /// No description provided for @driverPartialPickupSelectionInvalid.
  ///
  /// In en, this message translates to:
  /// **'The selected pickup items are invalid. Refresh and try again.'**
  String get driverPartialPickupSelectionInvalid;

  /// No description provided for @driverGroupedDeliverySplitConflict.
  ///
  /// In en, this message translates to:
  /// **'This grouped delivery changed. Refresh and try again.'**
  String get driverGroupedDeliverySplitConflict;

  /// No description provided for @driverAvailableJobsCursorInvalid.
  ///
  /// In en, this message translates to:
  /// **'Job list paging is out of date. Refresh available jobs.'**
  String get driverAvailableJobsCursorInvalid;

  /// No description provided for @driverPartialPickupTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm what was picked up'**
  String get driverPartialPickupTitle;

  /// No description provided for @driverPartialPickupBody.
  ///
  /// In en, this message translates to:
  /// **'Select every reservation item the supplier handed over now.'**
  String get driverPartialPickupBody;

  /// No description provided for @driverPartialPickupPickedSection.
  ///
  /// In en, this message translates to:
  /// **'Will be delivered now'**
  String get driverPartialPickupPickedSection;

  /// No description provided for @driverPartialPickupPendingSection.
  ///
  /// In en, this message translates to:
  /// **'Will remain pending'**
  String get driverPartialPickupPendingSection;

  /// No description provided for @driverPartialPickupReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose a reason for each pending item.'**
  String get driverPartialPickupReasonRequired;

  /// No description provided for @driverPartialPickupSummary.
  ///
  /// In en, this message translates to:
  /// **'{pickedCount, plural, =1{1 item will be delivered now.} other{{pickedCount} items will be delivered now.}} {pendingCount, plural, =1{1 item will remain pending.} other{{pendingCount} items will remain pending.}}'**
  String driverPartialPickupSummary(int pickedCount, int pendingCount);

  /// No description provided for @driverPartialPickupContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue to confirmation code'**
  String get driverPartialPickupContinue;

  /// No description provided for @driverPartialPickupReasonMaterialNotReady.
  ///
  /// In en, this message translates to:
  /// **'Material not ready'**
  String get driverPartialPickupReasonMaterialNotReady;

  /// No description provided for @driverPartialPickupReasonMaterialMissing.
  ///
  /// In en, this message translates to:
  /// **'Material missing'**
  String get driverPartialPickupReasonMaterialMissing;

  /// No description provided for @driverPartialPickupReasonWrongItem.
  ///
  /// In en, this message translates to:
  /// **'Wrong item'**
  String get driverPartialPickupReasonWrongItem;

  /// No description provided for @driverPartialPickupReasonQuantityMismatch.
  ///
  /// In en, this message translates to:
  /// **'Quantity mismatch'**
  String get driverPartialPickupReasonQuantityMismatch;

  /// No description provided for @driverPartialPickupReasonDamagedItem.
  ///
  /// In en, this message translates to:
  /// **'Damaged item'**
  String get driverPartialPickupReasonDamagedItem;

  /// No description provided for @driverPartialPickupReasonSupplierRefused.
  ///
  /// In en, this message translates to:
  /// **'Supplier refused handover'**
  String get driverPartialPickupReasonSupplierRefused;

  /// No description provided for @driverPartialPickupReasonOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get driverPartialPickupReasonOther;

  /// No description provided for @driverPickupFailureReported.
  ///
  /// In en, this message translates to:
  /// **'Pickup failure reported.'**
  String get driverPickupFailureReported;

  /// No description provided for @driverDeliveryFailureReported.
  ///
  /// In en, this message translates to:
  /// **'Delivery failure reported.'**
  String get driverDeliveryFailureReported;

  /// No description provided for @driverNoteRequired.
  ///
  /// In en, this message translates to:
  /// **'Note (required)'**
  String get driverNoteRequired;

  /// No description provided for @driverIssueNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Describe why you cannot continue delivery'**
  String get driverIssueNoteHint;

  /// No description provided for @driverSubmitReport.
  ///
  /// In en, this message translates to:
  /// **'Submit report'**
  String get driverSubmitReport;

  /// No description provided for @driverReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get driverReason;

  /// No description provided for @driverIssueReported.
  ///
  /// In en, this message translates to:
  /// **'Driver issue reported.'**
  String get driverIssueReported;

  /// No description provided for @driverLocationSharing.
  ///
  /// In en, this message translates to:
  /// **'Location sharing'**
  String get driverLocationSharing;

  /// No description provided for @driverLocationSharingBody.
  ///
  /// In en, this message translates to:
  /// **'Share your location while this delivery is active. The learner can track you only after the material is picked up.'**
  String get driverLocationSharingBody;

  /// No description provided for @driverShareAutomatically.
  ///
  /// In en, this message translates to:
  /// **'Share automatically'**
  String get driverShareAutomatically;

  /// No description provided for @driverSharingEvery45Seconds.
  ///
  /// In en, this message translates to:
  /// **'Sharing every 45 seconds while this page is open.'**
  String get driverSharingEvery45Seconds;

  /// No description provided for @driverLocationSharingPaused.
  ///
  /// In en, this message translates to:
  /// **'Location sharing paused'**
  String get driverLocationSharingPaused;

  /// No description provided for @driverSending.
  ///
  /// In en, this message translates to:
  /// **'Sending...'**
  String get driverSending;

  /// No description provided for @driverSendMyLocation.
  ///
  /// In en, this message translates to:
  /// **'Send my location'**
  String get driverSendMyLocation;

  /// No description provided for @driverLocationUpdateSent.
  ///
  /// In en, this message translates to:
  /// **'Location update sent.'**
  String get driverLocationUpdateSent;

  /// No description provided for @driverLastShared.
  ///
  /// In en, this message translates to:
  /// **'Last shared: {dateTime}'**
  String driverLastShared(String dateTime);

  /// No description provided for @driverCurrentStage.
  ///
  /// In en, this message translates to:
  /// **'Current stage: {status}'**
  String driverCurrentStage(String status);

  /// No description provided for @driverNoFurtherSteps.
  ///
  /// In en, this message translates to:
  /// **'No further steps for this delivery.'**
  String get driverNoFurtherSteps;

  /// No description provided for @driverAdvanceTo.
  ///
  /// In en, this message translates to:
  /// **'Advance to: {action}'**
  String driverAdvanceTo(String action);

  /// No description provided for @driverNextAction.
  ///
  /// In en, this message translates to:
  /// **'Next: {action}'**
  String driverNextAction(String action);

  /// No description provided for @driverSupplierCodeRequired.
  ///
  /// In en, this message translates to:
  /// **'Supplier handover code is required when marking picked up.'**
  String get driverSupplierCodeRequired;

  /// No description provided for @driverLearnerCodeRequired.
  ///
  /// In en, this message translates to:
  /// **'Learner delivery code is required when marking delivered.'**
  String get driverLearnerCodeRequired;

  /// No description provided for @driverCompleteArriveBeforePickedUp.
  ///
  /// In en, this message translates to:
  /// **'Complete \"Arrive at pickup\" before marking picked up.'**
  String get driverCompleteArriveBeforePickedUp;

  /// No description provided for @driverMarkPickedUpBeforeDelivery.
  ///
  /// In en, this message translates to:
  /// **'Mark picked up before starting delivery.'**
  String get driverMarkPickedUpBeforeDelivery;

  /// No description provided for @driverStartDeliveryBeforeArrive.
  ///
  /// In en, this message translates to:
  /// **'Start delivery before arriving at drop-off.'**
  String get driverStartDeliveryBeforeArrive;

  /// No description provided for @driverArriveBeforeDelivered.
  ///
  /// In en, this message translates to:
  /// **'Arrive at drop-off before marking delivered.'**
  String get driverArriveBeforeDelivered;

  /// No description provided for @driverActionNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'This action is not available yet.'**
  String get driverActionNotAvailable;

  /// No description provided for @driverNotSet.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get driverNotSet;

  /// No description provided for @driverApproximateAddress.
  ///
  /// In en, this message translates to:
  /// **'Approximate address — confirm with learner if needed.'**
  String get driverApproximateAddress;

  /// No description provided for @driverExactCoordinatesMissing.
  ///
  /// In en, this message translates to:
  /// **'Exact coordinates are missing.'**
  String get driverExactCoordinatesMissing;

  /// No description provided for @driverAssignedAt.
  ///
  /// In en, this message translates to:
  /// **'Assigned {dateTime}'**
  String driverAssignedAt(String dateTime);

  /// No description provided for @driverAvailableInDays.
  ///
  /// In en, this message translates to:
  /// **'Available in {count, plural, =1{1 day} other{{count} days}}'**
  String driverAvailableInDays(int count);

  /// No description provided for @driverAvailableInHoursMinutes.
  ///
  /// In en, this message translates to:
  /// **'Available in {hours} h {minutes} min'**
  String driverAvailableInHoursMinutes(int hours, int minutes);

  /// No description provided for @driverAvailableInHours.
  ///
  /// In en, this message translates to:
  /// **'Available in {count, plural, =1{1 hour} other{{count} hours}}'**
  String driverAvailableInHours(int count);

  /// No description provided for @driverAvailableInMinutes.
  ///
  /// In en, this message translates to:
  /// **'Available in {count, plural, =1{1 minute} other{{count} minutes}}'**
  String driverAvailableInMinutes(int count);

  /// No description provided for @driverAvailableSoon.
  ///
  /// In en, this message translates to:
  /// **'Available soon'**
  String get driverAvailableSoon;

  /// No description provided for @driverPickupNotAvailableYet.
  ///
  /// In en, this message translates to:
  /// **'Pickup confirmation is not available yet'**
  String get driverPickupNotAvailableYet;

  /// No description provided for @driverPickupConfirmFrom.
  ///
  /// In en, this message translates to:
  /// **'Pickup can be confirmed from {time} (30 minutes before the supplier window).'**
  String driverPickupConfirmFrom(String time);

  /// No description provided for @driverSupplierPickupWindowPassed.
  ///
  /// In en, this message translates to:
  /// **'Supplier pickup window has passed'**
  String get driverSupplierPickupWindowPassed;

  /// No description provided for @driverPickupConfirmationEnded.
  ///
  /// In en, this message translates to:
  /// **'The allowed pickup confirmation window ended at {dateTime}.'**
  String driverPickupConfirmationEnded(String dateTime);

  /// No description provided for @driverDeliveryWindowNotSet.
  ///
  /// In en, this message translates to:
  /// **'Delivery confirmation window is not set'**
  String get driverDeliveryWindowNotSet;

  /// No description provided for @driverLearnerMustConfirmWindow.
  ///
  /// In en, this message translates to:
  /// **'The learner must confirm a delivery window before you can mark delivered.'**
  String get driverLearnerMustConfirmWindow;

  /// No description provided for @driverDeliveryNotAvailableYet.
  ///
  /// In en, this message translates to:
  /// **'Delivery confirmation is not available yet'**
  String get driverDeliveryNotAvailableYet;

  /// No description provided for @driverDeliveryConfirmFrom.
  ///
  /// In en, this message translates to:
  /// **'Delivery can be confirmed from {time}.'**
  String driverDeliveryConfirmFrom(String time);

  /// No description provided for @driverDeliveryWindowPassed.
  ///
  /// In en, this message translates to:
  /// **'Delivery window has passed'**
  String get driverDeliveryWindowPassed;

  /// No description provided for @driverDeliveryConfirmationEnded.
  ///
  /// In en, this message translates to:
  /// **'The allowed delivery confirmation window ended at {dateTime}.'**
  String driverDeliveryConfirmationEnded(String dateTime);

  /// No description provided for @driverPickupWindowNotStarted.
  ///
  /// In en, this message translates to:
  /// **'Pickup window has not started yet'**
  String get driverPickupWindowNotStarted;

  /// No description provided for @driverPickupStartsAt.
  ///
  /// In en, this message translates to:
  /// **'Pickup starts at {time}.'**
  String driverPickupStartsAt(String time);

  /// No description provided for @driverSupplierPickupOverdue.
  ///
  /// In en, this message translates to:
  /// **'Supplier pickup window overdue'**
  String get driverSupplierPickupOverdue;

  /// No description provided for @driverPickupOverdueBody.
  ///
  /// In en, this message translates to:
  /// **'The allowed pickup confirmation window ended at {dateTime}. Report pickup failed if you cannot complete pickup.'**
  String driverPickupOverdueBody(String dateTime);

  /// No description provided for @driverScheduledPickupEnded.
  ///
  /// In en, this message translates to:
  /// **'Scheduled pickup window has ended'**
  String get driverScheduledPickupEnded;

  /// No description provided for @driverScheduledPickupEndedBody.
  ///
  /// In en, this message translates to:
  /// **'The supplier window ended at {time}. You may still complete pickup if the material is ready.'**
  String driverScheduledPickupEndedBody(String time);

  /// No description provided for @driverArriveAtPickup.
  ///
  /// In en, this message translates to:
  /// **'Arrive at pickup'**
  String get driverArriveAtPickup;

  /// No description provided for @driverArriveAtPickupReq1.
  ///
  /// In en, this message translates to:
  /// **'Drive to the supplier pickup location.'**
  String get driverArriveAtPickupReq1;

  /// No description provided for @driverArriveAtPickupReq2.
  ///
  /// In en, this message translates to:
  /// **'No confirmation code is required for this step.'**
  String get driverArriveAtPickupReq2;

  /// No description provided for @driverMarkPickedUpReq1.
  ///
  /// In en, this message translates to:
  /// **'You must be at the supplier pickup location.'**
  String get driverMarkPickedUpReq1;

  /// No description provided for @driverMarkPickedUpReq2.
  ///
  /// In en, this message translates to:
  /// **'Enter the supplier handover code when prompted.'**
  String get driverMarkPickedUpReq2;

  /// No description provided for @driverStartDeliveryOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'Start delivery / On the way'**
  String get driverStartDeliveryOnTheWay;

  /// No description provided for @driverStartDeliveryReq1.
  ///
  /// In en, this message translates to:
  /// **'Material must already be picked up from the supplier.'**
  String get driverStartDeliveryReq1;

  /// No description provided for @driverStartDeliveryReq2.
  ///
  /// In en, this message translates to:
  /// **'No confirmation code is required for this step.'**
  String get driverStartDeliveryReq2;

  /// No description provided for @driverArriveAtDropoff.
  ///
  /// In en, this message translates to:
  /// **'Arrive at drop-off'**
  String get driverArriveAtDropoff;

  /// No description provided for @driverArriveAtDropoffReq1.
  ///
  /// In en, this message translates to:
  /// **'Drive to the learner drop-off location.'**
  String get driverArriveAtDropoffReq1;

  /// No description provided for @driverArriveAtDropoffReq2.
  ///
  /// In en, this message translates to:
  /// **'No confirmation code is required for this step.'**
  String get driverArriveAtDropoffReq2;

  /// No description provided for @driverMarkDeliveredReq1.
  ///
  /// In en, this message translates to:
  /// **'You must be at the learner drop-off location.'**
  String get driverMarkDeliveredReq1;

  /// No description provided for @driverMarkDeliveredReq2.
  ///
  /// In en, this message translates to:
  /// **'Enter the learner delivery code when prompted.'**
  String get driverMarkDeliveredReq2;

  /// No description provided for @driverFailureSupplierUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Supplier unavailable'**
  String get driverFailureSupplierUnavailable;

  /// No description provided for @driverFailureMaterialNotReady.
  ///
  /// In en, this message translates to:
  /// **'Material not ready'**
  String get driverFailureMaterialNotReady;

  /// No description provided for @driverFailureLocationIssue.
  ///
  /// In en, this message translates to:
  /// **'Location issue'**
  String get driverFailureLocationIssue;

  /// No description provided for @driverFailureLearnerUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Learner unavailable'**
  String get driverFailureLearnerUnavailable;

  /// No description provided for @driverFailureAddressIssue.
  ///
  /// In en, this message translates to:
  /// **'Address issue'**
  String get driverFailureAddressIssue;

  /// No description provided for @driverFailureAccessIssue.
  ///
  /// In en, this message translates to:
  /// **'Access issue'**
  String get driverFailureAccessIssue;

  /// No description provided for @driverInactiveMovedToAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Moved to admin review'**
  String get driverInactiveMovedToAdminReview;

  /// No description provided for @driverInactiveNoLongerActive.
  ///
  /// In en, this message translates to:
  /// **'No longer active'**
  String get driverInactiveNoLongerActive;

  /// No description provided for @driverTransportCar.
  ///
  /// In en, this message translates to:
  /// **'Car'**
  String get driverTransportCar;

  /// No description provided for @driverTransportMotorcycle.
  ///
  /// In en, this message translates to:
  /// **'Motorcycle'**
  String get driverTransportMotorcycle;

  /// No description provided for @driverTransportBicycle.
  ///
  /// In en, this message translates to:
  /// **'Bicycle'**
  String get driverTransportBicycle;

  /// No description provided for @driverTransportWalking.
  ///
  /// In en, this message translates to:
  /// **'Walking'**
  String get driverTransportWalking;

  /// No description provided for @driverPhoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Required for drivers'**
  String get driverPhoneRequired;

  /// No description provided for @driverTransportationType.
  ///
  /// In en, this message translates to:
  /// **'Transportation type'**
  String get driverTransportationType;

  /// No description provided for @driverAddressLineOptional.
  ///
  /// In en, this message translates to:
  /// **'Address line (optional)'**
  String get driverAddressLineOptional;

  /// No description provided for @driverAvailabilityNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Availability note (optional)'**
  String get driverAvailabilityNoteOptional;

  /// No description provided for @notificationDriverNewJobTitle.
  ///
  /// In en, this message translates to:
  /// **'New delivery job'**
  String get notificationDriverNewJobTitle;

  /// No description provided for @notificationDriverNewJobBody.
  ///
  /// In en, this message translates to:
  /// **'{materialTitle} is ready for delivery.'**
  String notificationDriverNewJobBody(String materialTitle);

  /// No description provided for @notificationDriverPickupTimeTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup time'**
  String get notificationDriverPickupTimeTitle;

  /// No description provided for @notificationDriverPickupTimeBody.
  ///
  /// In en, this message translates to:
  /// **'Pickup for {materialTitle} starts soon.'**
  String notificationDriverPickupTimeBody(String materialTitle);

  /// No description provided for @notificationDriverDropoffTimeTitle.
  ///
  /// In en, this message translates to:
  /// **'Drop-off time'**
  String get notificationDriverDropoffTimeTitle;

  /// No description provided for @notificationDriverDropoffTimeBody.
  ///
  /// In en, this message translates to:
  /// **'Drop-off for {materialTitle} starts soon.'**
  String notificationDriverDropoffTimeBody(String materialTitle);

  /// No description provided for @notificationDriverUnassignedTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery assignment removed'**
  String get notificationDriverUnassignedTitle;

  /// No description provided for @notificationDriverUnassignedBody.
  ///
  /// In en, this message translates to:
  /// **'{materialTitle} was reopened to the driver pool by an admin.'**
  String notificationDriverUnassignedBody(String materialTitle);

  /// No description provided for @notificationDriverMovedToAdminTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery moved to admin review'**
  String get notificationDriverMovedToAdminTitle;

  /// No description provided for @notificationDriverMovedToAdminBody.
  ///
  /// In en, this message translates to:
  /// **'Delivery moved to admin review because pickup was not completed within the pickup window.'**
  String get notificationDriverMovedToAdminBody;

  /// No description provided for @driverToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get driverToday;

  /// No description provided for @driverPickupStartsInHours.
  ///
  /// In en, this message translates to:
  /// **'Pickup starts in {hours, plural, =1{1 hour} other{{hours} hours}} · {dateLabel} · {timeRange}'**
  String driverPickupStartsInHours(
    int hours,
    String dateLabel,
    String timeRange,
  );

  /// No description provided for @driverPickupStartsInMinutes.
  ///
  /// In en, this message translates to:
  /// **'Pickup starts in {minutes} min · {dateLabel} · {timeRange}'**
  String driverPickupStartsInMinutes(
    int minutes,
    String dateLabel,
    String timeRange,
  );

  /// No description provided for @driverPickupStartsSoon.
  ///
  /// In en, this message translates to:
  /// **'Pickup starts soon · {dateLabel} · {timeRange}'**
  String driverPickupStartsSoon(String dateLabel, String timeRange);

  /// No description provided for @driverPickupWindowEndedSummary.
  ///
  /// In en, this message translates to:
  /// **'Pickup window ended · {dateLabel} · {timeRange}'**
  String driverPickupWindowEndedSummary(String dateLabel, String timeRange);

  /// No description provided for @driverReadyForPickupNow.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup now · {dateLabel} · {timeRange}'**
  String driverReadyForPickupNow(String dateLabel, String timeRange);

  /// No description provided for @inviteAcceptTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete your ImpactLoop invitation'**
  String get inviteAcceptTitle;

  /// No description provided for @inviteInvalidLink.
  ///
  /// In en, this message translates to:
  /// **'Invalid invitation link.'**
  String get inviteInvalidLink;

  /// No description provided for @inviteRegistrationCompleted.
  ///
  /// In en, this message translates to:
  /// **'Registration completed successfully.'**
  String get inviteRegistrationCompleted;

  /// No description provided for @inviteRoleLabel.
  ///
  /// In en, this message translates to:
  /// **'Role: {role}'**
  String inviteRoleLabel(String role);

  /// No description provided for @inviteInvitedRole.
  ///
  /// In en, this message translates to:
  /// **'Invited role: {role}'**
  String inviteInvitedRole(String role);

  /// No description provided for @inviteExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires: {date}'**
  String inviteExpires(String date);

  /// No description provided for @inviteInvalidOrExpired.
  ///
  /// In en, this message translates to:
  /// **'This invitation link is invalid, expired, revoked, or already used.'**
  String get inviteInvalidOrExpired;

  /// No description provided for @inviteCompleteRegistration.
  ///
  /// In en, this message translates to:
  /// **'Complete registration'**
  String get inviteCompleteRegistration;

  /// No description provided for @inviteFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get inviteFullName;

  /// No description provided for @invitePhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get invitePhone;

  /// No description provided for @invitePhoneOptional.
  ///
  /// In en, this message translates to:
  /// **'Phone (optional)'**
  String get invitePhoneOptional;

  /// No description provided for @inviteFieldRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get inviteFieldRequired;

  /// No description provided for @driverLocationUnavailableShort.
  ///
  /// In en, this message translates to:
  /// **'Location unavailable'**
  String get driverLocationUnavailableShort;

  /// No description provided for @driverUnknownParty.
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get driverUnknownParty;

  /// No description provided for @driverGroupedItemsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 item} other{{count} items}}'**
  String driverGroupedItemsCount(int count);

  /// No description provided for @driverCouldNotShareLocation.
  ///
  /// In en, this message translates to:
  /// **'Could not share location. Try again or use Send my location.'**
  String get driverCouldNotShareLocation;

  /// No description provided for @driverLocationPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Location permission was denied. Enable location permission or try again.'**
  String get driverLocationPermissionDenied;

  /// No description provided for @driverLocationServicesDisabled.
  ///
  /// In en, this message translates to:
  /// **'Location services are disabled. Turn on location services and try again.'**
  String get driverLocationServicesDisabled;

  /// No description provided for @driverCurrentLocationFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not get your current location. Please try again.'**
  String get driverCurrentLocationFailed;

  /// No description provided for @driverHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'History and reports'**
  String get driverHistoryTitle;

  /// No description provided for @driverHistorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review deliveries you previously handled and follow up on reports you submitted.'**
  String get driverHistorySubtitle;

  /// No description provided for @driverDeliveriesTab.
  ///
  /// In en, this message translates to:
  /// **'Deliveries'**
  String get driverDeliveriesTab;

  /// No description provided for @driverReportsTab.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get driverReportsTab;

  /// No description provided for @driverHistoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'No historical deliveries yet.'**
  String get driverHistoryEmpty;

  /// No description provided for @driverReportsEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have not submitted any reports yet.'**
  String get driverReportsEmpty;

  /// No description provided for @driverArchiveLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load this archive.'**
  String get driverArchiveLoadFailed;

  /// No description provided for @driverArchiveMoreFailed.
  ///
  /// In en, this message translates to:
  /// **'Earlier items could not be loaded. Your current results are still shown.'**
  String get driverArchiveMoreFailed;

  /// No description provided for @driverOpenHistoricalDelivery.
  ///
  /// In en, this message translates to:
  /// **'Open historical delivery'**
  String get driverOpenHistoricalDelivery;

  /// No description provided for @driverPartialPickupHistory.
  ///
  /// In en, this message translates to:
  /// **'Partial pickup'**
  String get driverPartialPickupHistory;

  /// No description provided for @driverSubmittedNote.
  ///
  /// In en, this message translates to:
  /// **'Your submitted note'**
  String get driverSubmittedNote;

  /// No description provided for @driverResolutionOutcome.
  ///
  /// In en, this message translates to:
  /// **'Resolution'**
  String get driverResolutionOutcome;

  /// No description provided for @driverOpenRelatedDelivery.
  ///
  /// In en, this message translates to:
  /// **'Open related delivery'**
  String get driverOpenRelatedDelivery;

  /// No description provided for @driverHistoricalDeliveryTitle.
  ///
  /// In en, this message translates to:
  /// **'Historical delivery'**
  String get driverHistoricalDeliveryTitle;

  /// No description provided for @driverReadOnly.
  ///
  /// In en, this message translates to:
  /// **'Read only'**
  String get driverReadOnly;

  /// No description provided for @driverDeliverySummary.
  ///
  /// In en, this message translates to:
  /// **'Delivery summary'**
  String get driverDeliverySummary;

  /// No description provided for @driverItemAudit.
  ///
  /// In en, this message translates to:
  /// **'Item record'**
  String get driverItemAudit;

  /// No description provided for @driverLegacyItemAuditWarning.
  ///
  /// In en, this message translates to:
  /// **'This older delivery has no pickup snapshot; current reservation records are shown.'**
  String get driverLegacyItemAuditWarning;

  /// No description provided for @driverFailureReason.
  ///
  /// In en, this message translates to:
  /// **'Failure reason'**
  String get driverFailureReason;

  /// No description provided for @driverDeliveryTimeline.
  ///
  /// In en, this message translates to:
  /// **'Delivery timeline'**
  String get driverDeliveryTimeline;

  /// No description provided for @driverTimelineUnavailable.
  ///
  /// In en, this message translates to:
  /// **'No timeline entries are available.'**
  String get driverTimelineUnavailable;

  /// No description provided for @driverHistoryNav.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get driverHistoryNav;

  /// No description provided for @driverOutcomeAdminReview.
  ///
  /// In en, this message translates to:
  /// **'Moved to Admin review'**
  String get driverOutcomeAdminReview;

  /// No description provided for @driverOutcomeReassigned.
  ///
  /// In en, this message translates to:
  /// **'Reassigned to another driver'**
  String get driverOutcomeReassigned;

  /// No description provided for @driverOutcomeReleased.
  ///
  /// In en, this message translates to:
  /// **'Released back to available jobs'**
  String get driverOutcomeReleased;

  /// No description provided for @driverOutcomeClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed delivery'**
  String get driverOutcomeClosed;

  /// No description provided for @driverReviewPending.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get driverReviewPending;

  /// No description provided for @driverReviewVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get driverReviewVerified;

  /// No description provided for @driverReviewRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get driverReviewRejected;

  /// No description provided for @driverReviewResolvedNoStrike.
  ///
  /// In en, this message translates to:
  /// **'Resolved without strike'**
  String get driverReviewResolvedNoStrike;

  /// No description provided for @driverIncidentPickupFailed.
  ///
  /// In en, this message translates to:
  /// **'Pickup issue'**
  String get driverIncidentPickupFailed;

  /// No description provided for @driverIncidentDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivery issue'**
  String get driverIncidentDeliveryFailed;

  /// No description provided for @driverIncidentDriverIssue.
  ///
  /// In en, this message translates to:
  /// **'Driver issue'**
  String get driverIncidentDriverIssue;

  /// No description provided for @driverOutcomeSupplierReschedule.
  ///
  /// In en, this message translates to:
  /// **'Supplier reschedule requested'**
  String get driverOutcomeSupplierReschedule;

  /// No description provided for @driverOutcomeReplacementSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Replacement window submitted'**
  String get driverOutcomeReplacementSubmitted;

  /// No description provided for @driverOutcomeRegrouped.
  ///
  /// In en, this message translates to:
  /// **'Reservation regrouped'**
  String get driverOutcomeRegrouped;

  /// No description provided for @driverOutcomeCancelledExpired.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled or expired; hold released'**
  String get driverOutcomeCancelledExpired;

  /// No description provided for @driverOutcomePendingRecovery.
  ///
  /// In en, this message translates to:
  /// **'Recovery remains pending'**
  String get driverOutcomePendingRecovery;

  /// No description provided for @driverOutcomeNoUpdate.
  ///
  /// In en, this message translates to:
  /// **'No recovery update yet'**
  String get driverOutcomeNoUpdate;

  /// No description provided for @driverYes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get driverYes;

  /// No description provided for @driverNotPickedUpTitle.
  ///
  /// In en, this message translates to:
  /// **'Not picked up'**
  String get driverNotPickedUpTitle;

  /// No description provided for @driverArchiveCursorExpired.
  ///
  /// In en, this message translates to:
  /// **'This archive page changed or expired. Restart from the newest results.'**
  String get driverArchiveCursorExpired;

  /// No description provided for @driverRestartArchive.
  ///
  /// In en, this message translates to:
  /// **'Restart from newest'**
  String get driverRestartArchive;

  /// No description provided for @driverOpenRecoveryDelivery.
  ///
  /// In en, this message translates to:
  /// **'Open recovery delivery'**
  String get driverOpenRecoveryDelivery;

  /// No description provided for @driverProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Driver Profile'**
  String get driverProfileTitle;

  /// No description provided for @driverProfileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Manage the operational details used for delivery work and control whether you receive new job offers.'**
  String get driverProfileSubtitle;

  /// No description provided for @driverAdministrativeProfileStatus.
  ///
  /// In en, this message translates to:
  /// **'Profile status'**
  String get driverAdministrativeProfileStatus;

  /// No description provided for @driverOperationalState.
  ///
  /// In en, this message translates to:
  /// **'Operational state'**
  String get driverOperationalState;

  /// No description provided for @driverProfileStatusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get driverProfileStatusActive;

  /// No description provided for @driverProfileStatusInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get driverProfileStatusInactive;

  /// No description provided for @driverProfileStatusSuspended.
  ///
  /// In en, this message translates to:
  /// **'Suspended'**
  String get driverProfileStatusSuspended;

  /// No description provided for @driverProfileStatusUnknown.
  ///
  /// In en, this message translates to:
  /// **'Status unavailable'**
  String get driverProfileStatusUnknown;

  /// No description provided for @driverProfileActiveExplanation.
  ///
  /// In en, this message translates to:
  /// **'Your Driver profile is active.'**
  String get driverProfileActiveExplanation;

  /// No description provided for @driverProfileInactiveExplanation.
  ///
  /// In en, this message translates to:
  /// **'Your Driver profile is inactive. Profile changes and new-job acceptance are unavailable.'**
  String get driverProfileInactiveExplanation;

  /// No description provided for @driverProfileSuspendedExplanation.
  ///
  /// In en, this message translates to:
  /// **'Your Driver profile is suspended. Contact support if you need help.'**
  String get driverProfileSuspendedExplanation;

  /// No description provided for @driverProfileUnknownExplanation.
  ///
  /// In en, this message translates to:
  /// **'Your Driver profile status could not be confirmed. Refresh before changing availability.'**
  String get driverProfileUnknownExplanation;

  /// No description provided for @driverAvailabilityAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get driverAvailabilityAvailable;

  /// No description provided for @driverAvailabilityOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get driverAvailabilityOffline;

  /// No description provided for @driverAvailabilityOnDelivery.
  ///
  /// In en, this message translates to:
  /// **'On delivery'**
  String get driverAvailabilityOnDelivery;

  /// No description provided for @driverAvailabilityUnknown.
  ///
  /// In en, this message translates to:
  /// **'State unavailable'**
  String get driverAvailabilityUnknown;

  /// No description provided for @driverAvailabilityUnknownExplanation.
  ///
  /// In en, this message translates to:
  /// **'Your operational state is managed by the system and is currently unavailable.'**
  String get driverAvailabilityUnknownExplanation;

  /// No description provided for @driverSystemManagedState.
  ///
  /// In en, this message translates to:
  /// **'System-managed operational state'**
  String get driverSystemManagedState;

  /// No description provided for @driverAcceptingNewJobs.
  ///
  /// In en, this message translates to:
  /// **'Accepting new jobs'**
  String get driverAcceptingNewJobs;

  /// No description provided for @driverAcceptingNewJobsOn.
  ///
  /// In en, this message translates to:
  /// **'New delivery offers are enabled.'**
  String get driverAcceptingNewJobsOn;

  /// No description provided for @driverAcceptingNewJobsOff.
  ///
  /// In en, this message translates to:
  /// **'New delivery offers are paused.'**
  String get driverAcceptingNewJobsOff;

  /// No description provided for @driverActiveDeliveriesContinueNoOffers.
  ///
  /// In en, this message translates to:
  /// **'Your active deliveries continue. You will not receive new job offers.'**
  String get driverActiveDeliveriesContinueNoOffers;

  /// No description provided for @driverOnDeliveryAcceptingExplanation.
  ///
  /// In en, this message translates to:
  /// **'You are completing active deliveries and may accept more work up to the current limit.'**
  String get driverOnDeliveryAcceptingExplanation;

  /// No description provided for @driverAvailableExplanation.
  ///
  /// In en, this message translates to:
  /// **'You can browse and accept new delivery jobs.'**
  String get driverAvailableExplanation;

  /// No description provided for @driverOfflineExplanation.
  ///
  /// In en, this message translates to:
  /// **'You are not receiving new delivery offers.'**
  String get driverOfflineExplanation;

  /// No description provided for @driverDashboardAvailabilityTitle.
  ///
  /// In en, this message translates to:
  /// **'Availability and status'**
  String get driverDashboardAvailabilityTitle;

  /// No description provided for @driverActiveDeliveryCountLabel.
  ///
  /// In en, this message translates to:
  /// **'Active deliveries'**
  String get driverActiveDeliveryCountLabel;

  /// No description provided for @driverPauseNewJobsConfirmationTitle.
  ///
  /// In en, this message translates to:
  /// **'Pause new job offers?'**
  String get driverPauseNewJobsConfirmationTitle;

  /// No description provided for @driverPauseNewJobsConfirmationBody.
  ///
  /// In en, this message translates to:
  /// **'Assigned deliveries, reminders, and operational notifications will continue. Only new job offers will be paused.'**
  String get driverPauseNewJobsConfirmationBody;

  /// No description provided for @driverPauseNewJobsAction.
  ///
  /// In en, this message translates to:
  /// **'Pause new jobs'**
  String get driverPauseNewJobsAction;

  /// No description provided for @driverResumeNewJobs.
  ///
  /// In en, this message translates to:
  /// **'Resume new jobs'**
  String get driverResumeNewJobs;

  /// No description provided for @driverOperationalProfileDetails.
  ///
  /// In en, this message translates to:
  /// **'Operational profile details'**
  String get driverOperationalProfileDetails;

  /// No description provided for @driverProfileCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get driverProfileCity;

  /// No description provided for @driverProfileArea.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get driverProfileArea;

  /// No description provided for @driverTransportationCar.
  ///
  /// In en, this message translates to:
  /// **'Car'**
  String get driverTransportationCar;

  /// No description provided for @driverTransportationMotorcycle.
  ///
  /// In en, this message translates to:
  /// **'Motorcycle'**
  String get driverTransportationMotorcycle;

  /// No description provided for @driverTransportationBicycle.
  ///
  /// In en, this message translates to:
  /// **'Bicycle'**
  String get driverTransportationBicycle;

  /// No description provided for @driverTransportationWalking.
  ///
  /// In en, this message translates to:
  /// **'Walking'**
  String get driverTransportationWalking;

  /// No description provided for @driverTransportationUnknown.
  ///
  /// In en, this message translates to:
  /// **'Not specified'**
  String get driverTransportationUnknown;

  /// No description provided for @driverChooseTransportation.
  ///
  /// In en, this message translates to:
  /// **'Choose transportation'**
  String get driverChooseTransportation;

  /// No description provided for @driverVehicleDescription.
  ///
  /// In en, this message translates to:
  /// **'Vehicle description'**
  String get driverVehicleDescription;

  /// No description provided for @driverVehiclePlate.
  ///
  /// In en, this message translates to:
  /// **'Vehicle plate'**
  String get driverVehiclePlate;

  /// No description provided for @driverCapacityNotes.
  ///
  /// In en, this message translates to:
  /// **'Capacity notes'**
  String get driverCapacityNotes;

  /// No description provided for @driverCapacityNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Optional information about item size or carrying capacity'**
  String get driverCapacityNotesHint;

  /// No description provided for @driverOptionalField.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get driverOptionalField;

  /// No description provided for @driverCityValidation.
  ///
  /// In en, this message translates to:
  /// **'Enter a city between 2 and 100 characters.'**
  String get driverCityValidation;

  /// No description provided for @driverAreaValidation.
  ///
  /// In en, this message translates to:
  /// **'Enter an area between 2 and 100 characters.'**
  String get driverAreaValidation;

  /// No description provided for @driverTransportationValidation.
  ///
  /// In en, this message translates to:
  /// **'Choose a supported transportation type.'**
  String get driverTransportationValidation;

  /// No description provided for @driverVehicleLabelValidation.
  ///
  /// In en, this message translates to:
  /// **'Vehicle description must be 120 characters or fewer.'**
  String get driverVehicleLabelValidation;

  /// No description provided for @driverVehiclePlateValidation.
  ///
  /// In en, this message translates to:
  /// **'Vehicle plate must be 32 characters or fewer.'**
  String get driverVehiclePlateValidation;

  /// No description provided for @driverCapacityNotesValidation.
  ///
  /// In en, this message translates to:
  /// **'Capacity notes must be 500 characters or fewer.'**
  String get driverCapacityNotesValidation;

  /// No description provided for @driverSaveProfile.
  ///
  /// In en, this message translates to:
  /// **'Save profile'**
  String get driverSaveProfile;

  /// No description provided for @driverSavingProfile.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get driverSavingProfile;

  /// No description provided for @driverProfileSaved.
  ///
  /// In en, this message translates to:
  /// **'Driver profile saved.'**
  String get driverProfileSaved;

  /// No description provided for @driverProfileLoadError.
  ///
  /// In en, this message translates to:
  /// **'Could not load Driver Profile'**
  String get driverProfileLoadError;

  /// No description provided for @driverAccountSettingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Account Settings'**
  String get driverAccountSettingsTitle;

  /// No description provided for @driverAccountSettingsExplanation.
  ///
  /// In en, this message translates to:
  /// **'Your name and phone are managed in Account Settings.'**
  String get driverAccountSettingsExplanation;

  /// No description provided for @driverOpenAccountSettings.
  ///
  /// In en, this message translates to:
  /// **'Open Account Settings'**
  String get driverOpenAccountSettings;

  /// No description provided for @driverUnsavedChangesTitle.
  ///
  /// In en, this message translates to:
  /// **'Discard unsaved changes?'**
  String get driverUnsavedChangesTitle;

  /// No description provided for @driverUnsavedChangesBody.
  ///
  /// In en, this message translates to:
  /// **'Your Driver Profile changes have not been saved.'**
  String get driverUnsavedChangesBody;

  /// No description provided for @driverKeepEditing.
  ///
  /// In en, this message translates to:
  /// **'Keep editing'**
  String get driverKeepEditing;

  /// No description provided for @driverDiscardChanges.
  ///
  /// In en, this message translates to:
  /// **'Discard changes'**
  String get driverDiscardChanges;

  /// No description provided for @driverJobsPausedTitle.
  ///
  /// In en, this message translates to:
  /// **'New job offers are paused'**
  String get driverJobsPausedTitle;

  /// No description provided for @driverJobsPausedExplanation.
  ///
  /// In en, this message translates to:
  /// **'Turn on accepting new jobs to browse available deliveries again.'**
  String get driverJobsPausedExplanation;

  /// No description provided for @driverJobsInactiveTitle.
  ///
  /// In en, this message translates to:
  /// **'Driver Profile is inactive'**
  String get driverJobsInactiveTitle;

  /// No description provided for @driverJobsSuspendedTitle.
  ///
  /// In en, this message translates to:
  /// **'Driver Profile is suspended'**
  String get driverJobsSuspendedTitle;

  /// No description provided for @driverJobsUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Available jobs are unavailable'**
  String get driverJobsUnavailableTitle;

  /// No description provided for @driverAssignedDeliveriesContinue.
  ///
  /// In en, this message translates to:
  /// **'Assigned deliveries, reminders, reports, and notification history remain available.'**
  String get driverAssignedDeliveriesContinue;

  /// No description provided for @driverNotAcceptingNewJobsError.
  ///
  /// In en, this message translates to:
  /// **'Resume accepting new jobs before accepting this delivery.'**
  String get driverNotAcceptingNewJobsError;

  /// No description provided for @driverCancelAction.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get driverCancelAction;

  /// No description provided for @driverStatusWaitingForAssignment.
  ///
  /// In en, this message translates to:
  /// **'Waiting for assignment'**
  String get driverStatusWaitingForAssignment;

  /// No description provided for @driverStatusAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned — head to pickup'**
  String get driverStatusAssigned;

  /// No description provided for @driverStatusAtPickup.
  ///
  /// In en, this message translates to:
  /// **'At pickup location'**
  String get driverStatusAtPickup;

  /// No description provided for @driverStatusPickedUp.
  ///
  /// In en, this message translates to:
  /// **'Picked up'**
  String get driverStatusPickedUp;

  /// No description provided for @driverStatusOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'On the way to learner'**
  String get driverStatusOnTheWay;

  /// No description provided for @driverStatusAtDropoff.
  ///
  /// In en, this message translates to:
  /// **'At drop-off location'**
  String get driverStatusAtDropoff;

  /// No description provided for @driverStatusDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get driverStatusDelivered;

  /// No description provided for @driverStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get driverStatusCancelled;

  /// No description provided for @driverStatusPickupFailed.
  ///
  /// In en, this message translates to:
  /// **'Pickup failed'**
  String get driverStatusPickupFailed;

  /// No description provided for @driverStatusDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivery failed'**
  String get driverStatusDeliveryFailed;

  /// No description provided for @driverStatusDriverNoShow.
  ///
  /// In en, this message translates to:
  /// **'Marked as no-show'**
  String get driverStatusDriverNoShow;

  /// No description provided for @driverStatusLearnerNoShow.
  ///
  /// In en, this message translates to:
  /// **'Learner no-show'**
  String get driverStatusLearnerNoShow;

  /// No description provided for @driverStatusAwaitingReview.
  ///
  /// In en, this message translates to:
  /// **'Under admin review'**
  String get driverStatusAwaitingReview;

  /// No description provided for @driverNavHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get driverNavHome;

  /// No description provided for @driverNavJobs.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get driverNavJobs;

  /// No description provided for @driverNavActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get driverNavActive;

  /// No description provided for @driverNavHistory.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get driverNavHistory;

  /// No description provided for @driverNavMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get driverNavMore;

  /// No description provided for @driverNavGroupOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get driverNavGroupOverview;

  /// No description provided for @driverNavGroupWork.
  ///
  /// In en, this message translates to:
  /// **'Work'**
  String get driverNavGroupWork;

  /// No description provided for @driverNavGroupHistory.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get driverNavGroupHistory;

  /// No description provided for @driverNavGroupAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get driverNavGroupAccount;

  /// No description provided for @driverMoreTitle.
  ///
  /// In en, this message translates to:
  /// **'More options'**
  String get driverMoreTitle;

  /// No description provided for @driverMoreProfile.
  ///
  /// In en, this message translates to:
  /// **'Driver profile'**
  String get driverMoreProfile;

  /// No description provided for @driverMoreNotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get driverMoreNotifications;

  /// No description provided for @driverMoreHistory.
  ///
  /// In en, this message translates to:
  /// **'History and reports'**
  String get driverMoreHistory;

  /// No description provided for @driverMoreAccountSettings.
  ///
  /// In en, this message translates to:
  /// **'Account settings'**
  String get driverMoreAccountSettings;

  /// No description provided for @driverAcceptingJobsOnExplicit.
  ///
  /// In en, this message translates to:
  /// **'Available for new jobs'**
  String get driverAcceptingJobsOnExplicit;

  /// No description provided for @driverAcceptingJobsOffExplicit.
  ///
  /// In en, this message translates to:
  /// **'Not available right now'**
  String get driverAcceptingJobsOffExplicit;

  /// No description provided for @driverEditFilters.
  ///
  /// In en, this message translates to:
  /// **'Edit filters'**
  String get driverEditFilters;

  /// No description provided for @driverPartialPickupSelectAtLeastOne.
  ///
  /// In en, this message translates to:
  /// **'Select at least one item that the supplier handed over now.'**
  String get driverPartialPickupSelectAtLeastOne;

  /// No description provided for @driverEmptyActiveTitle.
  ///
  /// In en, this message translates to:
  /// **'No active deliveries'**
  String get driverEmptyActiveTitle;

  /// No description provided for @driverEmptyActiveBody.
  ///
  /// In en, this message translates to:
  /// **'When you accept a job, it will appear here until delivery is complete.'**
  String get driverEmptyActiveBody;

  /// No description provided for @driverEmptyActiveCta.
  ///
  /// In en, this message translates to:
  /// **'Browse available jobs'**
  String get driverEmptyActiveCta;

  /// No description provided for @driverViewNearbyJobs.
  ///
  /// In en, this message translates to:
  /// **'View nearby jobs'**
  String get driverViewNearbyJobs;

  /// No description provided for @driverRoutePickupLabel.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get driverRoutePickupLabel;

  /// No description provided for @driverRouteDropoffLabel.
  ///
  /// In en, this message translates to:
  /// **'Drop-off'**
  String get driverRouteDropoffLabel;

  /// No description provided for @driverRouteFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get driverRouteFrom;

  /// No description provided for @driverRouteTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get driverRouteTo;

  /// No description provided for @driverRouteArrowSemantic.
  ///
  /// In en, this message translates to:
  /// **'Route direction'**
  String get driverRouteArrowSemantic;

  /// No description provided for @driverMapSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Locations'**
  String get driverMapSectionTitle;

  /// No description provided for @driverMapPickupPin.
  ///
  /// In en, this message translates to:
  /// **'Pickup location'**
  String get driverMapPickupPin;

  /// No description provided for @driverMapDropoffPin.
  ///
  /// In en, this message translates to:
  /// **'Drop-off location'**
  String get driverMapDropoffPin;

  /// No description provided for @driverMapOpenExternal.
  ///
  /// In en, this message translates to:
  /// **'Open in maps'**
  String get driverMapOpenExternal;

  /// No description provided for @driverMapUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Map preview is unavailable for this location.'**
  String get driverMapUnavailable;

  /// No description provided for @driverUnitPiece.
  ///
  /// In en, this message translates to:
  /// **'piece'**
  String get driverUnitPiece;

  /// No description provided for @driverUnitSheet.
  ///
  /// In en, this message translates to:
  /// **'sheet'**
  String get driverUnitSheet;

  /// No description provided for @driverUnitBag.
  ///
  /// In en, this message translates to:
  /// **'bag'**
  String get driverUnitBag;

  /// No description provided for @driverUnitKg.
  ///
  /// In en, this message translates to:
  /// **'kg'**
  String get driverUnitKg;

  /// No description provided for @driverUnitItem.
  ///
  /// In en, this message translates to:
  /// **'item'**
  String get driverUnitItem;

  /// No description provided for @driverUnitUnit.
  ///
  /// In en, this message translates to:
  /// **'unit'**
  String get driverUnitUnit;

  /// No description provided for @driverUnitPanel.
  ///
  /// In en, this message translates to:
  /// **'panel'**
  String get driverUnitPanel;

  /// No description provided for @driverUnitCrate.
  ///
  /// In en, this message translates to:
  /// **'crate'**
  String get driverUnitCrate;

  /// No description provided for @driverUnitMeter.
  ///
  /// In en, this message translates to:
  /// **'meter'**
  String get driverUnitMeter;

  /// No description provided for @driverUnitLiter.
  ///
  /// In en, this message translates to:
  /// **'liter'**
  String get driverUnitLiter;

  /// No description provided for @driverUnitRoll.
  ///
  /// In en, this message translates to:
  /// **'roll'**
  String get driverUnitRoll;

  /// No description provided for @driverUnitBox.
  ///
  /// In en, this message translates to:
  /// **'box'**
  String get driverUnitBox;

  /// No description provided for @driverUnitPack.
  ///
  /// In en, this message translates to:
  /// **'pack'**
  String get driverUnitPack;

  /// No description provided for @driverUnitSet.
  ///
  /// In en, this message translates to:
  /// **'set'**
  String get driverUnitSet;

  /// No description provided for @driverQuantityPiece.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 piece} other{{count} pieces}}'**
  String driverQuantityPiece(int count);

  /// No description provided for @driverQuantitySheet.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 sheet} other{{count} sheets}}'**
  String driverQuantitySheet(int count);

  /// No description provided for @driverQuantityBag.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 bag} other{{count} bags}}'**
  String driverQuantityBag(int count);

  /// No description provided for @driverQuantityKg.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 kg} other{{count} kg}}'**
  String driverQuantityKg(int count);

  /// No description provided for @driverQuantityItem.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 item} other{{count} items}}'**
  String driverQuantityItem(int count);

  /// No description provided for @driverQuantityUnit.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 unit} other{{count} units}}'**
  String driverQuantityUnit(int count);

  /// No description provided for @driverQuantityPanel.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 panel} other{{count} panels}}'**
  String driverQuantityPanel(int count);

  /// No description provided for @driverQuantityCrate.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 crate} other{{count} crates}}'**
  String driverQuantityCrate(int count);

  /// No description provided for @driverQuantityMeter.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 meter} other{{count} meters}}'**
  String driverQuantityMeter(int count);

  /// No description provided for @driverQuantityLiter.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 liter} other{{count} liters}}'**
  String driverQuantityLiter(int count);

  /// No description provided for @driverQuantityRoll.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 roll} other{{count} rolls}}'**
  String driverQuantityRoll(int count);

  /// No description provided for @driverQuantityBox.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 box} other{{count} boxes}}'**
  String driverQuantityBox(int count);

  /// No description provided for @driverQuantityPack.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 pack} other{{count} packs}}'**
  String driverQuantityPack(int count);

  /// No description provided for @driverQuantitySet.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 set} other{{count} sets}}'**
  String driverQuantitySet(int count);

  /// No description provided for @notificationDriverPickupReminderTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup reminder'**
  String get notificationDriverPickupReminderTitle;

  /// No description provided for @notificationDriverPickupReminderBody.
  ///
  /// In en, this message translates to:
  /// **'Reminder: pickup for {materialTitle} is coming up.'**
  String notificationDriverPickupReminderBody(String materialTitle);

  /// No description provided for @notificationDriverPickupStartingSoonTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup starting soon'**
  String get notificationDriverPickupStartingSoonTitle;

  /// No description provided for @notificationDriverPickupStartingSoonBody.
  ///
  /// In en, this message translates to:
  /// **'Pickup for {materialTitle} starts in a few minutes.'**
  String notificationDriverPickupStartingSoonBody(String materialTitle);

  /// No description provided for @notificationDriverPickupWindowStartedTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup window started'**
  String get notificationDriverPickupWindowStartedTitle;

  /// No description provided for @notificationDriverPickupWindowStartedBody.
  ///
  /// In en, this message translates to:
  /// **'The pickup window for {materialTitle} is open now.'**
  String notificationDriverPickupWindowStartedBody(String materialTitle);

  /// No description provided for @notificationDriverPickupOverdueTitle.
  ///
  /// In en, this message translates to:
  /// **'Pickup overdue'**
  String get notificationDriverPickupOverdueTitle;

  /// No description provided for @notificationDriverPickupOverdueBody.
  ///
  /// In en, this message translates to:
  /// **'Pickup for {materialTitle} is overdue. Complete pickup or report an issue.'**
  String notificationDriverPickupOverdueBody(String materialTitle);

  /// No description provided for @notificationDriverDropoffReminderTitle.
  ///
  /// In en, this message translates to:
  /// **'Drop-off reminder'**
  String get notificationDriverDropoffReminderTitle;

  /// No description provided for @notificationDriverDropoffReminderBody.
  ///
  /// In en, this message translates to:
  /// **'Reminder: drop-off for {materialTitle} is coming up.'**
  String notificationDriverDropoffReminderBody(String materialTitle);

  /// No description provided for @notificationDriverDropoffStartingSoonTitle.
  ///
  /// In en, this message translates to:
  /// **'Drop-off starting soon'**
  String get notificationDriverDropoffStartingSoonTitle;

  /// No description provided for @notificationDriverDropoffStartingSoonBody.
  ///
  /// In en, this message translates to:
  /// **'Drop-off for {materialTitle} starts in a few minutes.'**
  String notificationDriverDropoffStartingSoonBody(String materialTitle);

  /// No description provided for @notificationDriverDropoffWindowStartedTitle.
  ///
  /// In en, this message translates to:
  /// **'Drop-off window started'**
  String get notificationDriverDropoffWindowStartedTitle;

  /// No description provided for @notificationDriverDropoffWindowStartedBody.
  ///
  /// In en, this message translates to:
  /// **'The drop-off window for {materialTitle} is open now.'**
  String notificationDriverDropoffWindowStartedBody(String materialTitle);

  /// No description provided for @notificationDriverDropoffOverdueTitle.
  ///
  /// In en, this message translates to:
  /// **'Drop-off overdue'**
  String get notificationDriverDropoffOverdueTitle;

  /// No description provided for @notificationDriverDropoffOverdueBody.
  ///
  /// In en, this message translates to:
  /// **'Drop-off for {materialTitle} is overdue. Complete delivery or report an issue.'**
  String notificationDriverDropoffOverdueBody(String materialTitle);

  /// No description provided for @notificationDriverDeliveryRequestCreatedTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery request created'**
  String get notificationDriverDeliveryRequestCreatedTitle;

  /// No description provided for @notificationDriverDeliveryRequestCreatedBody.
  ///
  /// In en, this message translates to:
  /// **'A delivery request for {materialTitle} was created.'**
  String notificationDriverDeliveryRequestCreatedBody(String materialTitle);

  /// No description provided for @notificationDriverDeliveryAcceptedTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery accepted'**
  String get notificationDriverDeliveryAcceptedTitle;

  /// No description provided for @notificationDriverDeliveryAcceptedBody.
  ///
  /// In en, this message translates to:
  /// **'You accepted the delivery for {materialTitle}.'**
  String notificationDriverDeliveryAcceptedBody(String materialTitle);

  /// No description provided for @notificationDriverDeliveryNextStepTitle.
  ///
  /// In en, this message translates to:
  /// **'Next delivery step'**
  String get notificationDriverDeliveryNextStepTitle;

  /// No description provided for @notificationDriverDeliveryNextStepBody.
  ///
  /// In en, this message translates to:
  /// **'Continue the delivery for {materialTitle}.'**
  String notificationDriverDeliveryNextStepBody(String materialTitle);

  /// No description provided for @notificationDeliveryDriverAssignedTitle.
  ///
  /// In en, this message translates to:
  /// **'Driver assigned'**
  String get notificationDeliveryDriverAssignedTitle;

  /// No description provided for @notificationDeliveryDriverAssignedBody.
  ///
  /// In en, this message translates to:
  /// **'You were assigned to deliver {materialTitle}.'**
  String notificationDeliveryDriverAssignedBody(String materialTitle);

  /// No description provided for @adminNavOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get adminNavOverview;

  /// No description provided for @adminNavUsers.
  ///
  /// In en, this message translates to:
  /// **'Users'**
  String get adminNavUsers;

  /// No description provided for @adminNavSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers'**
  String get adminNavSuppliers;

  /// No description provided for @adminNavMaterials.
  ///
  /// In en, this message translates to:
  /// **'Materials'**
  String get adminNavMaterials;

  /// No description provided for @adminNavApprovals.
  ///
  /// In en, this message translates to:
  /// **'Approvals'**
  String get adminNavApprovals;

  /// No description provided for @adminNavInvitations.
  ///
  /// In en, this message translates to:
  /// **'Invitations'**
  String get adminNavInvitations;

  /// No description provided for @adminNavImpactAnalytics.
  ///
  /// In en, this message translates to:
  /// **'Impact Analytics'**
  String get adminNavImpactAnalytics;

  /// No description provided for @adminNavAuditLogs.
  ///
  /// In en, this message translates to:
  /// **'Audit Logs'**
  String get adminNavAuditLogs;

  /// No description provided for @adminNavReservations.
  ///
  /// In en, this message translates to:
  /// **'Reservations'**
  String get adminNavReservations;

  /// No description provided for @adminNavDeliveries.
  ///
  /// In en, this message translates to:
  /// **'Deliveries'**
  String get adminNavDeliveries;

  /// No description provided for @adminNavLearningProjects.
  ///
  /// In en, this message translates to:
  /// **'Learning Projects'**
  String get adminNavLearningProjects;

  /// No description provided for @adminNavExportCenter.
  ///
  /// In en, this message translates to:
  /// **'Export Center'**
  String get adminNavExportCenter;

  /// No description provided for @adminAccessDeniedTitle.
  ///
  /// In en, this message translates to:
  /// **'Access denied'**
  String get adminAccessDeniedTitle;

  /// No description provided for @adminOverviewPageTitle.
  ///
  /// In en, this message translates to:
  /// **'Admin Overview'**
  String get adminOverviewPageTitle;

  /// No description provided for @adminImpactSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Reuse Impact'**
  String get adminImpactSectionTitle;

  /// No description provided for @adminEstimatedAvoidedSuffix.
  ///
  /// In en, this message translates to:
  /// **'estimated avoided'**
  String get adminEstimatedAvoidedSuffix;

  /// No description provided for @adminPlatformMetricsTitle.
  ///
  /// In en, this message translates to:
  /// **'Platform metrics'**
  String get adminPlatformMetricsTitle;

  /// No description provided for @adminAdminOperationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Admin operations'**
  String get adminAdminOperationsTitle;

  /// No description provided for @adminOpenModuleCta.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get adminOpenModuleCta;

  /// No description provided for @adminStatUsers.
  ///
  /// In en, this message translates to:
  /// **'Users'**
  String get adminStatUsers;

  /// No description provided for @adminStatSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers'**
  String get adminStatSuppliers;

  /// No description provided for @adminStatMaterials.
  ///
  /// In en, this message translates to:
  /// **'Materials'**
  String get adminStatMaterials;

  /// No description provided for @adminStatActiveInvitations.
  ///
  /// In en, this message translates to:
  /// **'Active invitations'**
  String get adminStatActiveInvitations;

  /// No description provided for @adminStatActiveDrivers.
  ///
  /// In en, this message translates to:
  /// **'Active drivers'**
  String get adminStatActiveDrivers;

  /// No description provided for @adminEstimatedBadge.
  ///
  /// In en, this message translates to:
  /// **'Estimated'**
  String get adminEstimatedBadge;

  /// No description provided for @adminViewAllAuditLogs.
  ///
  /// In en, this message translates to:
  /// **'View all logs'**
  String get adminViewAllAuditLogs;

  /// No description provided for @adminReviewQueuesTitle.
  ///
  /// In en, this message translates to:
  /// **'Review queues'**
  String get adminReviewQueuesTitle;

  /// No description provided for @adminEmptyNoDataYet.
  ///
  /// In en, this message translates to:
  /// **'No data yet'**
  String get adminEmptyNoDataYet;

  /// No description provided for @adminEmptyAllClearTitle.
  ///
  /// In en, this message translates to:
  /// **'All clear'**
  String get adminEmptyAllClearTitle;

  /// No description provided for @adminPendingCategoryRequests.
  ///
  /// In en, this message translates to:
  /// **'Category requests'**
  String get adminPendingCategoryRequests;

  /// No description provided for @adminPendingPriceRequests.
  ///
  /// In en, this message translates to:
  /// **'Price requests'**
  String get adminPendingPriceRequests;

  /// No description provided for @adminPendingReports.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get adminPendingReports;

  /// No description provided for @adminCategoryRequest.
  ///
  /// In en, this message translates to:
  /// **'Category request'**
  String get adminCategoryRequest;

  /// No description provided for @adminCreateNewCategory.
  ///
  /// In en, this message translates to:
  /// **'Create new category'**
  String get adminCreateNewCategory;

  /// No description provided for @adminExistingCategory.
  ///
  /// In en, this message translates to:
  /// **'Existing category'**
  String get adminExistingCategory;

  /// No description provided for @adminUseThisCategory.
  ///
  /// In en, this message translates to:
  /// **'Use this category'**
  String get adminUseThisCategory;

  /// No description provided for @adminExactNameMatch.
  ///
  /// In en, this message translates to:
  /// **'Exact match'**
  String get adminExactNameMatch;

  /// No description provided for @adminPossibleNameMatch.
  ///
  /// In en, this message translates to:
  /// **'Possible match'**
  String get adminPossibleNameMatch;

  /// No description provided for @adminRequestDetails.
  ///
  /// In en, this message translates to:
  /// **'Request details'**
  String get adminRequestDetails;

  /// No description provided for @adminCategoryMatching.
  ///
  /// In en, this message translates to:
  /// **'Category matching'**
  String get adminCategoryMatching;

  /// No description provided for @adminSimilarCategories.
  ///
  /// In en, this message translates to:
  /// **'Similar categories'**
  String get adminSimilarCategories;

  /// No description provided for @adminRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get adminRequired;

  /// No description provided for @adminMaterialFamily.
  ///
  /// In en, this message translates to:
  /// **'Material family'**
  String get adminMaterialFamily;

  /// No description provided for @adminActiveMapping.
  ///
  /// In en, this message translates to:
  /// **'Active mapping'**
  String get adminActiveMapping;

  /// No description provided for @adminRequestSummary.
  ///
  /// In en, this message translates to:
  /// **'Request summary'**
  String get adminRequestSummary;

  /// No description provided for @adminAdminGuidance.
  ///
  /// In en, this message translates to:
  /// **'Admin guidance'**
  String get adminAdminGuidance;

  /// No description provided for @adminSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get adminSubmitted;

  /// No description provided for @adminRequestedBy.
  ///
  /// In en, this message translates to:
  /// **'Requested by'**
  String get adminRequestedBy;

  /// No description provided for @adminStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get adminStatus;

  /// No description provided for @adminSupplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get adminSupplier;

  /// No description provided for @adminMaterial.
  ///
  /// In en, this message translates to:
  /// **'Material'**
  String get adminMaterial;

  /// No description provided for @adminDescription.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get adminDescription;

  /// No description provided for @adminQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get adminQuantity;

  /// No description provided for @adminCondition.
  ///
  /// In en, this message translates to:
  /// **'Condition'**
  String get adminCondition;

  /// No description provided for @adminLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get adminLocation;

  /// No description provided for @adminReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get adminReason;

  /// No description provided for @adminApprove.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get adminApprove;

  /// No description provided for @adminReject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get adminReject;

  /// No description provided for @adminClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get adminClose;

  /// No description provided for @adminRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get adminRetry;

  /// No description provided for @adminNavSupplierVerification.
  ///
  /// In en, this message translates to:
  /// **'Supplier Verification'**
  String get adminNavSupplierVerification;

  /// No description provided for @adminAccessDeniedBody.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to access the Admin Portal.'**
  String get adminAccessDeniedBody;

  /// No description provided for @adminOverviewPageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Platform control dashboard'**
  String get adminOverviewPageSubtitle;

  /// No description provided for @adminWelcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome back, {name}'**
  String adminWelcomeTitle(String name);

  /// No description provided for @adminWelcomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Here is today\'\'s platform activity, approvals, reuse impact, and operational health.'**
  String get adminWelcomeSubtitle;

  /// No description provided for @adminBannerOverviewLabel.
  ///
  /// In en, this message translates to:
  /// **'Platform overview'**
  String get adminBannerOverviewLabel;

  /// No description provided for @adminPlatformDistributionTitle.
  ///
  /// In en, this message translates to:
  /// **'Platform account distribution'**
  String get adminPlatformDistributionTitle;

  /// No description provided for @adminPlatformDistributionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Users, suppliers, and active drivers on ImpactLoop'**
  String get adminPlatformDistributionSubtitle;

  /// No description provided for @adminCo2RingCenterLabel.
  ///
  /// In en, this message translates to:
  /// **'Listed materials reused'**
  String get adminCo2RingCenterLabel;

  /// No description provided for @adminControlCenterTitle.
  ///
  /// In en, this message translates to:
  /// **'Platform Control Center'**
  String get adminControlCenterTitle;

  /// No description provided for @adminControlCenterSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Monitor platform activity, approvals, invitations, supplier verification, and reuse impact from one place.'**
  String get adminControlCenterSubtitle;

  /// No description provided for @adminChartsAnalyticsTitle.
  ///
  /// In en, this message translates to:
  /// **'Charts & analytics'**
  String get adminChartsAnalyticsTitle;

  /// No description provided for @adminChartsAnalyticsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Reuse trends, category distribution, reservations, and approval queues.'**
  String get adminChartsAnalyticsSubtitle;

  /// No description provided for @adminPlatformMetricsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Live counts across users, listings, approvals, and operations.'**
  String get adminPlatformMetricsSubtitle;

  /// No description provided for @adminAdminOperationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Jump into each admin module from the control dashboard.'**
  String get adminAdminOperationsSubtitle;

  /// No description provided for @adminStatAvailableMaterials.
  ///
  /// In en, this message translates to:
  /// **'Available materials'**
  String get adminStatAvailableMaterials;

  /// No description provided for @adminStatPendingApprovals.
  ///
  /// In en, this message translates to:
  /// **'Pending approvals'**
  String get adminStatPendingApprovals;

  /// No description provided for @adminStatCompletedReuse.
  ///
  /// In en, this message translates to:
  /// **'Completed reuse'**
  String get adminStatCompletedReuse;

  /// No description provided for @adminEstimatedCo2Avoided.
  ///
  /// In en, this message translates to:
  /// **'Estimated CO₂ avoided'**
  String get adminEstimatedCo2Avoided;

  /// No description provided for @adminEstimatedCo2Helper.
  ///
  /// In en, this message translates to:
  /// **'Estimated from reused materials and category-based reuse factors.'**
  String get adminEstimatedCo2Helper;

  /// No description provided for @adminEstimatedCo2ShortHelper.
  ///
  /// In en, this message translates to:
  /// **'Estimated from reused materials'**
  String get adminEstimatedCo2ShortHelper;

  /// No description provided for @adminReuseCompletionRateLabel.
  ///
  /// In en, this message translates to:
  /// **'Reuse completion rate'**
  String get adminReuseCompletionRateLabel;

  /// No description provided for @adminHintUsers.
  ///
  /// In en, this message translates to:
  /// **'Registered accounts on ImpactLoop'**
  String get adminHintUsers;

  /// No description provided for @adminHintSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers with portal access'**
  String get adminHintSuppliers;

  /// No description provided for @adminHintMaterials.
  ///
  /// In en, this message translates to:
  /// **'All listed materials on the platform'**
  String get adminHintMaterials;

  /// No description provided for @adminHintAvailableMaterials.
  ///
  /// In en, this message translates to:
  /// **'Materials currently open for reservation'**
  String get adminHintAvailableMaterials;

  /// No description provided for @adminHintPendingApprovals.
  ///
  /// In en, this message translates to:
  /// **'Supplier, category, and price requests waiting'**
  String get adminHintPendingApprovals;

  /// No description provided for @adminHintActiveInvitations.
  ///
  /// In en, this message translates to:
  /// **'Open driver, moderator, and admin invites'**
  String get adminHintActiveInvitations;

  /// No description provided for @adminHintCompletedReuse.
  ///
  /// In en, this message translates to:
  /// **'Materials marked as reused'**
  String get adminHintCompletedReuse;

  /// No description provided for @adminHintActiveDrivers.
  ///
  /// In en, this message translates to:
  /// **'Users with driver role assigned'**
  String get adminHintActiveDrivers;

  /// No description provided for @adminReuseActivityTitle.
  ///
  /// In en, this message translates to:
  /// **'Reuse activity over time'**
  String get adminReuseActivityTitle;

  /// No description provided for @adminReuseActivitySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Monthly completed reuse across the platform'**
  String get adminReuseActivitySubtitle;

  /// No description provided for @adminMaterialsByCategoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Materials by category'**
  String get adminMaterialsByCategoryTitle;

  /// No description provided for @adminMaterialsByCategorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Distribution of listed materials across categories'**
  String get adminMaterialsByCategorySubtitle;

  /// No description provided for @adminReservationStatusTitle.
  ///
  /// In en, this message translates to:
  /// **'Reservation status overview'**
  String get adminReservationStatusTitle;

  /// No description provided for @adminReservationStatusSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Current reservation pipeline by status'**
  String get adminReservationStatusSubtitle;

  /// No description provided for @adminPendingActionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Approval queue breakdown'**
  String get adminPendingActionsTitle;

  /// No description provided for @adminPendingActionsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pending supplier, category, price, and report reviews'**
  String get adminPendingActionsSubtitle;

  /// No description provided for @adminRecentInvitationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Recent invitations'**
  String get adminRecentInvitationsTitle;

  /// No description provided for @adminRecentActivityTitle.
  ///
  /// In en, this message translates to:
  /// **'Recent admin activity'**
  String get adminRecentActivityTitle;

  /// No description provided for @adminRecentActivitySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Latest administrative events when available'**
  String get adminRecentActivitySubtitle;

  /// No description provided for @adminRecentActivityEmptySubtitle.
  ///
  /// In en, this message translates to:
  /// **'No admin activity yet'**
  String get adminRecentActivityEmptySubtitle;

  /// No description provided for @adminSupplierVerificationQueueTitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification queue'**
  String get adminSupplierVerificationQueueTitle;

  /// No description provided for @adminReviewQueuesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification, invitations, and admin activity'**
  String get adminReviewQueuesSubtitle;

  /// No description provided for @adminSupplierVerificationFutureNote.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification workflow will appear after organization verification documents are enabled.'**
  String get adminSupplierVerificationFutureNote;

  /// No description provided for @adminImpactSnapshotTitle.
  ///
  /// In en, this message translates to:
  /// **'Reuse Impact Snapshot'**
  String get adminImpactSnapshotTitle;

  /// No description provided for @adminImpactSnapshotSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Platform reuse outcomes from completed reservations and materials'**
  String get adminImpactSnapshotSubtitle;

  /// No description provided for @adminImpactReusedMaterials.
  ///
  /// In en, this message translates to:
  /// **'Reused materials'**
  String get adminImpactReusedMaterials;

  /// No description provided for @adminImpactCompletedReservations.
  ///
  /// In en, this message translates to:
  /// **'Completed reservations'**
  String get adminImpactCompletedReservations;

  /// No description provided for @adminImpactLearnersBenefited.
  ///
  /// In en, this message translates to:
  /// **'Learners benefited'**
  String get adminImpactLearnersBenefited;

  /// No description provided for @adminImpactSuppliersContributed.
  ///
  /// In en, this message translates to:
  /// **'Suppliers contributed'**
  String get adminImpactSuppliersContributed;

  /// No description provided for @adminImpactTopCategory.
  ///
  /// In en, this message translates to:
  /// **'Top reused category'**
  String get adminImpactTopCategory;

  /// No description provided for @adminImpactTopCategoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'Top reused category: —'**
  String get adminImpactTopCategoryEmpty;

  /// No description provided for @adminImpactEnvironmentalNote.
  ///
  /// In en, this message translates to:
  /// **'Estimated environmental impact is calculated using category-based reuse factors and available material quantities. Values are approximate.'**
  String get adminImpactEnvironmentalNote;

  /// No description provided for @adminEmptyNoInvitations.
  ///
  /// In en, this message translates to:
  /// **'Create role invitations from the Invitations page once enabled.'**
  String get adminEmptyNoInvitations;

  /// No description provided for @adminEmptyNoInvitationsTitle.
  ///
  /// In en, this message translates to:
  /// **'No active invitations'**
  String get adminEmptyNoInvitationsTitle;

  /// No description provided for @adminEmptyNoInvitationsHint.
  ///
  /// In en, this message translates to:
  /// **'Open the Invitations module to create driver, moderator, or admin invites.'**
  String get adminEmptyNoInvitationsHint;

  /// No description provided for @adminEmptyNoActivity.
  ///
  /// In en, this message translates to:
  /// **'No admin activity yet'**
  String get adminEmptyNoActivity;

  /// No description provided for @adminEmptyNoActivityHint.
  ///
  /// In en, this message translates to:
  /// **'Audit events will appear after admin actions are enabled.'**
  String get adminEmptyNoActivityHint;

  /// No description provided for @adminEmptyNoSupplierVerifications.
  ///
  /// In en, this message translates to:
  /// **'No supplier verification requests waiting.'**
  String get adminEmptyNoSupplierVerifications;

  /// No description provided for @adminEmptyNoPendingApprovals.
  ///
  /// In en, this message translates to:
  /// **'No supplier, category, price, or report reviews waiting.'**
  String get adminEmptyNoPendingApprovals;

  /// No description provided for @adminPendingSupplierVerifications.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification'**
  String get adminPendingSupplierVerifications;

  /// No description provided for @adminOpUsersDesc.
  ///
  /// In en, this message translates to:
  /// **'Manage platform user accounts'**
  String get adminOpUsersDesc;

  /// No description provided for @adminOpSuppliersDesc.
  ///
  /// In en, this message translates to:
  /// **'Review supplier accounts and profiles'**
  String get adminOpSuppliersDesc;

  /// No description provided for @adminOpSupplierVerificationDesc.
  ///
  /// In en, this message translates to:
  /// **'Process supplier verification requests'**
  String get adminOpSupplierVerificationDesc;

  /// No description provided for @adminOpMaterialsDesc.
  ///
  /// In en, this message translates to:
  /// **'Moderate and review material listings'**
  String get adminOpMaterialsDesc;

  /// No description provided for @adminOpApprovalsDesc.
  ///
  /// In en, this message translates to:
  /// **'Category, price, and listing approvals'**
  String get adminOpApprovalsDesc;

  /// No description provided for @adminOpInvitationsDesc.
  ///
  /// In en, this message translates to:
  /// **'Create and track role invitations'**
  String get adminOpInvitationsDesc;

  /// No description provided for @adminOpImpactDesc.
  ///
  /// In en, this message translates to:
  /// **'Explore reuse and impact analytics'**
  String get adminOpImpactDesc;

  /// No description provided for @adminOpAuditLogsDesc.
  ///
  /// In en, this message translates to:
  /// **'Review administrative audit history'**
  String get adminOpAuditLogsDesc;

  /// No description provided for @adminResolveCategoryRequest.
  ///
  /// In en, this message translates to:
  /// **'Resolve category request'**
  String get adminResolveCategoryRequest;

  /// No description provided for @adminUseExistingCategory.
  ///
  /// In en, this message translates to:
  /// **'Use existing category'**
  String get adminUseExistingCategory;

  /// No description provided for @adminUseExistingGuidance.
  ///
  /// In en, this message translates to:
  /// **'Recommended when an existing category already covers this material.'**
  String get adminUseExistingGuidance;

  /// No description provided for @adminCreateNewGuidance.
  ///
  /// In en, this message translates to:
  /// **'Create only when existing categories do not accurately represent this request.'**
  String get adminCreateNewGuidance;

  /// No description provided for @adminSuggestedExistingCategory.
  ///
  /// In en, this message translates to:
  /// **'Suggested existing category'**
  String get adminSuggestedExistingCategory;

  /// No description provided for @adminSearchOtherCategories.
  ///
  /// In en, this message translates to:
  /// **'Search or select another active category'**
  String get adminSearchOtherCategories;

  /// No description provided for @adminSearchCategories.
  ///
  /// In en, this message translates to:
  /// **'Search existing categories…'**
  String get adminSearchCategories;

  /// No description provided for @adminChooseExistingCategory.
  ///
  /// In en, this message translates to:
  /// **'Choose an existing category'**
  String get adminChooseExistingCategory;

  /// No description provided for @adminExistingCategoryRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose an active existing category.'**
  String get adminExistingCategoryRequired;

  /// No description provided for @adminLoadingCategories.
  ///
  /// In en, this message translates to:
  /// **'Loading existing categories…'**
  String get adminLoadingCategories;

  /// No description provided for @adminFailedCategories.
  ///
  /// In en, this message translates to:
  /// **'Failed to load existing categories.'**
  String get adminFailedCategories;

  /// No description provided for @adminNoCategoriesAvailable.
  ///
  /// In en, this message translates to:
  /// **'No active owned material categories are available.'**
  String get adminNoCategoriesAvailable;

  /// No description provided for @adminApproveWithExisting.
  ///
  /// In en, this message translates to:
  /// **'Approve with existing category'**
  String get adminApproveWithExisting;

  /// No description provided for @adminCreateAndApprove.
  ///
  /// In en, this message translates to:
  /// **'Create and approve'**
  String get adminCreateAndApprove;

  /// No description provided for @adminCreateJustification.
  ///
  /// In en, this message translates to:
  /// **'Why is a separate category needed?'**
  String get adminCreateJustification;

  /// No description provided for @adminCreateJustificationHelper.
  ///
  /// In en, this message translates to:
  /// **'Explain briefly why the suggested category does not fit.'**
  String get adminCreateJustificationHelper;

  /// No description provided for @adminCreateJustificationRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter at least 10 characters explaining why a new category is needed.'**
  String get adminCreateJustificationRequired;

  /// No description provided for @adminExistingNameConflict.
  ///
  /// In en, this message translates to:
  /// **'This category already exists'**
  String get adminExistingNameConflict;

  /// No description provided for @adminNoSimilarCategories.
  ///
  /// In en, this message translates to:
  /// **'No suggested existing category'**
  String get adminNoSimilarCategories;

  /// No description provided for @adminApprovalConfiguration.
  ///
  /// In en, this message translates to:
  /// **'Approval configuration'**
  String get adminApprovalConfiguration;

  /// No description provided for @adminRequestedCategoryName.
  ///
  /// In en, this message translates to:
  /// **'Requested name'**
  String get adminRequestedCategoryName;

  /// No description provided for @adminFinalCategoryNameEn.
  ///
  /// In en, this message translates to:
  /// **'Final category name in English'**
  String get adminFinalCategoryNameEn;

  /// No description provided for @adminFinalCategoryNameAr.
  ///
  /// In en, this message translates to:
  /// **'Final category name in Arabic'**
  String get adminFinalCategoryNameAr;

  /// No description provided for @adminBilingualNamesHelper.
  ///
  /// In en, this message translates to:
  /// **'Review both final marketplace names. Users see the name matching their app language. Automated checks only catch obvious structure and language-placement problems; they do not verify grammar or translation.'**
  String get adminBilingualNamesHelper;

  /// No description provided for @adminNamingGuidance.
  ///
  /// In en, this message translates to:
  /// **'Use a short, clear marketplace category name. Avoid material titles, full descriptions, and vague wording.'**
  String get adminNamingGuidance;

  /// No description provided for @adminEnglishNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an English category name between 2 and 120 characters.'**
  String get adminEnglishNameRequired;

  /// No description provided for @adminArabicNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an Arabic category name between 2 and 120 characters.'**
  String get adminArabicNameRequired;

  /// No description provided for @adminEnglishNameWrongScript.
  ///
  /// In en, this message translates to:
  /// **'The English name appears to contain Arabic text.'**
  String get adminEnglishNameWrongScript;

  /// No description provided for @adminArabicNameWrongScript.
  ///
  /// In en, this message translates to:
  /// **'The Arabic name appears to contain English-only text.'**
  String get adminArabicNameWrongScript;

  /// No description provided for @adminNameControlCharacters.
  ///
  /// In en, this message translates to:
  /// **'Category names cannot contain control characters.'**
  String get adminNameControlCharacters;

  /// No description provided for @adminNamePunctuationBoundary.
  ///
  /// In en, this message translates to:
  /// **'Category names cannot begin or end with punctuation.'**
  String get adminNamePunctuationBoundary;

  /// No description provided for @adminNameRepeatedWords.
  ///
  /// In en, this message translates to:
  /// **'Avoid repeating the same word consecutively.'**
  String get adminNameRepeatedWords;

  /// No description provided for @adminNameDescriptionLike.
  ///
  /// In en, this message translates to:
  /// **'This looks like a full description rather than a concise category name.'**
  String get adminNameDescriptionLike;

  /// No description provided for @adminNamesAppearIdentical.
  ///
  /// In en, this message translates to:
  /// **'Both marketplace names are identical. Confirm that this term is intentionally used in both languages.'**
  String get adminNamesAppearIdentical;

  /// No description provided for @adminConfirmSharedTechnicalTerm.
  ///
  /// In en, this message translates to:
  /// **'I confirm this shared technical term is intentional.'**
  String get adminConfirmSharedTechnicalTerm;

  /// No description provided for @adminSharedNameAcknowledgementRequired.
  ///
  /// In en, this message translates to:
  /// **'Confirm that this shared technical term is intentionally used in both languages.'**
  String get adminSharedNameAcknowledgementRequired;

  /// No description provided for @adminNameUnusuallyLong.
  ///
  /// In en, this message translates to:
  /// **'This name is unusually long for a category.'**
  String get adminNameUnusuallyLong;

  /// No description provided for @adminEnglishNameCasingWarning.
  ///
  /// In en, this message translates to:
  /// **'Review English capitalization; marketplace categories normally use title-style names.'**
  String get adminEnglishNameCasingWarning;

  /// No description provided for @adminRepeatedWhitespaceWarning.
  ///
  /// In en, this message translates to:
  /// **'Repeated whitespace will be saved as one ordinary space.'**
  String get adminRepeatedWhitespaceWarning;

  /// No description provided for @adminMaterialTitleWarning.
  ///
  /// In en, this message translates to:
  /// **'This looks like a material title rather than a reusable category name.'**
  String get adminMaterialTitleWarning;

  /// No description provided for @adminSimilarWordingWarning.
  ///
  /// In en, this message translates to:
  /// **'This wording is very similar to an existing category.'**
  String get adminSimilarWordingWarning;

  /// No description provided for @adminAssignMaterialFamily.
  ///
  /// In en, this message translates to:
  /// **'Assign material family'**
  String get adminAssignMaterialFamily;

  /// No description provided for @adminChooseMaterialFamily.
  ///
  /// In en, this message translates to:
  /// **'Choose a material family'**
  String get adminChooseMaterialFamily;

  /// No description provided for @adminSearchMaterialFamilies.
  ///
  /// In en, this message translates to:
  /// **'Search material families'**
  String get adminSearchMaterialFamilies;

  /// No description provided for @adminLoadingMaterialFamilies.
  ///
  /// In en, this message translates to:
  /// **'Loading material families…'**
  String get adminLoadingMaterialFamilies;

  /// No description provided for @adminFailedMaterialFamilies.
  ///
  /// In en, this message translates to:
  /// **'Failed to load material families.'**
  String get adminFailedMaterialFamilies;

  /// No description provided for @adminNoMaterialFamilies.
  ///
  /// In en, this message translates to:
  /// **'No active material families are available.'**
  String get adminNoMaterialFamilies;

  /// No description provided for @adminMaterialFamilyRequired.
  ///
  /// In en, this message translates to:
  /// **'Material family is required.'**
  String get adminMaterialFamilyRequired;

  /// No description provided for @adminMaterialFamilyInactive.
  ///
  /// In en, this message translates to:
  /// **'Selected material family is inactive.'**
  String get adminMaterialFamilyInactive;

  /// No description provided for @adminTaxonomyConceptWrongType.
  ///
  /// In en, this message translates to:
  /// **'Selected taxonomy concept is not a material family.'**
  String get adminTaxonomyConceptWrongType;

  /// No description provided for @adminMaterialFamilyNotFound.
  ///
  /// In en, this message translates to:
  /// **'Selected material family is no longer available.'**
  String get adminMaterialFamilyNotFound;

  /// No description provided for @adminOwnershipHelper.
  ///
  /// In en, this message translates to:
  /// **'Select the canonical material family that best represents this new category.'**
  String get adminOwnershipHelper;

  /// No description provided for @adminOwnershipExplanation.
  ///
  /// In en, this message translates to:
  /// **'This mapping connects the category to the taxonomy and recommendation system.'**
  String get adminOwnershipExplanation;

  /// No description provided for @adminOwnershipGuidance.
  ///
  /// In en, this message translates to:
  /// **'Review similar categories, then select the appropriate material family before approving.'**
  String get adminOwnershipGuidance;

  /// No description provided for @adminApprovalSucceeded.
  ///
  /// In en, this message translates to:
  /// **'Category request approved.'**
  String get adminApprovalSucceeded;

  /// No description provided for @adminCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get adminCancel;

  /// No description provided for @adminConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get adminConfirm;

  /// No description provided for @adminDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get adminDone;

  /// No description provided for @adminExport.
  ///
  /// In en, this message translates to:
  /// **'Export'**
  String get adminExport;

  /// No description provided for @adminFormat.
  ///
  /// In en, this message translates to:
  /// **'Format'**
  String get adminFormat;

  /// No description provided for @adminExcel.
  ///
  /// In en, this message translates to:
  /// **'Excel'**
  String get adminExcel;

  /// No description provided for @adminCsv.
  ///
  /// In en, this message translates to:
  /// **'CSV'**
  String get adminCsv;

  /// No description provided for @adminPdf.
  ///
  /// In en, this message translates to:
  /// **'PDF'**
  String get adminPdf;

  /// No description provided for @adminPrevious.
  ///
  /// In en, this message translates to:
  /// **'Previous'**
  String get adminPrevious;

  /// No description provided for @adminNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get adminNext;

  /// No description provided for @adminSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get adminSearch;

  /// No description provided for @adminReset.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get adminReset;

  /// No description provided for @adminResetFilters.
  ///
  /// In en, this message translates to:
  /// **'Reset filters'**
  String get adminResetFilters;

  /// No description provided for @adminActions.
  ///
  /// In en, this message translates to:
  /// **'ACTIONS'**
  String get adminActions;

  /// No description provided for @adminView.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get adminView;

  /// No description provided for @adminViewDetails.
  ///
  /// In en, this message translates to:
  /// **'View details'**
  String get adminViewDetails;

  /// No description provided for @adminInviteUser.
  ///
  /// In en, this message translates to:
  /// **'Invite user'**
  String get adminInviteUser;

  /// No description provided for @adminSuspendAccount.
  ///
  /// In en, this message translates to:
  /// **'Suspend account'**
  String get adminSuspendAccount;

  /// No description provided for @adminReactivateAccount.
  ///
  /// In en, this message translates to:
  /// **'Reactivate account'**
  String get adminReactivateAccount;

  /// No description provided for @adminSuspendAccountQuestion.
  ///
  /// In en, this message translates to:
  /// **'Suspend {name}?'**
  String adminSuspendAccountQuestion(String name);

  /// No description provided for @adminSuspendAccountBody.
  ///
  /// In en, this message translates to:
  /// **'This will prevent the user from performing important actions, but their existing data and history will remain.'**
  String get adminSuspendAccountBody;

  /// No description provided for @adminReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Reason (required)'**
  String get adminReasonRequired;

  /// No description provided for @adminSuspensionReasonMinLength.
  ///
  /// In en, this message translates to:
  /// **'A suspension reason of at least 3 characters is required.'**
  String get adminSuspensionReasonMinLength;

  /// No description provided for @adminAccountSuspended.
  ///
  /// In en, this message translates to:
  /// **'Account suspended.'**
  String get adminAccountSuspended;

  /// No description provided for @adminReactivateAccountBody.
  ///
  /// In en, this message translates to:
  /// **'Restore access for {name}? Their existing data and history were kept while suspended.'**
  String adminReactivateAccountBody(String name);

  /// No description provided for @adminAccountReactivated.
  ///
  /// In en, this message translates to:
  /// **'Account reactivated.'**
  String get adminAccountReactivated;

  /// No description provided for @adminExportWebOnly.
  ///
  /// In en, this message translates to:
  /// **'Export is available on Admin Web only.'**
  String get adminExportWebOnly;

  /// No description provided for @adminNoUsersMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No users match the current filters.'**
  String get adminNoUsersMatchFilters;

  /// No description provided for @adminExportUsers.
  ///
  /// In en, this message translates to:
  /// **'Export users'**
  String get adminExportUsers;

  /// No description provided for @adminNoProjectBuildsWithLearningData.
  ///
  /// In en, this message translates to:
  /// **'No project builds with learning data.'**
  String get adminNoProjectBuildsWithLearningData;

  /// No description provided for @adminExportReservations.
  ///
  /// In en, this message translates to:
  /// **'Export reservations'**
  String get adminExportReservations;

  /// No description provided for @adminNoReservationsMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No reservations match the current filters.'**
  String get adminNoReservationsMatchFilters;

  /// No description provided for @adminReservationDetails.
  ///
  /// In en, this message translates to:
  /// **'Reservation details'**
  String get adminReservationDetails;

  /// No description provided for @adminOpenReport.
  ///
  /// In en, this message translates to:
  /// **'Open report'**
  String get adminOpenReport;

  /// No description provided for @adminOpenDelivery.
  ///
  /// In en, this message translates to:
  /// **'Open delivery'**
  String get adminOpenDelivery;

  /// No description provided for @adminExportIncidentReports.
  ///
  /// In en, this message translates to:
  /// **'Export incident reports'**
  String get adminExportIncidentReports;

  /// No description provided for @adminNoIncidentReportsMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No incident reports match the current filters.'**
  String get adminNoIncidentReportsMatchFilters;

  /// No description provided for @adminCouldNotLoadIncidentReports.
  ///
  /// In en, this message translates to:
  /// **'Could not load incident reports.'**
  String get adminCouldNotLoadIncidentReports;

  /// No description provided for @adminExportMaterials.
  ///
  /// In en, this message translates to:
  /// **'Export materials'**
  String get adminExportMaterials;

  /// No description provided for @adminNoMaterialsMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No materials match the current filters.'**
  String get adminNoMaterialsMatchFilters;

  /// No description provided for @adminExportMaterialReports.
  ///
  /// In en, this message translates to:
  /// **'Export material reports'**
  String get adminExportMaterialReports;

  /// No description provided for @adminNoMaterialReportsMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No material reports match the current filters.'**
  String get adminNoMaterialReportsMatchFilters;

  /// No description provided for @adminSupplierVerificationDetails.
  ///
  /// In en, this message translates to:
  /// **'Supplier verification details'**
  String get adminSupplierVerificationDetails;

  /// No description provided for @adminApproveSupplierVerificationQuestion.
  ///
  /// In en, this message translates to:
  /// **'Approve supplier verification?'**
  String get adminApproveSupplierVerificationQuestion;

  /// No description provided for @adminRequestChanges.
  ///
  /// In en, this message translates to:
  /// **'Request changes'**
  String get adminRequestChanges;

  /// No description provided for @adminApproveSupplierVerification.
  ///
  /// In en, this message translates to:
  /// **'Approve supplier verification'**
  String get adminApproveSupplierVerification;

  /// No description provided for @sectionLearningSpotlightTitle.
  ///
  /// In en, this message translates to:
  /// **'Learning spotlight'**
  String get sectionLearningSpotlightTitle;

  /// No description provided for @sectionLearningSpotlightSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Start with project guides built from real reusable materials.'**
  String get sectionLearningSpotlightSubtitle;

  /// No description provided for @sectionLearningSpotlightEmpty.
  ///
  /// In en, this message translates to:
  /// **'No learning projects published yet'**
  String get sectionLearningSpotlightEmpty;

  /// No description provided for @sectionLearningSpotlightEmptyDescription.
  ///
  /// In en, this message translates to:
  /// **'When learning projects are published, featured guides will appear here.'**
  String get sectionLearningSpotlightEmptyDescription;

  /// No description provided for @sectionHomeSuggestedMaterialsTitle.
  ///
  /// In en, this message translates to:
  /// **'Suggested materials'**
  String get sectionHomeSuggestedMaterialsTitle;

  /// No description provided for @sectionHomeSuggestedMaterialsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'A few currently listed materials to help you start.'**
  String get sectionHomeSuggestedMaterialsSubtitle;

  /// No description provided for @sectionHomeSuggestedMaterialsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No materials available yet'**
  String get sectionHomeSuggestedMaterialsEmpty;

  /// No description provided for @sectionHomeSuggestedMaterialsEmptyDescription.
  ///
  /// In en, this message translates to:
  /// **'When suppliers list reusable materials, a small set will appear here.'**
  String get sectionHomeSuggestedMaterialsEmptyDescription;

  /// No description provided for @completeLearnerProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete your learner profile'**
  String get completeLearnerProfileTitle;

  /// No description provided for @completeLearnerProfileSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Help us personalize projects and material recommendations.'**
  String get completeLearnerProfileSubtitle;

  /// No description provided for @registerLearnerProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Learner profile'**
  String get registerLearnerProfileTitle;

  /// No description provided for @registerSupplierProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Supplier profile'**
  String get registerSupplierProfileTitle;

  /// No description provided for @registerBothProfilesHint.
  ///
  /// In en, this message translates to:
  /// **'You will complete learner and supplier details in the next steps.'**
  String get registerBothProfilesHint;

  /// No description provided for @registerFullNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get registerFullNameLabel;

  /// No description provided for @registerYourNameHint.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get registerYourNameHint;

  /// No description provided for @registerFullNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Full name is required'**
  String get registerFullNameRequired;

  /// No description provided for @registerEmailAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Email address'**
  String get registerEmailAddressLabel;

  /// No description provided for @registerPhoneOptionalLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone number (optional)'**
  String get registerPhoneOptionalLabel;

  /// No description provided for @registerConfirmPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Confirm password is required'**
  String get registerConfirmPasswordRequired;

  /// No description provided for @registerLearnerTypeTitle.
  ///
  /// In en, this message translates to:
  /// **'Learner type'**
  String get registerLearnerTypeTitle;

  /// No description provided for @registerSkillLevelTitle.
  ///
  /// In en, this message translates to:
  /// **'Skill level'**
  String get registerSkillLevelTitle;

  /// No description provided for @registerReviewAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get registerReviewAccount;

  /// No description provided for @registerReviewIntent.
  ///
  /// In en, this message translates to:
  /// **'Intent'**
  String get registerReviewIntent;

  /// No description provided for @registerReviewName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get registerReviewName;

  /// No description provided for @registerReviewInterests.
  ///
  /// In en, this message translates to:
  /// **'Interests'**
  String get registerReviewInterests;

  /// No description provided for @registerReviewGoals.
  ///
  /// In en, this message translates to:
  /// **'Goals'**
  String get registerReviewGoals;

  /// No description provided for @registerReviewLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get registerReviewLocation;

  /// No description provided for @registerReviewLearnerType.
  ///
  /// In en, this message translates to:
  /// **'Learner type'**
  String get registerReviewLearnerType;

  /// No description provided for @registerReviewSkillLevel.
  ///
  /// In en, this message translates to:
  /// **'Skill level'**
  String get registerReviewSkillLevel;

  /// No description provided for @registerInterestsOptionalLabel.
  ///
  /// In en, this message translates to:
  /// **'Interests (optional)'**
  String get registerInterestsOptionalLabel;

  /// No description provided for @registerBioOptionalLabel.
  ///
  /// In en, this message translates to:
  /// **'Bio (optional)'**
  String get registerBioOptionalLabel;

  /// No description provided for @registerSkillLevelHelper.
  ///
  /// In en, this message translates to:
  /// **'How comfortable are you with building learning projects?'**
  String get registerSkillLevelHelper;

  /// No description provided for @registerLearnerTypeRequired.
  ///
  /// In en, this message translates to:
  /// **'Learner type is required'**
  String get registerLearnerTypeRequired;

  /// No description provided for @registerSkillLevelRequired.
  ///
  /// In en, this message translates to:
  /// **'Skill level is required'**
  String get registerSkillLevelRequired;

  /// No description provided for @registerSelectLearnerType.
  ///
  /// In en, this message translates to:
  /// **'Select your learner type'**
  String get registerSelectLearnerType;

  /// No description provided for @registerSelectSkillLevel.
  ///
  /// In en, this message translates to:
  /// **'Select your skill level'**
  String get registerSelectSkillLevel;

  /// No description provided for @registerBioHint.
  ///
  /// In en, this message translates to:
  /// **'Tell others a little about your learning goals'**
  String get registerBioHint;

  /// No description provided for @registerSupplierNextHint.
  ///
  /// In en, this message translates to:
  /// **'Next, we\'\'ll help you set up your supplier profile too.'**
  String get registerSupplierNextHint;

  /// No description provided for @authLearnLabel.
  ///
  /// In en, this message translates to:
  /// **'Learn'**
  String get authLearnLabel;

  /// No description provided for @authReuseLabel.
  ///
  /// In en, this message translates to:
  /// **'Reuse'**
  String get authReuseLabel;

  /// No description provided for @authBuildLabel.
  ///
  /// In en, this message translates to:
  /// **'Build'**
  String get authBuildLabel;

  /// No description provided for @authMaterialsReusedLabel.
  ///
  /// In en, this message translates to:
  /// **'Materials reused'**
  String get authMaterialsReusedLabel;

  /// No description provided for @authProjectsLaunchedLabel.
  ///
  /// In en, this message translates to:
  /// **'Projects launched'**
  String get authProjectsLaunchedLabel;

  /// No description provided for @authRegistrationMovedTitle.
  ///
  /// In en, this message translates to:
  /// **'Registration has moved'**
  String get authRegistrationMovedTitle;

  /// No description provided for @authRegistrationMovedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'ImpactLoop now completes sign-up in one place. Redirecting you to the registration wizard…'**
  String get authRegistrationMovedSubtitle;

  /// No description provided for @authBrandTitle.
  ///
  /// In en, this message translates to:
  /// **'ImpactLoop'**
  String get authBrandTitle;

  /// No description provided for @authOnboardingStorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Join a reuse loop where learners find materials, suppliers share surplus, and practical projects become easier to build.'**
  String get authOnboardingStorySubtitle;

  /// No description provided for @authOnboardingBenefitFindNearby.
  ///
  /// In en, this message translates to:
  /// **'Find useful materials nearby'**
  String get authOnboardingBenefitFindNearby;

  /// No description provided for @authOnboardingBenefitShareSurplus.
  ///
  /// In en, this message translates to:
  /// **'Share surplus instead of wasting it'**
  String get authOnboardingBenefitShareSurplus;

  /// No description provided for @authOnboardingBenefitBuildPractical.
  ///
  /// In en, this message translates to:
  /// **'Build practical projects with less cost'**
  String get authOnboardingBenefitBuildPractical;

  /// No description provided for @homeSuggestedMaterialsLoadError.
  ///
  /// In en, this message translates to:
  /// **'Unable to load suggested materials'**
  String get homeSuggestedMaterialsLoadError;

  /// No description provided for @homeSuggestedMaterialsLoadErrorSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The home page is still available. Try again when the materials API is running.'**
  String get homeSuggestedMaterialsLoadErrorSubtitle;

  /// No description provided for @homeLearningSpotlightLoadError.
  ///
  /// In en, this message translates to:
  /// **'Unable to load learning projects'**
  String get homeLearningSpotlightLoadError;

  /// No description provided for @homeLearningSpotlightLoadErrorSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The home page is still available. Try again when the Learning Hub API is running.'**
  String get homeLearningSpotlightLoadErrorSubtitle;

  /// No description provided for @learningProjectCreator.
  ///
  /// In en, this message translates to:
  /// **'Project creator'**
  String get learningProjectCreator;

  /// No description provided for @learningViewProfile.
  ///
  /// In en, this message translates to:
  /// **'View profile'**
  String get learningViewProfile;

  /// No description provided for @learningViewCreatorProfile.
  ///
  /// In en, this message translates to:
  /// **'View the public profile for {name}'**
  String learningViewCreatorProfile(String name);

  /// No description provided for @learningSearchProjectsHint.
  ///
  /// In en, this message translates to:
  /// **'Search by title, summary, component, or creator'**
  String get learningSearchProjectsHint;

  /// No description provided for @publicUserPublishedProjects.
  ///
  /// In en, this message translates to:
  /// **'Published projects'**
  String get publicUserPublishedProjects;

  /// No description provided for @publicUserNoPublishedProjects.
  ///
  /// In en, this message translates to:
  /// **'No published projects yet'**
  String get publicUserNoPublishedProjects;

  /// No description provided for @publicUserNoPublishedProjectsBody.
  ///
  /// In en, this message translates to:
  /// **'This user has not published any public projects yet.'**
  String get publicUserNoPublishedProjectsBody;

  /// No description provided for @publicUserSupplierActivity.
  ///
  /// In en, this message translates to:
  /// **'Supplier activity'**
  String get publicUserSupplierActivity;

  /// No description provided for @publicUserViewSupplierProfile.
  ///
  /// In en, this message translates to:
  /// **'View supplier profile'**
  String get publicUserViewSupplierProfile;

  /// No description provided for @publicUserAvailableMaterials.
  ///
  /// In en, this message translates to:
  /// **'{count} available materials'**
  String publicUserAvailableMaterials(int count);

  /// No description provided for @publicRoleLearner.
  ///
  /// In en, this message translates to:
  /// **'Learner'**
  String get publicRoleLearner;

  /// No description provided for @publicRoleSupplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get publicRoleSupplier;

  /// No description provided for @publicUserProfileUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Profile unavailable'**
  String get publicUserProfileUnavailable;

  /// No description provided for @publicUserProfileUnavailableBody.
  ///
  /// In en, this message translates to:
  /// **'This public profile may no longer be available.'**
  String get publicUserProfileUnavailableBody;
}
