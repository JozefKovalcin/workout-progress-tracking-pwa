import { addDays, differenceInCalendarDays } from "date-fns";
import { fromLocalDate, toLocalDate } from "../domain/date";
import type {
  DailyEntry,
  LocalDate,
  RecommendationStatus,
  TargetPeriod,
  TrackerProfile
} from "../domain/types";
import type { StoredRecommendation } from "../data/trackerData";

export interface RecommendationBlock {
  blockStart: LocalDate;
  blockEnd: LocalDate;
  day: number;
  actionable: boolean;
}

function blockFromStart(
  blockStart: LocalDate,
  evaluationDays: number,
  today: LocalDate
): RecommendationBlock {
  const blockEnd = toLocalDate(
    addDays(fromLocalDate(blockStart), evaluationDays - 1)
  );
  const elapsedDays =
    differenceInCalendarDays(fromLocalDate(today), fromLocalDate(blockStart)) + 1;

  return {
    blockStart,
    blockEnd,
    day: Math.max(1, Math.min(evaluationDays, elapsedDays)),
    actionable: today > blockEnd
  };
}

export function advanceInformationalBlocks(
  markerBlockStart: LocalDate,
  evaluationDays: number,
  today: LocalDate,
  evaluateBlock: (
    blockStart: LocalDate,
    blockEnd: LocalDate,
    index: number
  ) => RecommendationStatus | undefined
): RecommendationBlock {
  let blockStart = markerBlockStart;
  let index = 0;

  while (true) {
    const block = blockFromStart(blockStart, evaluationDays, today);
    if (!block.actionable) return block;

    const status = evaluateBlock(block.blockStart, block.blockEnd, index);
    if (status !== "hold" && status !== "insufficient") return block;

    blockStart = toLocalDate(addDays(fromLocalDate(block.blockEnd), 1));
    index += 1;
  }
}

export function deriveBlock(
  profile: TrackerProfile,
  targets: TargetPeriod[],
  recommendations: StoredRecommendation[],
  today: LocalDate
): RecommendationBlock {
  const markers = [
    profile.startDate,
    ...targets.map((target) => target.effectiveDate),
    ...recommendations
      .filter((recommendation) =>
        recommendation.status === "rejected" &&
        recommendation.decidedAtMs !== undefined
      )
      .map((recommendation) =>
        toLocalDate(new Date(recommendation.decidedAtMs!))
      )
  ].filter((date) => date <= today);
  const blockStart = markers.sort().at(-1) ?? profile.startDate;
  return blockFromStart(blockStart, profile.evaluationDays, today);
}

export function anchorBlockEntries(
  entries: DailyEntry[],
  blockStart: LocalDate,
  blockEnd: LocalDate
): DailyEntry[] {
  const inBlock = entries.filter(
    (entry) => entry.date >= blockStart && entry.date <= blockEnd
  );
  const earliestUpdatedAt = inBlock.length
    ? Math.min(...inBlock.map((entry) => entry.updatedAtMs))
    : 0;

  return [
    ...inBlock,
    {
      date: blockStart,
      updatedAtMs: earliestUpdatedAt - 1
    }
  ];
}
