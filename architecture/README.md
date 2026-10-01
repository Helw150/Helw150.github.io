# Site architecture

`uv run build.py` loads YAML configuration and publications, renders the bio and blog Markdown using Mistune, expands D3 figure shortcodes, and renders Jinja templates. Dependencies are declared in `pyproject.toml` and locked in `uv.lock`. All paths are relative to the build script rather than the shell's working directory.

The default output is `dist/`; `--output-dir _site` is also supported. The build validates post metadata, unique URL-safe slugs, renderer names, and referenced figure assets before copying static files and rendering pages. Exceptions fail CI instead of silently shipping a partial site. Cleanup is limited to these two generated directories to protect source files.

Routes:

- `/`: profile, bio, links, interactive post previews, publications.
- `/blog/`: post listing.
- `/blog/<slug>/`: a Markdown post with optional D3 figures.
- `/notebooks/constrained_adversarial_optimization.html`: redirect to the migrated post.

Assets keep `/images/` and `/files/` paths. Template URLs use relative prefixes, so the same output works at a domain root or under a GitHub Pages repository prefix. Add any future domain configuration as `static/CNAME`; the build copies it automatically.

Frontmatter requires `title`, `summary`, and `date`; `slug` defaults to the Markdown filename. `published: false` excludes drafts. Content is trusted repository-authored Markdown/HTML. Jinja autoescapes metadata, while rendered Markdown and publication author markup are explicitly marked safe.

A `{{d3: file.json | renderer="name" | title="..." | caption="..."}}` shortcode becomes a figure host. Paths resolve within `static/assets/blog/<slug>/`. `build.py` validates the renderer registry and asset path. The shared layout loads the local, pinned D3 bundle and figure bootstrap only on posts using shortcodes. The bootstrap fetches JSON and dynamically imports the requested renderer. Data and experiment settings are separate from presentation logic.

The Pareto renderer uses an isolated math module with analytic gradients derived from the original JAX losses, including clipped loss evaluation. The adversary loss is two minus the original second cost, matching the article’s higher-is-better convention. Both modes minimize task loss minus weighted adversary loss; the constrained mode enforces adversary loss ≥ ε. Two figure modes share the loss-space plot. The fixed-weight mode shows one trajectory controlled by λ; the constrained mode exposes ε and simulates projected, damped multiplier updates. The constrained settings specify primal/dual step sizes, damping, initial multiplier, and iteration count in JSON. Both show the analytic constraint optimum for comparison; the constrained path is computed independently from gradients. Python is only a build dependency.

Source is maintained on `main`. The active `.github/workflows/deploy.yml` runs Python and Node checks and builds the site on pull requests and main pushes. Main pushes and manual dispatches deploy the generated Pages artifact. Pages uses GitHub Actions; the older `gh-pages` branch is retained as a previous deployment snapshot.

Typography uses Noto Sans for body text, controls, and SVG labels, and Noto Sans Display for headings. Figure styling favors white space, thin reference lines, direct labels, restrained color, and equal axis scales over decorative frames and legends.

Math uses Mistune's math plugin (`$...$` inline and `$$...$$` display) and a locally bundled KaTeX 0.18.9 distribution. Rendered math tokens enable the post's `math` flag; the shared layout conditionally loads its styles and deferred scripts. `static/js/math.js` typesets only `.math` nodes within blog content, so code and D3 labels are untouched. HTML and MathML are emitted for visual rendering and accessibility. TeX is preserved as readable source if JavaScript is disabled.

Blog typography follows the Open Athena blog's effective 640px text measure and 17.5px body size. The 720px post container includes 40px side padding on desktop; mobile uses 20px page gutters. Figures and controls are centered as a block, titles centered above, and captions aligned to the figure width below. The site retains its own Noto fonts and minimal white figure styling.

The homepage uses `content/home.md` for its short introduction and shows the latest post. The complete biography remains in `content/bio.md` at `/about/`; publication lists are available through the Scholar profile links. Homepage layout rules are scoped to `.home` and `.home-page`.
