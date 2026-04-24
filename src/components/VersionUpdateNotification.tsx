"use client";
import { useEffect, useState } from "react";
import { APP_VERSION, CHANGELOG } from "@/lib/version";
import {
  registerVersionLog,
  markVersionNotified,
  getUnnotifiedVersion,
  type VersionLog,
} from "@/lib/version-log";
import { X, Sparkles, ChevronRight } from "lucide-react";

export function VersionUpdateNotification() {
  const [unnotified, setUnnotified] = useState<VersionLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Register current version
    const changelogEntry = CHANGELOG.find((c) => c.version === APP_VERSION);
    if (changelogEntry) {
      const isNew = registerVersionLog(APP_VERSION, changelogEntry.changes);
      if (isNew) {
        // New version detected — show notification
        const unnotifiedLog = getUnnotifiedVersion();
        setUnnotified(unnotifiedLog);
      }
    }
  }, []);

  const handleDismiss = () => {
    if (unnotified) {
      markVersionNotified(unnotified.version);
      setUnnotified(null);
    }
  };

  if (!unnotified) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-white" />
              <h2 className="text-white font-bold text-lg">What's New</h2>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Version</div>
              <div className="text-2xl font-bold text-foreground">
                v{unnotified.version}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(unnotified.timestamp).toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            {/* Changes List */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Updates
              </h3>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {unnotified.changes.map((change, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                      ✓
                    </span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Details Button */}
            {!showDetails && (
              <button
                onClick={() => setShowDetails(true)}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                View full changelog
                <ChevronRight size={14} />
              </button>
            )}

            {showDetails && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs space-y-3 max-h-64 overflow-y-auto">
                  {CHANGELOG.slice(0, 3).map((entry) => (
                    <div key={entry.version}>
                      <div className="font-semibold text-foreground">
                        v{entry.version}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {entry.date}
                      </div>
                      <ul className="text-[11px] mt-1 space-y-1 ml-2">
                        {entry.changes.slice(0, 3).map((change, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            • {change}
                          </li>
                        ))}
                        {entry.changes.length > 3 && (
                          <li className="text-muted-foreground">
                            • +{entry.changes.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-3 bg-muted/30 rounded-b-2xl flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
