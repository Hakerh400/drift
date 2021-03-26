'use strict';

const fs = require('fs');
const path = require('path');
const O = require('omikron');
const Theorem = require('./theorem');
const mathjax = require('./mathjax');
const dir = require('./dir');

await O.addStyle('style.css');

const thsDir = dir('theorems');
const thsFile = path.join(thsDir, 'theorems.txt');
const verifiedFile = path.join(thsDir, 'verified.txt');

const main = async () => {
  const ths = await loadThs();
  const ver = await loadVerified();

  for(const th of ths)
    if(O.has(ver, th.name))
      th.verified = 1;

  const table = O.ce(O.body, 'table');
  table.classList.add('ths-table');
  table.cellSpacing = 0;

  const tr = O.ce(table, 'tr');
  O.ce(tr, 'th').innerText = 'Name';
  O.ce(tr, 'th').innerText = 'Statement';
  O.ce(tr, 'th').innerText = 'Description';
  O.ce(tr, 'th').innerText = 'Tags';
  O.ce(tr, 'th').innerText = 'Verified';

  for(const th of ths){
    const tr = O.ce(table, 'tr');

    const name = O.ce(tr, 'td');
    name.style.fontFamily = 'monospace';
    name.innerText = th.name;

    const expr = O.ce(tr, 'td');
    expr.innerText = `$$${th.math}$$`;
    await mathjax.typeset(expr);

    const desc = O.ce(tr, 'td');
    desc.innerText = th.desc;

    const tags = O.ce(tr, 'td');
    tags.innerText = th.tags.join(', ');

    const verified = O.ce(tr, 'td');
    verified.classList.add('th-verified-cell');

    if(th.verified){
      verified.innerText = '\u2713';
      verified.classList.add('th-verified');
    }else{
      verified.innerText = 'X';
      verified.classList.add('th-non-verified');
    }
  }
};

const loadThs = async () => {
  const str = await O.rfs(thsFile, 1);
  if(str.length === 0) return [];

  return O.sanll(str).map(str => {
    const lines = O.sanl(str);
    const name = lines[0];
    const propStr = lines[1];
    const desc = lines[2];
    const tags = lines[3].slice(1, -1).split(', ');

    return new Theorem(name, propStr, desc, tags);
  });
};

const loadVerified = async () => {
  const str = await O.rfs(verifiedFile, 1);
  if(str.length === 0) return [];

  return O.arr2obj(O.sanl(str));
};

main().catch(log);