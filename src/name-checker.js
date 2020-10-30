'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

class NameChecker{
  static check(name){
    return /^[a-z0-9]+(?:\-[a-z0-9]+)*$/.test(name);
  }

  constructor(pa, type){
    this.pa = pa;
    this.type = type;
  }

  check(name){
    if(!NameChecker.check(name))
      this.err(`Invalid ${this.type} name ${O.sf(name)}`);
  }

  err(msg){
    this.pa.err(msg);
  }
}

module.exports = NameChecker;