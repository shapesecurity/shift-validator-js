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
var isRestrictedWord = keyword.isRestrictedWord;
var isIdentifierName = keyword.isIdentifierName;
var isReservedWordES5 = keyword.isReservedWordES5;
var isReservedWordES6 = keyword.isReservedWordES6;
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
    if (node.binding.type === "IdentifierExpression" && isRestrictedWord(node.binding.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "IdentifierExpression must not be a restricted word"));
    }
    return v;
  };

  Validator.prototype.reduceBreakStatement = function (node, label) {
    var v = MonoidalReducer.prototype.reduceBreakStatement.call(this, node, label);
    return node.label == null ? v.addFreeBreakStatement(new ValidationError(node, "break must be nested within switch or iteration statement")) : v.addFreeJumpTarget(node.label);
  };

  Validator.prototype.reduceCatchClause = function (node, param, body) {
    var v = MonoidalReducer.prototype.reduceCatchClause.call(this, node, param, body);
    if (isRestrictedWord(node.binding.name)) {
      v = v.addStrictError(new ValidationError(node, "CatchClause binding must not be restricted in strict mode"));
    }
    return v;
  };

  Validator.prototype.reduceContinueStatement = function (node, body, label) {
    var v = MonoidalReducer.prototype.reduceContinueStatement.call(this, node, body, label).addFreeContinueStatement(new ValidationError(node, "Continue statement must be inside a recursive loop"));
    return node.label == null ? v : v.addFreeJumpTarget(node.label);
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
    var v = MonoidalReducer.prototype.reduceFunctionDeclaration.call(this, node, name, parameters, functionBody).clearUsedLabelNames().clearFreeReturnStatements();
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionDeclaration must have unique parameter names"));
    }
    v = node.parameters.reduce(function (v1, param) {
      if (isRestrictedWord(param.name)) {
        return v1.addStrictError(new ValidationError(param, "FunctionDeclaration parameter name must not be restricted word"));
      }
      return v1;
    }, v);
    if (isRestrictedWord(node.name.name)) {
      v = v.addStrictError(new ValidationError(node, "FunctionDeclaration `name` must not be `eval` or `arguments` in strict mode"));
    }
    return v;
  };

  Validator.prototype.reduceFunctionExpression = function (node, name, parameters, functionBody) {
    var v = MonoidalReducer.prototype.reduceFunctionExpression.call(this, node, name, parameters, functionBody).clearFreeReturnStatements();
    if (!uniqueIdentifiers(node.parameters)) {
      v = v.addStrictError(new ValidationError(node, "FunctionExpression parameter names must be unique"));
    }
    v = node.parameters.reduce(function (v1, param) {
      if (isRestrictedWord(param.name)) {
        return v1.addStrictError(new ValidationError(param, "FunctionExpression parameter name must not be restricted word"));
      }
      return v1;
    }, v);
    return node.name == null || !isRestrictedWord(node.name.name) ? v : v.addStrictError(new ValidationError(node, "FunctionExpression `name` must not be `eval` or `arguments` in strict mode"));
  };

  Validator.prototype.reduceIdentifier = function (node) {
    var v = this.identity;
    if (!isIdentifierName(node.name)) {
      v = v.addError(new ValidationError(node, "Identifier `name` must be a valid IdentifierName"));
    }
    if (isReservedWordES5(node.name, false)) {
      v = v.addError(new ValidationError(node, "Identifier `name` must not be a reserved word"));
    }
    return v;
  };

  Validator.prototype.reduceIdentifierExpression = function (node, identifier) {
    var v = MonoidalReducer.prototype.reduceIdentifierExpression.call(this, node, identifier);
    if (isReservedWordES5(node.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "Reserved word used in IdentifierExpression"));
    } else if (isReservedWordES6(node.identifier.name, true)) {
      v = v.addStrictError(new ValidationError(node, "Strict mode reserved word used in IdentifierExpression"));
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
    return v.observeLabelName(node.label);
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
    if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression" && isRestrictedWord(node.operand.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "Restricted words must not be incremented/decremented in strict mode"));
    }
    return v;
  };

  Validator.prototype.reducePrefixExpression = function (node, operand) {
    var v = MonoidalReducer.prototype.reducePrefixExpression.call(this, node, operand);
    if (node.operator === "delete" && node.operand.type === "IdentifierExpression") {
      v = v.addStrictError(new ValidationError(node, "`delete` with unqualified identifier not allowed in strict mode"));
    } else if ((node.operator === "++" || node.operator === "--") && node.operand.type === "IdentifierExpression" && isRestrictedWord(node.operand.identifier.name)) {
      v = v.addStrictError(new ValidationError(node, "Restricted words must not be incremented/decremented in strict mode"));
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
    var v = MonoidalReducer.prototype.reduceSetter.call(this, node, name, parameter, body);
    if (isRestrictedWord(node.parameter.name)) {
      v = v.addStrictError(new ValidationError(node, "SetterProperty parameter must not be a restricted name"));
    }
    return v;
  };

  Validator.prototype.reduceSwitchStatement = function (node, discriminant, cases) {
    return MonoidalReducer.prototype.reduceSwitchStatement.call(this, node, discriminant, cases).clearFreeBreakStatements();
  };

  Validator.prototype.reduceSwitchStatementWithDefault = function (node, discriminant, preDefaultCases, defaultCase, postDefaultCases) {
    return MonoidalReducer.prototype.reduceSwitchStatementWithDefault.call(this, node, discriminant, preDefaultCases, defaultCase, postDefaultCases).clearFreeBreakStatements();
  };

  Validator.prototype.reduceVariableDeclarator = function (node, binding, init) {
    var v = MonoidalReducer.prototype.reduceVariableDeclarator.call(this, node, binding, init);
    if (isRestrictedWord(node.binding.name)) {
      v = v.addStrictError(new ValidationError(node, "VariableDeclarator must not be restricted name"));
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
//# sourceMappingURL=data:application/json;base64,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LEVBQUUsQ0FBQztHQUMvQjs7QUE3UFUsV0FBUyxXQStQcEIsd0JBQXdCLEdBQUEsVUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtBQUM1QyxRQUFJLENBQUMsR0FoUXNCLEFBZ1FuQixlQWhRa0MsV0FnUTVCLHdCQUF3QixLQUFBLE9BQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM1RCxRQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdkMsT0FBQyxHQUFHLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLGdEQUFnRCxDQUFDLENBQUMsQ0FBQztLQUNuRztBQUNELFdBQU8sQ0FBQyxDQUFDO0dBQ1Y7O0FBclFVLFdBQVMsV0F1UXBCLG1CQUFtQixHQUFBLFVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7QUFDdEMsV0F4UTJCLEFBd1FwQixlQXhRbUMsV0F3UTdCLG1CQUFtQixLQUFBLE9BQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FDakQsY0FBYyxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSwwQ0FBMEMsQ0FBQyxDQUFDLENBQUM7R0FDMUY7O0FBMVFVLFdBQVMsV0E0UXBCLG9CQUFvQixHQUFBLFVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUU7QUFDckMsV0E3UTJCLEFBNlFwQixlQTdRbUMsV0E2UTdCLG9CQUFvQixLQUFBLE9BQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FDaEQsd0JBQXdCLEVBQUUsQ0FDMUIsMkJBQTJCLEVBQUUsQ0FBQztHQUNsQzs7U0FoUlUsU0FBUztHQUFTLGVBQWU7O1FBQWpDLFNBQVMsR0FBVCxTQUFTIiwiZmlsZSI6InNyYy9pbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgU2hhcGUgU2VjdXJpdHksIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgcmVkdWNlLCB7TW9ub2lkYWxSZWR1Y2VyfSBmcm9tIFwic2hpZnQtcmVkdWNlclwiO1xuaW1wb3J0IHtrZXl3b3JkfSBmcm9tIFwiZXN1dGlsc1wiO1xuY29uc3Qge2lzUmVzdHJpY3RlZFdvcmQsIGlzSWRlbnRpZmllck5hbWUsIGlzUmVzZXJ2ZWRXb3JkRVM1LCBpc1Jlc2VydmVkV29yZEVTNn0gPSBrZXl3b3JkO1xuXG5pbXBvcnQge1ZhbGlkYXRpb25Db250ZXh0LCBWYWxpZGF0aW9uRXJyb3J9IGZyb20gXCIuL3ZhbGlkYXRpb24tY29udGV4dFwiO1xuXG5mdW5jdGlvbiB1bmlxdWVJZGVudGlmaWVycyhpZGVudGlmaWVycykge1xuICBsZXQgc2V0ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgcmV0dXJuIGlkZW50aWZpZXJzLmV2ZXJ5KChpZGVudGlmaWVyKSA9PiB7XG4gICAgaWYgKHNldFtpZGVudGlmaWVyLm5hbWVdKSByZXR1cm4gZmFsc2U7XG4gICAgc2V0W2lkZW50aWZpZXIubmFtZV0gPSB0cnVlO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaXNWYWxpZChub2RlKSB7XG4gIHJldHVybiBWYWxpZGF0b3IudmFsaWRhdGUobm9kZSkubGVuZ3RoID09PSAwO1xufVxuXG5leHBvcnQgY2xhc3MgVmFsaWRhdG9yIGV4dGVuZHMgTW9ub2lkYWxSZWR1Y2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVmFsaWRhdGlvbkNvbnRleHQpO1xuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlKG5vZGUpIHtcbiAgICByZXR1cm4gcmVkdWNlKG5ldyBWYWxpZGF0b3IsIG5vZGUpLmVycm9ycztcbiAgfVxuXG4gIHJlZHVjZUFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUsIGJpbmRpbmcsIGV4cHJlc3Npb24pIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUFzc2lnbm1lbnRFeHByZXNzaW9uKG5vZGUsIGJpbmRpbmcsIGV4cHJlc3Npb24pO1xuICAgIGlmIChub2RlLmJpbmRpbmcudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiICYmIGlzUmVzdHJpY3RlZFdvcmQobm9kZS5iaW5kaW5nLmlkZW50aWZpZXIubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJJZGVudGlmaWVyRXhwcmVzc2lvbiBtdXN0IG5vdCBiZSBhIHJlc3RyaWN0ZWQgd29yZFwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlQnJlYWtTdGF0ZW1lbnQobm9kZSwgbGFiZWwpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUJyZWFrU3RhdGVtZW50KG5vZGUsIGxhYmVsKTtcbiAgICByZXR1cm4gbm9kZS5sYWJlbCA9PSBudWxsXG4gICAgICA/IHYuYWRkRnJlZUJyZWFrU3RhdGVtZW50KG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJicmVhayBtdXN0IGJlIG5lc3RlZCB3aXRoaW4gc3dpdGNoIG9yIGl0ZXJhdGlvbiBzdGF0ZW1lbnRcIikpXG4gICAgICA6IHYuYWRkRnJlZUp1bXBUYXJnZXQobm9kZS5sYWJlbCk7XG4gIH1cblxuICByZWR1Y2VDYXRjaENsYXVzZShub2RlLCBwYXJhbSwgYm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlQ2F0Y2hDbGF1c2Uobm9kZSwgcGFyYW0sIGJvZHkpO1xuICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKG5vZGUuYmluZGluZy5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkNhdGNoQ2xhdXNlIGJpbmRpbmcgbXVzdCBub3QgYmUgcmVzdHJpY3RlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlQ29udGludWVTdGF0ZW1lbnQobm9kZSwgYm9keSwgbGFiZWwpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUNvbnRpbnVlU3RhdGVtZW50KG5vZGUsIGJvZHksIGxhYmVsKVxuICAgICAgLmFkZEZyZWVDb250aW51ZVN0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiQ29udGludWUgc3RhdGVtZW50IG11c3QgYmUgaW5zaWRlIGEgcmVjdXJzaXZlIGxvb3BcIikpO1xuICAgIHJldHVybiBub2RlLmxhYmVsID09IG51bGwgPyB2IDogdi5hZGRGcmVlSnVtcFRhcmdldChub2RlLmxhYmVsKTtcbiAgfVxuXG4gIHJlZHVjZURvV2hpbGVTdGF0ZW1lbnQobm9kZSwgYm9keSwgdGVzdCkge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VEb1doaWxlU3RhdGVtZW50KG5vZGUsIGJvZHksIHRlc3QpXG4gICAgICAuY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKClcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZUZvckluU3RhdGVtZW50KG5vZGUsIGxlZnQsIHJpZ2h0LCBib2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGb3JJblN0YXRlbWVudChub2RlLCBsZWZ0LCByaWdodCwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICAgIGlmIChub2RlLmxlZnQudHlwZSA9PT0gXCJWYXJpYWJsZURlY2xhcmF0aW9uXCIgJiYgbm9kZS5sZWZ0LmRlY2xhcmF0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZS5sZWZ0LCBcIlZhcmlhYmxlRGVjbGFyYXRpb25TdGF0ZW1lbnQgaW4gRm9ySW5WYXJTdGF0ZW1lbnQgY29udGFpbnMgbW9yZSB0aGFuIG9uZSBWYXJpYWJsZURlY2xhcmF0b3JcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUZvclN0YXRlbWVudChub2RlLCBpbml0LCB0ZXN0LCB1cGRhdGUsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlRm9yU3RhdGVtZW50KG5vZGUsIGluaXQsIHRlc3QsIHVwZGF0ZSwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG5cbiAgcmVkdWNlRnVuY3Rpb25Cb2R5KG5vZGUsIGRpcmVjdGl2ZXMsIHNvdXJjZUVsZW1lbnRzKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGdW5jdGlvbkJvZHkobm9kZSwgZGlyZWN0aXZlcywgc291cmNlRWxlbWVudHMpO1xuICAgIGlmICh2LmZyZWVKdW1wVGFyZ2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICB2ID0gdi5mcmVlSnVtcFRhcmdldHMucmVkdWNlKCh2MSwgaWRlbnQpID0+IHYxLmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3IoaWRlbnQsIFwiVW5ib3VuZCBicmVhay9jb250aW51ZSBsYWJlbFwiKSksIHYpO1xuICAgIH1cbiAgICBjb25zdCBpc1N0cmljdCA9IG5vZGUuZGlyZWN0aXZlcy5zb21lKGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUudHlwZSA9PT0gXCJVc2VTdHJpY3REaXJlY3RpdmVcIik7XG4gICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcnModi5zdHJpY3RFcnJvcnMpO1xuICAgIH1cbiAgICByZXR1cm4gdi5hZGRFcnJvcnModi5mcmVlQnJlYWtTdGF0ZW1lbnRzKS5hZGRFcnJvcnModi5mcmVlQ29udGludWVTdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRGVjbGFyYXRpb24obm9kZSwgbmFtZSwgcGFyYW1ldGVycywgZnVuY3Rpb25Cb2R5KSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUsIG5hbWUsIHBhcmFtZXRlcnMsIGZ1bmN0aW9uQm9keSlcbiAgICAgIC5jbGVhclVzZWRMYWJlbE5hbWVzKClcbiAgICAgIC5jbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKCk7XG4gICAgaWYgKCF1bmlxdWVJZGVudGlmaWVycyhub2RlLnBhcmFtZXRlcnMpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRnVuY3Rpb25EZWNsYXJhdGlvbiBtdXN0IGhhdmUgdW5pcXVlIHBhcmFtZXRlciBuYW1lc1wiKSk7XG4gICAgfVxuICAgIHYgPSBub2RlLnBhcmFtZXRlcnMucmVkdWNlKCh2MSwgcGFyYW0pID0+IHtcbiAgICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKHBhcmFtLm5hbWUpKSB7XG4gICAgICAgIHJldHVybiB2MS5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKHBhcmFtLCBcIkZ1bmN0aW9uRGVjbGFyYXRpb24gcGFyYW1ldGVyIG5hbWUgbXVzdCBub3QgYmUgcmVzdHJpY3RlZCB3b3JkXCIpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2MTtcbiAgICB9LCB2KTtcbiAgICBpZiAoaXNSZXN0cmljdGVkV29yZChub2RlLm5hbWUubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJGdW5jdGlvbkRlY2xhcmF0aW9uIGBuYW1lYCBtdXN0IG5vdCBiZSBgZXZhbGAgb3IgYGFyZ3VtZW50c2AgaW4gc3RyaWN0IG1vZGVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZUZ1bmN0aW9uRXhwcmVzc2lvbihub2RlLCBuYW1lLCBwYXJhbWV0ZXJzLCBmdW5jdGlvbkJvZHkpXG4gICAgICAuY2xlYXJGcmVlUmV0dXJuU3RhdGVtZW50cygpO1xuICAgIGlmICghdW5pcXVlSWRlbnRpZmllcnMobm9kZS5wYXJhbWV0ZXJzKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIkZ1bmN0aW9uRXhwcmVzc2lvbiBwYXJhbWV0ZXIgbmFtZXMgbXVzdCBiZSB1bmlxdWVcIikpO1xuICAgIH1cbiAgICB2ID0gbm9kZS5wYXJhbWV0ZXJzLnJlZHVjZSgodjEsIHBhcmFtKSA9PiB7XG4gICAgICBpZiAoaXNSZXN0cmljdGVkV29yZChwYXJhbS5uYW1lKSkge1xuICAgICAgICByZXR1cm4gdjEuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihwYXJhbSwgXCJGdW5jdGlvbkV4cHJlc3Npb24gcGFyYW1ldGVyIG5hbWUgbXVzdCBub3QgYmUgcmVzdHJpY3RlZCB3b3JkXCIpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2MTtcbiAgICB9LCB2KTtcbiAgICByZXR1cm4gbm9kZS5uYW1lID09IG51bGwgfHwgIWlzUmVzdHJpY3RlZFdvcmQobm9kZS5uYW1lLm5hbWUpXG4gICAgICA/IHZcbiAgICAgIDogdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiRnVuY3Rpb25FeHByZXNzaW9uIGBuYW1lYCBtdXN0IG5vdCBiZSBgZXZhbGAgb3IgYGFyZ3VtZW50c2AgaW4gc3RyaWN0IG1vZGVcIikpO1xuICB9XG5cbiAgcmVkdWNlSWRlbnRpZmllcihub2RlKSB7XG4gICAgbGV0IHYgPSB0aGlzLmlkZW50aXR5O1xuICAgIGlmICghaXNJZGVudGlmaWVyTmFtZShub2RlLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiSWRlbnRpZmllciBgbmFtZWAgbXVzdCBiZSBhIHZhbGlkIElkZW50aWZpZXJOYW1lXCIpKTtcbiAgICB9XG4gICAgaWYgKGlzUmVzZXJ2ZWRXb3JkRVM1KG5vZGUubmFtZSwgZmFsc2UpKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiSWRlbnRpZmllciBgbmFtZWAgbXVzdCBub3QgYmUgYSByZXNlcnZlZCB3b3JkXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VJZGVudGlmaWVyRXhwcmVzc2lvbihub2RlLCBpZGVudGlmaWVyKSB7XG4gICAgbGV0IHYgPSBzdXBlci5yZWR1Y2VJZGVudGlmaWVyRXhwcmVzc2lvbihub2RlLCBpZGVudGlmaWVyKTtcbiAgICBpZiAoaXNSZXNlcnZlZFdvcmRFUzUobm9kZS5pZGVudGlmaWVyLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUmVzZXJ2ZWQgd29yZCB1c2VkIGluIElkZW50aWZpZXJFeHByZXNzaW9uXCIpKTtcbiAgICB9IGVsc2UgaWYgKGlzUmVzZXJ2ZWRXb3JkRVM2KG5vZGUuaWRlbnRpZmllci5uYW1lLCB0cnVlKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlN0cmljdCBtb2RlIHJlc2VydmVkIHdvcmQgdXNlZCBpbiBJZGVudGlmaWVyRXhwcmVzc2lvblwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlTGFiZWxlZFN0YXRlbWVudChub2RlLCBsYWJlbCwgYm9keSkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlTGFiZWxlZFN0YXRlbWVudChub2RlLCBsYWJlbCwgYm9keSk7XG4gICAgaWYgKHYudXNlZExhYmVsTmFtZXMuc29tZShzID0+IHMgPT09IG5vZGUubGFiZWwubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJEdXBsaWNhdGUgbGFiZWwgbmFtZS5cIikpO1xuICAgIH1cbiAgICByZXR1cm4gdi5vYnNlcnZlTGFiZWxOYW1lKG5vZGUubGFiZWwpO1xuICB9XG5cbiAgcmVkdWNlTGl0ZXJhbE51bWVyaWNFeHByZXNzaW9uKG5vZGUpIHtcbiAgICBsZXQgdiA9IHRoaXMuaWRlbnRpdHk7XG4gICAgaWYgKG5vZGUudmFsdWUgPCAwIHx8IG5vZGUudmFsdWUgPT0gMCAmJiAxIC8gbm9kZS52YWx1ZSA8IDApIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IGJlIG5vbi1uZWdhdGl2ZVwiKSk7XG4gICAgfSBlbHNlIGlmIChub2RlLnZhbHVlICE9PSBub2RlLnZhbHVlKSB7XG4gICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiTnVtZXJpYyBMaXRlcmFsIG5vZGUgbXVzdCBub3QgYmUgTmFOXCIpKTtcbiAgICB9IGVsc2UgaWYgKCFnbG9iYWwuaXNGaW5pdGUobm9kZS52YWx1ZSkpIHtcbiAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJOdW1lcmljIExpdGVyYWwgbm9kZSBtdXN0IGJlIGZpbml0ZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlTGl0ZXJhbFJlZ0V4cEV4cHJlc3Npb24obm9kZSkge1xuICAgIGxldCB2ID0gdGhpcy5pZGVudGl0eTtcbiAgICBjb25zdCBtZXNzYWdlID0gXCJMaXRlcmFsUmVnRXhwRXhwcmVzc3Npb24gbXVzdCBjb250YWluIGEgdmFsaWQgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgUmVnRXhwXCIsXG4gICAgICBmaXJzdFNsYXNoID0gbm9kZS52YWx1ZS5pbmRleE9mKFwiL1wiKSxcbiAgICAgIGxhc3RTbGFzaCA9IG5vZGUudmFsdWUubGFzdEluZGV4T2YoXCIvXCIpO1xuICAgIGlmIChmaXJzdFNsYXNoICE9PSAwIHx8IGZpcnN0U2xhc2ggPT09IGxhc3RTbGFzaCkge1xuICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBtZXNzYWdlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIFJlZ0V4cChub2RlLnZhbHVlLnNsaWNlKDEsIGxhc3RTbGFzaCksIG5vZGUudmFsdWUuc2xpY2UobGFzdFNsYXNoICsgMSkpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZU9iamVjdEV4cHJlc3Npb24obm9kZSwgcHJvcGVydGllcykge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlT2JqZWN0RXhwcmVzc2lvbihub2RlLCBwcm9wZXJ0aWVzKTtcbiAgICBjb25zdCBzZXRLZXlzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBnZXRLZXlzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBkYXRhS2V5cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgbm9kZS5wcm9wZXJ0aWVzLmZvckVhY2gocCA9PiB7XG4gICAgICBsZXQga2V5ID0gYCAke3AubmFtZS52YWx1ZX1gO1xuICAgICAgc3dpdGNoIChwLnR5cGUpIHtcbiAgICAgICAgY2FzZSBcIkRhdGFQcm9wZXJ0eVwiOlxuICAgICAgICAgIGlmIChwLm5hbWUudmFsdWUgPT09IFwiX19wcm90b19fXCIgJiYgZGF0YUtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBtdWx0aXBsZSBkYXRhIHByb3BlcnRpZXMgd2l0aCBuYW1lIF9fcHJvdG9fX1wiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChnZXRLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgZ2V0dGVyIHByb3BlcnRpZXMgd2l0aCBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIGRhdGEgYW5kIHNldHRlciBwcm9wZXJ0aWVzIHdpdGggc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGF0YUtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJHZXR0ZXJcIjpcbiAgICAgICAgICBpZiAoZ2V0S2V5c1trZXldKSB7XG4gICAgICAgICAgICB2ID0gdi5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiT2JqZWN0RXhwcmVzc2lvbiBtdXN0IG5vdCBoYXZlIG11bHRpcGxlIGdldHRlcnMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGFLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgZGF0YSBhbmQgZ2V0dGVyIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZ2V0S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIlNldHRlclwiOlxuICAgICAgICAgIGlmIChzZXRLZXlzW2tleV0pIHtcbiAgICAgICAgICAgIHYgPSB2LmFkZEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJPYmplY3RFeHByZXNzaW9uIG11c3Qgbm90IGhhdmUgbXVsdGlwbGUgc2V0dGVycyB3aXRoIHRoZSBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YUtleXNba2V5XSkge1xuICAgICAgICAgICAgdiA9IHYuYWRkRXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIk9iamVjdEV4cHJlc3Npb24gbXVzdCBub3QgaGF2ZSBkYXRhIGFuZCBzZXR0ZXIgcHJvcGVydGllcyB3aXRoIHRoZSBzYW1lIG5hbWVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZXRLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUG9zdGZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlUG9zdGZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCk7XG4gICAgaWYgKChub2RlLm9wZXJhdG9yID09PSBcIisrXCIgfHwgbm9kZS5vcGVyYXRvciA9PT0gXCItLVwiKSAmJiBub2RlLm9wZXJhbmQudHlwZSA9PT0gXCJJZGVudGlmaWVyRXhwcmVzc2lvblwiICYmIGlzUmVzdHJpY3RlZFdvcmQobm9kZS5vcGVyYW5kLmlkZW50aWZpZXIubmFtZSkpIHtcbiAgICAgIHYgPSB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJSZXN0cmljdGVkIHdvcmRzIG11c3Qgbm90IGJlIGluY3JlbWVudGVkL2RlY3JlbWVudGVkIGluIHN0cmljdCBtb2RlXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VQcmVmaXhFeHByZXNzaW9uKG5vZGUsIG9wZXJhbmQpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVByZWZpeEV4cHJlc3Npb24obm9kZSwgb3BlcmFuZCk7XG4gICAgaWYgKG5vZGUub3BlcmF0b3IgPT09IFwiZGVsZXRlXCIgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIikge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcImBkZWxldGVgIHdpdGggdW5xdWFsaWZpZWQgaWRlbnRpZmllciBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gICAgfSBlbHNlIGlmICgobm9kZS5vcGVyYXRvciA9PT0gXCIrK1wiIHx8IG5vZGUub3BlcmF0b3IgPT09IFwiLS1cIikgJiYgbm9kZS5vcGVyYW5kLnR5cGUgPT09IFwiSWRlbnRpZmllckV4cHJlc3Npb25cIiAmJiBpc1Jlc3RyaWN0ZWRXb3JkKG5vZGUub3BlcmFuZC5pZGVudGlmaWVyLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUmVzdHJpY3RlZCB3b3JkcyBtdXN0IG5vdCBiZSBpbmNyZW1lbnRlZC9kZWNyZW1lbnRlZCBpbiBzdHJpY3QgbW9kZVwiKSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG5cbiAgcmVkdWNlUmV0dXJuU3RhdGVtZW50KG5vZGUsIGV4cHJlc3Npb24pIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlUmV0dXJuU3RhdGVtZW50KG5vZGUsIGV4cHJlc3Npb24pXG4gICAgICAuYWRkRnJlZVJldHVyblN0YXRlbWVudChuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiUmV0dXJuIHN0YXRlbWVudCBtdXN0IGJlIGluc2lkZSBvZiBhIGZ1bmN0aW9uXCIpKTtcbiAgfVxuXG4gIHJlZHVjZVNjcmlwdChub2RlLCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVNjcmlwdChub2RlLCBib2R5KVxuICAgICAgLmFkZEVycm9ycyhib2R5LmZyZWVSZXR1cm5TdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIHJlZHVjZVNldHRlcihub2RlLCBuYW1lLCBwYXJhbWV0ZXIsIGJvZHkpIHtcbiAgICBsZXQgdiA9IHN1cGVyLnJlZHVjZVNldHRlcihub2RlLCBuYW1lLCBwYXJhbWV0ZXIsIGJvZHkpO1xuICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKG5vZGUucGFyYW1ldGVyLm5hbWUpKSB7XG4gICAgICB2ID0gdi5hZGRTdHJpY3RFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKG5vZGUsIFwiU2V0dGVyUHJvcGVydHkgcGFyYW1ldGVyIG11c3Qgbm90IGJlIGEgcmVzdHJpY3RlZCBuYW1lXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICByZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcykge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTd2l0Y2hTdGF0ZW1lbnQobm9kZSwgZGlzY3JpbWluYW50LCBjYXNlcylcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKTtcbiAgfVxuXG4gIHJlZHVjZVN3aXRjaFN0YXRlbWVudFdpdGhEZWZhdWx0KG5vZGUsIGRpc2NyaW1pbmFudCwgcHJlRGVmYXVsdENhc2VzLCBkZWZhdWx0Q2FzZSwgcG9zdERlZmF1bHRDYXNlcykge1xuICAgIHJldHVybiBzdXBlci5yZWR1Y2VTd2l0Y2hTdGF0ZW1lbnRXaXRoRGVmYXVsdChub2RlLCBkaXNjcmltaW5hbnQsIHByZURlZmF1bHRDYXNlcywgZGVmYXVsdENhc2UsIHBvc3REZWZhdWx0Q2FzZXMpXG4gICAgICAuY2xlYXJGcmVlQnJlYWtTdGF0ZW1lbnRzKCk7XG4gIH1cblxuICByZWR1Y2VWYXJpYWJsZURlY2xhcmF0b3Iobm9kZSwgYmluZGluZywgaW5pdCkge1xuICAgIGxldCB2ID0gc3VwZXIucmVkdWNlVmFyaWFibGVEZWNsYXJhdG9yKG5vZGUsIGJpbmRpbmcsIGluaXQpO1xuICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKG5vZGUuYmluZGluZy5uYW1lKSkge1xuICAgICAgdiA9IHYuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihub2RlLCBcIlZhcmlhYmxlRGVjbGFyYXRvciBtdXN0IG5vdCBiZSByZXN0cmljdGVkIG5hbWVcIikpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHJlZHVjZVdpdGhTdGF0ZW1lbnQobm9kZSwgb2JqZWN0LCBib2R5KSB7XG4gICAgcmV0dXJuIHN1cGVyLnJlZHVjZVdpdGhTdGF0ZW1lbnQobm9kZSwgb2JqZWN0LCBib2R5KVxuICAgICAgLmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3Iobm9kZSwgXCJXaXRoU3RhdGVtZW50IG5vdCBhbGxvd2VkIGluIHN0cmljdCBtb2RlXCIpKTtcbiAgfVxuXG4gIHJlZHVjZVdoaWxlU3RhdGVtZW50KG5vZGUsIHRlc3QsIGJvZHkpIHtcbiAgICByZXR1cm4gc3VwZXIucmVkdWNlV2hpbGVTdGF0ZW1lbnQobm9kZSwgdGVzdCwgYm9keSlcbiAgICAgIC5jbGVhckZyZWVCcmVha1N0YXRlbWVudHMoKVxuICAgICAgLmNsZWFyRnJlZUNvbnRpbnVlU3RhdGVtZW50cygpO1xuICB9XG59XG4iXX0=