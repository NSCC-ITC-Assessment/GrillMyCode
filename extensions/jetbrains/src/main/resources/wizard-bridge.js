// The Workflow Wizard's page, before the Wizard: its line to the plugin.
//
// The Wizard's bundle is the VS Code extension's, and its line to the editor
// (extensions/vscode/src/webview/host.js) makes one call of VS Code:
// acquireVsCodeApi().postMessage(message), with answers arriving as `message`
// events on the window. This gives it the same, over JCEF: a message goes to
// the plugin as JSON through a JBCefJSQuery, and the plugin's answers come back
// through window.gmcReceive.
//
// The plugin writes this into the page with the placeholder in send() replaced
// by the call its JBCefJSQuery makes of `request`.

(function () {
  function send(request) {
    SEND_REQUEST;
  }
  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (message) {
        send(JSON.stringify(message));
      },
    };
  };
  window.gmcReceive = function (data) {
    window.dispatchEvent(new MessageEvent('message', { data: data }));
  };
})();
