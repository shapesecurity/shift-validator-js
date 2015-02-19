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
    var v = MonoidalReducer.prototype.reduceVariableDeclarator.call(this, node, binding, init).checkRestricted(node.binding);
    if (node.init == null) {
      v = v.addUninitialisedDeclarator(new ValidationError(node, "Constant declarations must be initialised"));
    }
    return v;
  };

  Validator.prototype.reduceVariableDeclarationStatement = function (node, declaration) {
    var v = MonoidalReducer.prototype.reduceVariableDeclarationStatement.call(this, node, declaration);
    if (node.declaration.kind === "const") {
      v = v.enforceUninitialisedDeclarators();
    }
    return v;
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
//# sourceMappingURL=data:application/json;base64,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VUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtBQUN0QyxXQXhSMkIsQUF3UnBCLGVBeFJtQyxXQXdSN0IsbUJBQW1CLEtBQUEsT0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUNqRCxjQUFjLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLDBDQUEwQyxDQUFDLENBQUMsQ0FBQztHQUMxRjs7QUExUlUsV0FBUyxXQTRScEIsb0JBQW9CLEdBQUEsVUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtBQUNyQyxXQTdSMkIsQUE2UnBCLGVBN1JtQyxXQTZSN0Isb0JBQW9CLEtBQUEsT0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUNoRCx3QkFBd0IsRUFBRSxDQUMxQiwyQkFBMkIsRUFBRSxDQUFDO0dBQ2xDOztTQWhTVSxTQUFTO0dBQVMsZUFBZTs7UUFBakMsU0FBUyxHQUFULFNBQVMiLCJmaWxlIjoic3JjL2luZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBTaGFwZSBTZWN1cml0eSwgSW5jLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIilcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCByZWR1Y2UsIHtNb25vaWRhbFJlZHVjZXJ9IGZyb20gXCJzaGlmdC1yZWR1Y2VyXCI7XG5pbXBvcnQge2tleXdvcmR9IGZyb20gXCJlc3V0aWxzXCI7XG5jb25zdCB7aXNJZGVudGlmaWVyTmFtZX0gPSBrZXl3b3JkO1xuXG5pbXBvcnQge1ZhbGlkYXRpb25Db250ZXh0LCBWYWxpZGF0aW9uRXJyb3J9IGZyb20gXCIuL3ZhbGlkYXRpb24tY29udGV4dFwiO1xuXG5mdW5jdGlvbiB1bmlxdWVJZGVudGlmaWVycyhpZGVudGlmaWVycykge1xuICBsZXQgc2V0ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgcmV0dXJuIGlkZW50aWZpZXJzLmV2ZXJ5KChpZGVudGlmaWVyKSA9PiB7XG4gICAgaWYgKHNldFtpZGVudGlmaWVyLm5hbWVdKSByZXR1cm4gZmFsc2U7XG4gICAgc2V0W2lkZW50aWZpZXIubmFtZV0gPSB0cnVlO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaXNWYWxpZChub2RlKSB7XG4gIHJldHVybiBWYWxpZGF0b3IudmFsaWRhdGUobm9kZSkubGVuZ3RoID09PSAwO1xufVxuXG5mdW5jdGlvbiBpc0l0ZXJhdGlvblN0YXRlbWVudCh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgXCJEb1doaWxlU3RhdGVtZW50XCI6XG4gICAgY2FzZSBcIldoaWxlU3RhdGVtZW50XCI6XG4gICAgY2FzZSBcIkZvclN0YXRlbWVudFwiOlxuICAgIGNhc2UgXCJGb3JJblN0YXRlbWVudFwiOlxuICAgICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiB0cmFpbGluZ1N0YXRlbWVudChub2RlKSB7XG4gIHN3aXRjaCAobm9kZS50eXBlKSB7XG4gIGNhc2UgXCJJZlN0YXRlbWVudFwiOlxuICAgIGlmIChub2RlLmFsdGVybmF0ZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gbm9kZS5hbHRlcm5hdGU7XG4gICAgfVxuICAgIHJldHVybiBub2RlLmNvbnNlcXVlbnQ7XG5cbiAgY2FzZSBcIkxhYmVsZWRTdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIkZvclN0YXRlbWVudFwiOlxuICBjYXNlIFwiRm9ySW5TdGF0ZW1lbnRcIjpcbiAgY2FzZSBcIldoaWxlU3RhdGVtZW50XCI6XG4gIGNhc2UgXCJXaXRoU3RhdGVtZW50XCI6XG4gICAgcmV0dXJuIG5vZGUuYm9keTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNQcm9ibGVtYXRpY0lmU3RhdGVtZW50KG5vZGUpIHtcbiAgaWYgKG5vZGUudHlwZSAhPT0gXCJJZlN0YXRlbWVudFwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChub2RlLmFsdGVybmF0ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGxldCBjdXJyZW50ID0gbm9kZS5jb25zZXF1ZW50O1xuICBkbyB7XG4gICAgaWYgKGN1cnJlbnQudHlwZSA9PT0gXCJJZlN0YXRlbWVudFwiICYmIGN1cnJlbnQuYWx0ZXJuYXRlID09IG51bGwpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjdXJyZW50ID0gdHJhaWxpbmdTdGF0ZW1lbnQoY3VycmVudCk7XG4gIH0gd2hpbGUoY3VycmVudCAhPSBudWxsKTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgY2xhc3MgVmFsaWRhdG9yIGV4dGVuZHMgTW9ub2lkYWxSZWR1Y2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVmFsaWRhdGlvbkNvbnRleHQpO1xuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlKG5vZGUpIHtcbiAgICByZXR1cm4gcmVkdWNlKG5ldyBWYWxpZGF0b3IsIG5vZGUpLmVycm9ycztcbiAgfVxuXG4gIHJlZHVjZUFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUsIGJpbmRpbmcsIGV4cHJlc3Npb24pIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUsIGJpbmRpbmcsIGV4cHJlc3Npb24pO1xuICAgIGlmIChub2RlLmJpbmRpbmcudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiKSB7XG4gICAgICB2ID0gdi5jaGVja1Jlc3RyaWN0ZWQobm9kZS5iaW5kaW5nLmlkZW50aWZpZXIpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUJyZWFrU3RhdGVtZW50KG5vZGUsIGxhYmVsKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VCcmVha1N0YXRlbWVudChub2RlLCBsYWJlbCk7XG4gICAgcmV0dXJuIG5vZGUubGFiZWwgPT0gbnVsbFxuICAgICAgPyB2LmFkZEZyZWVCcmVha1N0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiQnJlYWtTdGF0ZW1lbnQgbXVzdCBiZSBuZXN0ZWQgd2l0aGluIHN3aXRjaCBvciBpdGVyYXRpb24gc3RhdGVtZW50XCIpKVxuICAgICAgOiB2LmFkZEZyZWVCcmVha0p1bXBUYXJnZXQobm9kZS5sYWJlbCk7XG4gIH1cblxuICByZWR1Y2VDYXRjaENsYXVzZShub2RlLCBwYXJhbSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VDYXRjaENsYXVzZShub2RlLCBwYXJhbSwgYm9keSlcbiAgICAgIC5jaGVja1Jlc3RyaWN0ZWQobm9kZS5iaW5kaW5nKTtcbiAgfVxuXG4gIHJlZHVjZUNvbnRpbnVlU3RhdGVtZW50KG5vZGUsIGJvZHksIGxhYmVsKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VDb250aW51ZVN0YXRlbWVudChub2RlLCBib2R5LCBsYWJlbClcbiAgICAgIC5hZGRGcmVlQ29udGludWVTdGF0ZW1lbnQobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkNvbnRpbnVlU3RhdGVtZW50IG11c3QgYmUgaW5zaWRlIGFuIGl0ZXJhdGlvbiBzdGF0ZW1lbnRcIikpO1xuICAgIHJldHVybiBub2RlLmxhYmVsID09IG51bGwgPyB2IDogdi5hZGRGcmVlQ29udGludWVKdW1wVGFyZ2V0KG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlRG9XaGlsZVN0YXRlbWVudChub2RlLCBib2R5LCB0ZXN0KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZURvV2hpbGVTdGF0ZW1lbnQobm9kZSwgYm9keSwgdGVzdClcbiAgICAgIC5jbGVhckZyZWVDb250aW51ZVN0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlRm9ySW5TdGF0ZW1lbnQobm9kZSwgbGVmdCwgcmlnaHQsIGJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZvckluU3RhdGVtZW50KG5vZGUsIGxlZnQsIHJpZ2h0LCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gICAgaWYgKG5vZGUubGVmdC50eXBlID09PSBcIlZhcmlhYmxlRGVjbGFyYXRpb25cIiAmJiBub2RlLmxlZnQuZGVjbGFyYXRvcnMubGVuZ3RoID4gMSkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLmxlZnQsIFwiVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCBpbiBGb3JJblZhclN0YXRlbWVudCBjb250YWlucyBtb3JlIHRoYW4gb25lIFZhcmlhYmxlRGVjbGFyYXRvclwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlRm9yU3RhdGVtZW50KG5vZGUsIGluaXQsIHRlc3QsIHVwZGF0ZSwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VGb3JTdGF0ZW1lbnQobm9kZSwgaW5pdCwgdGVzdCwgdXBkYXRlLCBib2R5KVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VGdW5jdGlvbkJvZHkobm9kZSwgZGlyZWN0aXZlcywgc291cmNlRWxlbWVudHMpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uQm9keShub2RlLCBkaXJlY3RpdmVzLCBzb3VyY2VFbGVtZW50cyk7XG4gICAgaWYgKHYuZnJlZUp1bXBUYXJnZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHYgPSB2LmZyZWVKdW1wVGFyZ2V0cy5yZWR1Y2UoKHYxLCBpZGVudCkgPT4gdjEuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihpZGVudCwgXCJVbmJvdW5kIGJyZWFrL2NvbnRpbnVlIGxhYmVsXCIpKSwgdik7XG4gICAgfVxuICAgIGNvbnN0IGlzU3RyaWN0ID0gbm9kZS5kaXJlY3RpdmVzLnNvbWUoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS50eXBlID09PSBcIlVzZVN0cmljdERpcmVjdGl2ZVwiKTtcbiAgICBpZiAoaXNTdHJpY3QpIHtcbiAgICAgIHYgPSB2LmVuZm9yY2VTdHJpY3RFcnJvcnMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHYuZW5mb3JjZUZyZWVCcmVha0FuZENvbnRpbnVlU3RhdGVtZW50RXJyb3JzKCk7XG4gIH1cblxuICByZWR1Y2VGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlRnVuY3Rpb25EZWNsYXJhdGlvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpXG4gICAgICAuY2xlYXJVc2VkTGFiZWxOYW1lcygpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUubmFtZSk7XG4gICAgaWYgKCF1bmlxdWVJZGVudGlmaWVycyhub2RlLnBhcmFtZXRlcnMpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRnVuY3Rpb25EZWNsYXJhdGlvbiBtdXN0IGhhdmUgdW5pcXVlIHBhcmFtZXRlciBuYW1lc1wiKSk7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnBhcmFtZXRlcnMucmVkdWNlKCh2MSwgcGFyYW0pID0+IHYxLmNoZWNrUmVzdHJpY3RlZChwYXJhbSksIHYpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25FeHByZXNzaW9uKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlRnVuY3Rpb25FeHByZXNzaW9uKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSlcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKCk7XG4gICAgaWYgKG5vZGUubmFtZSAhPSBudWxsKSB7XG4gICAgICB2ID0gdi5jaGVja1Jlc3RyaWN0ZWQobm9kZS5uYW1lKTtcbiAgICB9XG4gICAgaWYgKCF1bmlxdWVJZGVudGlmaWVycyhub2RlLnBhcmFtZXRlcnMpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRnVuY3Rpb25FeHByZXNzaW9uIHBhcmFtZXRlciBuYW1lcyBtdXN0IGJlIHVuaXF1ZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnBhcmFtZXRlcnMucmVkdWNlKCh2MSwgcGFyYW0pID0+IHYxLmNoZWNrUmVzdHJpY3RlZChwYXJhbSksIHYpO1xuICB9XG5cbiAgcmVkdWNlR2V0dGVyKG5vZGUsIG5hbWUsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlR2V0dGVyKG5vZGUsIG5hbWUsIGJvZHkpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlSWRlbnRpZmllcihub2RlKSB7XG4gICAgbGV0IHYgPSB0aGlzLmlkZW50aXR5O1xuICAgIGlmICghaXNJZGVudGlmaWVyTmFtZShub2RlLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiSWRlbnRpZmllciBgbmFtZWAgbXVzdCBiZSBhIHZhbGlkIElkZW50aWZpZXJOYW1lXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VJZGVudGlmaWVyRXhwcmVzc2lvbihub2RlLCBpZGVudGlmaWVyKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZUlkZW50aWZpZXJFeHByZXNzaW9uKG5vZGUsIGlkZW50aWZpZXIpXG4gICAgICAuY2hlY2tSZXNlcnZlZChub2RlLmlkZW50aWZpZXIpO1xuICB9XG5cbiAgcmVkdWNlSWZTdGF0ZW1lbnQobm9kZSwgdGVzdCwgY29uc2VxdWVudCwgYWx0ZXJuYXRlKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VJZlN0YXRlbWVudChub2RlLCB0ZXN0LCBjb25zZXF1ZW50LCBhbHRlcm5hdGUpO1xuICAgIGlmIChpc1Byb2JsZW1hdGljSWZTdGF0ZW1lbnQobm9kZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJJZlN0YXRlbWVudCB3aXRoIG51bGwgYGFsdGVybmF0ZWAgbXVzdCBub3QgYmUgdGhlIGBjb25zZXF1ZW50YCBvZiBhbiBJZlN0YXRlbWVudCB3aXRoIGEgbm9uLW51bGwgYGFsdGVybmF0ZWBcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUxhYmVsZWRTdGF0ZW1lbnQobm9kZSwgbGFiZWwsIGJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUxhYmVsZWRTdGF0ZW1lbnQobm9kZSwgbGFiZWwsIGJvZHkpO1xuICAgIGlmICh2LnVzZWRMYWJlbE5hbWVzLnNvbWUocyA9PiBzID09PSBub2RlLmxhYmVsLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRHVwbGljYXRlIGxhYmVsIG5hbWUuXCIpKTtcbiAgICB9XG4gICAgaWYgKGlzSXRlcmF0aW9uU3RhdGVtZW50KG5vZGUuYm9keS50eXBlKSkge1xuICAgICAgICByZXR1cm4gdi5vYnNlcnZlSXRlcmF0aW9uTGFiZWxOYW1lKG5vZGUubGFiZWwpO1xuICAgIH1cbiAgICByZXR1cm4gdi5vYnNlcnZlTm9uSXRlcmF0aW9uTGFiZWxOYW1lKG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlTGl0ZXJhbE51bWVyaWNFeHByZXNzaW9uKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgaWYgKG5vZGUudmFsdWUgPCAwIHx8IG5vZGUudmFsdWUgPT0gMCAmJiAxIC8gbm9kZS52YWx1ZSA8IDApIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IGJlIG5vbi1uZWdhdGl2ZVwiKSk7XG4gICAgfSBlbHNlIGlmIChub2RlLnZhbHVlICE9PSBub2RlLnZhbHVlKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBub3QgYmUgTmFOXCIpKTtcbiAgICB9IGVsc2UgaWYgKCFnbG9iYWwuaXNGaW5pdGUobm9kZS52YWx1ZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IGJlIGZpbml0ZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlTGl0ZXJhbFJlZ0V4cEV4cHJlc3Npb24obm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBjb25zdCBtZXNzYWdlID0gXCJMaXRlcmFsUmVnRXhwRXhwcmVzc3Npb24gbXVzdCBjb250YWluIGEgdmFsaWQgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgUmVnRXhwXCIsXG4gICAgICBmaXJzdFNsYXNoID0gbm9kZS52YWx1ZS5pbmRleE9mKFwiL1wiKSxcbiAgICAgIGxhc3RTbGFzaCA9IG5vZGUudmFsdWUubGFzdEluZGV4T2YoXCIvXCIpO1xuICAgIGlmIChmaXJzdFNsYXNoICE9PSAwIHx8IGZpcnN0U2xhc2ggPT09IGxhc3RTbGFzaCkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBtZXNzYWdlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIFJlZ0V4cChub2RlLnZhbHVlLnNsaWNlKDEsIGxhc3RTbGFzaCksIG5vZGUudmFsdWUuc2xpY2UobGFzdFNsYXNoICsgMSkpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZU9iamVjdEV4cHJlc3Npb24obm9kZSwgcHJvcGVydGllcykge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlT2JqZWN0RXhwcmVzc2lvbihub2RlLCBwcm9wZXJ0aWVzKTtcbiAgICBjb25zdCBzZXRLZXlzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBnZXRLZXlzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBkYXRhS2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgbm9kZS5wcm9wZXJ0aWVzLmZvckVhY2gocCA9PiB7XG4gICAgICBsZXQga2V5ID0gYCAke3AubmFtZS52YWx1ZX1gO1xuICAgICAgc3dpdGNoIChwLnR5cGUpIHtcbiAgICAgICAgY2FzZSBcIkRhdGFQcm9wZXJ0eVwiOlxuICAgICAgICAgIGlmIChwLm5hbWUudmFsdWUgPT09IFwiX19wcm90b19fXCIgJiYgZGF0YUtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBkYXRhIHByb3BlcnRpZXMgd2l0aCBuYW1lIF9fcHJvdG9fX1wiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChnZXRLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgZ2V0dGVyIHByb3BlcnRpZXMgd2l0aCBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIHNldHRlciBwcm9wZXJ0aWVzIHdpdGggc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGF0YUtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJHZXR0ZXJcIjpcbiAgICAgICAgICBpZiAoZ2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIGdldHRlcnMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgZ2V0dGVyIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZ2V0S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIlNldHRlclwiOlxuICAgICAgICAgIGlmIChzZXRLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgc2V0dGVycyB3aXRoIHRoZSBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YUtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBzZXR0ZXIgcHJvcGVydGllcyB3aXRoIHRoZSBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZXRLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUG9zdGZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlUG9zdGZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCk7XG4gICAgaWYgKChub2RlLm9wZXJhdG9yID09PSBcIisrXCIgfHwgbm9kZS5vcGVyYXRvciA9PT0gXCItLVwiKSAmJiBub2RlLm9wZXJhbmQudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiKSB7XG4gICAgICB2ID0gdi5jaGVja1Jlc3RyaWN0ZWQobm9kZS5vcGVyYW5kLmlkZW50aWZpZXIpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVByZWZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlUHJlZml4RXhwcmVzc2lvbihub2RlLCBvcGVyYW5kKTtcbiAgICBpZiAobm9kZS5vcGVyYXRvciA9PT0gXCJkZWxldGVcIiAmJiBub2RlLm9wZXJhbmQudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiYGRlbGV0ZWAgd2l0aCB1bnF1YWxpZmllZCBpZGVudGlmaWVyIG5vdCBhbGxvd2VkIGluIHN0cmljdCBtb2RlXCIpKTtcbiAgICB9IGVsc2UgaWYgKChub2RlLm9wZXJhdG9yID09PSBcIisrXCIgfHwgbm9kZS5vcGVyYXRvciA9PT0gXCItLVwiKSAmJiBub2RlLm9wZXJhbmQudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiKSB7XG4gICAgICB2ID0gdi5jaGVja1Jlc3RyaWN0ZWQobm9kZS5vcGVyYW5kLmlkZW50aWZpZXIpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVByb3BlcnR5TmFtZShub2RlKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VQcm9wZXJ0eU5hbWUobm9kZSk7XG4gICAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICAgIGNhc2UgXCJpZGVudGlmaWVyXCI6XG4gICAgICAgIGlmICghaXNJZGVudGlmaWVyTmFtZShub2RlLnZhbHVlKSkge1xuICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJQcm9wZXJ0eU5hbWUgd2l0aCBpZGVudGlmaWVyIGtpbmQgbXVzdCBoYXZlIElkZW50aWZpZXJOYW1lIHZhbHVlXCIpKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgaWYgKCEvXig/OjB8WzEtOV1cXGQqXFwuP1xcZCopJC8udGVzdChub2RlLnZhbHVlKSkge1xuICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJQcm9wZXJ0eU5hbWUgd2l0aCBudW1iZXIga2luZCBtdXN0IGhhdmUgbnVtZXJpYyB2YWx1ZVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUmV0dXJuU3RhdGVtZW50KG5vZGUsIGV4cHJlc3Npb24pIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlUmV0dXJuU3RhdGVtZW50KG5vZGUsIGV4cHJlc3Npb24pXG4gICAgICAuYWRkRnJlZVJldHVyblN0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUmV0dXJuIHN0YXRlbWVudCBtdXN0IGJlIGluc2lkZSBvZiBhIGZ1bmN0aW9uXCIpKTtcbiAgfVxuXG4gIHJlZHVjZVNjcmlwdChub2RlLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVNjcmlwdChub2RlLCBib2R5KVxuICAgICAgLmVuZm9yY2VGcmVlUmV0dXJuU3RhdGVtZW50RXJyb3JzKCk7XG4gIH1cblxuICByZWR1Y2VTZXR0ZXIobm9kZSwgbmFtZSwgcGFyYW1ldGVyLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVNldHRlcihub2RlLCBuYW1lLCBwYXJhbWV0ZXIsIGJvZHkpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpXG4gICAgICAuY2hlY2tSZXN0cmljdGVkKG5vZGUucGFyYW1ldGVyKTtcbiAgfVxuXG4gIHJlZHVjZVN3aXRjaFN0YXRlbWVudChub2RlLCBkaXNjcmltaW5hbnQsIGNhc2VzKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVN3aXRjaFN0YXRlbWVudChub2RlLCBkaXNjcmltaW5hbnQsIGNhc2VzKVxuICAgICAgLmNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlU3dpdGNoU3RhdGVtZW50V2l0aERlZmF1bHQobm9kZSwgZGlzY3JpbWluYW50LCBwcmVEZWZhdWx0Q2FzZXMsIGRlZmF1bHRDYXNlLCBwb3N0RGVmYXVsdENhc2VzKSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0KG5vZGUsIGRpc2NyaW1pbmFudCwgcHJlRGVmYXVsdENhc2VzLCBkZWZhdWx0Q2FzZSwgcG9zdERlZmF1bHRDYXNlcylcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZVZhcmlhYmxlRGVjbGFyYXRvcihub2RlLCBiaW5kaW5nLCBpbml0KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VWYXJpYWJsZURlY2xhcmF0b3Iobm9kZSwgYmluZGluZywgaW5pdClcbiAgICAgIC5jaGVja1Jlc3RyaWN0ZWQobm9kZS5iaW5kaW5nKTtcbiAgICBpZiAobm9kZS5pbml0ID09IG51bGwpIHtcbiAgICAgIHYgPSB2LmFkZFVuaW5pdGlhbGlzZWREZWNsYXJhdG9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJDb25zdGFudCBkZWNsYXJhdGlvbnMgbXVzdCBiZSBpbml0aWFsaXNlZFwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudChub2RlLCBkZWNsYXJhdGlvbikge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudChub2RlLCBkZWNsYXJhdGlvbilcbiAgICBpZiAobm9kZS5kZWNsYXJhdGlvbi5raW5kID09PSBcImNvbnN0XCIpIHtcbiAgICAgIHYgPSB2LmVuZm9yY2VVbmluaXRpYWxpc2VkRGVjbGFyYXRvcnMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VXaXRoU3RhdGVtZW50KG5vZGUsIG9iamVjdCwgYm9keSkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VXaXRoU3RhdGVtZW50KG5vZGUsIG9iamVjdCwgYm9keSlcbiAgICAgIC5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiV2l0aFN0YXRlbWVudCBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gIH1cblxuICByZWR1Y2VXaGlsZVN0YXRlbWVudChub2RlLCB0ZXN0LCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVdoaWxlU3RhdGVtZW50KG5vZGUsIHRlc3QsIGJvZHkpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVDb250aW51ZVN0YXRlbWVudHMoKTtcbiAgfVxufVxuIl19