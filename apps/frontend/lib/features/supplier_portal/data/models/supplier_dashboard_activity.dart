class SupplierDashboardActivity {
  const SupplierDashboardActivity({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final DateTime createdAt;

  factory SupplierDashboardActivity.fromJson(Map<String, dynamic> json) {
    return SupplierDashboardActivity(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
