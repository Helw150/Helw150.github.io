#!/usr/bin/env python3
"""Render Markdown/YAML + Jinja templates into a static site."""
import argparse
from datetime import date
from html import escape
from pathlib import Path
import re
import shutil

import frontmatter
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
import mistune
import yaml

ROOT = Path(__file__).resolve().parent
RENDERERS = {"pareto": "pareto.js"}
markdown = mistune.create_markdown(escape=False, plugins=["table", "footnotes", "math"])


def render_post(path):
    document = frontmatter.load(path)
    post = dict(document.metadata)
    post.setdefault("slug", path.stem)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", post["slug"]):
        raise ValueError(f"Invalid blog slug in {path}")
    for key in ("title", "summary", "date"):
        if key not in post:
            raise ValueError(f"Missing {key} in {path}")
    post["d3"] = False

    def figure(match):
        parts = [part.strip() for part in match[1].split("|")]
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', " | ".join(parts[1:])))
        renderer = attrs.get("renderer")
        if renderer not in RENDERERS:
            raise ValueError(f"Unknown D3 renderer {renderer!r} in {path}")
        asset = Path("assets/blog") / post["slug"] / parts[0]
        asset_path = (ROOT / "static" / asset).resolve()
        if not asset_path.is_relative_to((ROOT / "static/assets/blog" / post["slug"]).resolve()):
            raise ValueError(f"Figure asset must stay within its post directory: {parts[0]}")
        if not asset_path.is_file():
            raise FileNotFoundError(asset_path)
        post["d3"] = True
        title = escape(attrs.get("title", "Interactive figure"))
        caption = escape(attrs.get("caption", ""))
        return (
            f'<figure class="interactive-figure"><h3>{title}</h3>'
            f'<div class="d3-figure" data-d3-renderer="{renderer}" '
            f'data-d3-src="../../{escape(asset.as_posix(), quote=True)}" '
            f'role="group" aria-label="{title}"><p class="figure-status">Loading figure…</p></div>'
            '<noscript><p>Enable JavaScript to explore the figure. The explanation below describes the results.</p></noscript>'
            f'<figcaption>{caption}</figcaption></figure>'
        )

    body = re.sub(r"\{\{\s*d3:\s*([^}]+)\}\}", figure, document.content)
    post["body"] = markdown(body)
    post["math"] = bool(post.get("math")) or 'class="math"' in post["body"]
    return post


def build(output=ROOT / "dist"):
    output = Path(output).resolve()
    # Limit cleanup to known generated directories, never source directories.
    if output not in {ROOT / "dist", ROOT / "_site"}:
        raise ValueError("Output must be the repository's dist/ or _site/ directory")
    config = yaml.safe_load((ROOT / "content/config.yaml").read_text())
    posts = [render_post(path) for path in sorted((ROOT / "content/blog").glob("*.md"))
             if frontmatter.load(path).get("published", True)]
    posts.sort(key=lambda post: str(post["date"]), reverse=True)
    if len({post["slug"] for post in posts}) != len(posts):
        raise ValueError("Duplicate blog slugs")
    env = Environment(loader=FileSystemLoader(ROOT / "templates"),
                      autoescape=select_autoescape(["html"]), undefined=StrictUndefined)
    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(ROOT / "static", output)
    (output / ".nojekyll").touch()

    def write(relative, template, root, title, description, **context):
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(env.get_template(template).render(
            config=config, root=root, title=title, description=description,
            year=date.today().year, posts=posts, d3=False, math=False, **context), encoding="utf-8")

    write("index.html", "homepage.html", "./", config["name"], config["description"],
          bio=markdown((ROOT / "content/home.md").read_text()))
    write("about/index.html", "about.html", "../", f'About · {config["name"]}', config["description"],
          bio=markdown((ROOT / "content/bio.md").read_text()))
    write("blog/index.html", "blog.html", "../", f'Notes · {config["name"]}', config["description"])
    for post in posts:
        destination = output / "blog" / post["slug"] / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(env.get_template("blog_post.html").render(
            config=config, root="../../", title=f'{post["title"]} · {config["name"]}',
            description=post["summary"], year=date.today().year, post=post, d3=post["d3"], math=post["math"]), encoding="utf-8")
    # Preserve links to the former marimo notebook on GitHub Pages.
    legacy = output / "notebooks/constrained_adversarial_optimization.html"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    target = "../blog/constrained-adversarial-optimization/"
    legacy.write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>Page moved</title>'
                      f'<meta http-equiv="refresh" content="0;url={target}"><a href="{target}">Read the interactive post</a></html>')
    print(f"Built {len(posts)} note(s) to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    build(parser.parse_args().output_dir)
