const chalk = require("chalk");
const Diff = require("diff");

const LOG_LEVEL = {
  DEBUG: 0,
  VERBOSE: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  CRITICAL: 5,
}

// ACTUAL_LOG_LEVEL defaults to log level info
let ACTUAL_LOG_LEVEL = LOG_LEVEL.INFO;

// diff prints diff output
const diff = (before, after) => {
  const d = Diff.diffLines(before, after);

  // No difference, print only if debug level
  if (d.length === 1) {
    if (ACTUAL_LOG_LEVEL > LOG_LEVEL.DEBUG) return;
  }

  d.forEach((part) => {
    const color = part.added ? chalk.green :
                  part.removed ? chalk.red : chalk;
    process.stderr.write(color(part.value));
  });
  console.log("");
}

// debug prints debug level message
// This should be used for things like dumping objects the script works with
// that would otherwise make the output too dirty
const debug = (...args) => {
  if (ACTUAL_LOG_LEVEL > LOG_LEVEL.DEBUG) return;
  if (typeof args[0] === "object") { console.log(args); return; }
  console.log(chalk.dim(...args));
}

// verbose prints verbose level message
// This should be used to tell more about what the script is doing but would
// otherwise make the output too dirty
const verbose = (...args) => {
  if (ACTUAL_LOG_LEVEL > LOG_LEVEL.VERBOSE) return;
  console.log(...args);
}

// info prints info level message
// This should be used to indicate what the script is currently doing
const info = (...args) => {
  if (ACTUAL_LOG_LEVEL > LOG_LEVEL.INFO) return;
  console.log(chalk.blue(...args));
}

// warn prints warn level message
// This should be used to indicate that something non-standard occurred
const warn = (...args) => {
  if (ACTUAL_LOG_LEVEL > LOG_LEVEL.WARN) return;
  console.log(chalk.yellow(...args));
}

// error prints error level message
// This is used when the script cannot finish the task it is supposed to perform
const error = (...args) => {
  if (ACTUAL_LOG_LEVEL > LOG_LEVEL.ERROR) return;
  console.log(chalk.red(...args));
}

// critical prints critical level message
// This should be used when not only that the script failed, but something worse
// might have occurred, and the user should check things thoroughly.
const critical = (args) => {
  if (ACTUAL_LOG_LEVEL > LOG_LEVEL.CRITICAL) return;
  console.log(chalk.red.bold.inverse(` ${args} `));
}

// setLevel sets the log level
const setLevel = level => {
  ACTUAL_LOG_LEVEL = level;
}

// getLevel sets the log level
const getLevel = () => {
  return ACTUAL_LOG_LEVEL;
}

// autoSetLevel is a wrapper around setLevel
// that takes argv from yargs and determines the proper log level from the set flags
const autoSetLevel = argv => {
  if (argv.quiet) setLevel(LOG_LEVEL.ERROR);
  if (argv.verbose) setLevel(LOG_LEVEL.VERBOSE);
  if (argv.debug) setLevel(LOG_LEVEL.DEBUG);
}

// export
module.exports = {
  diff,
  debug,
  verbose,
  info,
  warn,
  error,
  critical,
  setLevel,
  getLevel,
  autoSetLevel,
  LOG_LEVEL,
};
