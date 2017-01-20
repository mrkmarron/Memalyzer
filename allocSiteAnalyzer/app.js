
"use strict";

let console = require('console');
let fs = require('fs');
let process = require('process');
let util = require('util');

let ejs = require('ejs');

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
    let dstr = data.substring(dspos).replace(/\\/g, '\\\\');
    processAllocationInfo(JSON.parse(dstr));
}

function renderCallSiteTree(mobj) {
    if (mobj.site) {
        return ejs.render('<li><span class="rootSpan" <%= data.src.file %></span></li>', { data: mobj });
    }
    else {
        let subtrees = [];
        mobj.callPaths.forEach(function (cmobj) {
            subtrees.push(renderCallSiteTree(cmobj));
        });

        return ejs.render('<li><input type="checkbox" /><label  <span class="pathSpan"><%= info.src.file %></span></label><ul> \
                            <% subtrees.forEach(function (value) { %> <%- value %> <% }); %>\
                            </ul></li>', { info: mobj, subtrees: subtrees });
    }
}

function processAllocationInfo(allocInfo) {
    let userAllocInfo = [];

    allocInfo.forEach(function (mobj) {
        let scc = csp.stdFilterMemoryObject(mobj, userCodePath, false);
        if (scc) {
            userAllocInfo.push(scc);
        }
    });

    let totalMem = userAllocInfo.reduce(function (acc, val) {
        return acc + csp.computeTotalMemoryUse(val);
    }, 0);

    let allocHtml = [];
    userAllocInfo.forEach(function (mobj) {
        allocHtml.push(renderCallSiteTree(mobj));
    });

    ejs.renderFile(__dirname + '/views/index.ejs', { allocs: allocHtml }, { cache: false }, function (err, res) {
        if (err) {
            console.log("Error in render: " + err.toString());
            return;
        }

        console.log(res.toString());
    });
}

fs.readFile(dataFile, 'utf8', loadAllocationInfo);
