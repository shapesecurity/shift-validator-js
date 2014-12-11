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
const {isRestrictedWord, isIdentifierName, isReservedWordES5, isReservedWordES6} = keyword;

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

export class Validator extends MonoidalReducer {
  constructor() {
    super(ValidationContext);
  }

  static validate(node) {
    return reduce(new Validator, node).errors;
  }

  reduceAssignmentExpression(node, binding, expression) {
    let v = super.reduceAssignmentExpression(node, binding, expression);
    if (node.binding.type === "IdentifierExpression" && isRestrictedWord(node.binding.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "IdentifierExpression must not be a restricted word"));
    }
    return v;
  }

  reduceBreakStatement(node, label) {
    let v = super.reduceBreakStatement(node, label);
    return node.label == null
      ? v.addFreeBreakStatement(new ValidationError(node, "break must be nested within switch or iteration statement"))
      : v.addFreeJumpTarget(node.label);
  }

  reduceCatchClause(node, param, body) {
    let v = super.reduceCatchClause(node, param, body);
    if (isRestrictedWord(node.binding.name)) {
      v = v.addStrictError(new ValidationError(node, "CatchClause binding must not be restricted in strict mode"));
    }
    return v;
  }

  reduceContinueStatement(node, body, label) {
    let v = super.reduceContinueStatement(node, body, label)
      .addFreeContinueStatement(new ValidationError(node, "Continue statement must be inside a recursive loop"));
    return node.label == null ? v : v.addFreeJumpTarget(node.label);
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
      .clearFreeReturnStatements();
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionDeclaration must have unique parameter names"));
    }
    v = node.parameters.reduce((v1, param) => {
      if (isRestrictedWord(param.name)) {
        return v1.addStrictError(new ValidationError(param, "FunctionDeclaration parameter name must not be restricted word"));
      }
      return v1;
    }, v);
    if (isRestrictedWord(node.name.name)) {
      v = v.addStrictError(new ValidationError(node, "FunctionDeclaration `name` must not be `eval` or `arguments` in strict mode"));
    }
    return v;
  }

  reduceFunctionExpression(node, name, parameters, functionBody) {
    let v = super.reduceFunctionExpression(node, name, parameters, functionBody)
      .clearFreeReturnStatements();
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionExpression parameter names must be unique"));
    }
    v = node.parameters.reduce((v1, param) => {
      if (isRestrictedWord(param.name)) {
        return v1.addStrictError(new ValidationError(param, "FunctionExpression parameter name must not be restricted word"));
      }
      return v1;
    }, v);
    return node.name == null || !isRestrictedWord(node.name.name)
      ? v
      : v.addStrictError(new ValidationError(node, "FunctionExpression `name` must not be `eval` or `arguments` in strict mode"));
  }

  reduceIdentifier(node) {
    let v = this.identity();
    if (!isIdentifierName(node.name)) {
      v = v.addError(new ValidationError(node, "Identifier `name` must be a valid IdentifierName"));
    }
    if (isReservedWordES5(node.name, false)) {
      v = v.addError(new ValidationError(node, "Identifier `name` must not be a reserved word"));
    }
    return v;
  }

  reduceIdentifierExpression(node, identifier) {
    let v = super.reduceIdentifierExpression(node, identifier);
    if (isReservedWordES5(node.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "Reserved word used in IdentifierExpression"));
    } else if (isReservedWordES6(node.identifier.name, true)) {
      v = v.addStrictError(new ValidationError(node, "Strict mode reserved word used in IdentifierExpression"));
    }
    return v;
  }

  reduceLabeledStatement(node, label, body) {
    let v = super.reduceLabeledStatement(node, label, body);
    if (v.usedLabelNames.some(s => s === node.label.name)) {
      v = v.addError(new ValidationError(node, "Duplicate label name."));
    }
    return v.observeLabelName(node.label);
  }

  reduceLiteralNumericExpression(node) {
    let v = this.identity();
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
    let v = this.identity();
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
    if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression" && isRestrictedWord(node.operand.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "Restricted words must not be incremented/decremented in strict mode"));
    }
    return v;
  }

  reducePrefixExpression(node, operand) {
    let v = super.reducePrefixExpression(node, operand);
    if (node.operator === "delete" && node.operand.type === "IdentifierExpression") {
      v = v.addStrictError(new ValidationError(node, "`delete` with unqualified identifier not allowed in strict mode"));
    } else if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression" && isRestrictedWord(node.operand.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "Restricted words must not be incremented/decremented in strict mode"));
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
    let v = super.reduceSetter(node, name, parameter, body);
    if (isRestrictedWord(node.parameter.name)) {
      v = v.addStrictError(new ValidationError(node, "SetterProperty parameter must not be a restricted name"));
    }
    return v;
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
    let v = super.reduceVariableDeclarator(node, binding, init);
    if (isRestrictedWord(node.binding.name)) {
      v = v.addStrictError(new ValidationError(node, "VariableDeclarator must not be restricted name"));
    }
    return v;
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
