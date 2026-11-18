<!-- Verbatim: the UI/UX redesign brief ChatGPT wrote from docs/ux-brief-for-chatgpt.md, pasted by Andrew into the Claude
     Code session on 2026-11-18. Claude's audit and phase plans: docs/plan-redesign-phase*-claude.md. Not edited. -->

# CLOSING THE LOOP — COMPLETE UI/UX REDESIGN

## ROLE

Act as a senior product designer, creative director, and frontend engineer specializing in premium technology websites, scientific visualization platforms, and sophisticated interactive interfaces.

You are responsible for redesigning the existing **Closing the Loop** website.

Your goal is to transform the current website into something that feels like a professionally designed scientific technology platform — combining the visual storytelling of Rivian, the interface simplicity of Apple, and the scientific presentation of advanced medical visualization software.

This is NOT a request to simply change the CSS colors or apply a dark theme.

I want a cohesive redesign of the entire experience, including its visual identity, navigation, information architecture, typography, layouts, charts, controls, interactions, and responsive behavior.

You must work within the existing codebase and preserve the verified engineering functionality.

---

# PART 1 — UNDERSTAND THE PROJECT BEFORE CHANGING ANYTHING

Start by thoroughly inspecting the repository.

Project:
https://github.com/BE-aa8/PD-C

Live website:
https://be-aa8.github.io/PD-C/

Gemini comparison:
https://be-aa8.github.io/PD-C/gemini/

The website is located in `site/`.

Read the existing project brief and inspect the uploaded screenshots and source bundle if available.

Inspect:
- site/index.html
- site/css/style.css
- site/js/app.js
- site/js/model.js
- site/js/data.js
- Existing browser tests
- Existing screenshots in the project brief

Understand how the seven tabs work, how the simulator builds its controls, how the charts are generated, and how the existing styling system works.

Do not begin by replacing files.

First, establish an understanding of the existing architecture and identify the safest way to implement the redesign.

## Project context

Closing the Loop is an interactive educational website for CHEE 4071 Process Dynamics and Control at the University of Cincinnati.

It explores an artificial-pancreas glucose–insulin model as a chemical-process control problem.

The website contains:

1. Overview
2. Simulator
3. Theory
4. Control Design
5. AI Workflow
6. Video & Transcript
7. References

The engineering model, calculations, and automated tests have already been completed and verified.

**The task is to redesign how the project looks, reads, and feels. It is not to redesign the underlying engineering.**

---

# PART 2 — CREATIVE DIRECTION

## The overall concept

Name the design direction:

**Immersive Scientific Technology**

Combine three influences:

### A. Rivian — storytelling and visual identity

Study Rivian's website for:
- Cinematic full-width visual sections.
- Large editorial typography.
- Minimal navigation.
- Strong use of negative space.
- Smooth transitions between sections.
- Product-focused storytelling.
- Beautifully controlled photography.
- A sense of premium craftsmanship.

Do not copy Rivian's branding or specific website layouts.

Borrow its approach to making a visitor interested in exploring the experience.

### B. Apple — interface design and usability

Study Apple's website for:
- Simple and intentional layouts.
- Generous spacing.
- Consistent rounded elements.
- Restrained visual effects.
- Carefully designed navigation.
- Clear typography hierarchy.
- Minimal but meaningful interactions.
- Excellent presentation of complex information.

Use Apple's approach to making interfaces feel simple, even when the underlying product is complicated.

### C. Scientific visualization — technical credibility

Use the design principles of modern scientific and medical visualization platforms.

Priorities:
- Scientific visualizations should be prominent.
- Charts should be readable.
- Equations should feel integrated into the design.
- Technical explanations should be organized.
- Interactive controls should be intuitive.
- Information should be progressively disclosed.

The website must remain unmistakably an educational engineering project.

Do not make it look like an actual medical device or commercial healthcare product.

---

# PART 3 — FINAL DESIGN DECISIONS

These decisions are established. Do not ask me to choose them again.

| Category | Decision |
|---|---|
| Primary theme | Dark |
| Secondary theme | Fully designed light mode |
| Visual influence | Balanced Rivian and Apple |
| Overview hero | Hybrid cinematic imagery + scientific visualization |
| Redesign scope | Entire website, all seven tabs |
| Animation intensity | Moderate |
| Main design priority | Visual hierarchy and readability |
| Simulator priority | Visualization-first interface |
| Responsive design | Desktop, tablet, and mobile |
| Technical stack | Existing HTML, CSS, and JavaScript |

## Color system

Use the following as initial CSS design tokens.

### Dark theme

- Background: #111513
- Surface: #1A211D
- Elevated surface: #252E28
- Primary text: #E9EEE8
- Secondary text: muted gray-green
- Primary accent: #A6C58C
- Sensor/data blue: #7BA7B7
- Warning amber: #D8AD70
- Critical red: #D77C79

### Light theme

- Background: #F2F3EE
- Surface: #FFFFFF
- Elevated surface: #E7EBE5
- Primary text: #202923
- Primary accent: #647F55
- Sensor/data blue: #547F91
- Warning amber: #A77A39
- Critical red: #B85D59

Refine colors as necessary to maintain accessibility and contrast.

The dark theme is the primary experience. It should feel like a premium technology platform, not a generic black dashboard.

Do not use excessive neon green, gradients, or glowing borders.

## Typography

Preferred:
- Manrope for display typography.
- Inter for body typography.
- Existing KaTeX font rendering for mathematics.

Use system fallbacks.

Keep the type system controlled:

- Hero: approximately 64–76 px desktop.
- Page headings: 42–52 px.
- Section headings: 30–36 px.
- Card headings: 19–22 px.
- Body: 16–18 px.
- Secondary text: 13–14 px.

Use responsive scaling.

Avoid making every heading oversized.

## Shape and component language

- Main containers: 20–24 px radius.
- Smaller cards: 14–18 px radius.
- Rounded buttons and controls.
- Subtle borders.
- Soft shadows.
- Restrained translucent floating panels.
- Consistent spacing.
- Clear visual separation between content groups.

Use glass-like effects selectively, especially around simulator controls and floating interface elements.

Do not apply glassmorphism indiscriminately to every element.

---

# PART 4 — REDESIGN EACH OF THE SEVEN TABS

## 1. OVERVIEW — THE VISUAL STORY

This page should feel like the homepage of a premium technology company.

It is currently too text-heavy and lacks a compelling visual introduction.

### Proposed structure

A. Hero section

Create an immersive hero featuring:

- A large editorial headline.
- A short project description.
- A prominent visual.
- A clear action to explore the simulator.
- Subtle background gradients and lighting.

Suggested headline:

"Closing the Loop"

Suggested supporting statement:

"Exploring the challenges of feedback control through a dynamic glucose–insulin system."

### Hero visual

Use a hybrid visual combining:

1. Abstract, scientifically inspired anatomical or biological imagery.
2. Actual glucose-response visualization from the project's model.
3. Subtle technical details and visual elements.

This must not be generic stock medical photography.

Do not use patient photographs, realistic insulin-pump product mockups, or visual elements that imply a real commercial medical device.

Whenever possible, use actual simulation data to generate the scientific visualization.

Do not invent numerical results.

### B. Introduce the engineering problem

Present the artificial pancreas as a chemical-process control problem.

Use a visually clear process diagram showing:

- Glucose process.
- Insulin infusion.
- Sensor measurement.
- Controller.
- Meal disturbance.
- Feedback loop.

Make the diagram visually interesting and understandable without requiring the visitor to read a large paragraph.

### C. The central challenge

Present the four main teaching points as a visual narrative:

1. Feedback alone reacts too late.
2. The pump has asymmetric control authority.
3. Feedforward helps compensate for the disturbance.
4. Delay and sampling limit stability.

Use the actual model results already present in the project.

The two glucose-response scenarios should be visually comparable.

### D. Course concepts

Reorganize the existing course-concept information into visually distinct sections.

### E. AI development story

Introduce the AI development workflow with a link to the AI Workflow tab.

### F. Final navigation

End with a clear route into the Simulator.

The Overview should make someone want to explore the rest of the website.

---

## 2. SIMULATOR — THE MAIN PRODUCT EXPERIENCE

This is the highest-priority functional redesign.

The existing simulator contains:
- 22 presets.
- Approximately 25 controls.
- Six collapsible control groups.
- Warnings and status indicators.
- Five KPI tiles.
- Glucose chart P1.
- Insulin chart P2.
- Meal chart P3.
- Metrics table.
- Saved runs.
- Live sweeps P10 and P11.
- Additional educational explanations.

The current layout feels dense, particularly because the controls and results compete for attention.

### New design philosophy

**The simulation should be the centerpiece. The controls should support it, not dominate it.**

### Desktop layout

Create a sophisticated simulation workspace.

Suggested hierarchy:

1. Compact simulation header.
2. Scenario/preset selection.
3. Simulation status and warnings.
4. KPI results.
5. Large primary glucose chart.
6. Secondary insulin and meal charts.
7. Simulation controls.
8. Metrics and saved runs.
9. Advanced sweeps and additional explanations.

You may refine the exact order if usability testing suggests a better arrangement.

### KPI design

Maintain all five existing KPI values.

Give the most educationally important values greater visual emphasis.

Use:
- Large numerical typography.
- Small descriptive labels.
- Clear units.
- Restrained semantic colors.
- Consistent alignment.

Do not create decorative metrics or change their calculations.

### Charts

The glucose chart should be the primary visualization.

The insulin and meal charts should be clearly associated with it.

Use a consistent chart language:
- Minimal gridlines.
- Readable axes.
- Clear legends.
- Consistent series colors.
- Appropriate reference bands.
- Dark and light theme support.

Keep every existing chart and all its functionality.

### Controls

Retain all six existing collapsible control groups.

Improve their presentation:

- Clear group names.
- Short descriptions.
- Consistent input layouts.
- Rounded controls.
- Better spacing.
- Clear active states.
- Current values easy to read.

Keep the existing question-mark help toggle.

The longer educational explanations should be hidden behind the help control rather than occupying the primary simulator interface.

Do not remove information.

The default experience should be clean, while advanced controls remain accessible.

### Mobile simulator

Mobile requires special attention.

Do not simply shrink the desktop interface.

Prioritize:
- Primary glucose chart.
- Important KPIs.
- Current scenario.
- Warnings.
- Clearly accessible controls.

Keep the existing `#jump-btn` behavior.

The user should be able to reach the controls without navigating through a huge page.

All charts and tables must fit within their own scrollable containers where necessary.

Never create horizontal scrolling across the entire page.

---

## 3. THEORY — AN INTERACTIVE TECHNICAL PUBLICATION

Theory should feel like a sophisticated engineering publication.

Retain the existing five numbered sections and their content.

Organize them into:

1. Nonlinear glucose–insulin model.
2. Units and physical interpretation.
3. Linearization and transfer functions.
4. Nonlinear gain and half-rule analysis.
5. Feedforward and bolus.

Use:
- Large editorial section headings.
- Clear chapter numbering.
- Short introductory descriptions.
- Dedicated equation containers.
- Associated charts.
- Physical interpretations.
- Optional expandable derivations.

Consider a compact sticky chapter navigator on desktop.

On mobile, use a compact section selector.

**Important:** Every equation must remain visible and retain its units and physical interpretation.

Every existing chart must remain available.

Do not simplify away the mathematics.

---

## 4. CONTROL DESIGN — ENGINEERING WORKSPACE

This section should feel like a professional control-system design document.

Organize it into:

1. Controller configuration.
2. IMC tuning methodology.
3. Discrete PID implementation.
4. Anti-windup.
5. Block diagram.
6. Stability margins.
7. Bode and Nyquist analysis.
8. PID versus MPC comparison.

The block diagram should receive particular attention.

Improve:
- Label spacing.
- Arrow clarity.
- Typography.
- Visual hierarchy.
- Responsive behavior.

It should feel like a deliberate part of the website, not an ordinary SVG placed in a card.

Preserve every equation, chart, tuning input, and interactive element.

---

## 5. AI WORKFLOW — SHOWCASE THE DEVELOPMENT PROCESS

This page is important to the assignment.

Create a visually interesting development timeline.

Stages:

1. Claude — initial planning.
2. Gemini — independent critique.
3. Andrew — human review and decisions.
4. Claude and Gemini — independent implementations.
5. Automated testing and comparison.
6. Final selection.

Use a horizontal timeline on desktop and vertical timeline on mobile.

Make the frozen Gemini implementation accessible through a clearly labeled link:

https://be-aa8.github.io/PD-C/gemini/

The page should communicate that AI was used through a structured process of planning, critique, decision-making, independent implementation, and testing.

Do not fabricate details about the AI development process.

---

## 6. VIDEO & TRANSCRIPT

Create a presentation-focused layout.

- Large video player.
- Clear presentation title.
- Short description.
- Collapsible transcript.
- Readable transcript typography.
- Appropriate source information.

The page should look intentional even before the final video is inserted.

---

## 7. REFERENCES

Create a polished research-reference page.

Organize references into:

- Textbook and theoretical sources.
- Model and parameter sources.
- Computational tools.
- AI contributions.
- Project contributions.

Use clear typography and consistent citation formatting.

Preserve the actual references and source information.

---

# PART 5 — ANIMATION AND INTERACTIONS

Animation intensity: MODERATE.

The website should feel polished and responsive.

Use:

- Smooth navigation transitions.
- Subtle section reveals during scrolling.
- Small vertical movement and opacity transitions.
- Smooth accordion expansion.
- Subtle button hover effects.
- Controlled chart transitions.
- Active navigation indicators.

Avoid:

- Heavy parallax.
- Constant background animations.
- Excessive glowing effects.
- Large animated layers.
- Unnecessary movement.
- Animations that interfere with slider interactions.

Respect `prefers-reduced-motion`.

Performance matters, especially on mobile.

The simulator performs approximately 25 simulations per slider movement during live sweeps. Do not introduce animations or rendering overhead that makes these interactions sluggish.

---

# PART 6 — TECHNICAL RESTRICTIONS

This is extremely important.

The existing application uses:

- Plain HTML.
- CSS.
- JavaScript ES modules.
- Plotly 2.35.2.
- KaTeX 0.16.11.
- GitHub Pages.

There is no framework or build step.

Do not introduce a new framework.

Do not add new JavaScript libraries unless absolutely necessary.

### Files

`site/index.html`
- May be redesigned.
- Preserve required DOM IDs and tab structure.

`site/css/style.css`
- May be extensively redesigned.
- Establish reusable design tokens and components.

`site/js/app.js`
- May be modified for presentation, layout, markup, and chart styling.
- Preserve existing calculations, controls, and behavior.

`site/js/model.js`
- DO NOT MODIFY.

`site/js/data.js`
- DO NOT MODIFY.

`site/gemini/**`
- DO NOT MODIFY.
- This is frozen comparison evidence.

### Required disclaimer

This disclaimer must remain clearly visible on every page:

"Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions."

Do not remove or weaken it.

### Other restrictions

- No new numerical claims.
- Do not change the model.
- Do not change the calculations.
- Do not remove equations.
- Do not remove charts.
- Do not remove controls.
- Do not invent medical guidance.
- Do not introduce patient imagery or product claims.
- Preserve all `[TO VERIFY]` indicators.

---

# PART 7 — AUTOMATED TESTS AND REQUIRED IDS

The existing tests must continue passing.

Run:

`npm test`

`node tests/browser-smoke.mjs --base http://localhost:8000 --paths /,/gemini/ --out /tmp/smoke`

`node tests/browser-content.mjs --base http://localhost:8000`

Use a local server:

`python3 -m http.server 8000 -d site`

The browser tests cover:
- 1280 × 800 desktop.
- 375 × 812 mobile.
- Light theme.
- Dark theme.
- All seven tabs.
- Interactive controls.
- Plotly charts.
- KaTeX equations.
- Console errors.
- Horizontal overflow.
- Actual simulation data.

### Preserve all required selectors

Tabs:
- `#tab-<name>`
- `#panel-<name>`
- `data-tab`

Simulator:
- `#sim-controls`
- `#sim-top`
- `#sim-warnings`
- `#sim-badge`
- `#band-select`
- `#sim-kpis`
- `#metrics-table`
- `#save-run`
- `#clear-runs`
- `#saved-list`
- `#p11-cap`
- `#jump-btn`

Charts:
- `#p1` through `#p11`
- `#p-bolus`

Theory and control design:
- `#theory-cards`
- `#design-cards`
- `#design-ctl`
- `#block-diagram`
- `#tauc-guideline`

References:
- `#ref-list`
- `#lib-warning`

Additional tested selectors:
- `[data-tab="theory"]`
- `[data-tab="design"]`
- `#sim-preset`
- `#sim-kpis .kpi .v`
- `#sim-controls .seg button[data-v="manual"]`
- `#sim-controls .seg button[data-v="imc"]`
- `#sim-Kc_man`
- `#p1`
- `#p4`
- `#p9`
- `#p10`
- `#ds-margins`
- `#mpc-case`

Do not remove, rename, duplicate, or repurpose required selectors.

Do not put tab-identifying attributes on non-tab elements.

Every visible range input must change a chart or visible text.

The tests must pass on both the redesigned Claude website and the untouched Gemini comparison website.

---

# PART 8 — IMPLEMENTATION PHASES

Do not attempt the entire redesign in one enormous operation.

Work in small, independently testable phases.

## Phase 1 — Design foundation

Establish:
- CSS variables.
- Color system.
- Typography.
- Spacing.
- Borders.
- Shadows.
- Component shapes.
- Light/dark themes.
- Responsive foundations.

Do not redesign the page structure yet.

Run all relevant tests.

## Phase 2 — Global navigation and layout

Redesign:
- Header.
- Navigation.
- Active-tab indicator.
- Main page containers.
- Disclaimer.
- Footer.
- Shared component styling.

Preserve all tab IDs and behavior.

Test desktop and mobile.

## Phase 3 — Overview

Implement:
- Hero.
- Hybrid scientific/cinematic visual.
- Process-control introduction.
- Four-part teaching narrative.
- Course concept sections.
- AI introduction.
- Simulator navigation.

Use actual project data wherever possible.

## Phase 4 — Simulator

Redesign the complete simulator interface.

Work carefully to preserve every existing control and chart.

Test every interactive feature.

Pay particular attention to mobile.

## Phase 5 — Theory and Control Design

Redesign both technical pages.

Preserve all equations, charts, calculations, and diagrams.

## Phase 6 — AI Workflow, Video, References

Complete the supporting pages.

Ensure they look intentional and cohesive with the rest of the website.

## Phase 7 — Final polish and validation

Review:
- Desktop.
- Mobile.
- Light theme.
- Dark theme.
- Typography.
- Contrast.
- Accessibility.
- Animations.
- Performance.
- All existing tests.

Resolve any visual inconsistencies.

---

# PART 9 — HOW I WANT YOU TO WORK

I care more about design quality than implementation speed.

Do not interpret this prompt as permission to make superficial changes just to complete the phases quickly.

I want thoughtful design decisions.

### Before implementation

1. Inspect the complete existing codebase.
2. Review the screenshots.
3. Identify the current component structure.
4. Map the required IDs and functional dependencies.
5. Produce a concise implementation plan.
6. Identify potential risks to the existing tests.

### During implementation

- Work phase by phase.
- Keep changes focused.
- Test after every phase.
- Avoid unnecessary refactoring.
- Preserve the existing engineering.
- Inspect the actual browser output.
- Compare desktop and mobile.
- Fix visual problems before moving on.

Do not claim a test passes unless you have actually run it.

If a test fails, investigate and resolve the cause before continuing.

### Visual quality expectations

Do not settle for:
- A generic dark dashboard.
- Generic glassmorphism.
- A collection of equally sized cards.
- Oversized typography everywhere.
- Excessive gradients.
- Random green accents.
- A website that looks like a university assignment with a new color palette.

I want a cohesive experience.

The landing page should feel cinematic.

The simulator should feel like a sophisticated scientific instrument.

The theory pages should feel like a premium technical publication.

The supporting pages should feel like parts of the same product.

### First task

For now, complete the repository audit and prepare the Phase 1 implementation plan.

Show me:

1. What you found in the existing codebase.
2. How you intend to structure the new design system.
3. Which existing elements need special protection.
4. The exact files you plan to change.
5. Any risks to the automated tests.

**Do not start modifying the code until you have presented this initial audit and implementation plan.**

We will review the direction before proceeding with Phase 1.
