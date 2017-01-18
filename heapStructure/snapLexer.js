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

    if (optData !== undefined) {
        res.data = optData;
    }

    return res;
}

//lexer state class
class Lexer {
    constructor(str) {
        this.str = str;
        this.cpos = str.indexOf('{'); //skip any BOM or other meta-data 

        this.cachedNext = null;

        this.simpleTokenRegex = /{|}|\[|\]|,|null|true|false/y;
        this.jsonKeyRegex = /([a-zA-Z_]\w*):/y;
        this.floatRegex = /-?[0-9]+\.[0-9]+/y;
        this.integerRegex = /-?[0-9]+/y;
        this.stringHeadRegex = /@([0-9]+)\"/y;
        this.addressRegex = /\*([0-9]+)/y;
        this.logtagRegex = /!([0-9]+)/y;
        this.enumtagRegex = /\$([0-9]+)/y;
        this.wellknownRegex = /~(^[~\w]+)~/y;
        this.wsRegex = /\s*/y
    }

    lexerAssert(cond, msg) {
        if (!cond) {
            console.log(msg);

            let pstr = this.str.substring(Math.max(this.cpos - 10, 0), this.cpos);
            let estr = this.str.substring(this.cpos, Math.min(this.cpos + 15, this.str.length));

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
    lexNextSimpleToken() {
        this.simpleTokenRegex.lastIndex = this.cpos;
        let m = this.simpleTokenRegex.exec(this.str);
        this.lexerAssert(m, 'SimpleToken match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        switch (m[0]) {
            case '{': return createLexerToken(lexerTokens.leftParen);
            case '}': return createLexerToken(lexerTokens.rightParen);
            case '[': return createLexerToken(lexerTokens.leftBrack);
            case ']': return createLexerToken(lexerTokens.rightBrack);
            case ',': return createLexerToken(lexerTokens.comma);
            case 'null': return createLexerToken(lexerTokens.nullVal);
            case 'true': return createLexerToken(lexerTokens.trueVal);
            case 'false': return createLexerToken(lexerTokens.falseVal);
        }
    }

    //lex out a json key -- should only be [a-zA-z0-9] strings ending with :
    lexNextJsonKey() {
        this.jsonKeyRegex.lastIndex = this.cpos;
        let m = this.jsonKeyRegex.exec(this.str);
        this.lexerAssert(m && m.length >= 2, 'JsonKey match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        return createLexerToken(lexerTokens.jsonKey, m[1]);
    }

    //lex out numeric values
    lexNextNumber() {
        let lt = lexerTokens.clear;
        let val = 0;

        this.floatRegex.lastIndex = this.cpos;
        let m = this.floatRegex.exec(this.str);
        if (m) {
            lt = lexerTokens.float;
            val = Number.parseFloat(m[0]);
        }
        else {
            this.integerRegex.lastIndex = this.cpos;
            m = this.integerRegex.exec(this.str);

            lt = lexerTokens.integer;
            val = Number.parseInt(m[0]);
        }
        this.lexerAssert(m, 'Number match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        return createLexerToken(lt, val);
    }

    //lex out a string value
    lexNextString() {
        this.stringHeadRegex.lastIndex = this.cpos;
        let m = this.stringHeadRegex.exec(this.str);
        this.lexerAssert(m && m.length >= 2, 'String match fail -- should check before calling this method.');

        this.cpos += m[0].length;
        let strlen = Number.parseInt(m[1]);

        let sbegin = this.cpos;
        let send = this.cpos + strlen;
        let strval = this.str.substring(sbegin, send);

        this.cpos += strlen + 1; //read off strlen + tailing quote
        return createLexerToken(lexerTokens.string, strval);
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

    lexNextAddress() {
        return this.lexNextSymValueHelper(this.addressRegex, lexerTokens.address);
    }

    lexNextLogTag() {
        return this.lexNextSymValueHelper(this.logtagRegex, lexerTokens.logTag);
    }

    lexNextEnumTag() {
        return this.lexNextSymValueHelper(this.enumtagRegex, lexerTokens.enumTag);
    }

    //lex out a well-known token value
    lexNextWellKnown() {
        this.wellknownRegex.lastIndex = this.cpos;
        let m = this.wellknownRegex.exec(this.str);
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
            this.wsRegex.lastIndex = this.cpos;
            let wsm = this.wsRegex.exec(this.str);
            if(wsm) {
                this.cpos += wsm[0].length;
            }

            if (this.checkPrefix(this.jsonKeyRegex)) {
                res = this.lexNextJsonKey();
            }
            else if (this.checkPrefix(this.simpleTokenRegex)) {
                res = this.lexNextSimpleToken();
            }
            else if (this.checkPrefix(this.floatRegex) || this.checkPrefix(this.integerRegex)) {
                res = this.lexNextNumber();
            }
            else if (this.checkPrefix(this.stringHeadRegex)) {
                res = this.lexNextString();
            }
            else if (this.checkPrefix(this.addressRegex)) {
                res = this.lexNextAddress();
            }
            else if (this.checkPrefix(this.logtagRegex)) {
                res = this.lexNextLogTag();
            }
            else if (this.checkPrefix(this.enumtagRegex)) {
                res = this.lexNextEnumTag();
            }
            else if (this.checkPrefix(this.wellknownRegex)) {
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
