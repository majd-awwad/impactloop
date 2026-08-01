import 'package:flutter/material.dart';

class AppDropdownField<T> extends StatelessWidget {
  const AppDropdownField({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.validator,
    this.hint,
    this.errorText,
  });

  final String label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final String? Function(T?)? validator;
  final String? hint;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      key: ValueKey<T?>(value),
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        floatingLabelBehavior: FloatingLabelBehavior.always,
      ),
      items: items
          .map(
            (item) => DropdownMenuItem<T>(
              value: item.value,
              enabled: item.enabled,
              alignment: item.alignment,
              child: _ellipsisDropdownChild(item.child),
            ),
          )
          .toList(),
      selectedItemBuilder: (context) => items
          .map(
            (item) => Align(
              alignment: AlignmentDirectional.centerStart,
              child: _ellipsisDropdownChild(item.child),
            ),
          )
          .toList(),
      onChanged: onChanged,
      validator: validator,
      forceErrorText: errorText,
    );
  }
}

Widget _ellipsisDropdownChild(Widget? child) {
  if (child is Text) {
    return Text(
      child.data ?? '',
      style: child.style,
      overflow: TextOverflow.ellipsis,
      maxLines: 1,
      textAlign: child.textAlign,
    );
  }

  return child ?? const SizedBox.shrink();
}
