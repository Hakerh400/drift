'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Expr = require('./expr');

const pidents = {
  'a.': '\\varphi',
  'b.': '\\psi',
  'c.': '\\chi',
  'd.': '\\theta',
};

const precs = {
  impl: 10,
  neg: 10,
};

const expr2math = expr => {
  const expr2math = function*(expr, prec=-1){
    if(expr.isSym){
      const {name} = expr;

      if(O.has(pidents, name))
        return pidents[name];

      assert.fail();
      return;
    }

    const {baseSym} = expr;
    const prec1 = precs[baseSym];
    const args = Expr.expr2args(expr);
    const argsNum = args.length;

    const disambiguate = str => {
      if(prec > prec1) return `(${str})`;
        return str;
    };

    if(baseSym === 'impl'){
      assert(argsNum === 2);
      return disambiguate(`${
        yield [expr2math, args[0], prec1 + 1]} \\to ${
        yield [expr2math, args[1], prec1]}`);
    }

    if(baseSym === 'pnot'){
      assert(argsNum === 1);
      return disambiguate(`\\lnot ${
        yield [expr2math, args[0], prec1]}`);
    }

    assert.fail();
  };

  return O.rec(expr2math, expr);
};

const str2math = str => {
  const expr = Expr.parse(str);
  return expr2math(expr);
};

module.exports = {
  expr2math,
  str2math,
};