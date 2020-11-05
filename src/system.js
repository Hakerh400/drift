'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Entity = require('./entity');
const Parser = require('./parser');
const NameChecker = require('./name-checker');
const SystemError = require('./system-error');
const debug = require('./debug');

const {dataTypesObj, dataTypesArr} = Entity;

class System{
  #structs = null;
  #verifiedTheorems = null;
  #dataColls = O.arr2obj(dataTypesArr, null);
  #rawEnts = O.obj();

  constructor(pa, name){
    this.pa = pa;
    this.name = name;

    const dir = path.join(pa.systemsDir, name);
    pa.md(dir);

    const structsFile = path.join(dir, 'structs.txt');
    if(pa.nexi(structsFile)) pa.save(structsFile, [['structs']]);

    const verifiedTheoremsFile = path.join(dir, 'verified-theorems.txt');
    if(pa.nexi(verifiedTheoremsFile)) pa.save(verifiedTheoremsFile, [['verified-theorems']]);

    this.dir = dir;
    this.structsFile = structsFile;
    this.verifiedTheoremsFile = verifiedTheoremsFile;
  }

  typeDir(type){
    return path.join(this.dir, `${type}s`);
  }

  get structs(){
    if(this.#structs === null)
      this.#structs = this.#loadStructs();

    return this.#structs;
  }

  #loadStructs(){
    const top = this.pa.load(this.structsFile).uni;
    const obj = O.obj();

    top.ta('structs', elem => {
      elem.len(2);

      const name = elem.fst.m;
      const arity = elem.snd.nat;

      if(name in obj)
        elem.err(`This struct has already been declared`);

      obj[name] = arity;
      return name;
    });

    return obj;
  }

  hasStruct(name){
    return name in this.structs;
  }

  get verifiedTheorems(){
    if(this.#verifiedTheorems === null)
      this.#verifiedTheorems = this.#loadVerifiedTheorems();

    return this.#verifiedTheorems;
  }

  #loadVerifiedTheorems(){
    const top = this.pa.load(this.verifiedTheoremsFile).uni;
    const obj = O.obj();

    top.ta('verified-theorems', elem => {
      obj[elem.m] = 1;
    });

    return obj;
  }

  getStructArity(name){
    return this.structs[name];
  }

  getEntColl(type){
    assert(type in dataTypesObj);
    const dataColls = this.#dataColls;

    if(dataColls[type] === null)
      dataColls[type] = this.#loadEntColl(type);

    return dataColls[type];
  }

  #loadEntColl(type){
    const dir = this.typeDir(type);
    const files = fs.readdirSync(dir);
    const obj = O.obj();

    for(const base of files){
      if(!base.endsWith('.txt')) continue;

      const name = base.slice(0, base.length - 4);
      if(!NameChecker.check(name)) continue;

      obj[name] = null;
    }

    return obj;
  }

  hasRawEnt(name){
    return name in this.rawEnts;
  }

  getRawEnt(type, name){
    const rawEnts = this.#rawEnts;

    if(!(type in rawEnts))
      rawEnts[type] = O.obj();

    const ents = rawEnts[type];

    if(!(name in ents))
      ents[name] = this.#loadRawEnt(type, name);

    return ents[name];
  }

  #loadRawEnt(type, name){
    const file = path.join(this.typeDir(type), `${name}.txt`);
    return Parser.parse(this.pa, file);
  }

  hasEnt(name){
    return this.getTypeOf(name) === null;
  }

  getEnt(type, name=null){
    if(name === null){
      name = type;
      type = this.getTypeOf(name);
      if(type === null) return null;
    }

    const coll = this.getEntColl(type);

    if(!(name in coll))
      this.err(`Entity ${
        O.sf(name)} of type ${
        O.sf(type)} is not found`);

    if(coll[name] === null)
      coll[name] = this.#loadEnt(type, name);

    return coll[name];
  }

  #loadEnt(type, name){
    const raw = this.getRawEnt(type, name);
    return new dataTypesObj[type](this, name, raw);
  }

  getTypeOf(name){
    let type = this.hasStruct(name) ? 'struct' : null;

    for(const t of dataTypesArr){
      const coll = this.getEntColl(t);
      if(!(name in coll)) continue;

      if(type !== null)
        this.getEnt(t, name).err(`${
          O.sf(name)} has already been declared as ${
          O.sf(type)}`);

      type = t;
    }

    return type;
  }

  getInfoOf(name){
    const type = this.getTypeOf(name);
    if(type === null) return null;

    let arity;

    switch(type){
      case 'struct':
        arity = this.getStructArity(name);
        break;

      case 'axiom':
      case 'theorem':
        const top = this.getRawEnt(type, name).uni;
        arity = BigInt(top.e(2).n);
        break;

      default:
        assert.fail(type);
        break;
    }

    return [type, arity];
  }

  isTheoremVerified(name){
    return name in this.verifiedTheorems;
  }

  verifyTheorem(name, save=1){
    if(this.isTheoremVerified(name)) return;

    const {pa} = this;
    const seen = new Set();
    const stack = [];

    const verify = function*(th){
      const {name} = th;

      stack.push(th);
      seen.add(th);

      const thrw = (step, msg) => {
        const err = new SystemError(`Error in step ${
          O.sf(step.name)} of theorem ${
          O.sf(name)}\n${
          msg instanceof SystemError ? msg.msg : msg}`);

        err.throw(this.pa);
      };

      for(const step of th.stepsArr){
        const {inv, expr} = step;
        const expected = step.expr;
        let actual;

        calcActual: {
          if(inv instanceof Entity.ArgumentReference){
            actual = inv.expr;
            break calcActual;
          }

          if(inv instanceof Entity.TheoremInvocation){
            const {name} = inv;
            const invEnt = this.getEnt(name);

            calcResultingExpr: {
              const type = th.getRefType(name);

              const calcSimpleExpr = () => {
                const vars = invEnt.matchVars(inv.argExprs, th);
                if(vars instanceof SystemError) thrw(step, vars);

                return invEnt.result.subst(vars);
              };

              if(type === 'axiom'){
                actual = calcSimpleExpr();
                break calcResultingExpr;
              }

              if(type === 'theorem'){
                if(!this.isTheoremVerified(name)){
                  const th = this.getEnt(name);

                  if(seen.has(th))
                    inv.elem.fst.err(`Cyclic theorem dependence:\n\n${
                      stack.map(a => a.name).join('\n')}\n`);

                  yield [verify, th];
                }

                actual = calcSimpleExpr();
                break calcResultingExpr;
              }

              assert.fail(type);
            }

            break calcActual;
          }

          assert.fail(inv?.constructor?.name);
        }

        if(!actual.eq(expected))
          thrw(step, `Resulting expressions do not match\n\n${
            'Expected:'.padEnd(9)} ${
            expected.elem}\n${
            'Actual:'.padEnd(9)} ${
            actual.elem}`);
      }

      stack.pop();
      this.declareTheoremAsVerified(name, save);
    }.bind(this);

    O.rec(verify, this.getEnt(name));
  }

  verifyAllTheorems(save=1){
    this.clearVerifiedTheorems(0);

    const names = this.getEntColl('theorem');
    
    for(const name in names){
      log(name);
      this.verifyTheorem(name, 0);
    }

    if(save) this.saveVerifiedTheorems();
  }

  declareTheoremAsVerified(name, save=1){
    const {verifiedTheorems} = this;

    verifiedTheorems[name] = 1;
    if(save) this.saveVerifiedTheorems();
  }

  clearVerifiedTheorems(save=1){
    this.#verifiedTheorems = O.obj();
    if(save) this.saveVerifiedTheorems();
  }

  saveVerifiedTheorems(){
    this.pa.save(
      this.verifiedTheoremsFile,
      [['verified-theorems', 1, ...O.keys(this.verifiedTheorems)]],
    );
  }

  warn(msg){ this.pa.warn(msg); }
  err(msg){ this.pa.err(msg); }
}

module.exports = System;