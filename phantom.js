// Generated by CoffeeScript 1.7.1
(function() {
  var dnode, http, onSignal, phanta, shoe, spawn, startPhantomProcess, wrap,
    __slice = [].slice;

  dnode = require('dnode');

  http = require('http');

  shoe = require('shoe');

  spawn = require('win-spawn');

  phanta = [];

  startPhantomProcess = function(binary, port, hostname, args) {
    return spawn(binary, args.concat([__dirname + '/shim.js', port, hostname]));
  };

  onSignal = function() {
    var phantom, _i, _len;
    for (_i = 0, _len = phanta.length; _i < _len; _i++) {
      phantom = phanta[_i];
      phantom.exit();
    }
    return process.exit();
  };

  process.on('exit', function() {
    var phantom, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = phanta.length; _i < _len; _i++) {
      phantom = phanta[_i];
      _results.push(phantom.exit());
    }
    return _results;
  });

  process.on('SIGINT', onSignal);

  process.on('SIGTERM', onSignal);

  wrap = function(ph) {
    ph.callback = function(fn) {
      return '__phantomCallback__' + fn.toString();
    };
    ph._createPage = ph.createPage;
    return ph.createPage = function(cb) {
      return ph._createPage(function(page) {
        page._evaluate = page.evaluate;
        page.evaluate = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          return page._evaluate.apply(page, [fn.toString(), cb].concat(args));
        };
        page._onResourceRequested = page.onResourceRequested;
        page.onResourceRequested = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          return page._onResourceRequested.apply(page, [fn.toString(), cb].concat(args));
        };
        return cb(page);
      });
    };
  };

  module.exports = {
    create: function() {
      var arg, args, cb, httpServer, key, options, phantom, ps, sock, value, _i, _len, _ref;
      args = [];
      options = {};
      for (_i = 0, _len = arguments.length; _i < _len; _i++) {
        arg = arguments[_i];
        switch (typeof arg) {
          case 'function':
            cb = arg;
            break;
          case 'string':
            args.push(arg);
            break;
          case 'object':
            options = arg;
        }
      }
      if (typeof options.parameters === 'object') {
        _ref = options.parameters;
        for (key in _ref) {
          value = _ref[key];
          args.push('--' + key + '=' + value);
        }
      }
      if (options.path == null) {
        options.path = '';
      }
      if (options.binary == null) {
        options.binary = options.path + 'phantomjs';
      }
      if (options.port == null) {
        options.port = 0;
      }
      if (options.hostname == null) {
        options.hostname = 'localhost';
      }
      if (options.dnodeOpts == null) {
        options.dnodeOpts = {};
      }
      ps = null;
      phantom = null;
      httpServer = http.createServer();
      httpServer.listen(options.port, options.hostname);
      httpServer.on("error", function(err) {
        if (cb != null) {
          return cb(null, err);
        } else {
          throw err;
        }
      });
      httpServer.on('listening', function() {
        var hostname, port;
        port = httpServer.address().port;
        hostname = httpServer.address().address;
        ps = startPhantomProcess(options.binary, port, hostname, args);
        ps.stdout.on('data', options.onStdout || function(data) {
          return console.log("phantom stdout: " + data);
        });
        ps.stderr.on('data', options.onStderr || function(data) {
          return module.exports.stderrHandler(data.toString('utf8'));
        });
        ps.on('error', function(err) {
          httpServer.close();
          if ((err != null ? err.code : void 0) === 'ENOENT') {
            console.error("phantomjs-node: You don't have 'phantomjs' installed");
          }
          if (cb != null) {
            return cb(null, err);
          } else {
            throw err;
          }
        });
        return ps.on('exit', function(code, signal) {
          var p;
          httpServer.close();
          if (ps.phantom) {
            if (typeof ps.phantom.onExit === "function") {
              ps.phantom.onExit();
            }
            phanta = (function() {
              var _j, _len1, _results;
              _results = [];
              for (_j = 0, _len1 = phanta.length; _j < _len1; _j++) {
                p = phanta[_j];
                if (p !== ps.phantom) {
                  _results.push(p);
                } else {
                 //ps.phantom.exit();
                }
              }
              return _results;
            })();
          } else {
            console.log('WARNING! No phantom found on the PS object, memory leak imminent...');
          }
          if (options.onExit) {
            return options.onExit(code, signal);
          } else {
            console.assert(signal == null, "signal killed phantomjs: " + signal);
            return console.assert(code === 0, "abnormal phantomjs exit code: " + code);
          }
        });
      });
      sock = shoe(function(stream) {
        var d;
        d = dnode({}, options.dnodeOpts);
        d.on('remote', function(phantom) {
          wrap(phantom);
          phantom.process = ps;
          
          //add phantom to ps to avoid memory leakage in phanta
          ps.phantom = phantom;
          phanta.push(phantom);
          return typeof cb === "function" ? cb(phantom, null) : void 0;
        });
        d.pipe(stream);
        return stream.pipe(d);
      });
      return sock.install(httpServer, '/dnode');
    },
    stderrHandler: function(message) {
      if (message.match(/(No such method.*socketSentData)|(CoreText performance note)/)) {
        return;
      }
      return console.warn("phantom stderr: " + message);
    }
  };

}).call(this);
