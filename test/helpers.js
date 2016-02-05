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

import assert from "assert";

import * as Shift from "shift-ast";
import isValid, {Validator} from "../";

export function assertValid(errs) {
  if (errs.length > 0) {
    errs.forEach((err) => console.error(err.message, JSON.toString(err.node)));
  }
  assert.equal(0, errs.length);
}

export function validStmt(stmt) {
  let script = wrapScript(stmt);
  assert(isValid(script));
  assertValid(Validator.validate(script));
}

export function invalidStmt(numExpectedErrors, stmt) {
  let script = wrapScript(stmt);
  assert(!isValid(script));
  let errs = Validator.validate(script);
  if (errs.length != numExpectedErrors) {
    errs.forEach((err) => console.error(err.message, JSON.toString(err.node)));
  }
  assert.notEqual(errs.length, 0, "statement should have errors");
  assert.equal(errs.length, numExpectedErrors);
}

export function validExpr(expr) {
  let script = wrapScript(exprStmt(expr));
  assert(isValid(script));
  assertValid(Validator.validate(script));
}

export function invalidExpr(numExpectedErrors, expr) {
  let script = wrapScript(exprStmt(expr));
  assert(!isValid(script));
  let errs = Validator.validate(script);
  assert.notEqual(errs.length, 0, "expression should have errors");
  assert.equal(errs.length, numExpectedErrors);
}

export function valid(program) {
  assert(isValid(program));
  assertValid(Validator.validate(program));
}

export function invalid(numExpectedErrors, program) {
  assert(!isValid(program));
  let errs = Validator.validate(program);
  assert.notEqual(errs.length, 0, "expression should have errors");
  assert.equal(errs.length, numExpectedErrors);
}

export function exprStmt(expr) {
  return new Shift.ExpressionStatement({expression: expr});
}

export function label(l, stmt) {
  return new Shift.LabeledStatement({label: l, body: stmt});
}
export function wrapIter(stmt) {
  return new Shift.WhileStatement({test: new Shift.LiteralBooleanExpression({value: true}), body: stmt});
}

export function block(stmt) {
  return new Shift.BlockStatement({block: new Shift.Block({statements: [stmt]})});
}

export const BLOCK = new Shift.Block({statements: []});
export const BLOCK_STMT = new Shift.BlockStatement({block: BLOCK});
export const EXPR = new Shift.LiteralNullExpression;
export const BI = new Shift.BindingIdentifier({name: "a"});
export const IE = new Shift.IdentifierExpression({name: "a"});
export const ID = "a";
export const NUM = new Shift.LiteralNumericExpression({value: 0});
export const STMT = new Shift.EmptyStatement;

export function wrapScript(stmt) {
  return new Shift.Script({directives: [], statements: [stmt]});
}
