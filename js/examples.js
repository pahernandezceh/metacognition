// Worked examples, in both interface languages.

import { createState, pairKey } from './state.js';

const CONTENT = {
  sustainability: {
    solid: 'octahedron',
    distance: 1.6,
    principal: null,
    es: {
      name: 'Sustentabilidad',
      description:
        'Un concepto que casi todos usan y nadie ve completo: ¿cómo sostener la vida, humana y no humana, a lo largo del tiempo? Cada disciplina responde algo distinto.',
      frames: [
        ['Económico', 'Flujos de capital, eficiencia, costos, crecimiento, mercados.', 'Valores no monetizables, resiliencia ecológica intrínseca, cohesión social.', '¿Es viable económicamente a largo plazo?'],
        ['Ecológico', 'Ciclos biogeoquímicos, biodiversidad, capacidad de carga, entropía.', 'Equidad intergeneracional, motivaciones humanas, estructuras de poder.', '¿Respeta los límites planetarios?'],
        ['Sociocultural', 'Identidad, justicia distributiva, saberes locales, cohesión comunitaria.', 'Procesos ecológicos no humanos, variables macroeconómicas globales.', '¿Es justo y equitativo para todas las comunidades?'],
        ['Filosófico', 'Fundamentos éticos, ontología de la naturaleza, valores intrínsecos.', 'Los datos empíricos de forma directa; depende de mediaciones.', '¿Qué les debemos a las generaciones futuras y a otras especies?'],
        ['Político-jurídico', 'Normativas, gobernanza, soberanía, negociaciones internacionales.', 'Causas ecológicas profundas, dinámicas culturales locales.', '¿Quién decide y con qué legitimidad?'],
        ['Tecnológico', 'Innovación, eficiencia energética, geoingeniería, soluciones escalables.', 'Los límites de la sustitución técnica, las consecuencias no previstas.', '¿Puede la tecnología resolver lo que la tecnología ha causado?'],
      ],
      dialogues: [
        [0, 2, 'El crecimiento agregado puede ocultar la desigualdad: el PIB sube mientras comunidades pierden su territorio.', 'Economía del bienestar y economía social y solidaria: medir lo que importa a las comunidades.'],
        [0, 5, 'Efecto rebote (paradoja de Jevons): la eficiencia abarata y aumenta el consumo total.', 'Innovación orientada a misiones, con límites absolutos de consumo y no solo relativos.'],
        [1, 2, 'Conservación excluyente: áreas protegidas que desplazan a quienes las habitaban.', 'Conservación biocultural: los saberes locales como parte del ecosistema.'],
        [1, 4, 'Los ciclos ecológicos no respetan fronteras ni periodos de gobierno.', 'Derechos de la naturaleza y gobernanza por cuencas y biorregiones.'],
        [3, 4, 'Lo justo no siempre es legal; lo legal no siempre es legítimo.', 'La justicia intergeneracional como principio constitucional.'],
      ],
      synthesis:
        'Ningún marco sostiene por sí solo la sustentabilidad. Lo económico sin lo ecológico confunde crecimiento con bienestar; lo ecológico sin lo sociocultural puede volverse excluyente. Los marcos opuestos (económico y ecológico, sociocultural y filosófico, político-jurídico y tecnológico) ven justo lo que el otro no ve: ahí está el diálogo más difícil y más necesario. Aun con seis marcos quedan pequeños puntos ciegos colectivos en el centro de cada cara: preguntas que caen entre tres disciplinas sin que ninguna las asuma.',
    },
    en: {
      name: 'Sustainability',
      description:
        'A concept almost everyone uses and no one sees whole: how do we sustain life, human and non-human, over time? Each discipline gives a different answer.',
      frames: [
        ['Economic', 'Capital flows, efficiency, costs, growth, markets.', 'Non-monetisable values, intrinsic ecological resilience, social cohesion.', 'Is it economically viable in the long run?'],
        ['Ecological', 'Biogeochemical cycles, biodiversity, carrying capacity, entropy.', 'Intergenerational equity, human motivations, power structures.', 'Does it respect planetary boundaries?'],
        ['Sociocultural', 'Identity, distributive justice, local knowledge, community cohesion.', 'Non-human ecological processes, global macroeconomic variables.', 'Is it fair and equitable for every community?'],
        ['Philosophical', 'Ethical foundations, the ontology of nature, intrinsic values.', 'Empirical data directly; it relies on mediations.', 'What do we owe future generations and other species?'],
        ['Political-legal', 'Regulation, governance, sovereignty, international negotiations.', 'Deep ecological causes, local cultural dynamics.', 'Who decides, and with what legitimacy?'],
        ['Technological', 'Innovation, energy efficiency, geoengineering, scalable solutions.', 'The limits of technical substitution, unintended consequences.', 'Can technology solve what technology has caused?'],
      ],
      dialogues: [
        [0, 2, 'Aggregate growth can hide inequality: GDP rises while communities lose their land.', 'Wellbeing and social-solidarity economics: measuring what matters to communities.'],
        [0, 5, 'Rebound effect (Jevons paradox): efficiency lowers costs and raises total consumption.', 'Mission-oriented innovation bound by absolute, not just relative, limits on consumption.'],
        [1, 2, 'Exclusionary conservation: protected areas that displace the people who lived there.', 'Biocultural conservation: local knowledge as part of the ecosystem.'],
        [1, 4, 'Ecological cycles ignore borders and terms of office.', 'Rights of nature, and governance by watersheds and bioregions.'],
        [3, 4, 'What is just is not always legal; what is legal is not always legitimate.', 'Intergenerational justice as a constitutional principle.'],
      ],
      synthesis:
        'No single frame can hold sustainability on its own. The economic without the ecological mistakes growth for wellbeing; the ecological without the sociocultural can become exclusionary. Opposite frames (economic and ecological, sociocultural and philosophical, political-legal and technological) see exactly what the other misses: that is where dialogue is hardest and most needed. Even with six frames, small collective blind spots remain at the centre of each face: questions that fall between three disciplines and that none of them takes on.',
    },
  },

  ai: {
    solid: 'tetrahedron',
    distance: 2,
    principal: 0,
    es: {
      name: 'Inteligencia artificial en la educación',
      description:
        'Herramientas generativas que escriben, resuelven y explican. ¿Transforman el aprendizaje, lo sustituyen o lo empobrecen? La respuesta depende de desde dónde se mire.',
      frames: [
        ['Pedagógico', 'Procesos de aprendizaje, retroalimentación, evaluación formativa, el papel docente.', 'Infraestructura técnica, modelos de negocio de las plataformas, sesgos en los datos de entrenamiento.', '¿Ayuda a aprender o solo a producir respuestas?'],
        ['Técnico-computacional', 'Capacidades y límites de los modelos, datos de entrenamiento, costos de cómputo, tasas de error.', 'El sentido educativo, el contexto del aula, los efectos en la motivación y la autonomía.', '¿Qué puede hacer realmente el sistema y con qué fiabilidad?'],
        ['Ético-político', 'Privacidad, equidad de acceso, sesgos, concentración de poder, autonomía.', 'La viabilidad técnica de las salvaguardas; las prácticas cotidianas del aula.', '¿Quién gana, quién pierde y quién decide?'],
        ['Epistemológico', 'Qué cuenta como saber; autoría, verdad y fuentes; la diferencia entre comprender y reproducir.', 'Las condiciones materiales y laborales; los datos empíricos de uso.', '¿Qué significa saber algo cuando una máquina puede decirlo?'],
      ],
      dialogues: [
        [0, 1, 'Lo técnicamente posible no siempre es pedagógicamente deseable.', 'Diseño centrado en el aprendizaje: la IA como andamiaje que se retira, no como atajo.'],
        [0, 3, 'Evaluar productos (ensayos, tareas) ya no garantiza evaluar comprensión.', 'Evaluar procesos: diálogo, oralidad y metacognición del propio aprendizaje.'],
        [2, 3, 'Delegar el juicio en sistemas opacos erosiona la autoridad epistémica de las comunidades.', 'Alfabetización crítica en IA: preguntar de dónde viene una respuesta y a quién sirve.'],
      ],
      synthesis:
        'Con solo cuatro marcos queda un punto ciego colectivo considerable. Faltan, por ejemplo, la mirada de estudiantes y familias, la de las condiciones laborales docentes y la ambiental (energía y agua de los centros de datos). Pasar a un octaedro o a un cubo invita a nombrarlas. Desde lo pedagógico, el diálogo más urgente es con lo técnico: entender qué hace realmente la herramienta antes de decidir su lugar en el aula.',
    },
    en: {
      name: 'Artificial intelligence in education',
      description:
        'Generative tools that write, solve and explain. Do they transform learning, replace it or impoverish it? The answer depends on where you look from.',
      frames: [
        ['Pedagogical', 'Learning processes, feedback, formative assessment, the teacher’s role.', 'Technical infrastructure, platform business models, biases in training data.', 'Does it help people learn, or only produce answers?'],
        ['Technical-computational', 'Model capabilities and limits, training data, compute costs, error rates.', 'Educational meaning, classroom context, effects on motivation and autonomy.', 'What can the system actually do, and how reliably?'],
        ['Ethical-political', 'Privacy, equity of access, bias, concentration of power, autonomy.', 'The technical feasibility of safeguards; everyday classroom practice.', 'Who wins, who loses, and who decides?'],
        ['Epistemological', 'What counts as knowledge; authorship, truth and sources; the difference between understanding and reproducing.', 'Material and labour conditions; empirical usage data.', 'What does it mean to know something when a machine can say it?'],
      ],
      dialogues: [
        [0, 1, 'What is technically possible is not always pedagogically desirable.', 'Learning-centred design: AI as scaffolding that is withdrawn, not as a shortcut.'],
        [0, 3, 'Grading products (essays, homework) no longer guarantees assessing understanding.', 'Assessing processes: dialogue, oral work and metacognition about one’s own learning.'],
        [2, 3, 'Delegating judgement to opaque systems erodes communities’ epistemic authority.', 'Critical AI literacy: asking where an answer comes from and whom it serves.'],
      ],
      synthesis:
        'With only four frames, a sizeable collective blind spot remains. Missing, for instance, are the views of students and families, of teachers’ working conditions, and the environmental one (the energy and water used by data centres). Moving to an octahedron or a cube invites naming them. From the pedagogical frame, the most urgent dialogue is with the technical one: understanding what the tool actually does before deciding its place in the classroom.',
    },
  },
};

export const EXAMPLE_IDS = Object.keys(CONTENT);

/** Builds a fresh state for an example. Frame ids are stable across languages. */
export function buildExample(id, lang) {
  const ex = CONTENT[id];
  const text = ex[lang] || ex.es;
  const state = createState(ex.solid);
  state.distance = ex.distance;
  state.object = { name: text.name, description: text.description };
  state.frames = text.frames.map(([name, sees, blind, question], i) => ({
    id: `${id}-${i}`, name, sees, blind, question,
  }));
  for (const [a, b, tension, emerges] of text.dialogues) {
    state.dialogues[pairKey(state.frames[a].id, state.frames[b].id)] = { tension, emerges };
  }
  state.principal = ex.principal === null ? null : state.frames[ex.principal].id;
  state.synthesis = text.synthesis;
  state.meta = { example: id, pristine: true };
  return state;
}
