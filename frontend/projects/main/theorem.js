'use strict';

const fs = require('fs');
const path = require('path');
const O = require('omikron');
const math = require('./math');

class Theorem{
  constructor(name, expr, desc, verified=0){
    this.name = name;
    this.expr = expr;
    this.math = math.str2math(expr);
    this.desc = desc;
    this.verified = verified;
  }
}

module.exports = Theorem;