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
    if (current.type === "IfStatement") {
      if (current.alternate == null) {
        return true;
      }
    }
    current = trailingStatement(current);
  } while (current);
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
      v = v.addErrors(v.strictErrors);
    }
    return v.addErrors(v.freeBreakStatements).addErrors(v.freeContinueStatements);
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
    return MonoidalReducer.prototype.reduceScript.call(this, node, body).addErrors(body.freeReturnStatements);
  };

  Validator.prototype.reduceSetter = function (node, name, parameter, body) {
    return MonoidalReducer.prototype.reduceSetter.call(this, node, name, parameter, body).checkRestricted(node.parameter);
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
//# sourceMappingURL=data:application/json;base64,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QUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRTtBQUNuRyxXQTVQMkIsQUE0UHBCLGVBNVBtQyxXQTRQN0IsZ0NBQWdDLEtBQUEsT0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FDOUcsd0JBQXdCLEVBQUUsQ0FBQztHQUMvQjs7QUE5UFUsV0FBUyxXQWdRcEIsd0JBQXdCLEdBQUEsVUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtBQUM1QyxXQWpRMkIsQUFpUXBCLGVBalFtQyxXQWlRN0Isd0JBQXdCLEtBQUEsT0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUN2RCxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0dBQ2xDOztBQW5RVSxXQUFTLFdBcVFwQixtQkFBbUIsR0FBQSxVQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0FBQ3RDLFdBdFEyQixBQXNRcEIsZUF0UW1DLFdBc1E3QixtQkFBbUIsS0FBQSxPQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQ2pELGNBQWMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxJQUFJLEVBQUUsMENBQTBDLENBQUMsQ0FBQyxDQUFDO0dBQzFGOztBQXhRVSxXQUFTLFdBMFFwQixvQkFBb0IsR0FBQSxVQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQ3JDLFdBM1EyQixBQTJRcEIsZUEzUW1DLFdBMlE3QixvQkFBb0IsS0FBQSxPQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQ2hELHdCQUF3QixFQUFFLENBQzFCLDJCQUEyQixFQUFFLENBQUM7R0FDbEM7O1NBOVFVLFNBQVM7R0FBUyxlQUFlOztRQUFqQyxTQUFTLEdBQVQsU0FBUyIsImZpbGUiOiJzcmMvaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvcHlyaWdodCAyMDE0IFNoYXBlIFNlY3VyaXR5LCBJbmMuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKVxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHJlZHVjZSwge01vbm9pZGFsUmVkdWNlcn0gZnJvbSBcInNoaWZ0LXJlZHVjZXJcIjtcbmltcG9ydCB7a2V5d29yZH0gZnJvbSBcImVzdXRpbHNcIjtcbmNvbnN0IHtpc0lkZW50aWZpZXJOYW1lfSA9IGtleXdvcmQ7XG5cbmltcG9ydCB7VmFsaWRhdGlvbkNvbnRleHQsIFZhbGlkYXRpb25FcnJvcn0gZnJvbSBcIi4vdmFsaWRhdGlvbi1jb250ZXh0XCI7XG5cbmZ1bmN0aW9uIHVuaXF1ZUlkZW50aWZpZXJzKGlkZW50aWZpZXJzKSB7XG4gIGxldCBzZXQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICByZXR1cm4gaWRlbnRpZmllcnMuZXZlcnkoKGlkZW50aWZpZXIpID0+IHtcbiAgICBpZiAoc2V0W2lkZW50aWZpZXIubmFtZV0pIHJldHVybiBmYWxzZTtcbiAgICBzZXRbaWRlbnRpZmllci5uYW1lXSA9IHRydWU7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpc1ZhbGlkKG5vZGUpIHtcbiAgcmV0dXJuIFZhbGlkYXRvci52YWxpZGF0ZShub2RlKS5sZW5ndGggPT09IDA7XG59XG5cbmZ1bmN0aW9uIGlzSXRlcmF0aW9uU3RhdGVtZW50KHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcIkRvV2hpbGVTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiV2hpbGVTdGF0ZW1lbnRcIjpcbiAgICBjYXNlIFwiRm9yU3RhdGVtZW50XCI6XG4gICAgY2FzZSBcIkZvckluU3RhdGVtZW50XCI6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHRyYWlsaW5nU3RhdGVtZW50KG5vZGUpIHtcbiAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgY2FzZSBcIklmU3RhdGVtZW50XCI6XG4gICAgaWYgKG5vZGUuYWx0ZXJuYXRlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBub2RlLmFsdGVybmF0ZTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGUuY29uc2VxdWVudDtcblxuICBjYXNlIFwiTGFiZWxlZFN0YXRlbWVudFwiOlxuICBjYXNlIFwiRm9yU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJGb3JJblN0YXRlbWVudFwiOlxuICBjYXNlIFwiV2hpbGVTdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIldpdGhTdGF0ZW1lbnRcIjpcbiAgICByZXR1cm4gbm9kZS5ib2R5O1xuICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzUHJvYmxlbWF0aWNJZlN0YXRlbWVudChub2RlKSB7XG4gIGlmIChub2RlLnR5cGUgIT09IFwiSWZTdGF0ZW1lbnRcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAobm9kZS5hbHRlcm5hdGUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBsZXQgY3VycmVudCA9IG5vZGUuY29uc2VxdWVudDtcbiAgZG8ge1xuICAgIGlmIChjdXJyZW50LnR5cGUgPT09IFwiSWZTdGF0ZW1lbnRcIikge1xuICAgICAgaWYgKGN1cnJlbnQuYWx0ZXJuYXRlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnQgPSB0cmFpbGluZ1N0YXRlbWVudChjdXJyZW50KTtcbiAgfSB3aGlsZShjdXJyZW50KTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgY2xhc3MgVmFsaWRhdG9yIGV4dGVuZHMgTW9ub2lkYWxSZWR1Y2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVmFsaWRhdGlvbkNvbnRleHQpO1xuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlKG5vZGUpIHtcbiAgICByZXR1cm4gcmVkdWNlKG5ldyBWYWxpZGF0b3IsIG5vZGUpLmVycm9ycztcbiAgfVxuXG4gIHJlZHVjZUFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUsIGJpbmRpbmcsIGV4cHJlc3Npb24pIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUsIGJpbmRpbmcsIGV4cHJlc3Npb24pO1xuICAgIGlmIChub2RlLmJpbmRpbmcudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiKSB7XG4gICAgICB2ID0gdi5jaGVja1Jlc3RyaWN0ZWQobm9kZS5iaW5kaW5nLmlkZW50aWZpZXIpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUJyZWFrU3RhdGVtZW50KG5vZGUsIGxhYmVsKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VCcmVha1N0YXRlbWVudChub2RlLCBsYWJlbCk7XG4gICAgcmV0dXJuIG5vZGUubGFiZWwgPT0gbnVsbFxuICAgICAgPyB2LmFkZEZyZWVCcmVha1N0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiQnJlYWtTdGF0ZW1lbnQgbXVzdCBiZSBuZXN0ZWQgd2l0aGluIHN3aXRjaCBvciBpdGVyYXRpb24gc3RhdGVtZW50XCIpKVxuICAgICAgOiB2LmFkZEZyZWVCcmVha0p1bXBUYXJnZXQobm9kZS5sYWJlbCk7XG4gIH1cblxuICByZWR1Y2VDYXRjaENsYXVzZShub2RlLCBwYXJhbSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VDYXRjaENsYXVzZShub2RlLCBwYXJhbSwgYm9keSlcbiAgICAgIC5jaGVja1Jlc3RyaWN0ZWQobm9kZS5iaW5kaW5nKTtcbiAgfVxuXG4gIHJlZHVjZUNvbnRpbnVlU3RhdGVtZW50KG5vZGUsIGJvZHksIGxhYmVsKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VDb250aW51ZVN0YXRlbWVudChub2RlLCBib2R5LCBsYWJlbClcbiAgICAgIC5hZGRGcmVlQ29udGludWVTdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkNvbnRpbnVlU3RhdGVtZW50IG11c3QgYmUgaW5zaWRlIGFuIGl0ZXJhdGlvbiBzdGF0ZW1lbnRcIikpO1xuICAgIHJldHVybiBub2RlLmxhYmVsID09IG51bGwgPyB2IDogdi5hZGRGcmVlQ29udGludWVKdW1wVGFyZ2V0KG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlRG9XaGlsZVN0YXRlbWVudChub2RlLCBib2R5LCB0ZXN0KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZURvV2hpbGVTdGF0ZW1lbnQobm9kZSwgYm9keSwgdGVzdClcbiAgICAgIC5jbGVhckZyZWVDb250aW51ZVN0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlRm9ySW5TdGF0ZW1lbnQobm9kZSwgbGVmdCwgcmlnaHQsIGJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZvckluU3RhdGVtZW50KG5vZGUsIGxlZnQsIHJpZ2h0LCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gICAgaWYgKG5vZGUubGVmdC50eXBlID09PSBcIlZhcmlhYmxlRGVjbGFyYXRpb25cIiAmJiBub2RlLmxlZnQuZGVjbGFyYXRvcnMubGVuZ3RoID4gMSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLmxlZnQsIFwiVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCBpbiBGb3JJblZhclN0YXRlbWVudCBjb250YWlucyBtb3JlIHRoYW4gb25lIFZhcmlhYmxlRGVjbGFyYXRvclwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlRm9yU3RhdGVtZW50KG5vZGUsIGluaXQsIHRlc3QsIHVwZGF0ZSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VGb3JTdGF0ZW1lbnQobm9kZSwgaW5pdCwgdGVzdCwgdXBkYXRlLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VGdW5jdGlvbkJvZHkobm9kZSwgZGlyZWN0aXZlcywgc291cmNlRWxlbWVudHMpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uQm9keShub2RlLCBkaXJlY3RpdmVzLCBzb3VyY2VFbGVtZW50cyk7XG4gICAgaWYgKHYuZnJlZUp1bXBUYXJnZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHYgPSB2LmZyZWVKdW1wVGFyZ2V0cy5yZWR1Y2UoKHYxLCBpZGVudCkgPT4gdjEuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihpZGVudCwgXCJVbmJvdW5kIGJyZWFrL2NvbnRpbnVlIGxhYmVsXCIpKSwgdik7XG4gICAgfVxuICAgIGNvbnN0IGlzU3RyaWN0ID0gbm9kZS5kaXJlY3RpdmVzLnNvbWUoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS50eXBlID09PSBcIlVzZVN0cmljdERpcmVjdGl2ZVwiKTtcbiAgICBpZiAoaXNTdHJpY3QpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9ycyh2LnN0cmljdEVycm9ycyk7XG4gICAgfVxuICAgIHJldHVybiB2LmFkZEVycm9ycyh2LmZyZWVCcmVha1N0YXRlbWVudHMpLmFkZEVycm9ycyh2LmZyZWVDb250aW51ZVN0YXRlbWVudHMpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25EZWNsYXJhdGlvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRGVjbGFyYXRpb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KVxuICAgICAgLmNsZWFyVXNlZExhYmVsTmFtZXMoKVxuICAgICAgLmNsZWFyRnJlZVJldHVyblN0YXRlbWVudHMoKVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLm5hbWUpO1xuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRGVjbGFyYXRpb24gbXVzdCBoYXZlIHVuaXF1ZSBwYXJhbWV0ZXIgbmFtZXNcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpO1xuICAgIGlmIChub2RlLm5hbWUgIT0gbnVsbCkge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUubmFtZSk7XG4gICAgfVxuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRXhwcmVzc2lvbiBwYXJhbWV0ZXIgbmFtZXMgbXVzdCBiZSB1bmlxdWVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB2MS5jaGVja1Jlc3RyaWN0ZWQocGFyYW0pLCB2KTtcbiAgfVxuXG4gIHJlZHVjZUlkZW50aWZpZXIobm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIklkZW50aWZpZXIgYG5hbWVgIG11c3QgYmUgYSB2YWxpZCBJZGVudGlmaWVyTmFtZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlSWRlbnRpZmllckV4cHJlc3Npb24obm9kZSwgaWRlbnRpZmllcikge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VJZGVudGlmaWVyRXhwcmVzc2lvbihub2RlLCBpZGVudGlmaWVyKVxuICAgICAgLmNoZWNrUmVzZXJ2ZWQobm9kZS5pZGVudGlmaWVyKTtcbiAgfVxuXG4gIHJlZHVjZUlmU3RhdGVtZW50KG5vZGUsIHRlc3QsIGNvbnNlcXVlbnQsIGFsdGVybmF0ZSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlSWZTdGF0ZW1lbnQobm9kZSwgdGVzdCwgY29uc2VxdWVudCwgYWx0ZXJuYXRlKTtcbiAgICBpZiAoaXNQcm9ibGVtYXRpY0lmU3RhdGVtZW50KG5vZGUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiSWZTdGF0ZW1lbnQgd2l0aCBudWxsIGBhbHRlcm5hdGVgIG11c3Qgbm90IGJlIHRoZSBgY29uc2VxdWVudGAgb2YgYW4gSWZTdGF0ZW1lbnQgd2l0aCBhIG5vbi1udWxsIGBhbHRlcm5hdGVgXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIGxhYmVsLCBib2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VMYWJlbGVkU3RhdGVtZW50KG5vZGUsIGxhYmVsLCBib2R5KTtcbiAgICBpZiAodi51c2VkTGFiZWxOYW1lcy5zb21lKHMgPT4gcyA9PT0gbm9kZS5sYWJlbC5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkR1cGxpY2F0ZSBsYWJlbCBuYW1lLlwiKSk7XG4gICAgfVxuICAgIGlmIChpc0l0ZXJhdGlvblN0YXRlbWVudChub2RlLmJvZHkudHlwZSkpIHtcbiAgICAgICAgcmV0dXJuIHYub2JzZXJ2ZUl0ZXJhdGlvbkxhYmVsTmFtZShub2RlLmxhYmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIHYub2JzZXJ2ZU5vbkl0ZXJhdGlvbkxhYmVsTmFtZShub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZUxpdGVyYWxOdW1lcmljRXhwcmVzc2lvbihub2RlKSB7XG4gICAgbGV0IHYgPSB0aGlzLmlkZW50aXR5O1xuICAgIGlmIChub2RlLnZhbHVlIDwgMCB8fCBub2RlLnZhbHVlID09IDAgJiYgMSAvIG5vZGUudmFsdWUgPCAwKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBiZSBub24tbmVnYXRpdmVcIikpO1xuICAgIH0gZWxzZSBpZiAobm9kZS52YWx1ZSAhPT0gbm9kZS52YWx1ZSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk51bWVyaWMgTGl0ZXJhbCBub2RlIG11c3Qgbm90IGJlIE5hTlwiKSk7XG4gICAgfSBlbHNlIGlmICghZ2xvYmFsLmlzRmluaXRlKG5vZGUudmFsdWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBiZSBmaW5pdGVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUxpdGVyYWxSZWdFeHBFeHByZXNzaW9uKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgY29uc3QgbWVzc2FnZSA9IFwiTGl0ZXJhbFJlZ0V4cEV4cHJlc3NzaW9uIG11c3QgY29udGFpbiBhIHZhbGlkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhIFJlZ0V4cFwiLFxuICAgICAgZmlyc3RTbGFzaCA9IG5vZGUudmFsdWUuaW5kZXhPZihcIi9cIiksXG4gICAgICBsYXN0U2xhc2ggPSBub2RlLnZhbHVlLmxhc3RJbmRleE9mKFwiL1wiKTtcbiAgICBpZiAoZmlyc3RTbGFzaCAhPT0gMCB8fCBmaXJzdFNsYXNoID09PSBsYXN0U2xhc2gpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBSZWdFeHAobm9kZS52YWx1ZS5zbGljZSgxLCBsYXN0U2xhc2gpLCBub2RlLnZhbHVlLnNsaWNlKGxhc3RTbGFzaCArIDEpKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIG1lc3NhZ2UpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VPYmplY3RFeHByZXNzaW9uKG5vZGUsIHByb3BlcnRpZXMpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZU9iamVjdEV4cHJlc3Npb24obm9kZSwgcHJvcGVydGllcyk7XG4gICAgY29uc3Qgc2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZ2V0S2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3QgZGF0YUtleXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgbGV0IGtleSA9IGAgJHtwLm5hbWUudmFsdWV9YDtcbiAgICAgIHN3aXRjaCAocC50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJEYXRhUHJvcGVydHlcIjpcbiAgICAgICAgICBpZiAocC5uYW1lLnZhbHVlID09PSBcIl9fcHJvdG9fX1wiICYmIGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgZGF0YSBwcm9wZXJ0aWVzIHdpdGggbmFtZSBfX3Byb3RvX19cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZ2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBzZXR0ZXIgcHJvcGVydGllcyB3aXRoIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiR2V0dGVyXCI6XG4gICAgICAgICAgaWYgKGdldEtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBnZXR0ZXJzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhS2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIGdldHRlciBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZVwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGdldEtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJTZXR0ZXJcIjpcbiAgICAgICAgICBpZiAoc2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIHNldHRlcnMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgc2V0dGVyIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVBvc3RmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpO1xuICAgIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcmVmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVByZWZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCk7XG4gICAgaWYgKG5vZGUub3BlcmF0b3IgPT09IFwiZGVsZXRlXCIgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcImBkZWxldGVgIHdpdGggdW5xdWFsaWZpZWQgaWRlbnRpZmllciBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gICAgfSBlbHNlIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuY2hlY2tSZXN0cmljdGVkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcm9wZXJ0eU5hbWUobm9kZSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlUHJvcGVydHlOYW1lKG5vZGUpO1xuICAgIHN3aXRjaCAobm9kZS5raW5kKSB7XG4gICAgICBjYXNlIFwiaWRlbnRpZmllclwiOlxuICAgICAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggaWRlbnRpZmllciBraW5kIG11c3QgaGF2ZSBJZGVudGlmaWVyTmFtZSB2YWx1ZVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgIGlmICghL14oPzowfFsxLTldXFxkKlxcLj9cXGQqKSQvLnRlc3Qobm9kZS52YWx1ZSkpIHtcbiAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUHJvcGVydHlOYW1lIHdpdGggbnVtYmVyIGtpbmQgbXVzdCBoYXZlIG51bWVyaWMgdmFsdWVcIikpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVJldHVyblN0YXRlbWVudChub2RlLCBleHByZXNzaW9uKVxuICAgICAgLmFkZEZyZWVSZXR1cm5TdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlJldHVybiBzdGF0ZW1lbnQgbXVzdCBiZSBpbnNpZGUgb2YgYSBmdW5jdGlvblwiKSk7XG4gIH1cblxuICByZWR1Y2VTY3JpcHQobm9kZSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTY3JpcHQobm9kZSwgYm9keSlcbiAgICAgIC5hZGRFcnJvcnMoYm9keS5mcmVlUmV0dXJuU3RhdGVtZW50cyk7XG4gIH1cblxuICByZWR1Y2VTZXR0ZXIobm9kZSwgbmFtZSwgcGFyYW1ldGVyLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVNldHRlcihub2RlLCBuYW1lLCBwYXJhbWV0ZXIsIGJvZHkpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUucGFyYW1ldGVyKTtcbiAgfVxuXG4gIHJlZHVjZVN3aXRjaFN0YXRlbWVudChub2RlLCBkaXNjcmltaW5hbnQsIGNhc2VzKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVN3aXRjaFN0YXRlbWVudChub2RlLCBkaXNjcmltaW5hbnQsIGNhc2VzKVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlU3dpdGNoU3RhdGVtZW50V2l0aERlZmF1bHQobm9kZSwgZGlzY3JpbWluYW50LCBwcmVEZWZhdWx0Q2FzZXMsIGRlZmF1bHRDYXNlLCBwb3N0RGVmYXVsdENhc2VzKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0KG5vZGUsIGRpc2NyaW1pbmFudCwgcHJlRGVmYXVsdENhc2VzLCBkZWZhdWx0Q2FzZSwgcG9zdERlZmF1bHRDYXNlcylcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZVZhcmlhYmxlRGVjbGFyYXRvcihub2RlLCBiaW5kaW5nLCBpbml0KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVZhcmlhYmxlRGVjbGFyYXRvcihub2RlLCBiaW5kaW5nLCBpbml0KVxuICAgICAgLmNoZWNrUmVzdHJpY3RlZChub2RlLmJpbmRpbmcpO1xuICB9XG5cbiAgcmVkdWNlV2l0aFN0YXRlbWVudChub2RlLCBvYmplY3QsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlV2l0aFN0YXRlbWVudChub2RlLCBvYmplY3QsIGJvZHkpXG4gICAgICAuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIldpdGhTdGF0ZW1lbnQgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGVcIikpO1xuICB9XG5cbiAgcmVkdWNlV2hpbGVTdGF0ZW1lbnQobm9kZSwgdGVzdCwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VXaGlsZVN0YXRlbWVudChub2RlLCB0ZXN0LCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gIH1cbn1cbiJdfQ==