"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports["default"] = isValid;
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

var _shiftReducer = require("shift-reducer");

var reduce = _shiftReducer["default"];
var MonoidalReducer = _shiftReducer.MonoidalReducer;
var keyword = require("esutils").keyword;
var isIdentifierName = keyword.isIdentifierName;
var _validationContext = require("./validation-context");

var ValidationContext = _validationContext.ValidationContext;
var ValidationError = _validationContext.ValidationError;


function uniqueIdentifiers(identifiers) {
  var set = Object.create(null);
  return identifiers.every(function (identifier) {
    if (set[identifier.name]) return false;
    set[identifier.name] = true;
    return true;
  });
}

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
  var current = node.consequent;
  do {
    if (current.type === "IfStatement" && current.alternate == null) {
      return true;
    }
    current = trailingStatement(current);
  } while (current != null);
  return false;
}

var Validator = exports.Validator = (function (MonoidalReducer) {
  function Validator() {
    _classCallCheck(this, Validator);

    _get(Object.getPrototypeOf(Validator.prototype), "constructor", this).call(this, ValidationContext);
  }

  _inherits(Validator, MonoidalReducer);

  _prototypeProperties(Validator, {
    validate: {
      value: function validate(node) {
        return reduce(new Validator(), node).errors;
      },
      writable: true,
      configurable: true
    }
  }, {
    reduceAssignmentExpression: {
      value: function reduceAssignmentExpression(node, binding, expression) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceAssignmentExpression", this).call(this, node, binding, expression);
        if (node.binding.type === "IdentifierExpression") {
          v = v.checkRestricted(node.binding.identifier);
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceBreakStatement: {
      value: function reduceBreakStatement(node, label) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceBreakStatement", this).call(this, node, label);
        return node.label == null ? v.addFreeBreakStatement(new ValidationError(node, "BreakStatement must be nested within switch or iteration statement")) : v.addFreeBreakJumpTarget(node.label);
      },
      writable: true,
      configurable: true
    },
    reduceCatchClause: {
      value: function reduceCatchClause(node, param, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceCatchClause", this).call(this, node, param, body).checkRestricted(node.binding);
      },
      writable: true,
      configurable: true
    },
    reduceContinueStatement: {
      value: function reduceContinueStatement(node, body, label) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceContinueStatement", this).call(this, node, body, label).addFreeContinueStatement(new ValidationError(node, "ContinueStatement must be inside an iteration statement"));
        return node.label == null ? v : v.addFreeContinueJumpTarget(node.label);
      },
      writable: true,
      configurable: true
    },
    reduceDoWhileStatement: {
      value: function reduceDoWhileStatement(node, body, test) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceDoWhileStatement", this).call(this, node, body, test).clearFreeContinueStatements().clearFreeBreakStatements();
      },
      writable: true,
      configurable: true
    },
    reduceForInStatement: {
      value: function reduceForInStatement(node, left, right, body) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceForInStatement", this).call(this, node, left, right, body).clearFreeBreakStatements().clearFreeContinueStatements();
        if (node.left.type === "VariableDeclaration" && node.left.declarators.length > 1) {
          v = v.addError(new ValidationError(node.left, "VariableDeclarationStatement in ForInVarStatement contains more than one VariableDeclarator"));
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceForStatement: {
      value: function reduceForStatement(node, init, test, update, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceForStatement", this).call(this, node, init, test, update, body).clearFreeBreakStatements().clearFreeContinueStatements();
      },
      writable: true,
      configurable: true
    },
    reduceFunctionBody: {
      value: function reduceFunctionBody(node, directives, sourceElements) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceFunctionBody", this).call(this, node, directives, sourceElements);
        if (v.freeJumpTargets.length > 0) {
          v = v.freeJumpTargets.reduce(function (v1, ident) {
            return v1.addError(new ValidationError(ident, "Unbound break/continue label"));
          }, v);
        }
        var isStrict = node.directives.some(function (directive) {
          return directive.type === "UseStrictDirective";
        });
        if (isStrict) {
          v = v.enforceStrictErrors();
        }
        return v.enforceFreeBreakAndContinueStatementErrors();
      },
      writable: true,
      configurable: true
    },
    reduceFunctionDeclaration: {
      value: function reduceFunctionDeclaration(node, name, parameters, functionBody) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceFunctionDeclaration", this).call(this, node, name, parameters, functionBody).clearUsedLabelNames().clearFreeReturnStatements().checkRestricted(node.name);
        if (!uniqueIdentifiers(node.parameters)) {
          v = v.addStrictError(new ValidationError(node, "FunctionDeclaration must have unique parameter names"));
        }
        return node.parameters.reduce(function (v1, param) {
          return v1.checkRestricted(param);
        }, v);
      },
      writable: true,
      configurable: true
    },
    reduceFunctionExpression: {
      value: function reduceFunctionExpression(node, name, parameters, functionBody) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceFunctionExpression", this).call(this, node, name, parameters, functionBody).clearFreeReturnStatements();
        if (node.name != null) {
          v = v.checkRestricted(node.name);
        }
        if (!uniqueIdentifiers(node.parameters)) {
          v = v.addStrictError(new ValidationError(node, "FunctionExpression parameter names must be unique"));
        }
        return node.parameters.reduce(function (v1, param) {
          return v1.checkRestricted(param);
        }, v);
      },
      writable: true,
      configurable: true
    },
    reduceGetter: {
      value: function reduceGetter(node, name, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceGetter", this).call(this, node, name, body).clearFreeReturnStatements();
      },
      writable: true,
      configurable: true
    },
    reduceIdentifier: {
      value: function reduceIdentifier(node) {
        var v = this.identity;
        if (!isIdentifierName(node.name)) {
          v = v.addError(new ValidationError(node, "Identifier `name` must be a valid IdentifierName"));
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceIdentifierExpression: {
      value: function reduceIdentifierExpression(node, identifier) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceIdentifierExpression", this).call(this, node, identifier).checkReserved(node.identifier);
      },
      writable: true,
      configurable: true
    },
    reduceIfStatement: {
      value: function reduceIfStatement(node, test, consequent, alternate) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceIfStatement", this).call(this, node, test, consequent, alternate);
        if (isProblematicIfStatement(node)) {
          v = v.addError(new ValidationError(node, "IfStatement with null `alternate` must not be the `consequent` of an IfStatement with a non-null `alternate`"));
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceLabeledStatement: {
      value: function reduceLabeledStatement(node, label, body) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceLabeledStatement", this).call(this, node, label, body);
        if (v.usedLabelNames.some(function (s) {
          return s === node.label.name;
        })) {
          v = v.addError(new ValidationError(node, "Duplicate label name."));
        }
        if (isIterationStatement(node.body.type)) {
          return v.observeIterationLabelName(node.label);
        }
        return v.observeNonIterationLabelName(node.label);
      },
      writable: true,
      configurable: true
    },
    reduceLiteralNumericExpression: {
      value: function reduceLiteralNumericExpression(node) {
        var v = this.identity;
        if (node.value < 0 || node.value == 0 && 1 / node.value < 0) {
          v = v.addError(new ValidationError(node, "Numeric Literal node must be non-negative"));
        } else if (node.value !== node.value) {
          v = v.addError(new ValidationError(node, "Numeric Literal node must not be NaN"));
        } else if (!global.isFinite(node.value)) {
          v = v.addError(new ValidationError(node, "Numeric Literal node must be finite"));
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceLiteralRegExpExpression: {
      value: function reduceLiteralRegExpExpression(node) {
        var v = this.identity;
        var message = "LiteralRegExpExpresssion must contain a valid string representation of a RegExp",
            firstSlash = node.value.indexOf("/"),
            lastSlash = node.value.lastIndexOf("/");
        if (firstSlash !== 0 || firstSlash === lastSlash) {
          v = v.addError(new ValidationError(node, message));
        } else {
          try {
            RegExp(node.value.slice(1, lastSlash), node.value.slice(lastSlash + 1));
          } catch (e) {
            v = v.addError(new ValidationError(node, message));
          }
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceObjectExpression: {
      value: function reduceObjectExpression(node, properties) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceObjectExpression", this).call(this, node, properties);
        var setKeys = Object.create(null);
        var getKeys = Object.create(null);
        var dataKeys = Object.create(null);
        node.properties.forEach(function (p) {
          var key = " " + p.name.value;
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
      },
      writable: true,
      configurable: true
    },
    reducePostfixExpression: {
      value: function reducePostfixExpression(node, operand) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reducePostfixExpression", this).call(this, node, operand);
        if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression") {
          v = v.checkRestricted(node.operand.identifier);
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reducePrefixExpression: {
      value: function reducePrefixExpression(node, operand) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reducePrefixExpression", this).call(this, node, operand);
        if (node.operator === "delete" && node.operand.type === "IdentifierExpression") {
          v = v.addStrictError(new ValidationError(node, "`delete` with unqualified identifier not allowed in strict mode"));
        } else if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression") {
          v = v.checkRestricted(node.operand.identifier);
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reducePropertyName: {
      value: function reducePropertyName(node) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reducePropertyName", this).call(this, node);
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
      },
      writable: true,
      configurable: true
    },
    reduceReturnStatement: {
      value: function reduceReturnStatement(node, expression) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceReturnStatement", this).call(this, node, expression).addFreeReturnStatement(new ValidationError(node, "Return statement must be inside of a function"));
      },
      writable: true,
      configurable: true
    },
    reduceScript: {
      value: function reduceScript(node, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceScript", this).call(this, node, body).enforceFreeReturnStatementErrors();
      },
      writable: true,
      configurable: true
    },
    reduceSetter: {
      value: function reduceSetter(node, name, parameter, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceSetter", this).call(this, node, name, parameter, body).clearFreeReturnStatements().checkRestricted(node.parameter);
      },
      writable: true,
      configurable: true
    },
    reduceSwitchStatement: {
      value: function reduceSwitchStatement(node, discriminant, cases) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceSwitchStatement", this).call(this, node, discriminant, cases).clearFreeBreakStatements();
      },
      writable: true,
      configurable: true
    },
    reduceSwitchStatementWithDefault: {
      value: function reduceSwitchStatementWithDefault(node, discriminant, preDefaultCases, defaultCase, postDefaultCases) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceSwitchStatementWithDefault", this).call(this, node, discriminant, preDefaultCases, defaultCase, postDefaultCases).clearFreeBreakStatements();
      },
      writable: true,
      configurable: true
    },
    reduceVariableDeclarator: {
      value: function reduceVariableDeclarator(node, binding, init) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceVariableDeclarator", this).call(this, node, binding, init).checkRestricted(node.binding);
        if (node.init == null) {
          v = v.addUninitialisedDeclarator(new ValidationError(node, "Constant declarations must be initialised"));
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceVariableDeclarationStatement: {
      value: function reduceVariableDeclarationStatement(node, declaration) {
        var v = _get(Object.getPrototypeOf(Validator.prototype), "reduceVariableDeclarationStatement", this).call(this, node, declaration);
        if (node.declaration.kind === "const") {
          v = v.enforceUninitialisedDeclarators();
        }
        return v;
      },
      writable: true,
      configurable: true
    },
    reduceWithStatement: {
      value: function reduceWithStatement(node, object, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceWithStatement", this).call(this, node, object, body).addStrictError(new ValidationError(node, "WithStatement not allowed in strict mode"));
      },
      writable: true,
      configurable: true
    },
    reduceWhileStatement: {
      value: function reduceWhileStatement(node, test, body) {
        return _get(Object.getPrototypeOf(Validator.prototype), "reduceWhileStatement", this).call(this, node, test, body).clearFreeBreakStatements().clearFreeContinueStatements();
      },
      writable: true,
      configurable: true
    }
  });

  return Validator;
})(MonoidalReducer);
//# sourceMappingURL=data:application/json;base64,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akMsWUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksRUFBRTtBQUNyQixXQUFDLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSwyQ0FBMkMsQ0FBQyxDQUFDLENBQUM7U0FDMUc7QUFDRCxlQUFPLENBQUMsQ0FBQztPQUNWOzs7O0FBRUQsc0NBQWtDO2FBQUEsNENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtBQUNwRCxZQUFJLENBQUMsOEJBaFJJLFNBQVMsb0VBZ1IrQixJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDcEUsWUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7QUFDckMsV0FBQyxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxDQUFDO1NBQ3pDO0FBQ0QsZUFBTyxDQUFDLENBQUM7T0FDVjs7OztBQUVELHVCQUFtQjthQUFBLDZCQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0FBQ3RDLGVBQU8sMkJBeFJFLFNBQVMscURBd1JlLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUNoRCxjQUFjLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLDBDQUEwQyxDQUFDLENBQUMsQ0FBQztPQUMxRjs7OztBQUVELHdCQUFvQjthQUFBLDhCQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQ3JDLGVBQU8sMkJBN1JFLFNBQVMsc0RBNlJnQixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDL0Msd0JBQXdCLEVBQUUsQ0FDMUIsMkJBQTJCLEVBQUUsQ0FBQztPQUNsQzs7Ozs7O1NBaFNVLFNBQVM7R0FBUyxlQUFlIiwiZmlsZSI6InNyYy9pbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgU2hhcGUgU2VjdXJpdHksIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgcmVkdWNlLCB7TW9ub2lkYWxSZWR1Y2VyfSBmcm9tIFwic2hpZnQtcmVkdWNlclwiO1xuaW1wb3J0IHtrZXl3b3JkfSBmcm9tIFwiZXN1dGlsc1wiO1xuY29uc3Qge2lzSWRlbnRpZmllck5hbWV9ID0ga2V5d29yZDtcblxuaW1wb3J0IHtWYWxpZGF0aW9uQ29udGV4dCwgVmFsaWRhdGlvbkVycm9yfSBmcm9tIFwiLi92YWxpZGF0aW9uLWNvbnRleHRcIjtcblxuZnVuY3Rpb24gdW5pcXVlSWRlbnRpZmllcnMoaWRlbnRpZmllcnMpIHtcbiAgbGV0IHNldCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHJldHVybiBpZGVudGlmaWVycy5ldmVyeSgoaWRlbnRpZmllcikgPT4ge1xuICAgIGlmIChzZXRbaWRlbnRpZmllci5uYW1lXSkgcmV0dXJuIGZhbHNlO1xuICAgIHNldFtpZGVudGlmaWVyLm5hbWVdID0gdHJ1ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGlzVmFsaWQobm9kZSkge1xuICByZXR1cm4gVmFsaWRhdG9yLnZhbGlkYXRlKG5vZGUpLmxlbmd0aCA9PT0gMDtcbn1cblxuZnVuY3Rpb24gaXNJdGVyYXRpb25TdGF0ZW1lbnQodHlwZSkge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFwiRG9XaGlsZVN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJXaGlsZVN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJGb3JTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiRm9ySW5TdGF0ZW1lbnRcIjpcbiAgICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gdHJhaWxpbmdTdGF0ZW1lbnQobm9kZSkge1xuICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICBjYXNlIFwiSWZTdGF0ZW1lbnRcIjpcbiAgICBpZiAobm9kZS5hbHRlcm5hdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5vZGUuYWx0ZXJuYXRlO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5jb25zZXF1ZW50O1xuXG4gIGNhc2UgXCJMYWJlbGVkU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJGb3JTdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIkZvckluU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJXaGlsZVN0YXRlbWVudFwiOlxuICBjYXNlIFwiV2l0aFN0YXRlbWVudFwiOlxuICAgIHJldHVybiBub2RlLmJvZHk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzUHJvYmxlbWF0aWNJZlN0YXRlbWVudChub2RlKSB7XG4gIGlmIChub2RlLnR5cGUgIT09IFwiSWZTdGF0ZW1lbnRcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAobm9kZS5hbHRlcm5hdGUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBsZXQgY3VycmVudCA9IG5vZGUuY29uc2VxdWVudDtcbiAgZG8ge1xuICAgIGlmIChjdXJyZW50LnR5cGUgPT09IFwiSWZTdGF0ZW1lbnRcIiAmJiBjdXJyZW50LmFsdGVybmF0ZSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY3VycmVudCA9IHRyYWlsaW5nU3RhdGVtZW50KGN1cnJlbnQpO1xuICB9IHdoaWxlKGN1cnJlbnQgIT0gbnVsbCk7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGNsYXNzIFZhbGlkYXRvciBleHRlbmRzIE1vbm9pZGFsUmVkdWNlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFZhbGlkYXRpb25Db250ZXh0KTtcbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZShub2RlKSB7XG4gICAgcmV0dXJuIHJlZHVjZShuZXcgVmFsaWRhdG9yLCBub2RlKS5lcnJvcnM7XG4gIH1cblxuICByZWR1Y2VBc3NpZ25tZW50RXhwcmVzc2lvbihub2RlLCBiaW5kaW5nLCBleHByZXNzaW9uKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VBc3NpZ25tZW50RXhwcmVzc2lvbihub2RlLCBiaW5kaW5nLCBleHByZXNzaW9uKTtcbiAgICBpZiAobm9kZS5iaW5kaW5nLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZy5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VCcmVha1N0YXRlbWVudChub2RlLCBsYWJlbCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlQnJlYWtTdGF0ZW1lbnQobm9kZSwgbGFiZWwpO1xuICAgIHJldHVybiBub2RlLmxhYmVsID09IG51bGxcbiAgICAgID8gdi5hZGRGcmVlQnJlYWtTdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkJyZWFrU3RhdGVtZW50IG11c3QgYmUgbmVzdGVkIHdpdGhpbiBzd2l0Y2ggb3IgaXRlcmF0aW9uIHN0YXRlbWVudFwiKSlcbiAgICAgIDogdi5hZGRGcmVlQnJlYWtKdW1wVGFyZ2V0KG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlQ2F0Y2hDbGF1c2Uobm9kZSwgcGFyYW0sIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlQ2F0Y2hDbGF1c2Uobm9kZSwgcGFyYW0sIGJvZHkpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZyk7XG4gIH1cblxuICByZWR1Y2VDb250aW51ZVN0YXRlbWVudChub2RlLCBib2R5LCBsYWJlbCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlQ29udGludWVTdGF0ZW1lbnQobm9kZSwgYm9keSwgbGFiZWwpXG4gICAgICAuYWRkRnJlZUNvbnRpbnVlU3RhdGVtZW50KG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJDb250aW51ZVN0YXRlbWVudCBtdXN0IGJlIGluc2lkZSBhbiBpdGVyYXRpb24gc3RhdGVtZW50XCIpKTtcbiAgICByZXR1cm4gbm9kZS5sYWJlbCA9PSBudWxsID8gdiA6IHYuYWRkRnJlZUNvbnRpbnVlSnVtcFRhcmdldChub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZURvV2hpbGVTdGF0ZW1lbnQobm9kZSwgYm9keSwgdGVzdCkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VEb1doaWxlU3RhdGVtZW50KG5vZGUsIGJvZHksIHRlc3QpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZUZvckluU3RhdGVtZW50KG5vZGUsIGxlZnQsIHJpZ2h0LCBib2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGb3JJblN0YXRlbWVudChub2RlLCBsZWZ0LCByaWdodCwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICAgIGlmIChub2RlLmxlZnQudHlwZSA9PT0gXCJWYXJpYWJsZURlY2xhcmF0aW9uXCIgJiYgbm9kZS5sZWZ0LmRlY2xhcmF0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZS5sZWZ0LCBcIlZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQgaW4gRm9ySW5WYXJTdGF0ZW1lbnQgY29udGFpbnMgbW9yZSB0aGFuIG9uZSBWYXJpYWJsZURlY2xhcmF0b3JcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUZvclN0YXRlbWVudChub2RlLCBpbml0LCB0ZXN0LCB1cGRhdGUsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlRm9yU3RhdGVtZW50KG5vZGUsIGluaXQsIHRlc3QsIHVwZGF0ZSwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25Cb2R5KG5vZGUsIGRpcmVjdGl2ZXMsIHNvdXJjZUVsZW1lbnRzKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGdW5jdGlvbkJvZHkobm9kZSwgZGlyZWN0aXZlcywgc291cmNlRWxlbWVudHMpO1xuICAgIGlmICh2LmZyZWVKdW1wVGFyZ2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICB2ID0gdi5mcmVlSnVtcFRhcmdldHMucmVkdWNlKCh2MSwgaWRlbnQpID0+IHYxLmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3IoaWRlbnQsIFwiVW5ib3VuZCBicmVhay9jb250aW51ZSBsYWJlbFwiKSksIHYpO1xuICAgIH1cbiAgICBjb25zdCBpc1N0cmljdCA9IG5vZGUuZGlyZWN0aXZlcy5zb21lKGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUudHlwZSA9PT0gXCJVc2VTdHJpY3REaXJlY3RpdmVcIik7XG4gICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICB2ID0gdi5lbmZvcmNlU3RyaWN0RXJyb3JzKCk7XG4gICAgfVxuICAgIHJldHVybiB2LmVuZm9yY2VGcmVlQnJlYWtBbmRDb250aW51ZVN0YXRlbWVudEVycm9ycygpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25EZWNsYXJhdGlvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRGVjbGFyYXRpb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KVxuICAgICAgLmNsZWFyVXNlZExhYmVsTmFtZXMoKVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLm5hbWUpO1xuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRGVjbGFyYXRpb24gbXVzdCBoYXZlIHVuaXF1ZSBwYXJhbWV0ZXIgbmFtZXNcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpO1xuICAgIGlmIChub2RlLm5hbWUgIT0gbnVsbCkge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUubmFtZSk7XG4gICAgfVxuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRXhwcmVzc2lvbiBwYXJhbWV0ZXIgbmFtZXMgbXVzdCBiZSB1bmlxdWVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUdldHRlcihub2RlLCBuYW1lLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZUdldHRlcihub2RlLCBuYW1lLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZUlkZW50aWZpZXIobm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIklkZW50aWZpZXIgYG5hbWVgIG11c3QgYmUgYSB2YWxpZCBJZGVudGlmaWVyTmFtZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlSWRlbnRpZmllckV4cHJlc3Npb24obm9kZSwgaWRlbnRpZmllcikge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VJZGVudGlmaWVyRXhwcmVzc2lvbihub2RlLCBpZGVudGlmaWVyKVxuICAgICAgLmNoZWNrUmVzZXJ2ZWQobm9kZS5pZGVudGlmaWVyKTtcbiAgfVxuXG4gIHJlZHVjZUlmU3RhdGVtZW50KG5vZGUsIHRlc3QsIGNvbnNlcXVlbnQsIGFsdGVybmF0ZSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlSWZTdGF0ZW1lbnQobm9kZSwgdGVzdCwgY29uc2VxdWVudCwgYWx0ZXJuYXRlKTtcbiAgICBpZiAoaXNQcm9ibGVtYXRpY0lmU3RhdGVtZW50KG5vZGUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiSWZTdGF0ZW1lbnQgd2l0aCBudWxsIGBhbHRlcm5hdGVgIG11c3Qgbm90IGJlIHRoZSBgY29uc2VxdWVudGAgb2YgYW4gSWZTdGF0ZW1lbnQgd2l0aCBhIG5vbi1udWxsIGBhbHRlcm5hdGVgXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIGxhYmVsLCBib2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIGxhYmVsLCBib2R5KTtcbiAgICBpZiAodi51c2VkTGFiZWxOYW1lcy5zb21lKHMgPT4gcyA9PT0gbm9kZS5sYWJlbC5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkR1cGxpY2F0ZSBsYWJlbCBuYW1lLlwiKSk7XG4gICAgfVxuICAgIGlmIChpc0l0ZXJhdGlvblN0YXRlbWVudChub2RlLmJvZHkudHlwZSkpIHtcbiAgICAgICAgcmV0dXJuIHYub2JzZXJ2ZUl0ZXJhdGlvbkxhYmVsTmFtZShub2RlLmxhYmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIHYub2JzZXJ2ZU5vbkl0ZXJhdGlvbkxhYmVsTmFtZShub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZUxpdGVyYWxOdW1lcmljRXhwcmVzc2lvbihub2RlKSB7XG4gICAgbGV0IHYgPSB0aGlzLmlkZW50aXR5O1xuICAgIGlmIChub2RlLnZhbHVlIDwgMCB8fCBub2RlLnZhbHVlID09IDAgJiYgMSAvIG5vZGUudmFsdWUgPCAwKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBiZSBub24tbmVnYXRpdmVcIikpO1xuICAgIH0gZWxzZSBpZiAobm9kZS52YWx1ZSAhPT0gbm9kZS52YWx1ZSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk51bWVyaWMgTGl0ZXJhbCBub2RlIG11c3Qgbm90IGJlIE5hTlwiKSk7XG4gICAgfSBlbHNlIGlmICghZ2xvYmFsLmlzRmluaXRlKG5vZGUudmFsdWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBiZSBmaW5pdGVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUxpdGVyYWxSZWdFeHBFeHByZXNzaW9uKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgY29uc3QgbWVzc2FnZSA9IFwiTGl0ZXJhbFJlZ0V4cEV4cHJlc3NzaW9uIG11c3QgY29udGFpbiBhIHZhbGlkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhIFJlZ0V4cFwiLFxuICAgICAgZmlyc3RTbGFzaCA9IG5vZGUudmFsdWUuaW5kZXhPZihcIi9cIiksXG4gICAgICBsYXN0U2xhc2ggPSBub2RlLnZhbHVlLmxhc3RJbmRleE9mKFwiL1wiKTtcbiAgICBpZiAoZmlyc3RTbGFzaCAhPT0gMCB8fCBmaXJzdFNsYXNoID09PSBsYXN0U2xhc2gpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBSZWdFeHAobm9kZS52YWx1ZS5zbGljZSgxLCBsYXN0U2xhc2gpLCBub2RlLnZhbHVlLnNsaWNlKGxhc3RTbGFzaCArIDEpKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIG1lc3NhZ2UpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VPYmplY3RFeHByZXNzaW9uKG5vZGUsIHByb3BlcnRpZXMpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZU9iamVjdEV4cHJlc3Npb24obm9kZSwgcHJvcGVydGllcyk7XG4gICAgY29uc3Qgc2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZ2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZGF0YUtleXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgbGV0IGtleSA9IGAgJHtwLm5hbWUudmFsdWV9YDtcbiAgICAgIHN3aXRjaCAocC50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJEYXRhUHJvcGVydHlcIjpcbiAgICAgICAgICBpZiAocC5uYW1lLnZhbHVlID09PSBcIl9fcHJvdG9fX1wiICYmIGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgZGF0YSBwcm9wZXJ0aWVzIHdpdGggbmFtZSBfX3Byb3RvX19cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZ2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBzZXR0ZXIgcHJvcGVydGllcyB3aXRoIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiR2V0dGVyXCI6XG4gICAgICAgICAgaWYgKGdldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBnZXR0ZXJzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhS2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGdldEtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJTZXR0ZXJcIjpcbiAgICAgICAgICBpZiAoc2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIHNldHRlcnMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgc2V0dGVyIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpO1xuICAgIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcmVmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVByZWZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCk7XG4gICAgaWYgKG5vZGUub3BlcmF0b3IgPT09IFwiZGVsZXRlXCIgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcImBkZWxldGVgIHdpdGggdW5xdWFsaWZpZWQgaWRlbnRpZmllciBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gICAgfSBlbHNlIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcm9wZXJ0eU5hbWUobm9kZSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlUHJvcGVydHlOYW1lKG5vZGUpO1xuICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICBjYXNlIFwiaWRlbnRpZmllclwiOlxuICAgICAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggaWRlbnRpZmllciBraW5kIG11c3QgaGF2ZSBJZGVudGlmaWVyTmFtZSB2YWx1ZVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgIGlmICghL14oPzowfFsxLTldXFxkKlxcLj9cXGQqKSQvLnRlc3Qobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggbnVtYmVyIGtpbmQgbXVzdCBoYXZlIG51bWVyaWMgdmFsdWVcIikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKVxuICAgICAgLmFkZEZyZWVSZXR1cm5TdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlJldHVybiBzdGF0ZW1lbnQgbXVzdCBiZSBpbnNpZGUgb2YgYSBmdW5jdGlvblwiKSk7XG4gIH1cblxuICByZWR1Y2VTY3JpcHQobm9kZSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTY3JpcHQobm9kZSwgYm9keSlcbiAgICAgIC5lbmZvcmNlRnJlZVJldHVyblN0YXRlbWVudEVycm9ycygpO1xuICB9XG5cbiAgcmVkdWNlU2V0dGVyKG5vZGUsIG5hbWUsIHBhcmFtZXRlciwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTZXR0ZXIobm9kZSwgbmFtZSwgcGFyYW1ldGVyLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLnBhcmFtZXRlcik7XG4gIH1cblxuICByZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcykge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcylcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZVN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0KG5vZGUsIGRpc2NyaW1pbmFudCwgcHJlRGVmYXVsdENhc2VzLCBkZWZhdWx0Q2FzZSwgcG9zdERlZmF1bHRDYXNlcykge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdChub2RlLCBkaXNjcmltaW5hbnQsIHByZURlZmF1bHRDYXNlcywgZGVmYXVsdENhc2UsIHBvc3REZWZhdWx0Q2FzZXMpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VWYXJpYWJsZURlY2xhcmF0b3Iobm9kZSwgYmluZGluZywgaW5pdCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlVmFyaWFibGVEZWNsYXJhdG9yKG5vZGUsIGJpbmRpbmcsIGluaXQpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZyk7XG4gICAgaWYgKG5vZGUuaW5pdCA9PSBudWxsKSB7XG4gICAgICB2ID0gdi5hZGRVbmluaXRpYWxpc2VkRGVjbGFyYXRvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiQ29uc3RhbnQgZGVjbGFyYXRpb25zIG11c3QgYmUgaW5pdGlhbGlzZWRcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQobm9kZSwgZGVjbGFyYXRpb24pIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQobm9kZSwgZGVjbGFyYXRpb24pO1xuICAgIGlmIChub2RlLmRlY2xhcmF0aW9uLmtpbmQgPT09IFwiY29uc3RcIikge1xuICAgICAgdiA9IHYuZW5mb3JjZVVuaW5pdGlhbGlzZWREZWNsYXJhdG9ycygpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVdpdGhTdGF0ZW1lbnQobm9kZSwgb2JqZWN0LCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVdpdGhTdGF0ZW1lbnQobm9kZSwgb2JqZWN0LCBib2R5KVxuICAgICAgLmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJXaXRoU3RhdGVtZW50IG5vdCBhbGxvd2VkIGluIHN0cmljdCBtb2RlXCIpKTtcbiAgfVxuXG4gIHJlZHVjZVdoaWxlU3RhdGVtZW50KG5vZGUsIHRlc3QsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlV2hpbGVTdGF0ZW1lbnQobm9kZSwgdGVzdCwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG59XG4iXX0=