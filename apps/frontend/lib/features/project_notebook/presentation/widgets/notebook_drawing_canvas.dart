import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../domain/models/project_build_notebook.dart';

enum NotebookDrawingTool { pen, eraser }

class NotebookDrawingCanvas extends StatefulWidget {
  const NotebookDrawingCanvas({
    super.key,
    required this.strokes,
    required this.readOnly,
    required this.onStrokesChanged,
    this.selectedColor = '#1F2937',
    this.selectedWidth = 2.0,
    this.selectedTool = NotebookDrawingTool.pen,
  });

  final List<NotebookStroke> strokes;
  final bool readOnly;
  final ValueChanged<List<NotebookStroke>> onStrokesChanged;
  final String selectedColor;
  final double selectedWidth;
  final NotebookDrawingTool selectedTool;

  @override
  State<NotebookDrawingCanvas> createState() => NotebookDrawingCanvasState();
}

class NotebookDrawingCanvasState extends State<NotebookDrawingCanvas> {
  final List<List<NotebookStroke>> _undoStack = [];
  final List<List<NotebookStroke>> _redoStack = [];
  List<NotebookStroke> _currentStrokes = [];
  NotebookStroke? _activeStroke;
  final List<NotebookPoint> _eraserPoints = [];
  int? _activePointer;
  Size _canvasSize = Size.zero;

  @override
  void initState() {
    super.initState();
    _currentStrokes = List<NotebookStroke>.from(widget.strokes);
  }

  @override
  void didUpdateWidget(covariant NotebookDrawingCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.strokes != widget.strokes &&
        !_listsEqual(oldWidget.strokes, widget.strokes)) {
      _currentStrokes = List<NotebookStroke>.from(widget.strokes);
      _undoStack.clear();
      _redoStack.clear();
      _activeStroke = null;
      _activePointer = null;
      _eraserPoints.clear();
    }
  }

  bool get canUndo => _undoStack.isNotEmpty;
  bool get canRedo => _redoStack.isNotEmpty;

  void undo() {
    if (!canUndo || widget.readOnly) {
      return;
    }
    _redoStack.add(List<NotebookStroke>.from(_currentStrokes));
    _currentStrokes = _undoStack.removeLast();
    widget.onStrokesChanged(_currentStrokes);
    setState(() {});
  }

  void redo() {
    if (!canRedo || widget.readOnly) {
      return;
    }
    _undoStack.add(List<NotebookStroke>.from(_currentStrokes));
    _currentStrokes = _redoStack.removeLast();
    widget.onStrokesChanged(_currentStrokes);
    setState(() {});
  }

  Future<void> clearDrawing() async {
    if (widget.readOnly || _currentStrokes.isEmpty) {
      return;
    }
    _pushUndo();
    _currentStrokes = [];
    widget.onStrokesChanged(_currentStrokes);
    setState(() {});
  }

  void _pushUndo() {
    _undoStack.add(List<NotebookStroke>.from(_currentStrokes));
    _redoStack.clear();
  }

  bool _isPrimaryPointer(PointerDownEvent event) {
    if (event.kind == PointerDeviceKind.mouse) {
      return event.buttons == kPrimaryMouseButton;
    }
    return true;
  }

  void _handlePointerDown(PointerDownEvent event) {
    if (widget.readOnly || _activePointer != null) {
      return;
    }
    if (!_isPrimaryPointer(event)) {
      return;
    }
    if (_canvasSize.width <= 0 || _canvasSize.height <= 0) {
      return;
    }

    _activePointer = event.pointer;
    final point = _normalize(event.localPosition);

    if (widget.selectedTool == NotebookDrawingTool.pen) {
      _pushUndo();
      _activeStroke = NotebookStroke(
        id: createNotebookStableId(),
        color: widget.selectedColor,
        width: widget.selectedWidth,
        points: [point],
      );
    } else {
      _eraserPoints
        ..clear()
        ..add(point);
    }
    setState(() {});
  }

  void _handlePointerMove(PointerMoveEvent event) {
    if (widget.readOnly || _activePointer != event.pointer) {
      return;
    }
    if (_canvasSize.width <= 0 || _canvasSize.height <= 0) {
      return;
    }

    final point = _normalize(event.localPosition);

    if (widget.selectedTool == NotebookDrawingTool.pen) {
      final stroke = _activeStroke;
      if (stroke == null) {
        return;
      }
      final last = stroke.points.last;
      if ((last.x - point.x).abs() < 0.0005 &&
          (last.y - point.y).abs() < 0.0005) {
        return;
      }
      _activeStroke = stroke.copyWith(
        points: [...stroke.points, point],
      );
    } else {
      _eraserPoints.add(point);
    }
    setState(() {});
  }

  void _handlePointerEnd(int pointer) {
    if (_activePointer != pointer) {
      return;
    }
    _activePointer = null;

    if (widget.readOnly) {
      return;
    }

    if (widget.selectedTool == NotebookDrawingTool.pen) {
      final stroke = _activeStroke;
      _activeStroke = null;
      if (stroke == null || stroke.points.length < 2) {
        if (_undoStack.isNotEmpty) {
          _undoStack.removeLast();
        }
        setState(() {});
        return;
      }
      _currentStrokes = [..._currentStrokes, stroke];
      widget.onStrokesChanged(_currentStrokes);
    } else if (_eraserPoints.isNotEmpty) {
      _pushUndo();
      _currentStrokes = _eraseStrokes(_currentStrokes, _eraserPoints);
      _eraserPoints.clear();
      widget.onStrokesChanged(_currentStrokes);
    }
    setState(() {});
  }

  List<NotebookStroke> _eraseStrokes(
    List<NotebookStroke> strokes,
    List<NotebookPoint> eraserPath,
  ) {
    const threshold = 0.02;
    return strokes
        .where((stroke) {
          for (final strokePoint in stroke.points) {
            for (final eraserPoint in eraserPath) {
              final dx = strokePoint.x - eraserPoint.x;
              final dy = strokePoint.y - eraserPoint.y;
              if (math.sqrt(dx * dx + dy * dy) <= threshold) {
                return false;
              }
            }
          }
          return true;
        })
        .toList();
  }

  NotebookPoint _normalize(Offset position) {
    return NotebookPoint(
      x: (position.dx / _canvasSize.width).clamp(0.0, 1.0),
      y: (position.dy / _canvasSize.height).clamp(0.0, 1.0),
    );
  }

  bool _listsEqual(List<NotebookStroke> a, List<NotebookStroke> b) {
    if (a.length != b.length) {
      return false;
    }
    for (var index = 0; index < a.length; index += 1) {
      if (a[index].id != b[index].id) {
        return false;
      }
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final palette = Theme.of(context).colorScheme;
    final strokes = [
      ..._currentStrokes,
      ?_activeStroke,
    ];

    return AspectRatio(
      aspectRatio: 4 / 3,
      child: LayoutBuilder(
        builder: (context, constraints) {
          _canvasSize = Size(constraints.maxWidth, constraints.maxHeight);

          return DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: palette.outlineVariant),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: RawGestureDetector(
                gestures: <Type, GestureRecognizerFactory>{
                  EagerGestureRecognizer:
                      GestureRecognizerFactoryWithHandlers<EagerGestureRecognizer>(
                    () => EagerGestureRecognizer(),
                    (EagerGestureRecognizer instance) {},
                  ),
                },
                child: Listener(
                  behavior: HitTestBehavior.opaque,
                  onPointerDown: _handlePointerDown,
                  onPointerMove: _handlePointerMove,
                  onPointerUp: (event) => _handlePointerEnd(event.pointer),
                  onPointerCancel: (event) => _handlePointerEnd(event.pointer),
                  child: RepaintBoundary(
                    child: CustomPaint(
                      painter: _NotebookStrokePainter(
                        strokes: strokes,
                        showGrid: true,
                      ),
                      child: const SizedBox.expand(),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _NotebookStrokePainter extends CustomPainter {
  _NotebookStrokePainter({
    required this.strokes,
    required this.showGrid,
  });

  final List<NotebookStroke> strokes;
  final bool showGrid;

  @override
  void paint(Canvas canvas, Size size) {
    if (showGrid) {
      final gridPaint = Paint()
        ..color = const Color(0xFFE5E7EB)
        ..strokeWidth = 1;
      const spacing = 24.0;
      for (var x = 0.0; x <= size.width; x += spacing) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
      }
      for (var y = 0.0; y <= size.height; y += spacing) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
      }
    }

    for (final stroke in strokes) {
      if (stroke.points.isEmpty) {
        continue;
      }
      final paint = Paint()
        ..color = _parseColor(stroke.color)
        ..strokeWidth = stroke.width
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..isAntiAlias = true;

      if (stroke.points.length == 1) {
        final point = stroke.points.first;
        canvas.drawCircle(
          Offset(point.x * size.width, point.y * size.height),
          stroke.width / 2,
          paint..style = PaintingStyle.fill,
        );
        continue;
      }

      final path = Path();
      final first = stroke.points.first;
      path.moveTo(first.x * size.width, first.y * size.height);
      for (var index = 1; index < stroke.points.length; index += 1) {
        final point = stroke.points[index];
        path.lineTo(point.x * size.width, point.y * size.height);
      }
      canvas.drawPath(path, paint);
    }
  }

  Color _parseColor(String value) {
    final hex = value.replaceAll('#', '');
    final parsed = int.parse(hex, radix: 16);
    return Color(0xFF000000 | parsed);
  }

  @override
  bool shouldRepaint(covariant _NotebookStrokePainter oldDelegate) {
    return oldDelegate.strokes != strokes || oldDelegate.showGrid != showGrid;
  }
}
