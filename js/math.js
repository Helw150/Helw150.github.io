// Mistune preserves TeX in math spans/blocks; typeset only authored math.
for (const element of document.querySelectorAll('.blog-content .math')) {
  renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
    throwOnError: false,
    trust: false,
    output: 'htmlAndMathml',
  });
}
