//-------------------------------------------------------------------------------------------------------
// Copyright (C) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

let console = require('console');
let process = require('process');

////////////////////////////////
//Representations for the tokens in the lexer

////
//Tags for lexed tokens
let lexerTokens = {
    clear: "clear",

    leftParen: "{",
    rightParen: "{",
    leftBrack: "[",
    rightBrack: "]",
    comma: ",",

    nullVal: "null",
    trueVal: "true",
    falseVal: "false",

    jsonKey: "jsonKey",

    integral: "integral",
    float: "float",
    string: "string",
    address: "address",
    logTag: "logTag",
    enumTag: "enumTag",
    wkToken: "wellknownToken"
};

////
//Functions for parsing out and managing tokens

//constructor for all lexer tokens
function createLexerToken(tokenTag, optData) {
    let res = { tag: tokenTag };

    if (optData) {
        res.data = optData;
    }

    return res;
}

//lexer state class
class Lexer {
    constructor(str) {
        this.str = str;
        this.cpos = 0;

        this.output = [];
    }

    lexerAssert(cond, msg) {
        if (!cond) {
            console.log(msg);

            let pstr = this.str.substring(max(this.cpos - 10, 0), this.cpos);
            let estr = this.str.substring(this.cpos, min(this.cpos + 15, this.str.length));

            console.log(pstr + estr);
            console.log(' '.repeat(pstr.length) + '^');

            process.exit(1);
        }
    }

    //lex out a simple token -- { } [ ] , null true false
    simpleTokenRegex = /{|}|\[|\]|,|null|true|false/y;
    isNextSimpleToken() {
        simpleTokenRegex.lastIndex = this.cpos;
        return simpleTokenRegex.test(this.str);
    }
    lexNextSimpleToken() {
        simpleTokenRegex.lastIndex = this.cpos;
        let m = simpleTokenRegex.exec(this.str);
        this.lexerAssert(m, 'SimpleToken match fail -- should check before calling this method.');

        switch (m[0]) {
            case '{': t = createLexerToken(lexerTokens.leftParen); break;
            case '}': t = createLexerToken(lexerTokens.rightParen); break;
            case '[': t = createLexerToken(lexerTokens.leftBrack); break;
            case ']': t = createLexerToken(lexerTokens.rightBrack); break;
            case ',': t = createLexerToken(lexerTokens.comma); break;
            case 'null': t = createLexerToken(lexerTokens.nullVal); break;
            case 'true': t = createLexerToken(lexerTokens.trueVal); break;
            case 'false': t = createLexerToken(lexerTokens.falseVal); break;
        }

        this.cpos += m[0].length;
        this.output.push(t);
    }

    //lex out a json key -- should only be [a-zA-z0-9] strings ending with :
    jsonKeyRegex = /[a-zA-Z_]\w*:/y;
    isNextJsonKey() {
        jsonKeyRegex.lastIndex = this.cpos;
        jsonKeyRegex.test(this.str);
    }
    lexNextJsonKey() {
        jsonKeyRegex.lastIndex = this.cpos;
        let m = jsonKeyRegex.exec(this.str);
        this.lexerAssert(m, 'JsonKey match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        let jkey = m[0].substring(0, m[0].length - 1);

        let t = createLexerToken(lexerTokens.jsonKey, jkey);
        this.output.push(t);
    }
};
