import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, MonitorIcon, PlayIcon } from '@phosphor-icons/react';
import { CopyCommand } from '../components/CopyCommand';
import { Section, cascade, rise } from '../components/Section';
import {
  VIEWER_PRINCIPLES,
  VIEWER_SECTIONS,
  VIEWER_SHOTS,
} from '../data/content';
import dashboardShot from '../assets/sdd-docs/dashboard.png';
import agentsShot from '../assets/sdd-docs/agents.png';
import skillsShot from '../assets/sdd-docs/skills.png';
import schemasShot from '../assets/sdd-docs/schemas.png';
import helpShot from '../assets/sdd-docs/help.png';

const SHOT_SRC: Record<string, string> = {
  dashboard: dashboardShot,
  agents: agentsShot,
  skills: skillsShot,
  schemas: schemasShot,
  help: helpShot,
};

export function SddDocsPage() {
  return (
    <>
      <ViewerHero />
      <ViewerGallery />
      <ViewerUsage />
      <ViewerPrinciples />
    </>
  );
}

function ViewerHero() {
  return (
    <div className="py-16 md:py-24">
      <motion.div variants={cascade} initial="hidden" animate="show">
        <motion.a
          variants={rise}
          href="#top"
          className="mb-10 inline-flex items-center gap-2 font-mono text-[12px] text-zinc-500 transition-colors hover:text-accent-300"
        >
          <ArrowLeftIcon size={13} />
          volver a la documentación
        </motion.a>
        <motion.p
          variants={rise}
          className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-400"
        >
          sdd:docs — la herramienta estrella
        </motion.p>
        <motion.h1
          variants={rise}
          className="max-w-[18ch] text-4xl font-medium leading-[1.03] tracking-tighter text-zinc-50 md:text-[3.2rem]"
        >
          El sistema SDD tiene su propia cara.
          <span className="text-zinc-500"> Y vive dentro del kit.</span>
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-zinc-400"
        >
          Los registros de SDD son JSON pensados para máquinas.{' '}
          <code className="text-zinc-200">sdd:docs</code> es su cara humana: un
          visor que lee <code className="text-zinc-300">global.json</code>,
          specs, ciclos, tareas y catálogos <em>en vivo</em> y los convierte en
          un dashboard navegable — sin instalar nada, sin build, sin CDN.
        </motion.p>
        <motion.div variants={rise} className="mt-9">
          <CopyCommand command="pnpm sdd:docs" />
          <p className="mt-3 pl-1 font-mono text-[11.5px] text-zinc-600">
            → http://127.0.0.1:4310/sdd/docs/
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function ViewerGallery() {
  const [shot, setShot] = useState(VIEWER_SHOTS[0]);

  return (
    <section className="border-t hairline py-16 md:py-20">
      <div className="mb-8 flex flex-wrap gap-2">
        {VIEWER_SHOTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setShot(s)}
            className={`rounded-full border px-4 py-2 font-mono text-[12.5px] transition-all active:scale-[0.97] ${
              shot.id === s.id
                ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                : 'hairline text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.figure
          key={shot.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        >
          <div className="overflow-hidden rounded-2xl border hairline bg-ink-900 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2 border-b hairline px-4 py-3">
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-accent-500/60" />
              <span className="ml-3 font-mono text-[11px] tracking-wide text-zinc-500">
                127.0.0.1:4310/sdd/docs/#/{shot.id}
              </span>
            </div>
            <img
              src={SHOT_SRC[shot.id]}
              alt={`Vista ${shot.tab} del visor sdd:docs`}
              className="block w-full"
              loading="lazy"
            />
          </div>
          <figcaption className="mt-4 max-w-[70ch] pl-1 text-[13.5px] leading-relaxed text-zinc-500">
            {shot.caption}
          </figcaption>
        </motion.figure>
      </AnimatePresence>

      <p className="mt-6 pl-1 font-mono text-[11.5px] text-zinc-600">
        Capturas reales del visor corriendo sobre un workspace generado con
        harness init.
      </p>
    </section>
  );
}

function ViewerUsage() {
  return (
    <Section
      id="viewer-uso"
      kicker="cómo se usa"
      title="Un comando, quince vistas"
      lead="El visor se instala solo — viene adentro de sdd/docs/ en cada repo generado. No hay setup."
    >
      <div className="grid gap-12 lg:grid-cols-[5fr_6fr]">
        <div className="space-y-7">
          {[
            {
              n: '01',
              t: 'Levantalo',
              c: 'pnpm sdd:docs',
              d: 'Un server de solo módulos node:* sirve el visor en el puerto 4310. Sin npm install extra, sin build.',
            },
            {
              n: '02',
              t: 'Navegá por hash',
              c: '#/specs · #/cycles · #/agents',
              d: 'Router por hash con 15 vistas en 5 secciones. Cada spec, ciclo, task y fix con su detalle.',
            },
            {
              n: '03',
              t: 'Trabajá y actualizá',
              c: 'Actualizar → re-lee el filesystem',
              d: 'El visor no cachea un export: lee los registros vivos. Cerraste un ciclo, se ve. El validador lo mantiene honesto.',
            },
          ].map((s) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              className="flex gap-5"
            >
              <span className="font-mono text-[11px] text-zinc-600">{s.n}</span>
              <div>
                <h3 className="flex items-center gap-2 text-[15.5px] font-medium tracking-tight text-zinc-100">
                  {s.n === '01' ? (
                    <PlayIcon size={14} className="text-accent-400" />
                  ) : (
                    <MonitorIcon size={14} className="text-accent-400" />
                  )}
                  {s.t}
                </h3>
                <code className="mt-1.5 block font-mono text-[12.5px] text-accent-300">
                  {s.c}
                </code>
                <p className="mt-2 max-w-[46ch] text-[13px] leading-relaxed text-zinc-500">
                  {s.d}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div>
          <h3 className="mb-4 font-mono text-[12px] uppercase tracking-[0.2em] text-zinc-500">
            Las 15 vistas
          </h3>
          <div className="divide-y divide-zinc-800/60 rounded-2xl border hairline bg-ink-900/50">
            {VIEWER_SECTIONS.map((s) => (
              <div
                key={s.section}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[150px_1fr] sm:gap-6"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-600">
                  {s.section}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {s.views.map((v) => (
                    <span key={v} className="font-mono text-[12.5px] text-zinc-300">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ViewerPrinciples() {
  return (
    <Section
      id="viewer-diseno"
      kicker="por qué es así"
      title="Portable a propósito"
      lead="Cada decisión del visor sale de la misma regla que gobierna el kit: copiar sdd/ a otro repo tiene que funcionar sin editar nada."
    >
      <motion.div
        variants={cascade}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="grid gap-x-14 gap-y-10 md:grid-cols-2"
      >
        {VIEWER_PRINCIPLES.map((p) => (
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
      <div className="mt-16 flex flex-wrap items-center gap-5 border-t hairline pt-8">
        <CopyCommand command="npx @e-burgos/sdd-harness init" />
        <p className="font-mono text-[12px] text-zinc-600">
          Todo repo generado trae el visor adentro.
        </p>
      </div>
    </Section>
  );
}
