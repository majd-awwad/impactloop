import 'package:flutter/widgets.dart';

class BidiText extends StatelessWidget {
  const BidiText(
    this.data, {
    super.key,
    this.style,
    this.maxLines,
    this.overflow,
    this.textAlign,
    this.technical = false,
  });

  final String data;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final TextAlign? textAlign;
  final bool technical;

  @override
  Widget build(BuildContext context) {
    return Text(
      data,
      style: style,
      maxLines: maxLines,
      overflow: overflow,
      textAlign: textAlign,
      textDirection: technical ? TextDirection.ltr : contentTextDirection(data),
    );
  }
}

TextDirection contentTextDirection(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return TextDirection.ltr;
  if (_technicalValue.hasMatch(trimmed)) return TextDirection.ltr;
  return _arabic.hasMatch(trimmed) ? TextDirection.rtl : TextDirection.ltr;
}

final _arabic = RegExp(r'[\u0600-\u06FF]');
final _technicalValue = RegExp(
  r'^(?:https?://|www\.|[^\s@]+@[^\s@]+\.[^\s@]+|\+?[\d\s().-]{6,}|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)',
  caseSensitive: false,
);
