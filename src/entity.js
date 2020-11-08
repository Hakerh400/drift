'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const {ArrayList} = require('@hakerh400/list');
const debug = require('./debug');

const isExprType = type => {
  return type === 'struct';
};

const isInvType = type => {
  return type === 'axiom' || type === 'theorem';
};

const varsMap2str = vars => {
  return `(\n${[...vars].map(([a, b]) => {
    return `${' '.repeat(2)}${a.name}: ${b.elem}`;
  }).join('\n')}\n)`;
};

const natives = {
  pair: 2,
  nil: 0,
  rule: 2,
  infer: 1,
  ident: 1,
  func: 1,
  case: 2,
  meta: 2,
};

class Entity{
  refs = O.obj();

  constructor(system, name, elem){
    this.system = system;
    this.name = name;
    this.elem = elem;
  }

  static get typeStr(){ O.virtual('typeStr'); }
  get typeStr(){ return this.constructor.typeStr; }

  get arity(){ O.virtual('arity'); }

  hasRef(name){
    return name in this.refs;
  }

  getRef(name){
    assert(typeof name === 'string');
    return this.refs[name];
  }

  addRef(name, info){
    this.refs[name] = info;
  }

  getRefType(name){ return this.getRef(name)[0]; }
  getRefArity(name){ return this.getRef(name)[1]; }

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
  constructor(system, name, elem){
    super(system, name, elem);

    const top = this.elem;

    top.type('func');

    const arity = top.e(2).fst.n;
    const casesNum = top.n - 2;
    const cases = [];

    for(let i = 0; i !== casesNum; i++){
      const elem = top.e(i + 2);

      elem.fst.len(arity);
      cases.push(new FunctionCase(system, elem));
    }

    this.cases = cases;
  }

  static get typeStr(){ return 'function'; }
  get isFunc(){ return 1; }
}

class SimpleEntity extends Entity{
  vars = O.obj();
  varSet = new Set();
  args = [];
  result = null;

  constructor(system, name, elem, argsOffset=2){
    super(system, name, elem);

    const top = this.elem;

    if(name !== null)
      top.e(1).ident(name);

    for(const elem of top.e(argsOffset).a())
      this.args.push(this.parseArg(elem));
  }

  get arity(){ return this.args.length; }

  hasVar(name){ return name in this.vars; }
  getVar(name){ return this.vars[name]; }

  addVar(vari){
    this.vars[vari.name] = vari;
    this.varSet.add(vari);
  }

  parseArg(elem){
    return this.parseExpr(elem, 1);
  }

  parseExpr(elem, formal){
    const {system} = this;

    const parseExpr = function*(elem){
      if(elem.s){
        const varName = elem.m;

        if(this.hasVar(varName))
          return this.getVar(varName);

        if(!formal)
          elem.err(`Undefined variable ${O.sf(varName)}`);

        const vari = new VariableExpression(elem, varName);
        this.addVar(vari);

        return vari;
      }

      const {fst} = elem;

      const name = fst.m;
      const args = elem.a(1);
      const [type, arity] = this.getInfoOf(fst, name);

      if(type === null)
        fst.err(`Unknown entity ${O.sf(name)}`);

      elem.len(arity + 1n);

      const isFunc = type === 'function';

      if(isFunc && formal)
        fst.err(`A function cannot be used in a formal argument`);

      if(!isFunc && !isExprType(type))
        this.typeErr(fst, name, type);

      for(let i = 0; i !== args.length; i++)
        args[i] = yield [parseExpr, args[i]];

      if(type === 'struct')
        return new StructExpression(elem, name, args);

      if(isFunc){
        return new FunctionExpression(elem, name, args);
      }

      assert.fail(type);
    }.bind(this);

    return O.rec(parseExpr, elem);
  }

  matchVars(args, th=null){
    assert(args.length === this.args.length);

    const vars = new Map();
    const eqs = new ArrayList();

    args.forEach((a, i) => eqs.push([this.args[i], a]));

    while(eqs.length !== 0){
      debugger;
      const [lhs, rhs] = eqs.pop();

      if(lhs instanceof VariableExpression){
        if(!vars.has(lhs)){
          vars.set(lhs, rhs);
          continue;
        }

        if(!vars.get(lhs).eq(rhs))
          return new SystemError(`Variable ${
            O.sf(lhs.name)} from ${
            O.sf(this.name)} has already been determined to be\n\n${
            vars.get(lhs).elem}\n\nso it cannot be\n\n${
            rhs.elem}`);

        continue;
      }

      if(lhs instanceof StructExpression){
        if(rhs instanceof VariableExpression)
          return new SystemError(`Cannot assert that struct\n\n${
            lhs.elem}\n\nfrom ${
            this.typeStr} ${
            O.sf(this.name)} is equal to variable ${
            O.sf(rhs.name)}${
            th !== null ? ` from theorem ${O.sf(th.name)}` : ''}`);

        if(rhs instanceof StructExpression){
          if(lhs.name !== rhs.name)
            return new SystemError(`Struct\n\n${
              lhs.elem}\n\ncannot be equal to\n\n${
              rhs.elem}\n\nbecause their names differ`);

          const args1 = lhs.args;
          const args2 = rhs.args;
          assert(args1.length === args2.length);

          for(let i = 0; i !== args1.length; i++)
            eqs.push([args1[i], args2[i]]);

          continue;
        }
        
        assert.fail(rhs?.constructor?.name);
      }

      assert.fail(lhs?.constructor?.name);
    }

    return vars;
  }

  getResult(args, th){
    const vars = this.matchVars(args, th);
    if(vars instanceof SystemError) return vars;
    return this.result.subst(vars);
  }
}

class FunctionCase extends SimpleEntity{
  constructor(system, elem){
    super(system, null, elem, 0);

    const top = this.elem;

    this.result = this.parseExpr(top.len(2).e(1));
  }

  static get typeStr(){ return 'function'; }
}

class Axiom extends SimpleEntity{
  static get typeStr(){ return 'axiom'; }

  constructor(system, name, elem){
    super(system, name, elem);

    const top = this.elem;

    top.type('axiom');

    this.result = this.parseExpr(top.len(4).e(3));
  }

  get isAxiom(){ return 1; }
}

class Theorem extends SimpleEntity{
  stepsArr = [];
  stepsObj = O.obj();

  constructor(system, name, elem){
    super(system, name, elem);

    const top = this.elem;

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
        const {inv} = step;

        if(inv instanceof ArgumentReference) continue;

        if(inv instanceof TheoremInvocation){
          const {args} = inv;

          for(const arg of args){
            if(arg instanceof TheoremArgumentRef) continue;

            assert(arg instanceof TheoremStepRef);

            const {step} = arg;
            if(seen.has(step)) continue;

            seen.add(step);
            stack.push(step);
          }

          continue;
        }

        assert.fail(inv?.constructor?.name);
      }

      if(seen.size !== steps.length){
        for(const step of this.stepsArr){
          if(seen.has(step)) continue;

          const {fst} = step.elem;
          fst.warn(`Step ${O.sf(fst.m)} is not used in the final result`);
        }
      }
    }

    this.result = lastStep.expr;
  }

  static get typeStr(){ return 'theorem'; }

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

    const getArg = e => {
      const index = e.nat;

      if(index === 0n || index > BigInt(this.args.length))
        e.err(`Undefined argument index ${index}`);

      const n = Number(index) - 1;
      return new TheoremArgumentRef(this.args[n], n);
    };

    const checkArgIndex = e => {
      const index = e.nat;

    };

    if(fst.v){
      const e = fst.uni;

      if(e.isNat){
        elem.len(1);
        const arg = getArg(e);
        return new ArgumentReference(elem, arg);
      }

      e.err(`Unrecognized invocation target`);
    }

    const name = fst.m;
    const [type, arity] = this.getInfoOf(fst, name);

    if(!isInvType(type))
      this.typeErr(fst, name, type);

    elem.len(arity + 1n);

    const args = elem.a(1, elem => {
      if(elem.v) return getArg(elem.uni);

      const name = elem.m;

      if(!this.hasStep(elem.m))
        elem.err(`Undefined step ${O.sf(name)}`);

      return new TheoremStepRef(this.getStep(name));
    });

    return new TheoremInvocation(elem, name, args);
  }

  get isTheorem(){ return 1; }
}

class Constituent{
  constructor(elem){
    assert(elem instanceof ListElement);
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

class Invocation extends Constituent{}

class ArgumentReference extends Invocation{
  constructor(elem, arg){
    super(elem);

    this.arg = arg;
  }

  get expr(){
    return this.arg.expr;
  }
}

class TheoremInvocation extends Invocation{
  constructor(elem, name, args){
    super(elem);

    this.name = name;
    this.args = args;
  }

  get argExprs(){
    return this.args.map(a => a.expr);
  }
}

class Expression extends Constituent{
  get isStruct(){ return 0; }
  get isFunc(){ return 0; }
  get isVar(){ return 0; }

  eq(other){
    const eq = function*(expr1, expr2){
      if(expr1 === expr2) return 1;

      const ctor1 = expr1.constructor;
      const ctor2 = expr2.constructor;
      if(ctor1 !== ctor2) return 0;

      if(expr1 instanceof VariableExpression){
        return expr1.name === expr2.name;
      }

      if(expr1 instanceof VectorExpression){
        if(expr1.name !== expr2.name) return 0;

        const args1 = expr1.args;
        const args2 = expr2.args;
        assert(args1.length === args2.length);

        for(let i = 0; i !== args1.length; i++)
          if(!(yield [eq, args1[i], args2[i]])) return 0;

        return 1;
      }

      assert.fail(ctor1?.name);
    };

    return O.rec(eq, this, other);
  }

  subst(map, literal=1){
    const entries = !literal ? [...map] : null;

    const subst = function*(expr){
      if(expr instanceof VariableExpression){
        if(literal){
          assert(map.has(expr));
          return map.get(expr);
        }

        const index = entries.findIndex(a => a[0].eq(expr));
        assert(index !== -1);

        return entries[index][1];
      }

      if(expr instanceof VectorExpression){
        const {name} = expr;
        const ctor = expr.constructor;
        const argsNew = [];

        for(const arg of expr.args)
          argsNew.push(yield [subst, arg]);

        return new ctor(null, name, argsNew);
      }

      assert.fail(expr?.constructor?.name);
    };

    return O.rec(subst, this);
  }

  reduce(system){
    assert(system instanceof System);

    const reduce = function*(expr){
      if(expr instanceof VariableExpression)
        return expr;

      if(expr instanceof VectorExpression){
        const {name, args} = expr;
        const argsNew = [];

        for(const arg of args)
          argsNew.push(yield [reduce, arg]);

        if(expr instanceof StructExpression)
          return new StructExpression(null, name, argsNew);

        if(expr instanceof FunctionExpression){
          const ent = system.getEnt(name);

          for(const cs of ent.cases){
            const result = cs.getResult(argsNew);
            if(result instanceof SystemError) continue;

            return yield [reduce, result];
          }

          return expr;
        }

        assert.fail(expr?.constructor?.name);
      }

      assert.fail(expr?.constructor?.name);
    }.bind(this);

    return O.rec(reduce, this);
  }
}

class VectorExpression extends Expression{
  constructor(elem=null, name, args=[]){
    if(elem === null){
      const elemsNew = [new Identifier(name)];

      for(const arg of args)
        elemsNew.push(arg.elem);

      elem = new List(elemsNew);
    }

    super(elem);

    this.name = name;
    this.args = args;
  }

  push(elem){ this.args.push(elem); }
}

class StructExpression extends VectorExpression{
  get isStruct(){ return 1; }
}

class FunctionExpression extends VectorExpression{
  get isFunc(){ return 1; }
}

class VariableExpression extends Expression{
  constructor(elem, name){
    super(elem);

    this.name = name;
  }

  get isVar(){ return 1; }
}

class TheoremRef{
  get expr(){ O.virtual('expr'); }
}

class TheoremArgumentRef extends TheoremRef{
  constructor(arg, index){
    super();

    this.arg = arg;
    this.index = index;
  }

  get expr(){
    return this.arg;
  }
}

class TheoremStepRef extends TheoremRef{
  constructor(step){
    super();

    this.step = step;
  }

  get expr(){
    return this.step.expr;
  }
}

const entClasses = [
  Function,
  Axiom,
  Theorem,
];

const dataTypesObj = O.obj();
const dataTypesArr = [];

for(const entc of entClasses){
  const {typeStr} = entc;

  dataTypesObj[typeStr] = entc;
  dataTypesArr.push(typeStr);
}

module.exports = Object.assign(Entity, {
  entClasses,
  dataTypesObj,
  dataTypesArr,

  varsMap2str,

  Function,
  Axiom,
  Theorem,

  Step,
  Invocation,
  ArgumentReference,
  TheoremInvocation,
  Expression,
  VectorExpression,
  StructExpression,
  FunctionExpression,
  VariableExpression,
});

const System = require('./system');
const Parser = require('./parser');
const NameChecker = require('./name-checker');
const SystemError = require('./system-error');

const {ListElement, Identifier, List} = Parser;