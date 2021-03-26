'use strict';

const fs = require('fs');
const path = require('path');
const O = require('omikron');
const dir = require('./dir');

const LOCAL = O.url.startsWith('http://localhost/');

const scriptSrc = LOCAL ?
  dir('data/mathjax.js') :
  'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

const load = async () => {
  const sem = new O.Semaphore(0);

  window.MathJax = {
    options: {
      enableMenu: 0,
    },
    tex: {
      inlineMath: [['$', '$']],
      displayMath: [['$$', '$$']],
    },
    startup: {
      pageReady: () => {
        sem.signal();
      },
    },
  };

  const script = ce('script');

  script.src = scriptSrc;
  O.head.appendChild(script);

  await sem.wait();
};

const math2div = async (str, display=0, fontSize=20) => {
  const div = ce('div');
  div.style.fontSize = `${fontSize}px`

  div.innerText = display ? `$$${str}$$` : `$${str}$`;
  await typeset(div);

  return div;
};

const typeset = async elems => {
  if(!O.isArr(elems))
    elems = [elems];

  await MathJax.typesetPromise(elems);
};

const ce = tag => {
  return O.doc.createElement(tag);
};

await load();

module.exports = {
  math2div,
  typeset,
};