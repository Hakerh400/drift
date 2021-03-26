'use strict';

const fs = require('fs');
const path = require('path');
const O = require('omikron');

const cwd = __dirname;
const mainDir = path.join(cwd, '../../..');

const dir = (...args) => {
  return path.join(mainDir, ...args);
};

module.exports = dir;