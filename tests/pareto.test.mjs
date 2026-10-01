import test from 'node:test';
import assert from 'node:assert/strict';
import { losses, trajectory, constrainedTrajectory, LOSS_SCALE } from '../static/js/pareto-math.js';
const settings = { angleDegrees: 45, displacement: 1.059, learningRate: .02 / LOSS_SCALE, steps: 200 };

test('one step agrees with finite-difference gradients of the weighted objective', () => {
  const alpha = .99, theta = Math.PI / 4, r = settings.displacement, h = 1e-6;
  const objective = (t, d) => { const [a, b] = losses(t, d); return a - alpha * b; };
  const dt = (objective(theta + h, r) - objective(theta - h, r)) / (2 * h);
  const dr = (objective(theta, r + h) - objective(theta, r - h)) / (2 * h);
  const next = trajectory(settings, alpha)[1];
  assert.ok(Math.abs(next.theta - (theta - settings.learningRate * dt)) < 1e-9);
  assert.ok(Math.abs(next.r - (r - settings.learningRate * dr)) < 1e-9);
});

test('nearby weights follow opposite directions and reduce the objective', () => {
  for (const alpha of [.99, 1.01]) {
    const run = trajectory(settings, alpha);
    assert.equal(run.length, 201);
    assert.ok(alpha < 1 ? run.at(-1).theta < run[0].theta : run.at(-1).theta > run[0].theta);
    assert.ok(run.at(-1).l1 - alpha * run.at(-1).l2 < run[0].l1 - alpha * run[0].l2);
    for (const point of run) assert.ok(Number.isFinite(point.l1) && Number.isFinite(point.l2));
  }
});

test('clipped angles have zero angular gradient outside the interval', () => {
  assert.deepEqual(losses(-1, 0), [0, LOSS_SCALE]);
  const run = trajectory({ ...settings, angleDegrees: -10 }, 1);
  assert.equal(run[0].theta, run[1].theta);
});

test('all exposed control extremes yield finite trajectories', () => {
  for (const alpha of [.09, 2.01]) for (const angleDegrees of [1, 89])
    for (const displacement of [0, 1.5]) for (const learningRate of [.005, .05]) {
      const run = trajectory({ ...settings, angleDegrees, displacement, learningRate }, alpha);
      assert.ok(run.every(p => Number.isFinite(p.l1) && Number.isFinite(p.l2)));
    }
});

const constrainedSettings = { ...settings, initialLambda: 1, learningRate: .001 / LOSS_SCALE,
  dualLearningRate: .01 / LOSS_SCALE, damping: 20 / LOSS_SCALE, steps: 15000 };

test('damped primal update matches the projected augmented objective gradient', () => {
  const epsilon = .3, h = 1e-6, theta = Math.PI / 4, r = settings.displacement;
  const objective = (t, d) => {
    const [a, b] = losses(t, d);
    const shifted = Math.max(0, 1 + constrainedSettings.damping * (epsilon - b));
    return a + (shifted ** 2 - 1) / (2 * constrainedSettings.damping);
  };
  const dt = (objective(theta + h, r) - objective(theta - h, r)) / (2 * h);
  const dr = (objective(theta, r + h) - objective(theta, r - h)) / (2 * h);
  const next = constrainedTrajectory({ ...constrainedSettings, steps: 1 }, epsilon)[1];
  assert.ok(Math.abs(next.theta - (theta - constrainedSettings.learningRate * dt)) < 1e-9);
  assert.ok(Math.abs(next.r - (r - constrainedSettings.learningRate * dr)) < 1e-9);
  assert.ok(next.lambda > 1, 'a violation raises the multiplier');
});

test('constrained runs reach the selected boundary and optimum across the slider range', () => {
  for (let hundredths = 27; hundredths <= 40; hundredths++) {
    const epsilon = hundredths / 100;
    const run = constrainedTrajectory(constrainedSettings, epsilon);
    assert.ok(run.every(p => Number.isFinite(p.l1 + p.l2 + p.lambda) && p.lambda >= 0));
    const end = run.at(-1);
    assert.ok(Math.abs(end.l2 - epsilon) < 3e-5);
    assert.ok(Math.abs(end.l1 - LOSS_SCALE * Math.sqrt(1 - (2 - epsilon / LOSS_SCALE) ** 2)) < 3e-5);
  }
});
