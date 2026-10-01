---
name: website-brand
description: Apply William Held's website brand when editing visual design, D3 figure styling, or the titles and summaries of local notes in this repository.
---

# Website visual brand

Keep the site quiet, legible, and spare: white space, clear type, thin rules,
and figures that earn their ink. The overall impression should be pen on paper:
clean white paper, dark writing, and a few deliberate strokes of colored ink.
Suggest this through color, spacing, and fine lines rather than literal paper
textures, handwriting fonts, simulated ink bleed, or ornamental doodles.
Keep Noto Sans and Noto Sans Display as the typography.
Use these defaults for new design work;
explicit user requests can revise them. This book covers visual design and
the titles and summaries used to introduce notes; it is not a general guide
to the scientific content or prose of posts.

## Note titles and summaries

### Titles

Use short, sentence-case titles that name the idea or outcome in familiar words.
Make them understandable before a reader knows the paper, acronym, or technique.
Prefer a concrete phrase such as **Making predictions language agnostic** over
a formal paper title or an abstract label such as “Constrained adversarial
optimization.” Keep technical terms when they help the intended reader.
Avoid promotional claims, clickbait, and subtitles that repeat the summary.

Keep titles visually compact, but let them wrap naturally on narrow screens.
Preserve an existing slug when changing a title so links keep working.

### Summaries

Write a brief, conversational invitation to the note: why the idea is useful,
interesting, or personally worth sharing. First person is welcome when it adds
the author's perspective. Prefer the practical benefit over a compressed
description of the mechanism; the note itself can explain how it works.
Add information beyond the title rather than paraphrasing it.

For example, pair **Making predictions language agnostic** with:

> One of my favorite tricks for improving linguistic robustness without extra labeled data

Aim for one line in the desktop homepage's Notes section, using its existing
font size and width. Check the rendered fit rather than enforcing a fixed
character limit. Shorten the wording when needed; do not shrink the font,
truncate the text, or force `nowrap`. Mobile wrapping is expected. A short
standalone phrase may omit its final period.

Use the note's frontmatter `summary` as the shared description on the homepage,
Notes listing, and note page. Keep its promise consistent with the note and
preserve author-supplied wording unless asked to revise it.

## Typography

| Role | Family | Weight |
| --- | --- | --- |
| Body, navigation, controls, captions, SVG labels | Noto Sans, sans-serif | 400 |
| Page titles and section headings | Noto Sans Display, Noto Sans, sans-serif | 500 |
| Occasional emphasis | Inherit the surrounding family | 600 |
| Mathematical notation | Bundled KaTeX fonts | Renderer defaults |

Use the existing `--font-body` and `--font-display` CSS variables. Load fonts
through `templates/base.html`; avoid adding another family for a new component.
Keep headings in sentence case, with normal letter spacing. Avoid heavy bold,
all-caps labels, and typography that competes with the content.

The current scale is a useful starting point, not a requirement for every page:

| Element | Size | Line height |
| --- | --- | --- |
| Homepage body | 15px | 1.65 |
| Blog body | 17.5px | 1.7 |
| Page title | 36px; 28–30px on phones | 1.2 |
| Blog section heading | 25px | Inherit |
| Homepage section heading | 17px | Inherit |
| Figure caption | 14px | 1.6 |

Skeleton sets the root size to 10px, so existing `rem` values use that scale.
Preserve readable sizes when adapting layouts to small screens.

## Color

The accent palette takes its hue families from the supplied categorical palette,
with rich, clear pen-ink tones: blue, burnt orange, violet, magenta, and teal.
Retain distinct hue and saturation rather than mixing gray into every color.
Keep darker companion inks for contrast, and avoid neon or fluorescent tones.
The white canvas and sparse use of color provide the restraint.

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#ffffff` | Page and figure backgrounds |
| Ink | `#292929` | Main text |
| Muted text | `#686868` | Metadata, captions, secondary text |
| Accent | `#2764a5` | Links, focus outline, primary plotted trajectory |
| Accent hover | `#164f72` | Hovered links |
| Divider | `#eeeeee` | Section and footer rules |
| Control track | `#dddddd` | Slider tracks |
| Control thumb | `#666666` | Slider handles |

Keep most of the page neutral; reserve blue for an actionable link or meaningful
data. Reuse the palette rather than introducing a new accent for each section.
Avoid decorative gradients, shadows, tinted cards, and background fills;
continuous color scales are appropriate when they encode data.
Light grays belong to supporting lines, not essential explanatory text.

### Categorical palette

Retain all eleven colors as equal members of the data visualization palette.
The site's primary interface accent is blue, but that does not give blue priority
over other colors in categorical figures. Pick as many colors as the data requires,
keeping category assignments consistent across figures in a post. Related hues
need particular care when used together; distinguish them with labels or marks.

| Color | Reference | Adjusted | Role |
| --- | --- | --- | --- |
| Blue | `#1877f2` | `#2764a5` | Primary accent |
| Orange | `#f0701a` | `#c76c24` | Warm contrast |
| Purple | `#5a24c7` | `#7442a8` | Third category |
| Pink | `#e42c97` | `#ca3984` | Rose contrast |
| Dark blue | `#00487c` | `#164f72` | Deep blue; hover |
| Teal | `#0eac96` | `#138c80` | Green contrast |
| Light purple | `#a87cfe` | `#a379ce` | Light violet contrast |
| Burgundy | `#850550` | `#98265d` | Deep rose contrast |
| Cyan | `#0099e6` | `#208faf` | Light blue contrast |
| Dark purple | `#220855` | `#49266c` | Deep violet contrast |
| Brown | `#783301` | `#8d4d23` | Earth tone contrast |

See [the swatch comparison](references/palette.html) for the reference and adjusted
tones together. This is a local design reference, not a public website page.
Use `--paper`, `--ink`, `--muted`, `--accent`, and `--accent-hover` for shared
page colors. Use the same primary accent for links, focus, and the primary trajectory.
Check contrast for the actual use: a color suitable for a filled mark is not
automatically suitable for small text or a thin line on white. Use ink for labels
when a lighter category color is insufficient.

### Diverging palette: pink to green

Use this eleven-stop scale for signed quantities such as differences, residuals,
or changes from a baseline. It adapts the supplied image's bottom palette into
rose and green inks, with pale near-zero values and saturated, deep extremes. It is a
numeric scale, not a set of interchangeable category colors.

| Position | Reference | Adjusted |
| --- | --- | --- |
| −5 | `#850550` | `#8b1e50` |
| −4 | `#bf0f76` | `#b83c78` |
| −3 | `#fc7bc6` | `#d875a6` |
| −2 | `#ffade4` | `#edb4d0` |
| −1 | `#ffd9f2` | `#f8ddea` |
| 0 | `#f0f2f5` | `#f0f2f5` |
| +1 | `#cbf9d7` | `#dcf1e3` |
| +2 | `#a3e6b5` | `#aedbbe` |
| +3 | `#45bd62` | `#71ba90` |
| +4 | `#2a9142` | `#359568` |
| +5 | `#1d632e` | `#166540` |

Keep zero (or the stated reference value) at the neutral midpoint. Default to
symmetric limits around it so equal magnitudes receive comparable emphasis.
Label the scale and its units; green means positive, not necessarily good.
Give missing values a separate visual treatment so they cannot be read as zero.
Use the light stops for filled regions, such as heatmap cells, with dark labels;
they will not make legible thin curves on white.

The colors are also available in [palettes.json](references/palettes.json).
For a continuous D3 scale centered on zero:

```js
const colors = palettes.divergingPinkGreen;
const limit = 1; // Replace with the magnitude limit in the data's units.
const color = d3.scaleLinear()
  .domain(colors.map((_, i) => -limit + 2 * limit * i / (colors.length - 1)))
  .range(colors)
  .interpolate(d3.interpolateLab)
  .clamp(true);
```

## Space and layout

- Center page containers. The homepage uses an 800px maximum outer width;
  posts use 720px with a roughly 640px text measure on desktop.
- Keep the homepage compact through grouping and concise content, rather than
  shrinking type. Mobile pages may scroll vertically.
- Use thin horizontal rules to separate sections. Keep content in the page
  flow rather than placing every item in a box.
- Use about 20px side padding on phones. Collapse parallel columns into one
  column; let long titles wrap naturally.
- Center display equations. Contain a long equation's horizontal scrolling
  within its math block, so it cannot widen the page.
- Preserve the round profile photograph and restrained heading hierarchy.

## Figures and controls

Choose the visual approach according to what the figure can do for the reader.

### Explain the data: Tufte-esque

When readers can meaningfully compare values, follow a relationship, or explore
a mechanism, use a minimal, Tufte-inspired style. Prioritize readable scales,
direct labels, precise marks, and little unnecessary ink. Let the data carry
the explanation. Prefer a broad, short plot over a tall square when appropriate.
Use smooth, precise strokes with round caps and joins for plotted curves: the
suggestion of a fine pen, without artificial wobble or distressed edges.

### Evoke the data: W. E. B. Du Bois-esque

When the data's scale or complexity makes a conventional explanatory plot
unlikely to communicate much, the figure can instead convey its emotional
weight: abundance, disparity, concentration, fragmentation, or magnitude.
Draw inspiration from W. E. B. Du Bois's bold color, geometric composition,
striking silhouettes, and deliberate use of space. Use the full ink palette;
large colored areas and expressive arrangements are welcome in this mode.
The minimal-mark conventions below are defaults for explanatory figures,
not restrictions on these expressive figures.

Decide what feeling the data warrants before choosing a composition. Keep
quantitative encodings faithful where used, and make clear when a figure is an
evocative view rather than a way to read exact values. Do not turn a readable
comparison into a spectacle merely for decoration. This is a distinction of
purpose, not a claim that Du Bois's work lacked analytical clarity.

### Shared presentation

Center the figure and its title; keep the caption left aligned beneath it.
The current figure maximum width is 620px; allow more room when a composition
needs it. Preserve the white-paper canvas and Noto typography in both modes.

Use Noto Sans inside SVGs. Directly label lines and important points when space
allows; use a legend only when it makes the figure easier to read. Remove
unnecessary borders and grid lines. Keep visible axes and sufficient space for
their labels.

Existing plotting conventions:

| Mark | Style |
| --- | --- |
| Primary trajectory | Accent blue, 1.5px stroke |
| Reference curve | `#444444`, 1px stroke |
| Constraint | `#bbbbbb`, thin dashed line |
| Optimum | Small open circle, white fill, gray stroke |
| Tick marks | `#aaaaaa`, approximately 0.6px stroke |

Color alone should not distinguish essential marks. Use line styles, shapes,
or labels as well. These conventions can change when a new figure needs a
different visual distinction.

Keep controls understated: a thin gray slider, small round handle, plain label,
and visible numerical value. Include only controls that help readers explore
the figure's point. Preserve keyboard operation and visible focus styling.

Adapt the SVG layout as its container narrows instead of merely shrinking the
whole desktop drawing. Enlarge labels in SVG coordinates when needed to keep
their rendered size legible, shorten labels carefully, and resolve collisions.

## Applying the book

Read `static/css/style.css` and the relevant template or figure renderer before
editing. Reuse existing variables and selectors where possible. Keep shared
page styling in CSS; keep mark-specific styling near its D3 renderer.

For visual changes, inspect the affected page at desktop and at 390px and 320px
widths. Check wrapping, readable labels, caption alignment, focus visibility,
and page overflow. This skill lives outside the rendered source directories;
do not copy it into the generated site.
