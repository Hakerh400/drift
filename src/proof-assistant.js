'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const System = require('./system');
const Parser = require('./parser');
const NameChecker = require('./name-checker');

const {ListElement, Identifier, List} = Parser;

const cwd = __dirname;
const defaultPath = path.join(cwd, '..');

class ProofAssistant{
  systemNameChecker = new NameChecker(this, 'system');
  #systems = null;

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

  get systems(){
    if(this.#systems === null)
      this.#systems = this.#loadSystems();

    return this.#systems;
  }

  #loadSystems(){
    const top = this.load(this.systemsInfoFile).uni;
    const obj = O.obj();

    top.ta('systems', a => {
      const name = a.m;

      if(name in obj)
        a.err(`This system has already been declared`);

      obj[name] = null;
      return name;
    });

    return obj;
  }

  hasSystem(name){
    return name in this.systems;
  }

  getSystem(name){
    const {systems} = this;
    assert(name in systems);

    if(systems[name] === null)
      systems[name] = new System(this, name);

    return systems[name];
  }

  createSystem(name){
    this.systemNameChecker.check(name);

    const {systems} = this;

    if(name in systems)
      this.err(`System ${O.sf(name)} already exists`);

    this.save(this.systemsInfoFile, [['systems', ...systems, name]]);

    const system = new System(this, name);
    systems[name] = system;

    return system;
  }

  sErr(msg, file, str, line, pos){
    assert(typeof msg === 'string');

    log(`${
      file}:${
      line}\n\n${
      str}\n${
      `${' '.repeat(pos - 1)}^`}\n\nError: ${
      msg}`);

    log(`${O.sanl(new Error().stack).slice(1).join('\n')}`);
    O.exit();
  }

  err(msg){
    O.err(msg);
  }
}

module.exports = ProofAssistant;