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

import {keyword} from "esutils";
const {isRestrictedWord, isReservedWordES5} = keyword;

export class ValidationContext {

  constructor(freeBreakStatements, freeContinueStatements, usedLabelNames, freeJumpTargets, freeReturnStatements, errors, strictErrors) {
    this.freeBreakStatements = freeBreakStatements;
    this.freeContinueStatements = freeContinueStatements;
    this.usedLabelNames = usedLabelNames;
    this.freeJumpTargets = freeJumpTargets;
    this.freeReturnStatements = freeReturnStatements;
    this.errors = errors;
    this.strictErrors = strictErrors;
  }

  static empty() {
    return new ValidationContext([],[],[],[],[],[],[]);
  }

  addFreeBreakStatement(s) {
    return new ValidationContext(
      this.freeBreakStatements.concat([s]),
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  clearFreeBreakStatements() {
    return new ValidationContext(
      [],
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  addFreeContinueStatement(s) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements.concat([s]),
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  clearFreeContinueStatements() {
    return new ValidationContext(
      this.freeBreakStatements,
      [],
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  observeLabelName(l) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames.concat([l.name]),
      this.freeJumpTargets.filter(identifier => identifier.name !== l.name),
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  clearUsedLabelNames() {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      [],
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  addFreeJumpTarget(l) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets.concat([l]),
      this.freeReturnStatements,
      this.errors,
      this.strictErrors
    );
  }

  addFreeReturnStatement(r) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements.concat([r]),
      this.errors,
      this.strictErrors
    );
  }

  clearFreeReturnStatements() {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      [],
      this.errors,
      this.strictErrors
    );
  }

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

  addError(e) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors.concat([e]),
      this.strictErrors
    );
  }

  addErrors(errors) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors.concat(errors),
      this.strictErrors
    );
  }

  addStrictError(e) {
    return new ValidationContext(
      this.freeBreakStatements,
      this.freeContinueStatements,
      this.usedLabelNames,
      this.freeJumpTargets,
      this.freeReturnStatements,
      this.errors,
      this.strictErrors.concat([e])
    );
  }

  concat(v) {
    return new ValidationContext (
      this.freeBreakStatements.concat(v.freeBreakStatements),
      this.freeContinueStatements.concat(v.freeContinueStatements),
      this.usedLabelNames.concat(v.usedLabelNames),
      this.freeJumpTargets.concat(v.freeJumpTargets),
      this.freeReturnStatements.concat(v.freeReturnStatements),
      this.errors.concat(v.errors),
      this.strictErrors.concat(v.strictErrors)
    );
  }
}

export class ValidationError extends Error {
  constructor(node, message) {
    this.node = node;
    this.message = message;
  }
}
