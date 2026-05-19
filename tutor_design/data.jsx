/* data.jsx — sample IB AA HL content. KaTeX strings use $...$ for inline. */

const TOPICS = [
  {
    id: 'na', name: 'Number & Algebra', mastery: 0.62,
    subtopics: [
      { id: 'na-seq',  name: 'Sequences & Series',     mastery: 0.71, questions: 42, last: '3d ago' },
      { id: 'na-exp',  name: 'Exponents & Logarithms', mastery: 0.58, questions: 38, last: '6d ago' },
      { id: 'na-cmx',  name: 'Complex Numbers',         mastery: 0.49, questions: 51, last: '1d ago' },
      { id: 'na-pf',   name: 'Proof by Induction',      mastery: 0.66, questions: 24, last: '9d ago' },
      { id: 'na-bin',  name: 'Binomial Theorem',        mastery: 0.70, questions: 28, last: '4d ago' },
    ],
  },
  {
    id: 'fn', name: 'Functions', mastery: 0.78,
    subtopics: [
      { id: 'fn-quad', name: 'Quadratics & Discriminants', mastery: 0.84, questions: 36, last: '2w ago' },
      { id: 'fn-rat',  name: 'Rational Functions',          mastery: 0.72, questions: 31, last: '1w ago' },
      { id: 'fn-trf',  name: 'Transformations',             mastery: 0.81, questions: 27, last: '5d ago' },
      { id: 'fn-inv',  name: 'Inverse & Composite',         mastery: 0.74, questions: 22, last: '8d ago' },
    ],
  },
  {
    id: 'gt', name: 'Geometry & Trigonometry', mastery: 0.55,
    subtopics: [
      { id: 'gt-trig', name: 'Trigonometric Identities', mastery: 0.51, questions: 44, last: '2d ago' },
      { id: 'gt-vec',  name: 'Vectors in 3D',             mastery: 0.43, questions: 39, last: '11d ago' },
      { id: 'gt-cir',  name: 'Circular Functions',        mastery: 0.68, questions: 26, last: '6d ago' },
    ],
  },
  {
    id: 'sp', name: 'Statistics & Probability', mastery: 0.69,
    subtopics: [
      { id: 'sp-dist', name: 'Discrete Distributions', mastery: 0.74, questions: 33, last: '1w ago' },
      { id: 'sp-norm', name: 'Normal Distribution',     mastery: 0.62, questions: 41, last: '4d ago' },
      { id: 'sp-bayes',name: 'Conditional Probability', mastery: 0.71, questions: 29, last: '12d ago' },
    ],
  },
  {
    id: 'ca', name: 'Calculus', mastery: 0.74,
    subtopics: [
      { id: 'ca-lim',  name: 'Limits & Continuity',        mastery: 0.80, questions: 22, last: '3w ago' },
      { id: 'ca-der',  name: 'Derivatives',                mastery: 0.78, questions: 64, last: 'today' },
      { id: 'ca-app',  name: 'Applications of Derivatives', mastery: 0.65, questions: 47, last: '2d ago' },
      { id: 'ca-int',  name: 'Integration Techniques',     mastery: 0.72, questions: 53, last: '1d ago' },
      { id: 'ca-de',   name: 'Differential Equations',     mastery: 0.59, questions: 31, last: '5d ago' },
    ],
  },
];

/* Active session queue — six questions, mixed types, mixed topics. */
const SESSION = [
  {
    id: 'q1',
    type: 'free_expression',
    topic: 'Calculus', subtopic: 'Derivatives',
    stem: 'Differentiate $f(x) = x^2 \\sin x$ with respect to $x$.',
    answer: '2x \\sin x + x^2 \\cos x',
    answerDisplay: '2x\\sin x + x^2\\cos x',
    altForms: ['x^2 \\cos x + 2x \\sin x', 'x(2\\sin x + x\\cos x)'],
    hints: [
      'Recall what the Product Rule says about the derivative of two functions multiplied together.',
      'Let $u = x^2$ and $v = \\sin x$. What are $u\'$ and $v\'$ individually?',
      [
        { line: 'Apply the Product Rule: $\\dfrac{d}{dx}[uv] = u\'v + uv\'$.' },
        { line: 'Let $u = x^2 \\Rightarrow u\' = 2x$, and $v = \\sin x \\Rightarrow v\' = \\cos x$.' },
        { line: 'Substitute: $f\'(x) = (2x)(\\sin x) + (x^2)(\\cos x)$.' },
        { line: 'Therefore $f\'(x) = 2x\\sin x + x^2\\cos x.$' },
      ],
    ],
    concept: { id: 'product-rule', name: 'Product Rule' },
    note: 'The commutative form $x^2\\cos x + 2x\\sin x$ is equally valid.',
  },
  {
    id: 'q2',
    type: 'multiple_choice',
    topic: 'Calculus', subtopic: 'Integration Techniques',
    stem: 'Evaluate $\\displaystyle \\int_0^{\\pi/2} \\cos x \\, dx$.',
    options: [
      { id: 'A', tex: '0' },
      { id: 'B', tex: '\\dfrac{1}{2}' },
      { id: 'C', tex: '1' },
      { id: 'D', tex: '\\dfrac{\\pi}{2}' },
    ],
    correct: 'C',
    hints: [
      'Recall that the antiderivative of $\\cos x$ is a standard result.',
      'Evaluate $[\\sin x]_0^{\\pi/2}$. What does $\\sin(\\pi/2)$ equal?',
      [
        { line: '$\\int \\cos x \\, dx = \\sin x + C.$' },
        { line: 'Apply the Fundamental Theorem of Calculus: $\\big[\\sin x\\big]_0^{\\pi/2} = \\sin(\\pi/2) - \\sin(0).$' },
        { line: '$\\sin(\\pi/2) = 1$ and $\\sin(0) = 0$, so the integral equals $1.$' },
      ],
    ],
    concept: { id: 'ftc', name: 'Fundamental Theorem of Calculus' },
  },
  {
    id: 'q3',
    type: 'flashcard',
    topic: 'Calculus', subtopic: 'Derivatives',
    front: { kind: 'term', text: 'Product Rule' },
    back:  { kind: 'tex',  tex:  '(uv)\' = u\'v + uv\'' },
    concept: { id: 'product-rule', name: 'Product Rule' },
  },
  {
    id: 'q4',
    type: 'ordered_steps',
    topic: 'Number & Algebra', subtopic: 'Complex Numbers',
    stem: 'Arrange the steps to solve $z^2 + 4z + 13 = 0$ for $z \\in \\mathbb{C}.$',
    steps: [
      { id: 's1', tex: 'z^2 + 4z + 13 = 0' },
      { id: 's2', tex: 'z = \\dfrac{-4 \\pm \\sqrt{16 - 52}}{2}' },
      { id: 's3', tex: 'z = \\dfrac{-4 \\pm \\sqrt{-36}}{2}' },
      { id: 's4', tex: 'z = \\dfrac{-4 \\pm 6i}{2}' },
      { id: 's5', tex: 'z = -2 \\pm 3i' },
    ],
    hints: [
      'Begin by applying the quadratic formula.',
      'The discriminant is negative — interpret $\\sqrt{-36}$ in terms of $i$.',
      [
        { line: 'Apply the quadratic formula with $a=1, b=4, c=13$.' },
        { line: 'Compute the discriminant: $b^2 - 4ac = 16 - 52 = -36$.' },
        { line: 'Write $\\sqrt{-36} = 6i$ and simplify.' },
        { line: 'The two roots are $z = -2 + 3i$ and $z = -2 - 3i$.' },
      ],
    ],
  },
  {
    id: 'q5',
    type: 'free_expression',
    topic: 'Calculus', subtopic: 'Limits & Continuity',
    stem: 'Evaluate $\\displaystyle \\lim_{x \\to 0} \\dfrac{\\sin x}{x}.$',
    answer: '1',
    answerDisplay: '1',
    hints: [
      'This is one of the foundational limits in calculus — you should know it by heart.',
      'Use either L\'Hôpital\'s Rule or the squeeze theorem.',
      [
        { line: 'Both numerator and denominator approach $0$ as $x \\to 0$, so this is the indeterminate form $0/0$.' },
        { line: 'By L\'Hôpital\'s Rule: $\\displaystyle \\lim_{x\\to 0}\\dfrac{\\sin x}{x} = \\lim_{x\\to 0}\\dfrac{\\cos x}{1}.$' },
        { line: 'Evaluating: $\\cos(0) = 1.$ Therefore the limit equals $1.$' },
      ],
    ],
  },
  {
    id: 'q6',
    type: 'free_numeric',
    topic: 'Calculus', subtopic: 'Derivatives',
    stem: 'If $f(x) = e^{2x}$, find $f\'(0).$',
    answer: 2,
    hints: [
      'Recall the Chain Rule for $\\dfrac{d}{dx}[e^{g(x)}].$',
      'Differentiate then substitute $x = 0.$',
      [
        { line: '$f(x) = e^{2x} \\Rightarrow f\'(x) = 2e^{2x}$ by the Chain Rule.' },
        { line: 'Substitute $x = 0$: $f\'(0) = 2 \\cdot e^0 = 2 \\cdot 1 = 2.$' },
      ],
    ],
  },
];

/* Recent sessions list */
const RECENT = [
  { id: 1, date: 'Yesterday', topic: 'Derivatives',         questions: 14, correct: 11, mins: 22 },
  { id: 2, date: '3 days ago', topic: 'Complex Numbers',     questions: 12, correct: 7,  mins: 31 },
  { id: 3, date: '4 days ago', topic: 'Integration',         questions: 15, correct: 13, mins: 28 },
  { id: 4, date: '5 days ago', topic: 'Trig Identities',     questions: 10, correct: 6,  mins: 19 },
  { id: 5, date: 'A week ago',  topic: 'Normal Distribution', questions: 12, correct: 9,  mins: 24 },
];

const WEAK = [
  { id: 'gt-vec',  name: 'Vectors in 3D',           topic: 'Geometry & Trig',     mastery: 0.43 },
  { id: 'na-cmx',  name: 'Complex Numbers',          topic: 'Number & Algebra',    mastery: 0.49 },
  { id: 'gt-trig', name: 'Trigonometric Identities', topic: 'Geometry & Trig',     mastery: 0.51 },
  { id: 'na-exp',  name: 'Exponents & Logarithms',   topic: 'Number & Algebra',    mastery: 0.58 },
];

/* Concept content — the Product Rule (linked from hint Tier 1 and chat pill). */
const CONCEPTS = {
  'product-rule': {
    id: 'product-rule',
    name: 'Product Rule',
    kind: 'Theorem',
    topic: 'Calculus → Derivatives',
    statement: 'If $u(x)$ and $v(x)$ are differentiable at $x$, then their product is differentiable at $x$, and',
    statementDisplay: '\\dfrac{d}{dx}\\big[u(x)\\,v(x)\\big] \\;=\\; u\'(x)\\,v(x) \\;+\\; u(x)\\,v\'(x).',
    derivation: [
      { line: 'Begin from the limit definition: $\\displaystyle \\lim_{h\\to 0}\\dfrac{u(x+h)v(x+h) - u(x)v(x)}{h}.$' },
      { line: 'Add and subtract $u(x+h)v(x)$ in the numerator:' },
      { line: '$\\displaystyle \\lim_{h\\to 0}\\dfrac{u(x+h)\\big[v(x+h) - v(x)\\big] + v(x)\\big[u(x+h) - u(x)\\big]}{h}.$' },
      { line: 'Splitting the limit and using continuity of $u$ at $x$: $u(x)\\,v\'(x) + v(x)\\,u\'(x).$' },
    ],
    examples: [
      {
        title: 'Differentiate $f(x) = x^2 \\sin x$',
        steps: [
          'Let $u = x^2,\\; v = \\sin x$. Then $u\' = 2x,\\; v\' = \\cos x.$',
          'Apply the rule: $f\'(x) = u\'v + uv\' = 2x\\sin x + x^2\\cos x.$',
        ],
      },
      {
        title: 'Differentiate $g(x) = (3x+1)\\,e^x$',
        steps: [
          'Let $u = 3x+1,\\; v = e^x$. Then $u\' = 3,\\; v\' = e^x.$',
          'Apply the rule: $g\'(x) = 3e^x + (3x+1)e^x = (3x+4)e^x.$',
        ],
      },
    ],
    related: [
      { id: 'chain-rule', name: 'Chain Rule' },
      { id: 'quotient-rule', name: 'Quotient Rule' },
      { id: 'sum-rule', name: 'Sum Rule for Derivatives' },
    ],
    testedBy: [
      'Differentiate $x^2 \\sin x$',
      'Differentiate $(2x+3)\\ln x$',
      'Find $\\dfrac{d}{dx}\\big[e^x \\cos x\\big]$',
      'Show that $\\dfrac{d}{dx}\\big[x^n \\ln x\\big] = x^{n-1}(n\\ln x + 1)$',
    ],
  },
};

/* Streak heatmap — 12 weeks of "activity" 0..4 */
const STREAK_DAYS = (() => {
  const seed = [
    3,2,4,3,1,2,0,
    4,3,2,4,2,3,1,
    2,3,3,4,1,0,2,
    3,2,4,4,3,1,0,
    1,2,3,2,4,3,2,
    0,3,4,2,1,3,2,
    2,3,4,3,2,1,4,
    3,2,4,3,2,4,3,
    1,3,2,4,3,2,1,
    2,4,3,2,3,4,2,
    3,3,2,4,3,2,4,
    4,3,2,3,4,3,3,
  ];
  return seed;
})();

/* Initial chat conversation seed */
const CHAT_SEED = [
  { id: 'm1', role: 'user',      text: 'I always forget the product rule. What\'s the easiest way to remember it?' },
  { id: 'm2', role: 'assistant',
    text: 'The classic chant is "first times derivative of second, plus second times derivative of first." Mathematically:',
    block: '(uv)\' = u\'v + uv\'',
    after: 'Both terms are needed because each function contributes a rate of change. If you only differentiated one, you\'d be treating the other as a constant — which it isn\'t.',
    pills: [{ id: 'product-rule', label: 'Product Rule' }],
  },
  { id: 'm3', role: 'user',      text: 'And when does the chain rule come in instead?' },
  { id: 'm4', role: 'assistant',
    text: 'Different structure. Product Rule: two functions multiplied. Chain Rule: one function nested inside another. For example, $f(g(x))$ is chain, $f(x) \\cdot g(x)$ is product.',
    pills: [{ id: 'chain-rule', label: 'Chain Rule' }],
  },
];

Object.assign(window, { TOPICS, SESSION, RECENT, WEAK, CONCEPTS, STREAK_DAYS, CHAT_SEED });
