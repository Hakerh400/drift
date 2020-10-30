'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const System = require('./system');
const Parser = require('./parser');
const NameChecker = require('./name-checker');
const StringSet = require('./string-set');

const {ListElement, Identifier, List} = Parser;

const cwd = __dirname;
const defaultPath = path.join(cwd, '..');

class ProofAssistant{
  #systems = null;

  systemNameChecker = new NameChecker(this, 'system');

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
      this.loadSystems();

    return this.#systems;
  }

  loadSystems(){
    const top = this.load(this.systemsInfoFile).uni;
    const set = new StringSet();

    top.ta('systems', a => {
      const {name} = a.ident();

      if(set.has(name))
        a.err(`This system has already been declared`);

      set.add(name);
      return name;
    });

    this.#systems = set;
  }

  getSystems(){
    return this.systems;
  }

  hasSystem(name){
    return this.systems.has(name);
  }

  getSystem(name){
    assert(this.hasSystem(name));

    return new System(this, name);
  }

  createSystem(name){
    this.systemNameChecker.check(name);

    const {systems} = this;

    if(systems.has(name))
      this.err(`System ${O.sf(name)} already exists`);

    this.save(this.systemsInfoFile, [['systems', ...systems, name]]);
    systems.add(name);

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