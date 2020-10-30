'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Parser = require('./parser');

const cwd = __dirname;
const defaultPath = path.join(cwd, '..');

class ProofAssistant{
  constructor(pth=defaultPath){
    assert(path.isAbsolute(pth));
    pth = path.normalize(pth);

    this.path = pth;
    this.systemsDir = path.join(pth, 'systems');
    this.systemsInfoFile = path.join(this.systemsDir, 'info.txt');

    if(!fs.existsSync(this.systemsDir)){
      fs.mkdirSync(this.systemsDir);
      O.wfs(this.systemsInfoFile, '(systems)');
    }
  }

  getSystems(){
    const top = Parser.parse(this, this.systemsInfoFile);
    const systems = top.uni.ta('systems').map(a => a.ident().name);

    log(systems);
  }

  sErr(msg, file, str, line, pos){
    assert(typeof msg === 'string');

    log(`${
      file}:${
      line}\n\n${
      str}\n${
      `${' '.repeat(pos - 1)}^`}\n\nSyntaxError: ${
      msg}`);

    O.exit();
  }

  err(msg){
    O.err(msg);
  }
}

module.exports = ProofAssistant;