import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../materials/data/models/category.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/learning_project_draft_component.dart';
import '../theme/learning_ui_palette.dart';

class LearningProjectComponentEditor extends StatelessWidget {
  const LearningProjectComponentEditor({
    super.key,
    required this.components,
    required this.materialCategories,
    required this.onChanged,
    required this.onAdd,
    required this.onRemove,
    this.validator,
  });

  final List<LearningProjectDraftComponent> components;
  final List<MaterialCategory> materialCategories;
  final ValueChanged<List<LearningProjectDraftComponent>> onChanged;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;
  final String? Function(List<LearningProjectDraftComponent> components)?
  validator;

  @override
  Widget build(BuildContext context) {
    final validationMessage = validator?.call(components);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < components.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.md),
          _ComponentCard(
            component: components[index],
            materialCategories: materialCategories,
            canRemove: components.length > 1,
            onChanged: (component) {
              final next = [...components];
              next[index] = component;
              onChanged(next);
            },
            onRemove: () => onRemove(index),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add_rounded),
          label: Text(
            const LocalizedText(
              en: 'Add component',
              ar: 'إضافة مكوّن',
            ).resolve(context),
          ),
        ),
        if (validationMessage != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            validationMessage,
            style: AppTextStyles.body(context).copyWith(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }
}

class _ComponentCard extends StatefulWidget {
  const _ComponentCard({
    required this.component,
    required this.materialCategories,
    required this.canRemove,
    required this.onChanged,
    required this.onRemove,
  });

  final LearningProjectDraftComponent component;
  final List<MaterialCategory> materialCategories;
  final bool canRemove;
  final ValueChanged<LearningProjectDraftComponent> onChanged;
  final VoidCallback onRemove;

  @override
  State<_ComponentCard> createState() => _ComponentCardState();
}

class _ComponentCardState extends State<_ComponentCard> {
  late final TextEditingController _nameController;
  late final TextEditingController _quantityController;
  late final TextEditingController _customUnitController;
  late final TextEditingController _materialTypeController;
  late final TextEditingController _keywordController;
  late final TextEditingController _notesController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.component.name);
    _quantityController = TextEditingController(
      text: _formatQuantity(widget.component.quantity),
    );
    _customUnitController = TextEditingController(
      text: LearningProjectDraftComponent.unitOptions.contains(
            widget.component.unit,
          )
          ? ''
          : widget.component.unit,
    );
    _materialTypeController = TextEditingController(
      text: widget.component.materialTypeHint,
    );
    _keywordController = TextEditingController();
    _notesController = TextEditingController(text: widget.component.notes);
  }

  @override
  void didUpdateWidget(covariant _ComponentCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.component.name != widget.component.name &&
        _nameController.text != widget.component.name) {
      _nameController.text = widget.component.name;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _quantityController.dispose();
    _customUnitController.dispose();
    _materialTypeController.dispose();
    _keywordController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  String _formatQuantity(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }
    return value.toString();
  }

  void _emit(LearningProjectDraftComponent next) {
    widget.onChanged(next);
  }

  void _scheduleEmit(LearningProjectDraftComponent next) {
    if (next == widget.component) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onChanged(next);
    });
  }

  void _commitKeywordDraft() {
    final component = widget.component;
    final pending = _keywordController.text;
    if (pending.trim().isEmpty) {
      return;
    }

    final merged = LearningProjectDraftComponent.mergeKeywords(
      existing: component.keywords,
      draft: pending,
    );
    if (merged.length <= component.keywords.length &&
        pending.trim() == component.keywordDraft.trim()) {
      return;
    }

    _keywordController.clear();
    _emit(
      component.copyWith(
        keywords: merged,
        keywordDraft: '',
      ),
    );
  }

  String _resolvedUnit(LearningProjectDraftComponent component) {
    if (component.unit == 'other') {
      final custom = _customUnitController.text.trim();
      return custom.isEmpty ? 'piece' : custom;
    }
    return component.unit;
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final component = widget.component;
    final unitValue = LearningProjectDraftComponent.unitOptions.contains(
      component.unit,
    )
        ? component.unit
        : 'other';

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  const LocalizedText(
                    en: 'Component',
                    ar: 'مكوّن',
                  ).resolve(context),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ),
              if (widget.canRemove)
                IconButton(
                  onPressed: widget.onRemove,
                  tooltip: const LocalizedText(
                    en: 'Remove component',
                    ar: 'إزالة المكوّن',
                  ).resolve(context),
                  icon: Icon(Icons.close_rounded, color: palette.textSecondary),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AppTextField(
            controller: _nameController,
            label: 'Component name',
            hint: 'Ultrasonic sensor',
            textInputAction: TextInputAction.next,
            onChanged: (value) => _emit(component.copyWith(name: value)),
          ),
          const SizedBox(height: AppSpacing.sm),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 560;
              final quantityField = AppTextField(
                controller: _quantityController,
                label: 'Quantity',
                hint: '1',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (value) {
                  final parsed = double.tryParse(value.replaceAll(',', '.'));
                  if (parsed != null && parsed > 0) {
                    _emit(component.copyWith(quantity: parsed));
                  }
                },
              );
              final unitField = AppDropdownField<String>(
                label: 'Unit',
                value: unitValue,
                items: [
                  for (final unit in LearningProjectDraftComponent.unitOptions)
                    DropdownMenuItem<String>(
                      value: unit,
                      child: Text(
                        unit == 'other'
                            ? const LocalizedText(
                                en: 'Other',
                                ar: 'أخرى',
                              ).resolve(context)
                            : unit,
                      ),
                    ),
                ],
                onChanged: (value) {
                  if (value == null) return;
                  _emit(component.copyWith(unit: value));
                },
              );

              if (wide) {
                return Row(
                  children: [
                    Expanded(child: quantityField),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: unitField),
                  ],
                );
              }

              return Column(
                children: [
                  quantityField,
                  const SizedBox(height: AppSpacing.sm),
                  unitField,
                ],
              );
            },
          ),
          if (unitValue == 'other') ...[
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              controller: _customUnitController,
              label: 'Custom unit',
              hint: 'sheet',
              onChanged: (_) => _emit(
                component.copyWith(unit: _resolvedUnit(component)),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Text(
            const LocalizedText(en: 'Role', ar: 'الدور').resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: LearningProjectComponentRole.values.map((role) {
              final selected = component.role == role;
              return FilterChip(
                label: Text(
                  LocalizedText(
                    en: role.labelEn(),
                    ar: role.labelAr(),
                  ).resolve(context),
                ),
                selected: selected,
                onSelected: (_) => _emit(component.copyWith(role: role)),
                selectedColor: palette.lime,
                checkmarkColor: palette.textPrimary,
                backgroundColor: palette.cardSurface,
                side: BorderSide(
                  color: selected ? palette.lime : palette.borderSubtle,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              initiallyExpanded: component.showAdvanced,
              tilePadding: EdgeInsets.zero,
              title: Text(
                const LocalizedText(
                  en: 'Help us match materials',
                  ar: 'ساعدنا في مطابقة المواد',
                ).resolve(context),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              subtitle: Text(
                const LocalizedText(
                  en:
                      'Skip this if you are not sure — we can still use the component name.',
                  ar: 'يمكنك تخطي هذا إن لم تكن متأكداً — سنستخدم اسم المكوّن.',
                ).resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary, fontSize: 12),
              ),
              onExpansionChanged: (expanded) {
                if (expanded == component.showAdvanced) {
                  return;
                }
                _scheduleEmit(component.copyWith(showAdvanced: expanded));
              },
              children: [
                if (widget.materialCategories.isNotEmpty) ...[
                  AppDropdownField<String>(
                    label: 'Material category',
                    value: LearningProjectDraftComponent.materialCategoryDropdownValue(
                      component.materialCategoryId,
                    ),
                    hint: 'Optional',
                    items: [
                      const DropdownMenuItem<String>(
                        value: LearningProjectDraftComponent.noMaterialCategoryValue,
                        child: Text('None'),
                      ),
                      for (final category in widget.materialCategories)
                        DropdownMenuItem<String>(
                          value: category.id,
                          child: Text(
                            LocalizedText(
                              en: category.nameEn,
                              ar: category.nameAr.isEmpty
                                  ? category.nameEn
                                  : category.nameAr,
                            ).resolve(context),
                          ),
                        ),
                    ],
                    onChanged: (value) {
                      if (value == null ||
                          value == LearningProjectDraftComponent.noMaterialCategoryValue) {
                        _emit(component.copyWith(clearMaterialCategoryId: true));
                        return;
                      }

                      _emit(component.copyWith(materialCategoryId: value));
                    },
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                AppTextField(
                  controller: _materialTypeController,
                  label: 'Material type hint',
                  hint: 'Distance sensor',
                  onChanged: (value) =>
                      _emit(component.copyWith(materialTypeHint: value)),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: AppTextField(
                        controller: _keywordController,
                        label: 'Add keyword',
                        hint: 'hc-sr04',
                        textInputAction: TextInputAction.done,
                        onChanged: (value) =>
                            _emit(component.copyWith(keywordDraft: value)),
                        onFieldSubmitted: (_) => _commitKeywordDraft(),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Padding(
                      padding: const EdgeInsets.only(top: 22),
                      child: OutlinedButton(
                        onPressed: _commitKeywordDraft,
                        child: Text(
                          const LocalizedText(
                            en: 'Add',
                            ar: 'إضافة',
                          ).resolve(context),
                        ),
                      ),
                    ),
                  ],
                ),
                if (component.keywords.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: component.keywords.map((keyword) {
                      return InputChip(
                        label: Text(keyword),
                        onDeleted: () => _emit(
                          component.copyWith(
                            keywords: component.keywords
                                .where((entry) => entry != keyword)
                                .toList(growable: false),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    const LocalizedText(
                      en: 'Alternatives are acceptable',
                      ar: 'البدائل مقبولة',
                    ).resolve(context),
                  ),
                  subtitle: Text(
                    const LocalizedText(
                      en:
                          'Use this when builders can use similar materials instead of the exact component.',
                      ar:
                          'استخدم هذا عندما يمكن للبنّاءين استخدام مواد مشابهة بدلاً من المكوّن نفسه.',
                    ).resolve(context),
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary, fontSize: 12),
                  ),
                  value: component.canBeSubstituted,
                  onChanged: (value) =>
                      _emit(component.copyWith(canBeSubstituted: value)),
                ),
                AppTextArea(
                  controller: _notesController,
                  label: 'Notes / specifications',
                  hint: 'Optional details for reviewers.',
                  minLines: 2,
                  maxLines: 4,
                  onChanged: (value) => _emit(component.copyWith(notes: value)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
