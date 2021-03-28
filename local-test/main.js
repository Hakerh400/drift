'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const drift = require('..');

const {Database} = drift;

const main = () => {
  // drift.verifyAll(1);
  drift.verify('test', 1);
};

main();