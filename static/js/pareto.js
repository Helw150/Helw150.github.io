import { trajectory, constrainedTrajectory, LOSS_SCALE } from './pareto-math.js';

export function render(element, defaults) {
  const d3 = window.d3;
  const state = { ...defaults };
  element.replaceChildren();
  const controls = d3.select(element).append('div').attr('class', 'figure-controls');
  const constrained = defaults.mode === 'constrained';
  const fields = constrained
    ? [['epsilon', 'ε · Constraint', 0.27, 0.40, 0.01]]
    : [['lambda', 'λ · Loss weight', 0.1, 2, 0.01]];
  const inputs = [];
  for (const [key, label, min, max, step] of fields) {
    const field = controls.append('label');
    const caption = field.append('span');
    const output = caption.append('output');
    caption.insert('span', 'output').text(`${label} `);
    const input = field.append('input').attr('type', 'range').attr('min', min)
      .attr('max', max).attr('step', step).attr('aria-label', label).property('value', state[key]);
    const updateOutput = () => output.text(state[key].toFixed(2));
    input.on('input', (event) => {
      state[key] = Number(event.target.value);
      updateOutput();
      draw();
    });
    updateOutput();
    inputs.push({ key, input, updateOutput });
  }
  controls.append('button').attr('type', 'button').text('Reset').on('click', () => {
    Object.assign(state, defaults);
    for (const field of inputs) {
      field.input.property('value', state[field.key]);
      field.updateOutput();
    }
    draw();
  });
  const svg = d3.select(element).append('svg').attr('viewBox', '0 0 620 370')
    .attr('role', 'img').attr('aria-label', constrained ? 'Actual damped multiplier trajectory toward a constraint' : 'Fixed-weight trajectory controlled by lambda');
  svg.append('title').text('Loss weight versus constraint on a concave Pareto front');
  const plot = svg.append('g').attr('transform', 'translate(85,20)');
  let width = 450, height = 290;
  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleLinear().range([height, 0]);
  const xAxis = plot.append('g').attr('transform', `translate(0,${height})`);
  const yAxis = plot.append('g');
  const xLabel = plot.append('text').attr('x', width / 2).attr('y', height + 46).attr('text-anchor', 'middle').text('Task loss (lower is better)');
  const yLabel = plot.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -47)
    .attr('text-anchor', 'middle').text('Adversary loss (higher is better)');
  const front = d3.range(121).map(i => ({ l1: LOSS_SCALE * Math.sin(i / 120 * Math.PI / 2), l2: LOSS_SCALE * (2 - Math.cos(i / 120 * Math.PI / 2)) }));
  const line = d3.line().x(p => x(p.l1)).y(p => y(p.l2));
  const frontier = plot.append('path').attr('fill', 'none').attr('stroke', '#444').attr('stroke-width', 1);
  const constraint = plot.append('line').attr('stroke', '#bbb').attr('stroke-width', .7).attr('stroke-dasharray', '3 4');
  const optimum = plot.append('circle').attr('r', 3).attr('fill', 'white').attr('stroke', '#555').attr('stroke-width', 1);
  const optimumTitle = optimum.append('title');
  const colors = ['var(--accent)'];
  const paths = colors.map(color => plot.append('path').attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round'));
  const markers = colors.map(color => plot.append('circle').attr('r', 2.5).attr('fill', color));
  const labels = colors.map(color => plot.append('text').attr('fill', color));
  const frontLabel = plot.append('text').attr('fill', '#666').text('Pareto front');
  const constraintLabel = plot.append('text').attr('fill', '#777');
  const optimumLabel = plot.append('text').attr('fill', '#666').text('Constrained optimum');

  function draw() {
    const weights = [state.lambda];
    const runs = constrained ? [constrainedTrajectory(state, state.epsilon)] : weights.map(alpha => trajectory(state, alpha));
    // Use the same loss range on both axes.
    const maximum = Math.max(2.1 * LOSS_SCALE, d3.max(runs.flat(), p => Math.max(p.l1, p.l2)) * 1.08);
    x.domain([0, maximum]);
    y.domain([0, maximum]);
    xAxis.call(d3.axisBottom(x).ticks(4).tickSize(3).tickSizeOuter(0));
    yAxis.call(d3.axisLeft(y).ticks(4).tickSize(3).tickSizeOuter(0));
    plot.selectAll('.domain').remove();
    plot.selectAll('.tick line').attr('stroke', '#aaa').attr('stroke-width', .6);
    plot.selectAll('.tick text').attr('fill', '#777');
    frontier.attr('d', line(front));
    const epsilon = state.epsilon;
    const optimalL1 = LOSS_SCALE * Math.sqrt(1 - (2 - epsilon / LOSS_SCALE) ** 2);
    constraint.attr('x1', 0).attr('x2', width).attr('y1', y(epsilon)).attr('y2', y(epsilon));
    optimum.attr('cx', x(optimalL1)).attr('cy', y(epsilon));
    optimumTitle.text(`Constraint optimum: Task = ${optimalL1.toFixed(3)}, Adversary = ${epsilon.toFixed(3)}`);
    const annotations = [];
    runs.forEach((run, i) => {
      const visible = run;
      const end = visible.at(-1);
      paths[i].attr('d', line(visible)).attr('stroke-dasharray', i ? '5 3' : null);
      markers[i].attr('cx', x(end.l1)).attr('cy', y(end.l2));
      labels[i].text(constrained ? 'Learned weight' : `λ = ${weights[i].toFixed(2)}`);
      annotations.push({ label: labels[i], point: [x(end.l1), y(end.l2)] });
    });
    constraintLabel.text(`Adversary ≥ ${epsilon.toFixed(2)}`);
    annotations.unshift({ label: constraintLabel, point: [width, y(epsilon)] });
    annotations.push(
      { label: optimumLabel, point: [x(optimalL1), y(epsilon)] },
      { label: frontLabel, point: [x(.32 * LOSS_SCALE), y(LOSS_SCALE * (2 - Math.sqrt(1 - .32 ** 2)))] }
    );
    placeLabels(annotations);
  }

  // Reposition annotations on every update, using actual SVG text and line geometry.
  function placeLabels(annotations) {
    const points = [];
    for (const path of [frontier, ...paths]) {
      const node = path.node();
      const length = node.getTotalLength();
      for (let distance = 0; distance <= length; distance += 2) {
        const point = node.getPointAtLength(distance);
        points.push([point.x, point.y]);
      }
    }
    const constraintY = Number(constraint.attr('y1'));
    for (let px = 0; px <= width; px += 2) points.push([px, constraintY]);
    for (const marker of [optimum, ...markers]) {
      points.push([Number(marker.attr('cx')), Number(marker.attr('cy'))]);
    }
    const occupied = [];
    for (const { label, point: [px, py] } of annotations) {
      if (label.style('display') === 'none') continue;
      label.attr('x', 0).attr('y', 0);
      const text = label.node().getBBox();
      const candidates = [];
      // Find the nearest clear rectangle, keeping text inside the plot and off ticks.
      for (let left = 8; left + text.width <= width - 8; left += 8) {
        for (let top = 8; top + text.height <= height - 24; top += 8) {
          const right = left + text.width, bottom = top + text.height;
          const dx = Math.max(left - px, 0, px - right);
          const dy = Math.max(top - py, 0, py - bottom);
          candidates.push({ left, top, right, bottom, distance: Math.hypot(dx, dy) });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      const clear = candidates.find(box =>
        !points.some(([x, y]) => x >= box.left - 6 && x <= box.right + 6 && y >= box.top - 6 && y <= box.bottom + 6) &&
        !occupied.some(other => box.left < other.right + 8 && box.right > other.left - 8 && box.top < other.bottom + 8 && box.bottom > other.top - 8)
      );
      // Dense configurations may have no room; the caption still explains the marks.
      label.attr('visibility', clear ? null : 'hidden');
      if (clear) {
        label.attr('x', clear.left - text.x).attr('y', clear.top - text.y);
        occupied.push(clear);
      }
    }
  }
  function layout() {
    const compact = element.clientWidth < 450;
    width = compact ? 280 : 450;
    height = compact ? 230 : 290;
    svg.attr('viewBox', compact ? '0 0 390 310' : '0 0 620 370').style('font-size', compact ? '16px' : '12px');
    frontLabel.style('display', compact ? 'none' : null);
    optimumLabel.style('display', compact ? 'none' : null);
    plot.attr('transform', compact ? 'translate(55,20)' : 'translate(85,20)');
    x.range([0, width]);
    y.range([height, 0]);
    xAxis.attr('transform', `translate(0,${height})`);
    xLabel.attr('x', width / 2).attr('y', height + 46).text(compact ? 'Task loss ↓' : 'Task loss (lower is better)');
    yLabel.attr('x', -height / 2).text(compact ? 'Adversary loss ↑' : 'Adversary loss (higher is better)');
    draw();
  }
  layout();
  document.fonts.ready.then(layout);
  new ResizeObserver(layout).observe(element);
}
