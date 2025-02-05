import { readFile } from 'fs';
import { createServer } from 'https';
import { createServer as createServer$1 } from 'http';
import { resolve } from 'path';
import mime from 'mime';
import opener from 'opener';

var server;

/**
 * Serve your rolled up bundle like webpack-dev-server
 * @param {ServeOptions|string|string[]} options
 */
function serve (options) {
  if ( options === void 0 ) options = { contentBase: '' };

  if (Array.isArray(options) || typeof options === 'string') {
    options = { contentBase: options };
  }
  options.contentBase = Array.isArray(options.contentBase) ? options.contentBase : [options.contentBase];
  options.host = options.host || 'localhost';
  options.port = options.port || 10001;
  options.headers = options.headers || {};
  options.https = options.https || false;
  options.openPage = options.openPage || '';
  mime.default_type = 'text/plain';

  var requestListener = function (request, response) {
    // Remove querystring
    var urlPath = decodeURI(request.url.split('?')[0]);

    Object.keys(options.headers).forEach(function (key) {
      response.setHeader(key, options.headers[key]);
    });

    // Get range request header, For example: `range: bytes=0-5``
    var range = request.headers['range'];
    var rangeSta = 0;
    var rangeEnd = 0;
    if (range) {
      var ref = range.match(/(\d*)-(\d*)/);
      var start = ref[1];
      var end = ref[2];
      rangeSta = +start || 0;
      rangeEnd = +end || 0;
    }

    readFileFromContentBase(options.contentBase, urlPath, function (error, content, filePath) {
      if (!error) {
        return found(response, filePath, content, rangeSta, rangeEnd)
      }
      if (error.code !== 'ENOENT') {
        response.writeHead(500);
        response.end('500 Internal Server Error' +
          '\n\n' + filePath +
          '\n\n' + Object.values(error).join('\n') +
          '\n\n(rollup-plugin-serve)', 'utf-8');
        return
      }
      if (options.historyApiFallback) {
        var fallbackPath = typeof options.historyApiFallback === 'string' ? options.historyApiFallback : '/index.html';
        readFileFromContentBase(options.contentBase, fallbackPath, function (error, content, filePath) {
          if (error) {
            notFound(response, filePath);
          } else {
            found(response, filePath, content, rangeSta, rangeEnd);
          }
        });
      } else {
        notFound(response, filePath);
      }
    });
  };

  // release previous server instance if rollup is reloading configuration in watch mode
  if (server) {
    server.close();
  }

  // If HTTPS options are available, create an HTTPS server
  if (options.https) {
    server = createServer(options.https, requestListener).listen(options.port, options.host);
  } else {
    server = createServer$1(requestListener).listen(options.port, options.host);
  }

  closeServerOnTermination(server);

  var running = options.verbose === false;

  return {
    name: 'serve',
    generateBundle: function generateBundle () {
      if (!running) {
        running = true;

        // Log which url to visit
        var url = (options.https ? 'https' : 'http') + '://' + options.host + ':' + options.port;
        options.contentBase.forEach(function (base) {
          console.log(green(url) + ' -> ' + resolve(base));
        });

        // Open browser
        if (options.open) {
          opener(url + options.openPage);
        }
      }
    }
  }
}

function readFileFromContentBase (contentBase, urlPath, callback) {
  var filePath = resolve(contentBase[0] || '.', '.' + urlPath);

  // Load index.html in directories
  if (urlPath.endsWith('/')) {
    filePath = resolve(filePath, 'index.html');
  }

  readFile(filePath, function (error, content) {
    if (error && contentBase.length > 1) {
      // Try to read from next contentBase
      readFileFromContentBase(contentBase.slice(1), urlPath, callback);
    } else {
      // We know enough
      callback(error, content, filePath);
    }
  });
}

function notFound (response, filePath) {
  response.writeHead(404);
  response.end('404 Not Found' +
    '\n\n' + filePath +
    '\n\n(rollup-plugin-serve)', 'utf-8');
}

function found (response, filePath, content, rangeSta, rangeEnd) {
  var headers = {
    'Content-Type': mime.getType(filePath)
  };
  var statusCode = 200;
  if (rangeSta !== 0 || rangeEnd !== 0) {
    statusCode = 206;
    var len = content.length;
    var maxEnd = len - 1;
    if (rangeEnd === 0) {
      rangeEnd = maxEnd;
    }
    rangeEnd = Math.min(maxEnd, rangeEnd);
    content = content.slice(rangeSta, rangeEnd);
    headers['Accept-Ranges'] = 'bytes';
    headers['Content-Range'] = "bytes " + rangeSta + "-" + rangeEnd + "/" + len;
  }
  headers['Content-Length'] = content.length;
  response.writeHead(statusCode, headers);
  response.end(content, 'utf-8');
}

function green (text) {
  return '\u001b[1m\u001b[32m' + text + '\u001b[39m\u001b[22m'
}

function closeServerOnTermination (server) {
  var terminationSignals = ['SIGINT', 'SIGTERM'];
  terminationSignals.forEach(function (signal) {
    process.on(signal, function () {
      server.close();
      process.exit();
    });
  });
}

/**
 * @typedef {Object} ServeOptions
 * @property {boolean} [open=false] Launch in browser (default: `false`)
 * @property {string} [openPage=''] Page to navigate to when opening the browser. Will not do anything if `open` is `false`. Remember to start with a slash e.g. `'/different/page'`
 * @property {boolean} [verbose=true] Show server address in console (default: `true`)
 * @property {string|string[]} [contentBase=''] Folder(s) to serve files from
 * @property {string|boolean} [historyApiFallback] Path to fallback page. Set to `true` to return index.html (200) instead of error page (404)
 * @property {string} [host='localhost'] Server host (default: `'localhost'`)
 * @property {number} [port=10001] Server port (default: `10001`)
 * @property {ServeOptionsHttps} [https=false] By default server will be served over HTTP (https: `false`). It can optionally be served over HTTPS
 * @property {{[header:string]: string}} [headers] Set headers
 */

/**
 * @typedef {Object} ServeOptionsHttps
 * @property {string|Buffer|Buffer[]|Object[]} key
 * @property {string|Buffer|Array<string|Buffer>} cert
 * @property {string|Buffer|Array<string|Buffer>} ca
 * @see https.ServerOptions
 */

export default serve;
