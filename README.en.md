<p align="right"><a href="README.md">Español</a> · <b>English</b></p>

# Metacognition

**Observation polyhedron.** An interactive metacognition tool: each face of a polyhedron is a frame of observation, a window that only shows part of the object of study. Turn the object and one frame’s findings pass in front of another frame’s window, which has to re-read them.

**[→ Open the tool](https://pahernandezceh.github.io/metacognition/?lang=en)**

[![CI](https://github.com/pahernandezceh/metacognition/actions/workflows/ci.yml/badge.svg)](https://github.com/pahernandezceh/metacognition/actions/workflows/ci.yml)
[![Code: MIT](https://img.shields.io/badge/code-MIT-1f1b17.svg)](LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-c84b2f.svg)](LICENSE-CONTENT)

![The object of study “Sustainability” inside a cube of six frames; the object has been turned so findings sit in front of other frames’ windows, and the synthesis panel shows who has re-read whom](docs/screenshot-en.png)

## The idea

No object of study can be seen whole from a single place. Every discipline, theory, interest or history is a **frame of observation**: a window that shows part of the object and leaves the rest out of view. The problem is not having a frame (one always does) but forgetting that one is looking through it.

*Metacognition* turns that intuition into something you can handle:

1. The object of study is a sphere inside a polyhedron. **Each face is a frame**: a window that only shows the part of the object behind it.
2. What you find through a window is **pinned to the object**, in that area, in the frame’s colour.
3. The object (or the polyhedron) **turns**. One frame’s findings then sit in front of another frame’s window, and that frame has to **re-read** them: confirm, nuance, contradict or extend them. The re-reading is noted on the same finding, in the re-reader’s colour.
4. **Edges** are the intersections between two neighbouring frames; notes there are about the frames themselves: where their assumptions clash and what appears where they cross.

The tool makes you re-examine an analysis and its conclusions from another frame. That is metacognition: thinking about how we think, and revisiting what we believe we know through a gaze other than our own.

## How to read the polyhedron

| Element | Stands for |
|---|---|
| **Sphere** | The object of study. It can turn on its own. |
| **Face** | A frame of observation: a window that only shows the part of the object behind it. |
| **Dot on the sphere** | A finding, with the colour and number of the frame that found it (e.g. `3.1`: first finding of frame 3). |
| **Re-reading** | What another frame sees in that finding when the object turns towards its window, with optional symbols: ✓ confirms, ≈ nuances, ✗ contradicts, + extends, ? questions, ! key, ⚠ warning. |
| **Edge** | The intersection of two neighbouring frames: notes about the frames themselves. |
| **Shadow** | When looking through one window, the part of the object outside it. |
| **Opposite faces** | Frames that look at opposite sides of the object. |

The geometry is not decorative. In a regular polyhedron every face is at the same distance from the centre, so each point of the object is seen through the window whose normal is closest to it: the windows share the object out equally and **none of them sees it whole**. The object and the polyhedron each have their own rotation (a quaternion). *Re-read from…* computes the shortest turn that brings a finding to the centre of the chosen window and animates the camera to look through it.

## What you can do

- Choose any of the five Platonic solids: **4, 6, 8, 12 or 20 frames** (tetrahedron, cube, octahedron, dodecahedron, icosahedron).
- Name each frame and describe its **focus** and **key question**.
- Look **through a window**: the camera moves in front of the face, the others frost over and the rest of the object falls into shadow.
- Note **findings** through each window; they stay pinned to the object.
- **Turn** the view, the object or the polyhedron with mouse or finger, or put them back in their starting position.
- **Re-read** a finding from another window (the object turns by itself to bring it in front) or from the window that already has it in view. Re-readings expand and collapse under each finding.
- Note the **intersections** between frames on each edge.
- See in the **synthesis** the crossed glances (who has re-read whom), the findings **no one has re-read** (the analysis’s blind spot), the signals (how many ✓, ≈, ✗…), the #tags and the key questions together.
- Optionally mark a **main frame** (your own) and see which frames you have not crossed glances with yet.
- **Export** a Markdown report, print it or save it as PDF, download a PNG image or the data as JSON.
- **Share a link** that carries the whole configuration, including the object’s orientation.
- Use the interface in **Spanish or English**, on desktop, tablet or phone.

Two complete examples are included: *Sustainability* (cube, six frames) and *Artificial intelligence in education* (tetrahedron, four frames).

## Uses

### In the classroom

A 60–90 minute workshop works well like this:

1. The group agrees on an object of study and a polyhedron (the tetrahedron or the cube are good starting points).
2. Each team takes on a frame and notes what it finds through its window.
3. Turn the object: each team re-reads the findings now in front of its window and marks whether it confirms, nuances or contradicts them.
4. Neighbouring teams discuss their shared edge: where do their frames clash? What appears at the intersection?
5. In plenary, review the findings nobody re-read and the contradicted ones.
6. Each person marks their main frame and writes a synthesis; export the report as the workshop’s output.

Discussion prompts: *Which conclusion changed most when re-read through another window? Which frame was hardest to inhabit? Which findings remain unread, and why?*

### In research

To put one approach’s conclusions through other approaches’ reading before accepting them, to prepare an interdisciplinary team’s conversation, or to document how a finding changes depending on where it is read from. The exported JSON is human-readable and can be versioned alongside the rest of a project.

### For personal reflection

Marking your own main frame turns the polyhedron into a mirror: it shows which of your findings no one has reviewed, and which other gazes you have not yet read from your own.

## Theoretical resonances

The tool is in conversation with several traditions that, by different routes, reach related intuitions:

- **Metacognition.** The term, coined by John Flavell, names knowledge about and regulation of one's own cognitive processes: knowing how one knows.
- **Complex thought.** Edgar Morin proposes a *knowledge of knowledge* that brings the knowing subject back into what is known, and distrusts disciplines that become blind to whatever falls outside their cut.
- **Second-order observation.** For Heinz von Foerster and Niklas Luhmann, every observation relies on a distinction it cannot see while using it: its blind spot. Another observation can point it out, at the cost of having its own. Re-reading a finding through another window is observing an observation.
- **Situated knowledges.** Donna Haraway argues that every gaze is partial and situated, and that objectivity is not a view from nowhere but the accountable connection of partial perspectives.

### References

- Flavell, J. H. (1979). Metacognition and cognitive monitoring: A new area of cognitive–developmental inquiry. *American Psychologist, 34*(10), 906–911. https://doi.org/10.1037/0003-066X.34.10.906
- Haraway, D. (1988). Situated knowledges: The science question in feminism and the privilege of partial perspective. *Feminist Studies, 14*(3), 575–599. https://doi.org/10.2307/3178066
- Luhmann, N. (1993). Deconstruction as second-order observing. *New Literary History, 24*(4), 763–782. https://doi.org/10.2307/469391
- Morin, E. (1986). *La Méthode 3. La Connaissance de la connaissance*. Seuil.
- von Foerster, H. (2003). *Understanding understanding: Essays on cybernetics and cognition*. Springer. https://doi.org/10.1007/b97451

## Next ideas

- **Vertices as hints.** Three or more frames meet at each vertex; vertices could be used to look at a finding through several windows at once and suggest which intersections to analyse.
- **Real-time collaboration**, so each team in a workshop writes from its own window.

## Privacy

Everything happens in the browser. What you write is saved automatically in your browser's local storage and is never sent to any server. Share links carry the compressed configuration after the `#` of the address, a part browsers do not send to the server. Fonts and the 3D library ship with the repository, so the page makes no third-party requests.

## Development

A static page with no build step: HTML, CSS and JavaScript modules.

```bash
npm install        # development tools only
npm start          # http://localhost:8080
npm test           # geometry, state and analysis tests (node --test)
```

```
index.html            page structure
css/                  styles and fonts
js/geometry.js        Platonic solids, windows and rotations (pure, tested)
js/state.js           state, validation, share links, local saving
js/analysis.js        crossed glances, unread findings, signals (pure, tested)
js/palette.js         frame colours
js/scene.js           3D view with three.js: windows, turning object and findings
js/ui.js              side panel (object, frames and findings, intersections, synthesis)
js/report.js          Markdown report, printable version and PNG image
js/examples.js        examples in Spanish and English
js/i18n.js            interface strings
js/main.js            entry point
vendor/               bundled three.js (npm run build:vendor)
tests/                unit tests
```

`vendor/three.bundle.js` contains only the parts of [three.js](https://threejs.org) the view uses, and is regenerated with `npm run build:vendor`. To inspect the state from the console, open the page with `?debug`.

### Publishing on GitHub Pages

The `.github/workflows/pages.yml` workflow publishes the site on every push to `main`. It only needs to be enabled once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## License

- **Code:** [MIT](LICENSE).
- **Texts, examples, documentation and the conceptual model:** [CC BY 4.0](LICENSE-CONTENT). Reuse and adapt them with attribution.
- **Third parties:** three.js (MIT); Lato, DM Serif Display and DM Mono ([SIL Open Font License 1.1](assets/fonts/OFL.txt)).

## How to cite

If you use the tool or its ideas in academic work, you can cite it as follows (the same data is in [`CITATION.cff`](CITATION.cff)):

> pahernandezceh. (2026). *Metacognition: Observation polyhedron* (Version 1.0.0) [Computer software]. https://github.com/pahernandezceh/metacognition
