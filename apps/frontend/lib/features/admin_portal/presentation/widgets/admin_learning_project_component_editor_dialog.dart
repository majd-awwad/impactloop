import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/category.dart';
import '../../data/admin_learning_projects_api.dart';
import '../../data/models/admin_learning_projects_models.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

String formatAdminComponentRoleLabel(String role) {
  return switch (role) {
    'TOOL' => 'Tool',
    'CONSUMABLE' => 'Consumable',
    'OPTIONAL_MATERIAL' => 'Optional material',
    'ALTERNATIVE' => 'Alternative',
    _ => 'Required material',
  };
}

List<String> normalizeAdminComponentKeywords(List<String> raw) {
  final normalized = <String>[];
  final seen = <String>{};

  for (final entry in raw) {
    for (final part in entry.split(',')) {
      final keyword = part.trim();
      if (keyword.isEmpty) {
        continue;
      }

      final key = keyword.toLowerCase();
      if (seen.add(key)) {
        normalized.add(keyword);
      }

      if (normalized.length >= 5) {
        return normalized;
      }
    }
  }

  return normalized;
}

List<MaterialCategory> materialSelectableCategories(
  List<MaterialCategory> categories,
) {
  return categories
      .where(
        (category) =>
            category.categoryType == 'MATERIAL' ||
            category.categoryType == 'BOTH',
      )
      .toList();
}

String? resolveSelectableCategoryId({
  required String? categoryId,
  required List<MaterialCategory> categories,
}) {
  if (categoryId == null || categoryId.trim().isEmpty) {
    return null;
  }

  final selectable = materialSelectableCategories(categories);
  if (selectable.any((category) => category.id == categoryId)) {
    return categoryId;
  }

  return null;
}

Map<String, dynamic> buildAdminComponentUpdatePayload({
  required String componentName,
  required double quantity,
  required String unit,
  required String componentRole,
  required String? categoryId,
  required String materialType,
  required List<String> searchKeywords,
  required List<String> alternativeKeywords,
  required bool canBeSubstituted,
  required bool isRequired,
  required String? notes,
}) {
  final body = <String, dynamic>{
    'componentName': componentName.trim(),
    'quantity': quantity,
    'unit': unit.trim(),
    'componentRole': componentRole,
    'materialType': materialType.trim(),
    'searchKeywords': normalizeAdminComponentKeywords(searchKeywords),
    'alternativeKeywords': normalizeAdminComponentKeywords(alternativeKeywords),
    'canBeSubstituted': canBeSubstituted,
    'isRequired': isRequired,
    'reviewStatus': 'ACCEPTED',
  };

  final trimmedCategoryId = categoryId?.trim();
  if (trimmedCategoryId != null && trimmedCategoryId.isNotEmpty) {
    body['categoryId'] = trimmedCategoryId;
  }

  final trimmedNotes = notes?.trim();
  body['notes'] = trimmedNotes == null || trimmedNotes.isEmpty
      ? null
      : trimmedNotes;

  return body;
}

String formatAdminComponentEditorError(Object error) {
  final apiError = error is ApiException ? error : normalizeApiException(error);
  if (apiError.fieldIssues.isNotEmpty) {
    return apiError.fieldIssues.map((issue) => issue.message).join('\n');
  }

  return apiError.displayMessage;
}

class AdminLearningProjectComponentEditorDialog extends ConsumerStatefulWidget {
  const AdminLearningProjectComponentEditorDialog({
    super.key,
    required this.projectId,
    required this.component,
  });

  final String projectId;
  final AdminLearningProjectComponent component;

  static Future<AdminLearningProjectDetail?> show(
    BuildContext context, {
    required String projectId,
    required AdminLearningProjectComponent component,
  }) {
    return showDialog<AdminLearningProjectDetail>(
      context: context,
      builder: (context) => AdminLearningProjectComponentEditorDialog(
        projectId: projectId,
        component: component,
      ),
    );
  }

  @override
  ConsumerState<AdminLearningProjectComponentEditorDialog> createState() =>
      _AdminLearningProjectComponentEditorDialogState();
}

class _AdminLearningProjectComponentEditorDialogState
    extends ConsumerState<AdminLearningProjectComponentEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _quantityController;
  late final TextEditingController _unitController;
  late final TextEditingController _materialTypeController;
  late final TextEditingController _notesController;
  late final TextEditingController _keywordController;
  late final TextEditingController _alternativeKeywordController;

  late String _componentRole;
  String? _categoryId;
  late bool _isRequired;
  late bool _canBeSubstituted;
  late List<String> _keywords;
  late List<String> _alternativeKeywords;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final component = widget.component;
    _nameController = TextEditingController(text: component.name);
    _quantityController = TextEditingController(
      text: component.quantity.toString(),
    );
    _unitController = TextEditingController(text: component.unit);
    _materialTypeController = TextEditingController(text: component.materialType);
    _notesController = TextEditingController(text: component.notes ?? '');
    _keywordController = TextEditingController();
    _alternativeKeywordController = TextEditingController();
    _componentRole = component.componentRole;
    _categoryId = component.categoryId;
    _isRequired = component.isRequired;
    _canBeSubstituted = component.canBeSubstituted;
    _keywords = normalizeAdminComponentKeywords(component.searchKeywords);
    _alternativeKeywords =
        normalizeAdminComponentKeywords(component.alternativeKeywords);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _quantityController.dispose();
    _unitController.dispose();
    _materialTypeController.dispose();
    _notesController.dispose();
    _keywordController.dispose();
    _alternativeKeywordController.dispose();
    super.dispose();
  }

  void _addKeyword({
    required TextEditingController controller,
    required List<String> target,
    required void Function(List<String>) update,
  }) {
    final value = controller.text.trim();
    if (value.isEmpty) {
      return;
    }

    final next = normalizeAdminComponentKeywords([...target, value]);
    if (next.length == target.length) {
      controller.clear();
      return;
    }

    setState(() {
      update(next);
      controller.clear();
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      final quantity = double.tryParse(_quantityController.text.trim());
      if (quantity == null || quantity <= 0) {
        setState(() {
          _errorMessage = 'Quantity must be a positive number.';
          _isSaving = false;
        });
        return;
      }

      final result = await ref
          .read(adminLearningProjectsApiProvider)
          .updateProjectComponent(
            projectId: widget.projectId,
            componentId: widget.component.id,
            body: buildAdminComponentUpdatePayload(
              componentName: _nameController.text,
              quantity: quantity,
              unit: _unitController.text,
              componentRole: _componentRole,
              categoryId: _categoryId,
              materialType: _materialTypeController.text,
              searchKeywords: _keywords,
              alternativeKeywords: _alternativeKeywords,
              canBeSubstituted: _canBeSubstituted,
              isRequired: _isRequired,
              notes: _notesController.text,
            ),
          );

      if (!mounted) return;
      Navigator.of(context).pop(result);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = formatAdminComponentEditorError(error);
        _isSaving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final categoriesAsync = ref.watch(materialCategoriesProvider);

    return AlertDialog(
      title: const Text('Edit component'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Component name',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Component name is required.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _quantityController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Quantity',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _unitController,
                        decoration: const InputDecoration(
                          labelText: 'Unit',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _componentRole,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Role',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'REQUIRED_MATERIAL',
                      child: Text('Required material'),
                    ),
                    DropdownMenuItem(
                      value: 'OPTIONAL_MATERIAL',
                      child: Text('Optional material'),
                    ),
                    DropdownMenuItem(
                      value: 'CONSUMABLE',
                      child: Text('Consumable'),
                    ),
                    DropdownMenuItem(value: 'TOOL', child: Text('Tool')),
                    DropdownMenuItem(
                      value: 'ALTERNATIVE',
                      child: Text('Alternative'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() => _componentRole = value);
                  },
                ),
                const SizedBox(height: 12),
                categoriesAsync.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (error, _) => Text(
                    'Could not load categories.',
                    style: AdminTypography.pageSubtitle(palette),
                  ),
                  data: (categories) {
                    final selectableCategories =
                        materialSelectableCategories(categories);
                    final selectedCategoryId = resolveSelectableCategoryId(
                      categoryId: _categoryId,
                      categories: categories,
                    );

                    return DropdownButtonFormField<String?>(
                      value: selectedCategoryId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Material category',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem<String?>(
                          value: null,
                          child: Text('None'),
                        ),
                        for (final MaterialCategory category
                            in selectableCategories)
                          DropdownMenuItem<String?>(
                            value: category.id,
                            child: Text(
                              category.nameEn,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: (value) => setState(() => _categoryId = value),
                    );
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _materialTypeController,
                  decoration: const InputDecoration(
                    labelText: 'Material type',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                _KeywordEditor(
                  label: 'Search keywords',
                  controller: _keywordController,
                  keywords: _keywords,
                  onAdd: () => _addKeyword(
                    controller: _keywordController,
                    target: _keywords,
                    update: (value) => _keywords = value,
                  ),
                  onRemove: (keyword) =>
                      setState(() => _keywords.remove(keyword)),
                ),
                const SizedBox(height: 12),
                _KeywordEditor(
                  label: 'Alternative keywords',
                  controller: _alternativeKeywordController,
                  keywords: _alternativeKeywords,
                  onAdd: () => _addKeyword(
                    controller: _alternativeKeywordController,
                    target: _alternativeKeywords,
                    update: (value) => _alternativeKeywords = value,
                  ),
                  onRemove: (keyword) =>
                      setState(() => _alternativeKeywords.remove(keyword)),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Required component'),
                  value: _isRequired,
                  onChanged: (value) => setState(() => _isRequired = value),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Allow alternatives'),
                  value: _canBeSubstituted,
                  onChanged: (value) =>
                      setState(() => _canBeSubstituted = value),
                ),
                TextFormField(
                  controller: _notesController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _errorMessage!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _save,
          child: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _KeywordEditor extends StatelessWidget {
  const _KeywordEditor({
    required this.label,
    required this.controller,
    required this.keywords,
    required this.onAdd,
    required this.onRemove,
  });

  final String label;
  final TextEditingController controller;
  final List<String> keywords;
  final VoidCallback onAdd;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                decoration: const InputDecoration(
                  hintText: 'Add keyword',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onSubmitted: (_) => onAdd(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: keywords.length >= 5 ? null : onAdd,
              icon: const Icon(Icons.add_rounded),
              tooltip: 'Add keyword',
            ),
          ],
        ),
        if (keywords.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: keywords
                .map(
                  (keyword) => InputChip(
                    label: Text(keyword),
                    onDeleted: () => onRemove(keyword),
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }
}

String formatAdminComponentSummary(AdminLearningProjectComponent component) {
  final parts = <String>[
    '${component.quantity} ${component.unit}',
    formatAdminComponentRoleLabel(component.componentRole),
    component.materialType,
    if (component.category != null) component.category!.nameEn,
    if (!component.isRequired) 'optional',
    if (component.canBeSubstituted) 'alternatives allowed',
    if (component.searchKeywords.isNotEmpty)
      'keywords: ${component.searchKeywords.join(', ')}',
    if (component.alternativeKeywords.isNotEmpty)
      'alt keywords: ${component.alternativeKeywords.join(', ')}',
    if (component.notes != null && component.notes!.trim().isNotEmpty)
      component.notes!.trim(),
  ];
  return parts.join(' · ');
}

Widget buildAdminComponentQualityChips(
  List<AdminComponentQualityIssue> issues,
) {
  if (issues.isEmpty) {
    return const SizedBox.shrink();
  }

  return Wrap(
    spacing: 6,
    runSpacing: 6,
    children: issues
        .map(
          (issue) => Chip(
            visualDensity: VisualDensity.compact,
            label: Text(issue.message),
            backgroundColor: issue.isHard
                ? Colors.red.withValues(alpha: 0.12)
                : Colors.orange.withValues(alpha: 0.12),
          ),
        )
        .toList(),
  );
}
