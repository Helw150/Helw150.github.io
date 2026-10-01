# Templates

`base.html` defines metadata, shared styles, the footer, and conditional D3 scripts. `homepage.html`, `blog.html`, and `blog_post.html` extend it.

Common variables are `config`, `title`, `description`, `year`, `root` (relative prefix to the site root), and `d3`. The homepage receives `bio`, `publications`, and `posts`; the blog listing receives `posts`; each post page receives `post`, including its rendered `body`.

Keep content in `content/` and styling in `static/css/style.css`. Use the `root` prefix for internal template links so repository-prefix GitHub Pages deployments work. See the root README for adding figures.
