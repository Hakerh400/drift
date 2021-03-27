'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Expr = require('./expr');

const pidents = {
  'phi': '\\varphi',
  'psi': '\\psi',
  'chi': '\\chi',
  'theta': '\\theta',
};

const idents = {
  'a.': 'a',
  'b.': 'b',
  'c.': 'c',
  'd.': 'd',
};

const ops = [
  'impl',
  'pnot',
  'pelem',
  'forall',
];

const precs = O.obj();

ops.forEach((op, index) => {
  precs[op] = index << 1;
});

const precMin = -1;
const precMax = O.N;

const expr2math = expr => {
  const expr2math = function*(expr, prec=precMin){
    if(expr.isSym){
      const {name} = expr;

      if(O.has(pidents, name))
        return pidents[name];

      if(O.has(idents, name))
        return idents[name];

      assert.fail();
      return;
    }

    const op = expr.baseSym
    assert(O.has(precs, op), op);

    const prec1 = precs[op];
    const args = Expr.expr2args(expr);
    const argsNum = args.length;

    const disambiguate = str => {
      if(prec > prec1) return `(${str})`;
        return str;
    };

    if(op === 'impl')
      return disambiguate(`${
        yield [expr2math, args[0], prec1 + 1]} \\to ${
        yield [expr2math, args[1], prec1]}`);

    if(op === 'pnot')
      return disambiguate(`\\lnot ${
        yield [expr2math, args[0], prec1]}`);

    if(op === 'forall')
      return disambiguate(`\\forall ${
        yield [expr2math, args[0], precMax]} ${
        yield [expr2math, args[1], prec1]}`);

    if(op === 'pelem')
      return disambiguate(`${
        yield [expr2math, args[0], precMax]} \\in ${
        yield [expr2math, args[1], precMax]}`);

    assert.fail(op);
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