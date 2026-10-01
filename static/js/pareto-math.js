export const LOSS_SCALE = 0.3 / 1.29;

// Toy losses derived from the original JAX experiment. Adversary loss is
// 2 minus the original second cost, so higher means a weaker adversary.
export function losses(theta, r) {
  const angle = Math.max(0, Math.min(Math.PI / 2, theta));
  return [LOSS_SCALE * Math.sin(angle) * (1 + r * r), LOSS_SCALE * (2 - Math.cos(angle) * (1 + r * r))];
}

// Minimize task loss - alpha * adversary loss.
export function trajectory({ angleDegrees, displacement, learningRate, steps }, alpha) {
  let theta = angleDegrees * Math.PI / 180;
  let r = displacement;
  const points = [];
  for (let step = 0; step <= steps; step++) {
    const [l1, l2] = losses(theta, r);
    points.push({ theta, r, l1, l2, step });
    const angle = Math.max(0, Math.min(Math.PI / 2, theta));
    const angularGradient = theta < 0 || theta > Math.PI / 2 ? 0
      : (Math.cos(angle) - alpha * Math.sin(angle)) * (1 + r * r);
    const radialGradient = 2 * r * (Math.sin(angle) + alpha * Math.cos(angle));
    theta -= learningRate * LOSS_SCALE * angularGradient;
    r -= learningRate * LOSS_SCALE * radialGradient;
  }
  return points;
}

// Projected, damped multiplier updates for min task loss subject to
// adversary loss >= epsilon. Scalar feedback uses the augmented Lagrangian.
export function constrainedTrajectory(settings, epsilon) {
  let theta = settings.angleDegrees * Math.PI / 180;
  let r = settings.displacement;
  let lambda = settings.initialLambda;
  const points = [];
  for (let step = 0; step <= settings.steps; step++) {
    const [l1, l2] = losses(theta, r);
    const violation = epsilon - l2;
    const weight = Math.max(0, lambda + settings.damping * violation);
    points.push({ theta, r, l1, l2, lambda, weight, step });
    if (step === settings.steps) break;
    const angle = Math.max(0, Math.min(Math.PI / 2, theta));
    const dt = (Math.cos(angle) - weight * Math.sin(angle)) * (1 + r * r);
    const dr = 2 * r * (Math.sin(angle) + weight * Math.cos(angle));
    theta = Math.max(0, Math.min(Math.PI / 2, theta - settings.learningRate * LOSS_SCALE * dt));
    r -= settings.learningRate * LOSS_SCALE * dr;
    lambda = Math.max(0, lambda + settings.dualLearningRate * violation);
  }
  return points;
}
