import type { MaterialCondition } from '../../generated/prisma/client.js';



import {

  DEFAULT_CURRENCY,

  DEFAULT_CURRENCY_SYMBOL,

  MATERIAL_CONDITION_FACTORS,

} from '../../constants/material-condition-factors.js';

import { MATERIAL_LISTING_POLICY } from '../../constants/material-listing-policy.js';

import { isOtherCategory } from '../categories/categories.repository.js';

import * as categoriesRepository from '../categories/categories.repository.js';

import * as materialTypesRepository from '../material-types/material-types.repository.js';

import {

  mapMatchedReferenceDto,

  matchMaterialReference,

} from '../../services/material-reference-matching.service.js';

import { decimalToNumber, roundCurrency } from '../../utils/decimal.js';

import { AppError } from '../../utils/app-error.js';

import type { PriceCheckInput } from './materials.validation.js';



export type PriceCheckReason =

  | 'PRICE_RULE_REQUIRED'

  | 'UNIT_MISMATCH'

  | 'PRICE_TOO_HIGH'

  | 'PAID_OTHER_NOT_ALLOWED'

  | 'MATERIAL_REVIEW_REQUIRED'

  | 'AMBIGUOUS_MATERIAL_MATCH'

  | 'INVALID_CURRENCY'

  | 'INVALID_PRICE'

  | 'CATEGORY_NOT_FOUND'

  | 'PRICE_RULE_INVALID'

  | 'MATERIAL_TYPE_REQUIRED'

  | 'OTHER_NOT_ALLOWED_FOR_PAID'

  | 'MATERIAL_TYPE_NOT_FOUND';



export type MatchedReferenceDto = {

  id: string;

  nameEn: string;

  nameAr: string | null;

  unit: string;

};



export type PriceCheckResult = {

  allowed: boolean;

  reason?: PriceCheckReason;

  currency: string;

  currencySymbol: string;

  maxAllowedPrice?: number | null;

  priceRuleId?: string | null;

  materialTypeId?: string | null;

  matchedReference?: MatchedReferenceDto | null;

  approvedUnit?: string | null;

  candidates: MatchedReferenceDto[];

  message: string;

};



export const getListingPolicy = () => MATERIAL_LISTING_POLICY;



const buildAllowedResult = (

  maxAllowedPrice: number | null,

  priceRuleId: string | null = null,

  materialTypeId: string | null = null,

  matchedReference: MatchedReferenceDto | null = null,

): PriceCheckResult => ({

  allowed: true,

  currency: DEFAULT_CURRENCY,

  currencySymbol: DEFAULT_CURRENCY_SYMBOL,

  maxAllowedPrice,

  priceRuleId,

  materialTypeId,

  matchedReference,

  candidates: [],

  message: 'Price verified.',

});



const buildBlockedResult = (

  reason: PriceCheckReason,

  message: string,

  options: {

    maxAllowedPrice?: number | null;

    priceRuleId?: string | null;

    materialTypeId?: string | null;

    matchedReference?: MatchedReferenceDto | null;

    approvedUnit?: string | null;

    candidates?: MatchedReferenceDto[];

  } = {},

): PriceCheckResult => ({

  allowed: false,

  reason,

  currency: DEFAULT_CURRENCY,

  currencySymbol: DEFAULT_CURRENCY_SYMBOL,

  maxAllowedPrice: options.maxAllowedPrice ?? null,

  priceRuleId: options.priceRuleId ?? null,

  materialTypeId: options.materialTypeId ?? null,

  matchedReference: options.matchedReference ?? null,

  approvedUnit: options.approvedUnit ?? null,

  candidates: options.candidates ?? [],

  message,

});



export const calculateMaxAllowedPrice = (input: {

  maxAllowedUnitPriceNis: number | null;

  maxAllowedTotalPriceNis: number | null;

  quantity: number;

  condition: MaterialCondition;

}): number | null => {

  const conditionFactor = MATERIAL_CONDITION_FACTORS[input.condition];



  if (input.maxAllowedUnitPriceNis != null) {

    return roundCurrency(input.maxAllowedUnitPriceNis * conditionFactor);

  }



  if (

    input.maxAllowedTotalPriceNis != null &&

    input.quantity > 0

  ) {

    return roundCurrency(

      (input.maxAllowedTotalPriceNis / input.quantity) * conditionFactor,

    );

  }



  return null;

};



const resolveMaterialTypeForPaidCheck = async (

  input: PriceCheckInput,

): Promise<

  | {

      ok: true;

      materialType: NonNullable<

        Awaited<ReturnType<typeof materialTypesRepository.findMaterialTypeById>>

      >;

      confidence?: 'EXACT' | 'ALIAS' | 'PARTIAL';

    }

  | { ok: false; result: PriceCheckResult }

> => {

  if (input.materialTypeId) {

    const materialType = await materialTypesRepository.findMaterialTypeById(

      input.materialTypeId,

    );



    if (!materialType || !materialType.isActive) {

      return {

        ok: false,

        result: buildBlockedResult(

          'MATERIAL_REVIEW_REQUIRED',

          'We could not verify this paid material yet. Submit it for review.',

        ),

      };

    }



    return { ok: true, materialType };

  }



  const materialName = input.materialName?.trim();



  if (!materialName) {

    return {

      ok: false,

      result: buildBlockedResult(

        'MATERIAL_REVIEW_REQUIRED',

        'We could not verify this paid material yet. Submit it for review.',

      ),

    };

  }



  const matchResult = await matchMaterialReference({

    materialName,

    categoryId: input.categoryId,

  });



  if (matchResult.status === 'NO_MATCH') {

    return {

      ok: false,

      result: buildBlockedResult(

        'MATERIAL_REVIEW_REQUIRED',

        'We could not verify this paid material yet. Submit it for review.',

      ),

    };

  }



  if (matchResult.status === 'AMBIGUOUS') {

    return {

      ok: false,

      result: buildBlockedResult(

        'AMBIGUOUS_MATERIAL_MATCH',

        'We found multiple possible matches. Please clarify the material name or category.',

        {

          candidates: matchResult.candidates.map(mapMatchedReferenceDto),

        },

      ),

    };

  }



  const materialType = await materialTypesRepository.findMaterialTypeById(

    matchResult.materialType.id,

  );



  if (!materialType || !materialType.isActive) {

    return {

      ok: false,

      result: buildBlockedResult(

        'MATERIAL_REVIEW_REQUIRED',

        'We could not verify this paid material yet. Submit it for review.',

      ),

    };

  }



  return {

    ok: true,

    materialType,

    confidence: matchResult.confidence,

  };

};



const runPriceRuleCheck = async (

  input: PriceCheckInput,

  materialType: NonNullable<

    Awaited<ReturnType<typeof materialTypesRepository.findMaterialTypeById>>

  >,

): Promise<PriceCheckResult> => {

  const matchedReference = mapMatchedReferenceDto({

    id: materialType.id,

    nameEn: materialType.nameEn,

    nameAr: materialType.nameAr,

    defaultUnit: materialType.defaultUnit,

    categoryId: materialType.categoryId,

  });



  const activeRule = await materialTypesRepository.findActivePriceRuleForMaterialType(

    materialType.id,

    input.unit,

  );



  if (!activeRule) {

    const activeRuleForDifferentUnit =

      await materialTypesRepository.findActivePriceRuleForMaterialType(

        materialType.id,

      );



    if (activeRuleForDifferentUnit) {

      return buildBlockedResult(

        'UNIT_MISMATCH',

        'Please use the approved unit for this material.',

        {

          materialTypeId: materialType.id,

          matchedReference,

          approvedUnit: activeRuleForDifferentUnit.unit,

        },

      );

    }



    return buildBlockedResult(

      'PRICE_RULE_REQUIRED',

      'This material needs an active price reference before paid listing.',

      {

        materialTypeId: materialType.id,

        matchedReference,

      },

    );

  }



  const maxAllowedPrice = calculateMaxAllowedPrice({

    maxAllowedUnitPriceNis: decimalToNumber(activeRule.maxAllowedUnitPriceNis),

    maxAllowedTotalPriceNis: decimalToNumber(activeRule.maxAllowedTotalPriceNis),

    quantity: input.quantity,

    condition: input.condition,

  });



  if (maxAllowedPrice == null) {

    return buildBlockedResult(

      'PRICE_RULE_INVALID',

      'This material has an invalid active price reference.',

      {

        materialTypeId: materialType.id,

        matchedReference,

      },

    );

  }



  if (input.price == null || input.price <= 0) {

    return buildBlockedResult(

      'INVALID_PRICE',

      'Paid listings must have a price greater than zero.',

    );

  }



  if (input.price > maxAllowedPrice) {

    const unitLabel = activeRule.unit;

    return buildBlockedResult(

      'PRICE_TOO_HIGH',

      `Maximum allowed price per ${unitLabel} is ${maxAllowedPrice} NIS.`,

      {

        maxAllowedPrice,

        materialTypeId: materialType.id,

        matchedReference,

        approvedUnit: unitLabel,

      },

    );

  }



  return buildAllowedResult(

    maxAllowedPrice,

    activeRule.id,

    materialType.id,

    matchedReference,

  );

};



export const checkMaterialPrice = async (

  input: PriceCheckInput,

): Promise<PriceCheckResult> => {

  const category = await categoriesRepository.findCategoryById(input.categoryId);



  if (!category) {

    return buildBlockedResult(

      'CATEGORY_NOT_FOUND',

      'Selected category was not found. Choose a category and try again.',

    );

  }



  if (input.isFree) {

    const materialName = input.materialName?.trim();

    let matchedReference: MatchedReferenceDto | null = null;

    let materialTypeId: string | null = input.materialTypeId ?? null;



    if (materialName) {

      const matchResult = await matchMaterialReference({

        materialName,

        categoryId: input.categoryId,

      });



      if (matchResult.status === 'MATCHED') {

        matchedReference = mapMatchedReferenceDto(matchResult.materialType);

        materialTypeId = matchResult.materialType.id;

      }

    } else if (input.materialTypeId) {

      const materialType = await materialTypesRepository.findMaterialTypeById(

        input.materialTypeId,

      );



      if (materialType?.isActive) {

        matchedReference = mapMatchedReferenceDto({

          id: materialType.id,

          nameEn: materialType.nameEn,

          nameAr: materialType.nameAr,

          defaultUnit: materialType.defaultUnit,

          categoryId: materialType.categoryId,

        });

      }

    }



    return {

      allowed: true,

      currency: DEFAULT_CURRENCY,

      currencySymbol: DEFAULT_CURRENCY_SYMBOL,

      maxAllowedPrice: null,

      priceRuleId: null,

      materialTypeId,

      matchedReference,

      candidates: [],

      message: 'Free listing allowed.',

    };

  }



  if (input.currency !== DEFAULT_CURRENCY) {

    return buildBlockedResult(

      'INVALID_CURRENCY',

      'Paid listings must use NIS.',

    );

  }



  if (input.price == null || input.price <= 0) {

    return buildBlockedResult(

      'INVALID_PRICE',

      'Paid listings must have a price greater than zero.',

    );

  }



  if (isOtherCategory(category.nameEn)) {

    return buildBlockedResult(

      'PAID_OTHER_NOT_ALLOWED',

      'Paid listings cannot use Other. Submit this material for review.',

    );

  }



  const resolved = await resolveMaterialTypeForPaidCheck(input);



  if (!resolved.ok) {

    return resolved.result;

  }



  return runPriceRuleCheck(input, resolved.materialType);

};



export const resolveMaterialReferenceForCreate = async (input: {

  materialName: string;

  categoryId: string;

  isFree: boolean;

}) => {

  const matchResult = await matchMaterialReference({

    materialName: input.materialName,

    categoryId: input.categoryId,

  });



  if (matchResult.status === 'MATCHED') {

    const materialType = await materialTypesRepository.findMaterialTypeById(

      matchResult.materialType.id,

    );



    if (materialType?.isActive) {

      return {

        matchResult,

        materialType,

      };

    }

  }



  if (input.isFree) {

    return {

      matchResult,

      materialType: null,

    };

  }



  if (matchResult.status === 'AMBIGUOUS') {

    throw new AppError(

      'We found multiple possible matches. Please clarify the material name or category.',

      400,

      'VALIDATION_ERROR',

      {

        reason: 'AMBIGUOUS_MATERIAL_MATCH',

        candidates: matchResult.candidates.map(mapMatchedReferenceDto),

      },

    );

  }



  throw new AppError(

    'We could not verify this paid material yet. Submit it for review.',

    400,

    'VALIDATION_ERROR',

    {

      reason: 'MATERIAL_REVIEW_REQUIRED',

    },

  );

};


