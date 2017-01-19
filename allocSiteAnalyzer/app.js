
"use strict";

let console = require('console');
let fs = require('fs');
let process = require('process');
let util = require('util');

let csp = require('./callSiteProcessing');

//
let userCodePath = 'c:\\Users\\marron\\Desktop\\memory-leak-example-master\\';
let dataFile = 'C:\\Users\\marron\\Desktop\\memtrace.json';
//

function loadAllocationInfo(err, data) {
    if (err) {
        console.log("Failed to load file: " + err);
        process.exit(1);
    }

    let dspos = data.indexOf('[');
    let dstr = data.substring(dspos);
    processAllocationInfo(JSON.parse(dstr));
}

function processAllocationInfo(allocInfo) {
    let userAllocInfo = [];

    allocInfo.forEach(function (mobj) {
        let scc = csp.stdFilterMemoryObject(mobj, userCodePath, false);
        if (scc) {
            userAllocInfo.push(scc);
        }
    });

    let totalMem = userAllocInfo.reduce(function(acc, val) {
         return acc + csp.computeTotalMemoryUse(val);
    }, 0);

    console.log('Total memory = ' + totalMem);
    console.log(util.inspect(userAllocInfo, { depth: null }));
}

fs.readFile(dataFile, 'utf8', loadAllocationInfo);
