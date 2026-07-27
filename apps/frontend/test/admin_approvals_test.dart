import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/admin_approvals_api.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_approvals_page.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/category_request_approval_dialog.dart';

const _option = AdminTaxonomyOption(
  id: 'family-1',
  canonicalKey: 'material-family:glassware',
  conceptType: 'MATERIAL_FAMILY',
  status: 'ACTIVE',
  labelEn: 'Glassware & Lab Equipment',
  labelAr: 'الزجاجيات ومعدات المختبر',
);

const _category = AdminApprovalCategoryOption(
  id: 'category-1',
  nameEn: 'Lab & Education Supplies',
  nameAr: 'مستلزمات المختبر والتعليم',
  categoryType: 'MATERIAL',
  status: 'ACTIVE',
  materialCount: 12,
  matchType: 'EXACT_NAME',
  materialFamily: AdminTaxonomyOption(
    id: 'family-1',
    canonicalKey: 'material-family:glassware',
    conceptType: 'MATERIAL_FAMILY',
    status: 'ACTIVE',
    labelEn: 'Glassware & Lab Equipment',
    labelAr: 'الزجاجيات ومعدات المختبر',
  ),
);

const _partialCategory = AdminApprovalCategoryOption(
  id: 'category-partial',
  nameEn: 'Laboratory Equipment',
  nameAr: 'معدات المختبر',
  categoryType: 'MATERIAL',
  status: 'ACTIVE',
  materialCount: 4,
  matchType: 'PARTIAL_TOKEN',
  materialFamily: _option,
);

final _request = AdminCategoryRequestListItem(
  id: 'request-1',
  requestedName: 'Lab Glassware',
  status: 'PENDING',
  createdAt: DateTime(2026, 7, 15, 18, 27),
  supplierOrganization: 'Majd Tech Reuse Workshop',
  materialTitle: 'Reusable lab glassware set',
  materialDescription: 'A complete starter set for school labs.',
  quantity: 25,
  unit: 'items',
  condition: 'GOOD',
  locationLabel: 'Nablus, Tubas Street',
  categoryRequestReason: 'Leftover from school lab upgrade',
  similarCategories: const ['Lab & Education Supplies'],
  suggestedCategory: _category,
);

final _requestWithoutSuggestion = AdminCategoryRequestListItem(
  id: 'request-2',
  requestedName: 'Specialized Reusable Material',
  status: 'PENDING',
  createdAt: DateTime(2026, 7, 15, 18, 27),
  supplierOrganization: 'Majd Tech Reuse Workshop',
  materialTitle: 'Specialized reusable item',
  materialDescription: 'A reusable material requiring category review.',
  quantity: 1,
  unit: 'item',
  condition: 'GOOD',
  locationLabel: 'Nablus',
  categoryRequestReason: 'No current category was selected by the supplier.',
);

final _requestWithPartialSuggestion = AdminCategoryRequestListItem(
  id: 'request-partial',
  requestedName: 'Laboratory Tools',
  status: 'PENDING',
  createdAt: DateTime(2026, 7, 15, 18, 27),
  supplierOrganization: 'Majd Tech Reuse Workshop',
  materialTitle: 'Reusable laboratory tools',
  similarCategories: const ['Laboratory Equipment', 'معدات المختبر'],
  suggestedCategory: _partialCategory,
);

final _arabicRequest = AdminCategoryRequestListItem(
  id: 'request-ar',
  requestedName: 'الابتكار والتطوير',
  status: 'PENDING',
  createdAt: DateTime(2026, 7, 15, 18, 27),
  supplierOrganization: 'Majd Tech Reuse Workshop',
  materialTitle: 'مادة للابتكار والتطوير',
  similarCategories: const ['Lab & Education Supplies'],
  suggestedCategory: _category,
);

final _technicalTermRequest = AdminCategoryRequestListItem(
  id: 'request-technical',
  requestedName: 'CNC',
  status: 'PENDING',
  createdAt: DateTime(2026, 7, 15, 18, 27),
  supplierOrganization: 'Majd Tech Reuse Workshop',
  materialTitle: 'CNC router offcuts',
  materialDescription: 'Reusable technical workshop material.',
  quantity: 1,
  unit: 'item',
  condition: 'GOOD',
  locationLabel: 'Nablus',
  categoryRequestReason: 'A technical marketplace category is requested.',
);

class _FakeApprovalsApi extends AdminApprovalsApi {
  _FakeApprovalsApi({
    this.failFamilyLoads = 0,
    this.failCategoryLoads = 0,
    this.approvalError,
    this.approvalCompleter,
  }) : super(Dio());

  int failFamilyLoads;
  int failCategoryLoads;
  ApiException? approvalError;
  Completer<void>? approvalCompleter;
  int familyLoadCalls = 0;
  int categoryLoadCalls = 0;
  int approvalCalls = 0;
  String? submittedResolution;
  String? submittedCategoryId;
  String? submittedNameEn;
  String? submittedNameAr;
  String? submittedConceptId;
  String? submittedJustification;
  bool submittedSharedNameAcknowledged = false;

  @override
  Future<AdminApprovalsSummary> fetchSummary() async {
    return const AdminApprovalsSummary(
      pendingTotal: 1,
      approvedTotal: 10,
      rejectedTotal: 2,
      categoryPending: 1,
      pricePending: 0,
    );
  }

  @override
  Future<AdminApprovalsListResponse<AdminCategoryRequestListItem>>
  fetchCategoryRequests({
    required String status,
    required String search,
    required int page,
    required int limit,
  }) async {
    return AdminApprovalsListResponse(
      items: [_request],
      pagination: const AdminApprovalsPagination(page: 1, limit: 20, total: 1),
    );
  }

  @override
  Future<AdminApprovalsListResponse<AdminPriceRequestListItem>>
  fetchPriceRequests({
    required String status,
    required String search,
    required int page,
    required int limit,
  }) async {
    return const AdminApprovalsListResponse(
      items: [],
      pagination: AdminApprovalsPagination(page: 1, limit: 20, total: 0),
    );
  }

  @override
  Future<List<AdminTaxonomyOption>> fetchMaterialFamilyOptions() async {
    familyLoadCalls += 1;
    if (familyLoadCalls <= failFamilyLoads) {
      throw const ApiException(
        message: 'Network failed',
        code: 'NETWORK_ERROR',
      );
    }
    return const [_option];
  }

  @override
  Future<List<AdminApprovalCategoryOption>>
  fetchMaterialCategoryOptions() async {
    categoryLoadCalls += 1;
    if (categoryLoadCalls <= failCategoryLoads) {
      throw const ApiException(
        message: 'Network failed',
        code: 'NETWORK_ERROR',
      );
    }
    return const [_category];
  }

  @override
  Future<void> approveCategoryRequestWithExisting({
    required String id,
    required String existingCategoryId,
  }) async {
    approvalCalls += 1;
    submittedResolution = 'USE_EXISTING_CATEGORY';
    submittedCategoryId = existingCategoryId;
    if (approvalCompleter != null) await approvalCompleter!.future;
    if (approvalError != null) throw approvalError!;
  }

  @override
  Future<void> createAndApproveCategoryRequest({
    required String id,
    required String nameEn,
    required String nameAr,
    required String materialFamilyConceptId,
    String? adminJustification,
    bool sharedNameAcknowledged = false,
  }) async {
    approvalCalls += 1;
    submittedResolution = 'CREATE_NEW_CATEGORY';
    submittedNameEn = nameEn;
    submittedNameAr = nameAr;
    submittedConceptId = materialFamilyConceptId;
    submittedJustification = adminJustification;
    submittedSharedNameAcknowledged = sharedNameAcknowledged;
    if (approvalError != null) throw approvalError!;
  }
}

Widget _app(
  _FakeApprovalsApi api, {
  Locale locale = const Locale('en'),
  AdminCategoryRequestListItem? request,
  VoidCallback? onCompleted,
}) {
  return ProviderScope(
    overrides: [
      adminApprovalsApiProvider.overrideWithValue(api),
      adminMaterialFamilyOptionsProvider.overrideWith(
        (ref) => api.fetchMaterialFamilyOptions(),
      ),
      adminMaterialCategoryOptionsProvider.overrideWith(
        (ref) => api.fetchMaterialCategoryOptions(),
      ),
    ],
    child: MaterialApp(
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => showDialog<void>(
              context: context,
              barrierDismissible: false,
              builder: (_) => CategoryRequestApprovalDialog(
                item: request ?? _request,
                api: api,
                onCompleted: onCompleted ?? () {},
              ),
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    ),
  );
}

Future<void> _open(
  WidgetTester tester,
  _FakeApprovalsApi api, {
  Locale locale = const Locale('en'),
  AdminCategoryRequestListItem? request,
  VoidCallback? onCompleted,
}) async {
  await tester.pumpWidget(
    _app(api, locale: locale, request: request, onCompleted: onCompleted),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
}

Future<void> _showConfiguration(WidgetTester tester) async {
  await tester.tap(find.text('Create new category'));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.byKey(const Key('final-category-name-en')));
  await tester.pumpAndSettle();
}

Future<void> _enterBilingualNames(
  WidgetTester tester, {
  String nameEn = 'Lab Glassware',
  String nameAr = 'زجاجيات المختبر',
}) async {
  await tester.enterText(
    find.byKey(const Key('final-category-name-en')),
    nameEn,
  );
  await tester.enterText(
    find.byKey(const Key('final-category-name-ar')),
    nameAr,
  );
  await tester.pump();
}

Future<void> _bringIntoDialogViewport(
  WidgetTester tester,
  Finder target,
) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump();
  final scrollView = tester.widget<SingleChildScrollView>(
    find.byKey(const Key('category-dialog-scroll')),
  );
  final position = scrollView.controller!.position;
  final targetCenter = tester.getCenter(target).dy;
  final desiredCenter =
      tester.view.physicalSize.height / tester.view.devicePixelRatio * 0.58;
  final correctedOffset = (position.pixels + targetCenter - desiredCenter)
      .clamp(position.minScrollExtent, position.maxScrollExtent);
  position.jumpTo(correctedOffset);
  await tester.pumpAndSettle();
}

Future<void> _selectMaterialFamily(WidgetTester tester) async {
  final selector = find.byKey(const Key('material-family-selector'));
  await _bringIntoDialogViewport(tester, selector);
  await tester.tap(selector);
  await tester.pumpAndSettle();
  final option = find.text('Glassware & Lab Equipment');
  expect(option, findsWidgets);
  await tester.tap(option.last);
  await tester.pumpAndSettle();
}

void main() {
  test(
    'approval API sends mutually exclusive discriminated payloads',
    () async {
      final existingAdapter = _ApprovalRecordingAdapter();
      await AdminApprovalsApi(
        Dio()..httpClientAdapter = existingAdapter,
      ).approveCategoryRequestWithExisting(
        id: 'request-1',
        existingCategoryId: ' category-1 ',
      );
      expect(existingAdapter.body, {
        'resolution': 'USE_EXISTING_CATEGORY',
        'existingCategoryId': 'category-1',
      });

      final createAdapter = _ApprovalRecordingAdapter();
      await AdminApprovalsApi(
        Dio()..httpClientAdapter = createAdapter,
      ).createAndApproveCategoryRequest(
        id: 'request-1',
        nameEn: ' Lab   Glassware\t ',
        nameAr: ' زجاجيات\n  المختبر ',
        materialFamilyConceptId: ' family-1 ',
        adminJustification: ' A distinct laboratory category is required. ',
      );
      expect(createAdapter.body, {
        'resolution': 'CREATE_NEW_CATEGORY',
        'nameEn': 'Lab Glassware',
        'nameAr': 'زجاجيات المختبر',
        'materialFamilyConceptId': 'family-1',
        'adminJustification': 'A distinct laboratory category is required.',
      });
      expect(createAdapter.body!.containsKey('finalName'), false);
      expect(createAdapter.body!.containsKey('sharedNameAcknowledged'), false);

      final sharedAdapter = _ApprovalRecordingAdapter();
      await AdminApprovalsApi(
        Dio()..httpClientAdapter = sharedAdapter,
      ).createAndApproveCategoryRequest(
        id: 'request-technical',
        nameEn: 'CNC',
        nameAr: 'CNC',
        materialFamilyConceptId: 'family-1',
        sharedNameAcknowledged: true,
      );
      expect(sharedAdapter.body, {
        'resolution': 'CREATE_NEW_CATEGORY',
        'nameEn': 'CNC',
        'nameAr': 'CNC',
        'materialFamilyConceptId': 'family-1',
        'sharedNameAcknowledged': true,
      });
    },
  );

  testWidgets(
    'English request prefills only English and deterministic name quality is visible',
    (tester) async {
      final api = _FakeApprovalsApi();
      await _open(tester, api);
      await _showConfiguration(tester);

      expect(find.text('Requested name'), findsOneWidget);
      expect(find.text('Category matching'), findsOneWidget);
      expect(
        find.textContaining('do not verify grammar or translation'),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('supplier-requested-category-name')),
        findsOneWidget,
      );
      var englishField = tester.widget<TextField>(
        find.byKey(const Key('final-category-name-en')),
      );
      var arabicField = tester.widget<TextField>(
        find.byKey(const Key('final-category-name-ar')),
      );
      expect(englishField.controller!.text, 'Lab Glassware');
      expect(arabicField.controller!.text, isEmpty);
      expect(englishField.textDirection, TextDirection.ltr);
      expect(arabicField.textDirection, TextDirection.rtl);

      await _enterBilingualNames(
        tester,
        nameEn: 'زجاجيات المختبر',
        nameAr: 'English Only',
      );
      expect(
        find.text('The English name appears to contain Arabic text.'),
        findsOneWidget,
      );
      expect(
        find.text('The Arabic name appears to contain English-only text.'),
        findsOneWidget,
      );

      await _enterBilingualNames(
        tester,
        nameEn: 'Reusable Tools',
        nameAr: 'Reusable Tools',
      );
      expect(
        find.text('The Arabic name appears to contain English-only text.'),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('identical-name-acknowledgement')),
        findsNothing,
      );

      await _enterBilingualNames(
        tester,
        nameEn: 'Lab\u0000 Glassware',
        nameAr: 'زجاجيات المختبر',
      );
      expect(
        find.text('Category names cannot contain control characters.'),
        findsOneWidget,
      );

      await _enterBilingualNames(
        tester,
        nameEn:
            'Reusable Laboratory Glassware Materials for Schools and Universities with Many Different Shapes and Sizes',
        nameAr: 'زجاجيات المختبر',
      );
      expect(
        find.text(
          'This looks like a full description rather than a concise category name.',
        ),
        findsOneWidget,
      );

      await _enterBilingualNames(
        tester,
        nameEn: 'Laboratory   Glassware',
        nameAr: 'زجاجيات المختبر',
      );
      expect(
        find.text('Repeated whitespace will be saved as one ordinary space.'),
        findsOneWidget,
      );
      englishField = tester.widget<TextField>(
        find.byKey(const Key('final-category-name-en')),
      );
      arabicField = tester.widget<TextField>(
        find.byKey(const Key('final-category-name-ar')),
      );
      expect(englishField.controller!.text, 'Laboratory   Glassware');
      expect(arabicField.controller!.text, 'زجاجيات المختبر');
    },
  );

  testWidgets(
    'shared technical terms require an explicit identical-name acknowledgement',
    (tester) async {
      final api = _FakeApprovalsApi();
      await _open(tester, api, request: _technicalTermRequest);
      await _showConfiguration(tester);
      await tester.enterText(
        find.byKey(const Key('final-category-name-ar')),
        'CNC',
      );
      await tester.pump();

      const warning =
          'Both marketplace names are identical. Confirm that this term is intentionally used in both languages.';
      expect(find.text(warning), findsOneWidget);
      final acknowledgement = find.byKey(
        const Key('identical-name-acknowledgement'),
      );
      expect(acknowledgement, findsOneWidget);
      expect(
        find.text('The Arabic name appears to contain English-only text.'),
        findsNothing,
      );
      await _selectMaterialFamily(tester);
      var approve = tester.widget<FilledButton>(
        find.byKey(const Key('approve-category-request')),
      );
      expect(approve.onPressed, isNull);

      await _bringIntoDialogViewport(tester, acknowledgement);
      await tester.tap(acknowledgement);
      await tester.pump();
      approve = tester.widget<FilledButton>(
        find.byKey(const Key('approve-category-request')),
      );
      expect(approve.onPressed, isNotNull);

      await _enterBilingualNames(tester, nameEn: 'MDF', nameAr: 'MDF');
      expect(find.text(warning), findsOneWidget);
      expect(tester.widget<CheckboxListTile>(acknowledgement).value, isFalse);
      expect(
        find.text('The Arabic name appears to contain English-only text.'),
        findsNothing,
      );

      await _enterBilingualNames(tester, nameEn: 'CNC', nameAr: 'CNC');
      await _bringIntoDialogViewport(tester, acknowledgement);
      await tester.tap(acknowledgement);
      await tester.pump();
      await tester.tap(find.byKey(const Key('approve-category-request')));
      await tester.pumpAndSettle();

      expect(api.submittedNameEn, 'CNC');
      expect(api.submittedNameAr, 'CNC');
      expect(api.submittedSharedNameAcknowledged, isTrue);
      expect(api.approvalCalls, 1);
    },
  );

  testWidgets('main page uses clear KPIs and a bounded category request card', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _FakeApprovalsApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminApprovalsApiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(24),
              child: AdminApprovalsPage(),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('All pending approvals'), findsOneWidget);
    expect(find.text('Pending category requests'), findsOneWidget);
    expect(find.text('Pending price requests'), findsOneWidget);
    final card = find.byKey(const Key('category-request-card-request-1'));
    expect(card, findsOneWidget);
    expect(tester.getSize(card).height, lessThan(320));
    expect(find.text('Use this category'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'suggested category requires explicit selection before approval',
    (tester) async {
      final api = _FakeApprovalsApi();
      await _open(tester, api);

      expect(find.byKey(const Key('category-resolution-card')), findsOneWidget);
      expect(find.text('Lab & Education Supplies'), findsWidgets);
      expect(find.text('Exact match'), findsOneWidget);
      expect(find.text('Category matching'), findsNothing);
      expect(find.text('Approve with existing category'), findsOneWidget);
      var approve = tester.widget<FilledButton>(
        find.byKey(const Key('approve-category-request')),
      );
      expect(approve.onPressed, isNull);
      expect(api.submittedCategoryId, isNull);

      final useSuggestion = find.widgetWithText(
        TextButton,
        'Use this category',
      );
      expect(useSuggestion, findsOneWidget);
      await _bringIntoDialogViewport(tester, useSuggestion);
      await tester.tap(useSuggestion);
      await tester.pump();
      approve = tester.widget<FilledButton>(
        find.byKey(const Key('approve-category-request')),
      );
      expect(approve.onPressed, isNotNull);
      await tester.tap(find.byKey(const Key('approve-category-request')));
      await tester.pumpAndSettle();

      expect(api.approvalCalls, 1);
      expect(api.submittedResolution, 'USE_EXISTING_CATEGORY');
      expect(api.submittedCategoryId, 'category-1');
      final snackBar = tester.widget<SnackBar>(find.byType(SnackBar));
      expect(snackBar.behavior, SnackBarBehavior.floating);
    },
  );

  testWidgets('partial-token create flow needs no hidden justification', (
    tester,
  ) async {
    final api = _FakeApprovalsApi();
    await _open(tester, api, request: _requestWithPartialSuggestion);

    expect(find.text('Possible match'), findsOneWidget);
    var approve = tester.widget<FilledButton>(
      find.byKey(const Key('approve-category-request')),
    );
    expect(approve.onPressed, isNull);
    expect(api.submittedCategoryId, isNull);

    await _showConfiguration(tester);
    expect(
      find.byKey(const Key('create-category-justification')),
      findsNothing,
      reason: 'A weak token match is context only, not a justification gate.',
    );
    await _enterBilingualNames(
      tester,
      nameEn: 'Laboratory Tools',
      nameAr: 'أدوات المختبر',
    );
    await _selectMaterialFamily(tester);
    approve = tester.widget<FilledButton>(
      find.byKey(const Key('approve-category-request')),
    );
    expect(approve.onPressed, isNotNull);
    await tester.tap(find.byKey(const Key('approve-category-request')));
    await tester.pumpAndSettle();

    expect(api.submittedResolution, 'CREATE_NEW_CATEGORY');
    expect(api.submittedJustification, isNull);
  });

  testWidgets(
    'reject option-load failure stays safe and retry opens the normal flow',
    (tester) async {
      final api = _FakeApprovalsApi(failCategoryLoads: 1);
      await _open(tester, api, request: _requestWithoutSuggestion);

      final reject = find.widgetWithText(OutlinedButton, 'Reject');
      expect(reject, findsOneWidget);
      await tester.tap(reject);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Failed to load existing categories.'), findsWidgets);
      expect(find.text('Reject category request'), findsNothing);
      final retry = find.byKey(const Key('retry-reject-category-options'));
      expect(retry, findsOneWidget);

      await _bringIntoDialogViewport(tester, retry);
      await tester.tap(retry);
      await tester.pumpAndSettle();

      expect(api.categoryLoadCalls, 2);
      expect(find.text('Reject category request'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'in-flight approval blocks Back and closes once after completion',
    (tester) async {
      final completion = Completer<void>();
      final api = _FakeApprovalsApi(approvalCompleter: completion);
      var refreshCalls = 0;
      await _open(tester, api, onCompleted: () => refreshCalls += 1);

      final useSuggestion = find.widgetWithText(
        TextButton,
        'Use this category',
      );
      await _bringIntoDialogViewport(tester, useSuggestion);
      await tester.tap(useSuggestion);
      await tester.pump();
      await tester.tap(find.byKey(const Key('approve-category-request')));
      await tester.pump();

      expect(api.approvalCalls, 1);
      expect(find.byType(CategoryRequestApprovalDialog), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pump();
      expect(find.byType(CategoryRequestApprovalDialog), findsOneWidget);
      expect(refreshCalls, 0);

      completion.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CategoryRequestApprovalDialog), findsNothing);
      expect(refreshCalls, 1);
    },
  );

  testWidgets('manual existing-category search and selection work', (
    tester,
  ) async {
    final api = _FakeApprovalsApi();
    await _open(tester, api, request: _requestWithoutSuggestion);

    expect(find.text('No suggested existing category'), findsWidgets);
    final selector = find.byKey(const Key('existing-category-selector'));
    await _bringIntoDialogViewport(tester, selector);
    await tester.tap(selector);
    await tester.pumpAndSettle();
    final search = find.byKey(const Key('existing-category-search'));
    final menu = find.byKey(const Key('existing-category-menu'));
    expect(search, findsOneWidget);
    expect(menu, findsOneWidget);
    final decorator = tester.widget<InputDecorator>(
      find.descendant(of: selector, matching: find.byType(InputDecorator)),
    );
    expect(decorator.decoration.labelText, isNull);
    expect(tester.getSize(menu).width, tester.getSize(selector).width);
    final menuRect = tester.getRect(menu);
    final selectorRect = tester.getRect(selector);
    expect(
      menuRect.bottom <= selectorRect.top ||
          menuRect.top >= selectorRect.bottom,
      isTrue,
    );
    expect(tester.getRect(menu).bottom, lessThanOrEqualTo(600));
    await tester.enterText(search, 'education');
    await tester.pump();
    final option = find.descendant(
      of: find.byType(MenuItemButton),
      matching: find.text('Lab & Education Supplies'),
    );
    expect(option, findsOneWidget);
    await tester.tap(option);
    await tester.pumpAndSettle();
    expect(find.text('Approve with existing category'), findsOneWidget);
  });

  testWidgets('existing-category load error retries in place', (tester) async {
    final api = _FakeApprovalsApi(failCategoryLoads: 1);
    await _open(tester, api, request: _requestWithoutSuggestion);

    expect(find.text('Failed to load existing categories.'), findsOneWidget);
    final retry = find.text('Retry');
    await _bringIntoDialogViewport(tester, retry);
    await tester.tap(retry);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('existing-category-selector')), findsOneWidget);
    expect(api.categoryLoadCalls, 2);
  });

  testWidgets('material-family load retry preserves both final names', (
    tester,
  ) async {
    final api = _FakeApprovalsApi(failFamilyLoads: 1);
    await _open(tester, api);
    await _showConfiguration(tester);
    await _enterBilingualNames(
      tester,
      nameEn: 'Preserved Category Name',
      nameAr: 'اسم فئة محفوظ',
    );
    expect(find.text('Failed to load material families.'), findsOneWidget);
    final retry = find.text('Retry');
    await _bringIntoDialogViewport(tester, retry);
    await tester.tap(retry);
    await tester.pumpAndSettle();
    expect(find.text('Preserved Category Name'), findsOneWidget);
    expect(find.text('اسم فئة محفوظ'), findsOneWidget);
    expect(find.byKey(const Key('material-family-selector')), findsOneWidget);
    expect(api.familyLoadCalls, 2);
  });

  testWidgets('mode switching preserves create-new inputs independently', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _FakeApprovalsApi();
    await _open(tester, api);
    await _showConfiguration(tester);
    await _selectMaterialFamily(tester);
    await _enterBilingualNames(
      tester,
      nameEn: 'Laboratory Glassware',
      nameAr: 'زجاجيات المختبرات',
    );
    await tester.enterText(
      find.byKey(const Key('create-category-justification')),
      'The requested category has a distinct marketplace scope.',
    );

    final resolutionSelector = find.byKey(
      const Key('category-resolution-selector'),
    );
    expect(resolutionSelector, findsOneWidget);
    final useExisting = find.text('Use existing category');
    await _bringIntoDialogViewport(tester, resolutionSelector);
    await tester.tap(useExisting);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('final-category-name-en')), findsNothing);
    expect(find.byKey(const Key('final-category-name-ar')), findsNothing);
    final createNew = find.text('Create new category');
    await tester.ensureVisible(resolutionSelector);
    await tester.pumpAndSettle();
    await tester.tap(createNew);
    await tester.pumpAndSettle();

    expect(find.text('Laboratory Glassware'), findsOneWidget);
    expect(find.text('زجاجيات المختبرات'), findsOneWidget);
    expect(
      find.text('The requested category has a distinct marketplace scope.'),
      findsOneWidget,
    );
    expect(find.text('Glassware & Lab Equipment'), findsWidgets);
  });

  testWidgets('create-new eligibility requires ownership and justification', (
    tester,
  ) async {
    final api = _FakeApprovalsApi();
    await _open(tester, api);
    await _showConfiguration(tester);
    var approve = tester.widget<FilledButton>(
      find.byKey(const Key('approve-category-request')),
    );
    expect(approve.onPressed, isNull);

    await _selectMaterialFamily(tester);
    await tester.enterText(
      find.byKey(const Key('create-category-justification')),
      'A separate category is needed for laboratory glassware.',
    );
    await tester.pump();
    approve = tester.widget<FilledButton>(
      find.byKey(const Key('approve-category-request')),
    );
    expect(approve.onPressed, isNull);
    await tester.enterText(
      find.byKey(const Key('final-category-name-ar')),
      'زجاجيات المختبر',
    );
    await tester.pump();
    approve = tester.widget<FilledButton>(
      find.byKey(const Key('approve-category-request')),
    );
    expect(approve.onPressed, isNotNull);
    await tester.tap(find.byKey(const Key('approve-category-request')));
    await tester.pumpAndSettle();

    expect(api.submittedResolution, 'CREATE_NEW_CATEGORY');
    expect(api.submittedNameEn, 'Lab Glassware');
    expect(api.submittedNameAr, 'زجاجيات المختبر');
    expect(api.submittedConceptId, 'family-1');
    expect(api.submittedJustification, contains('separate category'));
  });

  testWidgets('structured name conflict offers the existing category', (
    tester,
  ) async {
    final api = _FakeApprovalsApi(
      approvalError: const ApiException(
        message: 'A category with this name already exists.',
        code: 'CATEGORY_NAME_CONFLICT',
        statusCode: 409,
        details: {
          'matchedProposedField': 'nameEn',
          'conflictingCategory': {
            'id': 'category-2',
            'nameEn': 'Laboratory Glassware',
            'nameAr': 'زجاجيات المختبر',
            'canUseExisting': true,
            'materialFamily': {
              'canonicalKey': 'material-family:glassware',
              'labelEn': 'Glassware & Lab Equipment',
              'labelAr': 'الزجاجيات ومعدات المختبر',
            },
          },
        },
      ),
    );
    await _open(tester, api);
    await _showConfiguration(tester);
    await _selectMaterialFamily(tester);
    await tester.enterText(
      find.byKey(const Key('final-category-name-ar')),
      'زجاجيات المختبر',
    );
    await tester.enterText(
      find.byKey(const Key('create-category-justification')),
      'The proposed category has a distinct marketplace scope.',
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('approve-category-request')));
    await tester.pumpAndSettle();

    expect(find.text('This category already exists'), findsOneWidget);
    await tester.ensureVisible(find.text('This category already exists'));
    final conflictUseButtons = find.widgetWithText(
      FilledButton,
      'Use this category',
    );
    expect(conflictUseButtons, findsOneWidget);
    await tester.ensureVisible(conflictUseButtons);
    await tester.pumpAndSettle();
    await tester.tap(conflictUseButtons);
    await tester.pumpAndSettle();
    expect(find.text('Approve with existing category'), findsOneWidget);
  });

  testWidgets('recoverable create failure preserves inputs', (tester) async {
    final api = _FakeApprovalsApi(
      approvalError: const ApiException(
        message: 'Please try again.',
        code: 'NETWORK_ERROR',
      ),
    );
    await _open(tester, api);
    await _showConfiguration(tester);
    await _selectMaterialFamily(tester);
    await _enterBilingualNames(
      tester,
      nameEn: 'Preserved Approval Name',
      nameAr: 'اسم موافقة محفوظ',
    );
    await tester.enterText(
      find.byKey(const Key('create-category-justification')),
      'This category is intentionally distinct from the suggestion.',
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('approve-category-request')));
    await tester.pumpAndSettle();

    expect(find.text('Preserved Approval Name'), findsOneWidget);
    expect(find.text('اسم موافقة محفوظ'), findsOneWidget);
    expect(find.text('Glassware & Lab Equipment'), findsWidgets);
    expect(api.approvalCalls, 1);
  });

  testWidgets('390px Arabic layout localizes decisions and keeps keys LTR', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _FakeApprovalsApi();
    await _open(
      tester,
      api,
      locale: const Locale('ar'),
      request: _arabicRequest,
    );

    expect(tester.takeException(), isNull);
    expect(find.text('معالجة طلب الفئة'), findsOneWidget);
    expect(find.text('استخدام فئة حالية'), findsWidgets);
    expect(find.text('إنشاء فئة جديدة'), findsOneWidget);
    expect(find.text('الموافقة باستخدام فئة حالية'), findsOneWidget);
    expect(find.text('material-family:glassware'), findsWidgets);
    expect(find.text('Lab & Education Supplies'), findsWidgets);
    final canonical = tester.widgetList<Directionality>(
      find.ancestor(
        of: find.text('material-family:glassware').first,
        matching: find.byType(Directionality),
      ),
    );
    expect(
      canonical.any((value) => value.textDirection == TextDirection.ltr),
      isTrue,
    );
    await tester.tap(find.text('إنشاء فئة جديدة'));
    await tester.pumpAndSettle();
    final englishField = tester.widget<TextField>(
      find.byKey(const Key('final-category-name-en')),
    );
    final arabicField = tester.widget<TextField>(
      find.byKey(const Key('final-category-name-ar')),
    );
    expect(englishField.controller!.text, isEmpty);
    expect(arabicField.controller!.text, 'الابتكار والتطوير');
    expect(englishField.textDirection, TextDirection.ltr);
    expect(arabicField.textDirection, TextDirection.rtl);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    '420px create workflow keeps bilingual fields and actions clear',
    (tester) async {
      tester.view.physicalSize = const Size(420, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _FakeApprovalsApi();
      await _open(tester, api);
      await tester.tap(find.text('Create new category'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('final-category-name-en')), findsOneWidget);
      expect(find.byKey(const Key('final-category-name-ar')), findsOneWidget);
      final approve = find.byKey(const Key('approve-category-request'));
      final reject = find.widgetWithText(OutlinedButton, 'Reject');
      final close = find.widgetWithText(OutlinedButton, 'Close');
      expect(
        tester.getCenter(approve).dy,
        lessThan(tester.getCenter(reject).dy),
      );
      expect(tester.getCenter(reject).dy, lessThan(tester.getCenter(close).dy));
      expect(tester.takeException(), isNull);
    },
  );
}

class _ApprovalRecordingAdapter implements HttpClientAdapter {
  String? path;
  Map<String, dynamic>? body;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    path = options.path;
    if (requestStream != null) {
      final bytes = await requestStream.expand((chunk) => chunk).toList();
      body = Map<String, dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
    }
    return ResponseBody.fromString(
      '{"success":true,"message":"approved","data":{}}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
