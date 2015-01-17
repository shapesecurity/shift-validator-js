"use strict";

var _extends = function (child, parent) {
  child.prototype = Object.create(parent.prototype, {
    constructor: {
      value: child,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  child.__proto__ = parent;
};

var reduce = require("shift-reducer")["default"];
var MonoidalReducer = require("shift-reducer").MonoidalReducer;
var keyword = require("esutils").keyword;
var isIdentifierName = keyword.isIdentifierName;
var ValidationContext = require("./validation-context").ValidationContext;
var ValidationError = require("./validation-context").ValidationError;


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

exports["default"] = isValid;
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

var Validator = (function (MonoidalReducer) {
  var Validator = function Validator() {
    MonoidalReducer.call(this, ValidationContext);
  };

  _extends(Validator, MonoidalReducer);

  Validator.validate = function (node) {
    return reduce(new Validator(), node).errors;
  };

  Validator.prototype.reduceAssignmentExpression = function (node, binding, expression) {
    var v = MonoidalReducer.prototype.reduceAssignmentExpression.call(this, node, binding, expression);
    if (node.binding.type === "IdentifierExpression") {
      v = v.checkRestricted(node.binding.identifier);
    }
    return v;
  };

  Validator.prototype.reduceBreakStatement = function (node, label) {
    var v = MonoidalReducer.prototype.reduceBreakStatement.call(this, node, label);
    return node.label == null ? v.addFreeBreakStatement(new ValidationError(node, "BreakStatement must be nested within switch or iteration statement")) : v.addFreeBreakJumpTarget(node.label);
  };

  Validator.prototype.reduceCatchClause = function (node, param, body) {
    return MonoidalReducer.prototype.reduceCatchClause.call(this, node, param, body).checkRestricted(node.binding);
  };

  Validator.prototype.reduceContinueStatement = function (node, body, label) {
    var v = MonoidalReducer.prototype.reduceContinueStatement.call(this, node, body, label).addFreeContinueStatement(new ValidationError(node, "ContinueStatement must be inside an iteration statement"));
    return node.label == null ? v : v.addFreeContinueJumpTarget(node.label);
  };

  Validator.prototype.reduceDoWhileStatement = function (node, body, test) {
    return MonoidalReducer.prototype.reduceDoWhileStatement.call(this, node, body, test).clearFreeContinueStatements().clearFreeBreakStatements();
  };

  Validator.prototype.reduceForInStatement = function (node, left, right, body) {
    var v = MonoidalReducer.prototype.reduceForInStatement.call(this, node, left, right, body).clearFreeBreakStatements().clearFreeContinueStatements();
    if (node.left.type === "VariableDeclaration" && node.left.declarators.length > 1) {
      v = v.addError(new ValidationError(node.left, "VariableDeclarationStatement in ForInVarStatement contains more than one VariableDeclarator"));
    }
    return v;
  };

  Validator.prototype.reduceForStatement = function (node, init, test, update, body) {
    return MonoidalReducer.prototype.reduceForStatement.call(this, node, init, test, update, body).clearFreeBreakStatements().clearFreeContinueStatements();
  };

  Validator.prototype.reduceFunctionBody = function (node, directives, sourceElements) {
    var v = MonoidalReducer.prototype.reduceFunctionBody.call(this, node, directives, sourceElements);
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
  };

  Validator.prototype.reduceFunctionDeclaration = function (node, name, parameters, functionBody) {
    var v = MonoidalReducer.prototype.reduceFunctionDeclaration.call(this, node, name, parameters, functionBody).clearUsedLabelNames().clearFreeReturnStatements().checkRestricted(node.name);
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionDeclaration must have unique parameter names"));
    }
    return node.parameters.reduce(function (v1, param) {
      return v1.checkRestricted(param);
    }, v);
  };

  Validator.prototype.reduceFunctionExpression = function (node, name, parameters, functionBody) {
    var v = MonoidalReducer.prototype.reduceFunctionExpression.call(this, node, name, parameters, functionBody).clearFreeReturnStatements();
    if (node.name != null) {
      v = v.checkRestricted(node.name);
    }
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionExpression parameter names must be unique"));
    }
    return node.parameters.reduce(function (v1, param) {
      return v1.checkRestricted(param);
    }, v);
  };

  Validator.prototype.reduceGetter = function (node, name, body) {
    return MonoidalReducer.prototype.reduceGetter.call(this, node, name, body).clearFreeReturnStatements();
  };

  Validator.prototype.reduceIdentifier = function (node) {
    var v = this.identity;
    if (!isIdentifierName(node.name)) {
      v = v.addError(new ValidationError(node, "Identifier `name` must be a valid IdentifierName"));
    }
    return v;
  };

  Validator.prototype.reduceIdentifierExpression = function (node, identifier) {
    return MonoidalReducer.prototype.reduceIdentifierExpression.call(this, node, identifier).checkReserved(node.identifier);
  };

  Validator.prototype.reduceIfStatement = function (node, test, consequent, alternate) {
    var v = MonoidalReducer.prototype.reduceIfStatement.call(this, node, test, consequent, alternate);
    if (isProblematicIfStatement(node)) {
      v = v.addError(new ValidationError(node, "IfStatement with null `alternate` must not be the `consequent` of an IfStatement with a non-null `alternate`"));
    }
    return v;
  };

  Validator.prototype.reduceLabeledStatement = function (node, label, body) {
    var v = MonoidalReducer.prototype.reduceLabeledStatement.call(this, node, label, body);
    if (v.usedLabelNames.some(function (s) {
      return s === node.label.name;
    })) {
      v = v.addError(new ValidationError(node, "Duplicate label name."));
    }
    if (isIterationStatement(node.body.type)) {
      return v.observeIterationLabelName(node.label);
    }
    return v.observeNonIterationLabelName(node.label);
  };

  Validator.prototype.reduceLiteralNumericExpression = function (node) {
    var v = this.identity;
    if (node.value < 0 || node.value == 0 && 1 / node.value < 0) {
      v = v.addError(new ValidationError(node, "Numeric Literal node must be non-negative"));
    } else if (node.value !== node.value) {
      v = v.addError(new ValidationError(node, "Numeric Literal node must not be NaN"));
    } else if (!global.isFinite(node.value)) {
      v = v.addError(new ValidationError(node, "Numeric Literal node must be finite"));
    }
    return v;
  };

  Validator.prototype.reduceLiteralRegExpExpression = function (node) {
    var v = this.identity;
    var message = "LiteralRegExpExpresssion must contain a valid string representation of a RegExp", firstSlash = node.value.indexOf("/"), lastSlash = node.value.lastIndexOf("/");
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
  };

  Validator.prototype.reduceObjectExpression = function (node, properties) {
    var v = MonoidalReducer.prototype.reduceObjectExpression.call(this, node, properties);
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
  };

  Validator.prototype.reducePostfixExpression = function (node, operand) {
    var v = MonoidalReducer.prototype.reducePostfixExpression.call(this, node, operand);
    if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression") {
      v = v.checkRestricted(node.operand.identifier);
    }
    return v;
  };

  Validator.prototype.reducePrefixExpression = function (node, operand) {
    var v = MonoidalReducer.prototype.reducePrefixExpression.call(this, node, operand);
    if (node.operator === "delete" && node.operand.type === "IdentifierExpression") {
      v = v.addStrictError(new ValidationError(node, "`delete` with unqualified identifier not allowed in strict mode"));
    } else if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression") {
      v = v.checkRestricted(node.operand.identifier);
    }
    return v;
  };

  Validator.prototype.reducePropertyName = function (node) {
    var v = MonoidalReducer.prototype.reducePropertyName.call(this, node);
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
  };

  Validator.prototype.reduceReturnStatement = function (node, expression) {
    return MonoidalReducer.prototype.reduceReturnStatement.call(this, node, expression).addFreeReturnStatement(new ValidationError(node, "Return statement must be inside of a function"));
  };

  Validator.prototype.reduceScript = function (node, body) {
    return MonoidalReducer.prototype.reduceScript.call(this, node, body).enforceFreeReturnStatementErrors();
  };

  Validator.prototype.reduceSetter = function (node, name, parameter, body) {
    return MonoidalReducer.prototype.reduceSetter.call(this, node, name, parameter, body).clearFreeReturnStatements().checkRestricted(node.parameter);
  };

  Validator.prototype.reduceSwitchStatement = function (node, discriminant, cases) {
    return MonoidalReducer.prototype.reduceSwitchStatement.call(this, node, discriminant, cases).clearFreeBreakStatements();
  };

  Validator.prototype.reduceSwitchStatementWithDefault = function (node, discriminant, preDefaultCases, defaultCase, postDefaultCases) {
    return MonoidalReducer.prototype.reduceSwitchStatementWithDefault.call(this, node, discriminant, preDefaultCases, defaultCase, postDefaultCases).clearFreeBreakStatements();
  };

  Validator.prototype.reduceVariableDeclarator = function (node, binding, init) {
    return MonoidalReducer.prototype.reduceVariableDeclarator.call(this, node, binding, init).checkRestricted(node.binding);
  };

  Validator.prototype.reduceWithStatement = function (node, object, body) {
    return MonoidalReducer.prototype.reduceWithStatement.call(this, node, object, body).addStrictError(new ValidationError(node, "WithStatement not allowed in strict mode"));
  };

  Validator.prototype.reduceWhileStatement = function (node, test, body) {
    return MonoidalReducer.prototype.reduceWhileStatement.call(this, node, test, body).clearFreeBreakStatements().clearFreeContinueStatements();
  };

  return Validator;
})(MonoidalReducer);

exports.Validator = Validator;
//# sourceMappingURL=data:application/json;base64,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ZSI6InNyYy9pbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgU2hhcGUgU2VjdXJpdHksIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgcmVkdWNlLCB7TW9ub2lkYWxSZWR1Y2VyfSBmcm9tIFwic2hpZnQtcmVkdWNlclwiO1xuaW1wb3J0IHtrZXl3b3JkfSBmcm9tIFwiZXN1dGlsc1wiO1xuY29uc3Qge2lzSWRlbnRpZmllck5hbWV9ID0ga2V5d29yZDtcblxuaW1wb3J0IHtWYWxpZGF0aW9uQ29udGV4dCwgVmFsaWRhdGlvbkVycm9yfSBmcm9tIFwiLi92YWxpZGF0aW9uLWNvbnRleHRcIjtcblxuZnVuY3Rpb24gdW5pcXVlSWRlbnRpZmllcnMoaWRlbnRpZmllcnMpIHtcbiAgbGV0IHNldCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHJldHVybiBpZGVudGlmaWVycy5ldmVyeSgoaWRlbnRpZmllcikgPT4ge1xuICAgIGlmIChzZXRbaWRlbnRpZmllci5uYW1lXSkgcmV0dXJuIGZhbHNlO1xuICAgIHNldFtpZGVudGlmaWVyLm5hbWVdID0gdHJ1ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGlzVmFsaWQobm9kZSkge1xuICByZXR1cm4gVmFsaWRhdG9yLnZhbGlkYXRlKG5vZGUpLmxlbmd0aCA9PT0gMDtcbn1cblxuZnVuY3Rpb24gaXNJdGVyYXRpb25TdGF0ZW1lbnQodHlwZSkge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFwiRG9XaGlsZVN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJXaGlsZVN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJGb3JTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiRm9ySW5TdGF0ZW1lbnRcIjpcbiAgICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gdHJhaWxpbmdTdGF0ZW1lbnQobm9kZSkge1xuICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICBjYXNlIFwiSWZTdGF0ZW1lbnRcIjpcbiAgICBpZiAobm9kZS5hbHRlcm5hdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5vZGUuYWx0ZXJuYXRlO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5jb25zZXF1ZW50O1xuXG4gIGNhc2UgXCJMYWJlbGVkU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJGb3JTdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIkZvckluU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJXaGlsZVN0YXRlbWVudFwiOlxuICBjYXNlIFwiV2l0aFN0YXRlbWVudFwiOlxuICAgIHJldHVybiBub2RlLmJvZHk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzUHJvYmxlbWF0aWNJZlN0YXRlbWVudChub2RlKSB7XG4gIGlmIChub2RlLnR5cGUgIT09IFwiSWZTdGF0ZW1lbnRcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAobm9kZS5hbHRlcm5hdGUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBsZXQgY3VycmVudCA9IG5vZGUuY29uc2VxdWVudDtcbiAgZG8ge1xuICAgIGlmIChjdXJyZW50LnR5cGUgPT09IFwiSWZTdGF0ZW1lbnRcIiAmJiBjdXJyZW50LmFsdGVybmF0ZSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY3VycmVudCA9IHRyYWlsaW5nU3RhdGVtZW50KGN1cnJlbnQpO1xuICB9IHdoaWxlKGN1cnJlbnQgIT0gbnVsbCk7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGNsYXNzIFZhbGlkYXRvciBleHRlbmRzIE1vbm9pZGFsUmVkdWNlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFZhbGlkYXRpb25Db250ZXh0KTtcbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZShub2RlKSB7XG4gICAgcmV0dXJuIHJlZHVjZShuZXcgVmFsaWRhdG9yLCBub2RlKS5lcnJvcnM7XG4gIH1cblxuICByZWR1Y2VBc3NpZ25tZW50RXhwcmVzc2lvbihub2RlLCBiaW5kaW5nLCBleHByZXNzaW9uKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VBc3NpZ25tZW50RXhwcmVzc2lvbihub2RlLCBiaW5kaW5nLCBleHByZXNzaW9uKTtcbiAgICBpZiAobm9kZS5iaW5kaW5nLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZy5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VCcmVha1N0YXRlbWVudChub2RlLCBsYWJlbCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlQnJlYWtTdGF0ZW1lbnQobm9kZSwgbGFiZWwpO1xuICAgIHJldHVybiBub2RlLmxhYmVsID09IG51bGxcbiAgICAgID8gdi5hZGRGcmVlQnJlYWtTdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkJyZWFrU3RhdGVtZW50IG11c3QgYmUgbmVzdGVkIHdpdGhpbiBzd2l0Y2ggb3IgaXRlcmF0aW9uIHN0YXRlbWVudFwiKSlcbiAgICAgIDogdi5hZGRGcmVlQnJlYWtKdW1wVGFyZ2V0KG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlQ2F0Y2hDbGF1c2Uobm9kZSwgcGFyYW0sIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlQ2F0Y2hDbGF1c2Uobm9kZSwgcGFyYW0sIGJvZHkpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZyk7XG4gIH1cblxuICByZWR1Y2VDb250aW51ZVN0YXRlbWVudChub2RlLCBib2R5LCBsYWJlbCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlQ29udGludWVTdGF0ZW1lbnQobm9kZSwgYm9keSwgbGFiZWwpXG4gICAgICAuYWRkRnJlZUNvbnRpbnVlU3RhdGVtZW50KG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJDb250aW51ZVN0YXRlbWVudCBtdXN0IGJlIGluc2lkZSBhbiBpdGVyYXRpb24gc3RhdGVtZW50XCIpKTtcbiAgICByZXR1cm4gbm9kZS5sYWJlbCA9PSBudWxsID8gdiA6IHYuYWRkRnJlZUNvbnRpbnVlSnVtcFRhcmdldChub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZURvV2hpbGVTdGF0ZW1lbnQobm9kZSwgYm9keSwgdGVzdCkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VEb1doaWxlU3RhdGVtZW50KG5vZGUsIGJvZHksIHRlc3QpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZUZvckluU3RhdGVtZW50KG5vZGUsIGxlZnQsIHJpZ2h0LCBib2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGb3JJblN0YXRlbWVudChub2RlLCBsZWZ0LCByaWdodCwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICAgIGlmIChub2RlLmxlZnQudHlwZSA9PT0gXCJWYXJpYWJsZURlY2xhcmF0aW9uXCIgJiYgbm9kZS5sZWZ0LmRlY2xhcmF0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZS5sZWZ0LCBcIlZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQgaW4gRm9ySW5WYXJTdGF0ZW1lbnQgY29udGFpbnMgbW9yZSB0aGFuIG9uZSBWYXJpYWJsZURlY2xhcmF0b3JcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUZvclN0YXRlbWVudChub2RlLCBpbml0LCB0ZXN0LCB1cGRhdGUsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlRm9yU3RhdGVtZW50KG5vZGUsIGluaXQsIHRlc3QsIHVwZGF0ZSwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25Cb2R5KG5vZGUsIGRpcmVjdGl2ZXMsIHNvdXJjZUVsZW1lbnRzKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGdW5jdGlvbkJvZHkobm9kZSwgZGlyZWN0aXZlcywgc291cmNlRWxlbWVudHMpO1xuICAgIGlmICh2LmZyZWVKdW1wVGFyZ2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICB2ID0gdi5mcmVlSnVtcFRhcmdldHMucmVkdWNlKCh2MSwgaWRlbnQpID0+IHYxLmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3IoaWRlbnQsIFwiVW5ib3VuZCBicmVhay9jb250aW51ZSBsYWJlbFwiKSksIHYpO1xuICAgIH1cbiAgICBjb25zdCBpc1N0cmljdCA9IG5vZGUuZGlyZWN0aXZlcy5zb21lKGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUudHlwZSA9PT0gXCJVc2VTdHJpY3REaXJlY3RpdmVcIik7XG4gICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICB2ID0gdi5lbmZvcmNlU3RyaWN0RXJyb3JzKCk7XG4gICAgfVxuICAgIHJldHVybiB2LmVuZm9yY2VGcmVlQnJlYWtBbmRDb250aW51ZVN0YXRlbWVudEVycm9ycygpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25EZWNsYXJhdGlvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRGVjbGFyYXRpb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KVxuICAgICAgLmNsZWFyVXNlZExhYmVsTmFtZXMoKVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLm5hbWUpO1xuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRGVjbGFyYXRpb24gbXVzdCBoYXZlIHVuaXF1ZSBwYXJhbWV0ZXIgbmFtZXNcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpO1xuICAgIGlmIChub2RlLm5hbWUgIT0gbnVsbCkge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUubmFtZSk7XG4gICAgfVxuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRXhwcmVzc2lvbiBwYXJhbWV0ZXIgbmFtZXMgbXVzdCBiZSB1bmlxdWVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUdldHRlcihub2RlLCBuYW1lLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZUdldHRlcihub2RlLCBuYW1lLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZUlkZW50aWZpZXIobm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIklkZW50aWZpZXIgYG5hbWVgIG11c3QgYmUgYSB2YWxpZCBJZGVudGlmaWVyTmFtZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlSWRlbnRpZmllckV4cHJlc3Npb24obm9kZSwgaWRlbnRpZmllcikge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VJZGVudGlmaWVyRXhwcmVzc2lvbihub2RlLCBpZGVudGlmaWVyKVxuICAgICAgLmNoZWNrUmVzZXJ2ZWQobm9kZS5pZGVudGlmaWVyKTtcbiAgfVxuXG4gIHJlZHVjZUlmU3RhdGVtZW50KG5vZGUsIHRlc3QsIGNvbnNlcXVlbnQsIGFsdGVybmF0ZSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlSWZTdGF0ZW1lbnQobm9kZSwgdGVzdCwgY29uc2VxdWVudCwgYWx0ZXJuYXRlKTtcbiAgICBpZiAoaXNQcm9ibGVtYXRpY0lmU3RhdGVtZW50KG5vZGUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiSWZTdGF0ZW1lbnQgd2l0aCBudWxsIGBhbHRlcm5hdGVgIG11c3Qgbm90IGJlIHRoZSBgY29uc2VxdWVudGAgb2YgYW4gSWZTdGF0ZW1lbnQgd2l0aCBhIG5vbi1udWxsIGBhbHRlcm5hdGVgXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIGxhYmVsLCBib2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIGxhYmVsLCBib2R5KTtcbiAgICBpZiAodi51c2VkTGFiZWxOYW1lcy5zb21lKHMgPT4gcyA9PT0gbm9kZS5sYWJlbC5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkR1cGxpY2F0ZSBsYWJlbCBuYW1lLlwiKSk7XG4gICAgfVxuICAgIGlmIChpc0l0ZXJhdGlvblN0YXRlbWVudChub2RlLmJvZHkudHlwZSkpIHtcbiAgICAgICAgcmV0dXJuIHYub2JzZXJ2ZUl0ZXJhdGlvbkxhYmVsTmFtZShub2RlLmxhYmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIHYub2JzZXJ2ZU5vbkl0ZXJhdGlvbkxhYmVsTmFtZShub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZUxpdGVyYWxOdW1lcmljRXhwcmVzc2lvbihub2RlKSB7XG4gICAgbGV0IHYgPSB0aGlzLmlkZW50aXR5O1xuICAgIGlmIChub2RlLnZhbHVlIDwgMCB8fCBub2RlLnZhbHVlID09IDAgJiYgMSAvIG5vZGUudmFsdWUgPCAwKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBiZSBub24tbmVnYXRpdmVcIikpO1xuICAgIH0gZWxzZSBpZiAobm9kZS52YWx1ZSAhPT0gbm9kZS52YWx1ZSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk51bWVyaWMgTGl0ZXJhbCBub2RlIG11c3Qgbm90IGJlIE5hTlwiKSk7XG4gICAgfSBlbHNlIGlmICghZ2xvYmFsLmlzRmluaXRlKG5vZGUudmFsdWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBiZSBmaW5pdGVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUxpdGVyYWxSZWdFeHBFeHByZXNzaW9uKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgY29uc3QgbWVzc2FnZSA9IFwiTGl0ZXJhbFJlZ0V4cEV4cHJlc3NzaW9uIG11c3QgY29udGFpbiBhIHZhbGlkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhIFJlZ0V4cFwiLFxuICAgICAgZmlyc3RTbGFzaCA9IG5vZGUudmFsdWUuaW5kZXhPZihcIi9cIiksXG4gICAgICBsYXN0U2xhc2ggPSBub2RlLnZhbHVlLmxhc3RJbmRleE9mKFwiL1wiKTtcbiAgICBpZiAoZmlyc3RTbGFzaCAhPT0gMCB8fCBmaXJzdFNsYXNoID09PSBsYXN0U2xhc2gpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBSZWdFeHAobm9kZS52YWx1ZS5zbGljZSgxLCBsYXN0U2xhc2gpLCBub2RlLnZhbHVlLnNsaWNlKGxhc3RTbGFzaCArIDEpKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIG1lc3NhZ2UpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VPYmplY3RFeHByZXNzaW9uKG5vZGUsIHByb3BlcnRpZXMpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZU9iamVjdEV4cHJlc3Npb24obm9kZSwgcHJvcGVydGllcyk7XG4gICAgY29uc3Qgc2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZ2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZGF0YUtleXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgbGV0IGtleSA9IGAgJHtwLm5hbWUudmFsdWV9YDtcbiAgICAgIHN3aXRjaCAocC50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJEYXRhUHJvcGVydHlcIjpcbiAgICAgICAgICBpZiAocC5uYW1lLnZhbHVlID09PSBcIl9fcHJvdG9fX1wiICYmIGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgZGF0YSBwcm9wZXJ0aWVzIHdpdGggbmFtZSBfX3Byb3RvX19cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZ2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBzZXR0ZXIgcHJvcGVydGllcyB3aXRoIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiR2V0dGVyXCI6XG4gICAgICAgICAgaWYgKGdldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBnZXR0ZXJzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhS2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGdldEtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJTZXR0ZXJcIjpcbiAgICAgICAgICBpZiAoc2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIHNldHRlcnMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgc2V0dGVyIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpO1xuICAgIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcmVmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVByZWZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCk7XG4gICAgaWYgKG5vZGUub3BlcmF0b3IgPT09IFwiZGVsZXRlXCIgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcImBkZWxldGVgIHdpdGggdW5xdWFsaWZpZWQgaWRlbnRpZmllciBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gICAgfSBlbHNlIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcm9wZXJ0eU5hbWUobm9kZSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlUHJvcGVydHlOYW1lKG5vZGUpO1xuICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICBjYXNlIFwiaWRlbnRpZmllclwiOlxuICAgICAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggaWRlbnRpZmllciBraW5kIG11c3QgaGF2ZSBJZGVudGlmaWVyTmFtZSB2YWx1ZVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgIGlmICghL14oPzowfFsxLTldXFxkKlxcLj9cXGQqKSQvLnRlc3Qobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggbnVtYmVyIGtpbmQgbXVzdCBoYXZlIG51bWVyaWMgdmFsdWVcIikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKVxuICAgICAgLmFkZEZyZWVSZXR1cm5TdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlJldHVybiBzdGF0ZW1lbnQgbXVzdCBiZSBpbnNpZGUgb2YgYSBmdW5jdGlvblwiKSk7XG4gIH1cblxuICByZWR1Y2VTY3JpcHQobm9kZSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTY3JpcHQobm9kZSwgYm9keSlcbiAgICAgIC5lbmZvcmNlRnJlZVJldHVyblN0YXRlbWVudEVycm9ycygpO1xuICB9XG5cbiAgcmVkdWNlU2V0dGVyKG5vZGUsIG5hbWUsIHBhcmFtZXRlciwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTZXR0ZXIobm9kZSwgbmFtZSwgcGFyYW1ldGVyLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLnBhcmFtZXRlcik7XG4gIH1cblxuICByZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcykge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcylcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZVN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0KG5vZGUsIGRpc2NyaW1pbmFudCwgcHJlRGVmYXVsdENhc2VzLCBkZWZhdWx0Q2FzZSwgcG9zdERlZmF1bHRDYXNlcykge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdChub2RlLCBkaXNjcmltaW5hbnQsIHByZURlZmF1bHRDYXNlcywgZGVmYXVsdENhc2UsIHBvc3REZWZhdWx0Q2FzZXMpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VWYXJpYWJsZURlY2xhcmF0b3Iobm9kZSwgYmluZGluZywgaW5pdCkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VWYXJpYWJsZURlY2xhcmF0b3Iobm9kZSwgYmluZGluZywgaW5pdClcbiAgICAgIC5jaGVja1Jlc3RyaWN0ZWQobm9kZS5iaW5kaW5nKTtcbiAgfVxuXG4gIHJlZHVjZVdpdGhTdGF0ZW1lbnQobm9kZSwgb2JqZWN0LCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVdpdGhTdGF0ZW1lbnQobm9kZSwgb2JqZWN0LCBib2R5KVxuICAgICAgLmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJXaXRoU3RhdGVtZW50IG5vdCBhbGxvd2VkIGluIHN0cmljdCBtb2RlXCIpKTtcbiAgfVxuXG4gIHJlZHVjZVdoaWxlU3RhdGVtZW50KG5vZGUsIHRlc3QsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlV2hpbGVTdGF0ZW1lbnQobm9kZSwgdGVzdCwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG59XG4iXX0=