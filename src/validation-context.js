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

import * as objectAssign from "object-assign";
import {keyword} from "esutils";
const {isRestrictedWord, isReservedWordES5} = keyword;

const proto = {
  __proto__: null,
  freeBreakStatements: [],
  freeContinueStatements: [],
  usedLabelNames: [],
  freeJumpTargets: [],
  freeReturnStatements: [],
  uninitialisedDeclarators: [],
  errors: [],
  strictErrors: [],
};

let identity; // initialised below ValidationContext

export class ValidationContext {

  constructor() { }

  clone(additionalProperties = {}) {
    return objectAssign(objectAssign(new ValidationContext, this), additionalProperties);
  }


  addFreeBreakStatement(s) {
    return this.clone({
      freeBreakStatements: this.freeBreakStatements.concat([s]),
    });
  }

  clearFreeBreakStatements() {
    return this.clone({
      freeBreakStatements: [],
    });
  }

  addFreeContinueStatement(s) {
    return this.clone({
      freeContinueStatements: this.freeContinueStatements.concat([s]),
    });
  }

  clearFreeContinueStatements() {
    return this.clone({
      freeContinueStatements: [],
    });
  }

  enforceFreeBreakAndContinueStatementErrors() {
    return this.clone({
      freeBreakStatements: [],
      freeContinueStatements: [],
      errors: this.errors.concat(this.freeBreakStatements).concat(this.freeContinueStatements),
    });
  }


  observeIterationLabelName(label) {
    return this.clone({
      usedLabelNames: this.usedLabelNames.concat([label.name]),
      freeJumpTargets: this.freeJumpTargets.filter(info => info.name !== label.name),
    });
  }

  observeNonIterationLabelName(label) {
    return this.clone({
      usedLabelNames: this.usedLabelNames.concat([label.name]),
      freeJumpTargets: this.freeJumpTargets.filter(info => info.name !== label.name || info.type !== 'break'),
    });
  }

  clearUsedLabelNames() {
    return this.clone({
      usedLabelNames: [],
    });
  }

  addFreeBreakJumpTarget(label) {
    return this.clone({
      freeJumpTargets: this.freeJumpTargets.concat([{name: label.name, type: 'break'}]),
    });
  }

  addFreeContinueJumpTarget(label) {
    return this.clone({
      freeJumpTargets: this.freeJumpTargets.concat([{name: label.name, type: 'continue'}]),
    });
  }


  addFreeReturnStatement(r) {
    return this.clone({
      freeReturnStatements: this.freeReturnStatements.concat([r]),
    });
  }

  clearFreeReturnStatements() {
    return this.clone({
      freeReturnStatements: [],
    });
  }

  enforceFreeReturnStatementErrors() {
    return this.clone({
      freeReturnStatements: [],
      errors: this.errors.concat(this.freeReturnStatements),
    });
  }


  addUninitialisedDeclarator(node) {
    return this.clone({
      uninitialisedDeclarators: this.uninitialisedDeclarators.concat(node),
    });
  }

  enforceUninitialisedDeclarators() {
    return this.clone({
      uninitialisedDeclarators: [],
      errors: this.errors.concat(this.uninitialisedDeclarators),
    });
  }


  addError(e) {
    return this.clone({
      errors: this.errors.concat([e]),
    });
  }

  addStrictError(e) {
    return this.clone({
      strictErrors: this.strictErrors.concat([e]),
    });
  }

  enforceStrictErrors() {
    return this.clone({
      errors: this.errors.concat(this.strictErrors),
      strictErrors: [],
    });
  }

  // MONOID IMPLEMENTATION

  static empty() {
    return identity;
  }

  concat(v) {
    if (this === identity) return v;
    if (v === identity) return this;
    return this.clone({
      freeBreakStatements: this.freeBreakStatements.concat(v.freeBreakStatements),
      freeContinueStatements: this.freeContinueStatements.concat(v.freeContinueStatements),
      usedLabelNames: this.usedLabelNames.concat(v.usedLabelNames),
      freeJumpTargets: this.freeJumpTargets.concat(v.freeJumpTargets),
      freeReturnStatements: this.freeReturnStatements.concat(v.freeReturnStatements),
      uninitialisedDeclarators: this.uninitialisedDeclarators.concat(v.uninitialisedDeclarators),
      errors: this.errors.concat(v.errors),
      strictErrors: this.strictErrors.concat(v.strictErrors)
    });
  }

  // HELPERS

  checkReserved(identifier) {
    if (isReservedWordES5(identifier.name, true)) {
      if (isReservedWordES5(identifier.name, false)) {
        return this.addError(new ValidationError(identifier, "Identifier must not be reserved word in this position"));
      }
      return this.addStrictError(new ValidationError(identifier, "Identifier must not be strict mode reserved word in this position"));
    }
    return this;
  }

  checkRestricted(identifier) {
    let v = this.checkReserved(identifier);
    if (isRestrictedWord(identifier.name)) {
      return v.addStrictError(new ValidationError(identifier, "Identifier must not be restricted word in this position in strict mode"));
    }
    return v;
  }
}

identity = new ValidationContext;
objectAssign(identity, proto);

export class ValidationError extends Error {
  constructor(node, message) {
    this.node = node;
    this.message = message;
  }
}
