/**
 * ZUSTAND STORE
 * ─────────────
 * Central state with localStorage persistence.
 * All financial data lives here; computed forecasts are derived on demand.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { v4 as uuid } from "uuid";
import type {
  Profile, IncomeItem, ExpenseItem, DebtAccount,
  InvestmentAccount, RetirementAssumptions, TaxAssumptions, Scenario,
  YearlyForecastRow, MonthlyForecastRow,
} from "./types";
import {
  seedProfile, seedIncomes, seedExpenses, seedDebts,
  seedInvestments, seedRetirement, seedTax, seedScenarios,
} from "./seed";
import { loadUserData, persistUserData, saveRemoteUserData, loadRemoteUserData } from "./users";
import { getCurrentAccount } from "./accounts";
import { getSession } from "./auth";
import { generateYearlyForecast, generateMonthlyForecast } from "./engine/forecast";

interface Store {
  // ── Data ──────────────────────────────────────────────
  profile: Profile;
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  debts: DebtAccount[];
  investments: InvestmentAccount[];
  retirement: RetirementAssumptions;
  tax: TaxAssumptions;
  scenarios: Scenario[];
  activeScenarioId: string;
  isSeedLoaded: boolean;

  // ── Computed / cached ─────────────────────────────────
  yearlyForecast: YearlyForecastRow[];
  monthlyForecast: MonthlyForecastRow[];

  // ── Profile actions ───────────────────────────────────
  setProfile: (p: Partial<Profile>) => void;

  // ── Income actions ────────────────────────────────────
  addIncome: (item: Omit<IncomeItem, "id">) => void;
  updateIncome: (id: string, item: Partial<IncomeItem>) => void;
  deleteIncome: (id: string) => void;

  // ── Expense actions ───────────────────────────────────
  addExpense: (item: Omit<ExpenseItem, "id">) => void;
  updateExpense: (id: string, item: Partial<ExpenseItem>) => void;
  deleteExpense: (id: string) => void;

  // ── Debt actions ──────────────────────────────────────
  addDebt: (item: Omit<DebtAccount, "id">) => void;
  updateDebt: (id: string, item: Partial<DebtAccount>) => void;
  deleteDebt: (id: string) => void;

  // ── Investment actions ────────────────────────────────
  addInvestment: (item: Omit<InvestmentAccount, "id">) => void;
  updateInvestment: (id: string, item: Partial<InvestmentAccount>) => void;
  deleteInvestment: (id: string) => void;

  // ── Retirement / Tax ──────────────────────────────────
  setRetirement: (r: Partial<RetirementAssumptions>) => void;
  setTax: (t: Partial<TaxAssumptions>) => void;

  // ── Scenario actions ──────────────────────────────────
  addScenario: (s: Omit<Scenario, "id" | "createdAt">) => void;
  updateScenario: (id: string, s: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string) => void;

  // ── Forecast ──────────────────────────────────────────
  recomputeForecast: () => void;

  // ── Sync Status ───────────────────────────────────────
  localSyncStatus: "idle" | "saving" | "completed" | "error";
  remoteSyncStatus: "idle" | "saving" | "completed" | "error";
  lastLocalSaveTime: string | null;
  lastRemoteSaveTime: string | null;
  lastSyncError: string | null;
  setLocalSyncStatus: (status: "idle" | "saving" | "completed" | "error", error?: string) => void;
  setRemoteSyncStatus: (status: "idle" | "saving" | "completed" | "error", error?: string) => void;

  // ── Utility ───────────────────────────────────────────
  loadSeedData: () => void;
  loadUserNamespace: () => void;
  saveUserNamespace: () => void;
  saveUserNamespaceAsync: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => boolean;
  exportDataXlsx: () => Blob;
  importDataXlsx: (file: File) => Promise<boolean>;
}

function getActiveScenario(scenarios: Scenario[], id: string): Scenario {
  return scenarios.find(s => s.id === id) ?? scenarios[0];
}

function computeForecasts(state: any) {
  const scenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  const input = {
    profile: state.profile,
    incomes: state.incomes,
    expenses: state.expenses,
    debts: state.debts,
    investments: state.investments,
    retirement: state.retirement,
    scenario,
  };
  return {
    yearlyForecast: generateYearlyForecast(input),
    monthlyForecast: generateMonthlyForecast(input),
  };
}

export const useStore = create<Store>()(
  persist(
    immer((set, get) => ({
      // ── Initial state ──────────────────────────────────
      profile: seedProfile,
      incomes: seedIncomes,
      expenses: seedExpenses,
      debts: seedDebts,
      investments: seedInvestments,
      retirement: seedRetirement,
      tax: seedTax,
      scenarios: seedScenarios,
      activeScenarioId: "base",
      isSeedLoaded: true,
      yearlyForecast: [],
      monthlyForecast: [],
      localSyncStatus: "idle",
      remoteSyncStatus: "idle",
      lastLocalSaveTime: null,
      lastRemoteSaveTime: null,
      lastSyncError: null,

      // ── Profile ──────────────────────────────────────
      setProfile: (p) => set((state) => {
        Object.assign(state.profile, p);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Income ───────────────────────────────────────
      addIncome: (item) => set((state) => {
        state.incomes.push({ ...item, id: uuid() });
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      updateIncome: (id, item) => set((state) => {
        const idx = state.incomes.findIndex(i => i.id === id);
        if (idx >= 0) Object.assign(state.incomes[idx], item);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      deleteIncome: (id) => set((state) => {
        state.incomes = state.incomes.filter(i => i.id !== id);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Expense ──────────────────────────────────────
      addExpense: (item) => set((state) => {
        state.expenses.push({ ...item, id: uuid() });
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      updateExpense: (id, item) => set((state) => {
        const idx = state.expenses.findIndex(i => i.id === id);
        if (idx >= 0) Object.assign(state.expenses[idx], item);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      deleteExpense: (id) => set((state) => {
        state.expenses = state.expenses.filter(i => i.id !== id);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Debt ─────────────────────────────────────────
      addDebt: (item) => set((state) => {
        state.debts.push({ ...item, id: uuid() });
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      updateDebt: (id, item) => set((state) => {
        const idx = state.debts.findIndex(i => i.id === id);
        if (idx >= 0) Object.assign(state.debts[idx], item);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      deleteDebt: (id) => set((state) => {
        state.debts = state.debts.filter(i => i.id !== id);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Investment ────────────────────────────────────
      addInvestment: (item) => set((state) => {
        state.investments.push({ ...item, id: uuid() });
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      updateInvestment: (id, item) => set((state) => {
        const idx = state.investments.findIndex(i => i.id === id);
        if (idx >= 0) Object.assign(state.investments[idx], item);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      deleteInvestment: (id) => set((state) => {
        state.investments = state.investments.filter(i => i.id !== id);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Retirement / Tax ──────────────────────────────
      setRetirement: (r) => set((state) => {
        Object.assign(state.retirement, r);
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      setTax: (t) => set((state) => { Object.assign(state.tax, t); }),

      // ── Scenarios ────────────────────────────────────
      addScenario: (s) => set((state) => {
        state.scenarios.push({ ...s, id: uuid(), createdAt: new Date().toISOString() });
      }),
      updateScenario: (id, s) => set((state) => {
        const idx = state.scenarios.findIndex(i => i.id === id);
        if (idx >= 0) Object.assign(state.scenarios[idx], s);
        if (state.activeScenarioId === id) {
          const f = computeForecasts(state as any);
          state.yearlyForecast = f.yearlyForecast;
          state.monthlyForecast = f.monthlyForecast;
        }
      }),
      deleteScenario: (id) => set((state) => {
        if (state.scenarios.length <= 1) return;
        state.scenarios = state.scenarios.filter(i => i.id !== id);
        if (state.activeScenarioId === id) {
          state.activeScenarioId = state.scenarios[0].id;
          const f = computeForecasts(state as any);
          state.yearlyForecast = f.yearlyForecast;
          state.monthlyForecast = f.monthlyForecast;
        }
      }),
      setActiveScenario: (id) => set((state) => {
        state.activeScenarioId = id;
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Forecast ─────────────────────────────────────
      recomputeForecast: () => set((state) => {
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),

      // ── Utility ──────────────────────────────────────
      loadUserNamespace: async () => {
        const session = getSession();
        if (!session) return;

        // Try loading from remote first
        const remoteResult = await loadRemoteUserData(session.storageKey);
        let data = null;

        if (remoteResult.ok && remoteResult.data) {
          data = remoteResult.data;
          // Sync remote data back to localStorage
          persistUserData(session.storageKey, data);
        } else {
          // Fall back to localStorage
          data = loadUserData(session.storageKey);
        }

        if (!data) {
          set((state) => {
            state.localSyncStatus = "idle";
            state.remoteSyncStatus = "idle";
          });
          return;
        }

        set((state) => {
          if (data.profile) state.profile = data.profile;
          if (data.incomes) state.incomes = data.incomes;
          if (data.expenses) state.expenses = data.expenses;
          if (data.debts) state.debts = data.debts;
          if (data.investments) state.investments = data.investments;
          if (data.retirement) state.retirement = data.retirement;
          if (data.tax) state.tax = data.tax;
          if (data.scenarios) state.scenarios = data.scenarios;
          if (data.activeScenarioId) state.activeScenarioId = data.activeScenarioId;
          const f = computeForecasts(state as any);
          state.yearlyForecast = f.yearlyForecast;
          state.monthlyForecast = f.monthlyForecast;
          state.localSyncStatus = "idle";
          state.remoteSyncStatus = "idle";
        });
      },
      saveUserNamespace: () => {
        const session = getSession();
        if (!session) return;
        const s = get();
        persistUserData(session.storageKey, {
          profile: s.profile, incomes: s.incomes, expenses: s.expenses,
          debts: s.debts, investments: s.investments, retirement: s.retirement,
          tax: s.tax, scenarios: s.scenarios, activeScenarioId: s.activeScenarioId,
        });
      },
      saveUserNamespaceAsync: async () => {
        const session = getSession();
        if (!session) return;
        const s = get();
        const data = {
          profile: s.profile, incomes: s.incomes, expenses: s.expenses,
          debts: s.debts, investments: s.investments, retirement: s.retirement,
          tax: s.tax, scenarios: s.scenarios, activeScenarioId: s.activeScenarioId,
        };

        // ── LOCAL ──
        set((state) => { state.localSyncStatus = "saving"; });
        try {
          persistUserData(session.storageKey, data);
          set((state) => {
            state.localSyncStatus = "completed";
            state.lastLocalSaveTime = new Date().toISOString();
          });
        } catch (err) {
          set((state) => {
            state.localSyncStatus = "error";
            state.lastSyncError = `Local save failed: ${String(err)}`;
          });
        }

        // ── REMOTE ──
        set((state) => { state.remoteSyncStatus = "saving"; });
        const remoteResult = await saveRemoteUserData(session.storageKey, data);
        if (remoteResult.ok) {
          set((state) => {
            state.remoteSyncStatus = "completed";
            state.lastRemoteSaveTime = new Date().toISOString();
          });
        } else {
          set((state) => {
            state.remoteSyncStatus = "error";
            state.lastSyncError = remoteResult.error || "Remote sync failed";
          });
        }

        // Keep the "completed"/"error" state visible for 4s so the user sees
        // the confirmation, then drop back to "idle". Timestamps stay set so
        // the badge continues to render "Saved 10:23 AM" afterwards.
        setTimeout(() => {
          set((state) => {
            if (state.localSyncStatus === "completed") state.localSyncStatus = "idle";
            if (state.remoteSyncStatus === "completed") state.remoteSyncStatus = "idle";
          });
        }, 4000);
      },
      loadSeedData: () => set((state) => {
        state.profile = seedProfile;
        state.incomes = seedIncomes;
        state.expenses = seedExpenses;
        state.debts = seedDebts;
        state.investments = seedInvestments;
        state.retirement = seedRetirement;
        state.tax = seedTax;
        state.scenarios = seedScenarios;
        state.activeScenarioId = "base";
        state.isSeedLoaded = true;
        const f = computeForecasts(state as any);
        state.yearlyForecast = f.yearlyForecast;
        state.monthlyForecast = f.monthlyForecast;
      }),
      exportData: () => {
        const s = get();
        return JSON.stringify({
          profile: s.profile, incomes: s.incomes, expenses: s.expenses,
          debts: s.debts, investments: s.investments, retirement: s.retirement,
          tax: s.tax, scenarios: s.scenarios,
        }, null, 2);
      },
      importData: (json) => {
        let success = false;
        set((state) => {
          try {
            const data = JSON.parse(json);
            if (data.profile) state.profile = data.profile;
            if (data.incomes) state.incomes = data.incomes;
            if (data.expenses) state.expenses = data.expenses;
            if (data.debts) state.debts = data.debts;
            if (data.investments) state.investments = data.investments;
            if (data.retirement) state.retirement = data.retirement;
            if (data.tax) state.tax = data.tax;
            if (data.scenarios) state.scenarios = data.scenarios;
            const f = computeForecasts(state as any);
            state.yearlyForecast = f.yearlyForecast;
            state.monthlyForecast = f.monthlyForecast;
            success = true;
          } catch (e) {
            console.error("Import failed:", e);
            success = false;
          }
        });
        return success;
      },

      exportDataXlsx: () => {
        const XLSX = require("xlsx");
        const s = get();
        const wb = XLSX.utils.book_new();
        const objToKV = (o: any) => Object.entries(o).map(([key, value]) => ({ key, value }));

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objToKV(s.profile)), "profile");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.incomes), "incomes");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.expenses), "expenses");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.debts), "debts");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.investments), "investments");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objToKV(s.retirement)), "retirement");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objToKV(s.tax)), "tax");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.scenarios.map(sc => ({
          id: sc.id, name: sc.name, description: sc.description, isBase: sc.isBase,
          color: sc.color, assumptionsJSON: JSON.stringify(sc.assumptions), createdAt: sc.createdAt,
        }))), "scenarios");

        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      },

      importDataXlsx: async (file: File) => {
        let success = false;
        try {
          const XLSX = require("xlsx");
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = (n: string) => wb.Sheets[n] ? XLSX.utils.sheet_to_json<any>(wb.Sheets[n]) : [];
          const kvToObj = (rows: any[]) => rows.reduce((a, { key, value }) => ({ ...a, [key]: value }), {});

          const incomes = sheet("incomes");
          const expenses = sheet("expenses");
          const debts = sheet("debts");
          const investments = sheet("investments");
          const profile = kvToObj(sheet("profile"));
          const retirement = kvToObj(sheet("retirement"));
          const tax = kvToObj(sheet("tax"));
          const scenarios = sheet("scenarios").map(r => ({
            ...r, assumptions: JSON.parse(r.assumptionsJSON || "{}"),
          }));

          set((state) => {
            if (Object.keys(profile).length) state.profile = profile as any;
            if (incomes.length) state.incomes = incomes as any;
            if (expenses.length) state.expenses = expenses as any;
            if (debts.length) state.debts = debts as any;
            if (investments.length) state.investments = investments as any;
            if (Object.keys(retirement).length) state.retirement = retirement as any;
            if (Object.keys(tax).length) state.tax = tax as any;
            if (scenarios.length) state.scenarios = scenarios as any;
            const f = computeForecasts(state as any);
            state.yearlyForecast = f.yearlyForecast;
            state.monthlyForecast = f.monthlyForecast;
          });
          success = true;
        } catch (e) {
          console.error("XLSX import failed:", e);
        }
        return success;
      },

      // ── Sync Status Setters ──────────────────────────
      setLocalSyncStatus: (status, error) => set((state) => {
        state.localSyncStatus = status;
        if (status === "completed") {
          state.lastLocalSaveTime = new Date().toISOString();
          state.lastSyncError = null;
        }
        if (status === "error") {
          state.lastSyncError = error || "Local save failed";
        }
      }),
      setRemoteSyncStatus: (status, error) => set((state) => {
        state.remoteSyncStatus = status;
        if (status === "completed") {
          state.lastRemoteSaveTime = new Date().toISOString();
          state.lastSyncError = null;
        }
        if (status === "error") {
          state.lastSyncError = error || "Remote save failed";
        }
      }),
    })),
    {
      name: "financial-planner-storage-v3",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return {
          getItem: () => null, setItem: () => {}, removeItem: () => {},
        };
        return localStorage;
      }),
      partialize: (state) => ({
        profile: state.profile,
        incomes: state.incomes,
        expenses: state.expenses,
        debts: state.debts,
        investments: state.investments,
        retirement: state.retirement,
        tax: state.tax,
        scenarios: state.scenarios,
        activeScenarioId: state.activeScenarioId,
        isSeedLoaded: state.isSeedLoaded,
        // Exclude sync status from persisted state
        // (localSyncStatus, remoteSyncStatus, lastLocalSaveTime, lastRemoteSaveTime, lastSyncError)
      }),
    }
  )
);

// ── Selectors ─────────────────────────────────────────────
export const selectActiveScenario = (s: Store) =>
  s.scenarios.find(sc => sc.id === s.activeScenarioId) ?? s.scenarios[0];

export const selectMortgage = (s: Store) =>
  s.debts.find(d => d.debtType === "mortgage" && d.isActive);

export const selectTotalMonthlyIncome = (s: Store) =>
  s.incomes.filter(i => i.isActive).reduce((sum, i) => {
    if (i.frequency === "yearly") return sum + i.amount / 12;
    if (i.frequency === "one-time") return sum;
    return sum + i.amount;
  }, 0);

export const selectTotalMonthlyExpenses = (s: Store) =>
  s.expenses.filter(e => e.isActive).reduce((sum, e) => {
    if (e.frequency === "yearly") return sum + e.amount / 12;
    if (e.frequency === "one-time") return sum;
    return sum + e.amount;
  }, 0);

export const selectTotalMonthlyDebtPayments = (s: Store) =>
  s.debts.filter(d => d.isActive).reduce(
    (sum, d) => sum + d.standardMonthlyPayment + d.extraMonthlyPayment,
    0
  );

export const selectTotalDebtBalance = (s: Store) =>
  s.debts.filter(d => d.isActive).reduce((sum, d) => sum + d.currentBalance, 0);

export const selectTotalInvestmentValue = (s: Store) =>
  s.investments.filter(i => i.isActive).reduce((sum, i) => sum + i.marketValue, 0);

export const selectNetWorth = (s: Store) => {
  const assets = s.investments.filter(i => i.isActive).reduce((sum, i) => sum + i.marketValue, 0);
  const liabilities = s.debts.filter(d => d.isActive).reduce((sum, d) => sum + d.currentBalance, 0);
  return assets - liabilities;
};