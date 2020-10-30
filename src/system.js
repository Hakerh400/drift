'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Entity = require('./entity');
const NameChecker = require('./name-checker');

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

  get structs(){
    if(this.#structs === null)
      this.#structs = this.#loadStructs();

    return this.#structs;
  }

  #loadStructs(){
    const top = this.pa.load(this.structsFile).uni;
    const obj = O.obj();

    top.ta('structs', a => {
      const name = a.m;

      if(name in obj)
        a.err(`This struct has already been declared`);

      obj[name] = null;
      return name;
    });

    return obj;
  }

  hasStruct(name){
    return name in this.structs;
  }

  getEntColl(type){
    assert(type in dataTypesObj);
    const dataColls = this.#dataColls;

    if(dataColls[type] === null)
      dataColls[type] = this.#loadEntColl(type);

    return dataColls[type];
  }

  #loadEntColl(type){
    const dir = path.join(this.dir, type);
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

    if(!(name in coll)){
      this.err('')
    }

    if(coll[name] === null);
      coll[name] = this.#loadEnt(type, name);

    return coll[name];
  }

  #loadEnt(type, name){
    const file = path.join(this.dir, type, `${name}.txt`);
    const ent = new dataTypesObj[type](this, name, file);

    return ent;
  }

  getTypeOf(name){
    let type = null;

    for(const t of dataTypesArr){
      const coll = this.getEntColl(t);
      if(!(name in coll)) continue;

      if(type !== null)
        this.getEnt(t, name).err(`${
          O.sf(name)} has already been declared in ${
          O.sf(type)}`);

      type = t;
    }

    return type;
  }

  hasEnt(name){
    return this.getTypeOf(name, 0) === null;
  }

  verifyTheorem(name){
    const th = this.getEnt(name);
    log(th);
  }

  err(msg){
    this.pa.err(msg);
  }
}

module.exports = System;