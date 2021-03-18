'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Info = require('./info');
const ident2sym = require('./ident2sym');

const SYM_CHAR = ':';

const cwd = __dirname;

const dbDir = path.join(cwd, '../database');
const tableFile = path.join(dbDir, 'table.txt');

class Database{
  static load(){
    const db = new Database();
    const {table} = db;
    const reductions = [null];

    const str = O.rfs(tableFile, 1);

    if(str.length !== 0){
      O.sanl(str).forEach((line, index) => {
        const parts = line.split(' ');
        const isSym = parts[0][0] === SYM_CHAR;
        const reducedOffset = isSym ? 1 : 2;

        const expr = isSym ?
          ident2sym(parts[0].slice(1)) :
          [table[parts[0] | 0], table[parts[1] | 0]];

        const info = db.getInfo(expr);
        const reducedIndex = parts.length === reducedOffset ?
          index + 1 :
          parts[reducedOffset] | 0;

        reductions.push(reducedIndex);

        return info;
      });
    }

    reductions.forEach((r, i) => {
      if(r === null) return;

      db.reduce(table[i], table[r], 0);
    });

    return db;
  }

  table = [null];

  syms = O.obj();
  pairs = O.obj();

  get size(){
    return this.table.length;
  }

  hasExpr(expr){
    if(isSym(expr))
      return O.has(this.syms, expr);

    const {pairs} = this;
    const [fst, snd] = expr;
    const fsti = fst.index;
    const sndi = snd.index;

    return O.has(pairs, fsti) && O.has(pairs[fsti], sndi);
  }

  insert(info){
    const db = this;
    const map = new Map();

    const insert = function*(info){
      if(map.has(info))
        return map.get(info);

      const {expr} = info;

      if(isSym(expr)){
        const infoNew = db.getInfoStruct(expr);

        map.set(info, infoNew);
        return infoNew;
      }

      const fst = yield [insert, expr[0]];
      const snd = yield [insert, expr[1]];
      const infoNew = db.getInfoStruct([fst, snd]);

      map.set(info, infoNew);
      return infoNew;
    };

    O.rec(insert, info);
  }

  getInfo(expr){
    if(isSym(expr)){
      const {syms} = this;
      const sym = expr;

      if(O.has(syms, sym))
        return syms[sym];

      const info = this.infoFromExpr(expr);
      return syms[sym] = info;
    }

    const {pairs} = this;
    const [fst, snd] = expr;
    const fsti = fst.index;
    const sndi = snd.index;

    if(O.has(pairs, fsti)){
      if(O.has(pairs[fsti], sndi))
        return pairs[fsti][sndi];
    }else{
      pairs[fsti] = O.obj();
    }

    const info = this.infoFromExpr(expr);
    return pairs[fsti][sndi] = info;
  }

  getInfoStruct(expr){
    const hasExpr = this.hasExpr(expr);
    const info = this.getInfo(expr);

    if(!hasExpr)
      this.reduceToItself(info);

    return info;
  }

  reduce(from, to, strict=1){
    assert(from.reducedTo === null);

    if(strict && from !== to)
      assert(to.reducedTo === to);

    from.reducedTo = to;
    to.reducedFrom.push(from);

    return to;
  }

  reduceToItself(info){
    return this.reduce(info, info);
  }

  infoFromExpr(expr){
    const {table} = this;
    const index = table.length;
    const info = new Info();

    info.index = index;
    info.expr = expr;

    if(isSym(expr)){
      const sym = expr;

      info.baseSym = sym;
      info.argsNum = 0;
    }else{
      const [fst, snd] = expr;

      info.baseSym = fst.baseSym;
      info.argsNum = fst.argsNum + 1;

      fst.refs.push(index);
      if(fst !== snd) snd.refs.push(index);
    }

    table.push(info);

    return info;
  }

  save(){
    const {table} = this;

    O.wfs(tableFile, table.map(info => {
      if(info === null) return '';

      const {expr, reducedTo} = info;
      assert(reducedTo !== null);

      return [
        ...isSym(expr) ? [SYM_CHAR + expr.description] : [expr[0].index, expr[1].index],
        ...reducedTo === info ? [] : [reducedTo.index],
      ].join(' ');
    }).join('\n').slice(1));
  }
}

const isSym = expr => {
  return typeof expr === 'symbol';
};

const isPair = expr => {
  return typeof expr === 'object';
};

module.exports = Object.assign(Database, {
  isSym,
  isPair,
});