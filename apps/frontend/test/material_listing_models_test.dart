import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/materials/data/models/material_listing_policy.dart';
import 'package:frontend/features/materials/data/models/material_price_check_result.dart';
import 'package:frontend/features/materials/data/models/material_type.dart';

void main() {
  test('MaterialType.fromJson parses search item with aliases', () {
    final materialType = MaterialType.fromJson({
      'id': 'mt_1',
      'nameEn': 'Wax Molds',
      'nameAr': 'قوالب شمع',
      'normalizedName': 'wax molds',
      'defaultUnit': 'piece',
      'category': {
        'id': 'cat_1',
        'nameEn': 'Art, Craft & Molding',
        'nameAr': 'فن وحرف وقوالب',
      },
      'hasActivePriceRule': true,
      'aliases': ['Candle molds', 'قوالب شمع'],
    });

    expect(materialType.nameEn, 'Wax Molds');
    expect(materialType.normalizedName, 'wax molds');
    expect(materialType.hasActivePriceRule, isTrue);
    expect(materialType.aliases, hasLength(2));
  });

  test('MaterialListingPolicy.fromJson parses policy flags', () {
    final policy = MaterialListingPolicy.fromJson({
      'currency': 'NIS',
      'currencySymbol': '₪',
      'freeAllowed': true,
      'paidAllowed': true,
      'otherAllowedForFree': true,
      'otherAllowedForPaid': false,
      'paidRequiresApprovedMaterialType': true,
      'paidRequiresActivePriceRule': true,
      'message': 'Free listings may use Other.',
    });

    expect(policy.otherAllowedForPaid, isFalse);
    expect(policy.paidRequiresActivePriceRule, isTrue);
  });

  test('MaterialPriceCheckResult.fromJson parses material review required', () {
    final result = MaterialPriceCheckResult.fromJson({
      'allowed': false,
      'reason': 'MATERIAL_REVIEW_REQUIRED',
      'currency': 'NIS',
      'currencySymbol': '₪',
      'matchedReference': null,
      'candidates': [],
      'message':
          'We could not verify this paid material yet. Submit it for review.',
    });

    expect(result.allowed, isFalse);
    expect(result.reason, 'MATERIAL_REVIEW_REQUIRED');
    expect(result.candidates, isEmpty);
  });

  test('MaterialPriceCheckResult.fromJson parses blocked response', () {
    final result = MaterialPriceCheckResult.fromJson({
      'allowed': false,
      'reason': 'PRICE_TOO_HIGH',
      'currency': 'NIS',
      'currencySymbol': '₪',
      'maxAllowedPrice': 20,
      'message': 'Price is above the allowed limit for this material.',
    });

    expect(result.allowed, isFalse);
    expect(result.reason, 'PRICE_TOO_HIGH');
    expect(result.maxAllowedPrice, 20);
  });

  test('MaterialPriceCheckResult.fromJson parses matched reference', () {
    final result = MaterialPriceCheckResult.fromJson({
      'allowed': true,
      'currency': 'NIS',
      'currencySymbol': '₪',
      'maxAllowedPrice': 60,
      'priceRuleId': 'rule_1',
      'materialTypeId': 'mt_1',
      'matchedReference': {
        'id': 'mt_1',
        'nameEn': 'Wax Molds',
        'nameAr': 'قوالب شمع',
        'unit': 'piece',
      },
      'message': 'Price verified.',
    });

    expect(result.allowed, isTrue);
    expect(result.matchedReference?.nameEn, 'Wax Molds');
    expect(result.matchedReference?.unit, 'piece');
    expect(result.priceRuleId, 'rule_1');
  });

  test('MaterialPriceCheckResult.fromJson parses ambiguous candidates', () {
    final result = MaterialPriceCheckResult.fromJson({
      'allowed': false,
      'reason': 'AMBIGUOUS_MATERIAL_MATCH',
      'currency': 'NIS',
      'currencySymbol': '₪',
      'candidates': [
        {
          'id': 'mt_1',
          'nameEn': 'Arduino Uno',
          'nameAr': null,
          'unit': 'piece',
        },
        {
          'id': 'mt_2',
          'nameEn': 'Motor Driver',
          'nameAr': null,
          'unit': 'piece',
        },
      ],
      'message': 'We found multiple possible matches.',
    });

    expect(result.candidates, hasLength(2));
    expect(result.candidates.first.displayLabel(), 'Arduino Uno');
  });
}
