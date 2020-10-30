'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const System = require('./system');
const Parser = require('./parser');

const {ListElement, Identifier, List} = Parser;

const cwd = __dirname;
const defaultPath = path.join(cwd, '..');

class ProofAssistant{
  constructor(pth=defaultPath){
    assert(path.isAbsolute(pth));
    pth = path.normalize(pth);

    this.path = pth;
    this.systemsDir = path.join(pth, 'systems');
    this.systemsInfoFile = path.join(this.systemsDir, 'info.txt');

    if(!this.md(this.systemsDir))
      O.wfs(this.systemsInfoFile, '(systems)');
  }

  exi(file){
    return fs.existsSync(file);
  }

  nexi(file){
    return !this.exi(file);
  }

  md(dir){
    if(fs.existsSync(dir)) return 1;
    fs.mkdirSync(dir);
    return 0;
  }

  load(file){
    return Parser.parse(this, file);
  }

  save(file, list){
    if(!(list instanceof ListElement))
      list = ListElement.from(list);

    assert(list.v);
    O.wfs(file, list.elems.join('\n'));
  }

  getSystemNames(){
    const top = this.load(this.systemsInfoFile).uni;
    return top.sndp('systems');
  }

  hasSystem(name){
    return this.getSystemNames().includes(name);
  }

  getSystem(name){
    assert(this.hasSystem(name));

    return new System(this, name);
  }

  createSystem(name){
    if(!/^[a-z0-9]+(?:\-[a-z0-9]+)*$/.test(name))
      this.err(`Invalid system name ${O.sf(name)}`);

    const systems = this.getSystemNames();

    if(systems.includes(name))
      this.err(`System ${O.sf(name)} already exists`);

    this.save(this.systemsInfoFile, [['systems', ...systems, name]]);

    return new System(this, name);
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