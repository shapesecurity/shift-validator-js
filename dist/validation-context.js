"use strict";

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

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

var objectAssign = require("object-assign");

var keyword = require("esutils").keyword;
var isRestrictedWord = keyword.isRestrictedWord;
var isReservedWordES5 = keyword.isReservedWordES5;


var proto = {
  __proto__: null,
  freeBreakStatements: [],
  freeContinueStatements: [],
  usedLabelNames: [],
  freeJumpTargets: [],
  freeReturnStatements: [],
  uninitialisedDeclarators: [],
  errors: [],
  strictErrors: [] };

var identity = undefined; // initialised below ValidationContext

var ValidationContext = exports.ValidationContext = (function () {
  function ValidationContext() {
    _classCallCheck(this, ValidationContext);
  }

  _prototypeProperties(ValidationContext, {
    empty: {

      // MONOID IMPLEMENTATION

      value: function empty() {
        return identity;
      },
      writable: true,
      configurable: true
    }
  }, {
    clone: {
      value: function clone() {
        var additionalProperties = arguments[0] === undefined ? {} : arguments[0];
        return objectAssign(objectAssign(new ValidationContext(), this), additionalProperties);
      },
      writable: true,
      configurable: true
    },
    addFreeBreakStatement: {
      value: function addFreeBreakStatement(s) {
        return this.clone({
          freeBreakStatements: this.freeBreakStatements.concat([s]) });
      },
      writable: true,
      configurable: true
    },
    clearFreeBreakStatements: {
      value: function clearFreeBreakStatements() {
        return this.clone({
          freeBreakStatements: [] });
      },
      writable: true,
      configurable: true
    },
    addFreeContinueStatement: {
      value: function addFreeContinueStatement(s) {
        return this.clone({
          freeContinueStatements: this.freeContinueStatements.concat([s]) });
      },
      writable: true,
      configurable: true
    },
    clearFreeContinueStatements: {
      value: function clearFreeContinueStatements() {
        return this.clone({
          freeContinueStatements: [] });
      },
      writable: true,
      configurable: true
    },
    enforceFreeBreakAndContinueStatementErrors: {
      value: function enforceFreeBreakAndContinueStatementErrors() {
        return this.clone({
          freeBreakStatements: [],
          freeContinueStatements: [],
          errors: this.errors.concat(this.freeBreakStatements).concat(this.freeContinueStatements) });
      },
      writable: true,
      configurable: true
    },
    observeIterationLabelName: {
      value: function observeIterationLabelName(label) {
        return this.clone({
          usedLabelNames: this.usedLabelNames.concat([label.name]),
          freeJumpTargets: this.freeJumpTargets.filter(function (info) {
            return info.name !== label.name;
          }) });
      },
      writable: true,
      configurable: true
    },
    observeNonIterationLabelName: {
      value: function observeNonIterationLabelName(label) {
        return this.clone({
          usedLabelNames: this.usedLabelNames.concat([label.name]),
          freeJumpTargets: this.freeJumpTargets.filter(function (info) {
            return info.name !== label.name || info.type !== "break";
          }) });
      },
      writable: true,
      configurable: true
    },
    clearUsedLabelNames: {
      value: function clearUsedLabelNames() {
        return this.clone({
          usedLabelNames: [] });
      },
      writable: true,
      configurable: true
    },
    addFreeBreakJumpTarget: {
      value: function addFreeBreakJumpTarget(label) {
        return this.clone({
          freeJumpTargets: this.freeJumpTargets.concat([{ name: label.name, type: "break" }]) });
      },
      writable: true,
      configurable: true
    },
    addFreeContinueJumpTarget: {
      value: function addFreeContinueJumpTarget(label) {
        return this.clone({
          freeJumpTargets: this.freeJumpTargets.concat([{ name: label.name, type: "continue" }]) });
      },
      writable: true,
      configurable: true
    },
    addFreeReturnStatement: {
      value: function addFreeReturnStatement(r) {
        return this.clone({
          freeReturnStatements: this.freeReturnStatements.concat([r]) });
      },
      writable: true,
      configurable: true
    },
    clearFreeReturnStatements: {
      value: function clearFreeReturnStatements() {
        return this.clone({
          freeReturnStatements: [] });
      },
      writable: true,
      configurable: true
    },
    enforceFreeReturnStatementErrors: {
      value: function enforceFreeReturnStatementErrors() {
        return this.clone({
          freeReturnStatements: [],
          errors: this.errors.concat(this.freeReturnStatements) });
      },
      writable: true,
      configurable: true
    },
    addUninitialisedDeclarator: {
      value: function addUninitialisedDeclarator(node) {
        return this.clone({
          uninitialisedDeclarators: this.uninitialisedDeclarators.concat(node) });
      },
      writable: true,
      configurable: true
    },
    enforceUninitialisedDeclarators: {
      value: function enforceUninitialisedDeclarators() {
        return this.clone({
          uninitialisedDeclarators: [],
          errors: this.errors.concat(this.uninitialisedDeclarators) });
      },
      writable: true,
      configurable: true
    },
    addError: {
      value: function addError(e) {
        return this.clone({
          errors: this.errors.concat([e]) });
      },
      writable: true,
      configurable: true
    },
    addStrictError: {
      value: function addStrictError(e) {
        return this.clone({
          strictErrors: this.strictErrors.concat([e]) });
      },
      writable: true,
      configurable: true
    },
    enforceStrictErrors: {
      value: function enforceStrictErrors() {
        return this.clone({
          errors: this.errors.concat(this.strictErrors),
          strictErrors: [] });
      },
      writable: true,
      configurable: true
    },
    concat: {
      value: function concat(v) {
        if (this === identity) {
          return v;
        }if (v === identity) {
          return this;
        }return this.clone({
          freeBreakStatements: this.freeBreakStatements.concat(v.freeBreakStatements),
          freeContinueStatements: this.freeContinueStatements.concat(v.freeContinueStatements),
          usedLabelNames: this.usedLabelNames.concat(v.usedLabelNames),
          freeJumpTargets: this.freeJumpTargets.concat(v.freeJumpTargets),
          freeReturnStatements: this.freeReturnStatements.concat(v.freeReturnStatements),
          uninitialisedDeclarators: this.uninitialisedDeclarators.concat(v.uninitialisedDeclarators),
          errors: this.errors.concat(v.errors),
          strictErrors: this.strictErrors.concat(v.strictErrors)
        });
      },
      writable: true,
      configurable: true
    },
    checkReserved: {

      // HELPERS

      value: function checkReserved(identifier) {
        if (isReservedWordES5(identifier.name, true)) {
          if (isReservedWordES5(identifier.name, false)) {
            return this.addError(new ValidationError(identifier, "Identifier must not be reserved word in this position"));
          }
          return this.addStrictError(new ValidationError(identifier, "Identifier must not be strict mode reserved word in this position"));
        }
        return this;
      },
      writable: true,
      configurable: true
    },
    checkRestricted: {
      value: function checkRestricted(identifier) {
        var v = this.checkReserved(identifier);
        if (isRestrictedWord(identifier.name)) {
          return v.addStrictError(new ValidationError(identifier, "Identifier must not be restricted word in this position in strict mode"));
        }
        return v;
      },
      writable: true,
      configurable: true
    }
  });

  return ValidationContext;
})();


identity = new ValidationContext();
objectAssign(identity, proto);

var ValidationError = exports.ValidationError = (function (Error) {
  function ValidationError(node, message) {
    _classCallCheck(this, ValidationError);

    this.node = node;
    this.message = message;
  }

  _inherits(ValidationError, Error);

  return ValidationError;
})(Error);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy92YWxpZGF0aW9uLWNvbnRleHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBZ0JZLFlBQVksV0FBTSxlQUFlOztJQUNyQyxPQUFPLFdBQU8sU0FBUyxFQUF2QixPQUFPO0lBQ1IsZ0JBQWdCLEdBQXVCLE9BQU8sQ0FBOUMsZ0JBQWdCO0lBQUUsaUJBQWlCLEdBQUksT0FBTyxDQUE1QixpQkFBaUI7OztBQUUxQyxJQUFNLEtBQUssR0FBRztBQUNaLFdBQVMsRUFBRSxJQUFJO0FBQ2YscUJBQW1CLEVBQUUsRUFBRTtBQUN2Qix3QkFBc0IsRUFBRSxFQUFFO0FBQzFCLGdCQUFjLEVBQUUsRUFBRTtBQUNsQixpQkFBZSxFQUFFLEVBQUU7QUFDbkIsc0JBQW9CLEVBQUUsRUFBRTtBQUN4QiwwQkFBd0IsRUFBRSxFQUFFO0FBQzVCLFFBQU0sRUFBRSxFQUFFO0FBQ1YsY0FBWSxFQUFFLEVBQUUsRUFDakIsQ0FBQzs7QUFFRixJQUFJLFFBQVEsWUFBQSxDQUFDOztJQUVBLGlCQUFpQixXQUFqQixpQkFBaUI7QUFFakIsV0FGQSxpQkFBaUI7MEJBQWpCLGlCQUFpQjtHQUVYOzt1QkFGTixpQkFBaUI7QUFrSXJCLFNBQUs7Ozs7YUFBQSxpQkFBRztBQUNiLGVBQU8sUUFBUSxDQUFDO09BQ2pCOzs7OztBQWhJRCxTQUFLO2FBQUEsaUJBQTRCO1lBQTNCLG9CQUFvQixnQ0FBRyxFQUFFO0FBQzdCLGVBQU8sWUFBWSxDQUFDLFlBQVksQ0FBQyxJQUFJLGlCQUFpQixFQUFBLEVBQUUsSUFBSSxDQUFDLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztPQUN0Rjs7OztBQUdELHlCQUFxQjthQUFBLCtCQUFDLENBQUMsRUFBRTtBQUN2QixlQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDaEIsNkJBQW1CLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQzFELENB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QUFDO0dBQ3hCOztZQUpVLGVBQWUsRUFBUyxLQUFLOztTQUE3QixlQUFlO0dBQVMsS0FBSyIsImZpbGUiOiJzcmMvdmFsaWRhdGlvbi1jb250ZXh0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBTaGFwZSBTZWN1cml0eSwgSW5jLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIilcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCAqIGFzIG9iamVjdEFzc2lnbiBmcm9tIFwib2JqZWN0LWFzc2lnblwiO1xuaW1wb3J0IHtrZXl3b3JkfSBmcm9tIFwiZXN1dGlsc1wiO1xuY29uc3Qge2lzUmVzdHJpY3RlZFdvcmQsIGlzUmVzZXJ2ZWRXb3JkRVM1fSA9IGtleXdvcmQ7XG5cbmNvbnN0IHByb3RvID0ge1xuICBfX3Byb3RvX186IG51bGwsXG4gIGZyZWVCcmVha1N0YXRlbWVudHM6IFtdLFxuICBmcmVlQ29udGludWVTdGF0ZW1lbnRzOiBbXSxcbiAgdXNlZExhYmVsTmFtZXM6IFtdLFxuICBmcmVlSnVtcFRhcmdldHM6IFtdLFxuICBmcmVlUmV0dXJuU3RhdGVtZW50czogW10sXG4gIHVuaW5pdGlhbGlzZWREZWNsYXJhdG9yczogW10sXG4gIGVycm9yczogW10sXG4gIHN0cmljdEVycm9yczogW10sXG59O1xuXG5sZXQgaWRlbnRpdHk7IC8vIGluaXRpYWxpc2VkIGJlbG93IFZhbGlkYXRpb25Db250ZXh0XG5cbmV4cG9ydCBjbGFzcyBWYWxpZGF0aW9uQ29udGV4dCB7XG5cbiAgY29uc3RydWN0b3IoKSB7IH1cblxuICBjbG9uZShhZGRpdGlvbmFsUHJvcGVydGllcyA9IHt9KSB7XG4gICAgcmV0dXJuIG9iamVjdEFzc2lnbihvYmplY3RBc3NpZ24obmV3IFZhbGlkYXRpb25Db250ZXh0LCB0aGlzKSwgYWRkaXRpb25hbFByb3BlcnRpZXMpO1xuICB9XG5cblxuICBhZGRGcmVlQnJlYWtTdGF0ZW1lbnQocykge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGZyZWVCcmVha1N0YXRlbWVudHM6IHRoaXMuZnJlZUJyZWFrU3RhdGVtZW50cy5jb25jYXQoW3NdKSxcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyRnJlZUJyZWFrU3RhdGVtZW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9uZSh7XG4gICAgICBmcmVlQnJlYWtTdGF0ZW1lbnRzOiBbXSxcbiAgICB9KTtcbiAgfVxuXG4gIGFkZEZyZWVDb250aW51ZVN0YXRlbWVudChzKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgZnJlZUNvbnRpbnVlU3RhdGVtZW50czogdGhpcy5mcmVlQ29udGludWVTdGF0ZW1lbnRzLmNvbmNhdChbc10pLFxuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJGcmVlQ29udGludWVTdGF0ZW1lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGZyZWVDb250aW51ZVN0YXRlbWVudHM6IFtdLFxuICAgIH0pO1xuICB9XG5cbiAgZW5mb3JjZUZyZWVCcmVha0FuZENvbnRpbnVlU3RhdGVtZW50RXJyb3JzKCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGZyZWVCcmVha1N0YXRlbWVudHM6IFtdLFxuICAgICAgZnJlZUNvbnRpbnVlU3RhdGVtZW50czogW10sXG4gICAgICBlcnJvcnM6IHRoaXMuZXJyb3JzLmNvbmNhdCh0aGlzLmZyZWVCcmVha1N0YXRlbWVudHMpLmNvbmNhdCh0aGlzLmZyZWVDb250aW51ZVN0YXRlbWVudHMpLFxuICAgIH0pO1xuICB9XG5cblxuICBvYnNlcnZlSXRlcmF0aW9uTGFiZWxOYW1lKGxhYmVsKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgdXNlZExhYmVsTmFtZXM6IHRoaXMudXNlZExhYmVsTmFtZXMuY29uY2F0KFtsYWJlbC5uYW1lXSksXG4gICAgICBmcmVlSnVtcFRhcmdldHM6IHRoaXMuZnJlZUp1bXBUYXJnZXRzLmZpbHRlcihpbmZvID0+IGluZm8ubmFtZSAhPT0gbGFiZWwubmFtZSksXG4gICAgfSk7XG4gIH1cblxuICBvYnNlcnZlTm9uSXRlcmF0aW9uTGFiZWxOYW1lKGxhYmVsKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgdXNlZExhYmVsTmFtZXM6IHRoaXMudXNlZExhYmVsTmFtZXMuY29uY2F0KFtsYWJlbC5uYW1lXSksXG4gICAgICBmcmVlSnVtcFRhcmdldHM6IHRoaXMuZnJlZUp1bXBUYXJnZXRzLmZpbHRlcihpbmZvID0+IGluZm8ubmFtZSAhPT0gbGFiZWwubmFtZSB8fCBpbmZvLnR5cGUgIT09ICdicmVhaycpLFxuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJVc2VkTGFiZWxOYW1lcygpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9uZSh7XG4gICAgICB1c2VkTGFiZWxOYW1lczogW10sXG4gICAgfSk7XG4gIH1cblxuICBhZGRGcmVlQnJlYWtKdW1wVGFyZ2V0KGxhYmVsKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgZnJlZUp1bXBUYXJnZXRzOiB0aGlzLmZyZWVKdW1wVGFyZ2V0cy5jb25jYXQoW3tuYW1lOiBsYWJlbC5uYW1lLCB0eXBlOiAnYnJlYWsnfV0pLFxuICAgIH0pO1xuICB9XG5cbiAgYWRkRnJlZUNvbnRpbnVlSnVtcFRhcmdldChsYWJlbCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGZyZWVKdW1wVGFyZ2V0czogdGhpcy5mcmVlSnVtcFRhcmdldHMuY29uY2F0KFt7bmFtZTogbGFiZWwubmFtZSwgdHlwZTogJ2NvbnRpbnVlJ31dKSxcbiAgICB9KTtcbiAgfVxuXG5cbiAgYWRkRnJlZVJldHVyblN0YXRlbWVudChyKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgZnJlZVJldHVyblN0YXRlbWVudHM6IHRoaXMuZnJlZVJldHVyblN0YXRlbWVudHMuY29uY2F0KFtyXSksXG4gICAgfSk7XG4gIH1cblxuICBjbGVhckZyZWVSZXR1cm5TdGF0ZW1lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGZyZWVSZXR1cm5TdGF0ZW1lbnRzOiBbXSxcbiAgICB9KTtcbiAgfVxuXG4gIGVuZm9yY2VGcmVlUmV0dXJuU3RhdGVtZW50RXJyb3JzKCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGZyZWVSZXR1cm5TdGF0ZW1lbnRzOiBbXSxcbiAgICAgIGVycm9yczogdGhpcy5lcnJvcnMuY29uY2F0KHRoaXMuZnJlZVJldHVyblN0YXRlbWVudHMpLFxuICAgIH0pO1xuICB9XG5cblxuICBhZGRVbmluaXRpYWxpc2VkRGVjbGFyYXRvcihub2RlKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgdW5pbml0aWFsaXNlZERlY2xhcmF0b3JzOiB0aGlzLnVuaW5pdGlhbGlzZWREZWNsYXJhdG9ycy5jb25jYXQobm9kZSksXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmNlVW5pbml0aWFsaXNlZERlY2xhcmF0b3JzKCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIHVuaW5pdGlhbGlzZWREZWNsYXJhdG9yczogW10sXG4gICAgICBlcnJvcnM6IHRoaXMuZXJyb3JzLmNvbmNhdCh0aGlzLnVuaW5pdGlhbGlzZWREZWNsYXJhdG9ycyksXG4gICAgfSk7XG4gIH1cblxuXG4gIGFkZEVycm9yKGUpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9uZSh7XG4gICAgICBlcnJvcnM6IHRoaXMuZXJyb3JzLmNvbmNhdChbZV0pLFxuICAgIH0pO1xuICB9XG5cbiAgYWRkU3RyaWN0RXJyb3IoZSkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIHN0cmljdEVycm9yczogdGhpcy5zdHJpY3RFcnJvcnMuY29uY2F0KFtlXSksXG4gICAgfSk7XG4gIH1cblxuICBlbmZvcmNlU3RyaWN0RXJyb3JzKCkge1xuICAgIHJldHVybiB0aGlzLmNsb25lKHtcbiAgICAgIGVycm9yczogdGhpcy5lcnJvcnMuY29uY2F0KHRoaXMuc3RyaWN0RXJyb3JzKSxcbiAgICAgIHN0cmljdEVycm9yczogW10sXG4gICAgfSk7XG4gIH1cblxuICAvLyBNT05PSUQgSU1QTEVNRU5UQVRJT05cblxuICBzdGF0aWMgZW1wdHkoKSB7XG4gICAgcmV0dXJuIGlkZW50aXR5O1xuICB9XG5cbiAgY29uY2F0KHYpIHtcbiAgICBpZiAodGhpcyA9PT0gaWRlbnRpdHkpIHJldHVybiB2O1xuICAgIGlmICh2ID09PSBpZGVudGl0eSkgcmV0dXJuIHRoaXM7XG4gICAgcmV0dXJuIHRoaXMuY2xvbmUoe1xuICAgICAgZnJlZUJyZWFrU3RhdGVtZW50czogdGhpcy5mcmVlQnJlYWtTdGF0ZW1lbnRzLmNvbmNhdCh2LmZyZWVCcmVha1N0YXRlbWVudHMpLFxuICAgICAgZnJlZUNvbnRpbnVlU3RhdGVtZW50czogdGhpcy5mcmVlQ29udGludWVTdGF0ZW1lbnRzLmNvbmNhdCh2LmZyZWVDb250aW51ZVN0YXRlbWVudHMpLFxuICAgICAgdXNlZExhYmVsTmFtZXM6IHRoaXMudXNlZExhYmVsTmFtZXMuY29uY2F0KHYudXNlZExhYmVsTmFtZXMpLFxuICAgICAgZnJlZUp1bXBUYXJnZXRzOiB0aGlzLmZyZWVKdW1wVGFyZ2V0cy5jb25jYXQodi5mcmVlSnVtcFRhcmdldHMpLFxuICAgICAgZnJlZVJldHVyblN0YXRlbWVudHM6IHRoaXMuZnJlZVJldHVyblN0YXRlbWVudHMuY29uY2F0KHYuZnJlZVJldHVyblN0YXRlbWVudHMpLFxuICAgICAgdW5pbml0aWFsaXNlZERlY2xhcmF0b3JzOiB0aGlzLnVuaW5pdGlhbGlzZWREZWNsYXJhdG9ycy5jb25jYXQodi51bmluaXRpYWxpc2VkRGVjbGFyYXRvcnMpLFxuICAgICAgZXJyb3JzOiB0aGlzLmVycm9ycy5jb25jYXQodi5lcnJvcnMpLFxuICAgICAgc3RyaWN0RXJyb3JzOiB0aGlzLnN0cmljdEVycm9ycy5jb25jYXQodi5zdHJpY3RFcnJvcnMpXG4gICAgfSk7XG4gIH1cblxuICAvLyBIRUxQRVJTXG5cbiAgY2hlY2tSZXNlcnZlZChpZGVudGlmaWVyKSB7XG4gICAgaWYgKGlzUmVzZXJ2ZWRXb3JkRVM1KGlkZW50aWZpZXIubmFtZSwgdHJ1ZSkpIHtcbiAgICAgIGlmIChpc1Jlc2VydmVkV29yZEVTNShpZGVudGlmaWVyLm5hbWUsIGZhbHNlKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5hZGRFcnJvcihuZXcgVmFsaWRhdGlvbkVycm9yKGlkZW50aWZpZXIsIFwiSWRlbnRpZmllciBtdXN0IG5vdCBiZSByZXNlcnZlZCB3b3JkIGluIHRoaXMgcG9zaXRpb25cIikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYWRkU3RyaWN0RXJyb3IobmV3IFZhbGlkYXRpb25FcnJvcihpZGVudGlmaWVyLCBcIklkZW50aWZpZXIgbXVzdCBub3QgYmUgc3RyaWN0IG1vZGUgcmVzZXJ2ZWQgd29yZCBpbiB0aGlzIHBvc2l0aW9uXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBjaGVja1Jlc3RyaWN0ZWQoaWRlbnRpZmllcikge1xuICAgIGxldCB2ID0gdGhpcy5jaGVja1Jlc2VydmVkKGlkZW50aWZpZXIpO1xuICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKGlkZW50aWZpZXIubmFtZSkpIHtcbiAgICAgIHJldHVybiB2LmFkZFN0cmljdEVycm9yKG5ldyBWYWxpZGF0aW9uRXJyb3IoaWRlbnRpZmllciwgXCJJZGVudGlmaWVyIG11c3Qgbm90IGJlIHJlc3RyaWN0ZWQgd29yZCBpbiB0aGlzIHBvc2l0aW9uIGluIHN0cmljdCBtb2RlXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbn1cblxuaWRlbnRpdHkgPSBuZXcgVmFsaWRhdGlvbkNvbnRleHQ7XG5vYmplY3RBc3NpZ24oaWRlbnRpdHksIHByb3RvKTtcblxuZXhwb3J0IGNsYXNzIFZhbGlkYXRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3Iobm9kZSwgbWVzc2FnZSkge1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxufVxuIl19