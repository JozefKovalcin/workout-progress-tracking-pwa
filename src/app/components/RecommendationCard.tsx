import { addDays } from "date-fns";
import { useRef, useState } from "react";
import { buildEvaluationMetrics } from "../../domain/analytics";
import { fromLocalDate, toLocalDate } from "../../domain/date";
import { calculateMacros, resolveDayType } from "../../domain/macros";
import { summarizePerformance } from "../../domain/performance";
import { evaluateRecommendation } from "../../domain/recommendations";
import type { LocalDate, MacroTargets, TargetPeriod } from "../../domain/types";
import type {
  StoredRecommendation,
  TrackerDataSource,
  TrackerSnapshot
} from "../../data/trackerData";
import {
  advanceInformationalBlocks,
  anchorBlockEntries,
  deriveBlock
} from "../recommendationFlow";
import { reasonLabels, targetsForDate } from "../helpers";

interface RecommendationCardProps {
  snapshot: TrackerSnapshot;
  today: LocalDate;
  currentTargets: { training: MacroTargets; rest: MacroTargets };
  data: TrackerDataSource;
  uid: string;
}

export function RecommendationCard({
  snapshot,
  today,
  currentTargets,
  data,
  uid
}: RecommendationCardProps) {
  const [open, setOpen] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const decidingRef = useRef(false);
  const profile = snapshot.profile!;
  const markerBlock = deriveBlock(
    profile,
    snapshot.targets,
    snapshot.recommendations,
    today
  );
  const evaluateBlock = (blockStart: LocalDate, blockEnd: LocalDate) => {
    const performance = summarizePerformance(snapshot.topSets, blockEnd);
    const blockEntries = anchorBlockEntries(
      snapshot.dailyEntries,
      blockStart,
      blockEnd
    );
    const metrics = buildEvaluationMetrics(
      blockEntries,
      (date) =>
        targetsForDate(
          snapshot.targets,
          date,
          resolveDayType(
            date,
            snapshot.trainingDays,
            blockEntries.find((row) => row.date === date)?.dayTypeOverride
          )
        ),
      performance
    );
    const stored = snapshot.recommendations.find((item) => item.id === blockEnd);
    return {
      metrics,
      result: stored ?? evaluateRecommendation(metrics)
    };
  };
  const { blockStart, blockEnd, day, actionable } =
    advanceInformationalBlocks(
      markerBlock.blockStart,
      profile.evaluationDays,
      today,
      (start, end) => evaluateBlock(start, end).result.status
    );
  const evaluation = actionable ? evaluateBlock(blockStart, blockEnd) : null;
  const metrics = evaluation?.metrics;
  const result = evaluation?.result ?? null;

  const decide = async (accepted: boolean) => {
    if (!result || !metrics || decidingRef.current) return;
    decidingRef.current = true;
    setDeciding(true);
    setDecisionError("");
    const recommendation: StoredRecommendation = {
      ...result,
      id: blockEnd,
      windowStart: blockStart,
      windowEnd: blockEnd,
      metrics,
      status: accepted ? "accepted" : "rejected",
      decidedAtMs: fromLocalDate(today).valueOf()
    };
    let next: TargetPeriod | undefined;
    if (accepted) {
      const effectiveDate = toLocalDate(addDays(fromLocalDate(today), 1));
      next = {
        id: effectiveDate,
        effectiveDate,
        training: calculateMacros(currentTargets.training.calories + result.calorieDeltaTraining, profile.proteinGrams, profile.fatGrams),
        rest: calculateMacros(currentTargets.rest.calories + result.calorieDeltaRest, profile.proteinGrams, profile.fatGrams),
        reason: result.reasonCodes.join(", "),
        createdAtMs: fromLocalDate(today).valueOf()
      };
    }
    try {
      await data.decideRecommendation(uid, recommendation, next);
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "Rozhodnutie sa nepodarilo uložiť."
      );
    } finally {
      decidingRef.current = false;
      setDeciding(false);
    }
  };

  return (
    <section className="panel recommendation">
      <button className="panel-toggle" aria-label="Odporúčanie" onClick={() => setOpen(!open)}>
        <span><small>Kalibrácia deň {day}/14</small><strong>Odporúčanie</strong></span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="recommendation-body">
          {!result && <p><strong>Najprv dokonči 14-dňový blok.</strong> Dovtedy sa kalórie nemenia.</p>}
          {result?.status === "insufficient" && (
            <><p><strong>Dáta zatiaľ nestačia.</strong> Chýbajúce alebo slabé dáta nikdy nevytvoria kalorickú akciu.</p>
              <ul>{result.missingData.map((item) => <li key={item}>{item}</li>)}</ul></>
          )}
          {result?.status === "hold" && <p><strong>Bez zmeny.</strong> Pokračuj ďalší blok a zbieraj konzistentné dáta.</p>}
          {(result?.status === "accepted" || result?.status === "rejected") && <p><strong>{result.status === "accepted" ? "Odporúčanie prijaté" : "Odporúčanie odmietnuté"}.</strong></p>}
          {result?.status === "pending" && (
            <>
              <div className="recommendation-grid">
                <div><small>Tréning</small><strong>{currentTargets.training.calories} → {currentTargets.training.calories + result.calorieDeltaTraining} kcal</strong></div>
                <div><small>Voľno</small><strong>{currentTargets.rest.calories} → {currentTargets.rest.calories + result.calorieDeltaRest} kcal</strong></div>
              </div>
              <p>Istota: <strong>{result.confidence}</strong></p>
              <ul>{result.reasonCodes.map((code) => <li key={code}>{reasonLabels[code] ?? code}</li>)}</ul>
              <div className="button-row"><button className="primary" disabled={deciding} onClick={() => void decide(true)}>{deciding ? "Ukladám…" : "Prijať"}</button><button className="secondary" disabled={deciding} onClick={() => void decide(false)}>Odmietnuť</button></div>
              {decisionError && <p className="error">{decisionError}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

