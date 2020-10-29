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
    const parsed = Parser.parse(this, this.systemsInfoFile);
    log(parsed.join('\n'));
  }

  err(msg){
    O.err(msg);
  }
}

module.exports = ProofAssistant;