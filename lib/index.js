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
//# sourceMappingURL=data:application/json;base64,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RUFBRTtBQUNuRyxXQWxRMkIsQUFrUXBCLGVBbFFtQyxXQWlRNUMsZ0NBQWdDLFlBQ2pCLElBQUksRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUM3RSx3QkFBd0IsRUFBRSxDQUFDO0dBQy9COztBQXBRVSxXQUFTLFdBc1FwQix3QkFBd0IsR0FBQSxVQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO0FBQzVDLFdBdlEyQixBQXVRcEIsZUF2UW1DLFdBc1E1Qyx3QkFBd0IsWUFDVCxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUM5QixlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0dBQ2xDOztBQXpRVSxXQUFTLFdBMlFwQixtQkFBbUIsR0FBQSxVQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0FBQ3RDLFdBNVEyQixBQTRRcEIsZUE1UW1DLFdBMlE1QyxtQkFBbUIsWUFDSixJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUM3QixjQUFjLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLDBDQUEwQyxDQUFDLENBQUMsQ0FBQztHQUMxRjs7QUE5UVUsV0FBUyxXQWdScEIsb0JBQW9CLEdBQUEsVUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtBQUNyQyxXQWpSMkIsQUFpUnBCLGVBalJtQyxXQWdSNUMsb0JBQW9CLFlBQ0wsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FDM0Isd0JBQXdCLEVBQUUsQ0FDMUIsMkJBQTJCLEVBQUUsQ0FBQztHQUNsQzs7U0FwUlUsU0FBUztHQUFTLGVBQWU7O1FBQWpDLFNBQVMsR0FBVCxTQUFTIiwiZmlsZSI6InNyYy9pbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgU2hhcGUgU2VjdXJpdHksIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgcmVkdWNlLCB7TW9ub2lkYWxSZWR1Y2VyfSBmcm9tIFwic2hpZnQtcmVkdWNlclwiO1xuaW1wb3J0IHtrZXl3b3JkfSBmcm9tIFwiZXN1dGlsc1wiO1xuY29uc3Qge2lzSWRlbnRpZmllck5hbWV9ID0ga2V5d29yZDtcblxuaW1wb3J0IHtWYWxpZGF0aW9uQ29udGV4dCwgVmFsaWRhdGlvbkVycm9yfSBmcm9tIFwiLi92YWxpZGF0aW9uLWNvbnRleHRcIjtcblxuZnVuY3Rpb24gdW5pcXVlSWRlbnRpZmllcnMoaWRlbnRpZmllcnMpIHtcbiAgbGV0IHNldCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHJldHVybiBpZGVudGlmaWVycy5ldmVyeSgoaWRlbnRpZmllcikgPT4ge1xuICAgIGlmIChzZXRbaWRlbnRpZmllci5uYW1lXSkgcmV0dXJuIGZhbHNlO1xuICAgIHNldFtpZGVudGlmaWVyLm5hbWVdID0gdHJ1ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGlzVmFsaWQobm9kZSkge1xuICByZXR1cm4gVmFsaWRhdG9yLnZhbGlkYXRlKG5vZGUpLmxlbmd0aCA9PT0gMDtcbn1cblxuZnVuY3Rpb24gaXNJdGVyYXRpb25TdGF0ZW1lbnQodHlwZSkge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFwiRG9XaGlsZVN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJXaGlsZVN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJGb3JTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiRm9ySW5TdGF0ZW1lbnRcIjpcbiAgICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gdHJhaWxpbmdTdGF0ZW1lbnQobm9kZSkge1xuICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICBjYXNlIFwiSWZTdGF0ZW1lbnRcIjpcbiAgICBpZiAobm9kZS5hbHRlcm5hdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5vZGUuYWx0ZXJuYXRlO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5jb25zZXF1ZW50O1xuXG4gIGNhc2UgXCJMYWJlbGVkU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJGb3JTdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIkZvckluU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJXaGlsZVN0YXRlbWVudFwiOlxuICBjYXNlIFwiV2l0aFN0YXRlbWVudFwiOlxuICAgIHJldHVybiBub2RlLmJvZHk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzUHJvYmxlbWF0aWNJZlN0YXRlbWVudChub2RlKSB7XG4gIGlmIChub2RlLnR5cGUgIT09IFwiSWZTdGF0ZW1lbnRcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAobm9kZS5hbHRlcm5hdGUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBsZXQgY3VycmVudCA9IG5vZGUuY29uc2VxdWVudDtcbiAgZG8ge1xuICAgIGlmIChjdXJyZW50LnR5cGUgPT09IFwiSWZTdGF0ZW1lbnRcIiAmJiBjdXJyZW50LmFsdGVybmF0ZSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY3VycmVudCA9IHRyYWlsaW5nU3RhdGVtZW50KGN1cnJlbnQpO1xuICB9IHdoaWxlKGN1cnJlbnQgIT0gbnVsbCk7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGNsYXNzIFZhbGlkYXRvciBleHRlbmRzIE1vbm9pZGFsUmVkdWNlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFZhbGlkYXRpb25Db250ZXh0KTtcbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZShub2RlKSB7XG4gICAgcmV0dXJuIHJlZHVjZShuZXcgVmFsaWRhdG9yLCBub2RlKS5lcnJvcnM7XG4gIH1cblxuICByZWR1Y2VBc3NpZ25tZW50RXhwcmVzc2lvbihub2RlLCBiaW5kaW5nLCBleHByZXNzaW9uKSB7XG4gICAgbGV0IHYgPSBzdXBlcihub2RlLCBiaW5kaW5nLCBleHByZXNzaW9uKTtcbiAgICBpZiAobm9kZS5iaW5kaW5nLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZy5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VCcmVha1N0YXRlbWVudChub2RlLCBsYWJlbCkge1xuICAgIGxldCB2ID0gc3VwZXIobm9kZSwgbGFiZWwpO1xuICAgIHJldHVybiBub2RlLmxhYmVsID09IG51bGxcbiAgICAgID8gdi5hZGRGcmVlQnJlYWtTdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkJyZWFrU3RhdGVtZW50IG11c3QgYmUgbmVzdGVkIHdpdGhpbiBzd2l0Y2ggb3IgaXRlcmF0aW9uIHN0YXRlbWVudFwiKSlcbiAgICAgIDogdi5hZGRGcmVlQnJlYWtKdW1wVGFyZ2V0KG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlQ2F0Y2hDbGF1c2Uobm9kZSwgcGFyYW0sIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIobm9kZSwgcGFyYW0sIGJvZHkpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZyk7XG4gIH1cblxuICByZWR1Y2VDb250aW51ZVN0YXRlbWVudChub2RlLCBib2R5LCBsYWJlbCkge1xuICAgIGxldCB2ID0gc3VwZXIobm9kZSwgYm9keSwgbGFiZWwpXG4gICAgICAuYWRkRnJlZUNvbnRpbnVlU3RhdGVtZW50KG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJDb250aW51ZVN0YXRlbWVudCBtdXN0IGJlIGluc2lkZSBhbiBpdGVyYXRpb24gc3RhdGVtZW50XCIpKTtcbiAgICByZXR1cm4gbm9kZS5sYWJlbCA9PSBudWxsID8gdiA6IHYuYWRkRnJlZUNvbnRpbnVlSnVtcFRhcmdldChub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZURvV2hpbGVTdGF0ZW1lbnQobm9kZSwgYm9keSwgdGVzdCkge1xuICAgIHJldHVybiBzdXBlcihub2RlLCBib2R5LCB0ZXN0KVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VGb3JJblN0YXRlbWVudChub2RlLCBsZWZ0LCByaWdodCwgYm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIobm9kZSwgbGVmdCwgcmlnaHQsIGJvZHkpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVDb250aW51ZVN0YXRlbWVudHMoKTtcbiAgICBpZiAobm9kZS5sZWZ0LnR5cGUgPT09IFwiVmFyaWFibGVEZWNsYXJhdGlvblwiICYmIG5vZGUubGVmdC5kZWNsYXJhdG9ycy5sZW5ndGggPiAxKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUubGVmdCwgXCJWYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50IGluIEZvckluVmFyU3RhdGVtZW50IGNvbnRhaW5zIG1vcmUgdGhhbiBvbmUgVmFyaWFibGVEZWNsYXJhdG9yXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VGb3JTdGF0ZW1lbnQobm9kZSwgaW5pdCwgdGVzdCwgdXBkYXRlLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyKG5vZGUsIGluaXQsIHRlc3QsIHVwZGF0ZSwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25Cb2R5KG5vZGUsIGRpcmVjdGl2ZXMsIHNvdXJjZUVsZW1lbnRzKSB7XG4gICAgbGV0IHYgPSBzdXBlcihub2RlLCBkaXJlY3RpdmVzLCBzb3VyY2VFbGVtZW50cyk7XG4gICAgaWYgKHYuZnJlZUp1bXBUYXJnZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHYgPSB2LmZyZWVKdW1wVGFyZ2V0cy5yZWR1Y2UoKHYxLCBpZGVudCkgPT4gdjEuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihpZGVudCwgXCJVbmJvdW5kIGJyZWFrL2NvbnRpbnVlIGxhYmVsXCIpKSwgdik7XG4gICAgfVxuICAgIGNvbnN0IGlzU3RyaWN0ID0gbm9kZS5kaXJlY3RpdmVzLnNvbWUoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS50eXBlID09PSBcIlVzZVN0cmljdERpcmVjdGl2ZVwiKTtcbiAgICBpZiAoaXNTdHJpY3QpIHtcbiAgICAgIHYgPSB2LmVuZm9yY2VTdHJpY3RFcnJvcnMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHYuZW5mb3JjZUZyZWVCcmVha0FuZENvbnRpbnVlU3RhdGVtZW50RXJyb3JzKCk7XG4gIH1cblxuICByZWR1Y2VGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIobm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KVxuICAgICAgLmNsZWFyVXNlZExhYmVsTmFtZXMoKVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLm5hbWUpO1xuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRGVjbGFyYXRpb24gbXVzdCBoYXZlIHVuaXF1ZSBwYXJhbWV0ZXIgbmFtZXNcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSlcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKCk7XG4gICAgaWYgKG5vZGUubmFtZSAhPSBudWxsKSB7XG4gICAgICB2ID0gdi5jaGVja1Jlc3RyaWN0ZWQobm9kZS5uYW1lKTtcbiAgICB9XG4gICAgaWYgKCF1bmlxdWVJZGVudGlmaWVycyhub2RlLnBhcmFtZXRlcnMpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRnVuY3Rpb25FeHByZXNzaW9uIHBhcmFtZXRlciBuYW1lcyBtdXN0IGJlIHVuaXF1ZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnBhcmFtZXRlcnMucmVkdWNlKCh2MSwgcGFyYW0pID0+IHYxLmNoZWNrUmVzdHJpY3RlZChwYXJhbSksIHYpO1xuICB9XG5cbiAgcmVkdWNlR2V0dGVyKG5vZGUsIG5hbWUsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIobm9kZSwgbmFtZSwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VJZGVudGlmaWVyKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXJOYW1lKG5vZGUubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJJZGVudGlmaWVyIGBuYW1lYCBtdXN0IGJlIGEgdmFsaWQgSWRlbnRpZmllck5hbWVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUlkZW50aWZpZXJFeHByZXNzaW9uKG5vZGUsIGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gc3VwZXIobm9kZSwgaWRlbnRpZmllcilcbiAgICAgIC5jaGVja1Jlc2VydmVkKG5vZGUuaWRlbnRpZmllcik7XG4gIH1cblxuICByZWR1Y2VJZlN0YXRlbWVudChub2RlLCB0ZXN0LCBjb25zZXF1ZW50LCBhbHRlcm5hdGUpIHtcbiAgICBsZXQgdiA9IHN1cGVyKG5vZGUsIHRlc3QsIGNvbnNlcXVlbnQsIGFsdGVybmF0ZSk7XG4gICAgaWYgKGlzUHJvYmxlbWF0aWNJZlN0YXRlbWVudChub2RlKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIklmU3RhdGVtZW50IHdpdGggbnVsbCBgYWx0ZXJuYXRlYCBtdXN0IG5vdCBiZSB0aGUgYGNvbnNlcXVlbnRgIG9mIGFuIElmU3RhdGVtZW50IHdpdGggYSBub24tbnVsbCBgYWx0ZXJuYXRlYFwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlTGFiZWxlZFN0YXRlbWVudChub2RlLCBsYWJlbCwgYm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIobm9kZSwgbGFiZWwsIGJvZHkpO1xuICAgIGlmICh2LnVzZWRMYWJlbE5hbWVzLnNvbWUocyA9PiBzID09PSBub2RlLmxhYmVsLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRHVwbGljYXRlIGxhYmVsIG5hbWUuXCIpKTtcbiAgICB9XG4gICAgaWYgKGlzSXRlcmF0aW9uU3RhdGVtZW50KG5vZGUuYm9keS50eXBlKSkge1xuICAgICAgICByZXR1cm4gdi5vYnNlcnZlSXRlcmF0aW9uTGFiZWxOYW1lKG5vZGUubGFiZWwpO1xuICAgIH1cbiAgICByZXR1cm4gdi5vYnNlcnZlTm9uSXRlcmF0aW9uTGFiZWxOYW1lKG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlTGl0ZXJhbE51bWVyaWNFeHByZXNzaW9uKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgaWYgKG5vZGUudmFsdWUgPCAwIHx8IG5vZGUudmFsdWUgPT0gMCAmJiAxIC8gbm9kZS52YWx1ZSA8IDApIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IGJlIG5vbi1uZWdhdGl2ZVwiKSk7XG4gICAgfSBlbHNlIGlmIChub2RlLnZhbHVlICE9PSBub2RlLnZhbHVlKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBub3QgYmUgTmFOXCIpKTtcbiAgICB9IGVsc2UgaWYgKCFnbG9iYWwuaXNGaW5pdGUobm9kZS52YWx1ZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IGJlIGZpbml0ZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlTGl0ZXJhbFJlZ0V4cEV4cHJlc3Npb24obm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBjb25zdCBtZXNzYWdlID0gXCJMaXRlcmFsUmVnRXhwRXhwcmVzc3Npb24gbXVzdCBjb250YWluIGEgdmFsaWQgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgUmVnRXhwXCIsXG4gICAgICBmaXJzdFNsYXNoID0gbm9kZS52YWx1ZS5pbmRleE9mKFwiL1wiKSxcbiAgICAgIGxhc3RTbGFzaCA9IG5vZGUudmFsdWUubGFzdEluZGV4T2YoXCIvXCIpO1xuICAgIGlmIChmaXJzdFNsYXNoICE9PSAwIHx8IGZpcnN0U2xhc2ggPT09IGxhc3RTbGFzaCkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBtZXNzYWdlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIFJlZ0V4cChub2RlLnZhbHVlLnNsaWNlKDEsIGxhc3RTbGFzaCksIG5vZGUudmFsdWUuc2xpY2UobGFzdFNsYXNoICsgMSkpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZU9iamVjdEV4cHJlc3Npb24obm9kZSwgcHJvcGVydGllcykge1xuICAgIGxldCB2ID0gc3VwZXIobm9kZSwgcHJvcGVydGllcyk7XG4gICAgY29uc3Qgc2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZ2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZGF0YUtleXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgbGV0IGtleSA9IGAgJHtwLm5hbWUudmFsdWV9YDtcbiAgICAgIHN3aXRjaCAocC50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJEYXRhUHJvcGVydHlcIjpcbiAgICAgICAgICBpZiAocC5uYW1lLnZhbHVlID09PSBcIl9fcHJvdG9fX1wiICYmIGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgZGF0YSBwcm9wZXJ0aWVzIHdpdGggbmFtZSBfX3Byb3RvX19cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZ2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBzZXR0ZXIgcHJvcGVydGllcyB3aXRoIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiR2V0dGVyXCI6XG4gICAgICAgICAgaWYgKGdldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBnZXR0ZXJzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhS2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGdldEtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJTZXR0ZXJcIjpcbiAgICAgICAgICBpZiAoc2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIHNldHRlcnMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgc2V0dGVyIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyKG5vZGUsIG9wZXJhbmQpO1xuICAgIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcmVmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyKG5vZGUsIG9wZXJhbmQpO1xuICAgIGlmIChub2RlLm9wZXJhdG9yID09PSBcImRlbGV0ZVwiICYmIG5vZGUub3BlcmFuZC50eXBlID09PSBcIklkZW50aWZpZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJgZGVsZXRlYCB3aXRoIHVucXVhbGlmaWVkIGlkZW50aWZpZXIgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGVcIikpO1xuICAgIH0gZWxzZSBpZiAoKG5vZGUub3BlcmF0b3IgPT09IFwiKytcIiB8fCBub2RlLm9wZXJhdG9yID09PSBcIi0tXCIpICYmIG5vZGUub3BlcmFuZC50eXBlID09PSBcIklkZW50aWZpZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIHYgPSB2LmNoZWNrUmVzdHJpY3RlZChub2RlLm9wZXJhbmQuaWRlbnRpZmllcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUHJvcGVydHlOYW1lKG5vZGUpIHtcbiAgICBsZXQgdiA9IHN1cGVyKG5vZGUpO1xuICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICBjYXNlIFwiaWRlbnRpZmllclwiOlxuICAgICAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggaWRlbnRpZmllciBraW5kIG11c3QgaGF2ZSBJZGVudGlmaWVyTmFtZSB2YWx1ZVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgIGlmICghL14oPzowfFsxLTldXFxkKlxcLj9cXGQqKSQvLnRlc3Qobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggbnVtYmVyIGtpbmQgbXVzdCBoYXZlIG51bWVyaWMgdmFsdWVcIikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHN1cGVyKG5vZGUsIGV4cHJlc3Npb24pXG4gICAgICAuYWRkRnJlZVJldHVyblN0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUmV0dXJuIHN0YXRlbWVudCBtdXN0IGJlIGluc2lkZSBvZiBhIGZ1bmN0aW9uXCIpKTtcbiAgfVxuXG4gIHJlZHVjZVNjcmlwdChub2RlLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyKG5vZGUsIGJvZHkpXG4gICAgICAuZW5mb3JjZUZyZWVSZXR1cm5TdGF0ZW1lbnRFcnJvcnMoKTtcbiAgfVxuXG4gIHJlZHVjZVNldHRlcihub2RlLCBuYW1lLCBwYXJhbWV0ZXIsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIobm9kZSwgbmFtZSwgcGFyYW1ldGVyLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLnBhcmFtZXRlcik7XG4gIH1cblxuICByZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcykge1xuICAgIHJldHVybiBzdXBlcihub2RlLCBkaXNjcmltaW5hbnQsIGNhc2VzKVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlU3dpdGNoU3RhdGVtZW50V2l0aERlZmF1bHQobm9kZSwgZGlzY3JpbWluYW50LCBwcmVEZWZhdWx0Q2FzZXMsIGRlZmF1bHRDYXNlLCBwb3N0RGVmYXVsdENhc2VzKSB7XG4gICAgcmV0dXJuIHN1cGVyKG5vZGUsIGRpc2NyaW1pbmFudCwgcHJlRGVmYXVsdENhc2VzLCBkZWZhdWx0Q2FzZSwgcG9zdERlZmF1bHRDYXNlcylcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZVZhcmlhYmxlRGVjbGFyYXRvcihub2RlLCBiaW5kaW5nLCBpbml0KSB7XG4gICAgcmV0dXJuIHN1cGVyKG5vZGUsIGJpbmRpbmcsIGluaXQpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUuYmluZGluZyk7XG4gIH1cblxuICByZWR1Y2VXaXRoU3RhdGVtZW50KG5vZGUsIG9iamVjdCwgYm9keSkge1xuICAgIHJldHVybiBzdXBlcihub2RlLCBvYmplY3QsIGJvZHkpXG4gICAgICAuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIldpdGhTdGF0ZW1lbnQgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGVcIikpO1xuICB9XG5cbiAgcmVkdWNlV2hpbGVTdGF0ZW1lbnQobm9kZSwgdGVzdCwgYm9keSkge1xuICAgIHJldHVybiBzdXBlcihub2RlLCB0ZXN0LCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gIH1cbn1cbiJdfQ==