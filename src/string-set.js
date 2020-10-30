'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

class StringSet{
  #strs = O.obj();

  has(str){
    return str in this.#strs;
  }

  add(str){
    this.#strs[str] = undefined;
  }

  delete(str){
    delete this.#strs[str];
  }

  get strs(){
    return O.keys(this.#strs);
  }

  *[Symbol.iterator](){
    yield* this.strs;
  }
}

module.exports = StringSet;