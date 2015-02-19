/**
 * Copyright 2014 Shape Security, Inc.
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

import * as assert from "assert";

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

export function validDirective(directive) {
  let script = new Shift.Script(new Shift.FunctionBody([directive], []));
  assert(isValid(script));
  assertValid(Validator.validate(script));
}

export function invalidDirective(numExpectedErrors, directive) {
  let script = new Shift.Script(new Shift.FunctionBody([directive], []));
  assert(!isValid(script));
  let errs = Validator.validate(script);
  assert.notEqual(errs.length, 0, "directive should have errors");
  assert.equal(errs.length, numExpectedErrors);
}

export function exprStmt(expr) {
  return new Shift.ExpressionStatement(expr);
}

export function label(l, stmt) {
  return new Shift.LabeledStatement(new Shift.Identifier(l), stmt);
}
export function wrapIter(stmt) {
  return new Shift.WhileStatement(new Shift.LiteralBooleanExpression(true), stmt);
}

export function prop(x) {
  let kind, value;
  switch (typeof x) {
    case "number":
    case "string":
      kind = typeof x;
      value = "" + x;
      break;
    default:
      kind = "identifier";
      value = x.name;
  }
  return new Shift.PropertyName(kind, value);
}

export function block(stmt) {
  return new Shift.BlockStatement(new Shift.Block([stmt]));
}

export function FE(stmt) {
  return new Shift.FunctionExpression(ID, [], new Shift.FunctionBody([], [stmt]));
}

export function FD(stmt) {
  return new Shift.FunctionDeclaration(ID, [], new Shift.FunctionBody([], [stmt]));
}

function declarator(name) {
  return new Shift.VariableDeclarator(new Shift.Identifier(name));
}

export function vars(kind, ...names) {
  return new Shift.VariableDeclaration(kind, names.map(declarator));
}

export function varsStmt(kind, ...names) {
  return new Shift.VariableDeclarationStatement(vars(kind, ...names));
}

export const BLOCK = new Shift.Block([]);
export const BLOCK_STMT = new Shift.BlockStatement(BLOCK);
export const EXPR = new Shift.LiteralNullExpression;
export const ID = new Shift.Identifier("a");
export const NUM = new Shift.LiteralNumericExpression(0);
export const STMT = new Shift.EmptyStatement;

export function wrapScript(stmt) {
  return new Shift.Script(new Shift.FunctionBody([], [stmt]));
}
