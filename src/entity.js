'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Parser = require('./parser');
const NameChecker = require('./name-checker');

const isExprType = type => {
  return type === 'struct' || type === 'func';
};

const isInvType = type => {
  return type === 'axiom' || type === 'theorem';
};

class Entity{
  refs = O.obj();

  constructor(system, name, file){
    this.system = system;
    this.file = file;
    this.name = name;

    this.top = Parser.parse(system.pa, file).uni;
  }

  get arity(){ O.virtual('arity'); }

  hasRef(name){
    return name in this.refs;
  }

  getRef(name){
    return this.refs[name];
  }

  addRef(name, info){
    this.refs[name] = info;
  }

  getInfoOf(elem, name, addRef=1){
    const info = this.system.getInfoOf(name);

    if(info === null)
      elem.err(`Undefined entity ${O.sf(name)}`);

    if(addRef) this.addRef(name, info);
    return info;
  }

  get isFunc(){ return 0; }
  get isAxiom(){ return 0; }
  get isTheorem(){ return 0; }

  typeErr(elem, name, type){
    elem.err(`Entity ${
      O.sf(name)} of type ${
      O.sf(type)} cannot be used here`);
  }
}

class Function extends Entity{
  get isFunc(){ return 1; }
}

class SimpleEntity extends Entity{
  vars = O.obj();
  args = [];
  result = null;

  boundParseExprRec = this.parseExprRec.bind(this);

  constructor(system, name, file){
    super(system, name, file);

    const {top} = this;

    top.e(1).ident(name);

    for(const elem of top.e(2).a())
      this.args.push(this.parseArg(elem));
  }

  get arity(){ return this.args.length; }

  parseArg(elem){
    return this.parseExpr(elem, 1);
  }

  parseExpr(elem, formal){
    return O.rec(this.boundParseExprRec, elem, formal);
  }

  *parseExprRec(elem, formal=0){
    const {boundParseExprRec} = this;
    const {fst} = elem;

    if(fst.v){
      const ident = fst.uni;
      const varName = ident.m;

      if(this.hasVar(varName))
        return this.getVar(varName);

      if(!formal)
        ident.err(`Undefined variable ${O.sf(varName)}`);

      const vari = new VariableExpression(elem, varName);
      this.addVar(vari);

      return vari;
    }

    const name = fst.m;
    const args = elem.a(1);
    const [type, arity] = this.getInfoOf(fst, name);

    if(type === null)
      fst.err(`Unknown entity ${O.sf(name)}`);

    if(!isExprType(type))
      this.typeErr(fst, name, type);

    elem.len(arity + 1n);

    for(let i = 0; i !== args.length; i++)
      args[i] = yield[boundParseExprRec, args[i], formal];

    if(type === 'struct')
      return new StructExpression(elem, name, args);

    if(type === 'func')
      return new FunctionExpression(elem, name, args);

    assert.fail();
  }

  hasVar(name){ return name in this.vars; }
  getVar(name){ return this.vars[name]; }
  addVar(vari){ this.vars[vari.name] = vari; }
}

class Axiom extends SimpleEntity{
  constructor(system, name, file){
    super(system, name, file);

    const {top} = this;

    this.result = this.parseExpr(top.len(4).e(3));
  }

  get isAxiom(){ return 1; }
}

class Theorem extends SimpleEntity{
  stepsArr = [];
  stepsObj = O.obj();

  constructor(system, name, file){
    super(system, name, file);

    const {top} = this;

    top.type('theorem');

    const steps = top.lenp(4).a(3);
    let lastStep = null;

    for(const elem of steps){
      lastStep = this.parseStep(elem);
      this.addStep(lastStep);
    }

    // Detect superfluous steps
    {
      const stack = [lastStep];
      const seen = new Set(stack);

      while(stack.length !== 0){
        const step = stack.pop();
        const {args} = step.inv;

        for(const arg of args){
          if(arg instanceof Expression) continue;

          assert(arg instanceof Step);
          if(seen.has(arg)) continue;

          seen.add(arg);
          stack.push(arg);
        }
      }

      if(seen.size !== steps.length){
        for(const step in this.stepsArr){
          if(seen.has(step)) continue;

          const {fst} = step.elem;
          fst.err(`Step ${O.sf(fst.m)} is not used in the final result`);
        }
      }
    }

    this.result = lastStep.expr;
  }

  hasStep(name){ return name in this.stepsObj; }
  getStep(name){ return this.stepsObj[name]; }

  addStep(step){
    this.stepsArr.push(step);
    this.stepsObj[step.name] = step;
  }

  parseStep(elem){
    elem.len(3);

    const {fst} = elem;
    const name = fst.m;

    if(this.hasStep(name))
      fst.err(`Step ${O.sf(name)} has already been declared`);

    const inv = this.parseInv(elem.e(1));
    const expr = this.parseExpr(elem.e(2));

    return new Step(elem, name, inv, expr);
  }

  parseInv(elem){
    const {fst} = elem;
    const name = fst.m;
    const [type, arity] = this.getInfoOf(fst, name);

    if(!isInvType(type))
      this.typeErr(fst, name, type);

    elem.len(arity + 1n);

    const args = elem.a(1, elem => {
      if(elem.v){
        const num = elem.uni;
        const index = num.nat;

        if(index === 0n || index > BigInt(this.args.length))
          num.err(`Undefined argument index ${index}`);

        return this.args[Number(index) - 1];
      }

      const name = elem.m;

      if(!this.hasStep(elem.m))
        elem.err(`Undefined step ${O.sf(name)}`);

      return this.getStep(name);
    });

    return new Invocation(elem, name, args);
  }

  get isTheorem(){ return 1; }
}

class Constituent{
  constructor(elem){
    assert(elem instanceof Parser.ListElement);
    this.elem = elem;
  }
}

class Step extends Constituent{
  constructor(elem, name, inv, expr){
    super(elem);

    this.name = name;
    this.inv = inv;
    this.expr = expr;
  }
}

class Invocation extends Constituent{
  constructor(elem, name, args){
    super(elem);

    this.name = name;
    this.args = args;
  }
}

class Expression extends Constituent{
  get isStruct(){ return 0; }
  get isFunc(){ return 0; }
  get isVar(){ return 0; }
}

class StructExpression extends Expression{
  constructor(elem, name, elems=[]){
    super(elem);

    this.name = name;
    this.elems = elems;
  }

  push(elem){ this.elems.push(elem); }
  get isStruct(){ return 1; }
}

class FunctionExpression extends Expression{
  constructor(elem, name, elems=[]){
    super(elem);

    this.name = name;
    this.elems = elems;
  }

  push(elem){ this.elems.push(elem); }
  get isFunc(){ return 1; }
}

class VariableExpression extends Expression{
  constructor(elem, name){
    super(elem);

    this.name = name;
  }

  get isVar(){ return 1; }
}

const dataTypesObj = {
  'func': Function,
  'axiom': Axiom,
  'theorem': Theorem,
};

const dataTypesArr = O.keys(dataTypesObj);

module.exports = Object.assign(Entity, {
  Function,
  Axiom,
  Theorem,

  Step,
  Invocation,
  Expression,
  StructExpression,
  FunctionExpression,
  VariableExpression,

  dataTypesObj,
  dataTypesArr,
});