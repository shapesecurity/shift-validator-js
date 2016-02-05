"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
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

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ValidationError = exports.ValidationContext = undefined;

var _validationErrors = require("./validation-errors");

var _validationErrors2 = _interopRequireDefault(_validationErrors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ValidationContext = exports.ValidationContext = function () {
  function ValidationContext() {
    var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var _ref$errors = _ref.errors;
    var errors = _ref$errors === undefined ? [] : _ref$errors;
    var _ref$freeReturnStatem = _ref.freeReturnStatements;
    var freeReturnStatements = _ref$freeReturnStatem === undefined ? [] : _ref$freeReturnStatem;
    var _ref$bindingIdentifie = _ref.bindingIdentifiersCalledDefault;
    var bindingIdentifiersCalledDefault = _ref$bindingIdentifie === undefined ? [] : _ref$bindingIdentifie;
    var _ref$yieldExpressions = _ref.yieldExpressionsNotInGeneratorContext;
    var yieldExpressionsNotInGeneratorContext = _ref$yieldExpressions === undefined ? [] : _ref$yieldExpressions;
    var _ref$yieldGeneratorEx = _ref.yieldGeneratorExpressionsNotInGeneratorContext;
    var yieldGeneratorExpressionsNotInGeneratorContext = _ref$yieldGeneratorEx === undefined ? [] : _ref$yieldGeneratorEx;

    _classCallCheck(this, ValidationContext);

    this.errors = errors;
    this.freeReturnStatements = freeReturnStatements;
    this.bindingIdentifiersCalledDefault = bindingIdentifiersCalledDefault;
    this.yieldExpressionsNotInGeneratorContext = yieldExpressionsNotInGeneratorContext;
    this.yieldGeneratorExpressionsNotInGeneratorContext = yieldGeneratorExpressionsNotInGeneratorContext;
  }

  _createClass(ValidationContext, [{
    key: "concat",
    value: function concat(b) {
      return new ValidationContext({
        errors: this.errors.concat(b.errors),
        freeReturnStatements: this.freeReturnStatements.concat(b.freeReturnStatements),
        bindingIdentifiersCalledDefault: this.bindingIdentifiersCalledDefault.concat(b.bindingIdentifiersCalledDefault),
        yieldExpressionsNotInGeneratorContext: this.yieldExpressionsNotInGeneratorContext.concat(b.yieldExpressionsNotInGeneratorContext),
        yieldGeneratorExpressionsNotInGeneratorContext: this.yieldGeneratorExpressionsNotInGeneratorContext.concat(b.yieldGeneratorExpressionsNotInGeneratorContext)
      });
    }
  }, {
    key: "addError",
    value: function addError(e) {
      var s = new ValidationContext(this);
      s.errors = s.errors.concat([e]);
      return s;
    }
  }, {
    key: "addFreeReturnStatement",
    value: function addFreeReturnStatement(r) {
      var s = new ValidationContext(this);
      s.freeReturnStatements = s.freeReturnStatements.concat([r]);
      return s;
    }
  }, {
    key: "enforceFreeReturnStatements",
    value: function enforceFreeReturnStatements() {
      var errors = [];
      this.freeReturnStatements.forEach(function (r) {
        return errors.push(new ValidationError(r, _validationErrors2.default.RETURN_STATEMENT_IN_FUNCTION_BODY));
      });
      var s = new ValidationContext(this);
      s.errors = s.errors.concat(errors);
      s.freeReturnStatements = [];
      return s;
    }
  }, {
    key: "clearFreeReturnStatements",
    value: function clearFreeReturnStatements() {
      var s = new ValidationContext(this);
      s.freeReturnStatements = [];
      return s;
    }
  }, {
    key: "addBindingIdentifierCalledDefault",
    value: function addBindingIdentifierCalledDefault(b) {
      var s = new ValidationContext(this);
      s.bindingIdentifiersCalledDefault = s.bindingIdentifiersCalledDefault.concat([b]);
      return s;
    }
  }, {
    key: "enforceBindingIdentifiersCalledDefault",
    value: function enforceBindingIdentifiersCalledDefault() {
      var errors = [];
      this.bindingIdentifiersCalledDefault.forEach(function (r) {
        return errors.push(new ValidationError(r, _validationErrors2.default.BINDING_IDENTIFIERS_CALLED_DEFAULT));
      });
      var s = new ValidationContext(this);
      s.errors = s.errors.concat(errors);
      s.bindingIdentifiersCalledDefault = [];
      return s;
    }
  }, {
    key: "clearBindingIdentifiersCalledDefault",
    value: function clearBindingIdentifiersCalledDefault() {
      var s = new ValidationContext(this);
      s.bindingIdentifiersCalledDefault = [];
      return s;
    }
  }, {
    key: "addYieldExpressionNotInGeneratorContext",
    value: function addYieldExpressionNotInGeneratorContext(e) {
      var s = new ValidationContext(this);
      s.yieldExpressionsNotInGeneratorContext = s.yieldExpressionsNotInGeneratorContext.concat([e]);
      return s;
    }
  }, {
    key: "enforceYieldExpressionsNotInGeneratorContext",
    value: function enforceYieldExpressionsNotInGeneratorContext() {
      var errors = [];
      this.yieldExpressionsNotInGeneratorContext.forEach(function (r) {
        return errors.push(new ValidationError(r, _validationErrors2.default.VALID_YIELD_EXPRESSION_POSITION));
      });
      var s = new ValidationContext(this);
      s.errors = s.errors.concat(errors);
      s.yieldExpressionsNotInGeneratorContext = [];
      return s;
    }
  }, {
    key: "clearYieldExpressionsNotInGeneratorContext",
    value: function clearYieldExpressionsNotInGeneratorContext() {
      var s = new ValidationContext(this);
      s.yieldExpressionsNotInGeneratorContext = [];
      return s;
    }
  }, {
    key: "addYieldGeneratorExpressionNotInGeneratorContext",
    value: function addYieldGeneratorExpressionNotInGeneratorContext(e) {
      var s = new ValidationContext(this);
      s.yieldGeneratorExpressionsNotInGeneratorContext = s.yieldGeneratorExpressionsNotInGeneratorContext.concat([e]);
      return s;
    }
  }, {
    key: "enforceYieldGeneratorExpressionsNotInGeneratorContext",
    value: function enforceYieldGeneratorExpressionsNotInGeneratorContext() {
      var errors = [];
      this.yieldGeneratorExpressionsNotInGeneratorContext.forEach(function (r) {
        return errors.push(new ValidationError(r, _validationErrors2.default.VALID_YIELD_GENERATOR_EXPRESSION_POSITION));
      });
      var s = new ValidationContext(this);
      s.errors = s.errors.concat(errors);
      s.yieldGeneratorExpressionsNotInGeneratorContext = [];
      return s;
    }
  }, {
    key: "clearYieldGeneratorExpressionsNotInGeneratorContext",
    value: function clearYieldGeneratorExpressionsNotInGeneratorContext() {
      var s = new ValidationContext(this);
      s.yieldGeneratorExpressionsNotInGeneratorContext = [];
      return s;
    }
  }], [{
    key: "empty",
    value: function empty() {
      return new ValidationContext();
    }
  }]);

  return ValidationContext;
}();

var ValidationError = exports.ValidationError = function (_Error) {
  _inherits(ValidationError, _Error);

  function ValidationError(node, message) {
    _classCallCheck(this, ValidationError);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ValidationError).call(this));

    _this.node = node;
    _this.message = message;
    return _this;
  }

  return ValidationError;
}(Error);