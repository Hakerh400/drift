'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

class SystemError{
  constructor(msg){
    this.msg = msg;
  }

  throw(pa){
    pa.err(this.msg);
  }
}

module.exports = SystemError;