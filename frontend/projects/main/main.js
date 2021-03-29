'use strict';

const fs = require('fs');
const path = require('path');
const O = require('omikron');
const Theorem = require('./theorem');
const mathjax = require('./mathjax');
const dir = require('./dir');

await O.addStyle('style.css');

const MAX_THS_NUM = null;

const thsDir = dir('theorems');
const thsFile = path.join(thsDir, 'theorems.txt');
const verifiedFile = path.join(thsDir, 'verified.txt');

const main = async () => {
  const ths = await loadThs();
  const verified = await loadVerified();

  for(const th of ths)
    if(O.has(verified, th.name))
      th.verified = 1;

  if(ths.length !== 0 && O.last(ths).name === 'test'){
    const last = O.last(ths);
    ths.length = 0;
    ths.push(last);
  }

  const center = O.ce(O.body, 'center');
  const table = O.ce(center, 'table');
  table.classList.add('ths-table');
  table.cellSpacing = 0;

  const tr = O.ce(table, 'tr');
  O.ce(tr, 'th').innerText = 'Theorem';
  O.ce(tr, 'th').innerText = 'Statement';
  O.ce(tr, 'th').innerText = 'Description';
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
    desc.classList.add('desc');
    desc.innerText = th.desc;

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
  let thsInfo = O.sanll(str, 0);

  if(MAX_THS_NUM !== null)
    thsInfo = thsInfo.slice(-MAX_THS_NUM);

  return thsInfo.map(str => {
    const lines = O.sanl(str);
    const name = lines[0];
    const propStr = lines[1];
    const desc = lines[2];

    return new Theorem(name, propStr, desc);
  });
};

const loadVerified = async () => {
  const str = await O.rfs(verifiedFile, 1);
  return O.arr2obj(O.sanl(str, 0));
};

main().catch(log);