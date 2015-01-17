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

import * as Shift from "shift-ast"

import {validStmt, invalidStmt, validExpr, invalidExpr, wrapIter, exprStmt, label, prop, vars, block, FE, FD, STMT, EXPR, ID} from "./helpers"

suite("unit", () => {
  test("BreakStatement with label must be within a correspondingly labeled statement", () => {
    validStmt(label(ID.name, wrapIter(new Shift.BreakStatement(ID))));
    validStmt(label(ID.name, block(new Shift.BreakStatement(ID))));
    invalidStmt(1, wrapIter(new Shift.BreakStatement(ID)));
    invalidStmt(1, label(ID.name + "$", wrapIter(new Shift.BreakStatement(ID))));
    invalidStmt(1, label(ID.name, FE(new Shift.BreakStatement(ID))));
    invalidStmt(1, new Shift.SwitchStatementWithDefault(
      EXPR, [], new Shift.SwitchDefault([new Shift.BreakStatement(ID)]), []
    ));
    invalidStmt(1, new Shift.SwitchStatementWithDefault(
      EXPR, [new Shift.SwitchCase(EXPR, [new Shift.BreakStatement(ID)])],new Shift.SwitchDefault([STMT]), []
    ));
    invalidStmt(1, new Shift.SwitchStatementWithDefault(
      EXPR, [],new Shift.SwitchDefault([STMT]), [new Shift.SwitchCase(EXPR, [new Shift.BreakStatement(ID)])]
    ));
    invalidStmt(1, new Shift.SwitchStatement(
      EXPR, [new Shift.SwitchCase(EXPR, [new Shift.BreakStatement(ID)])]
    ));
  });

  test("BreakStatement without label must be within an IterationStatement or a SwitchStatement", () => {
    validStmt(wrapIter(new Shift.BreakStatement()));
    invalidStmt(1, label(ID.name, block(new Shift.BreakStatement())));
    validStmt(new Shift.SwitchStatementWithDefault(
      EXPR, [], new Shift.SwitchDefault([new Shift.BreakStatement(null)]), []
    ));
    validStmt(new Shift.SwitchStatementWithDefault(
      EXPR, [], new Shift.SwitchDefault([block(new Shift.BreakStatement(null))]), []
    ));
    invalidStmt(1, new Shift.SwitchStatementWithDefault(
      EXPR, [], new Shift.SwitchDefault([FE(new Shift.BreakStatement(null))]), []
    ));
  });

  test("ContinueStatement with label must be within a labeled iteration statement", () => {
    invalidStmt(1, wrapIter(new Shift.ContinueStatement(ID)));
    invalidStmt(1, label(ID.name + "$", wrapIter(new Shift.ContinueStatement(ID))));

    validStmt(label(ID.name, new Shift.WhileStatement(EXPR, new Shift.ContinueStatement(ID))));
    validStmt(label(ID.name, new Shift.DoWhileStatement(new Shift.ContinueStatement(ID), EXPR)));
    validStmt(label(ID.name, new Shift.ForStatement(null, null, null, new Shift.ContinueStatement(ID))));
    validStmt(label(ID.name, new Shift.ForInStatement(ID, EXPR, new Shift.ContinueStatement(ID))));
    invalidStmt(2, label(ID.name, block(new Shift.ContinueStatement(ID))));
    invalidStmt(2, label(ID.name, new Shift.WithStatement(EXPR, new Shift.ContinueStatement(ID))));

    validStmt(label(ID.name, wrapIter(block(new Shift.ContinueStatement(ID)))));
    invalidStmt(1, label(ID.name, wrapIter(FE(wrapIter(new Shift.ContinueStatement(ID))))));
    invalidStmt(2, label(ID.name, wrapIter(FE(new Shift.ContinueStatement(ID)))));

    invalidStmt(1, label(ID.name, block(wrapIter(new Shift.ContinueStatement(ID)))));
  });

  test("ContinueStatement without label must be within an iteration statement", () => {
    validStmt(wrapIter(new Shift.ContinueStatement()));
    validStmt(label(ID.name, wrapIter(new Shift.ContinueStatement())));
    validStmt(label(ID.name + "$", wrapIter(new Shift.ContinueStatement())));
    validStmt(wrapIter(block(new Shift.ContinueStatement())));

    invalidStmt(1, wrapIter(FE(new Shift.ContinueStatement())));

    invalidStmt(1, new Shift.SwitchStatementWithDefault(
      EXPR, [], new Shift.SwitchDefault([new Shift.ContinueStatement(null)]), []
    ));
  });

  test("LiteralRegExpExpression value must be a valid RegExp", () => {
    validExpr(new Shift.LiteralRegExpExpression("/a/"));
    validExpr(new Shift.LiteralRegExpExpression("/a/g"));
    validExpr(new Shift.LiteralRegExpExpression("/\\//"));
    validExpr(new Shift.LiteralRegExpExpression("/\\//g"));
    validExpr(new Shift.LiteralRegExpExpression("///"));
    validExpr(new Shift.LiteralRegExpExpression("///g"));
    validExpr(new Shift.LiteralRegExpExpression("//"));
    validExpr(new Shift.LiteralRegExpExpression("//g"));
    invalidExpr(1, new Shift.LiteralRegExpExpression(""));
    invalidExpr(1, new Shift.LiteralRegExpExpression("g"));
    invalidExpr(1, new Shift.LiteralRegExpExpression("/[/"));
    invalidExpr(1, new Shift.LiteralRegExpExpression("/(/"));
    invalidExpr(1, new Shift.LiteralRegExpExpression("/)/"));
  });

  test("Identifier name member must be a valid IdentifierName", () => {
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("x")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("$")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("_")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("_$0x")));
    validExpr(new Shift.StaticMemberExpression(EXPR, ID));
    validExpr(new Shift.StaticMemberExpression(EXPR, new Shift.Identifier("if")));
    validExpr(new Shift.ObjectExpression([new Shift.DataProperty(prop("if"), EXPR)]));
    invalidExpr(1, new Shift.IdentifierExpression(new Shift.Identifier("")));
    invalidExpr(1, new Shift.IdentifierExpression(new Shift.Identifier("a-b")));
    invalidExpr(1, new Shift.IdentifierExpression(new Shift.Identifier("0x0")));
    invalidExpr(1, new Shift.StaticMemberExpression(EXPR, new Shift.Identifier("")));
    invalidExpr(1, new Shift.StaticMemberExpression(EXPR, new Shift.Identifier("0")));
    invalidExpr(1, new Shift.StaticMemberExpression(EXPR, new Shift.Identifier("a-b")));
  });

  test("IdentifierExpression must not contain Identifier with reserved word name", () => {
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("varx")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("xvar")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("varif")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("if_var")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("function0")));
    invalidExpr(1, new Shift.IdentifierExpression(new Shift.Identifier("if")));
    invalidExpr(1, new Shift.IdentifierExpression(new Shift.Identifier("var")));
    invalidExpr(1, new Shift.IdentifierExpression(new Shift.Identifier("function")));
  });

  test("FunctionExpression name must not be a reserved word", () => {
    validExpr(new Shift.FunctionExpression(null, [], new Shift.FunctionBody([], [])));
    validExpr(new Shift.FunctionExpression(ID, [], new Shift.FunctionBody([], [])));
    invalidExpr(1, new Shift.FunctionExpression(new Shift.Identifier("if"), [], new Shift.FunctionBody([], [])));
  });

  test("FunctionDeclaration name must not be a reserved word", () => {
    validStmt(new Shift.FunctionDeclaration(ID, [], new Shift.FunctionBody([], [])));
    invalidStmt(1, new Shift.FunctionDeclaration(new Shift.Identifier("if"), [], new Shift.FunctionBody([], [])));
  });

  test("FunctionExpression parameters must not be reserved words", () => {
    validExpr(new Shift.FunctionExpression(null, [], new Shift.FunctionBody([], [])));
    validExpr(new Shift.FunctionExpression(null, [ID], new Shift.FunctionBody([], [])));
    invalidExpr(1, new Shift.FunctionExpression(null, [new Shift.Identifier("if")], new Shift.FunctionBody([], [])));
    invalidExpr(1, new Shift.FunctionExpression(null, [ID, new Shift.Identifier("if")], new Shift.FunctionBody([], [])));
    invalidExpr(1, new Shift.FunctionExpression(null, [new Shift.Identifier("if"), ID], new Shift.FunctionBody([], [])));
  });

  test("FunctionDeclaration parameters must not be reserved words", () => {
    validStmt(new Shift.FunctionDeclaration(ID, [], new Shift.FunctionBody([], [])));
    validStmt(new Shift.FunctionDeclaration(ID, [ID], new Shift.FunctionBody([], [])));
    invalidStmt(1, new Shift.FunctionDeclaration(ID, [new Shift.Identifier("if")], new Shift.FunctionBody([], [])));
    invalidStmt(1, new Shift.FunctionDeclaration(ID, [ID, new Shift.Identifier("if")], new Shift.FunctionBody([], [])));
    invalidStmt(1, new Shift.FunctionDeclaration(ID, [new Shift.Identifier("if"), ID], new Shift.FunctionBody([], [])));
  });

  test("IfStatement with null `alternate` must not be the `consequent` of an IfStatement with a non-null `alternate`", () => {
    validStmt(new Shift.IfStatement(EXPR, new Shift.DoWhileStatement(new Shift.IfStatement(EXPR, STMT, null), EXPR), STMT));
    validStmt(new Shift.IfStatement(EXPR, new Shift.IfStatement(EXPR, STMT, STMT), STMT));
    validStmt(new Shift.IfStatement(EXPR, new Shift.IfStatement(EXPR, STMT, null), null));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.IfStatement(EXPR, STMT, null), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.IfStatement(EXPR, STMT, new Shift.IfStatement(EXPR, STMT, null)), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.IfStatement(EXPR, new Shift.IfStatement(EXPR, STMT, null), null), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.LabeledStatement(ID, new Shift.IfStatement(EXPR, STMT, null)), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.WhileStatement(EXPR, new Shift.IfStatement(EXPR, STMT, null)), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.WithStatement(EXPR, new Shift.IfStatement(EXPR, STMT, null)), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.ForStatement(EXPR, EXPR, EXPR, new Shift.IfStatement(EXPR, STMT, null)), STMT));
    invalidStmt(1, new Shift.IfStatement(EXPR, new Shift.ForInStatement(EXPR, EXPR, new Shift.IfStatement(EXPR, STMT, null)), STMT));
  });

  test("Setter parameter must not be a reserved word", () => {
    validExpr(new Shift.ObjectExpression([new Shift.Setter(prop(ID), ID, new Shift.FunctionBody([], []))]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.Setter(prop(ID), new Shift.Identifier("if"), new Shift.FunctionBody([], []))]));
  });

  test("LabeledStatement must not be nested within a LabeledStatement with the same label", () => {
    validStmt(label("a", label("b", STMT)));
    validStmt(label("a", exprStmt(FE(FD(label("a", STMT))))));
    invalidStmt(1, label("a", label("a", STMT)));
    invalidStmt(1, label("a", exprStmt(FE(label("a", STMT)))));
  });

  test("LiteralNumericExpression nodes must not be NaN", () => {
    invalidExpr(1, new Shift.LiteralNumericExpression(0/0));
  });

  test("LiteralNumericExpression nodes must be non-negative", () => {
    validExpr(new Shift.LiteralNumericExpression(0.0));
    invalidExpr(1, new Shift.LiteralNumericExpression(-1));
    invalidExpr(1, new Shift.LiteralNumericExpression(-1e308));
    invalidExpr(1, new Shift.LiteralNumericExpression(-1e-308));
    invalidExpr(1, new Shift.LiteralNumericExpression(-0.0));
  });

  test("LiteralNumericExpression nodes must be finite", () => {
    invalidExpr(1, new Shift.LiteralNumericExpression(1/0));
    invalidExpr(1, new Shift.LiteralNumericExpression(-1/0));
  });

  test("ObjectExpression conflicting data/get/set properties", () => {
    const init = new Shift.DataProperty(prop(ID), EXPR);
    const getter = new Shift.Getter(prop(ID), new Shift.FunctionBody([], []));
    const setter = new Shift.Setter(prop(ID), ID, new Shift.FunctionBody([], []));

    validExpr(new Shift.ObjectExpression([init, init]));
    invalidExpr(1, new Shift.ObjectExpression([init, getter]));
    invalidExpr(1, new Shift.ObjectExpression([init, setter]));

    validExpr(new Shift.ObjectExpression([getter, setter]));
    invalidExpr(1, new Shift.ObjectExpression([getter, init]));
    invalidExpr(1, new Shift.ObjectExpression([getter, getter]));

    validExpr(new Shift.ObjectExpression([setter, getter]));
    invalidExpr(1, new Shift.ObjectExpression([setter, init]));
    invalidExpr(1, new Shift.ObjectExpression([setter, setter]));
  });

  test("ObjectExpression duplicate __proto__ data properties are disallowed", () => {
    validExpr(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("__proto__"), EXPR),
        new Shift.DataProperty(prop("a"), EXPR)
      ])
    );
    validExpr(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("a"), EXPR),
        new Shift.DataProperty(prop("__proto__"), EXPR)
      ])
    );
    invalidExpr(1,
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("__proto__"), EXPR),
        new Shift.DataProperty(prop("__proto__"), EXPR)
      ])
    );
    invalidExpr(1,
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("__proto__"), EXPR),
        new Shift.DataProperty(prop(new Shift.Identifier("__proto__")), EXPR)
      ])
    );
  });

  test("PropertyName kind must not conflict with its value", () => {
    validExpr(new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("identifier", "a"), EXPR)]));
    validExpr(new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("string", " "), EXPR)]));
    validExpr(new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "3.1"), EXPR)]));
    validExpr(new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "9999999999999999999999999999999999999999"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("identifier", " "), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("identifier", "0"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "a"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "NaN"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "Infinity"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "-1"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "0x0"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "0X0"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "01"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "0b1"), EXPR)]));
    invalidExpr(1, new Shift.ObjectExpression([new Shift.DataProperty(new Shift.PropertyName("number", "0o1"), EXPR)]));
  });

  test("ReturnStatement must be nested within a FunctionExpression or FunctionDeclaration or Getter or Setter node", () => {
    validExpr(FE(new Shift.ReturnStatement));
    validStmt(FD(new Shift.ReturnStatement));
    validExpr(new Shift.ObjectExpression([new Shift.Getter(new Shift.PropertyName("identifier", ID.name), new Shift.FunctionBody([], [new Shift.ReturnStatement]))]));
    validExpr(new Shift.ObjectExpression([new Shift.Setter(new Shift.PropertyName("identifier", ID.name), ID, new Shift.FunctionBody([], [new Shift.ReturnStatement]))]));
    invalidStmt(1, new Shift.ReturnStatement);
  });

  test("VariableDeclarationStatement in ForInStatement can only have one VariableDeclarator", () => {
    validStmt(new Shift.ForInStatement(vars("var", "a"), EXPR, STMT));
    invalidStmt(1, new Shift.ForInStatement(vars("var", "a", "b"), EXPR, STMT));
  });
});
