#!/usr/bin/env node
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const logger = require("./src/logger");

// Load envvars from .env file
require("dotenv").config();

// Define CLI command
yargs(hideBin(process.argv))
  .middleware(logger.autoSetLevel)
  .usage("Usage: $0 <command> [options]")
  .commandDir("cmd")
  .option("dry-run", {
    default: false,
    describe: "Run without doing any updates",
    type: "boolean",
  })
  .option("file", {
    alias: "f",
    default: "master.mdb",
    describe: "Path to master.mdb file",
    type: "string",
  })
  .option("quiet", {
    alias: "q",
    default: false,
    type: "boolean",
    description: "Sets log level to error"
  })
  .option("verbose", {
    alias: "v",
    default: false,
    type: "boolean",
    description: "Sets log level to verbose"
  })
  .option("debug", {
    default: false,
    type: "boolean",
    description: "Sets log level to debug"
  })
  .example(`$0 character 1006   – Reads character id 1006 and syncs its wiki page`)
  .example(`$0 character all    – Synchronizes all character pages`)
  .demandCommand(1, "")
  .help()
  .argv
;
