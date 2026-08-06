import 'package:flutter/material.dart';

import '../../../../core/format/nis_price_format.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../../l10n/app_localizations_en.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/material_ui_labels.dart';
import '../../data/models/supplier_action_notification.dart';
import '../../data/models/supplier_category_demand.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../theme/supplier_locale_scope.dart';

/// Supplier Portal UI strings bridged to [AppLocalizations].
class SupplierL10n {
  SupplierL10n(this._l10n);

  final AppLocalizations _l10n;

  MaterialUiLabels get _materialLabels => MaterialUiLabels(_l10n);

  bool get isArabic => _l10n.localeName.startsWith('ar');

  static SupplierL10n of(BuildContext context, [String? languageCode]) {
    final code =
        languageCode ??
        SupplierLocaleScope.maybeOf(context)?.languageCode ??
        Localizations.localeOf(context).languageCode;
    return SupplierL10n(lookupAppLocalizations(Locale(code)));
  }

  /// Test helper for localization assertions without a BuildContext.
  @visibleForTesting
  static SupplierL10n forLanguage(String languageCode) {
    final code = languageCode.toLowerCase();
    final l10n = code.startsWith('ar')
        ? AppLocalizationsAr()
        : AppLocalizationsEn();
    return SupplierL10n(l10n);
  }

  String t(String en, String ar) => isArabic ? ar : en;

  // —— Brand / shell ——
  String get brandName => _l10n.appTitle;
  String get supplierRole => _l10n.supplier;
  String get supplierFallbackName => _l10n.supplier;
  String get supplierRoleSubtitle => _l10n.supplierSupplierRole;

  // —— Navigation ——
  String get navOverview => _l10n.supplierOverview;
  String get navHome => _l10n.home;
  String get navMyMaterials => _l10n.supplierMyMaterials;
  String get navMaterialsShort => _l10n.materials;
  String get navAddMaterial => _l10n.supplierAddMaterial;
  String get navAddShort => _l10n.supplierAdd;
  String get navIncomingRequests => _l10n.supplierIncomingRequests;
  String get navRequestsShort => _l10n.supplierRequests;
  String get navPickupSchedule => _l10n.supplierPickupSchedule;
  String get navLearnerMaterialRequests => t(
        'Learner Material Requests',
        'طلبات المواد من المتعلمين',
      );
  String get navBrowseMaterials => _l10n.browseMaterialsAction;
  String get navNotifications => _l10n.notificationsTitle;
  String get navProfile => _l10n.profile;
  String get navPortalFallback => _l10n.supplierSupplierPortal;

  // —— Settings ——
  String get themeLabel => _l10n.supplierTheme;
  String get themeSystem => _l10n.themeSystem;
  String get themeLight => _l10n.themeLight;
  String get themeDark => _l10n.themeDark;

  // —— Profile popover ——
  String get viewSupplierProfile => _l10n.supplierViewSupplierProfile;
  String get logout => _l10n.logout;

  // —— Page subtitles ——
  String get subtitleOverview => _l10n.supplierTrackMaterialsRequestsAndImpact;
  String get subtitleAddMaterial =>
      _l10n.supplierListSurplusMaterialsForReuseBy;
  String get subtitleProfile =>
      _l10n.supplierManagePublicSupplierDetailsAndPickup;
  String get subtitleIncomingRequests =>
      _l10n.supplierReviewLearnerRequestsAndSchedulePickups;
  String get subtitlePickupSchedule =>
      _l10n.supplierTrackAcceptedPickupsAndUpcomingHandovers;
  String get subtitleNotifications =>
      _l10n.supplierReviewUpdatesAndActionsThatNeed;
  String get subtitleComingSoon => _l10n.supplierComingSoonInTheSupplierPortal;
  String get subtitleDefault => _l10n.supplierManageYourSupplierActivity;

  String get subtitleMyMaterials =>
      _l10n.supplierManageYourListedSurplusMaterials;

  String get myMaterialsTitle => navMyMaterials;
  String get myMaterialsSubtitle => subtitleMyMaterials;
  String get myMaterialsSearchHint => _l10n.supplierSearchYourMaterials;
  String get myMaterialsStatTotal => _l10n.supplierTotal;
  String get myMaterialsStatAvailable => _l10n.available;
  String get myMaterialsStatPendingReserved => _l10n.supplierPendingReserved;
  String get myMaterialsStatReused => _l10n.reused;
  String get myMaterialsStatUnavailable => _l10n.supplierUnavailable2;
  String get myMaterialsEmptyTitle =>
      _l10n.supplierYouHaveNotListedAnyMaterials;
  String get myMaterialsEmptySubtitle =>
      _l10n.supplierShareSurplusMaterialsWithLearnersAnd;
  String get myMaterialsEmptyCta => _l10n.supplierAddYourFirstMaterial;
  String get myMaterialsLoadError => _l10n.supplierWeCouldNotLoadYourMaterials;
  String get myMaterialsFilteredEmptyTitle =>
      _l10n.supplierNoMaterialsMatchYourFilters;
  String get myMaterialsFilteredEmptySubtitle =>
      _l10n.supplierTryClearingFiltersOrAdjustingYour;
  String get likesLabel => _l10n.supplierLikes;
  String get engagementSectionTitle => _l10n.supplierEngagement;
  String get activeDemandSectionTitle => _l10n.supplierActiveDemand;
  String get interestScoreSectionTitle => _l10n.supplierDemandInterestScore;
  String get reuseHistorySectionTitle => _l10n.supplierReuseHistory;
  String get reservationsSectionTitle =>
      _l10n.supplierReservationsForThisMaterial;
  String get demandSectionTitle => _l10n.supplierDemandIndicators;
  String get noMaterialReservationsYet =>
      _l10n.supplierNoReservationsForThisMaterialYet;
  String get noDemandSignalsYet => _l10n.supplierNoDemandSignalsYet;
  String get noActiveRequestsAlreadyReused =>
      _l10n.supplierNoActiveRequestsRightNowThis;
  String get materialHasActiveDemand =>
      _l10n.supplierThisMaterialHasActiveDemand;
  String get interestWithoutReservations =>
      _l10n.supplierLearnersAreShowingInterestButNo;
  String get noActiveDemandYet => _l10n.supplierNoActiveDemandYet;
  String get activeDemandLabel => _l10n.supplierActiveDemand;
  String get activeDemandScoreLabel => _l10n.supplierActiveDemandScore;
  String get overallDemandScoreLabel => _l10n.supplierOverallDemandScore;
  String overallDemandScoreValue(int percent) =>
      _l10n.supplierPercent('$percent');
  String get demandScoreExplanation =>
      _l10n.supplierBasedOnViewsLikesActiveRequests;
  String get completedReservationsMetricLabel =>
      _l10n.supplierCompletedReservations;
  String get completedReusesMetricLabel => _l10n.supplierCompletedReuses;
  String get lastCompletedLabel => _l10n.supplierLastCompleted;
  String materialDemandStatusMessage({
    required int activeRequestsCount,
    required int completedReservationsCount,
    required int demandScorePercent,
    required int viewsCount,
    required int likesCount,
  }) {
    if (activeRequestsCount > 0) {
      return materialHasActiveDemand;
    }

    if (completedReservationsCount > 0) {
      return noActiveRequestsAlreadyReused;
    }

    if ((viewsCount > 0 || likesCount > 0) &&
        completedReservationsCount == 0 &&
        demandScorePercent > 0) {
      return interestWithoutReservations;
    }

    return noDemandSignalsYet;
  }

  String get markUnavailableAction => _l10n.supplierMarkUnavailable;
  String get restoreAvailableAction => _l10n.supplierRestoreAvailable;
  String materialRequestsBadge(int count) =>
      _l10n.supplierMaterialRequestsBadge(count);
  String get highDemandBadge => _l10n.supplierHighDemand;
  String get openReservationActionLabel => _l10n.supplierOpenReservation;
  String get pendingReservationsLabel => _l10n.supplierPendingReservations;
  String get reservedReservationsLabel => _l10n.supplierReservedReservations;
  String get totalActiveRequestsLabel => _l10n.supplierTotalActiveRequests;
  String get demandScoreLabel => _l10n.supplierDemandScore;
  String materialsResultCount(int count) =>
      _l10n.supplierMaterialsResultCount(count);
  String get filterAvailable => _l10n.available;
  String get filterPending => _l10n.filterPending;
  String get filterReserved => _l10n.reserved;
  String get filterReused => _l10n.reused;
  String get filterUnavailable => _l10n.supplierUnavailable2;
  String get filterAllPrices => _l10n.supplierAllPrices;
  String get filterStatusLabel => _l10n.supplierStatus;
  String get filterPriceLabel => _l10n.supplierPrice;
  String get filterCategory => _l10n.draftCategoryLabel;
  String get filterAllCategories => _l10n.supplierAllCategories;
  String get manageMaterial => _l10n.supplierManage;
  String get editListing => _l10n.supplierEdit;
  String get editMaterialTitle => _l10n.supplierEditMaterial;
  String get editMaterialSubtitle =>
      _l10n.supplierUpdateSafeListingDetailsPriceAnd;
  String get editMaterialReadOnlyHelper =>
      _l10n.supplierPriceCategoryLocationAndImagesAre;
  String get materialUpdatedSuccess =>
      _l10n.supplierMaterialUpdatedSuccessfully;
  String get materialUpdateFailed =>
      _l10n.supplierCouldNotUpdateMaterialPleaseTry;
  String get deleteMaterial => _l10n.supplierDelete;
  String get deleteMaterialTitle => _l10n.supplierDeleteMaterial;
  String get deleteMaterialBody => _l10n.supplierThisWillRemoveTheMaterialFrom;
  String get deleteMaterialConfirm => _l10n.supplierDelete;
  String get materialDeletedSuccess =>
      _l10n.supplierMaterialDeletedSuccessfully;
  String get deleteMaterialFailed =>
      _l10n.supplierCouldNotDeleteMaterialPleaseTry;
  String get deleteMaterialBlockedReused =>
      _l10n.supplierReusedMaterialsCannotBeDeletedBecause;
  String get deleteMaterialBlockedActiveRequests =>
      _l10n.supplierCannotDeleteAMaterialWithActive;
  String get deleteMaterialBlockedDefault =>
      _l10n.supplierThisMaterialCannotBeDeletedRight;
  String get editMaterialBlockedReused =>
      _l10n.supplierReusedMaterialsCannotBeEditedBecause;
  String get editMaterialBlockedActiveRequests =>
      _l10n.supplierCannotEditAMaterialWithActive;
  String get editMaterialBlockedDefault =>
      _l10n.supplierThisMaterialCannotBeEditedRight;
  String get editMaterialBlockedTitle => _l10n.supplierEditingNotAvailable;
  String get saveChanges => _l10n.supplierSaveChanges;
  String get readOnlyLabel => _l10n.supplierReadOnly;
  String get materialTypeLabel => _l10n.supplierMaterialType;
  String get pickupNotesLabel => pickupNotes;
  String get suggestedUsesLabel => suggestedUses;
  String get editListingComingSoon => _l10n.supplierEditingListingsIsComingSoon;
  String get previousPage => _l10n.supplierPrevious;
  String get nextPage => _l10n.supplierNext;
  String paginationLabel(int page, int totalPages) =>
      _l10n.supplierPagePageOfTotalpages('$page', '$totalPages');
  String listedOn(String date) => _l10n.supplierListedDate(date);
  String get materialNotFoundTitle => _l10n.supplierMaterialNotFound;
  String get materialNotFoundSubtitle =>
      _l10n.supplierThisListingMayHaveBeenRemoved;
  String get backToMyMaterials => _l10n.supplierBackToMyMaterials;
  String get viewsLabel => _l10n.supplierViews;
  String get createdLabel => _l10n.supplierCreated;
  String get updatedLabel => _l10n.supplierUpdated;

  String pageTitle(String location) {
    if (location == '/supplier/materials/new') return navAddMaterial;
    if (location == '/supplier' || location == '/supplier/') return navOverview;
    if (location == '/supplier/profile') {
      return _l10n.supplierSupplierProfile;
    }
    if (location == '/supplier/reservations' ||
        location.startsWith('/supplier/reservations/')) {
      return navIncomingRequests;
    }
    if (location == '/supplier/pickup-schedule' ||
        location.startsWith('/supplier/pickup-schedule/')) {
      return navPickupSchedule;
    }
    if (location == '/supplier/notifications' ||
        location.startsWith('/supplier/notifications/')) {
      return navNotifications;
    }
    if (location == '/supplier/materials') return navMyMaterials;
    if (location.endsWith('/edit') &&
        location.startsWith('/supplier/materials/')) {
      return editMaterialTitle;
    }
    if (location.startsWith('/supplier/materials')) return navMyMaterials;
    if (location.startsWith('/supplier/material-requests')) {
      return navLearnerMaterialRequests;
    }
    return navPortalFallback;
  }

  String pageSubtitle(String location) {
    if (location == '/supplier/materials/new') return subtitleAddMaterial;
    if (location == '/supplier' || location == '/supplier/') {
      return subtitleOverview;
    }
    if (location == '/supplier/profile') return subtitleProfile;
    if (location == '/supplier/reservations' ||
        location.startsWith('/supplier/reservations/')) {
      return subtitleIncomingRequests;
    }
    if (location == '/supplier/pickup-schedule' ||
        location.startsWith('/supplier/pickup-schedule/')) {
      return subtitlePickupSchedule;
    }
    if (location == '/supplier/notifications' ||
        location.startsWith('/supplier/notifications/')) {
      return subtitleNotifications;
    }
    if (location == '/supplier/materials') return subtitleMyMaterials;
    if (location.endsWith('/edit') &&
        location.startsWith('/supplier/materials/')) {
      return editMaterialSubtitle;
    }
    if (location.startsWith('/supplier/material-requests')) {
      return learnerMaterialRequestsSubtitle;
    }
    return subtitleDefault;
  }

  // —— Common actions ——
  String get tryAgain => _l10n.tryAgainAction;
  String get save => _l10n.save;
  String get cancel => _l10n.supplierCancel;
  String get back => _l10n.supplierBack;
  String get backToDashboard => _l10n.supplierBackToDashboard;
  String get backToHome => _l10n.backToHome;
  String get accept => _l10n.supplierAccept;
  String get decline => _l10n.supplierDecline;
  String get loading => _l10n.supplierLoading;
  String get required => _l10n.supplierRequired;
  String get optional => _l10n.supplierOptional;
  String get free => _l10n.free;
  String get paid => _l10n.paid;
  String get comingSoon => _l10n.supplierComingSoon;

  // —— Dashboard ——
  String get dashboardWelcome => _l10n.welcomeBack;
  String dashboardWelcomeName(String name) =>
      _l10n.supplierWelcomeBackName(name);
  String get dashboardHeroSubtitle =>
      _l10n.supplierTrackYourMaterialsRespondToRequests;
  String get addMaterial => _l10n.supplierAddMaterial2;
  String get viewRequests => _l10n.supplierViewRequests;
  String get statActiveMaterials => _l10n.supplierActiveMaterials;
  String get statPendingRequests => _l10n.supplierPendingRequests;
  String get statScheduledPickups => _l10n.supplierScheduledPickups;
  String get statReusedMaterials => _l10n.supplierReusedMaterials;
  String get statTotalMaterials => _l10n.supplierTotalMaterials;
  String get statAvailableMaterials => _l10n.supplierAvailableMaterials;
  String get statReservedMaterials => _l10n.supplierReservedMaterials;
  String get statTotalViews => statTotalMaterialViews;
  String get statTotalLikes => statTotalMaterialLikes;
  String get statTotalMaterialViews => _l10n.supplierTotalMaterialViews;
  String get statTotalMaterialLikes => _l10n.supplierTotalMaterialLikes;
  String get statFollowers => _l10n.supplierFollowers;
  String get recentReservationRequestsTitle =>
      _l10n.supplierRecentReservationRequests;
  String get noReservationRequestsYet => _l10n.supplierNoReservationRequestsYet;
  String get mostViewedMaterialTitle => _l10n.supplierMostViewedMaterial;
  String get supplierEngagementTitle => _l10n.supplierSupplierEngagement;
  String get engagementTotalsLabel => _l10n.supplierAccountTotals;
  String get noViewedMaterialsYet => _l10n.supplierNoViewedMaterialsYet;
  String get highDemandMaterialsTitle => _l10n.supplierHighDemandMaterials;
  String get highDemandMaterialsSubtitle =>
      _l10n.supplierMaterialsWithActiveReservationInterest;
  String get noHighDemandMaterialsYet => _l10n.supplierNoHighDemandMaterialsYet;
  String activeRequestsLabel(int count) =>
      _l10n.supplierActiveRequestsLabel(count);
  String get viewAllRequests => _l10n.supplierViewAllRequests;
  String get unknownRequester => _l10n.supplierUnknownLearner;
  String get operationsSnapshot => _l10n.supplierOperationsSnapshot;
  String reservationRequestMeta(
    String requester,
    String status,
    String date,
    double quantity,
  ) => _l10n.supplierRequesterStatusDateQtyQuantity(
    requester,
    status,
    date,
    quantity.toString(),
  );
  String viewsCountLabel(int count) =>
      _l10n.supplierCountViews(count.toString());
  String demandCountLabel(int demand, int views) =>
      _l10n.supplierDemandCountLabel(demand, views);
  String get selectConditionBeforePriceVerify =>
      _l10n.supplierSelectMaterialConditionBeforeVerifyingThe;
  String conditionAdjustedMaxMessage(
    String currencySymbol,
    String baseMax,
    String conditionLabel,
    String adjustedMax,
  ) => _l10n.supplierReferenceMaxCurrencysymbolBasemaxConditionConditionlabe(
    currencySymbol,
    baseMax,
    conditionLabel,
    adjustedMax,
  );
  String get strongDemandInsight =>
      _l10n.supplierSomeMaterialsAreGettingStrongDemand;
  String get improveEngagementInsight =>
      _l10n.supplierYourMaterialsAreGettingViewsImprove;
  String get addFirstMaterialInsight =>
      _l10n.supplierAddYourFirstMaterialToStart;
  String get reservationStatus => _l10n.supplierReservationStatus;
  String get materialsStatus => _l10n.supplierMaterialsStatus;
  String get quickActions => _l10n.quickActions;
  String get recentActivity => _l10n.supplierRecentActivity;
  String get recentActivitySubtitle =>
      _l10n.supplierCuratedHighlightsFromYourLatestOperations;
  String get viewAllActivity => _l10n.supplierViewAllActivity;
  String get actionableInsights => _l10n.supplierActionableInsights;
  String get actionableInsightsSubtitle =>
      _l10n.supplierRecommendedNextStepsBasedOnYour;
  String get requestsNeedAttention => _l10n.supplierRequestsNeedAttention;
  String pendingRequestsMessage(int count) =>
      _l10n.supplierPendingReservationsWaitingResponse(count);
  String get noPendingRequests => _l10n.supplierNoPendingRequestsRightNow;
  String get reviewRequests => _l10n.supplierReviewRequests;
  String get pickupReadiness => _l10n.supplierPickupReadiness;
  String get pickupLocationSet => _l10n.supplierPickupLocationIsSetSelfPickup;
  String get pickupLocationMissing =>
      _l10n.supplierAddOrConfirmYourPickupLocation;
  String get completeProfileForPickup =>
      _l10n.supplierCompleteYourSupplierProfileAndPickup;
  String get updateProfile => _l10n.supplierUpdateProfile;
  String get growReuse => _l10n.supplierGrowReuse;
  String get growReuseActiveListings =>
      _l10n.supplierYouHaveActiveListingsReadyFor;
  String get growReuseStarting =>
      _l10n.supplierReuseActivityIsStartingKeepMaterials;
  String get growReuseEmpty => _l10n.supplierListMaterialsToStartBuildingReuse;
  String get viewMaterials => _l10n.supplierViewMaterials;
  String get allCaughtUp => _l10n.supplierAllCaughtUpNewLearnerRequests;
  String get noRecentActivity => _l10n.supplierNoRecentActivityYet;
  String get addFirstMaterial => _l10n.supplierAddYourFirstMaterial;
  String get checkNotifications => _l10n.supplierCheckNotifications;
  String get openPickupSchedule => _l10n.supplierOpenPickupSchedule;
  String get editProfile => _l10n.supplierEditProfile;
  String get supplierHub => _l10n.supplierSupplierHub;
  String get heroTagline => _l10n.supplierShareUnusedPartsReduceWasteAnd;
  String pickupLine(String city, String? area) => area == null
      ? _l10n.supplierPickupCity(city)
      : _l10n.supplierPickupCityArea(city, area);
  String get noMaterialsListedYet => _l10n.supplierNoMaterialsListedYet;
  String get noMaterialsListedSubtitle =>
      _l10n.supplierStartBySharingUnusedPartsProject;
  String get completeSupplierProfileTitle =>
      _l10n.supplierCompleteYourSupplierProfile;
  String get completeSupplierProfileSubtitle =>
      _l10n.supplierAddYourPublicSupplierNameAnd;
  String get completeProfile => _l10n.supplierCompleteProfile;
  String get dashboardLoadError => _l10n.supplierWeCouldNotLoadYourSupplier;
  String get dashboardLoadErrorMessage =>
      _l10n.supplierPleaseCheckYourConnectionAndTry;
  String get reuseImpact => _l10n.supplierReuseImpact;
  String reusedMaterialsSummary(int count, String quantity) =>
      _l10n.supplierCountReusedQuantityUnits(count.toString(), quantity);
  String get reuseImpactNote =>
      _l10n.supplierImpactIsCalculatedFromCompletedReuse;
  String get projectImpactTitle => _l10n.supplierProjectImpact;
  String get projectImpactDescription =>
      _l10n.supplierYourMaterialsHelpedLearnersCompleteReal;
  String get projectImpactEmptyDescription =>
      _l10n.supplierYourCompletedProjectImpactWillAppear;
  String get projectImpactProjectsSupported => _l10n.supplierProjectsSupported;
  String get projectImpactComponentsCompleted =>
      _l10n.supplierComponentsCompleted;
  String get projectImpactLearnerBuildsHelped =>
      _l10n.supplierLearnerBuildsHelped;
  String get projectImpactRecentProjects =>
      _l10n.supplierRecentSupportedProjects;
  String get noReviewsYet => _l10n.supplierNoReviewsYet;
  String get ratingLabel => _l10n.supplierRating;
  String reviewsCount(int count) =>
      _l10n.supplierCountReviews(count.toString());
  String get materialLifecycle => _l10n.supplierMaterialLifecycle;
  String get lifecycleListed => _l10n.supplierListed;
  String get lifecycleAvailable => _l10n.available;
  String get lifecycleReserved => _l10n.reserved;
  String get lifecycleReused => _l10n.reused;

  // —— Category demand (SI-03) ——
  String get categoryDemandTitle =>
      t('Learner interest by category', 'اهتمام المتعلمين حسب الفئة');
  String get categoryDemandSubtitle => t(
        'Recent platform learner activity across material categories.',
        'نشاط المتعلمين الأخير على مستوى المنصة حسب فئات المواد.',
      );
  String get categoryDemandPeriodLabel =>
      t('Last 30 days', 'آخر 30 يومًا');
  String get categoryDemandLoadError => t(
        'Could not load category interest.',
        'تعذّر تحميل اهتمام الفئات.',
      );
  String get categoryDemandRetry => t('Retry', 'إعادة المحاولة');
  String get categoryDemandNoRecentActivity => t(
        'There is not enough recent learner activity to identify category trends.',
        'لا يوجد نشاط متعلمين حديث كافٍ لتحديد اتجاهات الفئات.',
      );
  String get categoryDemandNoActiveCategories => t(
        'No active material categories are currently available.',
        'لا توجد حالياً فئات مواد نشطة متاحة.',
      );
  String get categoryDemandUnknownLevel =>
      t('Interest level unavailable', 'مستوى الاهتمام غير متاح');
  String get categoryDemandUnknownReason =>
      t('Recent learner activity', 'نشاط متعلمين حديث');

  String categoryDemandLevelLabel(SupplierCategoryDemandLevel level) =>
      switch (level) {
        SupplierCategoryDemandLevel.high =>
          t('High interest', 'اهتمام مرتفع'),
        SupplierCategoryDemandLevel.moderate =>
          t('Moderate interest', 'اهتمام متوسط'),
        SupplierCategoryDemandLevel.emerging =>
          t('Emerging interest', 'اهتمام ناشئ'),
        SupplierCategoryDemandLevel.unknown => categoryDemandUnknownLevel,
      };

  String categoryDemandReason(SupplierCategoryDemandReason reason) =>
      switch (reason) {
        SupplierCategoryDemandReason.strongReservationActivity => t(
              'Strong activity from recent reservations',
              'نشاط قوي من الحجوزات الأخيرة',
            ),
        SupplierCategoryDemandReason.balancedEngagement => t(
              'Consistent activity across views, likes, and reservations',
              'نشاط متوازن عبر المشاهدات والإعجابات والحجوزات',
            ),
        SupplierCategoryDemandReason.likeEngagement => t(
              'Strong recent like activity',
              'نشاط إعجابات حديث قوي',
            ),
        SupplierCategoryDemandReason.viewEngagement => t(
              'Strong recent view activity',
              'نشاط مشاهدات حديث قوي',
            ),
        SupplierCategoryDemandReason.limitedRecentActivity => t(
              'Limited recent activity',
              'نشاط حديث محدود',
            ),
        SupplierCategoryDemandReason.unknown => categoryDemandUnknownReason,
      };

  String categoryDemandViewsChip(int count) =>
      t('$count views', '$count مشاهدة');
  String categoryDemandLikesChip(int count) =>
      t('$count likes', '$count إعجاب');
  String categoryDemandReservationsChip(int count) =>
      t('$count reservations', '$count حجز');

  String categoryDemandSummary(List<String> categoryNames) {
    final names = categoryNames
        .map((name) => name.trim())
        .where((name) => name.isNotEmpty)
        .take(3)
        .toList(growable: false);
    if (names.isEmpty) {
      return categoryDemandNoRecentActivity;
    }
    if (isArabic) {
      if (names.length == 1) {
        return 'تحظى فئة ${names[0]} بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.';
      }
      if (names.length == 2) {
        return 'تحظى فئتا ${names[0]} و${names[1]} بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.';
      }
      return 'تحظى فئات ${names[0]} و${names[1]} و${names[2]} بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.';
    }
    if (names.length == 1) {
      return '${names[0]} is receiving the strongest learner interest during the last 30 days.';
    }
    if (names.length == 2) {
      return '${names[0]} and ${names[1]} are receiving the strongest learner interest during the last 30 days.';
    }
    return '${names[0]}, ${names[1]}, and ${names[2]} are receiving the strongest learner interest during the last 30 days.';
  }

  // —— Related projects (SI-01) ——
  String get relatedProjectsTitle =>
      t('Related Projects', 'المشاريع ذات الصلة');
  String get relatedProjectsSubtitle => t(
        'Learning Hub projects that could use this material based on required components — not past handovers.',
        'مشاريع مركز التعلم التي يمكن أن تستخدم هذه المادة حسب المكوّنات المطلوبة — وليست عمليات التسليم السابقة.',
      );

  String relatedProjectsCountSummary(int count) {
    if (count == 1) {
      return t(
        'This material can be used in 1 project.',
        'يمكن استخدام هذه المادة في مشروع واحد.',
      );
    }
    return t(
      'This material can be used in $count projects.',
      'يمكن استخدام هذه المادة في $count مشاريع.',
    );
  }

  String get relatedProjectsEmpty => t(
        'No Learning Hub projects currently match this material.',
        'لا توجد حالياً مشاريع في مركز التعلم تطابق هذه المادة.',
      );
  String get relatedProjectsLoadError => t(
        'Could not load related projects.',
        'تعذّر تحميل المشاريع ذات الصلة.',
      );
  String get relatedProjectsRetry => t('Retry', 'إعادة المحاولة');
  String get relatedProjectsMatchedComponent =>
      t('Matched component', 'المكوّن المطابق');

  String relatedProjectsMatchReason(String code) => switch (code) {
        'EXACT_NAME' => t('Exact name match', 'تطابق تام للاسم'),
        'NAME_MATCH' => t('Name match', 'تطابق في الاسم'),
        'STRONG_MATCH' => t('Strong match', 'تطابق قوي'),
        'MATERIAL_TYPE_MATCH' =>
          t('Material type match', 'تطابق نوع المادة'),
        'CATEGORY_MATCH' => t('Category match', 'تطابق الفئة'),
        'KEYWORD_MATCH' => t('Keyword match', 'تطابق بالكلمات المفتاحية'),
        _ => t('Related match', 'تطابق ذو صلة'),
      };

  // —— Learner material requests ——
  String get learnerMaterialRequestsTitle => navLearnerMaterialRequests;
  String get learnerMaterialRequestsSubtitle => t(
        'Browse what learners are looking for and suggest a matching material.',
        'تصفح ما يبحث عنه المتعلمون واقترح مادة مطابقة.',
      );
  String get materialRequestsLoadError => t(
        'We could not load material requests.',
        'تعذّر تحميل طلبات المواد.',
      );
  String get materialRequestsEmptyTitle =>
      t('No material requests right now', 'لا توجد طلبات مواد حالياً');
  String get materialRequestsEmptySubtitle => t(
        'When learners ask for materials you might have, they will show up here.',
        'عندما يطلب المتعلمون مواداً قد تمتلكها، ستظهر هنا.',
      );
  String get materialRequestsFilteredEmptyTitle => t(
        'No requests match your filters',
        'لا توجد طلبات تطابق عوامل التصفية',
      );
  String get filterUnansweredByMe =>
      t('Not answered by me', 'لم أرد عليها بعد');
  String get learnerMaterialRequestsInsightTitle =>
      t('Learner material requests', 'طلبات مواد من المتعلمين');

  String learnerMaterialRequestsInsightMessage(int count) => t(
        'You have $count unanswered learner material request${count == 1 ? '' : 's'}.',
        count == 1
            ? 'لديك طلب مادة واحد من متعلم لم ترد عليه بعد.'
            : 'لديك $count طلبات مواد من متعلمين لم ترد عليها بعد.',
      );

  String get reviewLearnerMaterialRequests =>
      t('Review requests', 'مراجعة الطلبات');
  String get respondedBadge =>
      t('You suggested a material', 'اقترحت مادة');

  String materialRequestSuggestionsCount(int count) => t(
        '$count supplier${count == 1 ? '' : 's'} responded',
        count == 1 ? 'استجاب مورد واحد' : 'استجاب $count موردين',
      );

  String get materialRequestDetailsTitle =>
      t('Request details', 'تفاصيل الطلب');
  String get materialRequestLoadError => t(
        'Could not load this material request.',
        'تعذّر تحميل طلب المادة هذا.',
      );
  String get materialRequestPrivacyNote => t(
        "You can only see the item, category, quantity, and general area for this request — never the learner's exact address or contact details.",
        'يمكنك رؤية العنصر والفئة والكمية والمنطقة العامة فقط لهذا الطلب — ولن ترى عنوان المتعلم الدقيق أو بيانات التواصل أبداً.',
      );
  String get candidateMaterialsTitle =>
      t('Your matching materials', 'موادك المطابقة');
  String get candidateMaterialsEmpty => t(
        'None of your listed materials match this request yet.',
        'لا توجد أي من موادك المدرجة تطابق هذا الطلب حتى الآن.',
      );
  String get publishMatchingMaterial =>
      t('Publish matching material', 'نشر مادة مطابقة');
  String get suggestThisMaterial =>
      t('Suggest this material', 'اقتراح هذه المادة');
  String get suggestionSent =>
      t('Suggestion sent to the learner.', 'تم إرسال الاقتراح إلى المتعلم.');
  String get suggestionFailed => t(
        'Could not send this suggestion. Please try again.',
        'تعذّر إرسال هذا الاقتراح. يرجى المحاولة مرة أخرى.',
      );
  String get weakMatchTitle => t('Weak match', 'تطابق ضعيف');
  String get weakMatchMessage => t(
        'This material is only a weak match for the request. Suggest it anyway?',
        'هذه المادة تطابق الطلب بشكل ضعيف فقط. هل تريد اقتراحها على أي حال؟',
      );
  String get suggestAnyway => t('Suggest anyway', 'اقتراح على أي حال');
  String get alreadySuggestedLabel =>
      t('Already suggested', 'تم اقتراحها بالفعل');
  String get weakMatchBadge => t('Weak match', 'تطابق ضعيف');
  String get requestNoLongerOpen => t(
        'This request is no longer open.',
        'هذا الطلب لم يعد مفتوحاً.',
      );
  String get alternativesAllowedBadge =>
      t('Alternatives allowed', 'البدائل مسموحة');

  // —— Notifications ——
  String get notificationsTitle => navNotifications;
  String get actionNeeded => _l10n.supplierActionNeeded;
  String get filterAll => _l10n.filterAll;
  String get filterReservations => _l10n.reservations;
  String get filterCompleted => _l10n.supplierResolved;
  String get noNotificationsYet => _l10n.noNotifications;
  String noFilterNotifications(String filterLabel) =>
      _l10n.supplierNoFilterlabelNotifications(filterLabel);
  String get loadingNotifications => _l10n.notificationsLoading;
  String get notificationsLoadError =>
      _l10n.supplierWeCouldNotLoadNotifications;
  String get noActionAvailable => _l10n.supplierNoActionAvailableForThisItem;
  String get couldNotOpenListing => _l10n.supplierCouldNotOpenListingTryAgain;
  String notificationFilterLabel(SupplierNotificationFilter filter) {
    return switch (filter) {
      SupplierNotificationFilter.all => filterAll,
      SupplierNotificationFilter.actionNeeded => actionNeeded,
      SupplierNotificationFilter.reservations => filterReservations,
      SupplierNotificationFilter.completed => filterCompleted,
    };
  }

  String notificationStatusLabel(SupplierActionNotificationStatus status) {
    return switch (status) {
      SupplierActionNotificationStatus.approved => _l10n.supplierApproved,
      SupplierActionNotificationStatus.rejected => _l10n.statusRejected,
      SupplierActionNotificationStatus.pending => _l10n.filterPending,
    };
  }

  String notificationTypeLabel(SupplierActionNotificationKind kind) {
    if (kind == SupplierActionNotificationKind.reservationPending) {
      return _l10n.reservation;
    }
    if (kind.name.startsWith('price')) return _l10n.supplierPrice;
    return _l10n.draftCategoryLabel;
  }

  String get notificationCompleted => filterCompleted;
  String maxPriceLabel(double max, String unit) =>
      _l10n.supplierMaxFormatnisamountMaxNisUnit(formatNisAmount(max), unit);

  String get editListingAction => _l10n.supplierEditListing;
  String get editPriceAction => _l10n.supplierEditPrice;
  String get reviewRequestAction => _l10n.supplierReviewRequest;

  String notificationActionLabel(
    SupplierActionNotificationActionType? actionType, {
    String? fallback,
  }) {
    if (actionType != null) {
      return switch (actionType) {
        SupplierActionNotificationActionType.continueListing => continueListing,
        SupplierActionNotificationActionType.editListing => editListingAction,
        SupplierActionNotificationActionType.editPrice => editPriceAction,
        SupplierActionNotificationActionType.reviewRequest =>
          reviewRequestAction,
      };
    }
    return fallback ?? '';
  }

  String supplierNotificationActionLabel(
    SupplierNotificationActionType actionType, {
    String? labelKey,
  }) {
    if (labelKey != null && labelKey.trim().isNotEmpty) return labelKey;
    return switch (actionType) {
      SupplierNotificationActionType.reviewReservation => reviewRequestAction,
      SupplierNotificationActionType.openReservation =>
        _l10n.supplierOpenReservation,
      SupplierNotificationActionType.choosePickupWindow =>
        _l10n.supplierChoosePickupWindow,
      SupplierNotificationActionType.continueListing => continueListing,
      SupplierNotificationActionType.editListing => editListingAction,
      SupplierNotificationActionType.openMaterial => _l10n.supplierOpenMaterial,
      SupplierNotificationActionType.openProfile => _l10n.supplierOpenProfile,
      SupplierNotificationActionType.none ||
      SupplierNotificationActionType.unknown => noActionAvailable,
    };
  }

  String get heroChipSupplierActive => _l10n.supplierSupplierActive;
  String get heroChipPickupEnabled => _l10n.supplierPickupEnabled;
  String get heroChipNisListings => _l10n.supplierNisListings;
  String get chartReservationSubtitle =>
      _l10n.supplierPendingAcceptedAndCompletedRequests;
  String get chartMaterialsSubtitle =>
      _l10n.supplierInventoryBreakdownAcrossLifecycleStates;
  String get statHelperAcceptedPickups => _l10n.supplierAcceptedPickups;
  String get statHelperCompletedReuse => _l10n.supplierCompletedReuse;
  String get quickActionPickupCaption => _l10n.supplierAcceptedHandovers;
  String get reservationChartEmpty =>
      _l10n.supplierReservationActivityWillAppearHereOnce;
  String get materialsChartAvailable => _l10n.available;
  String get materialsChartReservedPending => _l10n.supplierReservedPending;
  String get materialsChartUnavailable => _l10n.supplierUnavailable2;
  String get materialsChartEmpty =>
      _l10n.supplierMaterialStatusBreakdownWillAppearAfter;
  String get recentActivityPendingTitle => _l10n.supplierPendingRequestWaiting;
  String get recentActivityNextPickup => _l10n.supplierNextScheduledPickup;
  String recentActivityAcceptedPickup(String name) =>
      _l10n.supplierAcceptedPickupWithName(name);
  String get recentActivityLatestReuse => _l10n.supplierLatestCompletedReuse;
  String get chooseSupplierType => _l10n.supplierChooseSupplierType;
  String get dragPhotosHint => _l10n.supplierChoosePhotosFromYourDevice;
  String get materialCouldNotBeListed => _l10n.supplierMaterialCouldNotBeListed;
  String get chooseCategoryFirst => _l10n.supplierChooseACategoryFirst;
  String get enterMaterialNameFirst => _l10n.supplierEnterAMaterialNameFirst;
  String get enterValidQuantityPrice =>
      _l10n.supplierEnterAValidQuantityAndPrice;
  String get priceReviewRequestFailed => _l10n.supplierPriceReviewRequestFailed;
  String get savedDraftNotFound => _l10n.supplierSavedListingDraftWasNotFound;
  String get categoryApprovedContinue =>
      _l10n.supplierCategoryApprovedContinueYourListing;
  String get continueEditingDraft =>
      _l10n.supplierContinueEditingYourSavedListingDraft;
  String get continueListingFromDraft =>
      _l10n.supplierContinueYourListingFromWhereYou;
  String get categoryRequestSubmittedWithApproval =>
      _l10n.supplierCategoryRequestSubmittedYourListingDraft;
  String get categoryRequestSubmitted =>
      _l10n.supplierCategoryRequestSubmittedYourListingDraft2;
  String get priceReviewSubmitted =>
      _l10n.supplierPriceReviewSubmittedAGeminiAssisted;
  String priceVerificationFailed(String error) =>
      _l10n.supplierPriceVerificationFailedError(error);
  String get submitPriceReview => _l10n.supplierSubmitPriceReview;
  String get clarifyMaterialName => _l10n.supplierPleaseClarifyTheMaterialName;
  String get didYouMeanThese => _l10n.supplierDidYouMeanOneOfThese;
  String matchedPriceReference(String label) =>
      _l10n.supplierMatchedPriceReferenceLabel(label);
  String maxAllowedUnitPriceMessage(
    String symbol,
    String price,
    String? unit,
  ) => unit == null
      ? _l10n.supplierMaximumAllowedUnitPriceSymbolPrice(symbol, price)
      : _l10n.supplierMaximumAllowedUnitPriceSymbolPrice2(symbol, price, unit);
  String approvedUnitLabel(String unit) => _l10n.supplierApprovedUnitUnit(unit);
  String get priceReviewRequiredMessage =>
      _l10n.supplierPriceReviewIsRequiredBeforePaid;
  String priceBlockedReason(String reason) => switch (reason) {
    'PRICE_TOO_HIGH' => _l10n.supplierPriceIsAboveTheAllowedLimit,
    _ => _l10n.supplierPriceBlocked,
  };
  String get myMaterialsPopover => _l10n.supplierMyMaterials2;
  String get incomingRequestsPopover => _l10n.supplierIncomingRequests2;
  String get statHelperVisibleToLearners =>
      _l10n.supplierCurrentlyVisibleToLearners;
  String get statHelperWaitingResponse => _l10n.supplierWaitingForYourResponse;
  String get statActionBadge => _l10n.supplierAction;
  String get totalLabel => _l10n.supplierTotal;
  String get pickupChip => _l10n.supplierPickup;
  String pendingRequestsNeedResponse(int count) =>
      _l10n.supplierCountRequestsNeedResponse(count);
  String completedReservationsSummary(int count) =>
      _l10n.supplierCountReservationsCompleted(count);
  String get quickActionListParts => _l10n.supplierListReusableParts;
  String get quickActionRespondLearners => _l10n.supplierRespondToLearners;
  String get quickActionUpdatesActions => _l10n.supplierUpdatesActions;
  String get signedOutLocallyMessage => _l10n.signedOutOffline;

  // —— Incoming requests ——
  String get incomingRequestsTitle => navIncomingRequests;
  String get loadingRequests => _l10n.supplierLoadingIncomingRequests;
  String get requestsLoadError => _l10n.supplierWeCouldNotLoadRequests;
  String get requestAccepted => _l10n.supplierRequestAccepted;
  String get requestAcceptFailed => _l10n.supplierCouldNotAcceptTheRequest;
  String get requestDeclined => _l10n.supplierRequestDeclined;
  String get requestDeclineFailed => _l10n.supplierCouldNotDeclineTheRequest;
  String get pickupCompleted => _l10n.supplierPickupMarkedAsCompleted;
  String get pickupCompleteFailed =>
      _l10n.supplierCouldNotMarkPickupAsCompleted;
  String get tabPending => _l10n.filterPending;
  String get tabAccepted => _l10n.statusAccepted;
  String get tabAwaitingConfirmation => _l10n.statusNeedsConfirmation;
  String get tabAll => _l10n.filterAll;
  String get tabNeedsLearner => _l10n.supplierNeedsLearner;
  String get tabCancelled => _l10n.statusCancelled;
  String get tabDeclined => _l10n.supplierDeclined;
  String get tabExpired => _l10n.statusExpiredNoResponse;
  String get tabCompleted => filterCompleted;
  String get noRequests => _l10n.supplierNoRequestsYet;
  String get noRequestsForFilter => _l10n.supplierNoRequestsMatchThisFilter;
  String get noPendingRequestsTitle => _l10n.supplierNoPendingRequests;
  String get noAcceptedPickupsTitle => _l10n.supplierNoAcceptedPickupsYet;
  String get noDeclinedRequestsTitle => _l10n.supplierNoDeclinedRequests;
  String get noCompletedPickupsTitle => _l10n.supplierNoCompletedPickupsYet;
  String get noPendingRequestsSubtitle =>
      _l10n.supplierNewLearnerRequestsWillAppearHere;
  String get noAcceptedPickupsSubtitle =>
      _l10n.supplierAcceptedRequestsWithPickupWindowsWill;
  String get noDeclinedRequestsSubtitle =>
      _l10n.supplierRequestsYouDeclineWillBeListed;
  String get noCompletedPickupsSubtitle =>
      _l10n.supplierFinishedPickupsWillAppearHere;
  String get noLearnerNote => _l10n.supplierNoLearnerNote;
  String get selfPickup => _l10n.supplierSelfPickup;
  String get delivery => _l10n.delivery;
  String pickupWindowLabel(String window) =>
      _l10n.supplierPickupWindow2(window);

  String incomingRequestTabLabel(SupplierIncomingRequestTab tab) =>
      switch (tab) {
        SupplierIncomingRequestTab.all => tabAll,
        SupplierIncomingRequestTab.pending => tabPending,
        SupplierIncomingRequestTab.needsLearner => tabNeedsLearner,
        SupplierIncomingRequestTab.accepted => tabAccepted,
        SupplierIncomingRequestTab.declined => tabDeclined,
        SupplierIncomingRequestTab.completed => tabCompleted,
        SupplierIncomingRequestTab.cancelled => tabCancelled,
      };

  String incomingRequestEmptyTitle(SupplierIncomingRequestTab tab) =>
      switch (tab) {
        SupplierIncomingRequestTab.all => noRequests,
        SupplierIncomingRequestTab.pending => noPendingRequestsTitle,
        SupplierIncomingRequestTab.needsLearner =>
          _l10n.supplierNoRequestsWaitingForLearner,
        SupplierIncomingRequestTab.accepted => noAcceptedPickupsTitle,
        SupplierIncomingRequestTab.declined => noDeclinedRequestsTitle,
        SupplierIncomingRequestTab.completed => noCompletedPickupsTitle,
        SupplierIncomingRequestTab.cancelled =>
          _l10n.supplierNoCancelledRequests,
      };

  String incomingRequestEmptySubtitle(SupplierIncomingRequestTab tab) =>
      switch (tab) {
        SupplierIncomingRequestTab.all => noPendingRequestsSubtitle,
        SupplierIncomingRequestTab.pending => noPendingRequestsSubtitle,
        SupplierIncomingRequestTab.needsLearner =>
          _l10n.supplierReservationsAwaitingLearnerConfirmationAppearHere,
        SupplierIncomingRequestTab.accepted => noAcceptedPickupsSubtitle,
        SupplierIncomingRequestTab.declined => noDeclinedRequestsSubtitle,
        SupplierIncomingRequestTab.completed => noCompletedPickupsSubtitle,
        SupplierIncomingRequestTab.cancelled =>
          _l10n.supplierCancelledReservationsWillAppearHere,
      };

  String incomingRequestStatusLabel(SupplierIncomingRequestStatus status) =>
      switch (status) {
        SupplierIncomingRequestStatus.pending => tabPending,
        SupplierIncomingRequestStatus.accepted => tabAccepted,
        SupplierIncomingRequestStatus.awaitingConfirmation =>
          tabAwaitingConfirmation,
        SupplierIncomingRequestStatus.awaitingSupplierConfirmation =>
          _l10n.statusWaitingSupplier,
        SupplierIncomingRequestStatus.declined => tabDeclined,
        SupplierIncomingRequestStatus.expired => tabExpired,
        SupplierIncomingRequestStatus.completed => tabCompleted,
        SupplierIncomingRequestStatus.cancelled => tabCancelled,
        SupplierIncomingRequestStatus.noShow => _l10n.statusLearnerNoShow,
        SupplierIncomingRequestStatus.fulfillmentFailed =>
          _l10n.statusFulfillmentFailed,
        SupplierIncomingRequestStatus.needsResolution =>
          _l10n.statusNeedsAdminReview,
      };

  // —— Pickup schedule ——
  String get loadingPickupSchedule => _l10n.supplierLoadingPickupSchedule;
  String get pickupScheduleLoadError =>
      _l10n.supplierWeCouldNotLoadPickupSchedule;
  String get noPickupsScheduled => _l10n.supplierNoPickupsScheduledYet;
  String get noPickupsForFilter => _l10n.supplierNoPickupsMatchThisFilter;
  String get markCompleted => _l10n.supplierMarkCompleted;
  String get viewDetails => _l10n.viewDetails;
  String get filterUpcoming => _l10n.supplierUpcoming;
  String get filterPast => _l10n.supplierPast;
  String get filterToday => _l10n.supplierToday;
  String get scheduleDone => _l10n.supplierDone;
  String get noPickupsToday => _l10n.supplierNoPickupsScheduledForToday;
  String get noUpcomingPickups => _l10n.supplierNoUpcomingPickups;
  String get noCompletedSchedulePickups => _l10n.supplierNoCompletedPickupsYet;
  String get noPickupScheduleYet => _l10n.supplierNoPickupScheduleYet;

  String pickupScheduleFilterLabel(SupplierPickupScheduleFilter filter) =>
      switch (filter) {
        SupplierPickupScheduleFilter.today => filterToday,
        SupplierPickupScheduleFilter.upcoming => filterUpcoming,
        SupplierPickupScheduleFilter.completed => tabCompleted,
        SupplierPickupScheduleFilter.all => filterAll,
      };

  String pickupScheduleEmptyMessage(SupplierPickupScheduleFilter filter) =>
      switch (filter) {
        SupplierPickupScheduleFilter.today => noPickupsToday,
        SupplierPickupScheduleFilter.upcoming => noUpcomingPickups,
        SupplierPickupScheduleFilter.completed => noCompletedSchedulePickups,
        SupplierPickupScheduleFilter.all => noPickupScheduleYet,
      };

  String pickupScheduleStatusLabel(SupplierPickupScheduleStatus status) =>
      switch (status) {
        SupplierPickupScheduleStatus.accepted => tabAccepted,
        SupplierPickupScheduleStatus.completed => tabCompleted,
      };

  // —— Profile ——
  String get createProfile => _l10n.supplierCreateYourProfile;
  String get editProfileTitle => _l10n.supplierEditProfile;
  String get editProfileSubtitle =>
      _l10n.supplierUpdateYourPublicIdentityAndPickup;
  String get profileIntro => _l10n.supplierUpdateHowLearnersDiscoverYouAnd;
  String get publicDetails => _l10n.supplierPublicSupplierDetails;
  String get publicDetailsSubtitle =>
      _l10n.supplierTheseDetailsAppearOnYourPublic;
  String get publicName => _l10n.supplierPublicSupplierName;
  String get publicNameHint => _l10n.supplierHowLearnersWillSeeYou;
  String get aboutMaterials => _l10n.supplierAboutYourMaterials;
  String get aboutMaterialsHint =>
      _l10n.supplierShareTheMaterialTypesYouUsually;
  String get defaultPickupArea => _l10n.supplierDefaultPickupArea;
  String get defaultPickupSubtitle => _l10n.supplierUseAGeneralPickupAreaExact;
  String get useCurrentLocation => _l10n.useCurrentLocation;
  String get enterManually => _l10n.supplierChooseManually;
  String get locationModeLabel => _l10n.supplierPickupLocationSelectionMethod;
  String get manualLocationInstructions =>
      _l10n.supplierEnterTheAddressDetailsOrMove;
  String get locationSelected => _l10n.supplierLocationSelected;
  String get gettingLocation => _l10n.gettingLocation;
  String get findingAddress => _l10n.supplierFindingAddress;
  String get refreshLocation => _l10n.supplierRefreshCurrentLocation;
  String get optionalAddressDetails => _l10n.supplierOptionalAddressDetails;
  String get coordinatesSourceOfTruth =>
      _l10n.supplierCoordinatesAreTheSourceOfTruth;
  String get country => _l10n.country;
  String countryDisplay(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized == 'palestine' || normalized == 'palestinian territories') {
      return _l10n.supplierPalestine;
    }
    return value.trim();
  }

  String get city => _l10n.city;
  String get area => _l10n.area;
  String get areaHint => _l10n.supplierNeighborhoodOrDistrict;
  String get addressLine => _l10n.supplierAddressLine;
  String get addressHint => _l10n.supplierStreetOrBuildingKeptPrivate;
  String get locationPrivacy => _l10n.supplierLocationPrivacy;
  String get locationPrivacySubtitle =>
      _l10n.supplierSetYourExactPickupLocationYour;
  String get locationVisibility => _l10n.supplierLocationVisibility;
  String get visibilityPublic => _l10n.supplierPublicArea;
  String get visibilityOrderOnly => _l10n.supplierOrderOnly;
  String get visibilityPrivate => _l10n.supplierPrivate;
  String get showApproximate => _l10n.supplierShowAsApproximate;
  String get showApproximateSubtitle =>
      _l10n.supplierLearnersSeeAGeneralAreaNot;
  String get organizationDetails => _l10n.supplierOrganizationDetails;
  String get organizationSubtitle =>
      _l10n.supplierForWorkshopsFactoriesAndEducationalInstitutions;
  String get organizationName => _l10n.supplierOrganizationName;
  String get organizationNameHint =>
      _l10n.supplierLegalOrPublicOrganizationName;
  String get contactPerson => _l10n.supplierContactPerson;
  String get contactPersonHint => _l10n.supplierOptionalContactName;
  String get saveProfile => _l10n.supplierSaveProfile;
  String get savingProfile => _l10n.supplierSaving;
  String get discardChanges => _l10n.supplierDiscardChanges;
  String get supplierProfileTitle => _l10n.supplierSupplierProfile;
  String get profileIntroHasProfile =>
      _l10n.supplierKeepYourPublicSupplierDetailsAccurate;
  String get profileIntroNoProfile =>
      _l10n.supplierCreateYourSupplierProfileSoLearners;
  String get profileUnavailable => _l10n.supplierProfileUnavailable;
  String get profileCouldNotSave => _l10n.supplierProfileCouldNotBeSaved;
  String get profileUpdated => _l10n.supplierSupplierProfileUpdated;
  String get captureLocationBeforeSave =>
      _l10n.supplierPleaseCaptureYourCurrentLocationBefore;
  String get couldNotGetLocation =>
      _l10n.supplierCouldNotGetCurrentLocationPlease;
  String get currentLocationLabel => _l10n.supplierCurrentLocation;
  String get addressFoundFromLocation =>
      _l10n.supplierWeFoundThisAddressFromYour;
  String get addressLookupFailed =>
      _l10n.supplierCurrentLocationCapturedButAddressLookup;
  String get locationCapturedOptionalDetails =>
      _l10n.supplierCurrentLocationCapturedYouCanOptionally;
  String get chooseVisibility => _l10n.supplierChooseVisibility;
  String get workingDays => _l10n.supplierWorkingDays;
  String get workingDaysHint => _l10n.supplierMonTueWed;
  String get openFrom => _l10n.supplierOpenFrom;
  String get openUntil => _l10n.supplierOpenUntil;
  String get separateBusinessLocation =>
      _l10n.supplierUseASeparateOrganizationAddress;
  String get separateBusinessLocationSubtitle =>
      _l10n.supplierEnableThisWhenYourOrganizationAddress;
  String get businessCountry => _l10n.supplierBusinessCountry;
  String get businessCity => _l10n.supplierBusinessCity;
  String get businessArea => _l10n.supplierBusinessArea;
  String get businessAddressLine => _l10n.supplierBusinessAddressLine;
  String get countryOptionalLabel => _l10n.supplierCountryOptional;
  String get cityOptionalLabel => _l10n.supplierCityOptional;
  String get areaOptionalLabel => _l10n.supplierAreaOptional;
  String get addressLineOptionalLabel => _l10n.supplierAddressLineOptional;
  String get optionalNeighborhoodOrDistrict =>
      _l10n.supplierOptionalNeighborhoodOrDistrict;
  String get optionalStreetOrBuilding => _l10n.supplierOptionalStreetOrBuilding;

  // —— Add material (UI labels only) ——
  String get completeProfileFirst =>
      _l10n.supplierCompleteYourSupplierProfileFirst;
  String get completeProfileFirstMessage =>
      _l10n.supplierSupplierDetailsAreRequiredBeforeYou;
  String get goToProfile => _l10n.supplierGoToSupplierProfile;
  String get setPickupLocation =>
      _l10n.supplierSetYourPickupLocationBeforeListing;
  String get setPickupLocationMessage =>
      _l10n.supplierPickupLocationComesFromYourSupplier;
  String get editSupplierProfile => _l10n.supplierEditSupplierProfile;
  String get categoriesUnavailable =>
      _l10n.supplierMaterialCategoriesAreUnavailable;
  String get categoriesUnavailableMessage =>
      _l10n.supplierPleaseTryAgainAfterTheBackend;
  String get profileLoadError => _l10n.supplierSupplierProfileCouldNotLoad;
  String get profileLoadErrorMessage =>
      _l10n.supplierPleaseRefreshOrCompleteYourProfile;
  String get listingSectionTitle => _l10n.supplierWhatAreYouListing;
  String get listingSectionSubtitle =>
      _l10n.supplierDescribeTheSurplusMaterialClearly;
  String get materialName => _l10n.supplierMaterialTypeName;
  String get materialNameHint => _l10n.supplierWaxMoldsArduinoUnoFabricScraps;
  String get materialNameHelper => _l10n.supplierUseTheCommonMaterialTypeOr;
  String get chooseCategoryFirstToSearchReviewedMaterialTypes =>
      _l10n.supplierChooseACategoryFirstToSearch;
  String get noMaterialTypeResults =>
      _l10n.supplierNoReviewedMaterialTypesFoundFree;
  String get reviewedPriceAvailable => _l10n.supplierReviewedPriceAvailable;
  String get noReviewedPrice => _l10n.supplierNoReviewedPrice;
  String get paidListingsNeedReviewedMaterialType =>
      _l10n.supplierPaidListingsNeedAReviewedMaterial;
  String materialTypeAliases(String aliases) =>
      _l10n.supplierAliasesAliases(aliases);
  String get listingTitle => _l10n.supplierListingTitle;
  String get listingTitleHint => _l10n.supplierUsedWaxMolds8Pieces;
  String get description => _l10n.supplierDescription;
  String get descriptionHint =>
      _l10n.supplierDescribeConditionQuantityAndWhatIs;
  String get sourceType => _l10n.sourceType;
  String get chooseSource => _l10n.supplierChooseSource;
  String get condition => _l10n.supplierCondition;
  String get chooseCondition => _l10n.supplierChooseCondition;
  String get suggestedUses => _l10n.supplierSuggestedUses;
  String get suggestedUsesHint =>
      _l10n.supplierCandlesResinCastingCraftProjects;
  String get categorySectionTitle => _l10n.draftCategoryLabel;
  String get categorySectionSubtitle =>
      _l10n.supplierChooseTheClosestBroadCategory;
  String get broadCategory => _l10n.supplierBroadCategory;
  String get chooseCategory => _l10n.supplierChooseCategory;
  String get categoryRequired => _l10n.supplierCategoryIsRequired;
  String get publishMaterial => _l10n.supplierPublishMaterial;
  String get publishing => _l10n.supplierPublishing;
  String get hideCategoryRequest => _l10n.supplierHideCategoryRequest;
  String get cannotFindCategory => _l10n.supplierCannotFindYourCategory;
  String get categoryRequest => _l10n.supplierCategoryRequest;
  String get categoryRequestMessage =>
      _l10n.supplierSendThisCategoryNameToAdmin;
  String get requestedCategoryName => _l10n.supplierRequestedCategoryName;
  String get requestedCategoryHint => _l10n.supplierExampleCandleMakingTools;
  String get sending => _l10n.supplierSending;
  String get sendCategoryRequest => _l10n.supplierSendCategoryRequest;
  String get freeOtherAllowed => _l10n.supplierFreeListingsMayUseOtherWhen;
  String get paidOtherBlockedMessage =>
      _l10n.supplierPaidListingsCannotUseOtherUse;
  String get quantityAndPricing => _l10n.supplierQuantityAndPricing;
  String get quantityPricingSubtitle => _l10n.supplierEnterThePriceForOneUnit;
  String get quantity => _l10n.supplierQuantity;
  String get unit => _l10n.supplierUnit;
  String get unitHint => _l10n.supplierPiece;
  String get pricePerUnit => _l10n.supplierPricePerUnit;
  String get verifyPrice => _l10n.supplierVerifyPrice;
  String maxPricePerUnitMessage(String unit, String max) =>
      _l10n.supplierMaximumAllowedPricePerUnitIs(unit, max);
  String get pickupSectionTitle => _l10n.supplierPickup;
  String get pickupSectionSubtitle =>
      _l10n.supplierPickupLocationComesFromYourSupplier2;
  String get orgPickupSectionSubtitle =>
      _l10n.supplierOrganizationListingsUseYourProfilePickup;
  String get orgFixedPickupMessage =>
      _l10n.supplierThisFixedPickupLocationFromYour;
  String get editPickupInProfile => _l10n.supplierEditPickupInProfile;
  String get useProfilePickupLocation => _l10n.supplierUseProfilePickupLocation;
  String get useProfilePickupLocationSubtitle =>
      _l10n.supplierUseYourDefaultPickupAreaOr;
  String get materialPickupOverrideTitle =>
      _l10n.supplierMaterialPickupLocation;
  String get materialPickupOverrideSubtitle =>
      _l10n.supplierSetWhereLearnersShouldPickUp;
  String get cityRequiredForPickup => _l10n.supplierEnterACityOrCaptureYour;
  String get pickupAllowed => _l10n.supplierPickupAllowed;
  String get pickupAllowedSubtitle =>
      _l10n.supplierLearnersCanRequestSelfPickupFor;
  String get deliveryAllowed => _l10n.supplierDeliveryAllowed;
  String get deliveryAllowedSubtitle =>
      _l10n.supplierLearnersCanRequestInternalDeliveryAfter;
  String get yes => _l10n.supplierYes;
  String get no => _l10n.supplierNo;
  String get pickupNotes => _l10n.supplierPickupNotes;
  String get pickupNotesHint => _l10n.supplierPickupNearCampus;
  String get paidCannotUseOther => _l10n.supplierPaidListingsCannotUseOther;
  String get paidMustVerifyPrice =>
      _l10n.supplierPaidListingsMustPassPriceVerification;
  String get policyBadgeNisOnly => _l10n.supplierNisOnly;
  String get policyBadgeFreeOther => _l10n.supplierFreeOtherAllowed;
  String get policyBadgePaidVerify => _l10n.supplierPaidNeedsPriceVerification;
  String get restoreDraftError => _l10n.supplierCouldNotRestoreListingDraft;
  String get backToNotifications => _l10n.supplierBackToNotifications;
  String get materialListedSuccess => _l10n.supplierMaterialListedSuccessfully;
  String get addAnotherMaterial => _l10n.supplierAddAnotherMaterial;
  String materialSummaryLine(String title, String category, String price) =>
      _l10n.supplierTitleCategoryPrice(title, category, price);

  String conditionLabel(String value) => _materialLabels.condition(value);

  String materialStatusLabel(String value) =>
      _materialLabels.materialStatus(value);

  String sourceTypeLabel(String value) => _materialLabels.sourceType(value);

  String reservationStatusLabel(String value) {
    final normalized = value.trim().toUpperCase();
    return switch (normalized) {
      'PENDING' => tabPending,
      'AWAITING_RESOLUTION' => _l10n.statusNeedsAdminReview,
      'RESERVED' || 'ACCEPTED' => filterReserved,
      'COMPLETED' => tabCompleted,
      'DECLINED' => tabDeclined,
      'CANCELLED' => tabCancelled,
      _ => value.trim(),
    };
  }

  String get dismiss => _l10n.supplierDismiss;
  String get accountApprovedBanner => _l10n.supplierAccountApprovedBanner;
  String get waitingForAdminApprovalPublish =>
      _l10n.supplierWaitingForAdminApprovalPublish;
  String get commonSupplierTasks => _l10n.supplierCommonSupplierTasks;
  String get activityWillAppearAsLearners =>
      _l10n.supplierActivityWillAppearAsLearners;
  String get basicInformation => _l10n.supplierBasicInformation;
  String get tellLearnersWhatMaterial => _l10n.supplierTellLearnersWhatMaterial;
  String get whyExistingCategoriesDoNotFit =>
      _l10n.supplierWhyExistingCategoriesDoNotFit;
  String get explainMaterialKindAndWhy =>
      _l10n.supplierExplainMaterialKindAndWhy;
  String get materialTypeSlashName => _l10n.supplierMaterialTypeSlashName;
  String get searchOrTypeMaterialName => _l10n.supplierSearchOrTypeMaterialName;
  String get clearSpecificTitlesHelp => _l10n.supplierClearSpecificTitlesHelp;
  String get includeDetailsHelpLearners =>
      _l10n.supplierIncludeDetailsHelpLearners;
  String get setQuantityAndPrice => _l10n.supplierSetQuantityAndPrice;
  String get pickupAndDelivery => _l10n.supplierPickupAndDelivery;
  String get setHowLearnersReceive => _l10n.supplierSetHowLearnersReceive;
  String get photosSectionSubtitle => _l10n.supplierPhotosSectionSubtitle;
  String get checklist => _l10n.supplierChecklist;
  String get readyToPublish => _l10n.supplierReadyToPublish;
  String get chooseCategoryChecklist => _l10n.supplierChooseCategoryChecklist;
  String get enterMaterialTypeChecklist =>
      _l10n.supplierEnterMaterialTypeChecklist;
  String get enterListingTitleChecklist =>
      _l10n.supplierEnterListingTitleChecklist;
  String get addDescriptionChecklist => _l10n.supplierAddDescriptionChecklist;
  String get setConditionChecklist => _l10n.supplierSetConditionChecklist;
  String get addQuantityUnitChecklist => _l10n.supplierAddQuantityUnitChecklist;
  String get selectFreeOrPriceChecklist =>
      _l10n.supplierSelectFreeOrPriceChecklist;
  String get verifyPaidPriceChecklist => _l10n.supplierVerifyPaidPriceChecklist;
  String get chooseFulfillmentChecklist =>
      _l10n.supplierChooseFulfillmentChecklist;
  String get addPhotoChecklist => _l10n.supplierAddPhotoChecklist;
  String get generalCategory => _l10n.supplierGeneralCategory;
  String get imageUploadFailed => _l10n.supplierImageUploadFailed;
  String get enterMaterialNameBeforeCategory =>
      _l10n.supplierEnterMaterialNameBeforeCategory;
  String get describeMaterialForCategory =>
      _l10n.supplierDescribeMaterialForCategory;
  String get enterRequestedCategoryName =>
      _l10n.supplierEnterRequestedCategoryName;
  String get explainWhyCategoriesDoNotFit =>
      _l10n.supplierExplainWhyCategoriesDoNotFit;
  String get enterValidQuantityForMaterial =>
      _l10n.supplierEnterValidQuantityForMaterial;
  String get enterUnitForMaterial => _l10n.supplierEnterUnitForMaterial;
  String get couldNotUploadImages => _l10n.supplierCouldNotUploadImages;
  String get categoryStillPendingReview =>
      _l10n.supplierCategoryStillPendingReview;
  String get categoryNoLongerAvailable =>
      _l10n.supplierCategoryNoLongerAvailable;
  String get detailsNotSavedComplete => _l10n.supplierDetailsNotSavedComplete;
  String get couldNotLoadSavedDraft => _l10n.supplierCouldNotLoadSavedDraft;
  String useForListing(String name) => _l10n.supplierUseForListing(name);
  String categoryRejectedUseSuggested(String name) =>
      _l10n.supplierCategoryRejectedUseSuggested(name);
  String get categoryRejectedChooseExisting =>
      _l10n.supplierCategoryRejectedChooseExisting;
  String get resolveCategoryBeforePriceReview =>
      _l10n.supplierResolveCategoryBeforePriceReview;
  String get selectValidCategoryBeforePriceReview =>
      _l10n.supplierSelectValidCategoryBeforePriceReview;
  String get enterMaterialNameBeforePriceReview =>
      _l10n.supplierEnterMaterialNameBeforePriceReview;
  String get enterDescriptionBeforePriceReview =>
      _l10n.supplierEnterDescriptionBeforePriceReview;
  String get quantityUnitRequiredBeforePriceReview =>
      _l10n.supplierQuantityUnitRequiredBeforePriceReview;
  String get enterValidPaidPriceBeforePriceReview =>
      _l10n.supplierEnterValidPaidPriceBeforePriceReview;
  String get enterMaterialNameBeforePriceReview2 =>
      _l10n.supplierEnterMaterialNameBeforePriceReview2;
  String priceAcceptedMaxAllowed(String max) =>
      _l10n.supplierPriceAcceptedMaxAllowed(max);
  String maxAllowedPriceEnterLess(String max) =>
      _l10n.supplierMaxAllowedPriceEnterLess(max);
  String maxAllowedPricePerUnitEnterLess(String max, String unit) =>
      _l10n.supplierMaxAllowedPricePerUnitEnterLess(max, unit);
  String get paidMaterialNeedsPriceReview =>
      _l10n.supplierPaidMaterialNeedsPriceReview;
  String get materialBeingPublished => _l10n.supplierMaterialBeingPublished;
  String get publishAttemptMismatch => _l10n.supplierPublishAttemptMismatch;
  String get selectValidCategoryBeforePublishing =>
      _l10n.supplierSelectValidCategoryBeforePublishing;
  String get enterNumberGreaterThanZero =>
      _l10n.supplierEnterNumberGreaterThanZero;
  String unitPriceMustBeOrLess(String max) =>
      _l10n.supplierUnitPriceMustBeOrLess(max);
  String get listingTitleHintExample => _l10n.supplierListingTitleHintExample;
  String get inventoryOverview => _l10n.supplierInventoryOverview;
  String get monitorMaterialAvailability =>
      _l10n.supplierMonitorMaterialAvailability;
  String get clearSearch => _l10n.supplierClearSearch;
  String get resetFilters => _l10n.supplierResetFilters;
  String get reset => _l10n.supplierReset;
  String get clearAll => _l10n.supplierClearAll;
  String get materialsSection => _l10n.supplierMaterialsSection;
  String shownOfTotal(int shown, int total) =>
      _l10n.supplierShownOfTotal(shown, total);
  String get listingPreviewSubtitle => _l10n.supplierListingPreviewSubtitle;
  String get materialTitlePlaceholder => _l10n.supplierMaterialTitlePlaceholder;
  String get shortDescriptionPlaceholder =>
      _l10n.supplierShortDescriptionPlaceholder;
  String get quantityPlaceholder => _l10n.supplierQuantityPlaceholder;
  String get pickupLocationPlaceholder =>
      _l10n.supplierPickupLocationPlaceholder;
  String get pickupAvailable => _l10n.supplierPickupAvailable;
  String get pickupUnavailable => _l10n.supplierPickupUnavailable;
  String get internalDeliveryAvailable =>
      _l10n.supplierInternalDeliveryAvailable;
  String get deliveryUnavailable => _l10n.supplierDeliveryUnavailable;
  String get noImageYet => _l10n.supplierNoImageYet;
  String get addPhotosToSeePreview => _l10n.supplierAddPhotosToSeePreview;
  String youCanAddUpToPhotos(int max) => _l10n.supplierYouCanAddUpToPhotos(max);
  String onlyMorePhotosCanBeAdded(int count) =>
      _l10n.supplierOnlyMorePhotosCanBeAdded(count);
  String couldNotReadImage(String name) =>
      _l10n.supplierCouldNotReadImage(name);
  String fileLargerThan5Mb(String name) =>
      _l10n.supplierFileLargerThan5Mb(name);
  String fileMustBeJpgPngWebp(String name) =>
      _l10n.supplierFileMustBeJpgPngWebp(name);
  String get reuseHistoryWillAppear => _l10n.supplierReuseHistoryWillAppear;
  String availableOfTotal(String available, String total, String unit) =>
      _l10n.supplierAvailableOfTotal(available, total, unit);

  String supplierTypeLabel(String value) {
    final normalized = value.trim().toUpperCase().replaceAll(' ', '_');
    return switch (normalized) {
      'INDIVIDUAL_SUPPLIER' || 'INDIVIDUAL' => _l10n.supplierIndividualSupplier,
      'STUDENT_SUPPLIER' => _l10n.supplierStudentSupplier,
      'WORKSHOP' => _l10n.supplierWorkshop,
      'FACTORY' => _l10n.supplierFactory,
      'EDUCATIONAL_INSTITUTION' => _l10n.supplierEducationalInstitution,
      _ => value,
    };
  }

  String verificationStatusLabel(String value) => switch (value.toUpperCase()) {
    'VERIFIED' => _l10n.supplierVerified,
    'PENDING' => _l10n.supplierPendingVerification,
    'REJECTED' => _l10n.statusRejected,
    'CHANGES_REQUESTED' => _l10n.changesRequested,
    'NOT_REQUIRED' => _l10n.supplierNotRequired,
    _ => value,
  };

  String get verificationAdminNoteLabel => _l10n.supplierAdminNote;

  // —— Shared widgets ——
  String get close => _l10n.close;
  String get supplierType => _l10n.supplierSupplierType;
  String get pickupCountryCity => _l10n.supplierPickupCountryCity;
  String get listingPreview => _l10n.supplierListingPreview;
  String get profileCompletion => _l10n.supplierProfileCompletion;
  String get selectedCoordinates => _l10n.supplierSelectedCoordinates;
  String latitudeLabel(String value) => _l10n.supplierLatitudeValue(value);
  String longitudeLabel(String value) => _l10n.supplierLongitudeValue(value);
  String essentialsComplete(int complete, int total) =>
      _l10n.supplierCompleteOfTotalEssentialsComplete('$complete', '$total');
  String get learnerPreview => _l10n.supplierLearnerPreview;
  String get learnerPreviewSubtitle =>
      _l10n.supplierHowLearnersMayDiscoverYourSupplier;
  String get pickupAreaNotSet => _l10n.supplierPickupAreaNotSet;
  String get defaultMaterialsDescription =>
      _l10n.supplierSharesReusableMaterialsForStudentAnd;
  String locationVisibilityLabel(String visibility) =>
      _l10n.supplierLocationVisibilityVisibility(visibility);
  String get yourPublicName => _l10n.supplierYourPublicName;
  String visibilityCurrent(String value) => _l10n.supplierCurrentValue(value);
  String get verification => _l10n.supplierVerification;
  String get verificationReadOnlyNote =>
      _l10n.supplierVerificationIsReadOnlyForNow;
  String get accountSecurity => _l10n.supplierAccountSecurity;
  String get accountSecuritySubtitle => _l10n.supplierKeepYourAccountProtected;
  String get changePassword => _l10n.supplierChangePassword;
  String get changePasswordIntro =>
      _l10n.supplierEnterYourCurrentPasswordThenChoose;
  String get currentPassword => _l10n.supplierCurrentPassword;
  String get newPassword => _l10n.newPassword;
  String get confirmNewPassword => _l10n.supplierConfirmNewPassword;
  String get updatePassword => _l10n.supplierUpdatePassword;
  String get passwordUpdated => _l10n.supplierPasswordUpdatedSuccessfully;
  String get passwordUpdateFailed =>
      _l10n.supplierPasswordCouldNotBeUpdatedPlease;
  String get fieldRequired => _l10n.supplierThisFieldIsRequired;
  String get passwordMinLength => _l10n.supplierPasswordMustBeAtLeast8;
  String get passwordMustDiffer => _l10n.supplierNewPasswordMustBeDifferentFrom;
  String get passwordsDoNotMatch => _l10n.supplierPasswordsDoNotMatch;
  String get upcomingPickups => _l10n.supplierUpcomingPickups;
  String get recentMaterials => _l10n.supplierRecentMaterials;
  String get materialPhotos => _l10n.supplierMaterialPhotos;
  String get materialPhotosSubtitle => _l10n.supplierAdd1To5PhotosJpg;
  String get addAtLeastOneMaterialPhoto =>
      _l10n.supplierAddAtLeastOneMaterialPhoto;
  String get selectedPhotos => _l10n.supplierSelectedPhotos;
  String get addImages => _l10n.supplierAddImages;
  String get uploading => _l10n.supplierUploading;
  String photosCount(int count, int max) =>
      _l10n.supplierCountMaxPhotos('$count', '$max');
  String get pickupDetails => _l10n.supplierPickupDetails;
  String get sendMessageAction => _l10n.supplierSendMessage;
  String get pickupWindowPassedWarning =>
      _l10n.supplierPickupWindowPassedChooseAFollow;
  String get reschedulePickupAction => _l10n.supplierReschedulePickup;
  String get cancelReservationAction => _l10n.cancelReservation;
  String get reportNoShowAction => _l10n.supplierReportNoShow;
  String get noShowReportSubmitted =>
      _l10n.supplierNoShowReportAlreadySubmittedFor;
  String get followUpMessagesTitle => _l10n.supplierFollowUpMessages;
  String get noFollowUpMessagesYet => _l10n.supplierNoFollowUpMessagesYet;
  String get followUpMessageHint => _l10n.supplierWriteAShortFollowUpMessage;
  String get messagesLoadFailed => _l10n.supplierCouldNotLoadMessages;
  String get messageSendFailed => _l10n.supplierCouldNotSendMessage;
  String get needsFollowUpBadge => _l10n.supplierNeedsFollowUp;
  String get overdueBadge => _l10n.supplierOverdue;
  String get reschedulePickupTitle => _l10n.supplierReschedulePickup;
  String get cancelReservationTitle => _l10n.cancelReservation;
  String get cancelReservationMessage =>
      _l10n.supplierThisWillCancelTheReservationAnd;
  String get reportNoShowTitle => _l10n.supplierReportNoShow;
  String get reportNoShowMessage => _l10n.supplierSubmitANoShowReportFor;
  String get completePickupTitle => _l10n.supplierMarkPickupAsCompleted;
  String get completePickupMessage =>
      _l10n.supplierThisWillMoveTheReservationTo;
  String get acceptRequest => _l10n.supplierAcceptRequest;
  String get acceptRequestSubtitle => _l10n.supplierChooseAPickupWindowForThe;
  String get declineRequest => _l10n.supplierDeclineRequest;
  String get declineRequestSubtitle => _l10n.supplierYouCanAddAnOptionalReason;
  String get reasonOptional => _l10n.supplierReasonOptional;
  String get pickupDate => _l10n.supplierPickupDate;
  String get confirmPickupWindowLabel => _l10n.pickupWindow;
  String get driverPickupWindowFromSupplier =>
      _l10n.supplierDriverPickupWindowFromSupplier;
  String get deliveryAcceptExplanation =>
      _l10n.supplierByAcceptingYouAgreeToHand;
  String get deliverySchedulingPreviewIntro =>
      _l10n.supplierWeWillCheckThisAgainstThe;
  String deliveryEarliestAfterPickupLabel(String time) =>
      _l10n.supplierEarliestDeliveryAfterPickupTime(time);
  String deliveryConfirmedWindowLabel(String window) =>
      _l10n.supplierConfirmedLearnerDeliveryWindowWindow(window);
  String get deliveryNoFeasibleWindowPreview =>
      _l10n.supplierNoFeasibleLearnerDeliveryWindowThis;
  String get deliveryScheduleCanAcceptDirectly =>
      _l10n.supplierThisScheduleCanBeAcceptedDirectly;
  String get deliveryScheduleNeedsLearnerConfirmation =>
      _l10n.supplierThisDeliveryWindowIsNotFeasible;
  String get pickupPreferredWindowSelectedHint =>
      _l10n.supplierSelectedLearnerPreferredWindow;
  String get pickupCustomWindowHint => _l10n.supplierCustomProposedWindow;
  String get learnerPreferredPickupWindows =>
      _l10n.supplierLearnerPreferredPickupWindows;
  String get learnerPreferredDeliveryWindows =>
      _l10n.supplierLearnerPreferredDeliveryWindows;
  String get safeDropoffAllowed => _l10n.safeDropoffAllowed;
  String get safeDropoffNotAllowed => _l10n.safeDropoffNotAllowed;
  String get deliveryNoteLabel => _l10n.supplierDeliveryNote;
  String get deliveryPreferredWindowSelectedHint =>
      _l10n.supplierSelectedLearnerDeliveryWindowWillBe;
  String get proposeCustomDeliveryWindow =>
      _l10n.supplierProposeCustomDeliveryWindow;
  String get flexibleLearnerNeedsDeliveryProposal =>
      _l10n.supplierFlexibleLearnerNeedsDeliveryProposal;
  String get customDeliveryWindowLabel =>
      _l10n.supplierProposedLearnerDeliveryWindow;
  String get chooseCustomDeliveryWindow =>
      _l10n.supplierChooseTheProposedDeliveryDateAnd;
  String get awaitingProposedTimeConfirmation =>
      _l10n.supplierProposedPickupTimeWaitingForLearner;
  String get awaitingSchedulingConflictConfirmation =>
      _l10n.supplierSchedulingConflictWaitingForLearnerConfirmation;
  String get requestAwaitingConfirmation =>
      _l10n.supplierRequestSubmittedAwaitingLearnerConfirmation;
  String get startTime => _l10n.supplierStartTime;
  String get endTime => _l10n.supplierEndTime;
  String get pickupNoteOptional => _l10n.supplierPickupNoteOptional;
  String get tapToChoose => _l10n.supplierTapToChoose;
  String get priceVerified => _l10n.supplierPriceVerified;
  String get verifyPriceBeforePublishing =>
      _l10n.supplierVerifyPriceBeforePublishing;
  String get priceVerificationRequired =>
      _l10n.supplierPriceVerificationRequired;
  String get verifyPriceWithinApprovedCap =>
      _l10n.supplierWithinApprovedCapVerifyPriceTo;
  String get categoryRequests => _l10n.supplierCategoryRequests;
  String approvedAs(String name) => _l10n.supplierApprovedAsName(name);
  String get waitingAdminApproval => _l10n.supplierWaitingForAdminApproval;
  String get continueListing => _l10n.supplierContinueListing;
  String get defaultPickupLocation => _l10n.supplierDefaultPickupLocation;
  String get visibility => _l10n.supplierVisibility;
  String get pickupLocation => _l10n.pickupLocation;
  String visibilityLabel(String value) => switch (value) {
    'PUBLIC' => visibilityPublic,
    'ORDER_ONLY' => visibilityOrderOnly,
    'PRIVATE' => visibilityPrivate,
    _ => value,
  };
  String get locationCapturedShort => _l10n.supplierLocationCaptured;
  String get noAreaSelectedYet => _l10n.supplierNoAreaSelectedYet;
  String visibilitySummary(String value) =>
      _l10n.supplierVisibilityValue(value);
  String pickupScheduleSummary(int today, int upcoming, int completed) =>
      _l10n.supplierTodayTodayUpcomingUpcomingCompletedCompleted(
        '$today',
        '$upcoming',
        '$completed',
      );
  String requesterLabel(String name) => _l10n.supplierRequesterName(name);
  String qtyLabel(String qty) => _l10n.supplierQtyQty(qty);
  String viewsCount(int count) => _l10n.supplierCountViews(count.toString());
  String get price => _l10n.supplierPrice;
  String get choosePickupDateAndTime => _l10n.supplierChooseAPickupDateAndTime;
  String get endTimeMustBeAfterStart => _l10n.endAfterStart;
  String get chooseValidTime => _l10n.supplierChooseValidTime;
  String get schedulePending => _l10n.supplierSchedulePending;
  String get upcomingPickupsEmpty =>
      _l10n.supplierAcceptedReservationsWithPickupWindowsWill;
  String get recentMaterialsEmpty =>
      _l10n.supplierRecentListingsWillAppearHereAfter;
  String get recentActivityEmpty =>
      _l10n.supplierActivityFromReservationsAndNotificationsWill;
  String get organizationProfile => _l10n.supplierOrganizationProfile;
  String get supplierProfileLabel => _l10n.supplierProfile;
  String get pickupNoteHint => _l10n.supplierRingTheWorkshopBellWhenYou;
  String get declineReasonHint =>
      _l10n.supplierAlreadyReservedForAnotherLearner;
  String get materialListingFoundationReady =>
      _l10n.supplierMaterialListingFoundationReady;
  String materialCategoriesLoaded(int count) =>
      _l10n.supplierCountMaterialCategoriesLoaded(count.toString());
  String get loadingCategories => _l10n.supplierLoadingCategories;
  String get categoriesCouldNotLoad =>
      _l10n.supplierCategoriesCouldNotBeLoadedYet;
  String get loadingListingPolicy => _l10n.supplierLoadingListingPolicy;
  String get listingPolicyUnavailable => _l10n.supplierListingPolicyUnavailable;
  String categoryRequestStatusLabel(String status) => switch (status) {
    'APPROVED' => _l10n.supplierApproved,
    'REJECTED' => _l10n.statusRejected,
    _ => tabPending,
  };
  String get mapLocationHelp => _l10n.supplierUseYourCurrentLocationOrEnter;
  String get tapMapToPlacePickupPin => _l10n.supplierTapTheMapToPlaceThe;
  String get pickupPinSelectedOnMap => _l10n.supplierPickupPinSelectedOnMap;
  String get materialLabel => _l10n.material;
  String get learnerLabel => _l10n.learner;
  String get pickupTypeLabel => _l10n.supplierPickupType;
  String get statusLabel => _l10n.supplierStatus;
  String get dateLabel => _l10n.supplierDate;
  String get timeLabel => _l10n.supplierTime;
  String get pickupWindowSectionTitle => _l10n.pickupWindow;
  String get materialRequestSectionTitle => _l10n.supplierMaterialRequest;
  String pickupWindowRangeLabel(String range) =>
      _l10n.supplierPickupWindowRange(range);
  String get pickupInstructionsLabel => _l10n.supplierInstructions;
  String get noPickupInstructions => _l10n.supplierNoPickupInstructions;
  String get noDeclineReasonProvided => _l10n.supplierNoDeclineReasonProvided;
  String get expiredIncomingRequestMessage =>
      _l10n.supplierThisRequestExpiredBecauseYouDid;
  String get completedLabel => _l10n.statusCompleted;
  String get supplierNoteLabel => _l10n.supplierSupplierNote;
  String get learnerMessageLabel => _l10n.supplierLearnerMessage;
  String get coverPhoto => _l10n.supplierCover;

  String get operationalOverview => _l10n.supplierOperationalOverview;
  String get attentionNeedsYourResponse =>
      _l10n.supplierAttentionNeedsYourResponse;
  String get attentionWaitingForLearner =>
      _l10n.supplierAttentionWaitingForLearner;
  String get attentionInProgress => _l10n.supplierAttentionInProgress;
  String get attentionAdminReview => _l10n.supplierAttentionAdminReview;
  String get allAttention => _l10n.supplierAllAttention;
  String get allFulfillment => _l10n.supplierAllFulfillment;
  String get allStatuses => _l10n.supplierAllStatuses;
  String get moreFilters => _l10n.supplierMoreFilters;
  String filtersCount(int count) => _l10n.supplierFiltersCount('$count');
  String get dateRange => _l10n.supplierDateRange;
  String get searchRequestsHint => _l10n.supplierSearchRequestsHint;
  String get historyActive => _l10n.supplierHistoryActive;
  String get historyTerminal => _l10n.supplierHistoryTerminal;
  String completedCount(int count) => _l10n.supplierCompletedCount('$count');
  String closedCount(int count) => _l10n.supplierClosedCount('$count');
  String showingRange(int start, int end, int total) =>
      _l10n.supplierShowingRange('$start', '$end', '$total');
  String showingRangeRequests(int start, int end, int total) =>
      _l10n.supplierShowingRangeRequests('$start', '$end', '$total');
  String activeFiltersCount(int count) =>
      _l10n.supplierActiveFiltersCount('$count');
  String get columnRequest => _l10n.supplierColumnRequest;
  String get columnFulfillmentSchedule =>
      _l10n.supplierColumnFulfillmentSchedule;
  String get columnStatusAttention => _l10n.supplierColumnStatusAttention;
  String get columnDetails => _l10n.supplierColumnDetails;
  String perPage(int count) => _l10n.supplierPerPage('$count');
  String get viewRequestDetails => _l10n.supplierViewRequestDetails;
  String viewRequestDetailsForMaterial(String material) =>
      _l10n.supplierViewRequestDetailsForMaterial(material);
  String get noConfirmedTimeYet => _l10n.supplierNoConfirmedTimeYet;
  String get adminRecoveryInProgress => _l10n.supplierAdminRecoveryInProgress;
  String get deliveryHandledByDriver => _l10n.supplierDeliveryHandledByDriver;
  String get messagesWorkspaceNote => _l10n.supplierMessagesWorkspaceNote;
  String get noFurtherActionRequired => _l10n.supplierNoFurtherActionRequired;
  String get requestDetails => _l10n.supplierRequestDetails;
  String get backToIncomingRequests => _l10n.supplierBackToIncomingRequests;
  String get availableActions => _l10n.supplierAvailableActions;
  String get more => _l10n.supplierMore;
  String get inboxRefreshFailed => _l10n.supplierInboxRefreshFailed;
  String requestLine(String id, String status) =>
      _l10n.supplierRequestLine(id, status);
  String get confirmPickup => _l10n.supplierConfirmPickup;
  String get submitPickupWindow => _l10n.supplierSubmitPickupWindow;
  String get reviewReschedule => _l10n.supplierReviewReschedule;
  String get reportToAdmin => _l10n.supplierReportToAdmin;
  String get proposeNewTime => _l10n.supplierProposeNewTime;
  String get acceptNewTime => _l10n.supplierAcceptNewTime;
  String get reportedToAdmin => _l10n.supplierReportedToAdmin;
  String get tomorrow => _l10n.supplierTomorrow;
  String get needsAttention => _l10n.supplierNeedsAttention;
  String get emptyAllCaughtUp => _l10n.supplierEmptyAllCaughtUp;
  String get emptyNoWaitingLearnerSubtitle =>
      _l10n.supplierEmptyNoWaitingLearnerSubtitle;
  String get emptyNoWaitingLearner => _l10n.supplierEmptyNoWaitingLearner;
  String get emptyNoActiveFulfillment => _l10n.supplierEmptyNoActiveFulfillment;
  String get emptyNoAdminReview => _l10n.supplierEmptyNoAdminReview;
  String get emptyNoTerminalHistory => _l10n.supplierEmptyNoTerminalHistory;
  String get emptyNoFilterMatch => _l10n.supplierEmptyNoFilterMatch;

  // —— Access denied ——
  String get accessDenied => _l10n.supplierAccessDenied;
  String get accessDeniedMessage => _l10n.supplierYouNeedASupplierAccountTo;
  String get supplierAccessRequired => _l10n.supplierSupplierAccessRequired;
  String get supplierAccessRequiredMessage =>
      _l10n.supplierYouNeedASupplierRoleTo;
  String get goToHome => _l10n.supplierGoToHome;
  String get signIn => _l10n.signIn;

  // —— Profile view (read-only) ——
  String get editCover => _l10n.supplierEditCover;
  String get editProfilePhoto => _l10n.supplierEditProfilePhoto;
  String get essentialsCompleteTitle => _l10n.supplierEssentialsCompleteTitle;
  String get editProfileCompletionDetails =>
      _l10n.supplierEditProfileCompletionDetails;
  String profileCompletionPercent(int percent) =>
      _l10n.supplierProfileCompletionPercent('$percent');
  String missingFields(String fields) => _l10n.supplierMissingFields(fields);
  String get businessIdentity => _l10n.supplierBusinessIdentity;
  String get workingAvailability => _l10n.supplierWorkingAvailability;
  String get workingAvailabilityMissing =>
      _l10n.supplierWorkingAvailabilityMissing;
  String get workingHours => _l10n.supplierWorkingHours;
  String get pickupLocationAndPrivacy => _l10n.supplierPickupLocationAndPrivacy;
  String get cityArea => _l10n.supplierCityArea;
  String get pickupAddress => _l10n.supplierPickupAddress;
  String get pickupLocationMap => _l10n.supplierPickupLocationMap;
  String get savedPickupLocation => _l10n.supplierSavedPickupLocation;
  String get submitForReview => _l10n.supplierSubmitForReview;
  String get resubmit => _l10n.supplierResubmit;
  String get thanksVerificationCommunity =>
      _l10n.supplierThanksVerificationCommunity;
  String get reviewedDate => _l10n.supplierReviewedDate;
  String get submittedDate => _l10n.supplierSubmittedDate;
  String get awaitingReview => _l10n.supplierAwaitingReview;
  String get changesRequired => _l10n.supplierChangesRequired;
  String get verificationNotRequired => _l10n.supplierVerificationNotRequired;
  String get notVerified => _l10n.supplierNotVerified;
  String get verificationUnavailable => _l10n.supplierVerificationUnavailable;
  String get profileVerified => _l10n.supplierProfileVerified;
  String get profileAwaitingReview => _l10n.supplierProfileAwaitingReview;
  String get changesRequiredBeforeApproval =>
      _l10n.supplierChangesRequiredBeforeApproval;
  String get verificationRejected => _l10n.supplierVerificationRejected;
  String get verificationNotRequiredMessage =>
      _l10n.supplierVerificationNotRequiredMessage;
  String get profileNotVerifiedYet => _l10n.supplierProfileNotVerifiedYet;
  String get verificationStatusUnavailable =>
      _l10n.supplierVerificationStatusUnavailable;
  String get pickupLocationLabel => _l10n.supplierPickupLocationLabel;
  String get markAllRead => _l10n.markAllRead;
  String get refreshLabel => _l10n.refresh;
  String get applyLabel => _l10n.supplierApply;
  String get selectScheduleRange => _l10n.supplierSelectScheduleRange;
  String get actionCouldNotComplete => _l10n.supplierActionCouldNotComplete;
  String get handovers => _l10n.supplierHandovers;
  String get searchScheduleHint => _l10n.supplierSearchScheduleHint;
  String get deliveryPickup => _l10n.supplierDeliveryPickup;
  String get noAttention => _l10n.supplierNoAttention;
  String get scheduleColumnSchedule => _l10n.supplierScheduleColumnSchedule;
  String get scheduleColumnMaterialLearner =>
      _l10n.supplierScheduleColumnMaterialLearner;
  String get scheduleColumnFulfillment =>
      _l10n.supplierScheduleColumnFulfillment;
  String get scheduleColumnWindow => _l10n.supplierScheduleColumnWindow;
  String get scheduleColumnNextActor => _l10n.supplierScheduleColumnNextActor;
  String get scheduleColumnActions => _l10n.supplierScheduleColumnActions;
  String get noConfirmedWindow => _l10n.supplierNoConfirmedWindow;
  String groupReservationsQuantity(int count, String quantity) =>
      _l10n.supplierGroupReservationsQuantity('$count', quantity);
  String groupReservationsCount(int count) =>
      _l10n.supplierGroupReservationsCount('$count');
  String get confirmedLabel => _l10n.supplierConfirmed;
  String get supplierPickupLabel => _l10n.supplierSupplierPickup;
  String get confirmedPickupLabel => _l10n.supplierConfirmedPickup;
  String get waitingForDriver => _l10n.supplierWaitingForDriver;
  String get driverAssigned => _l10n.supplierDriverAssigned;
  String get arrivedAtSupplier => _l10n.supplierArrivedAtSupplier;
  String get driverOnTheWay => _l10n.supplierDriverOnTheWay;
  String get pickedUp => _l10n.supplierPickedUp;
  String get viewLabel => _l10n.supplierView;
  String get moreActions => _l10n.supplierMoreActions;
  String showingHandoversRange(int start, int end, int total) =>
      _l10n.supplierShowingHandoversRange('$start', '$end', '$total');
  String get rowsPerPage => _l10n.supplierRowsPerPage;
  String get pickupScheduleLoadFailedTitle =>
      _l10n.supplierPickupScheduleLoadFailedTitle;
  String get pleaseTryAgain => _l10n.supplierPleaseTryAgain;
  String get noHandoversMatchFilters => _l10n.supplierNoHandoversMatchFilters;
  String get noHandoversToday => _l10n.supplierNoHandoversToday;
  String get noHandoversUpcoming => _l10n.supplierNoHandoversUpcoming;
  String get noHandoversOverdue => _l10n.supplierNoHandoversOverdue;
  String get noHandoversCompletedPeriod =>
      _l10n.supplierNoHandoversCompletedPeriod;
  String get noHandoversClosedPeriod => _l10n.supplierNoHandoversClosedPeriod;
  String get noHandoversScheduled => _l10n.supplierNoHandoversScheduled;
  String get resetFiltersToSeeMore => _l10n.supplierResetFiltersToSeeMore;
  String get confirmedHandoversAppearHere =>
      _l10n.supplierConfirmedHandoversAppearHere;
  String get openIncomingRequests => _l10n.supplierOpenIncomingRequests;
  String get filtersTitle => _l10n.supplierFiltersTitle;
  String get filterOverdue => _l10n.supplierFilterOverdue;
  String get unscheduledAction => _l10n.supplierUnscheduledAction;
  String get needsScheduling => _l10n.supplierNeedsScheduling;
  String get awaitingResolution => _l10n.supplierAwaitingResolution;
  String get pastDue => _l10n.supplierPastDue;
  String get scheduledLabel => _l10n.supplierScheduled;
  String get handoverCompleted => _l10n.supplierHandoverCompleted;
  String get needsReview => _l10n.supplierNeedsReview;
  String get expiredLabel => _l10n.supplierExpired;
  String get noShowLabel => _l10n.supplierNoShow;
  String get fulfillmentFailedLabel => _l10n.supplierFulfillmentFailed;
  String get cancelledLabel => _l10n.supplierCancelled;
  String get adminReview => _l10n.supplierAdminReview;
  String get nextActorYou => _l10n.supplierNextActorYou;
  String get nextActorLearner => _l10n.supplierNextActorLearner;
  String get nextActorDriver => _l10n.supplierNextActorDriver;
  String get completePickup => _l10n.supplierCompletePickup;
  String get reportLearnerNoShow => _l10n.supplierReportLearnerNoShow;
  String get closeReservation => _l10n.supplierCloseReservation;
  String get messageLabel => _l10n.supplierMessage;
  String get reviewLabel => _l10n.review;

  String profileDayLabel(String value) {
    final normalized = value.trim().toUpperCase().replaceAll(' ', '_');
    return switch (normalized) {
      'SUNDAY' || 'SUN' => _l10n.supplierDaySun,
      'MONDAY' || 'MON' => _l10n.supplierDayMon,
      'TUESDAY' || 'TUE' || 'TUES' => _l10n.supplierDayTue,
      'WEDNESDAY' || 'WED' => _l10n.supplierDayWed,
      'THURSDAY' || 'THU' || 'THURS' => _l10n.supplierDayThu,
      'FRIDAY' || 'FRI' => _l10n.supplierDayFri,
      'SATURDAY' || 'SAT' => _l10n.supplierDaySat,
      _ => value.trim(),
    };
  }

  String profileVerificationBadgeLabel(String value) =>
      switch (value.trim().toUpperCase()) {
        'APPROVED' || 'VERIFIED' => _l10n.supplierVerified,
        'PENDING' => awaitingReview,
        'CHANGES_REQUESTED' => changesRequired,
        'REJECTED' => _l10n.statusRejected,
        'NOT_REQUIRED' => verificationNotRequired,
        'UNVERIFIED' => notVerified,
        _ => verificationUnavailable,
      };

  String profileVerificationMessage(String value) => switch (value) {
    'APPROVED' => profileVerified,
    'PENDING' => profileAwaitingReview,
    'CHANGES_REQUESTED' => changesRequiredBeforeApproval,
    'REJECTED' => verificationRejected,
    'NOT_REQUIRED' => verificationNotRequiredMessage,
    'UNVERIFIED' => profileNotVerifiedYet,
    _ => verificationStatusUnavailable,
  };

  ({String title, String explanation}) profilePrivacyMeaning(
    String? visibility,
    bool approximate,
  ) {
    final normalized = visibility?.trim().toUpperCase();
    final resolved = switch (normalized) {
      'PUBLIC_APPROXIMATE' || 'PUBLIC' => 'PUBLIC',
      'ORDER_ONLY' => 'ORDER_ONLY',
      'PRIVATE' => 'PRIVATE',
      _ => null,
    };
    return switch (resolved) {
      'PUBLIC' when approximate => (
        title: _l10n.supplierPublicAreaApproximateTitle,
        explanation: _l10n.supplierPublicAreaApproximateExplanation,
      ),
      'PUBLIC' => (
        title: _l10n.supplierPublicExactLocation,
        explanation: _l10n.supplierPublicExactLocationExplanation,
      ),
      'ORDER_ONLY' => (
        title: _l10n.supplierSharedAfterAcceptanceTitle,
        explanation: _l10n.supplierSharedAfterAcceptanceExplanation,
      ),
      'PRIVATE' => (
        title: _l10n.supplierPrivateLocation,
        explanation: _l10n.supplierPrivateLocationExplanation,
      ),
      _ => (
        title: _l10n.supplierLocationPrivacyUnavailable,
        explanation: _l10n.supplierLocationPrivacyUnavailableExplanation,
      ),
    };
  }

  String scheduleWindowType(String raw) => switch (raw.toUpperCase()) {
    'SUPPLIER_DELIVERY_PICKUP' => supplierPickupLabel,
    'CONFIRMED_PICKUP' => confirmedPickupLabel,
    _ => confirmedPickupLabel,
  };

  String scheduleDeliveryLabel(String? raw) => switch (raw?.toUpperCase()) {
    'WAITING_FOR_DRIVER' => waitingForDriver,
    'DRIVER_ASSIGNED' => driverAssigned,
    'ARRIVED_PICKUP' => arrivedAtSupplier,
    'ON_THE_WAY' => driverOnTheWay,
    'PICKED_UP' => pickedUp,
    _ => supplierPickupLabel,
  };

  String scheduleOperationalLabel(
    SupplierScheduleCategory category,
    String reservationStatus,
  ) => switch (category) {
    SupplierScheduleCategory.unscheduledAction => needsScheduling,
    SupplierScheduleCategory.adminReview => awaitingResolution,
    SupplierScheduleCategory.overdue => pastDue,
    SupplierScheduleCategory.inProgress => _l10n.supplierAttentionInProgress,
    SupplierScheduleCategory.today => _l10n.supplierAttentionInProgress,
    SupplierScheduleCategory.upcoming => scheduledLabel,
    SupplierScheduleCategory.completed => handoverCompleted,
    SupplierScheduleCategory.closed => scheduleClosedOutcome(reservationStatus),
    SupplierScheduleCategory.unknown => needsReview,
  };

  String scheduleClosedOutcome(String raw) => switch (raw.toUpperCase()) {
    'EXPIRED' => expiredLabel,
    'NO_SHOW' => noShowLabel,
    'FULFILLMENT_FAILED' => fulfillmentFailedLabel,
    'REJECTED' => _l10n.statusRejected,
    _ => cancelledLabel,
  };

  String scheduleCategoryLabel(SupplierScheduleCategory category) =>
      switch (category) {
        SupplierScheduleCategory.unscheduledAction => needsScheduling,
        SupplierScheduleCategory.adminReview => adminReview,
        SupplierScheduleCategory.overdue => filterOverdue,
        SupplierScheduleCategory.inProgress =>
          _l10n.supplierAttentionInProgress,
        SupplierScheduleCategory.today => filterToday,
        SupplierScheduleCategory.upcoming => filterUpcoming,
        SupplierScheduleCategory.completed => tabCompleted,
        SupplierScheduleCategory.closed => _l10n.supplierTerminalVerbClosed,
        SupplierScheduleCategory.unknown => needsReview,
      };

  String get summaryClosed => _l10n.supplierSummaryClosed;

  String scheduleCategoryFilterLabel(String? code) => switch (code) {
    'UNSCHEDULED_ACTION' => unscheduledAction,
    'ADMIN_REVIEW' => adminReview,
    'OVERDUE' => filterOverdue,
    'IN_PROGRESS' => _l10n.supplierAttentionInProgress,
    'TODAY' => filterToday,
    'UPCOMING' => filterUpcoming,
    'COMPLETED' => tabCompleted,
    'CLOSED' => summaryClosed,
    _ => code ?? filterAll,
  };

  String scheduleSummaryLabel(String label) => switch (label) {
    'Today' => filterToday,
    'Upcoming' => filterUpcoming,
    'Overdue' => filterOverdue,
    'Needs attention' => needsAttention,
    'Completed' => tabCompleted,
    'Closed' => summaryClosed,
    _ => label,
  };

  String scheduleNextActorLabel(String raw) => switch (raw.toUpperCase()) {
    'SUPPLIER' => nextActorYou,
    'LEARNER' => nextActorLearner,
    'DRIVER' => nextActorDriver,
    'ADMIN' => _l10n.supplierNextActorAdmin,
    'SYSTEM' => _l10n.supplierNextActorSystem,
    _ => '—',
  };

  String scheduleReservationActionLabel(SupplierReservationAction action) =>
      switch (action) {
        SupplierReservationAction.completeSelfPickup => completePickup,
        SupplierReservationAction.acceptLearnerReschedule => reviewReschedule,
        SupplierReservationAction.proposeReschedule => submitPickupWindow,
        SupplierReservationAction.submitRecoveryPickupWindow =>
          _l10n.supplierActionSubmitRecoveryWindow,
        SupplierReservationAction.closeReservation => closeReservation,
        SupplierReservationAction.markLearnerNoShow => reportLearnerNoShow,
        SupplierReservationAction.reportIncident =>
          _l10n.supplierActionReportIncident,
        SupplierReservationAction.reportNoDriver =>
          _l10n.supplierActionReportNoDriver,
        SupplierReservationAction.markDeliveryPickupExpired =>
          _l10n.supplierActionMarkPickupExpired,
        SupplierReservationAction.reportDriverNoShow =>
          _l10n.supplierActionReportDriverNoShow,
        SupplierReservationAction.accept => accept,
        SupplierReservationAction.decline => decline,
        SupplierReservationAction.sendMessage => messageLabel,
        SupplierReservationAction.unknown => reviewLabel,
      };

  String scheduleEmptyTitle({required bool hasFilters, String? category}) {
    if (hasFilters) return noHandoversMatchFilters;
    return switch (category) {
      'TODAY' => noHandoversToday,
      'UPCOMING' => noHandoversUpcoming,
      'OVERDUE' => noHandoversOverdue,
      'COMPLETED' => noHandoversCompletedPeriod,
      'CLOSED' => noHandoversClosedPeriod,
      _ => noHandoversScheduled,
    };
  }
}
