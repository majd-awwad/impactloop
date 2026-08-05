import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../../../shared/models/localized_text.dart';
import '../../domain/models/project_build_notebook.dart';
import '../l10n/project_notebook_l10n.dart';

class NotebookPdfExportInput {
  const NotebookPdfExportInput({
    required this.document,
    required this.projectTitle,
    required this.attemptNumber,
    required this.learnerName,
    required this.languageCode,
    required this.exportedAt,
  });

  final NotebookDocument document;
  final String projectTitle;
  final int attemptNumber;
  final String? learnerName;
  final String languageCode;
  final DateTime exportedAt;
}

Future<Uint8List> buildNotebookPdfBytes(NotebookPdfExportInput input) async {
  final isArabic = input.languageCode == 'ar';
  final fontData = await rootBundle.load(
    'assets/fonts/NotoSansArabic-VariableFont_wdth,wght.ttf',
  );
  final font = pw.Font.ttf(fontData);
  final theme = pw.ThemeData.withFont(base: font, bold: font);
  final doc = pw.Document(theme: theme);
  final textDirection = isArabic ? pw.TextDirection.rtl : pw.TextDirection.ltr;
  final drawingImages = <int, Uint8List>{};
  for (var index = 0; index < input.document.pages.length; index += 1) {
    final strokes = input.document.pages[index].strokes;
    if (strokes.isEmpty) {
      continue;
    }
    final imageBytes = await _renderStrokesPng(strokes);
    if (imageBytes != null) {
      drawingImages[index] = imageBytes;
    }
  }

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      textDirection: textDirection,
      build: (context) {
        final widgets = <pw.Widget>[
          pw.Text(
            _resolve(ProjectNotebookL10n.impactLoop, input.languageCode),
            style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            _resolve(ProjectNotebookL10n.projectNotebook, input.languageCode),
            style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 4),
          pw.Text(input.projectTitle),
          pw.SizedBox(height: 4),
          pw.Text(
            '${_resolve(ProjectNotebookL10n.attemptNumber, input.languageCode)} ${input.attemptNumber}',
          ),
          if (input.learnerName != null && input.learnerName!.trim().isNotEmpty)
            pw.Text(input.learnerName!.trim()),
          pw.SizedBox(height: 4),
          pw.Text(
            '${_resolve(ProjectNotebookL10n.exportDate, input.languageCode)}: ${input.exportedAt.toLocal()}',
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            _resolve(ProjectNotebookL10n.privateNotebookLabel, input.languageCode),
            style: const pw.TextStyle(color: PdfColors.green700),
          ),
          pw.SizedBox(height: 16),
        ];

        for (var index = 0; index < input.document.pages.length; index += 1) {
          final page = input.document.pages[index];
          widgets.add(
            pw.Text(
              '${index + 1}. ${page.title}',
              style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold),
            ),
          );
          if (page.text.trim().isNotEmpty) {
            widgets
              ..add(pw.SizedBox(height: 6))
              ..add(pw.Text(page.text));
          }
          final imageBytes = drawingImages[index];
          if (imageBytes != null) {
            widgets
              ..add(pw.SizedBox(height: 8))
              ..add(
                pw.Image(
                  pw.MemoryImage(imageBytes),
                  width: 420,
                  height: 315,
                  fit: pw.BoxFit.contain,
                ),
              );
          }
          widgets.add(pw.SizedBox(height: 18));
        }

        return widgets;
      },
    ),
  );

  return doc.save();
}

Future<Uint8List?> _renderStrokesPng(List<NotebookStroke> strokes) async {
  const width = 840.0;
  const height = 630.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final background = Paint()..color = Colors.white;
  canvas.drawRect(const Rect.fromLTWH(0, 0, width, height), background);

  for (final stroke in strokes) {
    if (stroke.points.length < 2) {
      continue;
    }
    final paint = Paint()
      ..color = _flutterColor(stroke.color)
      ..strokeWidth = stroke.width
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    final path = Path();
    final first = stroke.points.first;
    path.moveTo(first.x * width, first.y * height);
    for (var index = 1; index < stroke.points.length; index += 1) {
      final point = stroke.points[index];
      path.lineTo(point.x * width, point.y * height);
    }
    canvas.drawPath(path, paint);
  }

  final picture = recorder.endRecording();
  final image = await picture.toImage(width.toInt(), height.toInt());
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  return byteData?.buffer.asUint8List();
}

Color _flutterColor(String hex) {
  final value = int.parse(hex.replaceAll('#', ''), radix: 16);
  return Color(0xFF000000 | value);
}

String _resolve(LocalizedText text, String languageCode) {
  return languageCode == 'ar' ? text.ar : text.en;
}

String sanitizeNotebookPdfFilename({
  required String projectTitle,
  required int attemptNumber,
}) {
  final sanitized = projectTitle
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\u0600-\u06FF]+'), '-')
      .replaceAll(RegExp(r'-+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  final safeTitle = sanitized.isEmpty ? 'project' : sanitized;
  return 'impactloop-project-notebook-$safeTitle-attempt-$attemptNumber.pdf';
}
