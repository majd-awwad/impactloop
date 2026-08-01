import 'package:flutter/material.dart';

/// Resolves reading direction from the first strong character in [text].
///
/// Arabic and other RTL scripts render RTL even when the app UI locale is LTR,
/// and Latin content renders LTR when the app UI is Arabic.
TextDirection resolveContentTextDirection(String text) {
  for (final rune in text.runes) {
    if (_isNeutralRune(rune)) {
      continue;
    }
    if (_isRtlRune(rune)) {
      return TextDirection.rtl;
    }
    return TextDirection.ltr;
  }
  return TextDirection.ltr;
}

bool _isNeutralRune(int rune) {
  return rune <= 0x0020 ||
      rune == 0x00A0 ||
      (rune >= 0x2000 && rune <= 0x200F) ||
      (rune >= 0x2028 && rune <= 0x202F) ||
      rune == 0xFEFF;
}

bool _isRtlRune(int rune) {
  return (rune >= 0x0590 && rune <= 0x08FF) ||
      (rune >= 0xFB1D && rune <= 0xFDFF) ||
      (rune >= 0xFE70 && rune <= 0xFEFF);
}

/// Renders [text] using content-aware direction without changing app direction.
class ContentDirectionalText extends StatelessWidget {
  const ContentDirectionalText(
    this.text, {
    super.key,
    this.style,
    this.maxLines,
    this.overflow,
    this.textAlign,
    this.semanticsLabel,
  });

  final String text;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final TextAlign? textAlign;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final direction = resolveContentTextDirection(text);
    return Text(
      text,
      style: style,
      maxLines: maxLines,
      overflow: overflow,
      textAlign: textAlign,
      textDirection: direction,
      semanticsLabel: semanticsLabel,
    );
  }
}
