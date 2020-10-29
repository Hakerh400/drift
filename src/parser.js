'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const debug = require('./debug');

class Parser{
  static parse(pa, file){
    return new Parser(pa, file).parse();
  }

  constructor(pa, file){
    this.pa = pa;

    this.file = file;
    this.str = O.lf(O.rfs(file, 1));
    this.strLen = this.str.length;
    this.index = 0;

    this.line = 1;
    this.pos = 1;
    this.linePrev = 1;
    this.posPrev = 1;

    this.eof = 0;
  }

  parse(){
    assert(this.index === 0 && !this.eof);

    const topElems = [];
    const stack = [];

    let firstParenLine = null;
    let firstParenPos = null;

    const push = elem => {
      if(stack.length === 0){
        topElems.push(elem);
        return;
      }

      O.last(stack).push(elem);
    };

    for(const tk of this.getAllTokens()){
      if(tk === '('){
        if(firstParenLine === null){
          firstParenLine = this.linePrev;
          firstParenPos = this.posPrev;
        }

        const elem = this.createList();
        stack.push(elem);
        
        continue;
      }

      if(tk === ')'){
        if(stack.length === 0)
          this.err('Unmatched closed parenthese');

        const elem = stack.pop();
        push(elem);

        continue;
      }

      push(this.createIdent(tk));
    }

    if(stack.length !== 0)
      this.err('Unmatched open parenthese', firstParenLine, firstParenPos);

    return topElems;
  }

  createList(){
    return new List(this, this.linePrev, this.posPrev);
  }

  createIdent(name){
    return new Identifier(this, this.linePrev, this.posPrev, name);
  }

  nextChar(adv=1){
    assert(!this.eof);

    if(this.index === this.strLen)
      return null;

    const c = this.str[this.index];

    if(!/[\t\n -~]/.test(c))
      this.err('Invalid character', this.line, this.pos);

    if(adv){
      this.index++;
      this.linePrev = this.line;
      this.posPrev = this.pos;

      if(c === '\n'){
        this.line++;
        this.pos = 1;
      }else{
        this.pos++;
      }
    }

    return c;
  }

  nextToken(){
    assert(!this.eof);

    while(1){
      const c = this.nextChar(0);

      if(c === null){
        this.eof = 1;
        return null;
      }

      if(/\S/.test(c)) break;

      this.nextChar(1);
    }

    const linePrev = this.line;
    const posPrev = this.pos;

    const c = this.nextChar(1);
    assert(c !== null);

    if(/(?![\(\)])[!-~]/.test(c)){
      let ident = c;

      while(1){
        const c = this.nextChar(0);

        if(c === null) break;
        if(!/(?![\(\)])[!-~]/.test(c)) break;

        ident += c;

        this.nextChar(1);
      }

      this.linePrev = linePrev;
      this.posPrev = posPrev;

      return ident;
    }

    this.linePrev = linePrev;
    this.posPrev = posPrev;

    assert(/[\(\)]/.test(c));
    return c;
  }

  *getAllTokens(){
    while(1){
      const tk = this.nextToken();
      if(tk === null) return;
      yield tk;
    }
  }

  err(msg, line=this.linePrev, pos=this.posPrev){
    this.pa.err(`Error while parsing file ${
      O.sf(this.file)}\nSyntax error at line ${
      line} position ${
      pos}\n${
      msg}\n\n${
      O.sanl(this.str)[line - 1]}\n${
      `${' '.repeat(pos - 1)}^`}`);
  }
}

class ListElement extends O.Stringifiable{
  constructor(parser, line, pos){
    super();

    this.parser = parser;
    this.line = line;
    this.pos = pos;
  }

  err(msg){
    this.parser.err(msg, this.line, this.pos);
  }
}

class Identifier extends ListElement{
  constructor(parser, line, pos, name=null){
    super(parser, line, pos);
    this.name = name;
  }

  get chNum(){ return 0; }

  toStr(){
    return this.name;
  }
}

class List extends ListElement{
  constructor(parser, line, pos, elems=[]){
    super(parser, line, pos);
    this.elems = elems;
  }

  push(elem){
    this.elems.push(elem);
  }

  get chNum(){ return this.elems.length; }
  getCh(i){ return this.elems[i]; }

  toStr(){
    const arr = ['('];
    this.join(arr, this.elems, ' ');
    arr.push(')');
    return arr;
  }
}

module.exports = Object.assign(Parser, {
  ListElement,
  Identifier,
  List,
});