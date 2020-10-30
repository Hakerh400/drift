'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const Parser = require('./parser');
const NameChecker = require('./name-checker');

class Entity{
  refs = O.obj();

  constructor(system, name, file){
    this.system = system;
    this.file = file;
    this.name = name;
    this.top = Parser.parse(system.pa, file).uni;
  }

  hasRef(name){
    return name in this.refs;
  }

  addRef(ref){
    this.refs[name] = 1;
  }

  getTypeOf(name){
    return this.system.getTypeOf(name);
  }

  get isFunc(){ return 0; }
  get isAxiom(){ return 0; }
  get isTheorem(){ return 0; }
}

class Function extends Entity{
  get isFunc(){ return 1; }
}

class Axiom extends Entity{
  get isAxiom(){ return 1; }
}

class Theorem extends Entity{
  vars = O.obj();
  args = [];
  steps = O.obj();
  result = null;

  boundParseExprRec = this.parseExprRec.bind(this);

  constructor(system, name, file){
    super(system, name, file);

    let lastStep = null;

    top.type('theorem');
    top.e(1).ident(this.name);

    for(const elem of top.e(2).a())
      this.args.push(this.parseArg(elem));

    for(const elem of top.lenp(4).a(3)){
      lastStep = this.parseStep(elem);
      this.addStep(lastStep);
    }

    this.result = lastStep.expr;
  }

  parseArg(elem){
    return this.parseExpr(elem, 1);
  }

  parseStep(elem){
    elem.len(3);

    const name = elem.fst.m;
    const inv = this.parseInv(elem.e(1));
    const expr = this.parseExpr(elem.e(2));

    return new Step(name, inv, expr);
  }

  parseInv(elem){
    const name = elem.fst.m;

    const args = elem.a(1, elem => {
      if(elem.v){
        const index = elem.uni.int;

        if(index === 0n || index > BigInt(this.args.length))
          elem.err(`Undefined argument index ${index}`);

        return this.args[index];
      }

      const name = elem.m;

      if(!this.hasStep(elem.m))
        elem.err(`Undefined step ${O.sf(name)}`);

      return this.getStep(name);
    });

    return new Invocation(name, args);
  }

  parseExpr(elem, formal){
    return O.rec(this.boundParseExprRec, elem, formal);
  }

  *parseExprRec(elem, formal=0){
    let name;
    let args;

    if(elem.v){
      const {fst} = elem;

      if(fst.v){
        const ident = fst.uni;
        const varName = ident.m;

        if(this.hasVar(varName))
          return this.getVar(varName);

        if(!formal)
          ident.err(`Undefined variable ${O.sf(varName)}`);

        const vari = new VariableExpression(varName);
        this.addVar(vari);

        return vari;
      }

      name = fst.m;
      args = elem.a(1);
    }else{
      name = elem.m;
      args = [];
    }

    
  }

  hasVar(name){ return name in this.vars; }
  getVar(name){ return this.vars[name]; }
  addVar(vari){ this.vars[vari.name] = vari; }

  hasStep(name){ return name in this.steps; }
  getStep(name){ return this.steps[name]; }
  addStep(step){ this.steps[step.name] = step; }

  get isTheorem(){ return 1; }
}

class Step{
  constructor(name, inv, expr){
    this.name = name;
    this.inv = inv;
    this.expr = expr;
  }
}

class Invocation{
  constructor(name, args){
    this.name = name;
    this.args = args;
  }
}

class Expression{
  get isStruct(){ return 0; }
  get isFunc(){ return 0; }
  get isVar(){ return 0; }
}

class StructExpression extends Expression{
  constructor(name, elems=[]){
    super();

    this.name = name;
    this.elems = elems;
  }

  push(elem){ this.elems.push(elem); }
  get isStruct(){ return 1; }
}

class FunctionExpression extends Expression{
  constructor(name, elems=[]){
    super();

    this.name = name;
    this.elems = elems;
  }

  push(elem){ this.elems.push(elem); }
  get isFunc(){ return 1; }
}

class VariableExpression extends Expression{
  constructor(name){
    super();

    this.name = name;
  }

  get isVar(){ return 1; }
}

const dataTypesObj = {
  'funcs': Function,
  'axioms': Axiom,
  'theorems': Theorem,
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