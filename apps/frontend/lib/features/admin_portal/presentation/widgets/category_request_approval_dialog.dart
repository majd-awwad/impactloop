import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/admin_approvals_api.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;

part 'category_name_validation.dart';
part 'category_request_approval_selectors.dart';

final adminMaterialFamilyOptionsProvider =
    FutureProvider<List<AdminTaxonomyOption>>(
      (ref) =>
          ref.watch(adminApprovalsApiProvider).fetchMaterialFamilyOptions(),
      retry: (retryCount, error) => null,
    );

final adminMaterialCategoryOptionsProvider =
    FutureProvider<List<AdminApprovalCategoryOption>>(
      (ref) =>
          ref.watch(adminApprovalsApiProvider).fetchMaterialCategoryOptions(),
      retry: (retryCount, error) => null,
    );

enum _ResolutionMode { useExisting, createNew }

bool _requiresCreateJustification(AdminCategoryRequestListItem item) =>
    item.suggestedCategory?.isExactNameSuggestion == true;

class CategoryRequestApprovalDialog extends ConsumerStatefulWidget {
  const CategoryRequestApprovalDialog({
    super.key,
    required this.item,
    required this.api,
    required this.onCompleted,
  });

  final AdminCategoryRequestListItem item;
  final AdminApprovalsApi api;
  final VoidCallback onCompleted;

  @override
  ConsumerState<CategoryRequestApprovalDialog> createState() =>
      _CategoryRequestApprovalDialogState();
}

class _CategoryRequestApprovalDialogState
    extends ConsumerState<CategoryRequestApprovalDialog> {
  late final TextEditingController _nameEnController;
  late final TextEditingController _nameArController;
  late final TextEditingController _justificationController;
  late final ScrollController _scrollController;
  late _ResolutionMode _mode;
  String? _selectedCategoryId;
  String? _selectedConceptId;
  String? _categoryError;
  String? _nameEnError;
  String? _nameArError;
  String? _familyError;
  String? _justificationError;
  String? _sharedAcknowledgementError;
  String? _generalError;
  AdminApprovalCategoryOption? _conflictingCategory;
  bool _submitting = false;
  bool _requestStale = false;
  bool _sharedTermAcknowledged = false;
  bool _loadingRejectOptions = false;
  bool _rejectOptionsRetryAvailable = false;

  bool get _requiresJustification => _requiresCreateJustification(widget.item);

  @override
  void initState() {
    super.initState();
    final requestedName = widget.item.requestedName.trim();
    final hasLatin = _latinLetters.hasMatch(requestedName);
    _nameEnController = TextEditingController(
      text: !_primarilyArabic(requestedName) && hasLatin ? requestedName : '',
    );
    _nameArController = TextEditingController(
      text: _primarilyArabic(requestedName) ? requestedName : '',
    );
    _justificationController = TextEditingController();
    _scrollController = ScrollController(initialScrollOffset: 0);
    _mode = _ResolutionMode.useExisting;
    _selectedCategoryId = null;
    _nameEnController.addListener(_clearNameErrors);
    _nameArController.addListener(_clearNameErrors);
    _justificationController.addListener(_clearJustificationError);
  }

  @override
  void dispose() {
    _nameEnController
      ..removeListener(_clearNameErrors)
      ..dispose();
    _nameArController
      ..removeListener(_clearNameErrors)
      ..dispose();
    _justificationController
      ..removeListener(_clearJustificationError)
      ..dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _clearNameErrors() {
    if (mounted) {
      setState(() {
        _nameEnError = null;
        _nameArError = null;
        _sharedTermAcknowledged = false;
        _sharedAcknowledgementError = null;
      });
    }
  }

  void _clearJustificationError() {
    if (mounted) setState(() => _justificationError = null);
  }

  AdminTaxonomyOption? _selectedOption(List<AdminTaxonomyOption> options) {
    for (final option in options) {
      if (option.id == _selectedConceptId) return option;
    }
    return null;
  }

  AdminApprovalCategoryOption? _selectedCategory(
    List<AdminApprovalCategoryOption> options,
  ) {
    for (final option in options) {
      if (option.id == _selectedCategoryId) return option;
    }
    if (widget.item.suggestedCategory?.id == _selectedCategoryId) {
      return widget.item.suggestedCategory;
    }
    if (_conflictingCategory?.id == _selectedCategoryId) {
      return _conflictingCategory;
    }
    return null;
  }

  bool _canApprove(
    AsyncValue<List<AdminTaxonomyOption>> familyOptions,
    AsyncValue<List<AdminApprovalCategoryOption>> categoryOptions,
  ) {
    if (_submitting ||
        _requestStale ||
        widget.item.status.toUpperCase() != 'PENDING') {
      return false;
    }
    if (_mode == _ResolutionMode.useExisting) {
      final values = categoryOptions.asData?.value;
      final selected = values == null ? null : _selectedCategory(values);
      return selected?.canResolveMaterialRequest == true &&
          _categoryError == null;
    }
    final values = familyOptions.asData?.value;
    final selected = values == null ? null : _selectedOption(values);
    final l = AdminL10n.of(context);
    final sharedTechnicalTerm = _isAllowedIdenticalTechnicalTerm(
      _nameEnController.text,
      _nameArController.text,
    );
    final english = _assessCategoryName(
      value: _nameEnController.text,
      language: _CategoryNameLanguage.english,
      l: l,
      item: widget.item,
    );
    final arabic = _assessCategoryName(
      value: _nameArController.text,
      language: _CategoryNameLanguage.arabic,
      l: l,
      item: widget.item,
      allowSharedTechnicalTerm: sharedTechnicalTerm,
    );
    final justificationValid =
        !_requiresJustification ||
        _justificationController.text.trim().length >= 10;
    return english.error == null &&
        arabic.error == null &&
        (!sharedTechnicalTerm || _sharedTermAcknowledged) &&
        selected?.isActiveMaterialFamily == true &&
        justificationValid &&
        _nameEnError == null &&
        _nameArError == null &&
        _familyError == null &&
        _justificationError == null &&
        _sharedAcknowledgementError == null;
  }

  Future<void> _approve(
    AsyncValue<List<AdminTaxonomyOption>> familyOptions,
    AsyncValue<List<AdminApprovalCategoryOption>> categoryOptions,
  ) async {
    final l = AdminL10n.of(context);
    final nameEn = _normalizeCategoryDisplayName(_nameEnController.text);
    final nameAr = _normalizeCategoryDisplayName(_nameArController.text);
    final justification = _justificationController.text.trim();
    final optionValues = familyOptions.asData?.value;
    final selected = optionValues == null
        ? null
        : _selectedOption(optionValues);
    final categoryValues = categoryOptions.asData?.value;
    final selectedCategory = categoryValues == null
        ? null
        : _selectedCategory(categoryValues);
    setState(() {
      if (_mode == _ResolutionMode.useExisting) {
        _categoryError = selectedCategory == null
            ? l.existingCategoryRequired
            : null;
      } else {
        final sharedTechnicalTerm = _isAllowedIdenticalTechnicalTerm(
          nameEn,
          nameAr,
        );
        final english = _assessCategoryName(
          value: nameEn,
          language: _CategoryNameLanguage.english,
          l: l,
          item: widget.item,
        );
        final arabic = _assessCategoryName(
          value: nameAr,
          language: _CategoryNameLanguage.arabic,
          l: l,
          item: widget.item,
          allowSharedTechnicalTerm: sharedTechnicalTerm,
        );
        _nameEnError = english.error;
        _nameArError = arabic.error;
        _familyError = selected == null ? l.materialFamilyRequired : null;
        _justificationError =
            _requiresJustification && justification.length < 10
            ? l.createJustificationRequired
            : null;
        _sharedAcknowledgementError =
            sharedTechnicalTerm && !_sharedTermAcknowledged
            ? l.sharedNameAcknowledgementRequired
            : null;
      }
      _generalError = null;
    });
    if (!_canApprove(familyOptions, categoryOptions)) return;

    setState(() => _submitting = true);
    try {
      if (_mode == _ResolutionMode.useExisting) {
        await widget.api.approveCategoryRequestWithExisting(
          id: widget.item.id,
          existingCategoryId: selectedCategory!.id,
        );
      } else {
        await widget.api.createAndApproveCategoryRequest(
          id: widget.item.id,
          nameEn: nameEn,
          nameAr: nameAr,
          materialFamilyConceptId: selected!.id,
          adminJustification: _requiresJustification && justification.isNotEmpty
              ? justification
              : null,
          sharedNameAcknowledged:
              _isAllowedIdenticalTechnicalTerm(nameEn, nameAr) &&
              _sharedTermAcknowledged,
        );
      }
      if (!mounted) return;
      setState(() => _submitting = false);
      widget.onCompleted();
      showInfoSnackBar(context, l.approvalSucceeded);
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        switch (error.code) {
          case 'CATEGORY_NAME_CONFLICT':
            final matchedField = error.details?['matchedProposedField'];
            if (matchedField == 'nameAr') {
              _nameArError = error.displayMessage;
            } else {
              _nameEnError = error.displayMessage;
            }
            _conflictingCategory = _readConflict(error);
          case 'MATERIAL_FAMILY_NOT_FOUND':
            _familyError = l.materialFamilyNotFound;
          case 'MATERIAL_FAMILY_INACTIVE':
            _familyError = l.materialFamilyInactive;
          case 'TAXONOMY_CONCEPT_TYPE_MISMATCH':
            _familyError = l.taxonomyConceptWrongType;
          case 'CREATE_CATEGORY_JUSTIFICATION_REQUIRED':
            _justificationError = l.createJustificationRequired;
          case 'SHARED_CATEGORY_NAME_ACKNOWLEDGEMENT_REQUIRED':
            _sharedTermAcknowledged = false;
            _sharedAcknowledgementError = l.sharedNameAcknowledgementRequired;
          case 'VALIDATION_ERROR':
            final issues = error.details?['issues'];
            if (issues is List) {
              for (final issue in issues.whereType<Map>()) {
                final path = issue['path'];
                final field = path is List && path.isNotEmpty
                    ? path.last.toString()
                    : path?.toString();
                final message = issue['message']?.toString();
                if (field == 'nameEn') {
                  _nameEnError = message ?? l.englishNameRequired;
                } else if (field == 'nameAr') {
                  _nameArError = message ?? l.arabicNameRequired;
                }
              }
            }
          case 'EXISTING_CATEGORY_NOT_FOUND':
          case 'EXISTING_CATEGORY_INACTIVE':
          case 'EXISTING_CATEGORY_TYPE_MISMATCH':
          case 'EXISTING_CATEGORY_UNOWNED':
          case 'EXISTING_CATEGORY_FAMILY_TYPE_MISMATCH':
          case 'EXISTING_CATEGORY_FAMILY_INACTIVE':
            _categoryError = error.displayMessage;
          case 'CATEGORY_REQUEST_NOT_PENDING':
            _requestStale = true;
            _generalError = error.displayMessage;
          default:
            _generalError = error.displayMessage;
        }
      });
      if (error.code == 'CATEGORY_REQUEST_NOT_PENDING') {
        widget.onCompleted();
      }
      if (error.code == 'MATERIAL_FAMILY_NOT_FOUND' ||
          error.code == 'MATERIAL_FAMILY_INACTIVE' ||
          error.code == 'TAXONOMY_CONCEPT_TYPE_MISMATCH') {
        ref.invalidate(adminMaterialFamilyOptionsProvider);
      }
      if (error.code?.startsWith('EXISTING_CATEGORY_') == true) {
        ref.invalidate(adminMaterialCategoryOptionsProvider);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _generalError = userFriendlyErrorMessage(error);
      });
    }
  }

  AdminApprovalCategoryOption? _readConflict(ApiException error) {
    final raw = error.details?['conflictingCategory'];
    if (raw is! Map || raw['canUseExisting'] != true) return null;
    final family = raw['materialFamily'];
    if (family is! Map) return null;
    return AdminApprovalCategoryOption(
      id: raw['id']?.toString() ?? '',
      nameEn: raw['nameEn']?.toString() ?? '',
      nameAr: raw['nameAr']?.toString() ?? '',
      categoryType: 'MATERIAL',
      status: 'ACTIVE',
      materialCount: 0,
      materialFamily: AdminTaxonomyOption(
        id: '',
        canonicalKey: family['canonicalKey']?.toString() ?? '',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
        labelEn: family['labelEn']?.toString() ?? '',
        labelAr: family['labelAr']?.toString() ?? '',
      ),
    );
  }

  Future<void> _reject() async {
    if (_submitting || _loadingRejectOptions) return;
    final l = AdminL10n.of(context);
    setState(() {
      _loadingRejectOptions = true;
      _rejectOptionsRetryAvailable = false;
      _generalError = null;
    });
    late final List<AdminApprovalCategoryOption> categories;
    try {
      categories = await ref.read(adminMaterialCategoryOptionsProvider.future);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingRejectOptions = false;
        _rejectOptionsRetryAvailable = true;
        _generalError = l.failedCategories;
      });
      return;
    }
    if (!mounted) {
      return;
    }
    setState(() => _loadingRejectOptions = false);
    final reasonController = TextEditingController();
    String? selectedCategoryId;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(l.t('Reject category request', 'رفض طلب الفئة')),
        content: StatefulBuilder(
          builder: (context, setDialogState) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: l.t('Reason (required)', 'السبب (مطلوب)'),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedCategoryId,
                items: [
                  for (final category in categories)
                    DropdownMenuItem(
                      value: category.id,
                      child: Text(
                        l.isArabic ? category.nameAr : category.nameEn,
                      ),
                    ),
                ],
                onChanged: (value) =>
                    setDialogState(() => selectedCategoryId = value),
                decoration: InputDecoration(
                  labelText: l.t(
                    'Suggested existing category (recommended)',
                    'الفئة الحالية المقترحة (موصى بها)',
                  ),
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l.close),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
            child: Text(l.reject),
          ),
        ),
      ),
    );
    final reason = reasonController.text.trim();
    reasonController.dispose();
    if (!mounted || confirmed != true) return;
    if (reason.length < 3 ||
        (categories.isNotEmpty && selectedCategoryId == null)) {
      setState(() {
        _generalError = l.t(
          'A rejection reason and suggested category are required.',
          'سبب الرفض والفئة المقترحة مطلوبان.',
        );
      });
      return;
    }
    setState(() => _submitting = true);
    try {
      await widget.api.rejectCategoryRequest(
        id: widget.item.id,
        adminNote: reason,
        suggestedCategoryId: selectedCategoryId,
      );
      if (!mounted) return;
      setState(() => _submitting = false);
      widget.onCompleted();
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _generalError = error.displayMessage;
      });
    }
  }

  Future<void> _retryRejectOptions() async {
    ref.invalidate(adminMaterialCategoryOptionsProvider);
    await _reject();
  }

  void _close() {
    if (!_submitting) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final screen = MediaQuery.sizeOf(context);
    final mobile = screen.width < 600;
    final options = ref.watch(adminMaterialFamilyOptionsProvider);
    final categoryOptions = ref.watch(adminMaterialCategoryOptionsProvider);
    void changeMode(_ResolutionMode value) {
      setState(() {
        _mode = value;
        _generalError = null;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
          );
        }
      });
    }

    final content = SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Header(item: widget.item, onClose: _submitting ? null : _close),
          _Overview(item: widget.item),
          Expanded(
            child: SingleChildScrollView(
              key: const Key('category-dialog-scroll'),
              controller: _scrollController,
              primary: false,
              padding: EdgeInsetsDirectional.fromSTEB(
                mobile ? 16 : 32,
                18,
                mobile ? 16 : 32,
                20,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _DecisionCard(mode: _mode, onChanged: changeMode),
                  const SizedBox(height: 14),
                  _Body(
                    item: widget.item,
                    mode: _mode,
                    familyOptions: options,
                    categoryOptions: categoryOptions,
                    nameEnController: _nameEnController,
                    nameArController: _nameArController,
                    justificationController: _justificationController,
                    selectedCategoryId: _selectedCategoryId,
                    selectedConceptId: _selectedConceptId,
                    categoryError: _categoryError,
                    nameEnError: _nameEnError,
                    nameArError: _nameArError,
                    familyError: _familyError,
                    justificationError: _justificationError,
                    sharedAcknowledgementError: _sharedAcknowledgementError,
                    generalError: _generalError,
                    conflictCategory: _conflictingCategory,
                    sharedTermAcknowledged: _sharedTermAcknowledged,
                    onModeChanged: changeMode,
                    onCategorySelected: (value) => setState(() {
                      _selectedCategoryId = value;
                      _categoryError = null;
                      _generalError = null;
                    }),
                    onFamilySelected: (value) => setState(() {
                      _selectedConceptId = value;
                      _familyError = null;
                      _generalError = null;
                    }),
                    onSharedTermAcknowledged: (value) => setState(() {
                      _sharedTermAcknowledged = value;
                      _sharedAcknowledgementError = null;
                    }),
                    onRetry: () =>
                        ref.invalidate(adminMaterialFamilyOptionsProvider),
                    onCategoryRetry: () =>
                        ref.invalidate(adminMaterialCategoryOptionsProvider),
                  ),
                  if (_rejectOptionsRetryAvailable) ...[
                    const SizedBox(height: 8),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton.icon(
                        key: const Key('retry-reject-category-options'),
                        onPressed: _loadingRejectOptions
                            ? null
                            : _retryRejectOptions,
                        icon: const Icon(Icons.refresh, size: 17),
                        label: Text(AdminL10n.of(context).retry),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          _Footer(
            submitting: _submitting,
            canApprove: _canApprove(options, categoryOptions),
            approveLabel: _mode == _ResolutionMode.useExisting
                ? AdminL10n.of(context).approveWithExisting
                : AdminL10n.of(context).createAndApprove,
            onApprove: () => _approve(options, categoryOptions),
            onReject: _reject,
            onClose: _close,
          ),
        ],
      ),
    );

    final dialog = mobile
        ? Dialog.fullscreen(
            backgroundColor: palette.cardBackground,
            child: content,
          )
        : Dialog(
            backgroundColor: palette.cardBackground,
            insetPadding: const EdgeInsets.symmetric(
              horizontal: 24,
              vertical: 24,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(22),
              side: BorderSide(color: palette.cardBorder),
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: 940,
                maxHeight: screen.height * .9,
              ),
              child: content,
            ),
          );
    return PopScope(canPop: !_submitting, child: dialog);
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.item, required this.onClose});
  final AdminCategoryRequestListItem item;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(24, 22, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: palette.blue.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.category_outlined, color: palette.blue),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l.categoryRequest,
                  style: AdminTypography.sectionTitle(palette),
                ),
              ),
              AppCloseButton(onPressed: onClose, tooltip: l.close),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            item.requestedName,
            style: AdminTypography.pageTitle(palette).copyWith(fontSize: 21),
          ),
          const SizedBox(height: 8),
          AppStatusBadge(label: l.categoryRequest, tone: AppStatusTone.info),
        ],
      ),
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview({required this.item});
  final AdminCategoryRequestListItem item;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final supplier = _supplierLabel(item);
    final facts = [
      (Icons.schedule, l.status, _titleCase(item.status)),
      (Icons.storefront_outlined, l.supplier, supplier),
      (Icons.inventory_2_outlined, l.material, _dash(item.materialTitle)),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: Border.all(color: palette.cardBorder),
          borderRadius: BorderRadius.circular(15),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final children = facts
                .map(
                  (fact) =>
                      _Fact(icon: fact.$1, label: fact.$2, value: fact.$3),
                )
                .toList();
            if (constraints.maxWidth < 520) {
              return Column(
                children: [
                  for (var i = 0; i < children.length; i++) ...[
                    if (i > 0) const SizedBox(height: 12),
                    children[i],
                  ],
                ],
              );
            }
            return Row(
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  if (i > 0) const SizedBox(width: 14),
                  Expanded(child: children[i]),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Row(
      children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: palette.blue.withValues(alpha: .1),
          child: Icon(icon, size: 17, color: palette.blue),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AdminTypography.kpiHelper(palette)),
              Text(
                value,
                style: TextStyle(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.item,
    required this.mode,
    required this.familyOptions,
    required this.categoryOptions,
    required this.nameEnController,
    required this.nameArController,
    required this.justificationController,
    required this.selectedCategoryId,
    required this.selectedConceptId,
    required this.categoryError,
    required this.nameEnError,
    required this.nameArError,
    required this.familyError,
    required this.justificationError,
    required this.sharedAcknowledgementError,
    required this.generalError,
    required this.conflictCategory,
    required this.sharedTermAcknowledged,
    required this.onModeChanged,
    required this.onCategorySelected,
    required this.onFamilySelected,
    required this.onSharedTermAcknowledged,
    required this.onRetry,
    required this.onCategoryRetry,
  });
  final AdminCategoryRequestListItem item;
  final _ResolutionMode mode;
  final AsyncValue<List<AdminTaxonomyOption>> familyOptions;
  final AsyncValue<List<AdminApprovalCategoryOption>> categoryOptions;
  final TextEditingController nameEnController;
  final TextEditingController nameArController;
  final TextEditingController justificationController;
  final String? selectedCategoryId;
  final String? selectedConceptId;
  final String? categoryError;
  final String? nameEnError;
  final String? nameArError;
  final String? familyError;
  final String? justificationError;
  final String? sharedAcknowledgementError;
  final String? generalError;
  final AdminApprovalCategoryOption? conflictCategory;
  final bool sharedTermAcknowledged;
  final ValueChanged<_ResolutionMode> onModeChanged;
  final ValueChanged<String> onCategorySelected;
  final ValueChanged<String> onFamilySelected;
  final ValueChanged<bool> onSharedTermAcknowledged;
  final VoidCallback onRetry;
  final VoidCallback onCategoryRetry;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final details = _Section(
      title: l.requestDetails,
      child: Column(
        children: [
          _Detail(label: l.description, value: _dash(item.materialDescription)),
          _Detail(
            label: l.quantity,
            value: item.quantity == null
                ? '—'
                : '${_quantity(item.quantity!)} ${item.unit ?? ''}'.trim(),
          ),
          _Detail(label: l.condition, value: _titleCase(_dash(item.condition))),
          _Detail(label: l.location, value: _dash(item.locationLabel)),
          _Detail(
            label: l.reason,
            value: _dash(item.categoryRequestReason),
            last: true,
          ),
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mode == _ResolutionMode.useExisting)
          _ExistingResolution(
            item: item,
            options: categoryOptions,
            selectedId: selectedCategoryId,
            errorText: categoryError,
            conflictCategory: conflictCategory,
            onSelected: onCategorySelected,
            onRetry: onCategoryRetry,
          )
        else
          _ApprovalConfiguration(
            options: familyOptions,
            item: item,
            nameEnController: nameEnController,
            nameArController: nameArController,
            justificationController: justificationController,
            requiresJustification: _requiresCreateJustification(item),
            selectedConceptId: selectedConceptId,
            nameEnError: nameEnError,
            nameArError: nameArError,
            familyError: familyError,
            justificationError: justificationError,
            sharedAcknowledgementError: sharedAcknowledgementError,
            sharedTermAcknowledged: sharedTermAcknowledged,
            onSelected: onFamilySelected,
            onSharedTermAcknowledged: onSharedTermAcknowledged,
            onRetry: onRetry,
          ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth < 700) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  details,
                  const SizedBox(height: 14),
                  _Summary(item: item),
                ],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 2, child: details),
                const SizedBox(width: 18),
                SizedBox(width: 290, child: _Summary(item: item)),
              ],
            );
          },
        ),
        if (mode == _ResolutionMode.createNew) ...[
          const SizedBox(height: 14),
          _Matching(
            item: item,
            onUseSuggested: item.suggestedCategory == null
                ? null
                : () {
                    onCategorySelected(item.suggestedCategory!.id);
                    onModeChanged(_ResolutionMode.useExisting);
                  },
          ),
        ],
        if (conflictCategory != null) ...[
          const SizedBox(height: 12),
          _ConflictOffer(
            category: conflictCategory!,
            onUseExisting: () {
              onCategorySelected(conflictCategory!.id);
              onModeChanged(_ResolutionMode.useExisting);
            },
          ),
        ],
        if (generalError != null) ...[
          const SizedBox(height: 12),
          _InlineError(message: generalError!),
        ],
      ],
    );
  }
}

class _DecisionCard extends StatelessWidget {
  const _DecisionCard({required this.mode, required this.onChanged});
  final _ResolutionMode mode;
  final ValueChanged<_ResolutionMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    return Container(
      key: const Key('category-resolution-card'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.pageBackground,
        border: Border.all(color: palette.cardBorder),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.resolveCategoryRequest,
            style: AdminTypography.sectionTitle(palette),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: SegmentedButton<_ResolutionMode>(
              key: const Key('category-resolution-selector'),
              segments: [
                ButtonSegment(
                  value: _ResolutionMode.useExisting,
                  icon: const Icon(Icons.merge_type, size: 18),
                  label: Text(l.useExistingCategory),
                ),
                ButtonSegment(
                  value: _ResolutionMode.createNew,
                  icon: const Icon(Icons.add_circle_outline, size: 18),
                  label: Text(l.createNewCategory),
                ),
              ],
              selected: {mode},
              showSelectedIcon: false,
              onSelectionChanged: (selection) => onChanged(selection.first),
            ),
          ),
          const SizedBox(height: 9),
          Text(
            mode == _ResolutionMode.useExisting
                ? l.useExistingGuidance
                : l.createNewGuidance,
            style: AdminTypography.kpiHelper(palette),
          ),
        ],
      ),
    );
  }
}

class _ConflictOffer extends StatelessWidget {
  const _ConflictOffer({required this.category, required this.onUseExisting});
  final AdminApprovalCategoryOption category;
  final VoidCallback onUseExisting;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    return _Section(
      title: l.existingNameConflict,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CategoryOptionCard(category: category, selected: false),
          const SizedBox(height: 8),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton(
              onPressed: onUseExisting,
              child: Text(l.useThisCategory),
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        border: Border.all(color: palette.cardBorder),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.label, required this.value, this.last = false});
  final String label;
  final String value;
  final bool last;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(bottom: BorderSide(color: palette.cardBorder)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AdminTypography.kpiHelper(palette)),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: palette.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Matching extends StatelessWidget {
  const _Matching({required this.item, this.onUseSuggested});
  final AdminCategoryRequestListItem item;
  final VoidCallback? onUseSuggested;
  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final value = item.similarCategories.isEmpty
        ? l.noSimilarCategories
        : item.similarCategories.join(', ');
    return _Section(
      title: l.categoryMatching,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: palette.green.withValues(alpha: .1),
                child: Icon(Icons.search, color: palette.green, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l.similarCategories,
                      style: AdminTypography.kpiHelper(palette),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      value,
                      style: TextStyle(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (item.suggestedCategory != null) ...[
                      const SizedBox(height: 5),
                      AppStatusBadge(
                        label: item.suggestedCategory!.isExactNameSuggestion
                            ? l.exactNameMatch
                            : l.possibleNameMatch,
                        tone: item.suggestedCategory!.isExactNameSuggestion
                            ? AppStatusTone.warning
                            : AppStatusTone.info,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (onUseSuggested != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: OutlinedButton.icon(
                onPressed: onUseSuggested,
                icon: const Icon(Icons.merge_type, size: 17),
                label: Text(l.useThisCategory),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ApprovalConfiguration extends StatelessWidget {
  const _ApprovalConfiguration({
    required this.item,
    required this.options,
    required this.nameEnController,
    required this.nameArController,
    required this.justificationController,
    required this.requiresJustification,
    required this.selectedConceptId,
    required this.nameEnError,
    required this.nameArError,
    required this.familyError,
    required this.justificationError,
    required this.sharedAcknowledgementError,
    required this.sharedTermAcknowledged,
    required this.onSelected,
    required this.onSharedTermAcknowledged,
    required this.onRetry,
  });
  final AdminCategoryRequestListItem item;
  final AsyncValue<List<AdminTaxonomyOption>> options;
  final TextEditingController nameEnController;
  final TextEditingController nameArController;
  final TextEditingController justificationController;
  final bool requiresJustification;
  final String? selectedConceptId;
  final String? nameEnError;
  final String? nameArError;
  final String? familyError;
  final String? justificationError;
  final String? sharedAcknowledgementError;
  final bool sharedTermAcknowledged;
  final ValueChanged<String> onSelected;
  final ValueChanged<bool> onSharedTermAcknowledged;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final sharedTechnicalTerm = _isAllowedIdenticalTechnicalTerm(
      nameEnController.text,
      nameArController.text,
    );
    final englishAssessment = _assessCategoryName(
      value: nameEnController.text,
      language: _CategoryNameLanguage.english,
      l: l,
      item: item,
    );
    final arabicAssessment = _assessCategoryName(
      value: nameArController.text,
      language: _CategoryNameLanguage.arabic,
      l: l,
      item: item,
      allowSharedTechnicalTerm: sharedTechnicalTerm,
    );
    final warnings = <String>{
      ...englishAssessment.warnings,
      ...arabicAssessment.warnings,
    };
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: palette.green.withValues(alpha: .055),
        border: Border.all(color: palette.green.withValues(alpha: .25)),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l.approvalConfiguration,
                  style: AdminTypography.sectionTitle(palette),
                ),
              ),
              AppStatusBadge(label: l.required, tone: AppStatusTone.warning),
            ],
          ),
          const SizedBox(height: 7),
          Text(l.ownershipHelper, style: AdminTypography.kpiHelper(palette)),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: palette.blue.withValues(alpha: .06),
              border: Border.all(color: palette.blue.withValues(alpha: .2)),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.requestedCategoryName,
                  style: AdminTypography.kpiHelper(palette),
                ),
                const SizedBox(height: 3),
                Text(
                  item.requestedName,
                  key: const Key('supplier-requested-category-name'),
                  style: TextStyle(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  l.namingGuidance,
                  style: AdminTypography.kpiHelper(palette),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Directionality(
            textDirection: TextDirection.ltr,
            child: TextField(
              key: const Key('final-category-name-en'),
              controller: nameEnController,
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.left,
              maxLength: 120,
              decoration: InputDecoration(
                labelText: l.finalCategoryNameEn,
                errorText: nameEnError ?? englishAssessment.error,
                border: const OutlineInputBorder(),
                counterText: '',
              ),
            ),
          ),
          const SizedBox(height: 12),
          Directionality(
            textDirection: TextDirection.rtl,
            child: TextField(
              key: const Key('final-category-name-ar'),
              controller: nameArController,
              textDirection: TextDirection.rtl,
              textAlign: TextAlign.right,
              maxLength: 120,
              decoration: InputDecoration(
                labelText: l.finalCategoryNameAr,
                errorText: nameArError ?? arabicAssessment.error,
                border: const OutlineInputBorder(),
                counterText: '',
              ),
            ),
          ),
          const SizedBox(height: 7),
          Text(
            l.bilingualNamesHelper,
            style: AdminTypography.kpiHelper(palette),
          ),
          if (warnings.isNotEmpty) ...[
            const SizedBox(height: 9),
            for (final warning in warnings)
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 16, color: palette.amber),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        warning,
                        style: AdminTypography.kpiHelper(palette),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          if (sharedTechnicalTerm) ...[
            const SizedBox(height: 9),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: palette.amber.withValues(alpha: .08),
                border: Border.all(color: palette.amber.withValues(alpha: .35)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, size: 17, color: palette.amber),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          l.namesAppearIdentical,
                          style: AdminTypography.kpiHelper(palette),
                        ),
                      ),
                    ],
                  ),
                  CheckboxListTile(
                    key: const Key('identical-name-acknowledgement'),
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: sharedTermAcknowledged,
                    onChanged: (value) =>
                        onSharedTermAcknowledged(value ?? false),
                    title: Text(
                      l.confirmSharedTechnicalTerm,
                      style: AdminTypography.kpiHelper(palette),
                    ),
                  ),
                  if (sharedAcknowledgementError != null)
                    _InlineError(message: sharedAcknowledgementError!),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          options.when(
            loading: () => _SelectorStatus(
              icon: const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              message: l.loadingMaterialFamilies,
            ),
            error: (_, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InlineError(message: l.failedMaterialFamilies),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 17),
                    label: Text(l.retry),
                  ),
                ),
              ],
            ),
            data: (values) {
              if (values.isEmpty) {
                return _SelectorStatus(
                  icon: const Icon(Icons.info_outline, size: 17),
                  message: l.noMaterialFamilies,
                );
              }
              return _MaterialFamilySelector(
                options: values,
                selectedId: selectedConceptId,
                errorText: familyError,
                onSelected: onSelected,
              );
            },
          ),
          const SizedBox(height: 9),
          Text(
            l.ownershipExplanation,
            style: AdminTypography.kpiHelper(palette),
          ),
          if (requiresJustification) ...[
            const SizedBox(height: 12),
            TextField(
              key: const Key('create-category-justification'),
              controller: justificationController,
              minLines: 2,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: l.createJustification,
                helperText: l.createJustificationHelper,
                errorText: justificationError,
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.item});
  final AdminCategoryRequestListItem item;
  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    return _Section(
      title: l.requestSummary,
      child: Column(
        children: [
          _Fact(
            icon: Icons.calendar_today_outlined,
            label: l.submitted,
            value: DateFormat.yMMMd(
              l.isArabic ? 'ar' : 'en',
            ).add_jm().format(item.createdAt),
          ),
          const SizedBox(height: 14),
          _Fact(
            icon: Icons.person_outline,
            label: l.requestedBy,
            value: _supplierLabel(item),
          ),
          const SizedBox(height: 14),
          _Fact(
            icon: Icons.info_outline,
            label: l.adminGuidance,
            value: l.ownershipGuidance,
          ),
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.error;
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        border: Border.all(color: color.withValues(alpha: .35)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.submitting,
    required this.canApprove,
    required this.approveLabel,
    required this.onApprove,
    required this.onReject,
    required this.onClose,
  });
  final bool submitting;
  final bool canApprove;
  final String approveLabel;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final approve = SizedBox(
      height: 46,
      child: FilledButton.icon(
        key: const Key('approve-category-request'),
        onPressed: canApprove ? onApprove : null,
        style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
        icon: submitting
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.check, size: 17),
        label: Text(approveLabel),
      ),
    );
    final reject = SizedBox(
      height: 46,
      child: OutlinedButton.icon(
        onPressed: submitting ? null : onReject,
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
        icon: const Icon(Icons.close, size: 17),
        label: Text(l.reject),
      ),
    );
    final close = SizedBox(
      height: 46,
      child: OutlinedButton(
        onPressed: submitting ? null : onClose,
        child: Text(l.close),
      ),
    );
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 14, 20, 18),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: palette.cardBorder)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 650) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                approve,
                const SizedBox(height: 9),
                reject,
                const SizedBox(height: 9),
                close,
              ],
            );
          }
          return Row(
            children: [
              const Spacer(),
              close,
              const SizedBox(width: 10),
              reject,
              const SizedBox(width: 10),
              Expanded(flex: 2, child: approve),
            ],
          );
        },
      ),
    );
  }
}

String _supplierLabel(AdminCategoryRequestListItem item) {
  for (final value in [
    item.supplierOrganization,
    item.supplierName,
    item.supplierEmail,
  ]) {
    if (value != null && value.trim().isNotEmpty) return value.trim();
  }
  return '—';
}

String _dash(String? value) =>
    value == null || value.trim().isEmpty ? '—' : value.trim();
String _quantity(double value) =>
    value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(2);
String _titleCase(String value) => value
    .replaceAll('_', ' ')
    .split(' ')
    .map(
      (part) => part.isEmpty
          ? part
          : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
    )
    .join(' ');
