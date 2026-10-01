# William Held's website

A small static site with Markdown/YAML content, Jinja templates, and interactive D3 blog figures. The build follows the same pattern as the Open Athena website: Python renders the site at build time; visitors receive HTML, CSS, and JavaScript.

## Local development

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync --locked
uv run build.py
python3 -m http.server --directory dist 8000
```

Open http://localhost:8000. Rebuild after editing content. `./demo.sh` builds and starts the server. The build works from any working directory and replaces `dist/` each time.

## Editing

- `content/config.yaml`: name, role, email, and profile links.
- `content/bio.md`: biography (Markdown or HTML).
- `content/publications.yaml`: publication entries, in display order; authors may contain HTML emphasis.
- `content/blog/*.md`: posts with YAML frontmatter (`title`, `slug`, `date`, `summary`, optional `published: false`).
- `templates/`: shared layout, homepage, blog listing, and blog post layout.
- `static/`: assets copied unchanged into `dist/`, including PDFs and images at their existing URLs.

## Interactive D3 figures

Embed a figure in a post with:

```text
{{d3: pareto.json | renderer="pareto" | title="Explore a concave Pareto front" | caption="An explanation of the figure."}}
```

The JSON lives in `static/assets/blog/<post-slug>/`. It stores data or experiment settings; rendering and browser computation live in JavaScript. Missing assets and unknown renderers fail the build.

Add a new renderer module under `static/js/`, register it in `build.py` and `static/js/figures.js`, and export `render(element, data)`. D3 is pinned at 7.9.0 and bundled locally. Only posts containing D3 shortcodes load it; individual renderer modules are loaded on demand. Figures should use responsive SVG, labeled keyboard-accessible controls, and readable fallback/error text.

The first post replaces the original Python optimization notebook. It evaluates analytic gradients in JavaScript, lets readers compare a fixed loss weight λ with a selectable constraint threshold ε and its analytic optimum. There is no Python, JAX, marimo, or WebAssembly in the browser. The old notebook URL redirects to the post.

## Checks and deployment

```bash
uv run python -m unittest discover -s tests
node --test tests/pareto.test.mjs
uv run build.py
```

Node 18+ is only needed for the JavaScript tests. Source lives on `main`; GitHub Pages serves the compiled site from the root of `gh-pages`, at williamheld.com. Rebuild and publish the contents of `dist/` to `gh-pages` after source changes. The custom domain is preserved in `static/CNAME`. An optional Actions deployment template is saved in `architecture/github-pages-workflow.yml`; it is not active.

See [architecture/README.md](architecture/README.md) for the build and content model.

## Math

Write inline LaTeX as `$L_{\mathrm{adv}} \geq \varepsilon$`. Use `$$` on separate lines for display equations:

```text
$$
\lambda \leftarrow \max(0, \lambda + \eta_\lambda(\varepsilon - L_{\mathrm{adv}}))
$$
```

Mistune preserves math separately from Markdown. Posts containing math automatically load the local KaTeX 0.18.9 renderer, stylesheet, and required fonts; other pages load none of these. Code blocks and inline code stay literal. KaTeX emits both visual HTML and accessible MathML. Display equations are centered and scroll within their own block when too wide for the screen.
