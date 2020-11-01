'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Entity = require('./entity');
const Parser = require('./parser');
const NameChecker = require('./name-checker');
const SystemError = require('./system-error');

const {dataTypesObj, dataTypesArr} = Entity;

class System{
  #structs = null;
  #dataColls = O.arr2obj(dataTypesArr, null);

  constructor(pa, name){
    this.pa = pa;
    this.name = name;

    const dir = path.join(pa.systemsDir, name);
    pa.md(dir);

    const structsFile = path.join(dir, 'structs.txt');

    if(pa.nexi(structsFile))
      pa.save(structsFile, [['structs']]);

    this.dir = dir;
    this.structsFile = structsFile;
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

    if(coll[name] === null);
      coll[name] = this.#loadEnt(type, name);

    return coll[name];
  }

  #loadEnt(type, name){
    const file = path.join(this.typeDir(type), `${name}.txt`);
    const ent = new dataTypesObj[type](this, name, file);

    return ent;
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
        const file = path.join(this.typeDir(type), `${name}.txt`);
        const top = Parser.parse(this, file).uni;
        arity = BigInt(top.e(2).n);
        break;

      default:
        assert.fail(type);
        break;
    }

    return [type, arity];
  }

  hasEnt(name){
    return this.getTypeOf(name, 0) === null;
  }

  verifyTheorem(name){
    const {pa} = this;
    const th = this.getEnt(name);

    for(const step of th.stepsArr){
      const {inv, expr} = step;

      const invEnt = this.getEnt(inv.name);
      const vars = invEnt.matchVars(inv.argExprs, th);
      if(vars instanceof SystemError) vars.throw(pa);

      log(Entity.varsMap2str(vars));
      O.exit();
    }
  }

  err(msg){
    this.pa.err(msg);
  }
}

module.exports = System;