import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_profile.dart';
import 'package:frontend/features/supplier_portal/data/supplier_profile_api.dart';
import 'package:frontend/features/profile/data/models/uploaded_profile_image.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/supplier_portal/data/models/update_supplier_profile_images_request.dart';

void main() {
  group('SupplierProfileManagement', () {
    test(
      'parses the canonical identity, private location, organization, and server completion',
      () {
        final profile = SupplierProfileManagement.fromJson({
          'hasSupplierProfile': true,
          'identity': {
            'supplierProfileId': 'supplier_1',
            'publicName': 'Impact Workshop',
            'supplierType': 'WORKSHOP',
            'description': 'Reusable workshop materials',
            'avatarImageUrl': null,
            'coverImageUrl': 'https://cdn.example/cover.webp',
          },
          'pickupLocation': {
            'id': 'location_1',
            'country': 'Palestine',
            'city': 'Nablus',
            'area': 'Rafidia',
            'addressLine': 'Private address',
            'latitude': '32.22',
            'longitude': 35.26,
            'visibility': 'ORDER_ONLY',
            'isApproximate': false,
            'locationType': 'PICKUP_POINT',
          },
          'organization': {
            'id': 'organization_1',
            'organizationName': 'Impact Workshop',
            'organizationType': 'WORKSHOP',
            'contactPersonName': 'Owner',
            'workingDays': ['MONDAY', 'WEDNESDAY'],
            'workingHours': {'from': '09:00', 'to': '16:00'},
          },
          'verification': {
            'rawStatus': 'APPROVED',
            'status': 'APPROVED',
            'isVerified': true,
            'canSubmit': false,
            'canResubmit': false,
            'adminNote': null,
            'submittedAt': '2026-07-01T08:00:00Z',
            'reviewedAt': '2026-07-02T08:00:00Z',
          },
          'completion': {
            'completedCount': 5,
            'totalCount': 5,
            'percentage': 100,
            'missingFields': [],
          },
        });

        expect(profile.identity?.supplierProfileId, 'supplier_1');
        expect(profile.identity?.supplierType, 'WORKSHOP');
        expect(profile.identity?.avatarImageUrl, isNull);
        expect(profile.pickupLocation?.id, 'location_1');
        expect(profile.pickupLocation?.latitude, 32.22);
        expect(profile.pickupLocation?.longitude, 35.26);
        expect(profile.organization?.workingDays, ['MONDAY', 'WEDNESDAY']);
        expect(profile.organization?.workingHours?['from'], '09:00');
        expect(profile.verification.status, 'APPROVED');
        expect(profile.verification.isVerified, isTrue);
        expect(profile.completion.percentage, 100);
      },
    );

    test('keeps incomplete and unknown canonical values safe', () {
      final profile = SupplierProfileManagement.fromJson({
        'hasSupplierProfile': true,
        'identity': {'supplierProfileId': 'supplier_2'},
        'pickupLocation': {'id': 'location_2', 'visibility': 'FUTURE_VALUE'},
        'organization': {
          'workingDays': ['MONDAY', 42],
          'workingHours': 'malformed',
        },
        'verification': {
          'rawStatus': 'FUTURE_STATUS',
          'status': 'UNKNOWN',
          'isVerified': false,
          'canSubmit': false,
          'canResubmit': false,
        },
        'completion': {
          'completedCount': 1,
          'totalCount': 5,
          'percentage': 20,
          'missingFields': ['DESCRIPTION', 'FUTURE_FIELD'],
        },
      });

      expect(profile.pickupLocation?.visibility, 'FUTURE_VALUE');
      expect(profile.organization?.workingDays, isNull);
      expect(profile.organization?.workingHours, isNull);
      expect(profile.verification.isVerified, isFalse);
      expect(profile.verification.canResubmit, isFalse);
      expect(profile.completion.missingFields, ['DESCRIPTION', 'FUTURE_FIELD']);
    });

    test('normalizes legacy VERIFIED and preserves server action flags', () {
      final profile = SupplierProfileManagement.fromJson({
        'hasSupplierProfile': true,
        'verification': {
          'rawStatus': 'VERIFIED',
          'status': 'VERIFIED',
          'isVerified': true,
          'canSubmit': false,
          'canResubmit': false,
          'adminNote': null,
        },
        'completion': {
          'completedCount': '3',
          'totalCount': '5',
          'percentage': '60',
          'missingFields': ['DESCRIPTION', 'FUTURE_FIELD'],
        },
      });

      expect(profile.verification.rawStatus, 'VERIFIED');
      expect(profile.verification.status, 'APPROVED');
      expect(profile.verification.canSubmit, isFalse);
      expect(profile.completion.completedCount, 3);
      expect(profile.completion.percentage, 60);
      expect(profile.completion.missingFields, ['DESCRIPTION', 'FUTURE_FIELD']);
    });

    test(
      'keeps public approximation and supported visibility values separate',
      () {
        for (final visibility in ['PUBLIC', 'ORDER_ONLY', 'PRIVATE']) {
          final profile = SupplierProfileManagement.fromJson({
            'hasSupplierProfile': true,
            'pickupLocation': {
              'id': 'location_$visibility',
              'country': 'Palestine',
              'city': 'Nablus',
              'latitude': 32.22,
              'longitude': '35.26',
              'visibility': visibility,
              'isApproximate': visibility == 'PUBLIC',
            },
            'verification': {},
            'completion': {},
          });

          expect(profile.pickupLocation?.visibility, visibility);
          expect(profile.pickupLocation?.isApproximate, visibility == 'PUBLIC');
          expect(profile.pickupLocation?.latitude, 32.22);
          expect(profile.pickupLocation?.longitude, 35.26);
        }
      },
    );

    test('supports a missing organization and zero completion response', () {
      final profile = SupplierProfileManagement.fromJson({
        'hasSupplierProfile': false,
        'identity': null,
        'pickupLocation': null,
        'organization': null,
        'verification': null,
        'completion': {
          'completedCount': 0,
          'totalCount': 5,
          'percentage': 0,
          'missingFields': [
            'PUBLIC_NAME',
            'SUPPLIER_TYPE',
            'DESCRIPTION',
            'PICKUP_LOCATION',
            'LOCATION_VISIBILITY',
          ],
        },
      });

      expect(profile.hasSupplierProfile, isFalse);
      expect(profile.identity, isNull);
      expect(profile.organization, isNull);
      expect(profile.verification.status, 'UNKNOWN');
      expect(profile.completion.completedCount, 0);
      expect(profile.completion.totalCount, 5);
    });
  });

  test('fetchManagementProfile uses the canonical manage endpoint', () async {
    final dio = Dio();
    final adapter = _ManagementAdapter();
    dio.httpClientAdapter = adapter;

    await SupplierProfileApi(dio).fetchManagementProfile();

    expect(adapter.path, '/api/supplier/profile/manage');
  });

  test(
    'profile image upload uses profile storage and the image field',
    () async {
      final dio = Dio();
      final adapter = _UploadAdapter();
      dio.httpClientAdapter = adapter;

      final image = await ProfileApi(dio).uploadProfileImage(
        const PendingProfileImage(
          bytes: [1, 2, 3],
          fileName: 'avatar.png',
          mimeType: 'image/png',
        ),
      );

      expect(adapter.path, '/api/uploads/profile-image');
      expect(adapter.formData?.files.single.key, 'image');
      expect(image.url, '/uploads/profiles/avatar.png');
    },
  );

  test('profile image patch sends only the selected profile field', () async {
    final dio = Dio();
    final adapter = _PatchAdapter();
    dio.httpClientAdapter = adapter;

    await SupplierProfileApi(dio).updateProfileImages(
      const UpdateSupplierProfileImagesRequest(
        coverImageUrl: '/uploads/profiles/cover.webp',
      ),
    );

    expect(adapter.path, '/api/supplier/profile/images');
    expect(adapter.data, {'coverImageUrl': '/uploads/profiles/cover.webp'});
  });
}

class _ManagementAdapter implements HttpClientAdapter {
  String? path;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    path = options.path;
    return ResponseBody.fromString(
      '{"success":true,"data":{"hasSupplierProfile":false,"verification":{},"completion":{}}}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

class _UploadAdapter implements HttpClientAdapter {
  String? path;
  FormData? formData;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    path = options.path;
    formData = options.data as FormData?;
    return ResponseBody.fromString(
      '{"success":true,"data":{"image":{"url":"/uploads/profiles/avatar.png","filename":"avatar.png","mimeType":"image/png","sizeBytes":3}}}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

class _PatchAdapter implements HttpClientAdapter {
  String? path;
  Map<String, dynamic>? data;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    path = options.path;
    data = Map<String, dynamic>.from(options.data as Map);
    return ResponseBody.fromString(
      '{"success":true,"data":{"hasSupplierProfile":true,"user":{},"stats":{},"latestFollowers":[],"materialsPreview":[]}}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
