import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations_ar.dart';
import '../../../../l10n/app_localizations_en.dart';
import '../../../../l10n/l10n.dart';

/// Admin Portal UI strings bridged to [AppLocalizations].
class AdminL10n {
  AdminL10n(this._l10n);

  final AppLocalizations _l10n;

  bool get isArabic => _l10n.localeName.startsWith('ar');

  static AdminL10n of(BuildContext context) => AdminL10n(context.l10n);

  @visibleForTesting
  factory AdminL10n.forTest(String lang) {
    final l10n = lang == 'ar' ? AppLocalizationsAr() : AppLocalizationsEn();
    return AdminL10n(l10n);
  }

  String t(String en, String ar) => isArabic ? ar : en;

  String get navOverview => _l10n.adminNavOverview;
  String get navUsers => _l10n.adminNavUsers;
  String get navSuppliers => _l10n.adminNavSuppliers;
  String get navSupplierVerification => _l10n.adminNavSupplierVerification;
  String get navMaterials => _l10n.adminNavMaterials;
  String get navApprovals => _l10n.adminNavApprovals;
  String get navInvitations => _l10n.adminNavInvitations;
  String get navImpactAnalytics => _l10n.adminNavImpactAnalytics;
  String get navAuditLogs => _l10n.adminNavAuditLogs;
  String get navReservations => _l10n.adminNavReservations;
  String get navDeliveries => _l10n.adminNavDeliveries;
  String get navLearningProjects => _l10n.adminNavLearningProjects;
  String get navExportCenter => _l10n.adminNavExportCenter;
  String get accessDeniedTitle => _l10n.adminAccessDeniedTitle;
  String get accessDeniedBody => _l10n.adminAccessDeniedBody;
  String get overviewPageTitle => _l10n.adminOverviewPageTitle;
  String get overviewPageSubtitle => _l10n.adminOverviewPageSubtitle;
  String welcomeTitle(String name) => _l10n.adminWelcomeTitle(name);
  String get welcomeSubtitle => _l10n.adminWelcomeSubtitle;
  String get bannerOverviewLabel => _l10n.adminBannerOverviewLabel;
  String get platformDistributionTitle => _l10n.adminPlatformDistributionTitle;
  String get platformDistributionSubtitle => _l10n.adminPlatformDistributionSubtitle;
  String get impactSectionTitle => _l10n.adminImpactSectionTitle;
  String get co2RingCenterLabel => _l10n.adminCo2RingCenterLabel;
  String get estimatedAvoidedSuffix => _l10n.adminEstimatedAvoidedSuffix;
  String get controlCenterTitle => _l10n.adminControlCenterTitle;
  String get controlCenterSubtitle => _l10n.adminControlCenterSubtitle;
  String get chartsAnalyticsTitle => _l10n.adminChartsAnalyticsTitle;
  String get chartsAnalyticsSubtitle => _l10n.adminChartsAnalyticsSubtitle;
  String get platformMetricsTitle => _l10n.adminPlatformMetricsTitle;
  String get platformMetricsSubtitle => _l10n.adminPlatformMetricsSubtitle;
  String get adminOperationsTitle => _l10n.adminAdminOperationsTitle;
  String get adminOperationsSubtitle => _l10n.adminAdminOperationsSubtitle;
  String get openModuleCta => _l10n.adminOpenModuleCta;
  String get statUsers => _l10n.adminStatUsers;
  String get statSuppliers => _l10n.adminStatSuppliers;
  String get statMaterials => _l10n.adminStatMaterials;
  String get statAvailableMaterials => _l10n.adminStatAvailableMaterials;
  String get statPendingApprovals => _l10n.adminStatPendingApprovals;
  String get statActiveInvitations => _l10n.adminStatActiveInvitations;
  String get statCompletedReuse => _l10n.adminStatCompletedReuse;
  String get statActiveDrivers => _l10n.adminStatActiveDrivers;
  String get estimatedCo2Avoided => _l10n.adminEstimatedCo2Avoided;
  String get estimatedBadge => _l10n.adminEstimatedBadge;
  String get estimatedCo2Helper => _l10n.adminEstimatedCo2Helper;
  String get estimatedCo2ShortHelper => _l10n.adminEstimatedCo2ShortHelper;
  String get reuseCompletionRateLabel => _l10n.adminReuseCompletionRateLabel;
  String get hintUsers => _l10n.adminHintUsers;
  String get hintSuppliers => _l10n.adminHintSuppliers;
  String get hintMaterials => _l10n.adminHintMaterials;
  String get hintAvailableMaterials => _l10n.adminHintAvailableMaterials;
  String get hintPendingApprovals => _l10n.adminHintPendingApprovals;
  String get hintActiveInvitations => _l10n.adminHintActiveInvitations;
  String get hintCompletedReuse => _l10n.adminHintCompletedReuse;
  String get hintActiveDrivers => _l10n.adminHintActiveDrivers;
  String get reuseActivityTitle => _l10n.adminReuseActivityTitle;
  String get reuseActivitySubtitle => _l10n.adminReuseActivitySubtitle;
  String get materialsByCategoryTitle => _l10n.adminMaterialsByCategoryTitle;
  String get materialsByCategorySubtitle => _l10n.adminMaterialsByCategorySubtitle;
  String get reservationStatusTitle => _l10n.adminReservationStatusTitle;
  String get reservationStatusSubtitle => _l10n.adminReservationStatusSubtitle;
  String get pendingActionsTitle => _l10n.adminPendingActionsTitle;
  String get pendingActionsSubtitle => _l10n.adminPendingActionsSubtitle;
  String get recentInvitationsTitle => _l10n.adminRecentInvitationsTitle;
  String get recentActivityTitle => _l10n.adminRecentActivityTitle;
  String get recentActivitySubtitle => _l10n.adminRecentActivitySubtitle;
  String get recentActivityEmptySubtitle => _l10n.adminRecentActivityEmptySubtitle;
  String get viewAllAuditLogs => _l10n.adminViewAllAuditLogs;
  String get supplierVerificationQueueTitle => _l10n.adminSupplierVerificationQueueTitle;
  String get reviewQueuesTitle => _l10n.adminReviewQueuesTitle;
  String get reviewQueuesSubtitle => _l10n.adminReviewQueuesSubtitle;
  String get supplierVerificationFutureNote => _l10n.adminSupplierVerificationFutureNote;
  String get impactSnapshotTitle => _l10n.adminImpactSnapshotTitle;
  String get impactSnapshotSubtitle => _l10n.adminImpactSnapshotSubtitle;
  String get impactReusedMaterials => _l10n.adminImpactReusedMaterials;
  String get impactCompletedReservations => _l10n.adminImpactCompletedReservations;
  String get impactLearnersBenefited => _l10n.adminImpactLearnersBenefited;
  String get impactSuppliersContributed => _l10n.adminImpactSuppliersContributed;
  String get impactTopCategory => _l10n.adminImpactTopCategory;
  String get impactTopCategoryEmpty => _l10n.adminImpactTopCategoryEmpty;
  String get impactEnvironmentalNote => _l10n.adminImpactEnvironmentalNote;
  String get emptyNoDataYet => _l10n.adminEmptyNoDataYet;
  String get emptyNoInvitations => _l10n.adminEmptyNoInvitations;
  String get emptyNoInvitationsTitle => _l10n.adminEmptyNoInvitationsTitle;
  String get emptyNoInvitationsHint => _l10n.adminEmptyNoInvitationsHint;
  String get emptyNoActivity => _l10n.adminEmptyNoActivity;
  String get emptyNoActivityHint => _l10n.adminEmptyNoActivityHint;
  String get emptyNoSupplierVerifications => _l10n.adminEmptyNoSupplierVerifications;
  String get emptyAllClearTitle => _l10n.adminEmptyAllClearTitle;
  String get emptyNoPendingApprovals => _l10n.adminEmptyNoPendingApprovals;
  String get pendingSupplierVerifications => _l10n.adminPendingSupplierVerifications;
  String get pendingCategoryRequests => _l10n.adminPendingCategoryRequests;
  String get pendingPriceRequests => _l10n.adminPendingPriceRequests;
  String get pendingReports => _l10n.adminPendingReports;
  String get opUsersDesc => _l10n.adminOpUsersDesc;
  String get opSuppliersDesc => _l10n.adminOpSuppliersDesc;
  String get opSupplierVerificationDesc => _l10n.adminOpSupplierVerificationDesc;
  String get opMaterialsDesc => _l10n.adminOpMaterialsDesc;
  String get opApprovalsDesc => _l10n.adminOpApprovalsDesc;
  String get opInvitationsDesc => _l10n.adminOpInvitationsDesc;
  String get opImpactDesc => _l10n.adminOpImpactDesc;
  String get opAuditLogsDesc => _l10n.adminOpAuditLogsDesc;
  String get categoryRequest => _l10n.adminCategoryRequest;
  String get resolveCategoryRequest => _l10n.adminResolveCategoryRequest;
  String get useExistingCategory => _l10n.adminUseExistingCategory;
  String get createNewCategory => _l10n.adminCreateNewCategory;
  String get useExistingGuidance => _l10n.adminUseExistingGuidance;
  String get createNewGuidance => _l10n.adminCreateNewGuidance;
  String get suggestedExistingCategory => _l10n.adminSuggestedExistingCategory;
  String get searchOtherCategories => _l10n.adminSearchOtherCategories;
  String get searchCategories => _l10n.adminSearchCategories;
  String get chooseExistingCategory => _l10n.adminChooseExistingCategory;
  String get existingCategory => _l10n.adminExistingCategory;
  String get existingCategoryRequired => _l10n.adminExistingCategoryRequired;
  String get loadingCategories => _l10n.adminLoadingCategories;
  String get failedCategories => _l10n.adminFailedCategories;
  String get noCategoriesAvailable => _l10n.adminNoCategoriesAvailable;
  String get useThisCategory => _l10n.adminUseThisCategory;
  String get exactNameMatch => _l10n.adminExactNameMatch;
  String get possibleNameMatch => _l10n.adminPossibleNameMatch;
  String get approveWithExisting => _l10n.adminApproveWithExisting;
  String get createAndApprove => _l10n.adminCreateAndApprove;
  String get createJustification => _l10n.adminCreateJustification;
  String get createJustificationHelper => _l10n.adminCreateJustificationHelper;
  String get createJustificationRequired => _l10n.adminCreateJustificationRequired;
  String get existingNameConflict => _l10n.adminExistingNameConflict;
  String get requestDetails => _l10n.adminRequestDetails;
  String get categoryMatching => _l10n.adminCategoryMatching;
  String get similarCategories => _l10n.adminSimilarCategories;
  String get noSimilarCategories => _l10n.adminNoSimilarCategories;
  String get approvalConfiguration => _l10n.adminApprovalConfiguration;
  String get requestedCategoryName => _l10n.adminRequestedCategoryName;
  String get finalCategoryNameEn => _l10n.adminFinalCategoryNameEn;
  String get finalCategoryNameAr => _l10n.adminFinalCategoryNameAr;
  String get bilingualNamesHelper => _l10n.adminBilingualNamesHelper;
  String get namingGuidance => _l10n.adminNamingGuidance;
  String get englishNameRequired => _l10n.adminEnglishNameRequired;
  String get arabicNameRequired => _l10n.adminArabicNameRequired;
  String get englishNameWrongScript => _l10n.adminEnglishNameWrongScript;
  String get arabicNameWrongScript => _l10n.adminArabicNameWrongScript;
  String get nameControlCharacters => _l10n.adminNameControlCharacters;
  String get namePunctuationBoundary => _l10n.adminNamePunctuationBoundary;
  String get nameRepeatedWords => _l10n.adminNameRepeatedWords;
  String get nameDescriptionLike => _l10n.adminNameDescriptionLike;
  String get namesAppearIdentical => _l10n.adminNamesAppearIdentical;
  String get confirmSharedTechnicalTerm => _l10n.adminConfirmSharedTechnicalTerm;
  String get sharedNameAcknowledgementRequired => _l10n.adminSharedNameAcknowledgementRequired;
  String get nameUnusuallyLong => _l10n.adminNameUnusuallyLong;
  String get englishNameCasingWarning => _l10n.adminEnglishNameCasingWarning;
  String get repeatedWhitespaceWarning => _l10n.adminRepeatedWhitespaceWarning;
  String get materialTitleWarning => _l10n.adminMaterialTitleWarning;
  String get similarWordingWarning => _l10n.adminSimilarWordingWarning;
  String get assignMaterialFamily => _l10n.adminAssignMaterialFamily;
  String get required => _l10n.adminRequired;
  String get chooseMaterialFamily => _l10n.adminChooseMaterialFamily;
  String get searchMaterialFamilies => _l10n.adminSearchMaterialFamilies;
  String get loadingMaterialFamilies => _l10n.adminLoadingMaterialFamilies;
  String get failedMaterialFamilies => _l10n.adminFailedMaterialFamilies;
  String get noMaterialFamilies => _l10n.adminNoMaterialFamilies;
  String get materialFamily => _l10n.adminMaterialFamily;
  String get materialFamilyRequired => _l10n.adminMaterialFamilyRequired;
  String get materialFamilyInactive => _l10n.adminMaterialFamilyInactive;
  String get taxonomyConceptWrongType => _l10n.adminTaxonomyConceptWrongType;
  String get materialFamilyNotFound => _l10n.adminMaterialFamilyNotFound;
  String get ownershipHelper => _l10n.adminOwnershipHelper;
  String get ownershipExplanation => _l10n.adminOwnershipExplanation;
  String get activeMapping => _l10n.adminActiveMapping;
  String get requestSummary => _l10n.adminRequestSummary;
  String get adminGuidance => _l10n.adminAdminGuidance;
  String get ownershipGuidance => _l10n.adminOwnershipGuidance;
  String get submitted => _l10n.adminSubmitted;
  String get requestedBy => _l10n.adminRequestedBy;
  String get status => _l10n.adminStatus;
  String get supplier => _l10n.adminSupplier;
  String get material => _l10n.adminMaterial;
  String get description => _l10n.adminDescription;
  String get quantity => _l10n.adminQuantity;
  String get condition => _l10n.adminCondition;
  String get location => _l10n.adminLocation;
  String get reason => _l10n.adminReason;
  String get approve => _l10n.adminApprove;
  String get reject => _l10n.adminReject;
  String get close => _l10n.adminClose;
  String get retry => _l10n.adminRetry;
  String get approvalSucceeded => _l10n.adminApprovalSucceeded;


  String materialUsageCount(int count) => t(
        '$count marketplace material${count == 1 ? '' : 's'}',
        '$count مادة في المنصة',
      );

  String get cancel => _l10n.adminCancel;
  String get confirm => _l10n.adminConfirm;
  String get done => _l10n.adminDone;
  String get exportAction => _l10n.adminExport;
  String get format => _l10n.adminFormat;
  String get excel => _l10n.adminExcel;
  String get csv => _l10n.adminCsv;
  String get pdf => _l10n.adminPdf;
  String get previous => _l10n.adminPrevious;
  String get next => _l10n.adminNext;
  String get search => _l10n.adminSearch;
  String get reset => _l10n.adminReset;
  String get resetFilters => _l10n.adminResetFilters;
  String get actions => _l10n.adminActions;
  String get view => _l10n.adminView;
  String get viewDetails => _l10n.adminViewDetails;
  String get inviteUser => _l10n.adminInviteUser;
  String get suspendAccount => _l10n.adminSuspendAccount;
  String get reactivateAccount => _l10n.adminReactivateAccount;
  String suspendAccountQuestion(String name) =>
      _l10n.adminSuspendAccountQuestion(name);
  String get suspendAccountBody => _l10n.adminSuspendAccountBody;
  String get reasonRequired => _l10n.adminReasonRequired;
  String get suspensionReasonMinLength => _l10n.adminSuspensionReasonMinLength;
  String get accountSuspended => _l10n.adminAccountSuspended;
  String reactivateAccountBody(String name) =>
      _l10n.adminReactivateAccountBody(name);
  String get accountReactivated => _l10n.adminAccountReactivated;
  String get exportWebOnly => _l10n.adminExportWebOnly;
  String get noUsersMatchFilters => _l10n.adminNoUsersMatchFilters;
  String get exportUsers => _l10n.adminExportUsers;
  String get noProjectBuildsWithLearningData =>
      _l10n.adminNoProjectBuildsWithLearningData;
  String get exportReservations => _l10n.adminExportReservations;
  String get noReservationsMatchFilters => _l10n.adminNoReservationsMatchFilters;
  String get reservationDetails => _l10n.adminReservationDetails;
  String get openReport => _l10n.adminOpenReport;
  String get openDelivery => _l10n.adminOpenDelivery;
  String get exportIncidentReports => _l10n.adminExportIncidentReports;
  String get noIncidentReportsMatchFilters =>
      _l10n.adminNoIncidentReportsMatchFilters;
  String get couldNotLoadIncidentReports =>
      _l10n.adminCouldNotLoadIncidentReports;
  String get exportMaterials => _l10n.adminExportMaterials;
  String get noMaterialsMatchFilters => _l10n.adminNoMaterialsMatchFilters;
  String get exportMaterialReports => _l10n.adminExportMaterialReports;
  String get noMaterialReportsMatchFilters =>
      _l10n.adminNoMaterialReportsMatchFilters;
  String get supplierVerificationDetails =>
      _l10n.adminSupplierVerificationDetails;
  String get approveSupplierVerificationQuestion =>
      _l10n.adminApproveSupplierVerificationQuestion;
  String get requestChanges => _l10n.adminRequestChanges;
  String get approveSupplierVerification =>
      _l10n.adminApproveSupplierVerification;
}
