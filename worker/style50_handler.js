define(function (require, exports, module) {
    var baseHandler = require("plugins/c9.ide.language/base_handler");
    var handler = module.exports = Object.create(baseHandler);
    var workerUtil = require("plugins/c9.ide.language/worker_util");


    // activate language handler only on C files
    handler.handlesLanguage = function (language) {
        return language === "c_cpp";
    };

    // gets called whenever a C file is opened and starts linter
    handler.analyze = function (value, ast, options, callback) {
        var markers = [];
        var issues = [];
        var emitter = handler.getEmitter();
        var issueCount = 0;

        // -------------------------------------------------
        // execute clang
        // -------------------------------------------------
        workerUtil.execAnalysis(
            "clang",
            {
                mode: "tempfile",
                args: ["-Wall", "-fdiagnostics-parseable-fixits", "-fsyntax-only", "$FILE"],
                maxCallInterval: 1200
            },
            function (err, stdout, stderr) {
                // Parse each line of output and create marker objects
                (err + stdout + stderr).split("\n").forEach(function (line, index, arr) {
                    var match = line.match(/(.*?):(\d+):(\d+): (note|warning|error): (.*)/);

                    // log the last
                    if (index === arr.length - 1) {
                        var match2 = line.match(/(\d+) (\w+).+(\d+) (\w+)/);
                        console.log("found last line");

                        if (!match) {
                            return;
                        }
                        issueCount++;
                        var warningCount = match2[1];
                        var warningText = match2[2];
                        var errorCount = match2[3];
                        var errorText = match2[4];

                        return;
                    } else if (!match) {
                        return;
                    } else if (issueType === "note") {
                        // clang has an issue type called note
                        // todo: decide whether such issues should be reported as markers or global errors
                        console.log("found a :", issueType);
                        return;
                    }
                    issueCount++;
                    var fullError = match[0];
                    var filePath = match[1];
                    var row = match[2];
                    var column = match[3];
                    var issueType = match[4];
                    var issueMsg = match[5];

                    markers.push({
                        pos: {
                            sl: parseInt(row, 10) - 1,
                            el: parseInt(row, 10) - 1,
                            sc: parseInt(column, 10) - 1,
                            ec: parseInt(column, 10)
                        },
                        message: issueMsg,
                        level: issueType
                    });

                    var issue = {
                        message: issueMsg,
                        type: issueType.charAt(0).toUpperCase() + issueType.slice(1),
                        pos: {
                            sl: parseInt(row, 10) - 1,
                            el: parseInt(row, 10) - 1,
                            sc: parseInt(column, 10) - 1,
                            ec: parseInt(column, 10)
                        }
                    };
                    // push issue to issues array
                    issues.push(issue);
                });

                var data = {
                    issues: issues,
                    issueCount: issueCount,
                    tool: "clang"
                };
                emitter.emit("drawIssues", data);

                // --------------------------------------------------------------------
                // finished executing clang
                console.log(markers);
                console.log("finished clang");

                // -------------------------------------------------
                // execute style50 only if clang returns no errors
                // -------------------------------------------------
                if (markers.length === 0) {
                    console.log("starting style50");
                    workerUtil.execAnalysis(
                        "java",
                        {
                            mode: "tempfile",
                            cwd: "/home/ubuntu/.c9/plugins/style50/server/src",
                            args: ["-classpath", "./org/antlr-4.5.3-complete.jar:.:/org/", "StyleMain", "-d", "$FILE"],
                            maxCallInterval: 1200,
                            json: true
                        },
                        function (err, stdout, stderr) {

                            if (err && err.code !== 255) {
                                console.log("error occured");
                                // TODO: maybe call clang from here and output errors?

                                workerUtil.execAnalysis(
                                    "clang",
                                    {
                                        mode: "tempfile",
                                        args: ["-fsyntax-only", "$FILE"],
                                        maxCallInterval: 1200,
                                        json: true
                                    },
                                    function (err, stdout, stderr) {
                                        if (err && err.code !== 255) {
                                            return callback(err);
                                        }
                                        console.log(stdout + sterr);
                                        return callback(err);
                                    }
                                        );

                                return callback(err);
                            }

                            var styleErrors = stdout;

                            console.log("here comes the output");
                            console.log(styleErrors);


                            // go through all style errors for all files
                            for (var fileName in styleErrors) {
                                for (var i in styleErrors[fileName]) {

                                    if (!styleErrors[fileName][i]._col && !styleErrors[fileName][i]._line) {
                                        // push global issues to array
                                        var type = styleErrors[fileName][i]._level.toLowerCase();
                                        type = type.charAt(0).toUpperCase() + type.slice(1)
                                        var issue = {
                                            message: styleErrors[fileName][i]._message,
                                            type: type
                                        };
                                        issues.push(issue);
                                        continue;
                                    }


                                    // prepare marker array
                                    var nameLength = (styleErrors[fileName][i].name === undefined || styleErrors[fileName][i].name == null) ? 0 : styleErrors[fileName][i].name.length;
                                    var marker = {
                                        pos: {
                                            sl: styleErrors[fileName][i]._line - 1,
                                            el: styleErrors[fileName][i]._line - 1,
                                            sc: styleErrors[fileName][i]._col,
                                            ec: styleErrors[fileName][i]._col +
                                                (styleErrors[fileName][i]._amt || nameLength)
                                        },
                                        message: styleErrors[fileName][i]._message,
                                        type: styleErrors[fileName][i]._level.toLowerCase()
                                    }
                                    // push marker to marker array if marker exists
                                    markers.push(marker);

                                    // -------------------------------------------------
                                    // prepare issue object
                                    // -------------------------------------------------
                                    var type = styleErrors[fileName][i]._level.toLowerCase();
                                    type = type.charAt(0).toUpperCase() + type.slice(1);
                                    var issue = {
                                        message: styleErrors[fileName][i]._message,
                                        type: type,
                                        pos: {
                                            sl: styleErrors[fileName][i]._line - 1,
                                            el: styleErrors[fileName][i]._line - 1,
                                            sc: styleErrors[fileName][i]._col,
                                            ec: styleErrors[fileName][i]._col +
                                                (styleErrors[fileName][i]._amt || nameLength)
                                        }
                                    };
                                    // push issue to issues array
                                    issues.push(issue);
                                }
                            }


                            // send issues to style50-pane
                            issueCount = styleErrors[fileName].length;
                            emitter.emit("drawIssues",
                                            data = {
                                                issues: issues,
                                                issueCount: issueCount,
                                                tool: "style50"
                                            }
                            );
                        }
                    );
                }
                // --------------------------------------------------------------------
                // finished executing style50
                console.log("finished style50");
                callback(null, markers);
            }
        );
    };
});
