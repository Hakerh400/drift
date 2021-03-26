'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

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

const newSym = name => {
  return {
    isSym: 1,
    isPair: 0,
    name,
    baseSym: name,
    argsNum: 0,
  };
};

const newPair = (fst, snd) => {
  return {
    isSym: 0,
    isPair: 1,
    fst,
    snd,
    baseSym: fst.baseSym,
    argsNum: fst.argsNum + 1,
  };
};

const expr2args = expr => {
  const args = [];

  while(expr.isPair){
    args.push(expr.snd);
    expr = expr.fst;
  }

  return args.reverse();
};

const parse = str => {
  const parseExpr = function*(){
    str = str.trimLeft();
    let expr = yield [parseTerm];

    while(1){
      str = str.trimLeft();
      if(str.length === 0) break;
      if(str[0] === ')') break;

      const arg = yield [parseTerm];
      expr = newPair(expr, arg);
    }

    return expr;
  };

  const parseTerm = function*(){
    str = str.trimLeft();
    assert(str.length !== 0);

    if(str[0] === '('){
      str = str.slice(1);
      const expr = yield [parseExpr];

      assert(str.length !== 0);
      assert(str[0] === ')');

      str = str.trimLeft();
      str = str.slice(1);

      return expr;
    }

    if(str[0] === '~'){
      str = str.slice(1);
      return newPair('~', yield [parseTerm]);
    }

    const match = str.match(/^[^\s\)]+/);
    assert(match !== null);

    const sym = match[0];
    str = str.slice(sym.length);

    return newSym(sym);
  };

  return O.rec(parseExpr);
};

const str2expr = str => {
  return parse(str);
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
    const args = expr2args(expr);
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
  const expr = parse(str);
  return expr2math(expr);
};

module.exports = {
  parse,
  str2expr,
  expr2math,
  str2math,
};