'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const drift = require('..');

const {Database} = drift;

const main = () => {
  // const info = O.rec(drift.reduceIdent, 'main');
  // const str = O.rec(drift.info2str, info);

  drift.verify('th.prop.impl.refl');

  // log(str);
};

main();