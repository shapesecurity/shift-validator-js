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

const { EarlyErrorChecker, Tokenizer, TokenType } = require("shift-parser");
const { reduce, MonoidalReducer } = require("shift-reducer");
const { keyword, code } = require("esutils");

const isValidRegex = require("shift-regexp-acceptor");

const { isIdentifierNameES6, isReservedWordES6 } = keyword;
const { isIdentifierStartES6: isIdentifierStart, isIdentifierPartES6: isIdentifierPart } = code;

const { ValidationContext, ValidationError } = require("./validation-context");
const ValidationErrorMessages = require("./validation-errors");

function isValid(node) {
  return Validator.validate(node).length === 0;
}

function isIterationStatement(type) {
  switch (type) {
    case "DoWhileStatement":
    case "WhileStatement":
    case "ForStatement":
    case "ForInStatement":
      return true;
  }
  return false;
}

function trailingStatement(node) {
  switch (node.type) {
  case "IfStatement":
    if (node.alternate != null) {
      return node.alternate;
    }
    return node.consequent;
  case "LabeledStatement":
  case "ForStatement":
  case "ForInStatement":
  case "ForOfStatement":
  case "WhileStatement":
  case "WithStatement":
    return node.body;
  }
  return null;
}

function isProblematicIfStatement(node) {
  if (node.type !== "IfStatement") {
    return false;
  }
  if (node.alternate == null) {
    return false;
  }
  let current = node.consequent;
  do {
    if (current.type === "IfStatement" && current.alternate == null) {
      return true;
    }
    current = trailingStatement(current);
  } while(current != null);
  return false;
}

function isValidIdentifier(name) {
  return name === 'let' || name === 'yield' || name === 'await' || name === 'async' || name === 'enum' || isIdentifierNameES6(name) && !isReservedWordES6(name);
}

function isValidIdentifierName(name) {
  return name.length > 0 && isIdentifierStart(name.charCodeAt(0)) && Array.prototype.every.call(name, c => isIdentifierPart(c.charCodeAt(0)));
}

function isValidStaticPropertyName(name) {
  return isIdentifierNameES6(name);
}

function isTemplateElement(rawValue) {
  try {
    let tokenizer = new Tokenizer('`' + rawValue + '`');
    tokenizer.lookahead = tokenizer.advance();
    let token = tokenizer.lex();
    if(token.type !== TokenType.TEMPLATE) {
      return false;
    }
    return tokenizer.eof();
  } catch(e) {
    return false;
  }
}

function isDirective(rawValue) {
  let stringify = c => {
    try {
      let tokenizer = new Tokenizer(c + rawValue + c);
      tokenizer.lookahead = tokenizer.advance();
      let token = tokenizer.lex();
      if(token.type !== TokenType.STRING) {
        return false;
      }
      return tokenizer.eof();
    } catch(e) {
      return false;
    }
  }
  return stringify('"') || stringify("'");
}

function checkIllegalBody(node, s, {allowFunctions = false} = {}) {
  if (node.body.type === 'FunctionDeclaration' && !allowFunctions) {
    return s.addError(new ValidationError(node, ValidationErrorMessages.FUNCTION_DECLARATION_AS_STATEMENT));
  } else if (node.body.type === 'ClassDeclaration' || node.body.type === 'FunctionDeclaration' && node.body.isGenerator || node.body.type === 'VariableDeclarationStatement' && (node.body.declaration.kind === 'let' || node.body.declaration.kind === 'const')) {
    return s.addError(new ValidationError(node, ValidationErrorMessages.PROPER_DECLARATION_AS_STATEMENT));
  }
  return s;
}

class Validator extends MonoidalReducer {
  constructor() {
    super(ValidationContext);
  }

  static validate(node) {
    return reduce(new Validator, node).errors.concat(EarlyErrorChecker.check(node));
  }

  reduceArrowExpression(node, {params, body}) {
    body = node.isAsync ? body.clearAwaitExpressionsNotInAsyncContext() : body.enforceAwaitExpressionsNotInAsyncContext();
    let s = super.reduceArrowExpression(node, {params, body: body.enforceYields()});
    return s;
  }

  reduceAssignmentTargetIdentifier(node) {
    let s = super.reduceAssignmentTargetIdentifier(node);
    if (!isValidIdentifier(node.name)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_BINDING_IDENTIFIER_NAME));
    }
    return s;
  }

  reduceBindingIdentifier(node) {
    let s = super.reduceBindingIdentifier(node);
    if (!isValidIdentifier(node.name)) {
      if (node.name == "*default*") {
        s = s.addBindingIdentifierCalledDefault(node);
      }
      else {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_BINDING_IDENTIFIER_NAME));
      }
    }
    return s;
  }

  reduceBreakStatement(node) {
    let s = super.reduceBreakStatement(node);
    if (node.label !== null && !isValidIdentifier(node.label)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_BREAK_STATEMENT_LABEL));
    }
    return s;
  }

  reduceContinueStatement(node) {
    let s = super.reduceContinueStatement(node);
    if (node.label !== null && !isValidIdentifier(node.label)) {
      s = s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_CONTINUE_STATEMENT_LABEL));
    }
    return s;
  }

  reduceDoWhileStatement(node, {body, test}) {
    let s = super.reduceDoWhileStatement(node, {body, test});
    s = checkIllegalBody(node, s);
    return s;
  }

  reduceDirective(node) {
    let s = super.reduceDirective(node);
    if (!isDirective(node.rawValue)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_DIRECTIVE));
    }
    return s;
  }

  reduceExportDefault(node, {body}) {
    let s = super.reduceExportDefault(node, {body});
    if (node.body.type === 'FunctionDeclaration' || node.body.type == 'ClassDeclaration') {
      s = s.clearBindingIdentifiersCalledDefault();
    }
    return s;
  }

  reduceExportFromSpecifier(node) {
    let s = super.reduceExportFromSpecifier(node);
    if (!isValidIdentifierName(node.name)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_EXPORT_SPECIFIER_NAME));
    }
    if (node.exportedName !== null && !isValidIdentifierName(node.exportedName)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_EXPORTED_NAME));
    }
    return s;
  }

  reduceExportLocalSpecifier(node, {name}) {
    let s = super.reduceExportLocalSpecifier(node, {name});
    if (node.exportedName !== null && !isIdentifierNameES6(node.exportedName)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_EXPORTED_NAME));
    }
    return s;
  }

  reduceForInStatement(node, {left, right, body}) {
    let s = super.reduceForInStatement(node, {left, right, body});
    if (node.left.type === 'VariableDeclaration') {
      if (node.left.declarators.length != 1) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.ONE_VARIABLE_DECLARATOR_IN_FOR_IN));
      }
      if (node.left.declarators.length > 0 && node.left.declarators[0].init !== null) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.NO_INIT_IN_VARIABLE_DECLARATOR_IN_FOR_IN));
      }
    }
    s = checkIllegalBody(node, s);
    return s;
  }

  reduceForOfStatement(node, {left, right, body}) {
    let s = super.reduceForOfStatement(node, {left, right, body});
    if (node.left.type === 'VariableDeclaration') {
      if (node.left.declarators.length != 1) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.ONE_VARIABLE_DECLARATOR_IN_FOR_OF));
      }
      if (node.left.declarators.length > 0 && node.left.declarators[0].init !== null) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.NO_INIT_IN_VARIABLE_DECLARATOR_IN_FOR_OF));
      }
    }
    s = checkIllegalBody(node, s);
    return s;
  }

  reduceForStatement(node, {init, update, test, body}) {
    let s = super.reduceForStatement(node, {init, update, test, body});
    s = checkIllegalBody(node, s);
    return s;
  }

  reduceFormalParameters(node, {items, rest}) {
    let s = super.reduceFormalParameters(node, {items, rest});
    s = s.enforceYields().enforceAwaitExpressionsNotInAsyncContext();
    return s;
  }

  reduceFunctionBody(node, {directives, statements}) {
    let s = super.reduceFunctionBody(node, {directives, statements});
    s = s.clearFreeReturnStatements();
    return s;
  }

  reduceFunctionDeclaration(node, {name, params, body}) {
    body = node.isGenerator ? body.clearYields() : body.enforceYields();
    body = node.isAsync ? body.clearAwaitExpressionsNotInAsyncContext() : body.enforceAwaitExpressionsNotInAsyncContext();
    let s = super.reduceFunctionDeclaration(node, {name, params, body});
    if (node.isGenerator && node.isAsync) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.ASYNC_GENERATOR_FUNCTION));
    }
    return s;
  }

  reduceFunctionExpression(node, {name, params, body}) {
    body = node.isGenerator ? body.clearYields() : body.enforceYields();
    body = node.isAsync ? body.clearAwaitExpressionsNotInAsyncContext() : body.enforceAwaitExpressionsNotInAsyncContext();
    let s = super.reduceFunctionExpression(node, {name, params, body});
    if (node.isGenerator && node.isAsync) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.ASYNC_GENERATOR_FUNCTION));
    }
   return s;
  }

  reduceGetter(node, {name, body}) {
    let s = super.reduceGetter(node, {name, body: body.enforceYields().enforceAwaitExpressionsNotInAsyncContext()});
    return s;
  }

  reduceIdentifierExpression(node) {
    let s = super.reduceIdentifierExpression(node);
    if (!isValidIdentifier(node.name)) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_IDENTIFIER_NAME));
    }
    return s;
  }

  reduceIfStatement(node, {test, consequent, alternate}) {
    let s = super.reduceIfStatement(node, {test, consequent, alternate});
    if (isProblematicIfStatement(node)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_IF_STATEMENT));
    }
    if (node.consequent.type === 'ClassDeclaration' || node.consequent.type === 'FunctionDeclaration' && node.consequent.isGenerator || node.consequent.type === 'VariableDeclarationStatement' && (node.consequent.declaration.kind === 'let' || node.consequent.declaration.kind === 'const')) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.PROPER_DECLARATION_AS_STATEMENT));
    }
    if (node.alternate && (node.alternate.type === 'ClassDeclaration' || node.alternate.type === 'FunctionDeclaration' && node.alternate.isGenerator || node.alternate.type === 'VariableDeclarationStatement' && (node.alternate.declaration.kind === 'let' || node.alternate.declaration.kind === 'const'))) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.PROPER_DECLARATION_AS_STATEMENT));
    }
    return s;
  }

  reduceImportSpecifier(node, {binding}) {
    let s = super.reduceImportSpecifier(node, {binding});
    if (node.name !== null && !isIdentifierNameES6(node.name)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_IMPORT_SPECIFIER_NAME));
    }
    return s;
  }

  reduceLabeledStatement(node, {body}) {
    let s = super.reduceLabeledStatement(node, {body});
    if (!isValidIdentifier(node.label)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_LABEL));
    }
    s = checkIllegalBody(node, s, {allowFunctions: true});
    return s;
  }

  reduceLiteralNumericExpression(node) {
    let s = super.reduceLiteralNumericExpression(node);
    if (isNaN(node.value)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.LITERAL_NUMERIC_VALUE_NOT_NAN));
    }
    if (node.value < 0 || node.value == 0 && 1 / node.value < 0) { // second case is for -0
      s = s.addError(new ValidationError(node, ValidationErrorMessages.LITERAL_NUMERIC_VALUE_NOT_NEGATIVE));
    }
    if (!isNaN(node.value) && !isFinite(node.value)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.LITERAL_NUMERIC_VALUE_NOT_INFINITE));
    }
    return s;
  }

  reduceLiteralRegExpExpression(node) {
    let s = super.reduceLiteralRegExpExpression(node);
    if (!isValidRegex(node.pattern, { unicode: node.unicode })) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_REG_EX_PATTERN));
    }
    return s;
  }

  reduceMethod(node, {params, body, name}) {
    body = node.isGenerator ? body.clearYields() : body.enforceYields();
    body = node.isAsync ? body.clearAwaitExpressionsNotInAsyncContext() : body.enforceAwaitExpressionsNotInAsyncContext();
    let s = super.reduceMethod(node, {params, body, name});
    if (node.isGenerator && node.isAsync) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.ASYNC_GENERATOR_FUNCTION));
    }
    return s;
  }

  reduceModule(node, {directives, items}) {
    let s = super.reduceModule(node, {directives, items});
    s = s.enforceFreeReturnStatements();
    s = s.enforceBindingIdentifiersCalledDefault();
    s = s.enforceYields();
    s = s.enforceAwaitExpressionsNotInAsyncContext();
    return s;
  }

  reduceReturnStatement(node, {expression}) {
    let s = super.reduceReturnStatement(node, {expression});
    s = s.addFreeReturnStatement(node);
    return s;
  }

  reduceScript(node, {directives, statements}) {
    let s = super.reduceScript(node, {directives, statements});
    s = s.enforceFreeReturnStatements();
    s = s.enforceBindingIdentifiersCalledDefault();
    s = s.enforceYields();
    s = s.enforceAwaitExpressionsNotInAsyncContext();
    return s;
  }

  reduceSetter(node, {name, param, body}) {
    let s = super.reduceSetter(node, {name, param, body: body.enforceYields().enforceAwaitExpressionsNotInAsyncContext()});
    return s;
  }

  reduceStaticMemberExpression(node, {object}) {
    let s = super.reduceStaticMemberExpression(node, {object});
    if (!isIdentifierNameES6(node.property)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_STATIC_MEMBER_EXPRESSION_PROPERTY_NAME));
    }
    return s;
  }

  reduceStaticMemberAssignmentTarget(node, { object }) {
    let s = super.reduceStaticMemberAssignmentTarget(node, {object});
    if (!isIdentifierNameES6(node.property)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_STATIC_MEMBER_ASSIGNMENT_TARGET_PROPERTY_NAME));
    }
    return s;
  }

  reduceTemplateElement(node) {
    let s = super.reduceTemplateElement(node);
    if (!isTemplateElement(node.rawValue)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_TEMPLATE_ELEMENT_VALUE));
    }
    return s;
  }

  reduceTemplateExpression(node, {tag, elements}) {
    let s = super.reduceTemplateExpression(node, {tag, elements});
    if (node.elements.length > 0) {
      if (node.elements.length % 2 == 0) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.ALTERNATING_TEMPLATE_EXPRESSION_ELEMENTS));
      } else {
        node.elements.forEach((x, i) => {
          if (i % 2 == 0) {
            if (!(x.type === 'TemplateElement')) {
              s = s.addError(new ValidationError(node, ValidationErrorMessages.ALTERNATING_TEMPLATE_EXPRESSION_ELEMENTS));
            }
          } else {
            if (x.type === 'TemplateElement') {
              s = s.addError(new ValidationError(node, ValidationErrorMessages.ALTERNATING_TEMPLATE_EXPRESSION_ELEMENTS));
            }
          }
        });
      }
    }
    return s;
  }

  reduceVariableDeclaration(node, {declarators}) {
    let s = super.reduceVariableDeclaration(node, {declarators});
    if (node.declarators.length == 0) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.NOT_EMPTY_VARIABLE_DECLARATORS_LIST));
    }
    return s;
  }

  reduceWhileStatement(node, {test, body}) {
    let s = super.reduceWhileStatement(node, {test, body});
    s = checkIllegalBody(node, s);
    return s;
  }

  reduceWithStatement(node, {object, body}) {
    let s = super.reduceWithStatement(node, {object, body});
    s = checkIllegalBody(node, s);
    return s;
  }

  reduceYieldExpression(node, {expression}) {
    let s = super.reduceYieldExpression(node, {expression});
    s = s.addYieldExpressionNotInGeneratorContext(node);
    return s;
  }

  reduceAwaitExpression(node, {expression}) {
    let s = super.reduceAwaitExpression(node, {expression});
    s = s.addAwaitExpressionNotInAsyncContext(node);
    return s;
  }

  reduceYieldGeneratorExpression(node, {expression}) {
    let s = super.reduceYieldGeneratorExpression(node, {expression});
    s = s.addYieldGeneratorExpressionNotInGeneratorContext(node);
    return s;
  }
}

module.exports = {
  default: isValid,
  isValid,
  Validator
}
