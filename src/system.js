'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

class System{
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

    for(const d of dirs){
      const subDir = path.join(dir, d);

      pa.md(subDir);
      this[`${d}Dir`] = subDir;
    }

    const structsFile = path.join(dir, 'structs.txt');

    if(pa.nexi(structsFile))
      pa.save(structsFile, [['structs']]);

    this.dir = dir;
    this.structsFile = structsFile;
  }

  getStructs(){
    const top = this.pa.load(this.structsFile).uni;
    return top.sndp('structs');
  }
}

module.exports = System;