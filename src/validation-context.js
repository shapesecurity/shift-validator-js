/**
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

const ValidationErrorMessages = require("./validation-errors");

class ValidationContext {
  constructor({
    errors = [],
    freeReturnStatements = [],
    bindingIdentifiersCalledDefault = [],
    yieldExpressionsNotInGeneratorContext = [],
    awaitExpressionsNotInAsyncContext = [],
    yieldGeneratorExpressionsNotInGeneratorContext = []
  } = {}) {
    this.errors = errors;
    this.freeReturnStatements = freeReturnStatements;
    this.bindingIdentifiersCalledDefault = bindingIdentifiersCalledDefault;
    this.yieldExpressionsNotInGeneratorContext = yieldExpressionsNotInGeneratorContext;
    this.awaitExpressionsNotInAsyncContext = awaitExpressionsNotInAsyncContext;
    this.yieldGeneratorExpressionsNotInGeneratorContext = yieldGeneratorExpressionsNotInGeneratorContext;
  }

  static empty() {
    return new ValidationContext;
  }

  concat(b) {
    return new ValidationContext({
      errors: this.errors.concat(b.errors),
      freeReturnStatements: this.freeReturnStatements.concat(b.freeReturnStatements),
      bindingIdentifiersCalledDefault: this.bindingIdentifiersCalledDefault.concat(b.bindingIdentifiersCalledDefault),
      yieldExpressionsNotInGeneratorContext: this.yieldExpressionsNotInGeneratorContext.concat(b.yieldExpressionsNotInGeneratorContext),
      awaitExpressionsNotInAsyncContext: this.awaitExpressionsNotInAsyncContext.concat(b.awaitExpressionsNotInAsyncContext),
      yieldGeneratorExpressionsNotInGeneratorContext: this.yieldGeneratorExpressionsNotInGeneratorContext.concat(b.yieldGeneratorExpressionsNotInGeneratorContext)
    });
  }

  addError(e) {
    let s = new ValidationContext(this);
    s.errors = s.errors.concat([e]);
    return s;
  }

  addFreeReturnStatement(r) {
    let s = new ValidationContext(this);
    s.freeReturnStatements = s.freeReturnStatements.concat([r]);
    return s;
  }

  enforceFreeReturnStatements() {
    let errors = [];
    this.freeReturnStatements.forEach(r => errors.push(new ValidationError(r, ValidationErrorMessages.RETURN_STATEMENT_IN_FUNCTION_BODY)));
    let s = new ValidationContext(this);
    s.errors = s.errors.concat(errors);
    s.freeReturnStatements = [];
    return s;
  }

  clearFreeReturnStatements() {
    let s = new ValidationContext(this);
    s.freeReturnStatements = [];
    return s;
  }

  addBindingIdentifierCalledDefault(b) {
    let s = new ValidationContext(this);
    s.bindingIdentifiersCalledDefault = s.bindingIdentifiersCalledDefault.concat([b]);
    return s;
  }

  enforceBindingIdentifiersCalledDefault() {
    let errors = [];
    this.bindingIdentifiersCalledDefault.forEach(r => errors.push(new ValidationError(r, ValidationErrorMessages.BINDING_IDENTIFIERS_CALLED_DEFAULT)));
    let s = new ValidationContext(this);
    s.errors = s.errors.concat(errors);
    s.bindingIdentifiersCalledDefault = [];
    return s;
  }

  clearBindingIdentifiersCalledDefault() {
    let s = new ValidationContext(this);
    s.bindingIdentifiersCalledDefault = [];
    return s;
  }

  addYieldExpressionNotInGeneratorContext(e) {
    let s = new ValidationContext(this);
    s.yieldExpressionsNotInGeneratorContext = s.yieldExpressionsNotInGeneratorContext.concat([e]);
    return s;
  }

  addAwaitExpressionNotInAsyncContext(e) {
    let s = new ValidationContext(this);
    s.awaitExpressionsNotInAsyncContext = s.awaitExpressionsNotInAsyncContext.concat([e]);
    return s;
  }

  enforceYieldExpressionsNotInGeneratorContext() {
    let errors = [];
    this.yieldExpressionsNotInGeneratorContext.forEach(r => errors.push(new ValidationError(r, ValidationErrorMessages.VALID_YIELD_EXPRESSION_POSITION)));
    let s = new ValidationContext(this);
    s.errors = s.errors.concat(errors);
    s.yieldExpressionsNotInGeneratorContext = [];
    return s;
  }

  enforceAwaitExpressionsNotInAsyncContext() {
    let errors = [];
    this.awaitExpressionsNotInAsyncContext.forEach(r => errors.push(new ValidationError(r, ValidationErrorMessages.VALID_AWAIT_EXPRESSION_POSITION)));
    let s = new ValidationContext(this);
    s.errors = s.errors.concat(errors);
    s.awaitExpressionsNotInAsyncContext = [];
    return s;
  }

  clearYieldExpressionsNotInGeneratorContext() {
    let s = new ValidationContext(this);
    s.yieldExpressionsNotInGeneratorContext = [];
    return s;
  }

  clearAwaitExpressionsNotInAsyncContext() {
    let s = new ValidationContext(this);
    s.awaitExpressionsNotInAsyncContext = [];
    return s;
  }

  addYieldGeneratorExpressionNotInGeneratorContext(e) {
    let s = new ValidationContext(this);
    s.yieldGeneratorExpressionsNotInGeneratorContext = s.yieldGeneratorExpressionsNotInGeneratorContext.concat([e]);
    return s;
  }

  enforceYieldGeneratorExpressionsNotInGeneratorContext() {
    let errors = [];
    this.yieldGeneratorExpressionsNotInGeneratorContext.forEach(r => errors.push(new ValidationError(r, ValidationErrorMessages.VALID_YIELD_GENERATOR_EXPRESSION_POSITION)));
    let s = new ValidationContext(this);
    s.errors = s.errors.concat(errors);
    s.yieldGeneratorExpressionsNotInGeneratorContext = [];
    return s;
  }

  clearYieldGeneratorExpressionsNotInGeneratorContext() {
    let s = new ValidationContext(this);
    s.yieldGeneratorExpressionsNotInGeneratorContext = [];
    return s;
  }

  enforceYields() {
    return this.enforceYieldExpressionsNotInGeneratorContext().enforceYieldGeneratorExpressionsNotInGeneratorContext();
  }

  clearYields() {
    return this.clearYieldExpressionsNotInGeneratorContext().clearYieldGeneratorExpressionsNotInGeneratorContext();
  }
}

class ValidationError extends Error {
  constructor(node, message) {
    super();
    this.node = node;
    this.message = message;
  }
}

module.exports = {
  ValidationContext,
  ValidationError,
};
