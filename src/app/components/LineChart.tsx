import { differenceInCalendarDays } from "date-fns";
import { useState } from "react";
import { formatDisplayDate, fromLocalDate } from "../../domain/date";
import type { ProgressPoint } from "../../domain/progress";

interface LineChartProps {
  title: string;
  ariaLabel: string;
  points: ProgressPoint[];
  unit: string;
  secondaryPoints?: ProgressPoint[];
  secondaryLabel?: string;
  deltaClassName?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function LineChart({
  title,
  ariaLabel,
  points,
  unit,
  secondaryPoints = [],
  secondaryLabel,
  deltaClassName = "trend-neutral",
  xAxisLabel = "Dátum",
  yAxisLabel = "Hodnota"
}: LineChartProps) {
  const [selected, setSelected] = useState<ProgressPoint | null>(null);
  const latest = points.at(-1);
  if (points.length < 2) {
    return (
      <section className="panel chart-card">
        <small>{title}</small>
        <h2>{latest ? `${latest.value.toFixed(1)}${unit}` : "—"}</h2>
        <div className="chart-empty">Aspoň 2 merania zobrazia trend.</div>
      </section>
    );
  }

  const width = 600;
  const height = 220;
  const paddingX = 48;
  const paddingY = 28;
  const allPoints = [...points, ...secondaryPoints];
  const min = Math.min(...allPoints.map((point) => point.value));
  const max = Math.max(...allPoints.map((point) => point.value));
  const valueRange = max - min || 1;
  const firstDate = fromLocalDate(points[0].date);
  const dateRange = Math.max(
    differenceInCalendarDays(fromLocalDate(latest!.date), firstDate),
    1
  );
  const coordinatesFor = (source: ProgressPoint[]) => source.map((point) => ({
    ...point,
    x: paddingX + differenceInCalendarDays(fromLocalDate(point.date), firstDate) / dateRange * (width - paddingX * 2),
    y: height - paddingY - (point.value - min) / valueRange * (height - paddingY * 2)
  }));
  const coordinates = coordinatesFor(points);
  const secondaryCoordinates = coordinatesFor(secondaryPoints);
  const pathFor = (source: typeof coordinates) => source.map((point, index) =>
    `${index ? "L" : "M"} ${point.x} ${point.y}`
  ).join(" ");
  const path = pathFor(coordinates);
  const secondaryPath = secondaryCoordinates.length >= 2 ? pathFor(secondaryCoordinates) : null;
  const delta = latest!.value - points[0].value;
  const selectedPoint = selected ?? latest!;

  return (
    <section className="panel chart-card">
      <div className="chart-heading">
        <div><small>{title}</small><h2>{latest!.value.toFixed(1)}{unit}</h2></div>
        <strong className={deltaClassName}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}{unit}</strong>
      </div>
      <div className="chart-scale" aria-hidden="true"><span>{max.toFixed(1)}{unit}</span><span>{min.toFixed(1)}{unit}</span></div>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <path className="chart-grid-line" d={`M ${paddingX} ${paddingY} H ${width - paddingX} M ${paddingX} ${height - paddingY} H ${width - paddingX}`} />
        {secondaryPath && <path className="chart-line secondary-line" d={secondaryPath} />}
        <path className="chart-line" d={path} />
        <text className="chart-axis-label chart-axis-label-y" x="14" y={height / 2} textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`}>{yAxisLabel}</text>
        <text className="chart-axis-label chart-axis-label-x" x={width / 2} y={height - 4} textAnchor="middle">{xAxisLabel}</text>
        {coordinates.map((point) => (
          <circle key={`${point.date}-${point.value}`} cx={point.x} cy={point.y} r="5">
            <title>{formatDisplayDate(point.date)}: {point.value.toFixed(1)}{unit}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-point-buttons" aria-label={`${title} body grafu`}>
        {points.map((point) => (
          <button
            key={`${point.date}-${point.value}`}
            type="button"
            className={selectedPoint.date === point.date ? "active" : ""}
            aria-label={`${title} bod ${formatDisplayDate(point.date)}`}
            onClick={() => setSelected(point)}
          />
        ))}
      </div>
      {secondaryLabel && <p className="chart-legend"><span />{secondaryLabel}</p>}
      <p className="selected-point">Vybraný bod: <strong>{formatDisplayDate(selectedPoint.date)}</strong> · {selectedPoint.value.toFixed(1)}{unit}</p>
      <div className="chart-dates"><span>{formatDisplayDate(points[0].date)}</span><span>{formatDisplayDate(latest!.date)}</span></div>
    </section>
  );
}
