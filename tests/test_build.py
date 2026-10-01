from html.parser import HTMLParser
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import unquote, urlsplit
import build


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        self.urls.extend(value for key, value in attrs if key in ('href', 'src', 'data-d3-src'))


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        for name in ['content', 'templates', 'static']:
            shutil.copytree(build.ROOT / name, self.root / name)
        self.patch = patch.object(build, 'ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.addCleanup(self.temp.cleanup)

    def test_build_links_and_conditional_scripts(self):
        output = self.root / 'dist'
        build.build(output)
        self.assertIn('Open Athena', (output / 'index.html').read_text())
        self.assertNotIn('d3.v7.min.js', (output / 'index.html').read_text())
        self.assertNotIn('d3.v7.min.js', (output / 'blog/index.html').read_text())
        self.assertNotIn('katex.min.js', (output / 'index.html').read_text())
        self.assertNotIn('katex.min.js', (output / 'blog/index.html').read_text())
        post = output / 'blog/constrained-adversarial-optimization/index.html'
        self.assertIn('d3.v7.min.js', post.read_text())
        self.assertIn('katex.min.js', post.read_text())
        self.assertNotIn('marimo', post.read_text())
        for page in output.rglob('*.html'):
            parser = Links()
            parser.feed(page.read_text())
            for url in parser.urls:
                parts = urlsplit(url)
                if parts.scheme or parts.netloc or not parts.path:
                    continue
                target = (page.parent / unquote(parts.path)).resolve()
                self.assertTrue(target.is_relative_to(output))
                self.assertTrue(target.exists(), f'{page}: {url}')
                if target.is_dir():
                    self.assertTrue((target / 'index.html').is_file())
        legacy = output / 'notebooks/constrained_adversarial_optimization.html'
        self.assertIn('http-equiv="refresh"', legacy.read_text())
        (output / 'stale.html').touch()
        build.build(output)
        self.assertFalse((output / 'stale.html').exists())

    def test_missing_asset_fails_build(self):
        asset = self.root / 'static/assets/blog/constrained-adversarial-optimization/pareto.json'
        asset.unlink()
        with self.assertRaises(FileNotFoundError):
            build.build(self.root / 'dist')

    def test_output_cannot_destroy_source(self):
        for name in ['', 'static', 'content', 'templates', '.git']:
            with self.assertRaises(ValueError):
                build.build(self.root / name)

    def test_math_survives_markdown_and_code_stays_literal(self):
        path = self.root / 'content/blog/math-check.md'
        path.write_text(r'''---
title: Math check
summary: Test
date: 2026-09-30
---
An inline $x_i + y_j$ expression.

$$
\frac{x_1}{y_2} \leq z
$$

`$not_math$`
''')
        post = build.render_post(path)
        self.assertTrue(post['math'])
        self.assertIn(r'\frac{x_1}{y_2} \leq z', post['body'])
        self.assertNotIn('<em>', post['body'])
        self.assertIn('<code>$not_math$</code>', post['body'])
        path.write_text('---\ntitle: Plain\nsummary: Test\ndate: 2026-09-30\n---\n`$not_math$`')
        self.assertFalse(build.render_post(path)['math'])
