//-------------------------------------------------------------------------------------------------------
// Copyright (C) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

"use strict";

let console = require('console');
let process = require('process');

let long = require('long');

////////////////////////////////
//Representations for the tokens in the lexer

////
//Tags for lexed tokens
let lexerTokens = {
    clear: 'clear',

    leftParen: '{',
    rightParen: '{',
    leftBrack: '[',
    rightBrack: ']',
    comma: ',',

    nullVal: 'null',
    trueVal: 'true',
    falseVal: 'false',

    jsonKey: 'jsonKey',

    integer: 'integer',
    float: 'float',
    string: 'string',
    address: 'address',
    logTag: 'logTag',
    enumTag: 'enumTag',
    wkToken: 'wellknownToken'
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

        this.cachedNext = null;
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

    //check for a given prefix regex
    checkPrefix(re) {
        re.lastIndex = this.cpos;
        return re.test(this.str);
    }

    //lex out a simple token -- { } [ ] , null true false
    simpleTokenRegex = /{|}|\[|\]|,|null|true|false/y;
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
        return t;
    }

    //lex out a json key -- should only be [a-zA-z0-9] strings ending with :
    jsonKeyRegex = /([a-zA-Z_]\w*):/y;
    lexNextJsonKey() {
        jsonKeyRegex.lastIndex = this.cpos;
        let m = jsonKeyRegex.exec(this.str);
        this.lexerAssert(m && m.length >= 2, 'JsonKey match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        return createLexerToken(lexerTokens.jsonKey, m[1]);
    }

    //lex out numeric values
    floatRegex = /-?[0-9]+\.[0-9]+/y;
    integerRegex = /-?[0-9]+/y;
    lexNextNumber() {
        let lt = lexerTokens.clear;
        let val = 0;

        floatRegex.lastIndex = this.cpos;
        let m = floatRegex.exec(this.str);
        if (m) {
            lt = lexerTokens.float;
            val = Number.parseFloat(m[0]);
        }
        else {
            integerRegex.lastIndex = this.cpos;
            m = integerRegex.exec(this.str);

            lt = lexerTokens.integer;
            val = Number.parseInt(m[0]);
        }
        this.lexerAssert(m, 'Number match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        return createLexerToken(lt, val);
    }

    //lex out a string value
    stringHeadRegex = /@([0-9]+)\"/y;
    lexNextString() {
        stringHeadRegex.lastIndex = this.cpos;
        let m = stringHeadRegex.exec(this.str);
        this.lexerAssert(m && m.length >= 3, 'String match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        let strlen = Number.parseInt(m[2]);

        let sbegin = this.cpos;
        let send = this.cpos + strlen;
        let strval = this.str.substring(sbegin, send);

        this.cpos += strlen + 1; //read off strlen + tailing quote
        return createLexerToken(lexerTokens.string, val);
    }

    //lex out address/logtag/enumTag
    lexNextSymValueHelper(re, lt) {
        re.lastIndex = this.cpos;
        let m = re.exec(this.str);
        this.lexerAssert(m && m.length >= 2, 'Match fail -- should check before calling this method.');

        let nval = Number.parseInt(m[1]);
        if (!Number.isSafeInteger(nval)) {
            this.lexerAssert(false, 'We need to add big number support via the long package here.');
        }

        this.cpos += m[0].length;
        return createLexerToken(lt, nval);
    }

    addressRegex = /\*[0-9]+/y;
    lexNextAddress() {
        return lexNextSymValueHelper(addressRegex, lexerTokens.address);
    }

    logtagRegex = /![0-9]+/y;
    lexNextLogTag() {
        return lexNextSymValueHelper(logtagRegex, lexerTokens.logTag);
    }

    enumtagRegex = /\$[0-9]+/y;
    lexNextEnumTag() {
        return lexNextSymValueHelper(enumtagRegex, lexerTokens.enumTag);
    }

    //lex out a well-known token value
    wellknownRegex = /~(^[~\w]+)~/y;
    lexNextWellKnown() {
        wellknownRegex.lastIndex = this.cpos;
        let m = wellknownRegex.exec(this.str);
        this.lexerAssert(m && m.length >= 3, 'Wellknown match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        return createLexerToken(lexerTokens.wkToken, m[2]);
    }

    //Read the next token from the stream
    popNextToken() {
        let res = null;

        if (this.cachedNext) {
            res = this.cachedNext;
            this.cachedNext = null;
        }
        else {
            if (this.checkPrefix(jsonKeyRegex)) {
                res = this.lexNextJsonKey();
            }
            else if (this.checkPrefix(simpleTokenRegex)) {
                res = this.lexNextSimpleToken();
            }
            else if (this.checkPrefix(floatRegex) || this.checkPrefix(integerRegex)) {
                res = this.lexNextNumber();
            }
            else if (this.checkPrefix(stringHeadRegex)) {
                res = this.lexNextString();
            }
            else if (this.checkPrefix(addressRegex)) {
                res = this.lexNextAddress();
            }
            else if (this.checkPrefix(logtagRegex)) {
                res = this.lexNextLogTag();
            }
            else if (this.checkPrefix(enumtagRegex)) {
                res = this.lexNextEnumTag();
            }
            else if (this.checkPrefix(wellknownRegex)) {
                res = this.lexNextWellKnown();
            }
            else {
                ; //no matches so just leave res as null
            }

            if (res) {
                this.cachedNext = res;
            }
        }

        return res;
    }

    //peek to see what the result of the next token would be
    peekNextToken() {
        if (!this.cachedNext) {
            this.cachedNext = this.popNextToken();
        }

        return this.cachedNext;
    }
};

exports.Lexer = Lexer;
