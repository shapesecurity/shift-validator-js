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

import {Tokenizer, TokenType} from "shift-parser";
import reduce, {MonoidalReducer} from "shift-reducer";
import {keyword, code} from "esutils";
const {isIdentifierNameES6, isReservedWordES6} = keyword;
const {isIdentifierStartES6: isIdentifierStart, isIdentifierPartES6: isIdentifierPart} = code;

import {ValidationContext, ValidationError} from "./validation-context";
import ValidationErrorMessages from "./validation-errors";

export default function isValid(node) {
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

function isValidIdentifierName(name) {
  return name === 'let' || name == 'yield' || isIdentifierNameES6(name) && !isReservedWordES6(name);
  //return name.length > 0 && isIdentifierStart(name.charCodeAt(0)) && Array.prototype.every.call(name, c => isIdentifierPart(c.charCodeAt(0)));
  if (name.length === 0) {
    return false;
  }
  try {
    let res = (new Tokenizer(name)).scanIdentifier();
    return (res.type === TokenType.IDENTIFIER || res.type === TokenType.LET || res.type === TokenType.YIELD) && res.value === name;
  } catch(e) {
    return false;
  }
}

function isValidStaticPropertyName(name) {
  return isIdentifierNameES6(name);
}

function isValidRegex(pattern, flags) {
  return true; // TODO fix this when pattern-acceptor is fixed
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

export class Validator extends MonoidalReducer {
  constructor() {
    super(ValidationContext);
  }

  static validate(node) {
    return reduce(new Validator, node).errors;
  }

  reduceAssignmentTargetIdentifier(node) {
    let s = super.reduceAssignmentTargetIdentifier(node);
    if (!isValidIdentifierName(node.name)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_BINDING_IDENTIFIER_NAME));
    }
    return s;
  }

  reduceBindingIdentifier(node) {
    let s = super.reduceBindingIdentifier(node);
    if (!isValidIdentifierName(node.name)) {
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
    if (node.label !== null && !isValidIdentifierName(node.label)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_BREAK_STATEMENT_LABEL));
    }
    return s;
  }

  reduceContinueStatement(node) {
    let s = super.reduceContinueStatement(node);
    if (node.label !== null && !isValidIdentifierName(node.label)) {
      s = s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_CONTINUE_STATEMENT_LABEL));
    }
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
    if (node.exportedName !== null && !isIdentifierNameES6(node.exportedName)) {
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
    return s;
  }

  reduceFunctionBody(node, {directives, statements}) {
    let s = super.reduceFunctionBody(node, {directives, statements});
    s = s.clearFreeReturnStatements();
    return s;
  }

  reduceFunctionDeclaration(node, {name, params, body}) {
    let s = super.reduceFunctionDeclaration(node, {name, params, body});
    if (node.isGenerator) {
      s = s.clearYieldExpressionsNotInGeneratorContext();
      s = s.clearYieldGeneratorExpressionsNotInGeneratorContext();
    }
    return s;
  }

  reduceFunctionExpression(node, {name, params, body}) {
    let s = super.reduceFunctionExpression(node, {name, params, body});
    if (node.isGenerator) {
      s = s.clearYieldExpressionsNotInGeneratorContext();
      s = s.clearYieldGeneratorExpressionsNotInGeneratorContext();
    }
    return s;
  }

  reduceIdentifierExpression(node) {
    let s = super.reduceIdentifierExpression(node);
    if (!isValidIdentifierName(node.name)) {
        s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_IDENTIFIER_NAME));
    }
    return s;
  }

  reduceIfStatement(node, {test, consequent, alternate}) {
    let s = super.reduceIfStatement(node, {test, consequent, alternate});
    if (isProblematicIfStatement(node)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_IF_STATEMENT));
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
    if (!isValidIdentifierName(node.label)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_LABEL));
    }
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
    if (!isValidRegex(node.pattern, node.flags)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_REG_EX_PATTERN));
    }
    return s;
  }

  reduceMethod(node, {params, body, name}) {
    let s = super.reduceMethod(node, {params, body, name});
    if (node.isGenerator) {
      s = s.clearYieldExpressionsNotInGeneratorContext();
      s = s.clearYieldGeneratorExpressionsNotInGeneratorContext();
    }
    return s;
  }

  reduceModule(node, {directives, items}) {
    let s = super.reduceModule(node, {directives, items});
    s = s.enforceFreeReturnStatements();
    s = s.enforceBindingIdentifiersCalledDefault();
    s = s.enforceYieldExpressionsNotInGeneratorContext();
    s = s.enforceYieldGeneratorExpressionsNotInGeneratorContext();
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
    s = s.enforceYieldExpressionsNotInGeneratorContext();
    s = s.enforceYieldGeneratorExpressionsNotInGeneratorContext();
    return s;
  }

  reduceStaticMemberExpression(node, {object}) {
    let s = super.reduceStaticMemberExpression(node, {object});
    if (!isIdentifierNameES6(node.property)) {
      s = s.addError(new ValidationError(node, ValidationErrorMessages.VALID_STATIC_MEMBER_EXPRESSION_PROPERTY_NAME));
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

  reduceVariableDeclarationStatement(node, {declaration}) {
    let s = super.reduceVariableDeclarationStatement(node, {declaration});
    if (node.declaration.kind === 'const') {
      node.declaration.declarators.forEach(x => {
        if (x.init === null) {
          s = s.addError(new ValidationError(node, ValidationErrorMessages.CONST_VARIABLE_DECLARATION_MUST_HAVE_INIT));
        }
      });
    }
    return s;
  }

  reduceYieldExpression(node, {expression}) {
    let s = super.reduceYieldExpression(node, {expression});
    s = s.addYieldExpressionNotInGeneratorContext(node);
    return s;
  }

  reduceYieldGeneratorExpression(node, {expression}) {
    let s = super.reduceYieldGeneratorExpression(node, {expression});
    s = s.addYieldGeneratorExpressionNotInGeneratorContext(node);
    return s;
  }
}
