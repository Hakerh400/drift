'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');

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

    this.cLine = 1;
    this.cPos = 1;
    this.tLine = 1;
    this.tPos = 1;
    this.cLinePrev = 1;
    this.cPosPrev = 1;
    this.tLinePrev = 1;
    this.tPosPrev = 1;

    this.eof = 0;
  }

  parse(){
    assert(this.index === 0 && !this.eof);

    const topList = this.createTopList();
    const stack = [];

    const push = elem => {
      if(stack.length === 0){
        topList.push(elem);
        return;
      }

      O.last(stack).push(elem);
    };

    for(const tk of this.getAllTokens()){
      if(tk === '('){
        const elem = this.createList();
        stack.push(elem);

        continue;
      }

      if(tk === ')'){
        if(stack.length === 0)
          this.err(`Unmatched closed parenthese`);

        const elem = stack.pop();
        elem.endLine = this.cLinePrev;
        elem.endPos = this.cPosPrev;
        push(elem);

        continue;
      }

      push(this.createIdent(tk));
    }

    if(stack.length !== 0)
      stack[0].err(`Unmatched open parenthese`);

    return topList;
  }

  createList(){
    return new List(null, this, this.cLinePrev, this.cPosPrev);
  }

  createTopList(){
    return new TopList(null, this);
  }

  createIdent(name){
    const elem = new Identifier(name, this, this.tLinePrev, this.tPosPrev);

    elem.endLine = this.cLinePrev;
    elem.endPos = this.cPosPrev;

    return elem;
  }

  nextChar(adv=1){
    assert(!this.eof);

    if(this.index === this.strLen)
      return null;

    const c = this.str[this.index];

    if(!/[\t\n -~]/.test(c))
      this.err('Illegal character', this.cLine, this.cPos);

    if(adv){
      this.index++;
      this.cLinePrev = this.cLine;
      this.cPosPrev = this.cPos;

      if(c === '\n'){
        this.cLine++;
        this.cPos = 1;
      }else{
        this.cPos++;
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

    this.tLinePrev = this.cLine;
    this.tPosPrev = this.cPos;

    const c = this.nextChar(1);
    assert(c !== null);

    const isIdent = /(?![\(\)])[!-~]/.test(c);
    let ident = c;

    if(isIdent){
      while(1){
        const c = this.nextChar(0);

        if(c === null) break;
        if(!/(?![\(\)])[!-~]/.test(c)) break;

        ident += c;

        this.nextChar(1);
      }
    }

    this.tLine = this.cLine;
    this.tPos = this.cPos;

    if(isIdent) return ident;

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

  err(msg, line=this.cLinePrev , pos=this.cPosPrev){
    assert(typeof line === 'number');
    assert(typeof pos === 'number');

    this.pa.sErr(msg, this.file, O.sanl(this.str)[line - 1], line, pos);
  }

  errc(msg){ this.err(msg, this.cLinePrev, this.cPosPrev); }
  errt(msg){ this.err(msg, this.tLinePrev, this.tPosPrev); }
}

class ListElement extends O.Stringifiable{
  static from(e, top=0){
    const s = a => typeof a === 'string';

    if(s(e))
      return new Identifier(e);

    const topElem = top ? new TopList() : new List();
    const stack = [[e, topElem]];

    while(stack.length !== 0){
      const frame = O.last(stack);
      const [arr, elem] = frame;
      const i = elem.n;

      if(arr.length === i){
        stack.pop();
        continue;
      }

      const e = arr[i];

      if(s(e)){
        elem.push(new Identifier(e));
        continue;
      }

      const elem1 = new List();
      elem.push(elem1);
      stack.push([e, elem1]);
    }

    return topElem;
  }

  endLine = null;
  endPos = null;

  constructor(parser=null, startLine=null, startPos=null){
    super();

    this.parser = parser;
    this.startLine = startLine;
    this.startPos = startPos;
  }

  get s(){ return 0; }
  get v(){ return 0; }

  ident(){ O.virtual('ident'); }
  list(){ O.virtual('list'); }
  len(){ O.virtual('len'); }
  type(){ O.virtual('type'); }
  get fst(){ O.virtual('fst'); }
  get uni(){ O.virtual('uni'); }
  get n(){ O.virtual('n'); }

  get m(){
    return this.ident().name;
  }

  get nat(){
    const s = this.m;

    if(!/^(?:0|[1-9][0-9]*)$/.test(s))
      this.err(`Expected a natural number, but found ${O.sf(s)}`);

    return BigInt(s);
  }

  lenp(start){ return this.len(start, null); }

  e(i){
    this.lenp(i + 1);
    return this.elems[i];
  }

  a(i=0, func=null){
    let arr = this.lenp(i).elems.slice(i);
    if(func !== null) arr = arr.map(func);
    return arr;
  }

  ta(type, func=null){
    let arr = this.type(type).a(1);
    if(func !== null) arr = arr.map(func);
    return arr;
  }

  empty(){
    return this.n === 0;
  }

  err(msg, line=this.startLine, pos=this.startPos){
    this.parser.err(msg, line, pos);
  }

  errStart(msg){ this.err(msg, this.startLine, this.startPos); }
  errEnd(msg){ this.err(msg, this.endLine, this.endPos); }
}

class Identifier extends ListElement{
  constructor(name=null, parser, startLine, startPos){
    super(parser, startLine, startPos);
    this.name = name;
  }

  get s(){ return 1; }

  ident(name=null){
    if(name !== null && name !== this.name)
      this.err(`Expected identifier ${O.sf(name)}, but found ${O.sf(this.name)}`);

    return this;
  }

  list(){
    this.err(`Expected a list, but found identifier ${O.sf(this.name)}`);
  }

  len(){ this.list(); }
  type(){ this.list(); }
  get fst(){ this.list(); }
  get uni(){ this.list(); }
  get n(){ this.list(); }

  get chNum(){ return 0; }

  toStr(){
    return this.name;
  }
}

class List extends ListElement{
  constructor(elems=null, parser, startLine, startPos){
    super(parser, startLine, startPos);

    if(elems === null) elems = [];
    this.elems = elems;
  }

  push(elem){
    this.elems.push(elem);
  }

  get v(){ return 1; }
  get isTop(){ return 0; }

  ident(){
    this.err(`Expected an identifier, but found a list`);
  }

  list(){ return this; }

  len(start=null, end=start){
    const {elems} = this;
    const n = elems.length;

    if(start !== null){
      if(n < start)
        this.errEnd(`Expected another element, but found the end of the list`);

      if(end !== null && n > end)
        elems[start].err(`Superfluous element found in the list`);
    }

    return this;
  }

  type(type){
    this.fst.ident(type);
    return this;
  }

  get fst(){
    return this.e(0);
  }

  get uni(){
    return this.len(1).fst;
  }

  get n(){
    return this.elems.length;
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

class TopList extends List{
  get isTop(){ return 1; }

  ident(){ assert.fail(); }
  errStart(){ assert.fail(); }

  errEnd(msg=null){
    const {elems} = this;
    const n = elems.length;

    if(n === 0)
      this.err(msg !== null ? `Unexpected end of the source code` : msg, 1, 1);

    O.last(elems).errEnd(msg !== null ? msg : `Superfluous element found in the list`);
  }
}

module.exports = Object.assign(Parser, {
  ListElement,
  Identifier,
  List,
  TopList,
});