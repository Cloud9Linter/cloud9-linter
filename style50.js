define(function (require, exports, module) {
    main.consumes = ["language", "Plugin", "ui", "tabManager"];
    main.provides = ["linter"];
    return main;

    function buildIssuesHTML(issues, toolName) {
        var issueList = [];
        var i = 0;
        var warningType;

        for (i = 0; i < issues.length; i++) {
            warningType = issues[i].type === "Warning" ? "style50-warning" : "style50-error";
            issueList.push("<li><span class='style50-title'>" + toolName + "</span><span class='" +
                warningType + "'>" + issues[i].type + "</span> " + issues[i].message + "</li>");
        }
        return issueList;
    }

    function buildStatusHTML(issueCount, toolName) {
        var issueText = issueCount === 1 ? "Issue" : "Issues";
        var statusHTML;

        if (issueCount === 0) {
            statusHTML = "<span class='style50-no-issue'>" + toolName + ": No Issues :)</span>";
        } else {
            statusHTML = "<span class='style50-issue'>" + toolName +
                                     ": " + issueCount + " " + issueText + " :(</span>";
        }
        return statusHTML;
    }

    function drawStatus(titleNode, statusMsg) {
        titleNode[0].innerHTML = statusMsg;
    }

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("style50.org", main.consumes);
        var language = imports.language;
        var ui = imports.ui;
        var tabManager = imports.tabManager;

        // -------------------------------------------------
        // LOAD & HANDLE PLUGIN
        // -------------------------------------------------
        plugin.on("load", function (e) {
            // add detailed style50-pane to bottom of editor
            var aceScroller = document.getElementsByClassName("ace_scroller")[0];
            ui.insertHtml(aceScroller, require("text!./style50-pane.html"), plugin);
            // add style50 status to bar-status
            var barStatus = document.getElementsByClassName("bar-status")[0];
            var titleNode = ui.insertHtml(barStatus, require("text!./style50-status.html"), plugin);

            var paneContent = document.getElementsByClassName("style50-pane-content")[0];
            var style50Label = document.getElementsByClassName("style50-label")[0];
            // add CSS for style50
            ui.insertCss(require("text!./style50.css"), options.staticPrefix, plugin);

            // remove the style-50 pane when changing to a new tab
            tabManager.on("tabBeforeActivate", function (event) {
                paneContent.innerHTML = "";
                style50Label.innerHTML = "";
            });

            // -------------------------------------------------
            // REGISTER LANGUAGE HANDLER
            // -------------------------------------------------
            language.registerLanguageHandler("plugins/style50/worker/style50_handler", function (err, handler) {
                // handle errors
                if (err) {
                    return console.error(err);
                }

                // -------------------------------------------------
                // draw style50 issues on editor
                // -------------------------------------------------
                handler.on("drawIssues", function (data) {
                    var issues = data.issues;
                    var toolName = data.tool;
                    var issuesHTML = buildIssuesHTML(issues, toolName);
                    var issueCount = data.issueCount;

                    // hack to remove all issues when handler runs again (for some reason it runs twice)
                    paneContent.innerHTML = "";

                    // draw issue details
                    issuesHTML.forEach(function (issueHTML) {
                        ui.insertHtml(paneContent, issueHTML, plugin);
                    });

                    var statusMsg = buildStatusHTML(issueCount, toolName);
                    drawStatus(titleNode, statusMsg);
                });
            }, plugin);
        });

        // -------------------------------------------------
        // REGISTER CLOUD9 PLUGIN
        // -------------------------------------------------
        register("", {
            linter: plugin
        });
    }
});
