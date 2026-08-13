import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRightIcon,
  GitBranchIcon,
  ListIcon,
  ShieldCheckIcon,
  StackIcon,
  TerminalWindowIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Terminal } from './components/Terminal';
import { FileTree } from './components/FileTree';
import { CopyCommand } from './components/CopyCommand';
import { LiveCostsDemo } from './components/LiveCostsDemo';
import { Section, cascade, rise } from './components/Section';
import { SddDocsPage } from './pages/SddDocsPage';
import { GuiaSddPage } from './pages/GuiaSddPage';
import {
  AGENTS,
  APP_CATALOG,
  COMMANDS,
  GATES,
  HERMES_PHASES,
  LIB_CATALOG,
  MODES,
  PORTABILITY_POINTS,
  SDD_SCRIPTS,
  SERVICE_CATALOG,
} from './data/content';

const NAV = [
  { id: 'modos', label: 'Los 3 modos' },
  { id: 'hermes', label: 'Idea → producto' },
  { id: 'en-vivo', label: 'Costos en vivo' },
  { id: 'comandos', label: 'Comandos' },
  { id: 'metodologia', label: 'Metodología SDD' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'kit', label: 'El kit portable' },
  { id: 'empezar', label: 'Empezar' },
];

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.startsWith('#/') ? hash.slice(2) : '';
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function App() {
  const route = useHashRoute();
  const active = useScrollSpy(NAV.map((n) => n.id));
  const [menuOpen, setMenuOpen] = useState(false);
  const onDocsPage = route === 'sdd-docs';
  const onGuiaPage = route === 'guia-sdd';
  const onSubPage = onDocsPage || onGuiaPage;

  useEffect(() => {
    if (onSubPage) {
      window.scrollTo({ top: 0 });
      return;
    }
    const anchor = window.location.hash;
    if (anchor && !anchor.startsWith('#/')) {
      requestAnimationFrame(() =>
        document.querySelector(anchor)?.scrollIntoView(),
      );
    }
  }, [route, onSubPage]);

  return (
    <div className="grain min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b hairline bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <TerminalWindowIcon size={20} className="text-accent-400" />
            <span className="font-mono text-sm tracking-tight text-zinc-100">
              sdd-harness
            </span>
          </a>
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`text-[13px] transition-colors ${
                  !onSubPage && active === n.id
                    ? 'text-accent-300'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {n.label}
              </a>
            ))}
            <a
              href="#/sdd-docs"
              className={`rounded-full border px-3 py-1 font-mono text-[12px] transition-all ${
                onDocsPage
                  ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                  : 'hairline text-zinc-400 hover:border-accent-500/40 hover:text-accent-300'
              }`}
            >
              sdd:docs
            </a>
            <a
              href="#/guia-sdd"
              className={`rounded-full border px-3 py-1 font-mono text-[12px] transition-all ${
                onGuiaPage
                  ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                  : 'hairline text-zinc-400 hover:border-accent-500/40 hover:text-accent-300'
              }`}
            >
              guía sdd
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="https://www.npmjs.com/package/@e-burgos/sdd-harness"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border hairline px-3 py-1.5 font-mono text-[12px] text-zinc-300 transition-colors hover:border-accent-500/40 hover:text-accent-300"
            >
              npm
            </a>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              className="rounded-lg border hairline p-2 text-zinc-300 transition-colors active:scale-[0.95] lg:hidden"
            >
              {menuOpen ? <XIcon size={17} /> : <ListIcon size={17} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="absolute inset-x-0 top-full border-b border-t hairline bg-ink-950/95 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl lg:hidden"
            >
              <motion.div
                variants={cascade}
                initial="hidden"
                animate="show"
                className="flex flex-col px-5 py-3"
              >
                {NAV.map((n) => (
                  <motion.a
                    key={n.id}
                    variants={rise}
                    href={`#${n.id}`}
                    onClick={() => setMenuOpen(false)}
                    className={`border-b hairline py-3.5 font-mono text-[13px] ${
                      !onSubPage && active === n.id
                        ? 'text-accent-300'
                        : 'text-zinc-400'
                    }`}
                  >
                    <span className="mr-3 text-zinc-600">
                      {String(NAV.indexOf(n) + 1).padStart(2, '0')}
                    </span>
                    {n.label}
                  </motion.a>
                ))}
                <motion.a
                  variants={rise}
                  href="#/sdd-docs"
                  onClick={() => setMenuOpen(false)}
                  className={`border-b hairline py-3.5 font-mono text-[13px] ${
                    onDocsPage ? 'text-accent-300' : 'text-zinc-400'
                  }`}
                >
                  <span className="mr-3 text-zinc-600">09</span>
                  sdd:docs — el visor
                </motion.a>
                <motion.a
                  variants={rise}
                  href="#/guia-sdd"
                  onClick={() => setMenuOpen(false)}
                  className={`py-3.5 font-mono text-[13px] ${
                    onGuiaPage ? 'text-accent-300' : 'text-zinc-400'
                  }`}
                >
                  <span className="mr-3 text-zinc-600">10</span>
                  guía sdd — el manual completo
                </motion.a>
              </motion.div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="top" className="mx-auto max-w-[1200px] px-5 md:px-8">
        {onDocsPage ? (
          <SddDocsPage />
        ) : onGuiaPage ? (
          <GuiaSddPage />
        ) : (
          <>
            <Hero />
            <ModesSection />
            <HermesSection />
            <LiveSection />
            <CommandsSection />
            <MethodologySection />
            <CatalogSection />
            <KitSection />
            <StartSection />
          </>
        )}
      </main>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-10 font-mono text-[12px] text-zinc-600 md:flex-row md:items-center md:justify-between md:px-8">
          <span>@e-burgos/sdd-harness — MIT</span>
          <a
            href="https://www.estebanburgos.com.ar"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-accent-300"
          >
            Desarrollado por{' '}
            <span className="text-zinc-400">Esteban Burgos</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <div className="grid items-center gap-12 py-16 md:min-h-[78dvh] md:grid-cols-[7fr_5fr] md:gap-14 md:py-20">
      <motion.div variants={cascade} initial="hidden" animate="show">
        <motion.p
          variants={rise}
          className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-400"
        >
          Spec-Driven Development CLI
        </motion.p>
        <motion.h1
          variants={rise}
          className="max-w-[16ch] text-4xl font-medium leading-[1.02] tracking-tighter text-zinc-50 md:text-[3.6rem]"
        >
          Repos listos para agentes.
          <span className="text-zinc-500"> Specs antes que código.</span>
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-zinc-400"
        >
          <code className="text-zinc-200">harness</code> genera repos con la
          metodología SDD integrada: 7 agentes especializados, gates que
          impiden codear sin diseño, registros validados por schema y un arnés
          dual que Claude Code y GitHub Copilot leen por igual.
        </motion.p>
        <motion.div variants={rise} className="mt-9 flex flex-wrap items-center gap-4">
          <CopyCommand command="npx @e-burgos/sdd-harness init" />
          <a
            href="#modos"
            className="group inline-flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-accent-300"
          >
            Ver los 3 modos
            <ArrowRightIcon
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </motion.div>
        <motion.div
          variants={rise}
          className="mt-12 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11.5px] text-zinc-500"
        >
          <span>7 agentes SDD</span>
          <span>18 skills</span>
          <span>4 gates</span>
          <span>schemas estrictos</span>
          <span>costos en vivo</span>
          <span>memoria portable</span>
          <span>Nx · standalone · existente</span>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.25 }}
      >
        <Terminal />
      </motion.div>
    </div>
  );
}

function ModesSection() {
  const [mode, setMode] = useState(MODES[0]);

  return (
    <Section
      id="modos"
      kicker="01 — los tres modos"
      title="Un producto, tres formas de entrar"
      lead="Monorepo nuevo, app suelta, o un proyecto que ya existe: el sistema SDD que se instala es exactamente el mismo."
    >
      <div className="mb-8 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m)}
            className={`rounded-full border px-4 py-2 font-mono text-[12.5px] transition-all active:scale-[0.97] ${
              mode.id === m.id
                ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                : 'hairline text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          className="grid gap-10 md:grid-cols-[5fr_7fr]"
        >
          <div>
            <CopyCommand command={mode.command} />
            <h3 className="mt-6 max-w-[28ch] text-xl font-medium tracking-tight text-zinc-100">
              {mode.claim}
            </h3>
            <p className="mt-4 max-w-[48ch] text-[14px] leading-relaxed text-zinc-400">
              {mode.detail}
            </p>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border hairline bg-ink-900/60 p-6 md:p-8">
              <FileTree nodes={mode.tree} />
            </div>
            <div className="rounded-2xl border hairline bg-ink-900/40 p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {mode.example.title}
              </p>
              <div className="space-y-1.5 font-mono text-[12px] leading-relaxed">
                {mode.example.lines.map((line) => (
                  <div
                    key={line}
                    className={
                      line.startsWith('$') || line.startsWith('/')
                        ? 'text-zinc-200'
                        : line.startsWith('#')
                          ? 'text-zinc-600'
                          : 'text-zinc-500'
                    }
                  >
                    {line.startsWith('$') ? (
                      <>
                        <span className="mr-2 text-accent-400">$</span>
                        {line.slice(2)}
                      </>
                    ) : (
                      line
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </Section>
  );
}

function CodeLines({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-1.5 font-mono text-[12.5px] leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={`${i}-${line}`}
          className={
            line.startsWith('$')
              ? 'text-zinc-200'
              : line.startsWith('✓')
                ? 'text-accent-300'
                : line.startsWith('//') || line.startsWith('#')
                  ? 'text-zinc-600'
                  : line.startsWith('→')
                    ? 'text-zinc-500'
                    : 'text-zinc-400'
          }
        >
          {line.startsWith('$') ? (
            <>
              <span className="mr-2 text-accent-400">$</span>
              {line.slice(2)}
            </>
          ) : (
            line || ' '
          )}
        </div>
      ))}
    </div>
  );
}

function HermesSection() {
  const [phase, setPhase] = useState(HERMES_PHASES[0]);

  return (
    <Section
      id="hermes"
      kicker="02 — hermes, el punta a punta"
      title="De una idea en una frase a un producto con specs"
      lead="Le pasás una idea en lenguaje natural y el sistema configura el stack, siembra el backlog y conduce el loop de ciclos — con checkpoints humanos donde importa y sin bypassear un solo gate."
    >
      <div className="mb-8 flex flex-wrap gap-2">
        {HERMES_PHASES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPhase(p)}
            className={`rounded-full border px-4 py-2 font-mono text-[12px] transition-all active:scale-[0.97] ${
              phase.id === p.id
                ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                : 'hairline text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          className="grid gap-10 md:grid-cols-[5fr_7fr]"
        >
          <div>
            <h3 className="max-w-[28ch] text-xl font-medium tracking-tight text-zinc-100">
              {phase.title}
            </h3>
            <p className="mt-4 max-w-[48ch] text-[14px] leading-relaxed text-zinc-400">
              {phase.body}
            </p>
            {phase.id === 'loop' && (
              <p className="mt-4 max-w-[48ch] text-[12.5px] leading-relaxed text-zinc-500">
                Y cada ciclo deja lecciones en{' '}
                <code className="text-zinc-300">sdd/memory/</code>: el sistema
                aprende del proyecto y no vuelve a pagar dos veces el mismo
                descubrimiento.
              </p>
            )}
          </div>
          <div className="rounded-2xl border hairline bg-ink-900/60 p-6 md:p-7">
            <CodeLines lines={phase.code} />
          </div>
        </motion.div>
      </AnimatePresence>
    </Section>
  );
}

function LiveSection() {
  return (
    <Section
      id="en-vivo"
      kicker="03 — la feature estrella"
      title="Un tablero que trabaja mientras los agentes trabajan"
      lead="Cada ciclo registra tokens y tiempos. El visor los convierte en una comparativa de costos contra la estimación tradicional — y en local se actualiza solo, mientras el loop corre. Dale play:"
    >
      <LiveCostsDemo />

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {[
          {
            t: 'Telemetría honesta',
            d: 'Al cerrar cada ciclo se registran tokens por tier de modelo y minutos en cycle.json → metrics.usage. El costo agéntico sale de tarifas editables en sdd/pricing.json; la estimación tradicional, de las horas que ya estiman tus tasks.',
          },
          {
            t: 'Reactividad quirúrgica',
            d: 'El visor pollea un fingerprint POR ÁREA de los registros cada 4 segundos. Solo re-renderiza tu vista si cambió un área de la que depende: cerrar un ciclo actualiza Costos y Ciclos, pero no te toca la vista de Agentes.',
          },
          {
            t: 'Tu UI queda intacta',
            d: 'Secciones expandidas, búsquedas escritas y posición de scroll se preservan en cada actualización. Y si tenés un documento abierto o la pestaña oculta, el refresh espera. En hosting estático, el botón Actualizar de siempre.',
          },
        ].map((f, i) => (
          <motion.div
            key={f.t}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{
              type: 'spring',
              stiffness: 90,
              damping: 18,
              delay: i * 0.08,
            }}
          >
            <h3 className="text-[15px] font-medium tracking-tight text-zinc-100">
              {f.t}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
              {f.d}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <CopyCommand command="pnpm sdd:docs" />
        <a
          href="#/sdd-docs"
          className="group inline-flex items-center gap-2 text-[13.5px] text-zinc-300 transition-colors hover:text-accent-300"
        >
          Ver el visor completo, con capturas reales
          <ArrowRightIcon
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </a>
      </div>
    </Section>
  );
}

function CommandsSection() {
  return (
    <Section
      id="comandos"
      kicker="04 — referencia"
      title="Comandos"
      lead="Todo interactivo con prompts guiados; todo automatizable con flags y -y."
    >
      <motion.div
        variants={cascade}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="divide-y divide-zinc-800/60 border-y hairline"
      >
        {COMMANDS.map((c) => (
          <motion.div
            key={c.name}
            variants={rise}
            className="grid gap-3 py-6 transition-colors hover:bg-ink-900/40 md:grid-cols-[220px_1fr] md:gap-10 md:px-4"
          >
            <div className="font-mono text-[14px] font-medium text-accent-300">
              {c.name}
            </div>
            <div>
              <code className="block break-words font-mono text-[12px] text-zinc-500">
                {c.usage}
              </code>
              <p className="mt-2.5 text-[14px] text-zinc-300">{c.summary}</p>
              <ul className="mt-2 space-y-1">
                {c.points.map((p) => (
                  <li key={p} className="text-[13px] leading-relaxed text-zinc-500">
                    <span className="mr-2 text-zinc-700">—</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}

function MethodologySection() {
  return (
    <Section
      id="metodologia"
      kicker="05 — la metodología"
      title="Siete agentes, tres gates, cero improvisación"
      lead="Cada feature atraviesa un ciclo de diseño antes de tocar código. Los agentes escriben artefactos verificables; los gates los exigen."
    >
      <div className="grid gap-14 lg:grid-cols-[6fr_5fr]">
        <motion.ol
          variants={cascade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="relative space-y-0 border-l hairline pl-8"
        >
          {AGENTS.map((a, i) => (
            <motion.li key={a.name} variants={rise} className="relative pb-8 last:pb-0">
              <span className="absolute -left-[2.42rem] top-1 flex size-5 items-center justify-center rounded-full border border-accent-500/40 bg-ink-950 font-mono text-[9px] text-accent-400">
                {i + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-[13.5px] font-medium text-zinc-100">
                  sdd-{a.name}
                </span>
                <span className="font-mono text-[11px] text-zinc-600">
                  {a.writes}
                </span>
              </div>
              <p className="mt-1 text-[13.5px] text-zinc-400">{a.role}</p>
            </motion.li>
          ))}
        </motion.ol>

        <div className="space-y-5">
          {GATES.map((g, i) => (
            <motion.div
              key={g.name}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                type: 'spring',
                stiffness: 90,
                damping: 18,
                delay: i * 0.08,
              }}
              className="rounded-2xl border hairline bg-ink-900/50 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheckIcon size={16} className="text-accent-400" />
                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-accent-300">
                  {g.name}
                </span>
              </div>
              <p className="mt-3 text-[14.5px] font-medium leading-snug text-zinc-100">
                {g.rule}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                {g.how}
              </p>
            </motion.div>
          ))}
          <p className="pl-1 pt-1 font-mono text-[11.5px] leading-relaxed text-zinc-600">
            specs por autor: spec-jdoe-001-user-onboarding / cycles/cycle-01/
            <br />6 artefactos por ciclo — brief · functional · planner ·
            architect · tasks · cycle
          </p>
        </div>
      </div>
    </Section>
  );
}

function CatalogSection() {
  return (
    <Section
      id="catalogo"
      kicker="06 — catálogo"
      title="Lo que puede generar"
    >
      <div className="grid gap-12 lg:grid-cols-[7fr_5fr]">
        <div>
          <h3 className="mb-4 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em] text-zinc-500">
            <StackIcon size={14} /> Apps — 7 tipos
          </h3>
          <div className="divide-y divide-zinc-800/60 border-y hairline">
            {APP_CATALOG.map((a) => (
              <div
                key={a.type}
                className="grid grid-cols-[110px_1fr] items-baseline gap-4 py-3.5 sm:grid-cols-[130px_1fr_auto]"
              >
                <code className="font-mono text-[13px] text-accent-300">
                  {a.type}
                </code>
                <span className="text-[13.5px] text-zinc-300">{a.stack}</span>
                <span className="col-start-2 font-mono text-[11px] text-zinc-600 sm:col-start-3">
                  {a.origin}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-10">
          <div>
            <h3 className="mb-4 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em] text-zinc-500">
              <GitBranchIcon size={14} /> Libs compartidas
            </h3>
            <div className="flex flex-wrap gap-2">
              {LIB_CATALOG.map((l) => (
                <code
                  key={l}
                  className="rounded-lg border hairline px-3 py-1.5 font-mono text-[12px] text-zinc-300"
                >
                  {l}
                </code>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-4 font-mono text-[12px] uppercase tracking-[0.2em] text-zinc-500">
              Servicios Docker
            </h3>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATALOG.map((s) => (
                <code
                  key={s}
                  className="rounded-lg border hairline px-3 py-1.5 font-mono text-[12px] text-zinc-300"
                >
                  {s}
                </code>
              ))}
            </div>
            <p className="mt-4 max-w-[40ch] text-[12.5px] leading-relaxed text-zinc-500">
              docker-compose.yml con healthchecks, listo para levantar la
              infraestructura local del ciclo.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function KitSection() {
  return (
    <Section
      id="kit"
      kicker="07 — el corazón"
      title="El kit SDD portable"
      lead="Todo lo que la CLI instala vive en una sola carpeta sdd/ copiada verbatim — diseñada para moverse entre repos sin editar un solo archivo."
    >
      <div className="grid gap-12 lg:grid-cols-[5fr_6fr]">
        <motion.div
          variants={cascade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="space-y-8"
        >
          {PORTABILITY_POINTS.map((p) => (
            <motion.div key={p.title} variants={rise}>
              <h3 className="text-[15.5px] font-medium tracking-tight text-zinc-100">
                {p.title}
              </h3>
              <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-zinc-400">
                {p.body}
              </p>
            </motion.div>
          ))}
        </motion.div>
        <div>
          <h3 className="mb-4 font-mono text-[12px] uppercase tracking-[0.2em] text-zinc-500">
            Scripts que viajan con el kit
          </h3>
          <div className="divide-y divide-zinc-800/60 rounded-2xl border hairline bg-ink-900/50">
            {SDD_SCRIPTS.map((s) => (
              <div key={s.cmd} className="px-5 py-4">
                <code className="font-mono text-[12.5px] text-accent-300">
                  {s.cmd}
                </code>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                  {s.what}
                </p>
              </div>
            ))}
          </div>
          <a
            href="#/sdd-docs"
            className="group mt-5 inline-flex items-center gap-2 text-[13.5px] text-zinc-300 transition-colors hover:text-accent-300"
          >
            Conocé <code className="text-accent-300">sdd:docs</code> a fondo —
            capturas reales y las 16 vistas
            <ArrowRightIcon
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        className="mt-14 rounded-2xl border hairline bg-ink-900/50 p-6 md:p-8"
      >
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-accent-400">
          Actualizar el kit — sin miedo
        </p>
        <h3 className="max-w-[40ch] text-xl font-medium tracking-tight text-zinc-100">
          Un comando trae todo lo nuevo. Lo tuyo no se toca.
        </h3>
        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            <CopyCommand command="npx @e-burgos/sdd-harness@latest update sdd" />
            <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed text-zinc-400">
              El update se gobierna por los hashes de{' '}
              <code className="text-zinc-300">sdd/kit.json</code>: sabe
              exactamente qué archivo es del kit, cuál es tuyo y cuál
              modificaste. Al cierre regenera el catálogo, refresca los
              symlinks y corre <code className="text-zinc-300">sdd:validate</code>.
            </p>
          </div>
          <div className="divide-y divide-zinc-800/60 border-y hairline font-mono text-[12px]">
            {[
              {
                k: 'Tus datos',
                v: 'specs, ciclos, fixes, contextos, memoria — jamás se tocan',
              },
              {
                k: 'Kit sin modificar',
                v: 'se reemplaza por la versión nueva, silenciosamente',
              },
              {
                k: 'Archivos nuevos',
                v: 'se agregan solos (memoria, pricing, skills nuevas…)',
              },
              {
                k: 'Lo que editaste',
                v: 'queda intacto; la versión nueva aterriza al lado como *.new para fundir a mano',
              },
            ].map((row) => (
              <div
                key={row.k}
                className="grid grid-cols-[130px_1fr] gap-4 py-3 sm:grid-cols-[170px_1fr]"
              >
                <span className="text-accent-300">{row.k}</span>
                <span className="leading-relaxed text-zinc-400">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Section>
  );
}

function StartSection() {
  return (
    <Section
      id="empezar"
      kicker="08 — empezar"
      title="Tres comandos y estás adentro"
    >
      <div className="grid gap-8 md:grid-cols-3">
        {[
          {
            n: '01',
            t: 'Generá o instalá',
            c: 'npx @e-burgos/sdd-harness init',
            d: 'Monorepo Nx o standalone. Para un repo existente: harness configure sdd.',
          },
          {
            n: '02',
            t: 'Escribí tu primera spec',
            c: 'harness add spec mi-feature',
            d: 'El QUÉ antes del cómo. Queda registrada y validada en sdd/specs/index.json.',
          },
          {
            n: '03',
            t: 'Arrancá el ciclo',
            c: '/start-sdd-cycle.prompt',
            d: 'Desde Claude Code o Copilot: el orquestador toma la spec y el ciclo corre solo.',
          },
        ].map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{
              type: 'spring',
              stiffness: 90,
              damping: 18,
              delay: i * 0.1,
            }}
            className={i === 1 ? 'md:translate-y-6' : ''}
          >
            <span className="font-mono text-[11px] text-zinc-600">{s.n}</span>
            <h3 className="mt-2 text-lg font-medium tracking-tight text-zinc-100">
              {s.t}
            </h3>
            <code className="mt-3 block break-words font-mono text-[12.5px] text-accent-300">
              {s.c}
            </code>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
              {s.d}
            </p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
