// Worked examples, in both interface languages.
// frames: [name, focus, question] in face order of the solid.
// findings: [frame, text, tags, rereads: [frame, text, tags][]].
// edges: [frameA, frameB, tension, emerges] (only between neighbouring faces).

import { createState, pairKey } from './state.js';
import { placeFinding } from './geometry.js';

const CONTENT = {
  sustainability: {
    solid: 'cube',
    principal: null,
    es: {
      name: 'Sustentabilidad',
      description:
        'Un concepto que casi todos usan y nadie ve completo: ¿cómo sostener la vida, humana y no humana, a lo largo del tiempo? Cada marco lo mira por una ventana distinta.',
      frames: [
        ['Sociocultural', 'Identidad, justicia distributiva, saberes locales y cohesión comunitaria.', '¿Es justo para todas las comunidades?'],
        ['Político-jurídico', 'Normas, gobernanza, soberanía y negociación internacional.', '¿Quién decide y con qué legitimidad?'],
        ['Económico', 'Flujos de capital, costos, eficiencia, empleo y mercados.', '¿Es viable a largo plazo?'],
        ['Tecnológico', 'Innovación, eficiencia energética y soluciones escalables.', '¿Puede la tecnología resolver lo que la tecnología causó?'],
        ['Ecológico', 'Ciclos biogeoquímicos, biodiversidad y límites planetarios.', '¿Respeta los límites del planeta?'],
        ['Filosófico', 'Fundamentos éticos, valor de la naturaleza y deberes hacia el futuro.', '¿Qué les debemos a las generaciones futuras y a otras especies?'],
      ],
      findings: [
        [2, 'Las energías renovables ya cuestan menos que los combustibles fósiles en buena parte del mundo.', ['key'], [
          [4, 'Más barato no basta: si el consumo total sigue creciendo, la ganancia se pierde (efecto rebote).', ['nuances']],
          [0, '¿Más barato para quién? La minería del litio y del cobre que exige la transición también desplaza comunidades.', ['questions']],
        ]],
        [2, 'Sin un precio al carbono, contaminar sigue siendo más barato que no hacerlo.', [], [
          [1, 'Los impuestos al carbono existen, pero su precio suele ser demasiado bajo para cambiar conductas.', ['confirms']],
        ]],
        [4, 'Varios límites planetarios (clima, biodiversidad, ciclo del nitrógeno) ya se rebasaron.', ['risk'], [
          [2, 'Los límites no aparecen en la contabilidad nacional; habría que tratarlos como restricciones, no como costos.', ['extends']],
        ]],
        [4, 'La biodiversidad sostiene servicios que ningún mercado registra: polinización, agua limpia, suelos fértiles.', [], []],
        [0, 'Los daños ambientales recaen sobre todo en comunidades pobres e indígenas.', ['key'], [
          [1, 'Existe el derecho a la consulta previa, pero se aplica poco y tarde.', ['confirms']],
          [2, 'Los indicadores agregados como el PIB no registran quién paga los costos.', ['extends']],
        ]],
        [0, 'Muchos saberes locales ya practican formas de manejo sostenible del territorio.', [], []],
        [5, '¿La naturaleza vale por sí misma o solo por lo que nos da?', ['questions'], [
          [1, 'Algunos países ya reconocen derechos a ríos y ecosistemas: la pregunta tiene consecuencias legales.', ['extends']],
        ]],
        [1, 'Los acuerdos internacionales fijan metas, pero carecen de mecanismos para hacerlas cumplir.', [], [
          [3, 'Medir emisiones por satélite podría hacer verificables las metas.', ['extends']],
        ]],
        [3, 'La eficiencia y la electrificación pueden reducir emisiones con rapidez.', [], [
          [5, 'La pregunta no es solo cómo producir mejor, sino cuánto es suficiente.', ['nuances']],
          [4, 'Por sí sola no reduce emisiones: sin límites al consumo total, la eficiencia termina en más consumo.', ['contradicts']],
        ]],
        [3, 'La captura de carbono a gran escala todavía no es técnicamente viable.', ['risk'], []],
      ],
      edges: [
        [2, 0, 'Uno agrega y promedia; el otro pregunta quién gana y quién pierde.', 'Indicadores que distinguen grupos, no solo totales.'],
        [2, 3, 'Ambos confían en la eficiencia; ninguno pregunta por el límite del consumo.', 'Un punto ciego compartido: la suficiencia.'],
        [4, 0, 'Uno protege ecosistemas; el otro, a quienes viven en ellos.', 'Conservación biocultural: las comunidades como parte del ecosistema.'],
        [4, 1, 'Los ciclos ecológicos no respetan fronteras ni periodos de gobierno.', 'Gobernanza por cuencas y biorregiones.'],
        [5, 1, 'Lo justo no siempre es legal; lo legal no siempre es legítimo.', 'La justicia intergeneracional como principio constitucional.'],
      ],
      synthesis:
        'Releída desde otras ventanas, la conclusión más optimista del marco económico (las renovables ya son más baratas) cambia de peso: el marco ecológico la matiza (efecto rebote) y el sociocultural la cuestiona (¿quién paga la minería de la transición?). Lo mismo ocurre con la eficiencia tecnológica, que el marco ecológico contradice si no hay límites al consumo. Quedan hallazgos que ningún otro marco ha releído —la captura de carbono, los saberes locales, la biodiversidad que el mercado no registra—: ahí está el punto ciego de este análisis.',
    },
    en: {
      name: 'Sustainability',
      description:
        'A concept almost everyone uses and no one sees whole: how do we sustain life, human and non-human, over time? Each frame looks at it through a different window.',
      frames: [
        ['Sociocultural', 'Identity, distributive justice, local knowledge and community cohesion.', 'Is it fair to every community?'],
        ['Political-legal', 'Rules, governance, sovereignty and international negotiation.', 'Who decides, and with what legitimacy?'],
        ['Economic', 'Capital flows, costs, efficiency, jobs and markets.', 'Is it viable in the long run?'],
        ['Technological', 'Innovation, energy efficiency and scalable solutions.', 'Can technology solve what technology caused?'],
        ['Ecological', 'Biogeochemical cycles, biodiversity and planetary boundaries.', 'Does it respect the planet’s limits?'],
        ['Philosophical', 'Ethical foundations, the value of nature and duties to the future.', 'What do we owe future generations and other species?'],
      ],
      findings: [
        [2, 'Renewable energy already costs less than fossil fuels in much of the world.', ['key'], [
          [4, 'Cheaper is not enough: if total consumption keeps growing, the gain is lost (rebound effect).', ['nuances']],
          [0, 'Cheaper for whom? The lithium and copper mining the transition requires also displaces communities.', ['questions']],
        ]],
        [2, 'Without a carbon price, polluting is still cheaper than not polluting.', [], [
          [1, 'Carbon taxes exist, but their price is usually too low to change behaviour.', ['confirms']],
        ]],
        [4, 'Several planetary boundaries (climate, biodiversity, the nitrogen cycle) have already been crossed.', ['risk'], [
          [2, 'Boundaries do not appear in national accounts; they should be treated as constraints, not costs.', ['extends']],
        ]],
        [4, 'Biodiversity sustains services no market records: pollination, clean water, fertile soil.', [], []],
        [0, 'Environmental harm falls mostly on poor and Indigenous communities.', ['key'], [
          [1, 'The right to prior consultation exists, but it is applied rarely and late.', ['confirms']],
          [2, 'Aggregate indicators such as GDP do not record who bears the costs.', ['extends']],
        ]],
        [0, 'Many local knowledge systems already practise sustainable land management.', [], []],
        [5, 'Does nature have value in itself, or only for what it gives us?', ['questions'], [
          [1, 'Some countries already grant rights to rivers and ecosystems: the question has legal consequences.', ['extends']],
        ]],
        [1, 'International agreements set targets but lack mechanisms to enforce them.', [], [
          [3, 'Satellite measurement of emissions could make targets verifiable.', ['extends']],
        ]],
        [3, 'Efficiency and electrification can cut emissions quickly.', [], [
          [5, 'The question is not only how to produce better, but how much is enough.', ['nuances']],
          [4, 'On its own it does not cut emissions: without limits on total consumption, efficiency ends in more consumption.', ['contradicts']],
        ]],
        [3, 'Carbon capture at scale is not yet technically viable.', ['risk'], []],
      ],
      edges: [
        [2, 0, 'One aggregates and averages; the other asks who wins and who loses.', 'Indicators that distinguish groups, not just totals.'],
        [2, 3, 'Both trust efficiency; neither asks about the limit to consumption.', 'A shared blind spot: sufficiency.'],
        [4, 0, 'One protects ecosystems; the other, the people who live in them.', 'Biocultural conservation: communities as part of the ecosystem.'],
        [4, 1, 'Ecological cycles ignore borders and terms of office.', 'Governance by watersheds and bioregions.'],
        [5, 1, 'What is just is not always legal; what is legal is not always legitimate.', 'Intergenerational justice as a constitutional principle.'],
      ],
      synthesis:
        'Re-read through other windows, the economic frame’s most optimistic finding (renewables are already cheaper) changes weight: the ecological frame nuances it (rebound effect) and the sociocultural frame questions it (who pays for the transition’s mining?). The same happens with technological efficiency, which the ecological frame contradicts unless consumption is capped. Some findings have not been re-read by any other frame yet (carbon capture, local knowledge, the biodiversity markets do not record): that is this analysis’s blind spot.',
    },
  },

  ai: {
    solid: 'tetrahedron',
    principal: 0,
    es: {
      name: 'Inteligencia artificial en la educación',
      description:
        'Herramientas generativas que escriben, resuelven y explican. ¿Transforman el aprendizaje, lo sustituyen o lo empobrecen? La respuesta depende de la ventana desde la que se mire.',
      frames: [
        ['Pedagógico', 'Cómo se aprende: procesos, retroalimentación, evaluación, el papel docente.', '¿Ayuda a aprender o solo a producir respuestas?'],
        ['Técnico-computacional', 'Qué hacen los modelos: capacidades, límites, datos, costos y errores.', '¿Qué puede hacer realmente el sistema y con qué fiabilidad?'],
        ['Ético-político', 'Privacidad, equidad de acceso, sesgos, poder y autonomía.', '¿Quién gana, quién pierde y quién decide?'],
        ['Epistemológico', 'Qué cuenta como saber: autoría, verdad, fuentes; comprender frente a reproducir.', '¿Qué significa saber algo cuando una máquina puede decirlo?'],
      ],
      findings: [
        [0, 'Muchos estudiantes usan la IA para obtener respuestas, no para entender.', ['key'], [
          [3, 'No es solo pereza: la escuela premió durante años el producto sobre el proceso.', ['nuances']],
          [1, 'Las herramientas están diseñadas para responder rápido, no para enseñar; el diseño empuja ese uso.', ['extends']],
        ]],
        [0, 'La retroalimentación inmediata puede acelerar el aprendizaje si el docente la orienta.', [], []],
        [1, 'Los modelos generan errores plausibles con la misma seguridad que los aciertos.', ['risk'], [
          [0, 'Puede volverse un recurso: pedir que los estudiantes verifiquen y corrijan a la IA.', ['extends']],
        ]],
        [2, 'Las plataformas recogen datos de menores con consentimientos poco claros.', ['risk'], [
          [1, 'Hay modelos que funcionan en el propio equipo, sin enviar datos: es técnicamente evitable.', ['nuances']],
        ]],
        [3, 'Si una máquina produce el texto, ¿qué evalúa una tarea escrita?', ['questions'], [
          [0, 'Evaluar procesos —borradores, defensa oral, diarios de aprendizaje— y no solo productos.', ['extends']],
        ]],
      ],
      edges: [
        [0, 1, 'Lo técnicamente posible no siempre es pedagógicamente deseable.', 'Diseño centrado en el aprendizaje: la IA como andamiaje que se retira.'],
        [0, 3, 'Uno mira cómo se aprende; el otro, qué cuenta como saber.', 'Aprender a evaluar fuentes se vuelve contenido, no solo método.'],
        [2, 3, 'Delegar el juicio en sistemas opacos erosiona la autoridad epistémica de las comunidades.', 'Alfabetización crítica en IA: preguntar de dónde viene una respuesta y a quién sirve.'],
      ],
      synthesis:
        'Con solo cuatro marcos el análisis ya se mueve: el uso de la IA para obtener respuestas, que desde lo pedagógico parecía un problema de los estudiantes, se relee desde lo epistemológico como herencia de una escuela que premia productos, y desde lo técnico como efecto del diseño de las herramientas. Falta releer la promesa de la retroalimentación inmediata desde las otras ventanas. Y faltan ventanas: la de estudiantes y familias, la laboral docente, la ambiental. Pasar a un cubo o a un octaedro invita a nombrarlas.',
    },
    en: {
      name: 'Artificial intelligence in education',
      description:
        'Generative tools that write, solve and explain. Do they transform learning, replace it or impoverish it? The answer depends on the window you look through.',
      frames: [
        ['Pedagogical', 'How people learn: processes, feedback, assessment, the teacher’s role.', 'Does it help people learn, or only produce answers?'],
        ['Technical-computational', 'What models do: capabilities, limits, data, costs and errors.', 'What can the system actually do, and how reliably?'],
        ['Ethical-political', 'Privacy, equity of access, bias, power and autonomy.', 'Who wins, who loses, and who decides?'],
        ['Epistemological', 'What counts as knowledge: authorship, truth, sources; understanding versus reproducing.', 'What does it mean to know something when a machine can say it?'],
      ],
      findings: [
        [0, 'Many students use AI to get answers, not to understand.', ['key'], [
          [3, 'It is not just laziness: for years school rewarded the product over the process.', ['nuances']],
          [1, 'The tools are designed to answer fast, not to teach; the design pushes that use.', ['extends']],
        ]],
        [0, 'Immediate feedback can speed up learning if the teacher guides it.', [], []],
        [1, 'Models produce plausible errors with the same confidence as correct answers.', ['risk'], [
          [0, 'This can become a resource: ask students to check and correct the AI.', ['extends']],
        ]],
        [2, 'Platforms collect children’s data with unclear consent.', ['risk'], [
          [1, 'Some models run on the device itself without sending data: it is technically avoidable.', ['nuances']],
        ]],
        [3, 'If a machine writes the text, what does a written assignment assess?', ['questions'], [
          [0, 'Assess processes (drafts, oral defence, learning journals), not only products.', ['extends']],
        ]],
      ],
      edges: [
        [0, 1, 'What is technically possible is not always pedagogically desirable.', 'Learning-centred design: AI as scaffolding that is withdrawn.'],
        [0, 3, 'One looks at how people learn; the other, at what counts as knowledge.', 'Learning to assess sources becomes content, not just method.'],
        [2, 3, 'Delegating judgement to opaque systems erodes communities’ epistemic authority.', 'Critical AI literacy: asking where an answer comes from and whom it serves.'],
      ],
      synthesis:
        'With only four frames the analysis already moves: students using AI to get answers, which looked like a student problem from the pedagogical frame, is re-read by the epistemological frame as the legacy of schools that reward products, and by the technical frame as an effect of tool design. The promise of immediate feedback has yet to be re-read through the other windows. And windows are missing: students and families, teachers’ working conditions, the environment. Moving to a cube or an octahedron invites naming them.',
    },
  },
};

export const EXAMPLE_IDS = Object.keys(CONTENT);

/** Builds a fresh state for an example. Ids are stable across languages. */
export function buildExample(id, lang) {
  const ex = CONTENT[id];
  const text = ex[lang] || ex.es;
  const state = createState(ex.solid);
  state.object = { name: text.name, description: text.description };
  state.frames = text.frames.map(([name, focus, question], i) => ({ id: `${id}-${i}`, name, focus, question, color: i }));
  const perFrame = new Map();
  state.findings = text.findings.map(([frame, findingText, tags, rereads], n) => {
    const k = perFrame.get(frame) || 0;
    perFrame.set(frame, k + 1);
    return {
      id: `${id}-f${n}`,
      frame: state.frames[frame].id,
      text: findingText,
      tags,
      pos: placeFinding(ex.solid, frame, k),
      rereads: rereads.map(([by, rereadText, rereadTags], r) => ({
        id: `${id}-f${n}-r${r}`, frame: state.frames[by].id, text: rereadText, tags: rereadTags,
      })),
    };
  });
  for (const [a, b, tension, emerges] of text.edges) {
    state.edges[pairKey(state.frames[a].id, state.frames[b].id)] = { tension, emerges };
  }
  state.principal = ex.principal === null ? null : state.frames[ex.principal].id;
  state.synthesis = text.synthesis;
  state.meta = { example: id, pristine: true };
  return state;
}
