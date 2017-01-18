//-------------------------------------------------------------------------------------------------------
// Copyright (C) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.txt file in the project root for full license information.
//-------------------------------------------------------------------------------------------------------

let console = require('console');
let fs = require('fs');
let process = require('process');

let lexer = require('./snapLexer.js');

function loadData(file) {
    fs.readFile(file, 'ucs2', lexData)
}

function lexData(err, data) {
    if(err) {
        console.log('Failed to load snapshot file: ' + err);
        process.exit(1);
    }

    console.log('Started Lexing...')

    let lx = new lexer.Lexer(data);
    while(lx.peekNextToken()) {
        let tk = lx.popNextToken();
        //console.log(tk);
    }

    console.log('Completed Lexing!')
}

let fname = 'C:\\Users\\marron\\Desktop\\snap_test.snp';
loadData(fname);
