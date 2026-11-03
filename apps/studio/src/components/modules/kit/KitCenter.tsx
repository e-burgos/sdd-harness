'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { KitCapabilitiesView } from './KitCapabilitiesView';
import { KitToolsView } from './KitToolsView';
import { CenterFrame, EntryBrowser, FileViewer, IndexGate, fileLabel } from './KitParts';
import { useKitIndex } from './KitProvider';
import { contextEntries, entriesOf, journalEntries, parseKitSelection, resolveDoc, type KitDocId } from './kit-model';

const LESSONS_PATH = 'sdd/memory/lessons.md';

function DocumentView({ doc }: { doc: KitDocId }) {
  const { t, lang } = useT();
  const { index, status } = useKitIndex();
  const title = t(`module.kit.row.${doc}`);
  const resolved = resolveDoc(index?.entries ?? null, doc, lang);
  const waiting = index === null && (status === 'loading' || status === 'error');
  return (
    <CenterFrame title={title}>
      {resolved === null && !waiting ? (
        <EmptyState size="sm" title={t('module.kit.doc.missing')} />
      ) : resolved === null ? null : (
        <div className="flex flex-col gap-3">
          {resolved.fallback && (
            <p role="status" className="text-small text-ink-400">
              {t('module.kit.doc.fallback', { wanted: t(`module.kit.lang.${lang}`), shown: resolved.language === 'es' || resolved.language === 'en' ? t(`module.kit.lang.${resolved.language}`) : resolved.language })}
            </p>
          )}
          <FileViewer path={resolved.path} mode="markdown" />
        </div>
      )}
    </CenterFrame>
  );
}

function SchemasView() {
  const { t } = useT();
  const title = t('module.kit.schemas.title');
  return (
    <CenterFrame title={title}>
      <IndexGate>
        {(entries) => <EntryBrowser title={title} mode="json" emptyTitle={t('module.kit.index.empty')} items={entriesOf(entries, 'schemas').map((entry) => ({ entry, label: fileLabel(entry) }))} />}
      </IndexGate>
    </CenterFrame>
  );
}

function ContextView() {
  const { t } = useT();
  const title = t('module.kit.context.title');
  return (
    <CenterFrame title={title}>
      <IndexGate>
        {(entries) => (
          <EntryBrowser
            title={title}
            mode="markdown"
            emptyTitle={t('module.kit.index.empty')}
            items={contextEntries(entries).map((entry) => ({
              entry,
              label: fileLabel(entry),
              group: entry.group,
              badge: t(entry.role === 'base' ? 'module.kit.context.base' : 'module.kit.context.fragment'),
            }))}
          />
        )}
      </IndexGate>
    </CenterFrame>
  );
}

function LessonsView() {
  const { t } = useT();
  const { index, status } = useKitIndex();
  const known = index === null || entriesOf(index.entries, 'memory', 'lessons').length > 0;
  return (
    <CenterFrame title={t('module.kit.memory.lessons')}>
      {known || status === 'unsupported' ? <FileViewer path={LESSONS_PATH} mode="markdown" /> : <EmptyState size="sm" title={t('module.kit.doc.missing')} />}
    </CenterFrame>
  );
}

function JournalView() {
  const { t } = useT();
  const title = t('module.kit.memory.journal');
  return (
    <CenterFrame title={title}>
      <IndexGate>
        {(entries) => <EntryBrowser title={title} mode="markdown" emptyTitle={t('module.kit.memory.journalEmpty')} items={journalEntries(entries).map((entry) => ({ entry, label: fileLabel(entry).replace(/\.md$/, '') }))} />}
      </IndexGate>
    </CenterFrame>
  );
}

export function KitCenter() {
  const { t } = useT();
  const view = parseKitSelection(useNav((s) => s.selection.kit));
  if (view === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState size="sm" title={t('module.kit.center.select')} description={t('module.kit.center.selectHint')} />
      </div>
    );
  }
  switch (view.kind) {
    case 'capabilities':
      return <KitCapabilitiesView which={view.which} />;
    case 'tools':
      return <KitToolsView />;
    case 'doc':
      return <DocumentView doc={view.doc} />;
    case 'schemas':
      return <SchemasView />;
    case 'context':
      return <ContextView />;
    case 'memory':
      return view.which === 'lessons' ? <LessonsView /> : <JournalView />;
  }
}
