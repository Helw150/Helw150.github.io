// Model access through a small source port: entries, text(path), bytes(path).
import { yaml, checkedPath, describe, metadata, research } from './format.mjs';
import {isWorkRecord, parseWork} from './work.mjs';
const SKIP = new Set([
  '.git',
  '.venv',
  'node_modules',
  '__pycache__',
  '.atelier',
  '.env',
  '.DS_Store',
]);
function glob(pattern) {
  return new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
}
export class Repository {
  constructor(source) {
    this.source = source;
  }
  async open() {
    if (!this.source.entries.has('atelier.yaml'))
      throw Error('No atelier.yaml found at this revision');
    const manifest = yaml(await this.source.text('atelier.yaml'));
    if (
      !manifest ||
      manifest.version !== 1 ||
      (manifest.ignore !== undefined &&
        (!Array.isArray(manifest.ignore) || manifest.ignore.some((p) => typeof p !== 'string')))
    )
      throw Error('Expected an Atelier version 1 manifest with valid ignore patterns');
    const ignores = (manifest.ignore || []).map((pattern) => ({
      prefix: pattern.replace(/\/$/, ''),
      match: glob(pattern.replace(/\/$/, '')),
    }));
    this.paths = [...this.source.entries.keys()]
      .filter(
        (path) =>
          !path.split('/').some((p) => SKIP.has(p) || p.startsWith('.env')) &&
          !ignores.some(
            (p) =>
              p.match.test(path) || p.match.test(path + '/') || path.startsWith(p.prefix + '/'),
          ),
      )
      .sort();
    this.visible = new Set(this.paths);
    this.figures = [];
    this.issues = [];
    const manifests = this.paths.filter(
      (p) => p.startsWith('figures/') && p.endsWith('.figure.yaml'),
    );
    if (manifests.length > 100) throw Error('Repository exceeds the 100-figure reading limit');
    for (const path of manifests) {
      const source = path.replace(/\.figure.yaml$/, '.ts');
      const figure = {
        manifest: path,
        source,
        title: source.split('/').at(-1).replace(/\.ts$/, ''),
        available: false,
      };
      try {
        const value = yaml(await this.text(path));
        if (
          !value ||
          Object.keys(value).sort().join() !== 'data,rendered,source,takeaway,version' ||
          value.version !== 1 ||
          value.source !== source ||
          !Array.isArray(value.data) ||
          !value.data.length ||
          typeof value.takeaway !== 'string' ||
          !/^figures\/cache\/.+\.(svg|png)$/.test(value.rendered)
        )
          throw Error('Invalid figure manifest');
        for (const name of [value.source, value.rendered, ...value.data]) checkedPath(name);
        Object.assign(figure, value, { available: this.visible.has(value.rendered) });
        if (!figure.available) figure.error = 'Rendered cache is missing.';
      } catch (error) {
        figure.error = error.message;
      }
      this.figures.push(figure);
    }
    return this;
  }
  require(path) {
    checkedPath(path);
    if (!this.visible.has(path)) throw Error('File is missing or excluded from this repository');
  }
  text(path) {
    this.require(path);
    return this.source.text(path);
  }
  bytes(path, limit) {
    this.require(path);
    return this.source.bytes(path, limit);
  }
  async document(path) {
    return metadata(describe(await this.text(path), path));
  }
  async snapshot() {
    const work = [];
    for (const path of this.paths.filter(isWorkRecord)) {
      if (work.length >= 100) throw Error('Repository exceeds the 100-work-record reading limit');
      try { const {log_source, ...record} = parseWork(await this.text(path), path); work.push(record); }
      catch(error) { work.push({path,title:path.split('/').at(-1),status:'unknown',error:error.message}); }
    }
    const documents = [],
      tasks = [],
      issues = [...this.issues];
    let open = 0;
    const names = this.paths.filter(research);
    if (names.length > 300) throw Error('Repository exceeds the 300-document reading limit');
    // Limit concurrent requests and total document memory instead of reading all artifacts.
    let totalText = 0;
    for (let start = 0; start < names.length; start += 6) {
      const group = await Promise.all(
        names.slice(start, start + 6).map(async (path) => {
          try {
            const text = await this.text(path);
            totalText += text.length;
            if (totalText > 16 * 1024 * 1024)
              throw Error('Documents exceed the 16 MiB reading limit');
            return metadata(describe(text, path));
          } catch (error) {
            issues.push({ path, message: error.message });
            return null;
          }
        }),
      );
      if (totalText > 16 * 1024 * 1024) throw Error('Documents exceed the 16 MiB reading limit');
      for (const doc of group.filter(Boolean)) {
        const count = doc.threads.filter((t) => t.status === 'open').length;
        open += count;
        documents.push({
          path: doc.path,
          title: doc.title,
          open_threads: count,
          threads: doc.threads.length,
          tasks: doc.tasks.length,
        });
        tasks.push(...doc.tasks.map((task) => ({ ...task, document: doc.path })));
        issues.push(...doc.warnings.map((issue) => ({ ...issue, path: doc.path })));
      }
    }
    const directories = [
        ...new Set(
          this.paths.filter((p) => /^experiments\/[^/]+\//.test(p)).map((p) => p.split('/')[1]),
        ),
      ].sort(),
      experiments = [];
    for (const id of directories) {
      const prefix = `experiments/${id}`,
        tables = this.paths.filter((p) => p.startsWith(prefix + '/') && p.endsWith('.parquet'));
      const experiment = {
        id,
        readme: prefix + '/README.md',
        tables,
        status: tables.length ? 'Evidence available' : 'Not run',
        config: null,
        provenance: null,
      };
      for (const [field, name] of [
        ['config', 'config.yaml'],
        ['provenance', 'provenance.json'],
      ])
        if (this.visible.has(`${prefix}/${name}`))
          try {
            const text = await this.text(`${prefix}/${name}`);
            experiment[field] = field === 'config' ? yaml(text) : JSON.parse(text);
          } catch (error) {
            issues.push({ path: `${prefix}/${name}`, message: error.message });
          }
      experiments.push(experiment);
    }
    return {
      name: documents.find((d) => d.path === 'README.md')?.title || this.source.address.id,
      directory: this.source.address.id,
      git: { branch: this.source.address.revision, revision: this.source.commit.slice(0, 12) },
      documents,
      work,
      experiments,
      figures: this.figures,
      tasks,
      open_threads: open,
      issues,
      files: this.paths.filter((p) => /\.(md|py|ts|ya?ml|json|toml|txt|lock|parquet)$/.test(p)),
    };
  }
}
