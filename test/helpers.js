/**
 * Copyright 2016 Shape Security, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const assert = require("assert");

const Shift = require("shift-ast");
const { isValid, Validator } = require("../");

function assertValid(errs) {
  if (errs.length > 0) {
    errs.forEach((err) => console.error(err.message, JSON.stringify(err.node)));
  }
  assert.equal(0, errs.length);
}

function validStmt(stmt) {
  let script = wrapScript(stmt);
  assert(isValid(script));
  assertValid(Validator.validate(script));
}

function invalidStmt(numExpectedErrors, stmt) {
  let script = wrapScript(stmt);
  assert(!isValid(script));
  let errs = Validator.validate(script);
  if (errs.length != numExpectedErrors) {
    errs.forEach((err) => console.error(err.message, JSON.stringify(err.node)));
  }
  assert.notEqual(errs.length, 0, "statement should have errors");
  assert.equal(errs.length, numExpectedErrors);
}

function validExpr(expr) {
  let script = wrapScript(exprStmt(expr));
  assert(isValid(script));
  assertValid(Validator.validate(script));
}

function invalidExpr(numExpectedErrors, expr) {
  let script = wrapScript(exprStmt(expr));
  assert(!isValid(script));
  let errs = Validator.validate(script);
  assert.notEqual(errs.length, 0, "expression should have errors");
  if (errs.length != numExpectedErrors) {
    errs.forEach((err) => console.error(err.message, JSON.stringify(err.node)));
  }
  assert.equal(errs.length, numExpectedErrors);
}

function valid(program) {
  assert(isValid(program));
  assertValid(Validator.validate(program));
}

function invalid(numExpectedErrors, program) {
  assert(!isValid(program));
  let errs = Validator.validate(program);
  assert.notEqual(errs.length, 0, "expression should have errors");
  assert.equal(errs.length, numExpectedErrors);
}

function exprStmt(expr) {
  return new Shift.ExpressionStatement({expression: expr});
}

function label(l, stmt) {
  return new Shift.LabeledStatement({label: l, body: stmt});
}
function wrapIter(stmt) {
  return new Shift.WhileStatement({test: new Shift.LiteralBooleanExpression({value: true}), body: stmt});
}

function block(stmt) {
  return new Shift.BlockStatement({block: new Shift.Block({statements: [stmt]})});
}

const BLOCK = new Shift.Block({statements: []});
const BLOCK_STMT = new Shift.BlockStatement({block: BLOCK});
const EXPR = new Shift.LiteralNullExpression;
const ATI = new Shift.AssignmentTargetIdentifier({name: "a"});
const BI = new Shift.BindingIdentifier({name: "a"});
const IE = new Shift.IdentifierExpression({name: "a"});
const ID = "a";
const NUM = new Shift.LiteralNumericExpression({value: 0});
const STMT = new Shift.EmptyStatement;

function wrapScript(stmt) {
  return new Shift.Script({directives: [], statements: [stmt]});
}

module.exports = {
  assertValid,
  validStmt,
  invalidStmt,
  validExpr,
  invalidExpr,
  valid,
  invalid,
  exprStmt,
  label,
  wrapIter,
  block,
  BLOCK,
  BLOCK_STMT,
  EXPR,
  ATI,
  BI,
  IE,
  ID,
  NUM,
  STMT,
  wrapScript,
};
