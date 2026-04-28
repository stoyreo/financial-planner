"use client";

/**
 * SAVINGS OPTIMIZER SIMULATOR
 * ───────────────────────────
 * Interactive what-if tool: each category gets a slider that lets the user
 * trim spending. The chart updates live to show projected monthly savings
 * vs target. "Apply to Budget" pushes the simulated values back to the
 * ExpenseItem.budgetAmount on /expenses.
 *
 * Inputs:
 *   - rows:           BudgetVsActualRow[] for the selected month
 *   - monthlyIncome:  THB net income/month
 *   - initialTarget:  THB savings target
 *   - onApply:        callback (categoryToNewBudget Map) -> persisted via store
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@/components/ui";
import { Sliders, Check, Target, RotateCcw } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTip, CartesianGrid,
  ReferenceLine, Cell, ComposedChart, Line, Legend,
} from "recharts";
import type { BudgetVsActualRow } from "@/lib/actuals";
import { thb } from "@/lib/utils";

interface Props {
  rows: BudgetVsActualRow[];
  monthlyIncome: number;
  initialTarget?: number;
  onApply?: (newBudgetByCategory: Record<string, number>) => void;
}

export function SavingsOptimizer({
  rows,
  monthlyIncome,
  initialTarget = 20000,
  onApply,
}: Props) {
  // Slider value per category = simulated monthly spend (initially the actual).
  const [sim, setSim] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map(r => [r.category, Math.round(r.actual)]))
  );
  const [target, setTarget] = useState<number>(initialTarget);

  // Re-init sliders if the row set changes (different month selected).
  useEffect(() => {
    setSim(Object.fromEntries(rows.map(r => [r.category, Math.round(r.actual)])));
  }, [rows.map(r => r.category + ":" + Math.round(r.actual)).join("|")]); // stable identity

  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalSimulated = Object.values(sim).reduce((s, v) => s + v, 0);
  const currentSavings = monthlyIncome - totalActual;
  const projectedSavings = monthlyIncome - totalSimulated;
  const savingsLift = projectedSavings - currentSavings;
  const distanceToTarget = target - projectedSavings;
  const monthsToTargetCurrent = currentSavings > 0 ? target / currentSavings : Infinity;
  const monthsToTargetProjected = projectedSavings > 0 ? target / projectedSavings : Infinity;

  // Build the per-category chart data: kept vs saved portions.
  const chartData = useMemo(() =>
    rows.map(r => {
      const kept = sim[r.category] ?? r.actual;
      const saved = Math.max(0, r.actual - kept);
      return {
        category: r.category,
        kept: Math.round(kept),
        saved: Math.round(saved),
        actual: Math.round(r.actual),
        budget: Math.round(r.budget),
        isEssential: r.isEssential,
      };
    }), [rows, sim]);

  const trendData = [
    { name: "Current", spend: Math.round(totalActual), savings: Math.round(currentSavings) },
    { name: "Optimized", spend: Math.round(totalSimulated), savings: Math.round(projectedSavings) },
    { name: "Target", spend: Math.round(monthlyIncome - target), savings: Math.round(target) },
  ];

  function reset() {
    setSim(Object.fromEntries(rows.map(r => [r.category, Math.round(r.actual)])));
  }
  function autoOptimize() {
    // Greedy: trim discretionary first up to 50%, then essentials up to overage only.
    const next: Record<string, number> = { ...sim };
    let need = Math.max(0, target - currentSavings);
    const sorted = [...rows].sort((a, b) => {
      const aScore = (a.isEssential ? 0 : 1000) + (a.gap > 0 ? 500 : 0) + a.actual;
      const bScore = (b.isEssential ? 0 : 1000) + (b.gap > 0 ? 500 : 0) + b.actual;
      return bScore - aScore;
    });
    for (const r of sorted) {
      if (need <= 0) break;
      const maxCut = r.isEssential
        ? Math.max(0, r.actual - r.budget)             // only the overage
        : Math.round(r.actual * 0.5);                  // up to 50% of discretionary
      const cut = Math.min(maxCut, need);
      next[r.category] = Math.round(r.actual - cut);
      need -= cut;
    }
    setSim(next);
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-muted-foreground" />
          <CardTitle className="text-sm">Savings Optimizer Simulator</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Target/mo:</label>
          <Input
            type="number"
            value={target}
            onChange={e => setTarget(Number(e.target.value))}
            className="w-28 h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={autoOptimize}>
            <Target size={12} /> Auto-optimize
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw size={12} /> Reset
          </Button>
          {onApply && (
            <Button size="sm" onClick={() => onApply(sim)}>
              <Check size={12} /> Apply to Budget
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-md bg-muted/40">
            <div className="text-xs text-muted-foreground">Current savings</div>
            <div className="text-lg font-bold tabular-nums">{thb(Math.max(0, currentSavings))}/mo</div>
          </div>
          <div className="p-3 rounded-md bg-emerald-500/10">
            <div className="text-xs text-emerald-500">Projected savings</div>
            <div className="text-lg font-bold tabular-nums text-emerald-500">{thb(Math.max(0, projectedSavings))}/mo</div>
            <div className="text-xs text-muted-foreground">+{thb(Math.max(0, savingsLift))}/mo lift</div>
          </div>
          <div className="p-3 rounded-md bg-blue-500/10">
            <div className="text-xs text-blue-500">Distance to target</div>
            <div className={`text-lg font-bold tabular-nums ${distanceToTarget <= 0 ? "text-emerald-500" : "text-amber-500"}`}>
              {distanceToTarget <= 0 ? `Target met +${thb(Math.abs(distanceToTarget))}` : `${thb(distanceToTarget)} short`}
            </div>
          </div>
          <div className="p-3 rounded-md bg-muted/40">
            <div className="text-xs text-muted-foreground">Months to ฿1M at this pace</div>
            <div className="text-lg font-bold tabular-nums">
              {projectedSavings > 0 ? Math.ceil(1_000_000 / projectedSavings) : "∞"}
              {currentSavings > 0 && projectedSavings > currentSavings && (
                <span className="text-xs text-emerald-500 ml-2">
                  (was {Math.ceil(1_000_000 / Math.max(1, currentSavings))})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Levers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-6">
          {rows.map(r => {
            const v = sim[r.category] ?? r.actual;
            const max = Math.max(r.actual, r.budget) * 1.2;
            const cut = Math.max(0, r.actual - v);
            const cutPct = r.actual > 0 ? (cut / r.actual) * 100 : 0;
            return (
              <div key={r.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.category}</span>
                    {r.isEssential && <Badge variant="outline" className="text-[10px]">Essential</Badge>}
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className={cut > 0 ? "text-emerald-500" : "text-muted-foreground"}>
                      {cut > 0 ? `−${thb(cut)} (${cutPct.toFixed(0)}%)` : "no cut"}
                    </span>
                    <span className="text-muted-foreground">→ {thb(v)}/mo</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.round(max)}
                  step={100}
                  value={v}
                  onChange={e => setSim(prev => ({ ...prev, [r.category]: Number(e.target.value) }))}
                  className="w-full accent-emerald-500"
                  disabled={r.actual === 0}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  <span>0</span>
                  <span>budget {thb(r.budget)}</span>
                  <span>actual {thb(r.actual)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Two visualizations side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Per-category: Kept vs Saved</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={10} />
                <YAxis type="category" dataKey="category" fontSize={10} width={80} />
                <RTip formatter={(v: number) => thb(v)} />
                <Legend />
                <Bar dataKey="kept" stackId="a" fill="#3b82f6" name="Kept" />
                <Bar dataKey="saved" stackId="a" fill="#10b981" name="Saved">
                  {chartData.map((d, i) => (
                    <Cell key={i} fillOpacity={d.saved > 0 ? 0.9 : 0} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Savings vs Target</div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={trendData} margin={{ left: 5, right: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTip formatter={(v: number) => thb(v)} />
                <Legend />
                <Bar dataKey="savings" fill="#10b981" name="Savings" />
                <Bar dataKey="spend" fill="#3b82f6" name="Spend" />
                <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "Target", fill: "#ef4444", fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
