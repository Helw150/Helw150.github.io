// Keep figure implementations separate from content and load only what is used.
const renderers = { pareto: () => import('./pareto.js') };
for (const element of document.querySelectorAll('[data-d3-renderer]')) {
  try {
    const load = renderers[element.dataset.d3Renderer];
    if (!load) throw new Error('Unknown figure renderer');
    const response = await fetch(element.dataset.d3Src);
    if (!response.ok) throw new Error(`Figure data returned ${response.status}`);
    const data = await response.json();
    const { render } = await load();
    render(element, data);
  } catch (error) {
    element.textContent = 'This figure could not load. Please reload the page to try again.';
    console.error(error);
  }
}
