
"use strict";

let path = require('path');

//Compute the memory use for a mobj record
function computeTotalMemoryUse(mobj) {
    if(mobj.site) {
        return mobj.site.liveSize;
    }
    else {
        mobj.liveSize = mobj.callPaths.reduce(function (acc, val) {
            return acc + computeTotalMemoryUse(val);
        }, 0);

        return mobj.liveSize;
    }
}

function computeTotalLiveCount(mobj) {
    if(mobj.site) {
        return mobj.site.liveCount;
    }
    else {
        mobj.liveCount = mobj.callPaths.reduce(function (acc, val) {
            return acc + computeTotalLiveCount(val);
        }, 0);

        return mobj.liveCount;
    }
}

function checkForUseFlags(mobj) {
    if(mobj.site) {
        return !!mobj.site.flags;
    }
    else {
        return mobj.callPaths.reduce(function (acc, val) {
            return acc | checkForUseFlags(val);
        }, false);
    }
}

//check if a function is in a user source file
function isSrcUserCode(srcFile) {
    return path.isAbsolute(srcFile);
}

//Filter a memory record tree to only callstacks that contain user code and have at least 2 live object
function stdFilterMemoryObject(mobj, okpath) {
    if(mobj.site) {
        return ((okpath || isSrcUserCode(mobj.src.file)) && mobj.site.liveSize !== 0) ? mobj : null;
    }
    else {
        let newpaths = [];

        let tokpath = okpath || isSrcUserCode(mobj.src.file);
        mobj.callPaths.forEach(function (cmobj) {
            let scc = stdFilterMemoryObject(cmobj, tokpath);
            if(scc) {
                newpaths.push(scc);
            }
        });

        if(newpaths.length === 0) {
            return null;
        }
        else {
            mobj.callPaths = newpaths;
            return mobj;
        }
    }
}

exports.computeTotalMemoryUse = computeTotalMemoryUse;
exports.computeTotalLiveCount = computeTotalLiveCount;
exports.checkForUseFlags = checkForUseFlags;
exports.stdFilterMemoryObject = stdFilterMemoryObject;
