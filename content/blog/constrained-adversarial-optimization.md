---
title: "Making predictions language agnostic"
slug: constrained-adversarial-optimization
date: 2026-09-30
published: true
summary: "One of my favorite tricks for improving linguistic robustness without extra labeled data"
---
Suppose we want to guarantee that a model takes the same actions when it receives the same sentence translated into different languages. There are lots of reasons this could be useful, but one is that it lets you [transfer knowledge across languages](https://arxiv.org/html/2212.08054v2)! 

By default, this guarantee does not hold. Instead, models tend to learn features that aren't very useful for the task but cause it to behave differently in different languages. So we want to come up with an extra term, an auxiliary loss, that encourages language-independent behavior. One particular form of auxiliary loss that has strong guarantees is [adversarial learning](https://arxiv.org/html/1801.07593).

While the model learns the task, we train a second classifier, an *adversary*, to predict the language from the features the model learns. The model learns to do the task while also fooling this adversary. If no adversary can distinguish languages at better than chance, the features carry no information about which group a request came from. Now, if the models actions  are conditioned only on those features, the translated requests produce the same actions.

The usual approach to adversarial learning is to choose a weight $\lambda$ for the auxiliary adversarial loss. The model minimizes:

$$
L_{\mathrm{task}} - \lambda L_{\mathrm{adv}}
$$

Here $L_{\mathrm{task}}$ measures task prediction errors, and $L_{\mathrm{adv}}$ measures language prediction errors. The model tries to lower the first and raise the second; $\lambda$ controls the balance. How should we set $\lambda$ such that the model achieves both good results and fools the adversary?

{{d3: pareto.json | renderer="pareto" | title="Set the weight and hope" | caption="Move λ just below and above 1. A small change sends training toward opposite ends of the curve: either missing the limit or sacrificing more task performance than necessary. The open circle marks the desired tradeoff."}}

As you might see from the figure above, choosing $\lambda$ is hard since the correct value is on a knife's edge. Push too little against the adversary and the model ignores it; push too hard and the task suffers. In a real setting the adversary is itself dynamic and learning, so we often have to push different amounts at different points of training! There's no good way to set $\lambda$ without running lots of hyperparameter tuning experiments.

A cleaner solution lies conveniently in constrained optimization. Since we have a goal in mind, a 50-50 guess for the adversary, we can define the adversary’s loss when this occurs as a constraint $\varepsilon$ and write the objective as:

$$
\mathcal{L}=L_{\mathrm{task}}+\lambda(\varepsilon-L_{\mathrm{adv}})
$$

Now, rather than setting $\lambda$, we learn it with gradient ascent. The model minimizes this expression, while $\lambda$ maximizes it:

$$
\lambda \leftarrow \max\!\left(0,\;\lambda+\eta_{\lambda}(\varepsilon-L_{\mathrm{adv}})\right)
$$

When the adversary is good at guessing and the constraint is violated, $\lambda$ rises. When adversary loss exceeds the target, $\lambda$ decreases, easing the pressure on the model. If it reaches zero, the model only optimizes the downstream task. 

Conveniently, we can do this whole optimization process in a single backpropagation pass by simply inverting the gradient at boundaries so it has minimal overhead! We reuse the same losses and gradients, adding just $\lambda$ as a learned parameter which we force to be non-negative.

The second figure uses this update: the weight rises when adversary loss falls below $\varepsilon$. 

{{d3: constrained.json | renderer="pareto" | title="Choose the limit, learn the weight" | caption="The blue path is the simulated training trajectory. The open circle marks the best point on the curve that meets the limit."}}

In practice, I've repeatedly found this trick quite useful. While it technically has more hyperparameters, trading $\lambda$ for $\varepsilon$ and $\eta_{\lambda}$, $\varepsilon$ can be set from theory without experiments and $\eta_{\lambda}$ dictates the efficiency with which your model converges rather than whether it converges at all.

So if you find yourself tuning a series of loss weights, consider constrained optimization!

Thanks to [Christopher Hidey](https://www.cs.columbia.edu/~chidey/) for introducing me to Jonas Degrave and Ira Korshunova’s [How we can make machine learning algorithms tunable](https://www.engraved.blog/how-we-can-make-machine-learning-algorithms-tunable/) which taught me this trick and explains it in much more depth.
