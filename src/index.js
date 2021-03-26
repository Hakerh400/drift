'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const O = require('omikron');
const parser = require('./parser');
const database = require('./database');
const Info = require('./info');
const cs = require('./ctors');
const ident2sym = require('./ident2sym');
const Expr = require('../theorems/expr');

const {tilde} = parser;
const {isSym, isPair} = database;

const cwd = __dirname;
const mainDir = path.join(cwd, '..');
const systemDir = path.join(mainDir, 'system');
const thsDir = path.join(mainDir, 'theorems');
const thsFile = path.join(thsDir, 'theorems.txt');
const verifiedFile = path.join(thsDir, 'verified.txt');

const ths = O.obj();

O.sanll(O.rfs(thsFile, 1), 0).map(str => {
  const lines = O.sanl(str);
  const name = lines[0];
  const expr = Expr.parse(lines[1]);

  ths[name] = expr;
});

const verified = O.arr2obj(O.sanl(O.rfs(verifiedFile, 1), 0));

const prog = parser.parse(systemDir);

const verifyAll = (force=0) => {
  if(force){
    for(const thName of O.keys(verified))
      delete verified[thName];

    saveVerified();
  }

  for(const thName of O.keys(ths))
    verify(thName);
};

const verify = (thName, force=0) => {
  const update = status => {
    updateVerified(thName, status);
  };

  if(isVerified(thName)){
    if(!force) return;
    update(0);
  }

  log(thName);

  const db = new database.OperativeDatabase();

  const reduceIdent = function*(ident){
    const sym = prog.ident2sym(ident);
    return O.tco(reduceExpr, sym);
  };

  const reduceExpr = function*(expr){
    const info = db.getInfo(expr);
    return O.tco(reduce, info);
  };

  const reduce = function*(info){
    if(info.reducedTo !== null)
      return info.reducedTo;

    const {baseSym} = info;

    if(prog.hasType(baseSym))
      return db.reduceToItself(info);

    const func = prog.getFunc(baseSym);
    const funcType = func.type;
    const {arity} = func;
    const args = getArgsFromInfo(info);
    const argsNum = args.length;

    assert(argsNum <= arity);

    if(argsNum < arity)
      return db.reduceToItself(info);

    const err = msg => {
      error(`${msg}\n\n${O.rec(info2str, info)}`);
    };

    const {cases} = func;
    const casesNum = cases.length;

    tryCase: for(let i = 0; i !== casesNum; i++){
      const fcase = cases[i];

      const {lhs, rhs} = fcase;
      const lhsArg = lhs.args;
      const rhsExpr = rhs.expr;

      const vars = O.obj();
      const refs = O.obj();

      const errCtx = msg => {
        const ctxInfo = O.keys(vars).map(sym => {
          return `${sym.description}: ${O.rec(info2str, vars[sym])}`;
        });

        const ctxStr = ctxInfo.length !== 0 ? `\n\n${ctxInfo.join('\n')}` : '';

        error(`${msg}\n\n${O.rec(info2str, info)}${ctxStr}`);
      };

      const match = function*(formal, actual, escaped=0){
        if(formal instanceof cs.Type){
          const info = yield [reduceExpr, formal.sym];
          return info === actual;
        }
        
        if(formal instanceof cs.Variable){
          const {sym} = formal;

          if(!escaped) refs[sym] = 1;

          if(!O.has(vars, sym)){
            vars[sym] = actual;
            return 1;
          }

          return vars[sym] === actual;
        }

        if(formal instanceof cs.Pair){
          const {expr} = actual;
          if(isSym(expr)) return 0;

          const [fst, snd] = expr;
          const sndEscaped = fst.baseSym === tilde && fst.argsNum === 0;

          return (
            (yield [match, formal.fst, fst, 1]) &&
            (yield [match, formal.snd, snd, sndEscaped])
          );
        }

        if(formal instanceof cs.AsPattern){
          for(const expr of formal.exprs)
            if(!(yield [match, expr, actual, escaped]))
              return 0;

          return 1;
        }

        if(formal instanceof cs.AnyExpression)
          return 1;

        assert.fail(formal.constructor.name);
      };

      const simplify = function*(expr, escaped=0){
        if(expr instanceof cs.NamedExpression){
          const {sym} = expr;

          const illegalConstructor = (
            !escaped &&
            expr instanceof cs.Type &&
            prog.hasType(sym) &&
            sym !== funcType &&
            sym !== tilde
          );

          if(illegalConstructor)
            err(`Function ${
              O.sf(func.sym.description)} is not allowed to explicitly contruct type ${
              O.sf(sym.description)}`);

          if(O.has(vars, sym)){
            if(!escaped && !O.has(refs, sym))
              errCtx(`Variable ${
                O.sf(sym.description)} from case ${
                i + 1} of function ${
                O.sf(func.sym.description)} cannot be referenced in this context`);

            return vars[sym];
          }

          return O.tco(reduceExpr, sym);
        }

        if(expr instanceof cs.Call){
          const fst = yield [simplify, expr.fst, escaped];
          const sndEscaped = fst.baseSym === tilde && fst.argsNum === 0;
          const snd = yield [simplify, expr.snd, sndEscaped];
          const info = db.getInfo([fst, snd]);

          return O.tco(reduce, info);
        }

        assert.fail(expr.constructor.name);
      };

      for(let j = 0; j !== arity; j++){
        const formal = lhsArg[j];
        const actual = args[j];

        if(!(yield [match, formal, actual]))
          continue tryCase;
      }

      const reduced = yield [simplify, rhsExpr];
      
      return db.reduce(info, reduced);
    }

    err(`Non-exhaustive patterns in function ${O.sf(baseSym.description)}`);
  };

  const evalExpr = function*(expr){
    if(expr.isSym)
      return O.tco(reduceIdent, expr.name);

    const fst = yield [evalExpr, expr.fst];
    const snd = yield [evalExpr, expr.snd];

    return O.tco(reduceExpr, [fst, snd]);
  };

  const th = O.rec(reduceIdent, thName);
  const prop = O.rec(evalExpr, ths[thName]);

  assert(th.baseSym === ident2sym('Proof'));
  assert(th.argsNum === 1);

  const actual = th.expr[1];

  if(actual !== prop){
    update(0);

    O.logb();
    log('The proof is incorrect');
    log();
    log(info2str(prop));
    log();
    log(info2str(actual));
    O.exit();
  }

  update(1);
};

const updateVerified = (thName, status) => {
  if(getStatus(thName) === status) return;

  if(status) verified[thName] = 1;
  else delete verified[thName];

  saveVerified();
};

const saveVerified = () => {
  O.wfs(verifiedFile, O.keys(verified).join('\n'));
};

const getStatus = thName => {
  return isVerified(thName) ? 1 : 0;
};

const isVerified = thName => {
  return O.has(verified, thName);
};

const info2str = info => {
  const info2str = function*(info, parens=0){
    const {expr} = info;

    if(isSym(expr))
      return expr.description;

    const str = `${
      yield [info2str, expr[0], 0]} ${
      yield [info2str, expr[1], 1]}`;

    if(parens) return `(${str})`;
    return str;
  };

  return O.rec(info2str, info);
};

const getArgsFromInfo = info => {
  const args = [];
  let expr = info.expr;

  while(isPair(expr)){
    const [fst, snd] = expr;

    args.push(snd);
    expr = fst.expr;
  }

  return args.reverse();
};

const error = msg => {
  O.exit(msg);
};

module.exports = {
  verifyAll,
  verify,
  // reduceIdent,
  // info2str,
};