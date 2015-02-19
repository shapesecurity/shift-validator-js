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

  Validator.prototype.reduceUnknownDirective = function (node) {
    var v = MonoidalReducer.prototype.reduceUnknownDirective.call(this, node);
    try {
      (0, eval)("\"" + node.value + "\"");
    } catch (e0) {
      try {
        (0, eval)("'" + node.value + "'");
      } catch (e1) {
        v = v.addError(new ValidationError(node, "UseStrictDirective value must be representable as a single- or double-quoted string"));
      }
    }
    return v;
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
//# sourceMappingURL=data:application/json;base64,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R0FBQSxVQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0FBQ3RDLFdBdFIyQixBQXNScEIsZUF0Um1DLFdBc1I3QixtQkFBbUIsS0FBQSxPQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQ2pELGNBQWMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxJQUFJLEVBQUUsMENBQTBDLENBQUMsQ0FBQyxDQUFDO0dBQzFGOztBQXhSVSxXQUFTLFdBMFJwQixvQkFBb0IsR0FBQSxVQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQ3JDLFdBM1IyQixBQTJScEIsZUEzUm1DLFdBMlI3QixvQkFBb0IsS0FBQSxPQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQ2hELHdCQUF3QixFQUFFLENBQzFCLDJCQUEyQixFQUFFLENBQUM7R0FDbEM7O1NBOVJVLFNBQVM7R0FBUyxlQUFlOztRQUFqQyxTQUFTLEdBQVQsU0FBUyIsImZpbGUiOiJzcmMvaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvcHlyaWdodCAyMDE0IFNoYXBlIFNlY3VyaXR5LCBJbmMuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKVxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHJlZHVjZSwge01vbm9pZGFsUmVkdWNlcn0gZnJvbSBcInNoaWZ0LXJlZHVjZXJcIjtcbmltcG9ydCB7a2V5d29yZH0gZnJvbSBcImVzdXRpbHNcIjtcbmNvbnN0IHtpc0lkZW50aWZpZXJOYW1lfSA9IGtleXdvcmQ7XG5cbmltcG9ydCB7VmFsaWRhdGlvbkNvbnRleHQsIFZhbGlkYXRpb25FcnJvcn0gZnJvbSBcIi4vdmFsaWRhdGlvbi1jb250ZXh0XCI7XG5cbmZ1bmN0aW9uIHVuaXF1ZUlkZW50aWZpZXJzKGlkZW50aWZpZXJzKSB7XG4gIGxldCBzZXQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICByZXR1cm4gaWRlbnRpZmllcnMuZXZlcnkoKGlkZW50aWZpZXIpID0+IHtcbiAgICBpZiAoc2V0W2lkZW50aWZpZXIubmFtZV0pIHJldHVybiBmYWxzZTtcbiAgICBzZXRbaWRlbnRpZmllci5uYW1lXSA9IHRydWU7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpc1ZhbGlkKG5vZGUpIHtcbiAgcmV0dXJuIFZhbGlkYXRvci52YWxpZGF0ZShub2RlKS5sZW5ndGggPT09IDA7XG59XG5cbmZ1bmN0aW9uIGlzSXRlcmF0aW9uU3RhdGVtZW50KHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcIkRvV2hpbGVTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiV2hpbGVTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiRm9yU3RhdGVtZW50XCI6XG4gICAgY2FzZSBcIkZvckluU3RhdGVtZW50XCI6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHRyYWlsaW5nU3RhdGVtZW50KG5vZGUpIHtcbiAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgY2FzZSBcIklmU3RhdGVtZW50XCI6XG4gICAgaWYgKG5vZGUuYWx0ZXJuYXRlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBub2RlLmFsdGVybmF0ZTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGUuY29uc2VxdWVudDtcblxuICBjYXNlIFwiTGFiZWxlZFN0YXRlbWVudFwiOlxuICBjYXNlIFwiRm9yU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJGb3JJblN0YXRlbWVudFwiOlxuICBjYXNlIFwiV2hpbGVTdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIldpdGhTdGF0ZW1lbnRcIjpcbiAgICByZXR1cm4gbm9kZS5ib2R5O1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1Byb2JsZW1hdGljSWZTdGF0ZW1lbnQobm9kZSkge1xuICBpZiAobm9kZS50eXBlICE9PSBcIklmU3RhdGVtZW50XCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKG5vZGUuYWx0ZXJuYXRlID09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgbGV0IGN1cnJlbnQgPSBub2RlLmNvbnNlcXVlbnQ7XG4gIGRvIHtcbiAgICBpZiAoY3VycmVudC50eXBlID09PSBcIklmU3RhdGVtZW50XCIgJiYgY3VycmVudC5hbHRlcm5hdGUgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGN1cnJlbnQgPSB0cmFpbGluZ1N0YXRlbWVudChjdXJyZW50KTtcbiAgfSB3aGlsZShjdXJyZW50ICE9IG51bGwpO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBjbGFzcyBWYWxpZGF0b3IgZXh0ZW5kcyBNb25vaWRhbFJlZHVjZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihWYWxpZGF0aW9uQ29udGV4dCk7XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGUobm9kZSkge1xuICAgIHJldHVybiByZWR1Y2UobmV3IFZhbGlkYXRvciwgbm9kZSkuZXJyb3JzO1xuICB9XG5cbiAgcmVkdWNlQXNzaWdubWVudEV4cHJlc3Npb24obm9kZSwgYmluZGluZywgZXhwcmVzc2lvbikge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlQXNzaWdubWVudEV4cHJlc3Npb24obm9kZSwgYmluZGluZywgZXhwcmVzc2lvbik7XG4gICAgaWYgKG5vZGUuYmluZGluZy50eXBlID09PSBcIklkZW50aWZpZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIHYgPSB2LmNoZWNrUmVzdHJpY3RlZChub2RlLmJpbmRpbmcuaWRlbnRpZmllcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlQnJlYWtTdGF0ZW1lbnQobm9kZSwgbGFiZWwpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUJyZWFrU3RhdGVtZW50KG5vZGUsIGxhYmVsKTtcbiAgICByZXR1cm4gbm9kZS5sYWJlbCA9PSBudWxsXG4gICAgICA/IHYuYWRkRnJlZUJyZWFrU3RhdGVtZW50KG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJCcmVha1N0YXRlbWVudCBtdXN0IGJlIG5lc3RlZCB3aXRoaW4gc3dpdGNoIG9yIGl0ZXJhdGlvbiBzdGF0ZW1lbnRcIikpXG4gICAgICA6IHYuYWRkRnJlZUJyZWFrSnVtcFRhcmdldChub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZUNhdGNoQ2xhdXNlKG5vZGUsIHBhcmFtLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZUNhdGNoQ2xhdXNlKG5vZGUsIHBhcmFtLCBib2R5KVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLmJpbmRpbmcpO1xuICB9XG5cbiAgcmVkdWNlQ29udGludWVTdGF0ZW1lbnQobm9kZSwgYm9keSwgbGFiZWwpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUNvbnRpbnVlU3RhdGVtZW50KG5vZGUsIGJvZHksIGxhYmVsKVxuICAgICAgLmFkZEZyZWVDb250aW51ZVN0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiQ29udGludWVTdGF0ZW1lbnQgbXVzdCBiZSBpbnNpZGUgYW4gaXRlcmF0aW9uIHN0YXRlbWVudFwiKSk7XG4gICAgcmV0dXJuIG5vZGUubGFiZWwgPT0gbnVsbCA/IHYgOiB2LmFkZEZyZWVDb250aW51ZUp1bXBUYXJnZXQobm9kZS5sYWJlbCk7XG4gIH1cblxuICByZWR1Y2VEb1doaWxlU3RhdGVtZW50KG5vZGUsIGJvZHksIHRlc3QpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlRG9XaGlsZVN0YXRlbWVudChub2RlLCBib2R5LCB0ZXN0KVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VGb3JJblN0YXRlbWVudChub2RlLCBsZWZ0LCByaWdodCwgYm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlRm9ySW5TdGF0ZW1lbnQobm9kZSwgbGVmdCwgcmlnaHQsIGJvZHkpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVDb250aW51ZVN0YXRlbWVudHMoKTtcbiAgICBpZiAobm9kZS5sZWZ0LnR5cGUgPT09IFwiVmFyaWFibGVEZWNsYXJhdGlvblwiICYmIG5vZGUubGVmdC5kZWNsYXJhdG9ycy5sZW5ndGggPiAxKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUubGVmdCwgXCJWYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50IGluIEZvckluVmFyU3RhdGVtZW50IGNvbnRhaW5zIG1vcmUgdGhhbiBvbmUgVmFyaWFibGVEZWNsYXJhdG9yXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VGb3JTdGF0ZW1lbnQobm9kZSwgaW5pdCwgdGVzdCwgdXBkYXRlLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZUZvclN0YXRlbWVudChub2RlLCBpbml0LCB0ZXN0LCB1cGRhdGUsIGJvZHkpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVDb250aW51ZVN0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uQm9keShub2RlLCBkaXJlY3RpdmVzLCBzb3VyY2VFbGVtZW50cykge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlRnVuY3Rpb25Cb2R5KG5vZGUsIGRpcmVjdGl2ZXMsIHNvdXJjZUVsZW1lbnRzKTtcbiAgICBpZiAodi5mcmVlSnVtcFRhcmdldHMubGVuZ3RoID4gMCkge1xuICAgICAgdiA9IHYuZnJlZUp1bXBUYXJnZXRzLnJlZHVjZSgodjEsIGlkZW50KSA9PiB2MS5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKGlkZW50LCBcIlVuYm91bmQgYnJlYWsvY29udGludWUgbGFiZWxcIikpLCB2KTtcbiAgICB9XG4gICAgY29uc3QgaXNTdHJpY3QgPSBub2RlLmRpcmVjdGl2ZXMuc29tZShkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLnR5cGUgPT09IFwiVXNlU3RyaWN0RGlyZWN0aXZlXCIpO1xuICAgIGlmIChpc1N0cmljdCkge1xuICAgICAgdiA9IHYuZW5mb3JjZVN0cmljdEVycm9ycygpO1xuICAgIH1cbiAgICByZXR1cm4gdi5lbmZvcmNlRnJlZUJyZWFrQW5kQ29udGludWVTdGF0ZW1lbnRFcnJvcnMoKTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRGVjbGFyYXRpb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSlcbiAgICAgIC5jbGVhclVzZWRMYWJlbE5hbWVzKClcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKClcbiAgICAgIC5jaGVja1Jlc3RyaWN0ZWQobm9kZS5uYW1lKTtcbiAgICBpZiAoIXVuaXF1ZUlkZW50aWZpZXJzKG5vZGUucGFyYW1ldGVycykpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJGdW5jdGlvbkRlY2xhcmF0aW9uIG11c3QgaGF2ZSB1bmlxdWUgcGFyYW1ldGVyIG5hbWVzXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGUucGFyYW1ldGVycy5yZWR1Y2UoKHYxLCBwYXJhbSkgPT4gdjEuY2hlY2tSZXN0cmljdGVkKHBhcmFtKSwgdik7XG4gIH1cblxuICByZWR1Y2VGdW5jdGlvbkV4cHJlc3Npb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGdW5jdGlvbkV4cHJlc3Npb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKTtcbiAgICBpZiAobm9kZS5uYW1lICE9IG51bGwpIHtcbiAgICAgIHYgPSB2LmNoZWNrUmVzdHJpY3RlZChub2RlLm5hbWUpO1xuICAgIH1cbiAgICBpZiAoIXVuaXF1ZUlkZW50aWZpZXJzKG5vZGUucGFyYW1ldGVycykpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJGdW5jdGlvbkV4cHJlc3Npb24gcGFyYW1ldGVyIG5hbWVzIG11c3QgYmUgdW5pcXVlXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGUucGFyYW1ldGVycy5yZWR1Y2UoKHYxLCBwYXJhbSkgPT4gdjEuY2hlY2tSZXN0cmljdGVkKHBhcmFtKSwgdik7XG4gIH1cblxuICByZWR1Y2VHZXR0ZXIobm9kZSwgbmFtZSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VHZXR0ZXIobm9kZSwgbmFtZSwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VJZGVudGlmaWVyKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXJOYW1lKG5vZGUubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJJZGVudGlmaWVyIGBuYW1lYCBtdXN0IGJlIGEgdmFsaWQgSWRlbnRpZmllck5hbWVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUlkZW50aWZpZXJFeHByZXNzaW9uKG5vZGUsIGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlSWRlbnRpZmllckV4cHJlc3Npb24obm9kZSwgaWRlbnRpZmllcilcbiAgICAgIC5jaGVja1Jlc2VydmVkKG5vZGUuaWRlbnRpZmllcik7XG4gIH1cblxuICByZWR1Y2VJZlN0YXRlbWVudChub2RlLCB0ZXN0LCBjb25zZXF1ZW50LCBhbHRlcm5hdGUpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUlmU3RhdGVtZW50KG5vZGUsIHRlc3QsIGNvbnNlcXVlbnQsIGFsdGVybmF0ZSk7XG4gICAgaWYgKGlzUHJvYmxlbWF0aWNJZlN0YXRlbWVudChub2RlKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIklmU3RhdGVtZW50IHdpdGggbnVsbCBgYWx0ZXJuYXRlYCBtdXN0IG5vdCBiZSB0aGUgYGNvbnNlcXVlbnRgIG9mIGFuIElmU3RhdGVtZW50IHdpdGggYSBub24tbnVsbCBgYWx0ZXJuYXRlYFwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlTGFiZWxlZFN0YXRlbWVudChub2RlLCBsYWJlbCwgYm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlTGFiZWxlZFN0YXRlbWVudChub2RlLCBsYWJlbCwgYm9keSk7XG4gICAgaWYgKHYudXNlZExhYmVsTmFtZXMuc29tZShzID0+IHMgPT09IG5vZGUubGFiZWwubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJEdXBsaWNhdGUgbGFiZWwgbmFtZS5cIikpO1xuICAgIH1cbiAgICBpZiAoaXNJdGVyYXRpb25TdGF0ZW1lbnQobm9kZS5ib2R5LnR5cGUpKSB7XG4gICAgICAgIHJldHVybiB2Lm9ic2VydmVJdGVyYXRpb25MYWJlbE5hbWUobm9kZS5sYWJlbCk7XG4gICAgfVxuICAgIHJldHVybiB2Lm9ic2VydmVOb25JdGVyYXRpb25MYWJlbE5hbWUobm9kZS5sYWJlbCk7XG4gIH1cblxuICByZWR1Y2VMaXRlcmFsTnVtZXJpY0V4cHJlc3Npb24obm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBpZiAobm9kZS52YWx1ZSA8IDAgfHwgbm9kZS52YWx1ZSA9PSAwICYmIDEgLyBub2RlLnZhbHVlIDwgMCkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk51bWVyaWMgTGl0ZXJhbCBub2RlIG11c3QgYmUgbm9uLW5lZ2F0aXZlXCIpKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUudmFsdWUgIT09IG5vZGUudmFsdWUpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IG5vdCBiZSBOYU5cIikpO1xuICAgIH0gZWxzZSBpZiAoIWdsb2JhbC5pc0Zpbml0ZShub2RlLnZhbHVlKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk51bWVyaWMgTGl0ZXJhbCBub2RlIG11c3QgYmUgZmluaXRlXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VMaXRlcmFsUmVnRXhwRXhwcmVzc2lvbihub2RlKSB7XG4gICAgbGV0IHYgPSB0aGlzLmlkZW50aXR5O1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBcIkxpdGVyYWxSZWdFeHBFeHByZXNzc2lvbiBtdXN0IGNvbnRhaW4gYSB2YWxpZCBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYSBSZWdFeHBcIixcbiAgICAgIGZpcnN0U2xhc2ggPSBub2RlLnZhbHVlLmluZGV4T2YoXCIvXCIpLFxuICAgICAgbGFzdFNsYXNoID0gbm9kZS52YWx1ZS5sYXN0SW5kZXhPZihcIi9cIik7XG4gICAgaWYgKGZpcnN0U2xhc2ggIT09IDAgfHwgZmlyc3RTbGFzaCA9PT0gbGFzdFNsYXNoKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIG1lc3NhZ2UpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgUmVnRXhwKG5vZGUudmFsdWUuc2xpY2UoMSwgbGFzdFNsYXNoKSwgbm9kZS52YWx1ZS5zbGljZShsYXN0U2xhc2ggKyAxKSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBtZXNzYWdlKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlT2JqZWN0RXhwcmVzc2lvbihub2RlLCBwcm9wZXJ0aWVzKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VPYmplY3RFeHByZXNzaW9uKG5vZGUsIHByb3BlcnRpZXMpO1xuICAgIGNvbnN0IHNldEtleXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGNvbnN0IGdldEtleXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGNvbnN0IGRhdGFLZXlzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBub2RlLnByb3BlcnRpZXMuZm9yRWFjaChwID0+IHtcbiAgICAgIGxldCBrZXkgPSBgICR7cC5uYW1lLnZhbHVlfWA7XG4gICAgICBzd2l0Y2ggKHAudHlwZSkge1xuICAgICAgICBjYXNlIFwiRGF0YVByb3BlcnR5XCI6XG4gICAgICAgICAgaWYgKHAubmFtZS52YWx1ZSA9PT0gXCJfX3Byb3RvX19cIiAmJiBkYXRhS2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIGRhdGEgcHJvcGVydGllcyB3aXRoIG5hbWUgX19wcm90b19fXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGdldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBnZXR0ZXIgcHJvcGVydGllcyB3aXRoIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZXRLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgc2V0dGVyIHByb3BlcnRpZXMgd2l0aCBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkYXRhS2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIkdldHRlclwiOlxuICAgICAgICAgIGlmIChnZXRLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgZ2V0dGVycyB3aXRoIHRoZSBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YUtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBnZXR0ZXIgcHJvcGVydGllcyB3aXRoIHRoZSBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBnZXRLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiU2V0dGVyXCI6XG4gICAgICAgICAgaWYgKHNldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBzZXR0ZXJzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhS2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIHNldHRlciBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNldEtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQb3N0Zml4RXhwcmVzc2lvbihub2RlLCBvcGVyYW5kKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VQb3N0Zml4RXhwcmVzc2lvbihub2RlLCBvcGVyYW5kKTtcbiAgICBpZiAoKG5vZGUub3BlcmF0b3IgPT09IFwiKytcIiB8fCBub2RlLm9wZXJhdG9yID09PSBcIi0tXCIpICYmIG5vZGUub3BlcmFuZC50eXBlID09PSBcIklkZW50aWZpZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIHYgPSB2LmNoZWNrUmVzdHJpY3RlZChub2RlLm9wZXJhbmQuaWRlbnRpZmllcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUHJlZml4RXhwcmVzc2lvbihub2RlLCBvcGVyYW5kKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VQcmVmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpO1xuICAgIGlmIChub2RlLm9wZXJhdG9yID09PSBcImRlbGV0ZVwiICYmIG5vZGUub3BlcmFuZC50eXBlID09PSBcIklkZW50aWZpZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJgZGVsZXRlYCB3aXRoIHVucXVhbGlmaWVkIGlkZW50aWZpZXIgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGVcIikpO1xuICAgIH0gZWxzZSBpZiAoKG5vZGUub3BlcmF0b3IgPT09IFwiKytcIiB8fCBub2RlLm9wZXJhdG9yID09PSBcIi0tXCIpICYmIG5vZGUub3BlcmFuZC50eXBlID09PSBcIklkZW50aWZpZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIHYgPSB2LmNoZWNrUmVzdHJpY3RlZChub2RlLm9wZXJhbmQuaWRlbnRpZmllcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUHJvcGVydHlOYW1lKG5vZGUpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVByb3BlcnR5TmFtZShub2RlKTtcbiAgICBzd2l0Y2ggKG5vZGUua2luZCkge1xuICAgICAgY2FzZSBcImlkZW50aWZpZXJcIjpcbiAgICAgICAgaWYgKCFpc0lkZW50aWZpZXJOYW1lKG5vZGUudmFsdWUpKSB7XG4gICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlByb3BlcnR5TmFtZSB3aXRoIGlkZW50aWZpZXIga2luZCBtdXN0IGhhdmUgSWRlbnRpZmllck5hbWUgdmFsdWVcIikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgICBpZiAoIS9eKD86MHxbMS05XVxcZCpcXC4/XFxkKikkLy50ZXN0KG5vZGUudmFsdWUpKSB7XG4gICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlByb3BlcnR5TmFtZSB3aXRoIG51bWJlciBraW5kIG11c3QgaGF2ZSBudW1lcmljIHZhbHVlXCIpKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VSZXR1cm5TdGF0ZW1lbnQobm9kZSwgZXhwcmVzc2lvbikge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VSZXR1cm5TdGF0ZW1lbnQobm9kZSwgZXhwcmVzc2lvbilcbiAgICAgIC5hZGRGcmVlUmV0dXJuU3RhdGVtZW50KG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJSZXR1cm4gc3RhdGVtZW50IG11c3QgYmUgaW5zaWRlIG9mIGEgZnVuY3Rpb25cIikpO1xuICB9XG5cbiAgcmVkdWNlU2NyaXB0KG5vZGUsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlU2NyaXB0KG5vZGUsIGJvZHkpXG4gICAgICAuZW5mb3JjZUZyZWVSZXR1cm5TdGF0ZW1lbnRFcnJvcnMoKTtcbiAgfVxuXG4gIHJlZHVjZVNldHRlcihub2RlLCBuYW1lLCBwYXJhbWV0ZXIsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlU2V0dGVyKG5vZGUsIG5hbWUsIHBhcmFtZXRlciwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKClcbiAgICAgIC5jaGVja1Jlc3RyaWN0ZWQobm9kZS5wYXJhbWV0ZXIpO1xuICB9XG5cbiAgcmVkdWNlU3dpdGNoU3RhdGVtZW50KG5vZGUsIGRpc2NyaW1pbmFudCwgY2FzZXMpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlU3dpdGNoU3RhdGVtZW50KG5vZGUsIGRpc2NyaW1pbmFudCwgY2FzZXMpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdChub2RlLCBkaXNjcmltaW5hbnQsIHByZURlZmF1bHRDYXNlcywgZGVmYXVsdENhc2UsIHBvc3REZWZhdWx0Q2FzZXMpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlU3dpdGNoU3RhdGVtZW50V2l0aERlZmF1bHQobm9kZSwgZGlzY3JpbWluYW50LCBwcmVEZWZhdWx0Q2FzZXMsIGRlZmF1bHRDYXNlLCBwb3N0RGVmYXVsdENhc2VzKVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlVW5rbm93bkRpcmVjdGl2ZShub2RlKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VVbmtub3duRGlyZWN0aXZlKG5vZGUpO1xuICAgIHRyeSB7ICgwLCBldmFsKShgXCIke25vZGUudmFsdWV9XCJgKTsgfSBjYXRjaChlMCkge1xuICAgICAgdHJ5IHsgKDAsIGV2YWwpKGAnJHtub2RlLnZhbHVlfSdgKTsgfSBjYXRjaChlMSkge1xuICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiVXNlU3RyaWN0RGlyZWN0aXZlIHZhbHVlIG11c3QgYmUgcmVwcmVzZW50YWJsZSBhcyBhIHNpbmdsZS0gb3IgZG91YmxlLXF1b3RlZCBzdHJpbmdcIikpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVZhcmlhYmxlRGVjbGFyYXRvcihub2RlLCBiaW5kaW5nLCBpbml0KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVZhcmlhYmxlRGVjbGFyYXRvcihub2RlLCBiaW5kaW5nLCBpbml0KVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLmJpbmRpbmcpO1xuICB9XG5cbiAgcmVkdWNlV2l0aFN0YXRlbWVudChub2RlLCBvYmplY3QsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlV2l0aFN0YXRlbWVudChub2RlLCBvYmplY3QsIGJvZHkpXG4gICAgICAuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIldpdGhTdGF0ZW1lbnQgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGVcIikpO1xuICB9XG5cbiAgcmVkdWNlV2hpbGVTdGF0ZW1lbnQobm9kZSwgdGVzdCwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VXaGlsZVN0YXRlbWVudChub2RlLCB0ZXN0LCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gIH1cbn1cbiJdfQ==