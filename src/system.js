'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const NameChecker = require('./name-checker');
const StringSet = require('./string-set');

class System{
  dirs = O.obj();
  data = O.obj();

  constructor(pa, name){
    this.pa = pa;
    this.name = name;

    const dir = path.join(pa.systemsDir, name);
    pa.md(dir);

    const dirs = [
      'funcs',
      'axioms',
      'theorems',
    ];

    const dirsObj = this.dirs;
    const {data} = this;

    for(const d of dirs){
      const subDir = path.join(dir, d);

      pa.md(subDir);

      dirsObj[d] = subDir;
      data[d] = null;
    }

    const structsFile = path.join(dir, 'structs.txt');

    if(pa.nexi(structsFile))
      pa.save(structsFile, [['structs']]);

    this.dir = dir;
    this.structsFile = structsFile;
  }

  getStructs(){
    const top = this.pa.load(this.structsFile).uni;
    const set = new StringSet();

    top.ta('structs', a => {
      const {name} = a.ident();

      if(set.has(name))
        a.err(`This struct has already been declared`);

      set.add(name);
      return name;
    });

    return set;
  }

  getDirContent(type){
    const dir = this.dirs[type];
    const files = fs.readdirSync(dir);
    const set = new StringSet();

    for(const base of files){
      if(!base.endsWith('.txt')) continue;

      const name = base.slice(0, base.length - 4);
      if(!NameChecker.check(name)) continue;

      set.add(name);
    }

    return set;
  }

  getData(type){
    const {data} = this;

    if(data[type] === null)
      data[type] = this.getDirContent(type);

    return data[type];
  }

  verifyTheorem(){
    
  }
}

module.exports = System;