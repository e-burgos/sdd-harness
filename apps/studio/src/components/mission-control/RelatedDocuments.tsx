"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  Wrench,
} from "lucide-react";
import {
  toViewerDocument,
  type AgentGeneratedDocument,
} from "@/lib/agent-documents";
import type {
  ConversationDocument,
  RelatedFix,
  RelatedSpec,
} from "@/lib/conversation";
import { useT } from "@/lib/i18n/i18n";
import { DocumentViewerModal } from "./DocumentViewerModal";

export interface RelatedDocumentsProps {
  specs: RelatedSpec[];
  fixes: RelatedFix[];
  documents: ConversationDocument[];
  emptyMessage?: string;
  open: boolean;
  onToggle: () => void;
}

interface CycleGroup {
  cycle: string | null;
  items: ConversationDocument[];
}

function groupByCycle(documents: ConversationDocument[]): CycleGroup[] {
  const groups = new Map<string | null, ConversationDocument[]>();
  for (const document of documents)
    groups.set(document.cycle, [
      ...(groups.get(document.cycle) ?? []),
      document,
    ]);
  return [...groups]
    .map(([cycle, items]) => ({ cycle, items }))
    .sort((a, b) =>
      a.cycle === null
        ? -1
        : b.cycle === null
          ? 1
          : a.cycle.localeCompare(b.cycle),
    );
}

export function RelatedDocuments({
  specs,
  fixes,
  documents,
  emptyMessage,
  open,
  onToggle,
}: RelatedDocumentsProps) {
  const { t } = useT();
  const [viewing, setViewing] = useState<AgentGeneratedDocument | null>(null);

  const renderDocuments = (items: ConversationDocument[]) =>
    items.length > 0 && (
      <ul className="mt-1 min-w-0 space-y-1">
        {items.map((item) => (
          <li key={item.path} className="min-w-0">
            <button
              type="button"
              onClick={() => setViewing(toViewerDocument(item))}
              title={item.path}
              className="flex w-full min-w-0 items-start gap-1.5 rounded bg-white/5 px-1.5 py-1 text-left text-[10px] text-white hover:bg-white/10 hover:text-emerald-300"
            >
              <FileText
                className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400"
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="min-w-0 truncate" title={item.name}>
                  {item.name}
                </span>
                <span
                  className="min-w-0 truncate text-xs text-white/40"
                  title={item.agents.join(", ")}
                >
                  {item.agents.join(", ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );

  const renderCycleGroups = (items: ConversationDocument[], specId: string) =>
    groupByCycle(items).map((group) => (
      <div
        key={group.cycle ?? "root"}
        data-testid={`related-group-${specId}-${group.cycle ?? "root"}`}
        className="mt-1.5 min-w-0 pl-2"
      >
        <div className="flex min-w-0 items-center justify-between gap-2 text-white/60">
          <span
            className="min-w-0 truncate"
            title={
              group.cycle
                ? t("mc.related.cycle", { cycle: group.cycle })
                : t("mc.related.root")
            }
          >
            {group.cycle
              ? t("mc.related.cycle", { cycle: group.cycle })
              : t("mc.related.root")}
          </span>
          <span className="shrink-0">{group.items.length}</span>
        </div>
        {renderDocuments(group.items)}
      </div>
    ));

  const isEmpty = specs.length === 0 && fixes.length === 0;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section
      data-testid="related-documents"
      aria-label={t("mc.related.title")}
      className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 font-mono text-[10px]"
    >
      <button
        type="button"
        data-testid="related-documents-toggle"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-bold uppercase text-white/80 hover:text-white"
      >
        <Chevron className="h-3 w-3 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t("mc.related.title")}</span>
        <span className="shrink-0 text-white/50">{documents.length}</span>
      </button>
      {open && (
        <div
          data-testid="related-documents-body"
          className="min-w-0 space-y-2 overflow-hidden border-t border-white/10 px-2 py-2"
        >
          {isEmpty && (
            <p data-testid="related-documents-empty" className="text-white/50">
              {emptyMessage ?? t("mc.related.empty")}
            </p>
          )}
          {specs.length > 0 && (
            <div className="min-w-0">
              <h4 className="mb-1 flex items-center gap-1 font-bold uppercase text-emerald-400">
                <GitBranch className="h-3 w-3" aria-hidden />
                {t("mc.related.specs")}
              </h4>
              <ul className="min-w-0 space-y-1.5">
                {specs.map((spec) => {
                  const specDocuments = documents.filter(
                    (item) =>
                      item.specId === spec.specId && item.fixId === null,
                  );
                  return (
                    <li
                      key={spec.specId}
                      data-testid={`related-spec-${spec.specId}`}
                      className="min-w-0"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2 text-white">
                        <span className="min-w-0 truncate" title={spec.specId}>
                          {spec.specId}
                        </span>
                        <span className="shrink-0 text-white/50">
                          {specDocuments.length}
                        </span>
                      </div>
                      {renderCycleGroups(specDocuments, spec.specId)}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {fixes.length > 0 && (
            <div className="min-w-0">
              <h4 className="mb-1 flex items-center gap-1 font-bold uppercase text-amber-400">
                <Wrench className="h-3 w-3" aria-hidden />
                {t("mc.related.fixes")}
              </h4>
              <ul className="min-w-0 space-y-1.5">
                {fixes.map((fix) => (
                  <li
                    key={fix.fixId}
                    data-testid={`related-fix-${fix.fixId}`}
                    className="min-w-0"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 text-white">
                      <span className="min-w-0 truncate" title={fix.fixId}>
                        {fix.fixId}
                      </span>
                      <span className="shrink-0 text-white/50">
                        {
                          documents.filter((item) => item.fixId === fix.fixId)
                            .length
                        }
                      </span>
                    </div>
                    <div
                      className="min-w-0 truncate text-white/50"
                      title={t("mc.related.inSpec", { spec: fix.specId })}
                    >
                      {t("mc.related.inSpec", { spec: fix.specId })}
                    </div>
                    {renderDocuments(
                      documents.filter((item) => item.fixId === fix.fixId),
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <DocumentViewerModal
        document={viewing}
        onClose={() => setViewing(null)}
      />
    </section>
  );
}
