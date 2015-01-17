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

import reduce, {MonoidalReducer} from "shift-reducer";
import {keyword} from "esutils";
const {isIdentifierName} = keyword;

import {ValidationContext, ValidationError} from "./validation-context";

function uniqueIdentifiers(identifiers) {
  let set = Object.create(null);
  return identifiers.every((identifier) => {
    if (set[identifier.name]) return false;
    set[identifier.name] = true;
    return true;
  });
}

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

export class Validator extends MonoidalReducer {
  constructor() {
    super(ValidationContext);
  }

  static validate(node) {
    return reduce(new Validator, node).errors;
  }

  reduceAssignmentExpression(node, binding, expression) {
    let v = super.reduceAssignmentExpression(node, binding, expression);
    if (node.binding.type === "IdentifierExpression") {
      v = v.checkRestricted(node.binding.identifier);
    }
    return v;
  }

  reduceBreakStatement(node, label) {
    let v = super.reduceBreakStatement(node, label);
    return node.label == null
      ? v.addFreeBreakStatement(new ValidationError(node, "BreakStatement must be nested within switch or iteration statement"))
      : v.addFreeBreakJumpTarget(node.label);
  }

  reduceCatchClause(node, param, body) {
    return super.reduceCatchClause(node, param, body)
      .checkRestricted(node.binding);
  }

  reduceContinueStatement(node, body, label) {
    let v = super.reduceContinueStatement(node, body, label)
      .addFreeContinueStatement(new ValidationError(node, "ContinueStatement must be inside an iteration statement"));
    return node.label == null ? v : v.addFreeContinueJumpTarget(node.label);
  }

  reduceDoWhileStatement(node, body, test) {
    return super.reduceDoWhileStatement(node, body, test)
      .clearFreeContinueStatements()
      .clearFreeBreakStatements();
  }

  reduceForInStatement(node, left, right, body) {
    let v = super.reduceForInStatement(node, left, right, body)
      .clearFreeBreakStatements()
      .clearFreeContinueStatements();
    if (node.left.type === "VariableDeclaration" && node.left.declarators.length > 1) {
      v = v.addError(new ValidationError(node.left, "VariableDeclarationStatement in ForInVarStatement contains more than one VariableDeclarator"));
    }
    return v;
  }

  reduceForStatement(node, init, test, update, body) {
    return super.reduceForStatement(node, init, test, update, body)
      .clearFreeBreakStatements()
      .clearFreeContinueStatements();
  }

  reduceFunctionBody(node, directives, sourceElements) {
    let v = super.reduceFunctionBody(node, directives, sourceElements);
    if (v.freeJumpTargets.length > 0) {
      v = v.freeJumpTargets.reduce((v1, ident) => v1.addError(new ValidationError(ident, "Unbound break/continue label")), v);
    }
    const isStrict = node.directives.some(directive => directive.type === "UseStrictDirective");
    if (isStrict) {
      v = v.addErrors(v.strictErrors);
    }
    return v.addErrors(v.freeBreakStatements).addErrors(v.freeContinueStatements);
  }

  reduceFunctionDeclaration(node, name, parameters, functionBody) {
    let v = super.reduceFunctionDeclaration(node, name, parameters, functionBody)
      .clearUsedLabelNames()
      .clearFreeReturnStatements()
      .checkRestricted(node.name);
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionDeclaration must have unique parameter names"));
    }
    return node.parameters.reduce((v1, param) => v1.checkRestricted(param), v);
  }

  reduceFunctionExpression(node, name, parameters, functionBody) {
    let v = super.reduceFunctionExpression(node, name, parameters, functionBody)
      .clearFreeReturnStatements();
    if (node.name != null) {
      v = v.checkRestricted(node.name);
    }
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionExpression parameter names must be unique"));
    }
    return node.parameters.reduce((v1, param) => v1.checkRestricted(param), v);
  }

  reduceGetter(node, name, body) {
    return super.reduceGetter(node, name, body)
      .clearFreeReturnStatements();
  }

  reduceIdentifier(node) {
    let v = this.identity;
    if (!isIdentifierName(node.name)) {
      v = v.addError(new ValidationError(node, "Identifier `name` must be a valid IdentifierName"));
    }
    return v;
  }

  reduceIdentifierExpression(node, identifier) {
    return super.reduceIdentifierExpression(node, identifier)
      .checkReserved(node.identifier);
  }

  reduceIfStatement(node, test, consequent, alternate) {
    let v = super.reduceIfStatement(node, test, consequent, alternate);
    if (isProblematicIfStatement(node)) {
      v = v.addError(new ValidationError(node, "IfStatement with null `alternate` must not be the `consequent` of an IfStatement with a non-null `alternate`"));
    }
    return v;
  }

  reduceLabeledStatement(node, label, body) {
    let v = super.reduceLabeledStatement(node, label, body);
    if (v.usedLabelNames.some(s => s === node.label.name)) {
      v = v.addError(new ValidationError(node, "Duplicate label name."));
    }
    if (isIterationStatement(node.body.type)) {
        return v.observeIterationLabelName(node.label);
    }
    return v.observeNonIterationLabelName(node.label);
  }

  reduceLiteralNumericExpression(node) {
    let v = this.identity;
    if (node.value < 0 || node.value == 0 && 1 / node.value < 0) {
      v = v.addError(new ValidationError(node, "Numeric Literal node must be non-negative"));
    } else if (node.value !== node.value) {
      v = v.addError(new ValidationError(node, "Numeric Literal node must not be NaN"));
    } else if (!global.isFinite(node.value)) {
      v = v.addError(new ValidationError(node, "Numeric Literal node must be finite"));
    }
    return v;
  }

  reduceLiteralRegExpExpression(node) {
    let v = this.identity;
    const message = "LiteralRegExpExpresssion must contain a valid string representation of a RegExp",
      firstSlash = node.value.indexOf("/"),
      lastSlash = node.value.lastIndexOf("/");
    if (firstSlash !== 0 || firstSlash === lastSlash) {
      v = v.addError(new ValidationError(node, message));
    } else {
      try {
        RegExp(node.value.slice(1, lastSlash), node.value.slice(lastSlash + 1));
      } catch(e) {
        v = v.addError(new ValidationError(node, message));
      }
    }
    return v;
  }

  reduceObjectExpression(node, properties) {
    let v = super.reduceObjectExpression(node, properties);
    const setKeys = Object.create(null);
    const getKeys = Object.create(null);
    const dataKeys = Object.create(null);
    node.properties.forEach(p => {
      let key = ` ${p.name.value}`;
      switch (p.type) {
        case "DataProperty":
          if (p.name.value === "__proto__" && dataKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have multiple data properties with name __proto__"));
          }
          if (getKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have data and getter properties with same name"));
          }
          if (setKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have data and setter properties with same name"));
          }
          dataKeys[key] = true;
          break;
        case "Getter":
          if (getKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have multiple getters with the same name"));
          }
          if (dataKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have data and getter properties with the same name"));
          }
          getKeys[key] = true;
          break;
        case "Setter":
          if (setKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have multiple setters with the same name"));
          }
          if (dataKeys[key]) {
            v = v.addError(new ValidationError(node, "ObjectExpression must not have data and setter properties with the same name"));
          }
          setKeys[key] = true;
          break;
      }
    });
    return v;
  }

  reducePostfixExpression(node, operand) {
    let v = super.reducePostfixExpression(node, operand);
    if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression") {
      v = v.checkRestricted(node.operand.identifier);
    }
    return v;
  }

  reducePrefixExpression(node, operand) {
    let v = super.reducePrefixExpression(node, operand);
    if (node.operator === "delete" && node.operand.type === "IdentifierExpression") {
      v = v.addStrictError(new ValidationError(node, "`delete` with unqualified identifier not allowed in strict mode"));
    } else if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression") {
      v = v.checkRestricted(node.operand.identifier);
    }
    return v;
  }

  reducePropertyName(node) {
    let v = super.reducePropertyName(node);
    switch (node.kind) {
      case "identifier":
        if (!isIdentifierName(node.value)) {
          v = v.addError(new ValidationError(node, "PropertyName with identifier kind must have IdentifierName value"));
        }
        break;
      case "number":
        if (!/^(?:0|[1-9]\d*\.?\d*)$/.test(node.value)) {
          v = v.addError(new ValidationError(node, "PropertyName with number kind must have numeric value"));
        }
        break;
    }
    return v;
  }

  reduceReturnStatement(node, expression) {
    return super.reduceReturnStatement(node, expression)
      .addFreeReturnStatement(new ValidationError(node, "Return statement must be inside of a function"));
  }

  reduceScript(node, body) {
    return super.reduceScript(node, body)
      .addErrors(body.freeReturnStatements);
  }

  reduceSetter(node, name, parameter, body) {
    return super.reduceSetter(node, name, parameter, body)
      .clearFreeReturnStatements()
      .checkRestricted(node.parameter);
  }

  reduceSwitchStatement(node, discriminant, cases) {
    return super.reduceSwitchStatement(node, discriminant, cases)
      .clearFreeBreakStatements();
  }

  reduceSwitchStatementWithDefault(node, discriminant, preDefaultCases, defaultCase, postDefaultCases) {
    return super.reduceSwitchStatementWithDefault(node, discriminant, preDefaultCases, defaultCase, postDefaultCases)
      .clearFreeBreakStatements();
  }

  reduceVariableDeclarator(node, binding, init) {
    return super.reduceVariableDeclarator(node, binding, init)
      .checkRestricted(node.binding);
  }

  reduceWithStatement(node, object, body) {
    return super.reduceWithStatement(node, object, body)
      .addStrictError(new ValidationError(node, "WithStatement not allowed in strict mode"));
  }

  reduceWhileStatement(node, test, body) {
    return super.reduceWhileStatement(node, test, body)
      .clearFreeBreakStatements()
      .clearFreeContinueStatements();
  }
}
