"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Validator = undefined;
exports.default = isValid;

var _shiftParser = require("shift-parser");

var _shiftReducer = require("shift-reducer");

var _shiftReducer2 = _interopRequireDefault(_shiftReducer);

var _esutils = require("esutils");

var _validationContext = require("./validation-context");

var _validationErrors = require("./validation-errors");

var _validationErrors2 = _interopRequireDefault(_validationErrors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
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

var isIdentifierNameES6 = _esutils.keyword.isIdentifierNameES6;
var isReservedWordES6 = _esutils.keyword.isReservedWordES6;
var isIdentifierStart = _esutils.code.isIdentifierStartES6;
var isIdentifierPart = _esutils.code.isIdentifierPartES6;
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
  var current = node.consequent;
  do {
    if (current.type === "IfStatement" && current.alternate == null) {
      return true;
    }
    current = trailingStatement(current);
  } while (current != null);
  return false;
}

function isValidIdentifierName(name) {
  return name === 'let' || name == 'yield' || isIdentifierNameES6(name) && !isReservedWordES6(name);
  //return name.length > 0 && isIdentifierStart(name.charCodeAt(0)) && Array.prototype.every.call(name, c => isIdentifierPart(c.charCodeAt(0)));
  if (name.length === 0) {
    return false;
  }
  try {
    var res = new _shiftParser.Tokenizer(name).scanIdentifier();
    return (res.type === _shiftParser.TokenType.IDENTIFIER || res.type === _shiftParser.TokenType.LET || res.type === _shiftParser.TokenType.YIELD) && res.value === name;
  } catch (e) {
    return false;
  }
}

function isValidStaticPropertyName(name) {
  return isIdentifierNameES6(name);
}

function isValidRegex(pattern, flags) {
  return true; // TODO fix this when pattern-acceptor is fixed
}

function isMemberExpression(binding) {
  return binding.type == 'ComputedMemberExpression' || binding.type == 'StaticMemberExpression';
}

function isTemplateElement(rawValue) {
  try {
    var tokenizer = new _shiftParser.Tokenizer('`' + rawValue + '`');
    tokenizer.lookahead = tokenizer.advance();
    var token = tokenizer.lex();
    if (token.type !== _shiftParser.TokenType.TEMPLATE) {
      return false;
    }
    return tokenizer.eof();
  } catch (e) {
    return false;
  }
}

function isDirective(rawValue) {
  var stringify = function stringify(c) {
    try {
      var tokenizer = new _shiftParser.Tokenizer(c + rawValue + c);
      tokenizer.lookahead = tokenizer.advance();
      var token = tokenizer.lex();
      if (token.type !== _shiftParser.TokenType.STRING) {
        return false;
      }
      return tokenizer.eof();
    } catch (e) {
      return false;
    }
  };
  return stringify('"') || stringify("'");
}

var Validator = exports.Validator = function (_MonoidalReducer) {
  _inherits(Validator, _MonoidalReducer);

  function Validator() {
    _classCallCheck(this, Validator);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Validator).call(this, _validationContext.ValidationContext));
  }

  _createClass(Validator, [{
    key: "reduceBindingIdentifier",
    value: function reduceBindingIdentifier(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceBindingIdentifier", this).call(this, node);
      if (!isValidIdentifierName(node.name)) {
        if (node.name == "*default*") {
          s = s.addBindingIdentifierCalledDefault(node);
        } else {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_BINDING_IDENTIFIER_NAME));
        }
      }
      return s;
    }
  }, {
    key: "reduceBreakStatement",
    value: function reduceBreakStatement(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceBreakStatement", this).call(this, node);
      if (node.label !== null && !isValidIdentifierName(node.label)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_BREAK_STATEMENT_LABEL));
      }
      return s;
    }
  }, {
    key: "reduceCatchClause",
    value: function reduceCatchClause(node, _ref) {
      var binding = _ref.binding;
      var body = _ref.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceCatchClause", this).call(this, node, { binding: binding, body: body });
      if (isMemberExpression(node.binding)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.CATCH_CLAUSE_BINDING_NOT_MEMBER_EXPRESSION));
      }
      return s;
    }
  }, {
    key: "reduceContinueStatement",
    value: function reduceContinueStatement(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceContinueStatement", this).call(this, node);
      if (node.label !== null && !isValidIdentifierName(node.label)) {
        s = s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_CONTINUE_STATEMENT_LABEL));
      }
      return s;
    }
  }, {
    key: "reduceDirective",
    value: function reduceDirective(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceDirective", this).call(this, node);
      if (!isDirective(node.rawValue)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_DIRECTIVE));
      }
      return s;
    }
  }, {
    key: "reduceExportDefault",
    value: function reduceExportDefault(node, _ref2) {
      var body = _ref2.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceExportDefault", this).call(this, node, { body: body });
      if (node.body.type === 'FunctionDeclaration' || node.body.type == 'ClassDeclaration') {
        s = s.clearBindingIdentifiersCalledDefault();
      }
      return s;
    }
  }, {
    key: "reduceExportSpecifier",
    value: function reduceExportSpecifier(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceExportSpecifier", this).call(this, node);
      if (node.name !== null && !isValidIdentifierName(node.name)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_EXPORT_SPECIFIER_NAME));
      }
      if (!isIdentifierNameES6(node.exportedName)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_EXPORTED_NAME));
      }
      return s;
    }
  }, {
    key: "reduceForInStatement",
    value: function reduceForInStatement(node, _ref3) {
      var left = _ref3.left;
      var right = _ref3.right;
      var body = _ref3.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceForInStatement", this).call(this, node, { left: left, right: right, body: body });
      if (node.left.type === 'VariableDeclaration') {
        if (node.left.declarators.length != 1) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.ONE_VARIABLE_DECLARATOR_IN_FOR_IN));
        }
        if (node.left.declarators.length > 0 && node.left.declarators[0].init !== null) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.NO_INIT_IN_VARIABLE_DECLARATOR_IN_FOR_IN));
        }
      }
      return s;
    }
  }, {
    key: "reduceForOfStatement",
    value: function reduceForOfStatement(node, _ref4) {
      var left = _ref4.left;
      var right = _ref4.right;
      var body = _ref4.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceForOfStatement", this).call(this, node, { left: left, right: right, body: body });
      if (node.left.type === 'VariableDeclaration') {
        if (node.left.declarators.length != 1) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.ONE_VARIABLE_DECLARATOR_IN_FOR_OF));
        }
        if (node.left.declarators.length > 0 && node.left.declarators[0].init !== null) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.NO_INIT_IN_VARIABLE_DECLARATOR_IN_FOR_OF));
        }
      }
      return s;
    }
  }, {
    key: "reduceFormalParameters",
    value: function reduceFormalParameters(node, _ref5) {
      var items = _ref5.items;
      var rest = _ref5.rest;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceFormalParameters", this).call(this, node, { items: items, rest: rest });
      node.items.forEach(function (x) {
        if (isMemberExpression(x)) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.FORMAL_PARAMETER_ITEMS_NOT_MEMBER_EXPRESSION));
        } else if (x.type === 'BindingWithDefault') {
          if (isMemberExpression(x.binding)) {
            s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.FORMAL_PARAMETER_ITEMS_BINDING_NOT_MEMBER_EXPRESSION));
          }
        }
      });
      return s;
    }
  }, {
    key: "reduceFunctionBody",
    value: function reduceFunctionBody(node, _ref6) {
      var directives = _ref6.directives;
      var statements = _ref6.statements;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceFunctionBody", this).call(this, node, { directives: directives, statements: statements });
      s = s.clearFreeReturnStatements();
      return s;
    }
  }, {
    key: "reduceFunctionDeclaration",
    value: function reduceFunctionDeclaration(node, _ref7) {
      var name = _ref7.name;
      var params = _ref7.params;
      var body = _ref7.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceFunctionDeclaration", this).call(this, node, { name: name, params: params, body: body });
      if (node.isGenerator) {
        s = s.clearYieldExpressionsNotInGeneratorContext();
        s = s.clearYieldGeneratorExpressionsNotInGeneratorContext();
      }
      return s;
    }
  }, {
    key: "reduceFunctionExpression",
    value: function reduceFunctionExpression(node, _ref8) {
      var name = _ref8.name;
      var params = _ref8.params;
      var body = _ref8.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceFunctionExpression", this).call(this, node, { name: name, params: params, body: body });
      if (node.isGenerator) {
        s = s.clearYieldExpressionsNotInGeneratorContext();
        s = s.clearYieldGeneratorExpressionsNotInGeneratorContext();
      }
      return s;
    }
  }, {
    key: "reduceIdentifierExpression",
    value: function reduceIdentifierExpression(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceIdentifierExpression", this).call(this, node);
      if (!isValidIdentifierName(node.name)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_IDENTIFIER_NAME));
      }
      return s;
    }
  }, {
    key: "reduceIfStatement",
    value: function reduceIfStatement(node, _ref9) {
      var test = _ref9.test;
      var consequent = _ref9.consequent;
      var alternate = _ref9.alternate;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceIfStatement", this).call(this, node, { test: test, consequent: consequent, alternate: alternate });
      if (isProblematicIfStatement(node)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_IF_STATEMENT));
      }
      return s;
    }
  }, {
    key: "reduceImportSpecifier",
    value: function reduceImportSpecifier(node, _ref10) {
      var binding = _ref10.binding;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceImportSpecifier", this).call(this, node, { binding: binding });
      if (node.name !== null && !isIdentifierNameES6(node.name)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_IMPORT_SPECIFIER_NAME));
      }
      return s;
    }
  }, {
    key: "reduceLabeledStatement",
    value: function reduceLabeledStatement(node, _ref11) {
      var body = _ref11.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceLabeledStatement", this).call(this, node, { body: body });
      if (!isValidIdentifierName(node.label)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_LABEL));
      }
      return s;
    }
  }, {
    key: "reduceLiteralNumericExpression",
    value: function reduceLiteralNumericExpression(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceLiteralNumericExpression", this).call(this, node);
      if (isNaN(node.value)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.LITERAL_NUMERIC_VALUE_NOT_NAN));
      }
      if (node.value < 0 || node.value == 0 && 1 / node.value < 0) {
        // second case is for -0
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.LITERAL_NUMERIC_VALUE_NOT_NEGATIVE));
      }
      if (!isNaN(node.value) && !isFinite(node.value)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.LITERAL_NUMERIC_VALUE_NOT_INFINITE));
      }
      return s;
    }
  }, {
    key: "reduceLiteralRegExpExpression",
    value: function reduceLiteralRegExpExpression(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceLiteralRegExpExpression", this).call(this, node);
      if (!isValidRegex(node.pattern, node.flags)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_REG_EX_PATTERN));
      }
      return s;
    }
  }, {
    key: "reduceMethod",
    value: function reduceMethod(node, _ref12) {
      var params = _ref12.params;
      var body = _ref12.body;
      var name = _ref12.name;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceMethod", this).call(this, node, { params: params, body: body, name: name });
      if (node.isGenerator) {
        s = s.clearYieldExpressionsNotInGeneratorContext();
        s = s.clearYieldGeneratorExpressionsNotInGeneratorContext();
      }
      return s;
    }
  }, {
    key: "reduceModule",
    value: function reduceModule(node, _ref13) {
      var directives = _ref13.directives;
      var items = _ref13.items;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceModule", this).call(this, node, { directives: directives, items: items });
      s = s.enforceFreeReturnStatements();
      s = s.enforceBindingIdentifiersCalledDefault();
      s = s.enforceYieldExpressionsNotInGeneratorContext();
      s = s.enforceYieldGeneratorExpressionsNotInGeneratorContext();
      // s.errors.forEach(console.log.bind(console))
      return s;
    }
  }, {
    key: "reduceReturnStatement",
    value: function reduceReturnStatement(node, _ref14) {
      var expression = _ref14.expression;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceReturnStatement", this).call(this, node, { expression: expression });
      s = s.addFreeReturnStatement(node);
      return s;
    }
  }, {
    key: "reduceScript",
    value: function reduceScript(node, _ref15) {
      var directives = _ref15.directives;
      var statements = _ref15.statements;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceScript", this).call(this, node, { directives: directives, statements: statements });
      s = s.enforceFreeReturnStatements();
      s = s.enforceBindingIdentifiersCalledDefault();
      s = s.enforceYieldExpressionsNotInGeneratorContext();
      s = s.enforceYieldGeneratorExpressionsNotInGeneratorContext();
      // s.errors.forEach(console.log.bind(console))
      return s;
    }
  }, {
    key: "reduceSetter",
    value: function reduceSetter(node, _ref16) {
      var name = _ref16.name;
      var param = _ref16.param;
      var body = _ref16.body;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceSetter", this).call(this, node, { name: name, param: param, body: body });
      if (isMemberExpression(node.param)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.SETTER_PARAM_NOT_MEMBER_EXPRESSION));
      } else if (node.param.type === 'BindingWithDefault') {
        if (isMemberExpression(node.param).binding) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.SETTER_PARAM_BINDING_NOT_MEMBER_EXPRESSION));
        }
      }
      return s;
    }
  }, {
    key: "reduceShorthandProperty",
    value: function reduceShorthandProperty(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceShorthandProperty", this).call(this, node);
      if (!isValidIdentifierName(node.name)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_SHORTHAND_PROPERTY_NAME));
      }
      return s;
    }
  }, {
    key: "reduceStaticMemberExpression",
    value: function reduceStaticMemberExpression(node, _ref17) {
      var object = _ref17.object;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceStaticMemberExpression", this).call(this, node, { object: object });
      if (!isIdentifierNameES6(node.property)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_STATIC_MEMBER_EXPRESSION_PROPERTY_NAME));
      }
      return s;
    }
  }, {
    key: "reduceTemplateElement",
    value: function reduceTemplateElement(node) {
      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceTemplateElement", this).call(this, node);
      if (!isTemplateElement(node.rawValue)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VALID_TEMPLATE_ELEMENT_VALUE));
      }
      return s;
    }
  }, {
    key: "reduceTemplateExpression",
    value: function reduceTemplateExpression(node, _ref18) {
      var tag = _ref18.tag;
      var elements = _ref18.elements;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceTemplateExpression", this).call(this, node, { tag: tag, elements: elements });
      if (node.elements.length > 0) {
        if (node.elements.length % 2 == 0) {
          s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.ALTERNATING_TEMPLATE_EXPRESSION_ELEMENTS));
        } else {
          node.elements.forEach(function (x, i) {
            if (i % 2 == 0) {
              if (!(x.type === 'TemplateElement')) {
                s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.ALTERNATING_TEMPLATE_EXPRESSION_ELEMENTS));
              }
            } else {
              if (x.type === 'TemplateElement') {
                s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.ALTERNATING_TEMPLATE_EXPRESSION_ELEMENTS));
              }
            }
          });
        }
      }
      return s;
    }
  }, {
    key: "reduceVariableDeclaration",
    value: function reduceVariableDeclaration(node, _ref19) {
      var declarators = _ref19.declarators;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceVariableDeclaration", this).call(this, node, { declarators: declarators });
      if (node.declarators.length == 0) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.NOT_EMPTY_VARIABLE_DECLARATORS_LIST));
      }
      return s;
    }
  }, {
    key: "reduceVariableDeclarationStatement",
    value: function reduceVariableDeclarationStatement(node, _ref20) {
      var declaration = _ref20.declaration;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceVariableDeclarationStatement", this).call(this, node, { declaration: declaration });
      if (node.declaration.kind === 'const') {
        node.declaration.declarators.forEach(function (x) {
          if (x.init === null) {
            s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.CONST_VARIABLE_DECLARATION_MUST_HAVE_INIT));
          }
        });
      }
      return s;
    }
  }, {
    key: "reduceVariableDeclarator",
    value: function reduceVariableDeclarator(node, _ref21) {
      var binding = _ref21.binding;
      var init = _ref21.init;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceVariableDeclarator", this).call(this, node, { binding: binding, init: init });
      if (isMemberExpression(node.binding)) {
        s = s.addError(new _validationContext.ValidationError(node, _validationErrors2.default.VARIABLE_DECLARATION_BINDING_NOT_MEMBER_EXPRESSION));
      }
      return s;
    }
  }, {
    key: "reduceYieldExpression",
    value: function reduceYieldExpression(node, _ref22) {
      var expression = _ref22.expression;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceYieldExpression", this).call(this, node, { expression: expression });
      s = s.addYieldExpressionNotInGeneratorContext(node);
      return s;
    }
  }, {
    key: "reduceYieldGeneratorExpression",
    value: function reduceYieldGeneratorExpression(node, _ref23) {
      var expression = _ref23.expression;

      var s = _get(Object.getPrototypeOf(Validator.prototype), "reduceYieldGeneratorExpression", this).call(this, node, { expression: expression });
      s = s.addYieldGeneratorExpressionNotInGeneratorContext(node);
      return s;
    }
  }], [{
    key: "validate",
    value: function validate(node) {
      return (0, _shiftReducer2.default)(new Validator(), node).errors;
    }
  }]);

  return Validator;
}(_shiftReducer.MonoidalReducer);