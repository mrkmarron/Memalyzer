
"use strict";

let console = require('console');
let fs = require('fs');
let process = require('process');
let cProcess = require('child_process');
let util = require('util');

let ejs = require('ejs');

let csp = require('./callSiteProcessing');

//
let nodePath = 'C:\\Chakra\\TTNode\\Debug\\';
let nodeExePath = nodePath + 'node.exe';

let userCodePath = undefined;
let outputhtml = undefined;
//

let siteejs = fs.readFileSync(__dirname + '/views/site.ejs', { encoding: 'utf8' });
let cpathejs = fs.readFileSync(__dirname + '/views/cpath.ejs', { encoding: 'utf8' });

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
        return ejs.render(siteejs, { data: mobj });
    }
    else {
        let subtrees = [];
        mobj.callPaths.forEach(function (cmobj) {
            subtrees.push(renderCallSiteTree(cmobj));
        });

        return ejs.render(cpathejs, { info: mobj, subtrees: subtrees });
    }
}

function isInterestingSizeCheck(liveCount, liveSize, totalCount, totalSize) {
    let countOk = (liveCount / totalCount) > 0.05;
    let sizeOk = (liveSize / totalSize) > 0.05;

    return countOk || sizeOk;
}

function processAllocationInfo(allocInfo) {
    let userAllocInfo = [];

    console.log('Filtering interesting allocation sites...');

    allocInfo.forEach(function (mobj) {
        let scc = csp.stdFilterMemoryObject(mobj, userCodePath, false);
        if (scc) {
            userAllocInfo.push(scc);
        }
    });

    console.log('Computing statistics...');

    let totalMem = userAllocInfo.reduce(function (acc, val) {
        return acc + csp.computeTotalMemoryUse(val);
    }, 0);

    let totalCount = userAllocInfo.reduce(function (acc, val) {
        return acc + csp.computeTotalLiveCount(val);
    }, 0);

    console.log('Generating html...');

    let allocHtml = [];
    userAllocInfo.forEach(function (mobj) {
        let process = true;
        if (mobj.site) {
            process = isInterestingSizeCheck(mobj.site.liveCount, mobj.site.liveSize, totalCount, totalMem);
        }
        else {
            process = isInterestingSizeCheck(mobj.liveCount, mobj.liveSize, totalCount, totalMem);
        }

        if (process) {
            allocHtml.push(renderCallSiteTree(mobj));
        }
    });

    ejs.renderFile(__dirname + '/views/index.ejs', { allocs: allocHtml }, { cache: false }, function (err, res) {
        if (err) {
            console.log("Error in render: " + err.toString());
            return;
        }

        console.log('Writing html to ' + outputhtml + '...');
        fs.writeFileSync(outputhtml, res);

        console.log('Done.');
    });
}

function executeReplayAndProcess(traceFile, srcRoot, htmloutput) {
    userCodePath = srcRoot;
    outputhtml = htmloutput;

    console.log('Copying trace file from ' + traceFile + ' for analysis...');
    //
    //TODO: copy traceFile to nodepath ttlog 
    //

    console.log('Replaying tracefile with analytics...')

    let args = ['--nolazy', '-TTReplay:ttlog'];
    let options = { cwd: nodePath };

    let cproc = cProcess.spawn(nodeExePath, args, options);

    cproc.on('error', function (err) {
        console.log('Replaying tracefile failed: ' + err);
        process.exit(1);
    });

    let stdoutResult = '';
    cproc.stdout.on('data', function (data) {
        stdoutResult += data;
    });

    cproc.on('close', function (code) {
        if (code !== 0) {
            console.log("Failed replay with:" + code);
            process.exit(1);
        }

        loadAllocationInfo(code, stdoutResult);
    });


}

//fs.readFile(dataFile, 'utf8', loadAllocationInfo);

//
//TODO read parameters from command line
//
executeReplayAndProcess(nodePath + 'ttlog', 'c:\\Users\\marron\\Desktop\\memory-leak-example-master', 'c:\\Users\\marron\\Desktop\\alloc.html');
