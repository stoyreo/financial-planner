"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { generateYearlyForecast } from "@/lib/engine/forecast";
import {
  analyzeInvestmentOptimization,
  analyzeTaxPlanning,
  analyzeRiskAssessment,
  analyzeSavingsAndDebt,
  analyzeGeopoliticalHedge,
  analyzeAlstomSTI,
  type AnalysisResult,
  type AlstomSTIAnalysis,
} from "@/lib/engine/ai-scenarios";
import { thb, pct } from "@/lib/utils";
import type { Scenario, ScenarioAssumptions } from "@/lib/types";
import {
  Card, CardHeader, CardTitle, CardContent, Button, Input, Label,
  Select, Modal, Badge, StatCard, PageHeader, Alert, Separator, Tabs, TabsList, TabsTrigger, TabsContent
} from "@/components/ui";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import {
  Plus, Edit, Trash2, Play, BarChart3, CheckCircle, Zap, TrendingUp,
  AlertCircle, Shield, PiggyBank, Globe, Train, ExternalLink,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

const SCENARIO_COLORS = ["#3b82f6","#10b981","#ef4444","#8b5cf6","#f59e0b","#06b6d4","#f97316"];

function defaultScenario(): Omit<Scenario, "id" | "createdAt"> {
  return {
    name: "", description: "", isBase: false,
    color: SCENARIO_COLORS[Math.floor(Math.random() * SCENARIO_COLORS.length)],
    assumptions: {
      incomeGrowthRate: 0.04, inflationRate: 0.03, investmentReturnRate: 0.07,
      mortgageExtraMonthlyPayment: 5_000, annualLumpSumPrepayment: 0,
    },
  };
}

function AssumptionField({ label, value, onChange, hint, unit = "" }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void;
  hint?: string; unit?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="relative mt-1">
        <Input
          type="number" step="any"
          value={value !== undefined ? (unit === "%" ? (value * 100).toFixed(2) : value) : ""}
          onChange={e => onChange(e.target.value === "" ? undefined : (unit === "%" ? Number(e.target.value) / 100 : Number(e.target.value)))}
          className="text-sm" placeholder="Use default"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function ScenariosPage() {
  const { scenarios, activeScenarioId, addScenario, updateScenario, deleteScenario, setActiveScenario,
    profile, incomes, expenses, debts, investments, retirement, tax } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Scenario, "id" | "createdAt">>(defaultScenario());
  const [compareIds, setCompareIds] = useState<string[]>(scenarios.slice(0, 2).map(s => s.id));
  const [tab, setTab] = useState("overview");
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [alstomSTI, setAlstomSTI] = useState<AlstomSTIAnalysis | null>(null);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  useEffect(() => {
    setLoadingAnalyses(true);
    try {
      const results: AnalysisResult[] = [
        analyzeInvestmentOptimization({ investments, profile, income: incomes, expenses, debts }),
        analyzeTaxPlanning({ profile, income: incomes, investments, debts, tax }),
        analyzeRiskAssessment({ profile, investments, debts, income: incomes, expenses }),
        analyzeSavingsAndDebt({ profile, income: incomes, expenses, debts, investments }),
        analyzeGeopoliticalHedge({ investments, profile }),
      ];
      setAnalyses(results);
      setAlstomSTI(analyzeAlstomSTI());
    } catch (e) {
      console.error("Analysis error:", e);
    }
    setLoadingAnalyses(false);
  }, [profile, incomes, expenses, debts, investments, retirement, tax]);

  useEffect(() => {
    if (!activeScenarioId && scenarios.length > 0) {
      setActiveScenario(scenarios[0].id);
    }
  }, [scenarios, activeScenarioId, setActiveScenario]);

  const openAdd = () => { setFormData(defaultScenario()); setEditId(null); setModalOpen(true); };
  const openEdit = (s: Scenario) => { setFormData({ name: s.name, description: s.description, isBase: s.isBase, color: s.color, assumptions: { ...s.assumptions } }); setEditId(s.id); setModalOpen(true); };
  const handleSave = () => {
    if (!formData.name) return;
    if (editId) updateScenario(editId, formData);
    else addScenario(formData);
    setModalOpen(false);
  };
  const handleDelete = (id: string) => { if (!scenarios.find(s => s.id === id)?.isBase && confirm("Delete this scenario?")) deleteScenario(id); };
  const setField = (k: string, v: any) => setFormData(f => ({ ...f, [k]: v }));

  const comparisonForecasts = compareIds.map(id => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return null;
    const forecast = generateYearlyForecast({ profile, incomes, expenses, debts, investments, retirement, scenario });
    return { scenario, forecast };
  }).filter(Boolean) as Array<{ scenario: Scenario; forecast: ReturnType<typeof generateYearlyForecast> }>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Scenario Planner and AI Analysis"
        subtitle="Create scenarios, run comparisons, and get AI-driven financial insights"
        actions={<Button size="sm" onClick={openAdd}><Plus size={14} /> New Scenario</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">All Scenarios</TabsTrigger>
          <TabsTrigger value="compare">Compare Scenarios</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s) => {
              const isActive = s.id === activeScenarioId;
              return (
                <Card key={s.id} className={`hover:shadow-md transition-shadow ${isActive ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-4">
                    <div className="font-semibold text-sm">{s.name}</div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant={isActive ? "default" : "outline"} className="flex-1 text-xs"
                        onClick={() => setActiveScenario(s.id)}>
                        <Play size={11} />{isActive ? "Active" : "Activate"}
                      </Button>
                    </div>
                    {isActive && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary"><CheckCircle size={11} /> Currently active</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="compare">
          <div className="space-y-6">
            {/* Scenario Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Scenarios to Compare</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {scenarios.map((s) => {
                    const isSelected = compareIds.includes(s.id);
                    return (
                      <Button
                        key={s.id}
                        variant={isSelected ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => {
                          if (isSelected) {
                            setCompareIds(compareIds.filter(id => id !== s.id));
                          } else {
                            setCompareIds([...compareIds, s.id]);
                          }
                        }}
                      >
                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Comparison Chart and Cards */}
            {comparisonForecasts.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="text-center text-muted-foreground">Select scenarios to compare</div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Net Worth Projection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={comparisonForecasts[0].forecast.map((yearData, idx) => {
                          const point: any = { year: yearData.year };
                          comparisonForecasts.forEach((cf) => {
                            point[`netWorth_${cf.scenario.id}`] = cf.forecast[idx]?.netWorth || 0;
                          });
                          return point;
                        })}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip formatter={(value) => thb(value)} />
                        <Legend />
                        {comparisonForecasts.map((cf) => (
                          <Line
                            key={cf.scenario.id}
                            dataKey={`netWorth_${cf.scenario.id}`}
                            name={cf.scenario.name}
                            stroke={cf.scenario.color}
                            type="monotone"
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Final Year Comparison Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {comparisonForecasts.map((cf) => {
                    const finalYear = cf.forecast[cf.forecast.length - 1];
                    return (
                      <Card key={cf.scenario.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cf.scenario.color }}
                            />
                            <CardTitle className="text-sm">{cf.scenario.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {finalYear ? thb(finalYear.netWorth) : "—"}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Final Year Net Worth</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis">
          {loadingAnalyses ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center text-muted-foreground">Analyzing financial situation...</div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Alstom STI Payout Probability card */}
              {alstomSTI && <AlstomSTICard data={alstomSTI} />}

              {/* Existing AI modules */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analyses.map((result) => (
                  <Card key={result.moduleId}>
                    <CardHeader>
                      <CardTitle className="text-base">{result.moduleName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{result.explanation}</p>
                      <div className="text-[10px] text-muted-foreground">
                        Confidence: {result.confidenceScore}%
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Scenario" : "New Scenario"} className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <Label>Scenario Name</Label>
            <Input value={formData.name} onChange={e => setField("name", e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!formData.name}>Save Scenario</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlstomSTICard renders the Alstom STI payout probability analysis based on
// the Group's preliminary FY 2025/26 results vs. its FY 2025/26 commitments.
// ---------------------------------------------------------------------------
function AlstomSTICard({ data }: { data: AlstomSTIAnalysis }) {
  const statusColor = (s: AlstomSTIAnalysis["criteria"][number]["status"]) =>
    s === "exceeded" ? "text-emerald-600 dark:text-emerald-400"
    : s === "met"      ? "text-sky-600 dark:text-sky-400"
    : s === "partial"  ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  const statusIcon = (s: AlstomSTIAnalysis["criteria"][number]["status"]) =>
    s === "exceeded" ? <ArrowUpRight size={14} />
    : s === "met"      ? <CheckCircle size={14} />
    : s === "partial"  ? <Minus size={14} />
    : <ArrowDownRight size={14} />;

  const badgeColor =
    data.expectedPayoutRatio >= 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : data.expectedPayoutRatio >= 80  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
    : data.expectedPayoutRatio >= 50  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Train size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{data.moduleName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.fiscalYear} · Preliminary results published 16-Apr-2026
            </p>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${badgeColor}`}>
            {data.verdict}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Headline numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Expected STI payout
            </div>
            <div className="text-2xl font-bold mt-1">
              {data.expectedPayoutRatio}<span className="text-sm font-medium text-muted-foreground">% of target</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              P(payout ≥ 100%)
            </div>
            <div className="text-2xl font-bold mt-1">
              ~{Math.max(0, data.payoutProbability)}<span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Confidence
            </div>
            <div className="text-2xl font-bold mt-1">
              {data.confidenceScore}<span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* Criteria table */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Commitment vs. preliminary actual
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">KPI</th>
                  <th className="px-3 py-2 font-medium">Weight</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Actual</th>
                  <th className="px-3 py-2 font-medium text-right">Payout factor</th>
                </tr>
              </thead>
              <tbody>
                {data.criteria.map(c => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{Math.round(c.weight * 100)}%</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.targetLabel}</td>
                    <td className={`px-3 py-2 font-medium ${statusColor(c.status)}`}>{c.actualLabel}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${statusColor(c.status)}`}>
                        {statusIcon(c.status)}
                        {Math.round(c.payoutFactor * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-KPI commentary */}
          <div className="space-y-1.5 pt-1">
            {data.criteria.map(c => (
              <div key={c.id} className="text-xs text-muted-foreground">
                <span className={`font-semibold ${statusColor(c.status)}`}>{c.name}:</span> {c.commentary}
              </div>
            ))}
          </div>
        </div>

        {/* Narrative */}
        <div className="rounded-lg bg-muted/40 border border-border p-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Assessment
          </div>
          <p className="text-sm leading-relaxed">{data.narrative}</p>
        </div>

        {/* Sources */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Sources
          </div>
          <ul className="space-y-1">
            {data.sources.map(s => (
              <li key={s.url} className="text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1 text-primary hover:underline"
                >
                  <ExternalLink size={11} className="mt-0.5 shrink-0" />
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-3">
          <strong>Disclaimer:</strong> {data.disclaimer}
        </div>
      </CardContent>
    </Card>
  );
}
