# Visual reference notes from ChatGPT (verbatim)

ChatGPT wrote these notes after Andrew showed it four screen recordings of websites he likes (Harley-Davidson, Rivian,
Nutrien, and an interactive 3D pancreas viewer). Claude cannot watch the recordings; it worked only from this text.
Andrew pasted the notes into the Claude Code session on 2026-11-19 with this preface (verbatim):

> before starting phase three, take note of these, well, notes. I gave ChatGPT 4 screen recordings of website layouts that I particularly liked. the 3d model pancreas is a dead set. I 100% NEED that on the website hehehehe. anyways:

So the notes' advice on the 3D pancreas was overridden by Andrew: the 3D pancreas is required. Claude's response (design
analysis + tab-by-tab plan) is `docs/plan-redesign-master-claude.md`.

---

# Visual Reference Analysis & Design Inspiration — Closing the Loop

You have four screen recordings showing websites and interactive experiences that I want you to study as visual and functional references for the redesign of **Closing the Loop**.

These recordings are not just general inspiration. I want you to understand the specific design decisions, interaction patterns, layouts, and presentation techniques demonstrated in them, then translate those ideas into our project.

Do not simply make our website look like one of these references. Extract the strongest ideas from each and combine them into one consistent design system.

## 1. Reference-by-reference analysis

### Reference 1 — Harley-Davidson
**Recording:** `Screen Recording 2026-11-18 at 11.48.48 AM.mov`

This recording demonstrates a dark, cinematic product website.

What stands out:

- Very dark backgrounds that let the subject matter become the visual focus.
- Large, condensed typography with short, confident statements.
- Large product imagery surrounded by substantial negative space.
- Minimal navigation that does not compete with the main content.
- Text appears in deliberate moments rather than being presented all at once.
- The imagery and typography work together to create a sense of progression as the user scrolls.
- The page feels like a carefully directed presentation rather than a traditional information website.

**What I want to borrow:**

Apply this approach to the Overview tab.

Instead of immediately presenting a conventional page heading, paragraph, and three cards, introduce the project through a cinematic opening section.

For example:
- A large title: "CLOSING THE LOOP."
- A short supporting statement explaining the connection between chemical process control and glucose regulation.
- A scientific visualization that occupies a meaningful portion of the screen.
- Small, restrained supporting information that establishes the course/project context.

The hero should feel substantial without becoming a marketing advertisement.

Use typography intentionally. A few large, meaningful statements are preferable to several paragraphs competing for attention.

**Do not borrow:**
- Motorcycle imagery or automotive styling.
- Excessively condensed typography if it hurts readability.
- Dramatic effects that make technical information difficult to understand.

### Reference 2 — Rivian
**Recording:** `Screen Recording 2026-11-18 at 11.51.15 AM.mov`

This is a particularly useful reference for the overall experience and page structure.

The recording demonstrates several distinct design patterns:

**A. Immersive opening section**

- Large full-width vehicle imagery/video.
- A clear headline positioned over or alongside the main visual.
- Very limited supporting copy.
- Simple navigation and a small number of obvious actions.
- The imagery establishes the experience before the user starts reading.

**B. Product storytelling through scrolling**

As the user moves down the page, Rivian introduces different features through individual visual sections.

Rather than displaying every specification in a large grid, it uses:
- Large photographs.
- Short headlines.
- Small supporting descriptions.
- Alternating image/text arrangements.
- Full-width visual sections.
- Occasional technical specifications and metrics.

Each section has one primary purpose.

**C. Interactive product visualization**

The vehicle configuration section is especially interesting.

The user can:
- Switch between different vehicle configurations.
- Change vehicle colors.
- See the central product visualization update.
- Explore different views and supporting imagery.
- Compare different configurations without navigating away from the experience.

The important principle is that the interface responds directly to user input and keeps the subject as the focal point.

**D. Feature galleries**

The page also uses image galleries to communicate features visually. Images are large enough to be meaningful, while controls remain relatively unobtrusive.

**What I want to borrow:**

Apply these principles throughout the seven tabs.

- Give each major section a clear visual purpose.
- Use large visual sections instead of stacking endless small cards.
- Break technical content into understandable chapters.
- Use alternating layouts where appropriate.
- Give interactive visualizations enough space to feel important.
- Make controls visually secondary to the thing being controlled.
- Use small, intentional transitions when switching between states.

For the Simulator, the equivalent of Rivian's vehicle configurator is our live process-control simulation.

The glucose response should be the main visual subject. The user should be able to adjust conditions and immediately understand how the system responds.

Do not turn the Simulator into a vehicle-style product configurator. Translate the interaction philosophy, not the literal appearance.

### Reference 3 — Nutrien
**Recording:** `Screen Recording 2026-11-18 at 11.52.07 AM.mov`

This reference is useful because it presents a technical agricultural organization through real-world imagery and a restrained visual identity.

What stands out:

- White backgrounds and a restrained green brand palette.
- Large agricultural photography showing actual environments and operations.
- Alternating image-and-text sections.
- Clear separation between the main content areas.
- Impact metrics presented in a visually prominent but uncomplicated way.
- Short headings that explain what each section is about.
- A footer that feels like a deliberate part of the website rather than an afterthought.

The page communicates technical and industrial subject matter without making the interface feel complicated.

**What I want to borrow:**

Use this reference to help balance the dark, cinematic influence of Harley-Davidson and Rivian.

Our light theme should feel intentionally designed, not like the dark theme with colors inverted.

The Nutrien recording is a good example of how a technical subject can be presented using:
- Clean backgrounds.
- Realistic imagery.
- Restrained accent colors.
- Clear content groupings.
- Strong spacing.
- Simple metrics.

For our project, this could be especially useful in:
- Theory.
- Control Design.
- References.
- AI Workflow.
- Supporting technical explanations.

Use green/sage as a restrained accent, not as a color applied to every component.

The project should still feel like chemical engineering and process control, not an agricultural company website.

### Reference 4 — Interactive Pancreas Model
**Recording:** `Screen Recording 2026-11-18 at 11.55.18 AM.mov`

This is the most important functional reference.

The recording shows an interactive 3D pancreas model inside a clean scientific visualization workspace.

The interface has several features worth studying:

**A. The subject is the interface**

- The 3D model occupies the majority of the available workspace.
- There is very little surrounding text.
- The background is clean and neutral.
- The model is visually isolated from other interface elements.
- The user immediately understands what they are supposed to explore.

**B. Compact vertical tool rail**

A vertical control rail on the left provides tools such as:

- Auto-rotate.
- Zoom in.
- Zoom out.
- Isolate.
- Cross-section.
- Wireframe.
- Reset view.

These controls are represented through compact icons and short labels.

The result is that the user has access to substantial functionality without having a large control panel covering the model.

**C. Direct manipulation**

The model can be rotated by dragging, zoomed, and explored from different angles.

There are also interactive points/hotspots on the model.

This is a much more intuitive way to explore a scientific subject than reading a long explanation and looking at a static illustration.

**D. Contextual navigation**

The interface includes a breadcrumb identifying the current anatomical location, along with an option to locate the structure in a larger 3D body context.

This establishes where the current model fits into a larger system.

**E. Progressive disclosure**

The interface does not display every possible explanation and control at once.

The user sees the model first. Additional tools and contextual information are available when needed.

**What I want to borrow:**

This should heavily influence the visual treatment of scientific and technical visualizations in Closing the Loop.

For example:

- The glucose response chart should receive the largest visual area in the Simulator.
- Supporting charts should have a clear secondary hierarchy.
- The process block diagram should be presented as an interactive visual object, not buried inside a card full of text.
- Technical illustrations should be allowed to occupy substantial space.
- Use compact toolbars where they genuinely improve interaction.
- Keep explanatory information available without making it permanently visible.
- Where possible, let users interact directly with a visualization rather than navigating through multiple controls.

The pancreas viewer is a reference for the *experience of exploring a scientific model*. It does not mean that we need to create an anatomical 3D model or add unnecessary 3D effects to our website.

If an interactive 3D visualization genuinely improves the explanation of a process, consider it. Otherwise, prioritize excellent charts, diagrams, and responsive controls.

---

## 2. How these references should influence each tab

I want you to apply the reference analysis to all seven tabs, not just the Overview.

### Tab 1 — Overview

**Primary inspiration:** Harley-Davidson + Rivian.

Create a cinematic scientific introduction.

The first screen should have:
- A prominent "Closing the Loop" title.
- A concise explanation of the project's purpose.
- A hybrid scientific hero visual combining a real model-derived glucose response visualization with an abstract scientific visual element.
- A clear indication that this is a chemical engineering/process-control project.
- A natural path into the rest of the website.

Below the hero, use a sequence of visual storytelling sections.

Avoid immediately presenting multiple generic cards. Give the page a deliberate beginning, middle, and end.

### Tab 2 — Simulator

**Primary inspiration:** Interactive pancreas model + Rivian configurator.

This tab needs the most significant improvement in usability.

I want the experience to be visualization-first.

The glucose response chart should be the main focal point. The controls should support the visualization rather than compete with it.

Consider:
- A large primary glucose chart.
- Compact KPI indicators.
- A clear system status/warning area.
- A compact toolbar for relevant chart actions.
- Collapsible control groups.
- Contextual help rather than permanently visible paragraphs.
- A clean way to compare saved simulation runs.
- Smooth but restrained transitions when the simulation changes.

The existing `?` help toggle should contain the longer explanations and instructional text. Keep the default interface visually clean.

Do not remove any existing controls, equations, metrics, charts, presets, or simulation behavior.

### Tab 3 — Theory

**Primary inspiration:** Nutrien's clean editorial layouts + Apple.

This page should feel like an interactive engineering publication.

Instead of presenting five long sections as dense text and cards:
- Give each major concept a distinct visual section.
- Make equations visually prominent.
- Pair equations with their corresponding charts or diagrams.
- Use short explanatory text near the relevant visual.
- Use progressive disclosure for additional derivations and explanations.
- Make the progression from the nonlinear model to linearization and transfer functions easy to follow.

The user should be able to understand the overall progression by scrolling through the page, even before reading every equation.

### Tab 4 — Control Design

**Primary inspiration:** Interactive scientific viewer + Rivian.

The block diagram and stability visualizations should be treated as primary content.

Consider:
- A large, clear block diagram with enough space to understand the signal flow.
- Compact tuning controls.
- Visually distinct IMC and manual tuning modes.
- Bode and Nyquist charts with consistent visual styling.
- A clear presentation of stability margins.
- A visual comparison between PID and MPC.

Do not allow the block diagram to become a tiny diagram inside a crowded card.

On mobile, provide a deliberate alternative layout that preserves readability rather than simply shrinking the entire diagram.

### Tab 5 — AI Workflow

**Primary inspiration:** Rivian's visual storytelling.

Present the AI workflow as a sequence of stages.

Use a visual timeline or process journey to show:
1. Initial project planning.
2. AI critique.
3. Human decisions.
4. Independent builds.
5. Comparison and evaluation.

Each stage should have a clear visual identity, a short explanation, and room for supporting evidence.

Make the frozen Gemini comparison easy to discover.

### Tab 6 — Video & Transcript

**Primary inspiration:** Rivian's media presentation.

The video should be the primary visual element.

Give it a deliberate presentation area, with supporting information and transcript content organized separately.

The transcript should not dominate the page by default. It should be accessible through a clear expandable or secondary reading area.

### Tab 7 — References

**Primary inspiration:** Nutrien's clean information organization.

Make this page feel complete and intentional.

Use clear groupings for:
- Academic references.
- Technical resources.
- Software/tools.
- Project contributions.

Avoid an unfinished-looking list of links. Give the references consistent spacing, typography, and visual hierarchy.

---

## 3. Overall visual direction

The final design should combine the following qualities:

| Reference | Quality to adopt |
|---|---|
| Harley-Davidson | Cinematic dark presentation and typography |
| Rivian | Immersive storytelling and polished interactions |
| Nutrien | Clean technical communication and real-world imagery |
| Pancreas viewer | Scientific exploration and visualization-first interaction |

The overall result should feel like a premium scientific technology experience.

### Dark theme

Dark is the primary theme.

Use:
- Deep charcoal and graphite backgrounds.
- Slightly lighter elevated surfaces.
- Muted sage/green accents.
- Restrained blue and amber for chart series and status information.
- Soft borders and subtle depth.
- Large visual sections with intentional negative space.

Avoid making every surface pure black or every card translucent.

### Light theme

The light theme must be fully designed.

Use:
- Warm off-white or neutral backgrounds.
- White/elevated surfaces.
- Dark, readable typography.
- Muted sage accents.
- Subtle borders and shadows.

It should feel like a deliberate alternative design, not a color inversion.

### Animation

Use moderate animation intensity.

Good examples:
- Subtle section transitions.
- Smooth tab changes.
- Gentle chart transitions.
- Small hover and active-state feedback.
- Smooth expansion of help and control sections.

Avoid:
- Constantly moving backgrounds.
- Heavy parallax.
- Unnecessary spinning objects.
- Animations that interfere with sliders or chart updates.
- Effects that reduce performance on mobile.

Respect `prefers-reduced-motion`.

---

## 4. Important implementation guidance

Before making changes, review the recordings alongside the existing website and the original implementation prompt.

I want you to translate the visual references into actual implementation decisions.

Do not just tell me that the references are inspiring. Identify exactly:
- Which existing sections should change.
- Which layouts should be replaced.
- Which interactions should be improved.
- Which elements should become larger or smaller.
- Which information should be hidden until requested.
- Which sections should become more visual.
- Which design patterns should be reused across tabs.

If a reference suggests a feature that does not make sense for this project, do not force it.

For example, we do not need a vehicle configurator or an anatomical 3D model. We need the same level of polish, direct interaction, visual hierarchy, and clarity applied to our actual engineering content.

**Preserve all existing project constraints from the original implementation prompt.** In particular:

- Do not modify `site/js/model.js`.
- Do not modify `site/js/data.js`.
- Do not modify `site/gemini/**`.
- Preserve all existing simulation calculations and behavior.
- Preserve all required chart IDs, DOM IDs, test selectors, and tab behavior.
- Preserve all equations, units, metrics, and the required educational disclaimer.
- Do not fabricate scientific results or chart data.
- Maintain mobile usability and accessibility.
- Run the existing test suite after implementation.

## 5. What I expect from you

First, give me a concise design analysis of the current website against these four references.

Then provide a tab-by-tab redesign plan that explains how you will translate the references into our project.

Do not start making code changes until that analysis and plan are complete.

Once the plan is established, implement the redesign using the original project instructions and the visual guidance in this document.

The goal is not simply a prettier website. The goal is to make Closing the Loop feel like a cohesive, polished, interactive scientific experience where the visual design makes the engineering easier to understand.
