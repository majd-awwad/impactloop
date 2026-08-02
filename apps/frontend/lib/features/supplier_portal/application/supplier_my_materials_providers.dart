import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../data/models/supplier_my_materials_models.dart';
import '../data/models/supplier_related_projects.dart';
import '../data/supplier_my_materials_repository.dart';
import 'supplier_portal_session.dart';

class SupplierMyMaterialsQueryNotifier
    extends Notifier<SupplierMyMaterialsQuery> {
  @override
  SupplierMyMaterialsQuery build() => const SupplierMyMaterialsQuery();

  void updateQuery(SupplierMyMaterialsQuery query) {
    state = query;
  }

  void reset() {
    state = const SupplierMyMaterialsQuery();
  }
}

final supplierMyMaterialsQueryProvider =
    NotifierProvider<
      SupplierMyMaterialsQueryNotifier,
      SupplierMyMaterialsQuery
    >(SupplierMyMaterialsQueryNotifier.new);

final supplierMyMaterialsProvider =
    FutureProvider.autoDispose<SupplierMyMaterialsListResult>((ref) async {
      watchSupplierPortalSessionFromRef(ref);
      final auth = ref.watch(authControllerProvider);

      if (!auth.isAuthenticated) {
        throw const ApiException(
          message: 'Sign in as a supplier to view your materials.',
          code: 'UNAUTHORIZED',
        );
      }

      final query = ref.watch(supplierMyMaterialsQueryProvider);
      return ref
          .watch(supplierMyMaterialsRepositoryProvider)
          .listMaterials(query);
    });

final supplierMyMaterialByIdProvider = FutureProvider.autoDispose
    .family<SupplierMyMaterial, String>((ref, materialId) async {
      final auth = ref.watch(authControllerProvider);

      if (!auth.isAuthenticated) {
        throw const ApiException(
          message: 'Sign in as a supplier to view your materials.',
          code: 'UNAUTHORIZED',
        );
      }

      return ref
          .watch(supplierMyMaterialsRepositoryProvider)
          .getMaterial(materialId);
    });

final supplierMaterialRelatedProjectsProvider = FutureProvider.autoDispose
    .family<SupplierRelatedProjectsResult, String>((ref, materialId) async {
      final auth = ref.watch(authControllerProvider);

      if (!auth.isAuthenticated) {
        throw const ApiException(
          message: 'Sign in as a supplier to view your materials.',
          code: 'UNAUTHORIZED',
        );
      }

      return ref
          .watch(supplierMyMaterialsRepositoryProvider)
          .getRelatedProjects(materialId);
    });

void invalidateSupplierMyMaterials(WidgetRef ref) {
  ref.invalidate(supplierMyMaterialsProvider);
}
