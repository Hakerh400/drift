'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const drift = require('..');

const {Database} = drift;

const main = () => {
  const {db} = drift;

  const t = O.now;
  const info = O.rec(drift.reduceIdent, 'main');
  const dt = O.now - t;

  const str = O.rec(drift.info2str, info);

  log(str);
  
  log();
  log(db.size);
  log();
  log((dt / 1e3).toFixed(3));

  db.persist(info);
  
  // db.save();
  // const db = Database.load();
  // db.insert(info);
  // db.save();

  // const arr = db.getInfo(drift.ident2sym('th.prop.impl.refl')).reducedTo.reducedFrom;

  // log();
  // log(arr.map(a => O.rec(drift.info2str, a)).reverse().join('\n'))
};

main();