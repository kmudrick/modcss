var parse = require('css-parse'),
    stylus = require('stylus'),
    nib = require('nib'),
    toCamelCase = require('to-camel-case'),
    through = require('through')

var isCSS  = /\.(csso|css|styl|sass|scss|less)$/
var isStyl = /\.styl$/

function parseCSS (chunksReceivedFromStream, failCB) {
  var tree,
      modExports = {}

  try {
    tree = parse(chunksReceivedFromStream)
  }

  catch (err) {
    failCB.call(this, err)
  }

  tree.stylesheet.rules.forEach(function eachRule (rule) {
    if (rule.type !== 'rule') return

    rule.selectors.forEach(function eachSelector (selector) {
      var styles = modExports[selector] = modExports[selector] || {}

      rule.declarations.forEach(function eachDeclaration (declaration) {
        if (declaration.type !== 'declaration') return

        // camelize the css property for use in React al
        styles[toCamelCase(declaration.property)] = declaration.value
      })
    })
  })

  // Turn JSON into a JavaScript CommonJS file
  this.queue('module.exports = ' + JSON.stringify(modExports))
  this.queue(null)
}

function compileStyl (stylusString, pathToStylusFile) {
  return stylus(stylusString)
    .set('filename', pathToStylusFile)
    .set('compress', true)
    .use(nib())
}

function processCSS (filename, failCB) {
  var chunksReceivedFromStream = ''

  return through(
    function receiveChunkFromStream (chunk) {
      chunksReceivedFromStream += chunk
    },

    function doneReceivingChunksFromStream () {
      if (isStyl.exec(filename)) {
        var styl = compileStyl(chunksReceivedFromStream, filename)
        return parseCSS.call(this, styl.render(), failCB)
      } else
        return parseCSS.call(this, chunksReceivedFromStream, failCB)
    })
}

module.exports = function (filename) {

  // We're a passthrough stream if the file's not a match for `isCSS`
  if (!isCSS.exec(filename)) return through()

  return processCSS(filename, function (err) {
    return this.emit('error', new Error('error parsing ' + filename + ': ' + err))
  })
}
