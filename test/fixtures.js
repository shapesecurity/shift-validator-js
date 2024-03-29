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

const fs = require("fs");
const assert = require("assert");

const { parseScript, parseModule } = require("shift-parser");

const { isValid, Validator } = require("../");

suite("fixtures", () => {
  test("validator is valid", () => {
    let source = "" + fs.readFileSync(require.resolve("../"));
    let ast = parseScript(source);
    assert(isValid(ast));
  });

  test("everything.js Script is valid", () => {
    let source = "" + fs.readFileSync(require.resolve("everything.js/es2015-script"));
    let ast = parseScript(source);
    assert(isValid(ast));
  });

  test("everything.js Module is valid", () => {
    let source = "" + fs.readFileSync(require.resolve("everything.js/es2015-module"));
    let ast = parseModule(source);
    assert(isValid(ast));
  });
});
