'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

const objIdentSym = O.obj();

const hasIdent = ident => {
  return O.has(objIdentSym, ident);
};

const ident2sym = ident => {
  if(hasIdent(ident))
    return objIdentSym[ident];

  const sym = Symbol(ident);
  objIdentSym[ident] = sym;

  return sym;
};

module.exports = ident2sym;