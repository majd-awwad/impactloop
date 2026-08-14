import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../deliveries/data/models/saved_dropoff_address.dart';
import 'reservation_form_theme.dart';

/// Formats the secondary line for a saved address (city · area / short summary).
String formatSavedAddressSecondaryLine(SavedDropoffLocation location) {
  final city = location.city.trim();
  final area = location.area?.trim();
  final addressLine = location.addressLine?.trim();

  if (city.isNotEmpty && area != null && area.isNotEmpty) {
    return '$city · $area';
  }

  if (city.isNotEmpty && addressLine != null && addressLine.isNotEmpty) {
    final shortLine = addressLine.length > 42
        ? '${addressLine.substring(0, 39)}…'
        : addressLine;
    return '$city · $shortLine';
  }

  if (city.isNotEmpty) {
    return city;
  }

  if (area != null && area.isNotEmpty) {
    return area;
  }

  if (addressLine != null && addressLine.isNotEmpty) {
    return addressLine.length > 48
        ? '${addressLine.substring(0, 45)}…'
        : addressLine;
  }

  final country = location.country.trim();
  return country.isNotEmpty ? country : '';
}

SavedDropoffAddress? resolveDisplayedSavedAddress({
  required List<SavedDropoffAddress> addresses,
  required String? selectedAddressId,
}) {
  if (addresses.isEmpty) {
    return null;
  }

  if (selectedAddressId != null) {
    for (final address in addresses) {
      if (address.id == selectedAddressId) {
        return address;
      }
    }
  }

  for (final address in addresses) {
    if (address.isDefault) {
      return address;
    }
  }

  return addresses.first;
}

/// Polished saved-address selector for the reservation delivery form.
class ReservationSavedAddressSelector extends StatelessWidget {
  const ReservationSavedAddressSelector({
    super.key,
    required this.addresses,
    required this.selectedAddressId,
    required this.onAddressSelected,
    this.enabled = true,
  });

  final List<SavedDropoffAddress> addresses;
  final String? selectedAddressId;
  final ValueChanged<SavedDropoffAddress> onAddressSelected;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (addresses.isEmpty) {
      return const SizedBox.shrink();
    }

    final displayed = resolveDisplayedSavedAddress(
      addresses: addresses,
      selectedAddressId: selectedAddressId,
    );
    if (displayed == null) {
      return const SizedBox.shrink();
    }

    if (addresses.length == 1) {
      return _SavedAddressTile(
        key: const ValueKey('reservation-saved-address-display'),
        address: displayed,
        showChevron: false,
        showCheck: false,
      );
    }

    return _SavedAddressMenu(
      key: const ValueKey('reservation-saved-address-dropdown'),
      addresses: addresses,
      selectedAddressId: selectedAddressId ?? displayed.id,
      enabled: enabled,
      onAddressSelected: onAddressSelected,
    );
  }
}

class _SavedAddressMenu extends StatefulWidget {
  const _SavedAddressMenu({
    super.key,
    required this.addresses,
    required this.selectedAddressId,
    required this.enabled,
    required this.onAddressSelected,
  });

  final List<SavedDropoffAddress> addresses;
  final String selectedAddressId;
  final bool enabled;
  final ValueChanged<SavedDropoffAddress> onAddressSelected;

  @override
  State<_SavedAddressMenu> createState() => _SavedAddressMenuState();
}

class _SavedAddressMenuState extends State<_SavedAddressMenu> {
  final _menuController = MenuController();

  @override
  void dispose() {
    _menuController.close();
    super.dispose();
  }

  SavedDropoffAddress get _selectedAddress {
    return widget.addresses.firstWhere(
      (address) => address.id == widget.selectedAddressId,
      orElse: () => widget.addresses.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return MenuAnchor(
      controller: _menuController,
      alignmentOffset: const Offset(0, 6),
      style: MenuStyle(
        padding: const WidgetStatePropertyAll(
          EdgeInsetsDirectional.symmetric(vertical: AppSpacing.xs),
        ),
        backgroundColor: WidgetStatePropertyAll(palette.panelSurface),
        elevation: const WidgetStatePropertyAll(6),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: AppRadius.mdAll,
            side: BorderSide(color: palette.borderSubtle),
          ),
        ),
        minimumSize: const WidgetStatePropertyAll(Size(280, 0)),
        maximumSize: WidgetStatePropertyAll(
          Size(MediaQuery.sizeOf(context).width - 32, 360),
        ),
      ),
      menuChildren: widget.addresses
          .map(
            (address) => _SavedAddressMenuItem(
              address: address,
              selected: address.id == widget.selectedAddressId,
              onTap: widget.enabled
                  ? () {
                      widget.onAddressSelected(address);
                      _menuController.close();
                    }
                  : null,
            ),
          )
          .toList(),
      builder: (context, controller, child) {
        return _SavedAddressTile(
          address: _selectedAddress,
          showChevron: true,
          showCheck: false,
          enabled: widget.enabled,
          isOpen: controller.isOpen,
          onTap: widget.enabled
              ? () {
                  if (controller.isOpen) {
                    controller.close();
                  } else {
                    controller.open();
                  }
                }
              : null,
        );
      },
    );
  }
}

class _SavedAddressMenuItem extends StatelessWidget {
  const _SavedAddressMenuItem({
    required this.address,
    required this.selected,
    required this.onTap,
  });

  final SavedDropoffAddress address;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return MenuItemButton(
      key: ValueKey('reservation-saved-address-option-${address.id}'),
      onPressed: onTap,
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size.fromHeight(56)),
        padding: const WidgetStatePropertyAll(
          EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
        ),
        overlayColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.hovered) ||
              states.contains(WidgetState.focused)) {
            return palette.borderSubtle.withValues(alpha: 0.35);
          }
          return null;
        }),
      ),
      child: _SavedAddressTile(
        address: address,
        showChevron: false,
        showCheck: selected,
        compact: true,
        enabled: onTap != null,
      ),
    );
  }
}

class _SavedAddressTile extends StatelessWidget {
  const _SavedAddressTile({
    super.key,
    required this.address,
    required this.showChevron,
    required this.showCheck,
    this.compact = false,
    this.enabled = true,
    this.isOpen = false,
    this.onTap,
  });

  final SavedDropoffAddress address;
  final bool showChevron;
  final bool showCheck;
  final bool compact;
  final bool enabled;
  final bool isOpen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final secondaryLine = formatSavedAddressSecondaryLine(address.location);

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(
          Icons.location_on_outlined,
          size: compact
              ? ReservationFormTheme.metaIconSize
              : ReservationFormTheme.sectionIconSize,
          color: enabled ? palette.textSecondary : palette.textMuted,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                address.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body(context).copyWith(
                  color: enabled ? palette.textPrimary : palette.textMuted,
                  fontWeight: FontWeight.w600,
                  fontSize: compact ? 13 : 14,
                ),
              ),
              if (secondaryLine.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  secondaryLine,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ReservationFormTheme.helperStyle(
                    context,
                    palette,
                  ).copyWith(fontSize: compact ? 11 : 12),
                ),
              ],
            ],
          ),
        ),
        if (address.isDefault) ...[
          const SizedBox(width: AppSpacing.xs),
          _DefaultBadge(
            key: ValueKey('reservation-saved-address-default-badge-${address.id}'),
            label: l10n.savedAddressDefaultBadge,
          ),
        ],
        if (showCheck) ...[
          const SizedBox(width: AppSpacing.xs),
          Icon(
            Icons.check_circle_rounded,
            size: 18,
            color: palette.mint,
          ),
        ],
        if (showChevron) ...[
          const SizedBox(width: AppSpacing.xs),
          Icon(
            isOpen
                ? Icons.keyboard_arrow_up_rounded
                : Icons.keyboard_arrow_down_rounded,
            size: 22,
            color: enabled ? palette.textSecondary : palette.textMuted,
          ),
        ],
      ],
    );

    if (onTap == null && !compact) {
      return Container(
        constraints: const BoxConstraints(minHeight: 52, maxHeight: 64),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: palette.panelSurface,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: content,
      );
    }

    if (compact) {
      return content;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        hoverColor: palette.borderSubtle.withValues(alpha: 0.35),
        child: Ink(
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: isOpen ? palette.mint : palette.borderSubtle,
              width: isOpen ? 1.5 : 1,
            ),
          ),
          child: Container(
            constraints: const BoxConstraints(minHeight: 52, maxHeight: 64),
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.sm,
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}

class _DefaultBadge extends StatelessWidget {
  const _DefaultBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 6,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.08),
        borderRadius: AppRadius.smAll,
        border: Border.all(color: palette.mint.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.mint,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
