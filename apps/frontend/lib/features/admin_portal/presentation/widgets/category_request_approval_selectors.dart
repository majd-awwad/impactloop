part of 'category_request_approval_dialog.dart';

class _ExistingResolution extends StatelessWidget {
  const _ExistingResolution({
    required this.item,
    required this.options,
    required this.selectedId,
    required this.errorText,
    required this.conflictCategory,
    required this.onSelected,
    required this.onRetry,
  });
  final AdminCategoryRequestListItem item;
  final AsyncValue<List<AdminApprovalCategoryOption>> options;
  final String? selectedId;
  final String? errorText;
  final AdminApprovalCategoryOption? conflictCategory;
  final ValueChanged<String> onSelected;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    return _Section(
      title: l.useExistingCategory,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.suggestedExistingCategory,
            style: AdminTypography.kpiHelper(palette),
          ),
          const SizedBox(height: 8),
          if (item.suggestedCategory != null)
            _CategoryOptionCard(
              category: item.suggestedCategory!,
              selected: item.suggestedCategory!.id == selectedId,
              matchLabel: item.suggestedCategory!.isExactNameSuggestion
                  ? l.exactNameMatch
                  : l.possibleNameMatch,
              actionLabel: l.useThisCategory,
              onPressed: () => onSelected(item.suggestedCategory!.id),
            )
          else
            _SelectorStatus(
              icon: const Icon(Icons.info_outline, size: 17),
              message: l.noSimilarCategories,
            ),
          const SizedBox(height: 14),
          Text(
            l.searchOtherCategories,
            style: AdminTypography.kpiHelper(palette),
          ),
          const SizedBox(height: 7),
          options.when(
            loading: () => _SelectorStatus(
              icon: const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              message: l.loadingCategories,
            ),
            error: (_, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _InlineError(message: l.failedCategories),
                TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 17),
                  label: Text(l.retry),
                ),
              ],
            ),
            data: (values) {
              final merged = <AdminApprovalCategoryOption>[
                ...values,
                if (conflictCategory != null &&
                    !values.any((value) => value.id == conflictCategory!.id))
                  conflictCategory!,
              ];
              if (merged.isEmpty) {
                return _SelectorStatus(
                  icon: const Icon(Icons.info_outline, size: 17),
                  message: l.noCategoriesAvailable,
                );
              }
              AdminApprovalCategoryOption? selected;
              for (final option in merged) {
                if (option.id == selectedId) selected = option;
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _ExistingCategorySelector(
                    options: merged,
                    selectedId: selectedId,
                    errorText: errorText,
                    onSelected: onSelected,
                  ),
                  if (selected != null) ...[
                    const SizedBox(height: 10),
                    _CategoryOptionCard(category: selected, selected: true),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CategoryOptionCard extends StatelessWidget {
  const _CategoryOptionCard({
    required this.category,
    required this.selected,
    this.actionLabel,
    this.onPressed,
    this.matchLabel,
  });
  final AdminApprovalCategoryOption category;
  final bool selected;
  final String? actionLabel;
  final VoidCallback? onPressed;
  final String? matchLabel;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final family = category.materialFamily;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: selected
            ? palette.green.withValues(alpha: .07)
            : palette.cardBackground,
        border: Border.all(
          color: selected ? palette.green : palette.cardBorder,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: palette.green.withValues(alpha: .12),
            child: Icon(
              Icons.category_outlined,
              size: 17,
              color: palette.green,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.isArabic ? category.nameAr : category.nameEn,
                  style: TextStyle(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (matchLabel != null) ...[
                  const SizedBox(height: 4),
                  AppStatusBadge(
                    label: matchLabel!,
                    tone: category.isExactNameSuggestion
                        ? AppStatusTone.warning
                        : AppStatusTone.info,
                  ),
                ],
                if (category.nameEn.trim() != category.nameAr.trim()) ...[
                  const SizedBox(height: 2),
                  Directionality(
                    textDirection: l.isArabic
                        ? TextDirection.ltr
                        : TextDirection.rtl,
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        l.isArabic ? category.nameEn : category.nameAr,
                        style: AdminTypography.kpiHelper(palette),
                      ),
                    ),
                  ),
                ],
                if (family != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    l.isArabic ? family.labelAr : family.labelEn,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        family.canonicalKey,
                        style: AdminTypography.kpiHelper(
                          palette,
                        ).copyWith(fontSize: 10.5),
                      ),
                    ),
                  ),
                ],
                Text(
                  l.materialUsageCount(category.materialCount),
                  style: AdminTypography.kpiHelper(palette),
                ),
              ],
            ),
          ),
          if (onPressed != null)
            TextButton(onPressed: onPressed, child: Text(actionLabel!))
          else if (selected)
            Icon(Icons.check_circle, color: palette.green, size: 20),
        ],
      ),
    );
  }
}

class _ExistingCategorySelector extends StatefulWidget {
  const _ExistingCategorySelector({
    required this.options,
    required this.selectedId,
    required this.errorText,
    required this.onSelected,
  });
  final List<AdminApprovalCategoryOption> options;
  final String? selectedId;
  final String? errorText;
  final ValueChanged<String> onSelected;

  @override
  State<_ExistingCategorySelector> createState() =>
      _ExistingCategorySelectorState();
}

class _ExistingCategorySelectorState extends State<_ExistingCategorySelector> {
  final MenuController _menu = MenuController();
  final TextEditingController _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final query = _search.text.trim().toLowerCase();
    final filtered = widget.options.where((option) {
      final family = option.materialFamily;
      return query.isEmpty ||
          option.nameEn.toLowerCase().contains(query) ||
          option.nameAr.toLowerCase().contains(query) ||
          (family?.canonicalKey.toLowerCase().contains(query) ?? false);
    }).toList();
    AdminApprovalCategoryOption? selected;
    for (final option in widget.options) {
      if (option.id == widget.selectedId) selected = option;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final menuWidth = constraints.maxWidth.clamp(
          220.0,
          MediaQuery.sizeOf(context).width - 32,
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l.existingCategory,
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 7),
            MenuAnchor(
              controller: _menu,
              crossAxisUnconstrained: false,
              alignmentOffset: const Offset(0, 6),
              menuChildren: [
                SizedBox(
                  key: const Key('existing-category-menu'),
                  width: menuWidth,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(10),
                        child: TextField(
                          key: const Key('existing-category-search'),
                          controller: _search,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: l.searchCategories,
                            prefixIcon: const Icon(Icons.search, size: 19),
                            isDense: true,
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: MediaQuery.sizeOf(
                            context,
                          ).height.clamp(180, 280).toDouble(),
                        ),
                        child: SingleChildScrollView(
                          primary: false,
                          child: Column(
                            children: [
                              for (final option in filtered)
                                MenuItemButton(
                                  onPressed: () {
                                    widget.onSelected(option.id);
                                    _search.clear();
                                    _menu.close();
                                  },
                                  child: SizedBox(
                                    width: menuWidth - 48,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          l.isArabic
                                              ? option.nameAr
                                              : option.nameEn,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        if (option.nameEn.trim() !=
                                            option.nameAr.trim())
                                          Text(
                                            l.isArabic
                                                ? option.nameEn
                                                : option.nameAr,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(
                                              context,
                                            ).textTheme.bodySmall,
                                          ),
                                        if (option.materialFamily != null)
                                          Directionality(
                                            textDirection: TextDirection.ltr,
                                            child: Text(
                                              option
                                                  .materialFamily!
                                                  .canonicalKey,
                                              style: Theme.of(
                                                context,
                                              ).textTheme.bodySmall,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              builder: (context, controller, _) => InkWell(
                key: const Key('existing-category-selector'),
                onTap: controller.isOpen ? controller.close : controller.open,
                child: InputDecorator(
                  isEmpty: selected == null,
                  decoration: InputDecoration(
                    errorText: widget.errorText,
                    border: const OutlineInputBorder(),
                    suffixIcon: const Icon(Icons.expand_more),
                  ),
                  child: Text(
                    selected == null
                        ? l.chooseExistingCategory
                        : (l.isArabic ? selected.nameAr : selected.nameEn),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SelectorStatus extends StatelessWidget {
  const _SelectorStatus({required this.icon, required this.message});
  final Widget icon;
  final String message;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: palette.cardBorder),
        borderRadius: BorderRadius.circular(11),
      ),
      child: Row(
        children: [
          icon,
          const SizedBox(width: 9),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _MaterialFamilySelector extends StatefulWidget {
  const _MaterialFamilySelector({
    required this.options,
    required this.selectedId,
    required this.errorText,
    required this.onSelected,
  });
  final List<AdminTaxonomyOption> options;
  final String? selectedId;
  final String? errorText;
  final ValueChanged<String> onSelected;

  @override
  State<_MaterialFamilySelector> createState() =>
      _MaterialFamilySelectorState();
}

class _MaterialFamilySelectorState extends State<_MaterialFamilySelector> {
  final MenuController _menu = MenuController();
  final TextEditingController _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    AdminTaxonomyOption? selected;
    for (final option in widget.options) {
      if (option.id == widget.selectedId) selected = option;
    }
    final query = _search.text.trim().toLowerCase();
    final filtered = widget.options.where((option) {
      return query.isEmpty ||
          option.labelEn.toLowerCase().contains(query) ||
          option.labelAr.toLowerCase().contains(query) ||
          option.canonicalKey.toLowerCase().contains(query);
    }).toList();
    final label = selected == null
        ? l.chooseMaterialFamily
        : (l.isArabic ? selected.labelAr : selected.labelEn);

    return LayoutBuilder(
      builder: (context, constraints) {
        final menuWidth = constraints.maxWidth.clamp(
          220.0,
          MediaQuery.sizeOf(context).width - 32,
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MenuAnchor(
              controller: _menu,
              alignmentOffset: const Offset(0, 6),
              menuChildren: [
                SizedBox(
                  key: const Key('material-family-menu'),
                  width: menuWidth,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          key: const Key('material-family-search'),
                          controller: _search,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: l.searchMaterialFamilies,
                            prefixIcon: const Icon(Icons.search, size: 19),
                            isDense: true,
                            border: const OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            maxHeight: MediaQuery.sizeOf(
                              context,
                            ).height.clamp(180, 280).toDouble(),
                          ),
                          child: SingleChildScrollView(
                            primary: false,
                            child: Column(
                              children: [
                                for (final option in filtered)
                                  MenuItemButton(
                                    onPressed: () {
                                      widget.onSelected(option.id);
                                      _search.clear();
                                      _menu.close();
                                    },
                                    leadingIcon: Icon(
                                      option.id == widget.selectedId
                                          ? Icons.check_circle_outline
                                          : Icons.account_tree_outlined,
                                      size: 18,
                                    ),
                                    child: SizedBox(
                                      width: menuWidth - 85,
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            l.isArabic
                                                ? option.labelAr
                                                : option.labelEn,
                                          ),
                                          Directionality(
                                            textDirection: TextDirection.ltr,
                                            child: Text(
                                              option.canonicalKey,
                                              style: AdminTypography.kpiHelper(
                                                palette,
                                              ).copyWith(fontSize: 11),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              builder: (context, controller, child) => InkWell(
                key: const Key('material-family-selector'),
                onTap: () =>
                    controller.isOpen ? controller.close() : controller.open(),
                borderRadius: BorderRadius.circular(11),
                child: InputDecorator(
                  decoration: InputDecoration(
                    errorText: widget.errorText,
                    border: const OutlineInputBorder(),
                    suffixIcon: const Icon(Icons.expand_more),
                  ),
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ),
            if (selected != null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: palette.green.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.check_circle_outline,
                      color: palette.green,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l.activeMapping,
                            style: TextStyle(
                              color: palette.green,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Directionality(
                            textDirection: TextDirection.ltr,
                            child: Text(
                              selected.canonicalKey,
                              style: AdminTypography.kpiHelper(palette),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
