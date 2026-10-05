<p align="right"><b>Español</b> · <a href="README.en.md">English</a></p>

# Metacognition

**Poliedro de observación.** Una herramienta interactiva de metacognición: cada cara de un poliedro es un marco de observación, una ventana que solo deja ver una parte del objeto de estudio. Al girar el objeto, los hallazgos de un marco pasan frente a la ventana de otro, que tiene que releerlos.

**[→ Abrir la herramienta](https://pahernandezceh.github.io/metacognition/)**

[![CI](https://github.com/pahernandezceh/metacognition/actions/workflows/ci.yml/badge.svg)](https://github.com/pahernandezceh/metacognition/actions/workflows/ci.yml)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-1f1b17.svg)](LICENSE)
[![Contenido: CC BY 4.0](https://img.shields.io/badge/contenido-CC%20BY%204.0-c84b2f.svg)](LICENSE-CONTENT)

![El objeto de estudio «Sustentabilidad» visto por la ventana del marco económico: el objeto se giró para que un hallazgo del marco ecológico quede frente a esa ventana, y en el panel se escribe su relectura desde lo económico](docs/screenshot-es.png)

## La idea

Ningún objeto de estudio se ve completo desde un solo lugar. Cada disciplina, teoría, interés o historia es un **marco de observación**: una ventana que muestra una parte del objeto y deja el resto fuera de vista. El problema no es tener un marco (siempre se tiene uno), sino olvidar que se está mirando a través de él.

*Metacognition* convierte esa intuición en un objeto que se puede manipular:

1. El objeto de estudio es una esfera dentro de un poliedro. **Cada cara es un marco**: una ventana que solo muestra la parte del objeto que tiene detrás.
2. Lo que se encuentra por una ventana se **anota sobre el objeto**, en esa zona, con el color del marco.
3. El objeto (o el poliedro) **gira**. Los hallazgos de un marco quedan entonces frente a la ventana de otro, y ese otro marco tiene que **releerlos**: confirmarlos, matizarlos, contradecirlos o ampliarlos. La relectura se anota sobre el mismo hallazgo, en el color de quien relee.
4. Las **aristas** son las intersecciones entre dos marcos vecinos; ahí se anota sobre los propios marcos: dónde chocan sus supuestos y qué aparece cuando se cruzan.

La herramienta obliga a reevaluar un análisis y sus conclusiones desde otro marco. Eso es metacognición: pensar sobre cómo pensamos, y revisar lo que creemos saber con una mirada distinta de la propia.

## Cómo leer el poliedro

| Elemento | Representa |
|---|---|
| **Esfera** | El objeto de estudio. Puede girar por su cuenta. |
| **Cara** | Un marco de observación: una ventana que solo muestra la parte del objeto que tiene detrás. |
| **Punto sobre la esfera** | Un hallazgo, anotado con el color y el número del marco que lo encontró (p. ej. `3.1`: primer hallazgo del marco 3). |
| **Relectura** | Lo que otro marco ve en ese hallazgo cuando el objeto gira hacia su ventana, con símbolos opcionales: ✓ confirma, ≈ matiza, ✗ contradice, + amplía, ? cuestiona, ! clave, ⚠ alerta. |
| **Arista** | La intersección de dos marcos vecinos: notas sobre los propios marcos. |
| **Sombra** | Al mirar por una ventana, la parte del objeto que queda fuera de ella. |
| **Caras opuestas** | Marcos que miran lados contrarios del objeto. |

La geometría no es decorativa. En un poliedro regular todas las caras están a la misma distancia del centro, así que cada punto del objeto se ve por la ventana cuya normal está más cerca de él: las ventanas se reparten el objeto en partes iguales y **ninguna lo ve entero**. El objeto y el poliedro tienen cada uno su propia rotación (un cuaternión). *Releer desde…* calcula el giro más corto que lleva un hallazgo al centro de la ventana elegida y anima la cámara hasta mirar por ella.

## Qué se puede hacer

- Elegir entre los cinco sólidos platónicos: **4, 6, 8, 12 o 20 marcos** (tetraedro, cubo, octaedro, dodecaedro, icosaedro).
- Nombrar cada marco, describir su **enfoque** y su **pregunta clave**.
- Mirar **a través de una ventana**: la cámara se coloca frente a la cara, las demás se esmerilan y el resto del objeto queda en sombra.
- Anotar **hallazgos** por cada ventana; quedan fijos sobre el objeto.
- **Girar** la vista, el objeto o el poliedro con el ratón o el dedo, o devolverlos a su posición inicial.
- **Releer** un hallazgo desde otra ventana (el objeto gira solo hasta ponerlo enfrente) o desde la ventana que ya lo tiene delante. Las relecturas se despliegan y se contraen bajo cada hallazgo.
- Anotar las **intersecciones** entre marcos en cada arista.
- Ver en la **síntesis** los cruces de mirada (quién ha releído a quién), los hallazgos que **nadie ha releído** (el punto ciego del análisis), las señales (cuántos ✓, ≈, ✗…), las #etiquetas y las preguntas clave reunidas.
- Marcar, si se quiere, un **marco principal** (el propio) y ver con qué marcos aún no se han cruzado miradas.
- **Exportar** un informe en Markdown, imprimirlo o guardarlo como PDF, descargar una imagen PNG o los datos en JSON.
- **Compartir un enlace** que contiene toda la configuración, incluida la orientación del objeto.
- Usar la interfaz en **español o inglés**, en computadora, tableta o teléfono.

Incluye dos ejemplos completos: *Sustentabilidad* (cubo, seis marcos) e *Inteligencia artificial en la educación* (tetraedro, cuatro marcos).

## Usos

### En el aula

Un taller de 60 a 90 minutos funciona bien así:

1. El grupo acuerda un objeto de estudio y un poliedro (el tetraedro o el cubo son buenos para empezar).
2. Cada equipo asume un marco y anota lo que encuentra por su ventana.
3. Se gira el objeto: cada equipo relee los hallazgos que quedaron frente a su ventana y marca si los confirma, los matiza o los contradice.
4. Los equipos vecinos discuten su arista: ¿dónde chocan sus marcos? ¿qué aparece en la intersección?
5. En plenaria se revisan los hallazgos que nadie releyó y los contradichos.
6. Cada persona marca su marco principal y escribe una síntesis; se exporta el informe como producto del taller.

Preguntas para la discusión: *¿Qué conclusión cambió más al releerla desde otra ventana? ¿Qué marco fue más difícil de habitar? ¿Qué hallazgos siguen sin releer y por qué?*

### En investigación

Para someter las conclusiones de un enfoque a la lectura de otros antes de darlas por buenas, preparar la conversación de un equipo interdisciplinario o documentar cómo cambia un hallazgo según desde dónde se lea. El archivo JSON exportado es legible y se puede versionar junto con el resto del proyecto.

### Para la reflexión personal

Marcar el propio marco principal convierte el poliedro en un espejo: muestra qué hallazgos propios nadie ha revisado y qué miradas ajenas todavía no se han leído desde la propia.

## Resonancias teóricas

La herramienta dialoga con varias tradiciones que, por caminos distintos, llegan a intuiciones cercanas:

- **Metacognición.** El término, acuñado por John Flavell, nombra el conocimiento y la regulación de los propios procesos cognitivos: saber cómo se sabe.
- **Pensamiento complejo.** Edgar Morin propone un *conocimiento del conocimiento* que reintroduce al sujeto que conoce en aquello que conoce, y desconfía de las disciplinas que se vuelven ciegas a lo que queda fuera de su recorte.
- **Observación de segundo orden.** Para Heinz von Foerster y Niklas Luhmann, toda observación opera con una distinción que no puede ver mientras la usa: su punto ciego. Otra observación puede señalarlo, a costa de tener el suyo. Releer un hallazgo desde otra ventana es observar una observación.
- **Conocimientos situados.** Donna Haraway sostiene que toda mirada es parcial y situada, y que la objetividad no es una vista desde ninguna parte, sino la conexión responsable entre perspectivas parciales.

### Referencias

- Flavell, J. H. (1979). Metacognition and cognitive monitoring: A new area of cognitive–developmental inquiry. *American Psychologist, 34*(10), 906–911. https://doi.org/10.1037/0003-066X.34.10.906
- Haraway, D. (1988). Situated knowledges: The science question in feminism and the privilege of partial perspective. *Feminist Studies, 14*(3), 575–599. https://doi.org/10.2307/3178066
- Luhmann, N. (1993). Deconstruction as second-order observing. *New Literary History, 24*(4), 763–782. https://doi.org/10.2307/469391
- Morin, E. (1988). *El método III. El conocimiento del conocimiento*. Cátedra. (Obra original publicada en 1986).
- von Foerster, H. (2003). *Understanding understanding: Essays on cybernetics and cognition*. Springer. https://doi.org/10.1007/b97451

## Próximas ideas

- **Vértices como pistas.** En cada vértice se tocan tres o más marcos; podrían servir para mirar un hallazgo desde varias ventanas a la vez y sugerir qué intersecciones analizar.
- **Trabajo colaborativo en tiempo real**, para que cada equipo de un taller escriba desde su propia ventana.

## Privacidad

Todo ocurre en el navegador. Lo que escribes se guarda automáticamente en el almacenamiento local de tu navegador y no se envía a ningún servidor. Los enlaces para compartir llevan la configuración comprimida después del signo `#` de la dirección, una parte que los navegadores no envían al servidor. Las tipografías y la biblioteca 3D están incluidas en el repositorio, así que la página no hace peticiones a terceros.

## Desarrollo

Es una página estática sin paso de compilación: HTML, CSS y módulos de JavaScript.

```bash
npm install        # solo herramientas de desarrollo
npm start          # http://localhost:8080
npm test           # pruebas de geometría, estado y análisis (node --test)
```

```
index.html            estructura de la página
css/                  estilos y tipografías
js/geometry.js        sólidos platónicos, ventanas y rotaciones (puro, probado)
js/state.js           estado, validación, enlaces para compartir, guardado local
js/analysis.js        cruces de mirada, hallazgos sin releer, señales (puro, probado)
js/palette.js         colores de los marcos
js/scene.js           vista 3D con three.js: ventanas, objeto giratorio y hallazgos
js/ui.js              panel lateral (objeto, marcos y hallazgos, intersecciones, síntesis)
js/report.js          informe Markdown, versión imprimible e imagen PNG
js/examples.js        ejemplos en español e inglés
js/i18n.js            textos de la interfaz
js/main.js            punto de entrada
vendor/               three.js empaquetado (npm run build:vendor)
tests/                pruebas unitarias
```

`vendor/three.bundle.js` contiene solo las partes de [three.js](https://threejs.org) que usa la vista y se regenera con `npm run build:vendor`. Para inspeccionar el estado desde la consola, abre la página con `?debug`.

### Publicar en GitHub Pages

El flujo `.github/workflows/pages.yml` publica el sitio en cada *push* a `main`. Solo hay que activarlo una vez en **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Licencia

- **Código:** [MIT](LICENSE).
- **Textos, ejemplos, documentación y el modelo conceptual:** [CC BY 4.0](LICENSE-CONTENT). Se pueden reutilizar y adaptar citando la fuente.
- **Terceros:** three.js (MIT); Lato, DM Serif Display y DM Mono ([SIL Open Font License 1.1](assets/fonts/OFL.txt)).

## Cómo citar

Si usas la herramienta o sus ideas en un trabajo académico, puedes citarla así (los datos también están en [`CITATION.cff`](CITATION.cff)):

> pahernandezceh. (2026). *Metacognition: Poliedro de observación* (Versión 1.0.0) [Software]. https://github.com/pahernandezceh/metacognition
