import { estimateCo2eFromCompletedReuseEvents } from './admin-impact-estimator.js';
import * as impactRepository from './admin-impact.repository.js';

export type AdminImpactAnalyticsResponse = {
  verifiedImpact: {
    completedReuseEvents: number;
    distinctMaterialsReused: number;
    learnersBenefited: number;
    suppliersContributed: number;
  };
  learningImpact: {
    componentsFulfilled: number;
    buildsSupported: number;
    projectsSupported: number;
  };
  reuseByCategory: {
    nameEn: string;
    nameAr: string;
    completedReuseEvents: number;
  }[];
  monthlyReuse: {
    month: string;
    completedReuseEvents: number;
  }[];
  environmentalEstimate: {
    estimatedCo2eKg: number | null;
    estimatedCo2eLabel: string | null;
    isEstimate: true;
    includedReuseEvents: number;
    totalCompletedReuseEvents: number;
    coveragePercent: number;
    methodologyVersion: string;
    unavailableReason: 'NO_COMPLETED_EVENTS' | 'NO_ELIGIBLE_EVENTS' | null;
  };
};

const monthKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const lastNMonths = (count: number): { key: string; start: Date }[] => {
  const months: { key: string; start: Date }[] = [];
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1),
    );
    months.push({ key: monthKey(start), start });
  }

  return months;
};

export const buildAdminImpactAnalytics =
  async (): Promise<AdminImpactAnalyticsResponse> => {
    const sixMonths = lastNMonths(6);
    const reuseWindowStart = sixMonths[0]!.start;

    const [
      completedReuseEvents,
      distinctMaterialsReused,
      learnersBenefited,
      suppliersContributed,
      reuseByCategory,
      monthlyReuseCounts,
      learningImpact,
      completedReuseForCo2,
    ] = await Promise.all([
      impactRepository.countCompletedReuseEvents(),
      impactRepository.countDistinctMaterialsReused(),
      impactRepository.countLearnersBenefited(),
      impactRepository.countSuppliersContributed(),
      impactRepository.groupCompletedReuseByCategory(),
      impactRepository.groupCompletedReuseByMonth(reuseWindowStart),
      impactRepository.getLearningImpactCounts(),
      impactRepository.listCompletedReuseEventsForCo2Estimate(),
    ]);

    const monthlyReuseMap = new Map<string, number>();
    for (const item of monthlyReuseCounts) {
      monthlyReuseMap.set(item.month, item.completedReuseEvents);
    }

    const monthlyReuse = sixMonths.map(({ key }) => ({
      month: key,
      completedReuseEvents: monthlyReuseMap.get(key) ?? 0,
    }));

    const environmentalEstimate = estimateCo2eFromCompletedReuseEvents(
      completedReuseForCo2,
    );

    return {
      verifiedImpact: {
        completedReuseEvents,
        distinctMaterialsReused,
        learnersBenefited,
        suppliersContributed,
      },
      learningImpact,
      reuseByCategory,
      monthlyReuse,
      environmentalEstimate: {
        estimatedCo2eKg: environmentalEstimate.estimatedCo2eKg,
        estimatedCo2eLabel: environmentalEstimate.estimatedCo2eLabel,
        isEstimate: true,
        includedReuseEvents: environmentalEstimate.includedReuseEvents,
        totalCompletedReuseEvents:
          environmentalEstimate.totalCompletedReuseEvents,
        coveragePercent: environmentalEstimate.coveragePercent,
        methodologyVersion: environmentalEstimate.methodologyVersion,
        unavailableReason: environmentalEstimate.unavailableReason,
      },
    };
  };
