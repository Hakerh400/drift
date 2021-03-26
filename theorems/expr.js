'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

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

module.exports = {
  newSym,
  newPair,
  expr2args,
  parse,
  str2expr,
};