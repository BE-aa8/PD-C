// Presentation slides shown under the video. Images are rendered from the deck by tools/build_slides.py.
// Each title is used as the slide's caption and alt text.
export const DECK = {
  pdf: 'slides/closing-the-loop-slides.pdf',
  pptx: 'slides/closing-the-loop-slides.pptx',
  slides: [
    'Title: Closing the Loop, an artificial-pancreas control simulator',
    'The project in three numbers: 26 critique decisions, 33 of 33 shared tests passed, 40 prompts logged',
    'The engineering problem: blood glucose is a process with a late sensor',
    'Six lessons: four about control, two about AI',
    'Lesson 1: feedback alone reacts too late (peak 163.4, nadir 49.4 mg/dL)',
    'Recap: lesson 1 done, lesson 2 next',
    'Lesson 2: the pump only pushes one way (saturation and anti-windup, 2× meal)',
    'Recap: lessons 1–2 done, lesson 3 next',
    'Lesson 3: feedforward acts before the error (feedback vs. feedforward glucose)',
    'Recap: lessons 1–3 done, lesson 4 next',
    'Lesson 4: delay sets the limit (phase margin at τc = 20 min)',
    'Recap: lessons 1–4 done, lesson 5 next',
    'Lesson 5: one model planned, another critiqued',
    'Recap: lessons 1–5 done, lesson 6 next',
    'Lesson 6: two builds, same tests (Claude Opus 5.5 vs. Gemini Flash)',
    'Recap: all six lessons',
    'Conclusions: what I learned',
    'Try it yourself: be-aa8.github.io/PD-C',
  ].map((title, i) => ({ src: `slides/slide-${String(i + 1).padStart(2, '0')}.webp`, title })),
};
