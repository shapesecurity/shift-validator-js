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

import {assertValid, validStmt, invalidStmt, validExpr, invalidExpr, wrapIter, exprStmt, label, prop, vars, varsStmt, FE, FD, BLOCK, BLOCK_STMT, STMT, EXPR, ID, NUM} from "./helpers"
import isValid, {Validator} from "../";

function strictFE(stmt) {
  return new Shift.FunctionExpression(null, [], new Shift.FunctionBody([new Shift.UseStrictDirective], [stmt]));
}

suite("strict mode", () => {

  test("basic directive support", () => {
    validStmt(new Shift.FunctionDeclaration(ID, [], new Shift.FunctionBody([new Shift.UseStrictDirective], [])));
    validStmt(new Shift.FunctionDeclaration(ID, [], new Shift.FunctionBody([new Shift.UseStrictDirective, new Shift.UnknownDirective("directive")], [])));

    validStmt(exprStmt(new Shift.FunctionExpression(null, [], new Shift.FunctionBody([new Shift.UseStrictDirective], []))));
    validStmt(
      exprStmt(
        new Shift.FunctionExpression(null, [], new Shift.FunctionBody([new Shift.UseStrictDirective, new Shift.UnknownDirective("directive")], []))
      )
    );
    assertValid(Validator.validate(new Shift.Script(new Shift.FunctionBody([new Shift.UseStrictDirective], []))));
    validExpr(new Shift.FunctionExpression(null, [], new Shift.FunctionBody([new Shift.UseStrictDirective], [])));
  });

  test("CatchClause binding must not be restricted", () => {
    validStmt(new Shift.TryCatchStatement(BLOCK, new Shift.CatchClause(new Shift.Identifier("eval"), BLOCK)));
    validStmt(new Shift.TryCatchStatement(BLOCK, new Shift.CatchClause(new Shift.Identifier("arguments"), BLOCK)));

    validExpr(strictFE(new Shift.TryCatchStatement(BLOCK, new Shift.CatchClause(new Shift.Identifier("x"), BLOCK))));
    invalidExpr(1, strictFE(new Shift.TryCatchStatement(BLOCK, new Shift.CatchClause(new Shift.Identifier("eval"), BLOCK))));
    invalidExpr(1, strictFE(new Shift.TryCatchStatement(BLOCK, new Shift.CatchClause(new Shift.Identifier("arguments"), BLOCK))));
  });

  test("function names must not be restricted", () => {
    validExpr(new Shift.FunctionExpression(new Shift.Identifier("eval"), [], new Shift.FunctionBody([], [BLOCK_STMT])));
    validExpr(new Shift.FunctionExpression(new Shift.Identifier("arguments"), [], new Shift.FunctionBody([], [BLOCK_STMT])));
    validStmt(new Shift.FunctionDeclaration(new Shift.Identifier("eval"), [], new Shift.FunctionBody([], [BLOCK_STMT])));
    validStmt(new Shift.FunctionDeclaration(new Shift.Identifier("arguments"), [], new Shift.FunctionBody([], [BLOCK_STMT])));

    invalidExpr(
      1,
      strictFE(
        exprStmt(new Shift.FunctionExpression(new Shift.Identifier("eval"), [], new Shift.FunctionBody([], [BLOCK_STMT])))
      )
    );
    invalidExpr(
      1,
      strictFE(
        exprStmt(
          new Shift.FunctionExpression(new Shift.Identifier("arguments"), [], new Shift.FunctionBody([], [BLOCK_STMT]))
        )
      )
    );
    invalidExpr(1, strictFE(new Shift.FunctionDeclaration(new Shift.Identifier("eval"), [], new Shift.FunctionBody([], [BLOCK_STMT]))));
    invalidExpr(1, strictFE(new Shift.FunctionDeclaration(new Shift.Identifier("arguments"), [], new Shift.FunctionBody([], [BLOCK_STMT]))));
  });

  test("function parameters must not be restricted", () => {
    validExpr(new Shift.FunctionExpression(null, [new Shift.Identifier("eval")], new Shift.FunctionBody([], [BLOCK_STMT])));
    validExpr(new Shift.FunctionExpression(null, [new Shift.Identifier("arguments")], new Shift.FunctionBody([], [BLOCK_STMT])));
    validStmt(new Shift.FunctionDeclaration(ID, [new Shift.Identifier("eval")], new Shift.FunctionBody([], [BLOCK_STMT])));
    validStmt(new Shift.FunctionDeclaration(ID, [new Shift.Identifier("arguments")], new Shift.FunctionBody([], [BLOCK_STMT])));

    invalidExpr(1, strictFE(exprStmt(new Shift.FunctionExpression(null, [new Shift.Identifier("eval")], new Shift.FunctionBody([], [BLOCK_STMT])))));
    invalidExpr(1, strictFE(exprStmt(new Shift.FunctionExpression(null, [new Shift.Identifier("arguments")], new Shift.FunctionBody([], [BLOCK_STMT])))));
    invalidExpr(1, strictFE(new Shift.FunctionDeclaration(ID, [new Shift.Identifier("eval")], new Shift.FunctionBody([], [BLOCK_STMT]))));
    invalidExpr(1, strictFE(new Shift.FunctionDeclaration(ID, [new Shift.Identifier("arguments")], new Shift.FunctionBody([], [BLOCK_STMT]))));
  });

  test("setter parameter must not be restricted", () => {
    validExpr(
      new Shift.ObjectExpression([
        new Shift.Setter(prop(ID), new Shift.Identifier("eval"), new Shift.FunctionBody([], [BLOCK_STMT]))
      ])
    );
    validExpr(
      new Shift.ObjectExpression([
        new Shift.Setter(prop(ID), new Shift.Identifier("arguments"), new Shift.FunctionBody([], [BLOCK_STMT]))
      ])
    );

    invalidExpr(
      1,
      strictFE(
        exprStmt(
          new Shift.ObjectExpression([
            new Shift.Setter(prop(ID), new Shift.Identifier("eval"), new Shift.FunctionBody([], [BLOCK_STMT]))
          ])
        )
      )
    );
    invalidExpr(
      1,
      strictFE(
        exprStmt(
          new Shift.ObjectExpression([
            new Shift.Setter(prop(ID), new Shift.Identifier("arguments"), new Shift.FunctionBody([], [BLOCK_STMT]))
          ])
        )
      )
    );
  });

  test("AssignmentExpression binding must not be restricted", () => {
    validExpr(new Shift.AssignmentExpression("=", new Shift.IdentifierExpression(new Shift.Identifier("eval")), EXPR));
    validExpr(new Shift.AssignmentExpression("=", new Shift.IdentifierExpression(new Shift.Identifier("arguments")), EXPR));

    invalidExpr(1, strictFE(exprStmt(new Shift.AssignmentExpression("=", new Shift.IdentifierExpression(new Shift.Identifier("eval")), EXPR))));
    invalidExpr(1, strictFE(exprStmt(new Shift.AssignmentExpression("=", new Shift.IdentifierExpression(new Shift.Identifier("arguments")), EXPR))));
  });

  test("VariableDeclaration must not be restricted", () => {
    validStmt(varsStmt("var", "eval"));
    validStmt(varsStmt("var", "arguments"));
    validStmt(varsStmt("let", "eval"));
    validStmt(varsStmt("let", "arguments"));

    invalidExpr(1, strictFE(varsStmt("var", "eval")));
    invalidExpr(1, strictFE(varsStmt("var", "arguments")));
    invalidExpr(1, strictFE(varsStmt("let", "eval")));
    invalidExpr(1, strictFE(varsStmt("let", "arguments")));
  });


  test("FunctionDeclaration parameter names must be unique", () => {
    validExpr(strictFE(new Shift.FunctionDeclaration(ID, [ID], new Shift.FunctionBody([], [BLOCK_STMT]))));
    validExpr(strictFE(new Shift.FunctionDeclaration(new Shift.Identifier("a"), [new Shift.Identifier("A")], new Shift.FunctionBody([], [BLOCK_STMT]))));
    validStmt(new Shift.FunctionDeclaration(ID, [ID, ID], new Shift.FunctionBody([], [BLOCK_STMT])));

    invalidExpr(1, strictFE(new Shift.FunctionDeclaration(ID, [ID, ID], new Shift.FunctionBody([], [BLOCK_STMT]))));
  });

  test("FunctionExpression parameter names must be unique", () => {
    validExpr(strictFE(exprStmt(FE(BLOCK_STMT))));
    validExpr(
      strictFE(
        exprStmt(
          new Shift.FunctionExpression(ID, [new Shift.Identifier("a")], new Shift.Identifier("A")), new Shift.FunctionBody([], [BLOCK_STMT])
        )
      )
    );

    validExpr(new Shift.FunctionExpression(ID, [ID, ID], new Shift.FunctionBody([], [BLOCK_STMT])));
    invalidExpr(1, strictFE(exprStmt(new Shift.FunctionExpression(ID, [ID, ID], new Shift.FunctionBody([], [BLOCK_STMT])))));
  });

  test("IdentifierExpression must not be a FutureReservedWord", () => {
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("let")));
    validExpr(new Shift.IdentifierExpression(new Shift.Identifier("yield")));

    invalidExpr(1, strictFE(exprStmt(new Shift.IdentifierExpression(new Shift.Identifier("let")))));
    invalidExpr(1, strictFE(exprStmt(new Shift.IdentifierExpression(new Shift.Identifier("yield")))));
  });

  test("ObjectExpression duplicate data properties (except __proto__) are allowed as of ES6", () => {
    validExpr(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("a"), EXPR),
        new Shift.DataProperty(prop("a"), EXPR)
      ])
    );
    validExpr(strictFE(exprStmt(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("a"), EXPR),
        new Shift.DataProperty(prop("a"), EXPR)
      ])
    )));
    validExpr(strictFE(exprStmt(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("hasOwnProperty"), EXPR),
        new Shift.DataProperty(prop("a"), EXPR)
      ])
    )));
    validExpr(strictFE(exprStmt(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop(0), EXPR),
        new Shift.DataProperty(prop(0), EXPR)
      ])
    )));
    validExpr(strictFE(exprStmt(
      new Shift.ObjectExpression([
        new Shift.DataProperty(prop("0"), EXPR),
        new Shift.DataProperty(prop(0), EXPR)
      ])
    )));
  });

  test("PrefixExpression delete with unqualified identifier", () => {
    validExpr(new Shift.PrefixExpression("delete", NUM));
    validExpr(new Shift.PrefixExpression("delete", new Shift.IdentifierExpression(ID)));
    validExpr(strictFE(exprStmt(new Shift.PrefixExpression("delete", NUM))));
    invalidExpr(1, strictFE(exprStmt(new Shift.PrefixExpression("delete", new Shift.IdentifierExpression(ID)))));
  });

  test("PrefixExpression/PostfixExpression increment/decrement with restricted identifier", () => {
    const restrictedId = new Shift.Identifier("eval");
    validExpr(new Shift.PrefixExpression("++", NUM));
    validExpr(new Shift.PrefixExpression("++", new Shift.IdentifierExpression(restrictedId)));
    validExpr(strictFE(exprStmt(new Shift.PrefixExpression("++", NUM))));
    invalidExpr(1, strictFE(exprStmt(new Shift.PrefixExpression("++", new Shift.IdentifierExpression(restrictedId)))));

    validExpr(new Shift.PrefixExpression("--", NUM));
    validExpr(new Shift.PrefixExpression("--", new Shift.IdentifierExpression(restrictedId)));
    validExpr(strictFE(exprStmt(new Shift.PrefixExpression("--", NUM))));
    invalidExpr(1, strictFE(exprStmt(new Shift.PrefixExpression("--", new Shift.IdentifierExpression(restrictedId)))));

    validExpr(new Shift.PostfixExpression(NUM, "++"));
    validExpr(new Shift.PostfixExpression(new Shift.IdentifierExpression(restrictedId), "++"));
    validExpr(strictFE(exprStmt(new Shift.PostfixExpression(NUM, "++"))));
    invalidExpr(1, strictFE(exprStmt(new Shift.PostfixExpression(new Shift.IdentifierExpression(restrictedId), "++"))));

    validExpr(new Shift.PostfixExpression(NUM, "--"));
    validExpr(new Shift.PostfixExpression(new Shift.IdentifierExpression(restrictedId), "--"));
    validExpr(strictFE(exprStmt(new Shift.PostfixExpression(NUM, "--"))));
    invalidExpr(1, strictFE(exprStmt(new Shift.PostfixExpression(new Shift.IdentifierExpression(restrictedId), "--"))));
  });

  test("WithStatement not allowed", () => {
    validStmt(new Shift.WithStatement(EXPR, STMT));
    invalidExpr(1, strictFE(new Shift.WithStatement(EXPR, STMT)));
    invalidExpr(1, strictFE(strictFE(new Shift.WithStatement(EXPR, STMT))));
  });

});
