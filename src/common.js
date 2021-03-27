const fetch = require('node-fetch');
const Wikiapi = require("wikiapi");
const sqlite3 = require("better-sqlite3");
const logger = require("./logger");

// cargoQuery is a wrapper for simple cargo queries
const cargoQuery = async (tables, fields) => {
  const params = new URLSearchParams();
  params.append("action", "cargoquery");
  params.append("fields", fields);
  params.append("format", "json");
  params.append("limit", "500");
  params.append("tables", tables);

  const url = `${process.env.WIKI_API_HOST}?${params.toString()}`;
  logger.verbose("=> Talking to cargo…");
  logger.debug(` > ${url}`);
  const res = await fetch(url);
  return res.json();
}


// initWikiClient returns wiki client
const initWikiClient = async () => {
  logger.verbose("=> Initializing wiki client…");
  let wiki = new Wikiapi;
  await wiki.login(
    process.env.WIKI_USERNAME,
    process.env.WIKI_PASSWORD,
    process.env.WIKI_API_HOST,
  );
  return wiki
};


// initDatabaseClient returns promisified db client
const initDatabaseClient = async (file) => {
  logger.verbose("=> Initializing sqlitedb client…");
  return new sqlite3(file, {
    fileMustExist: true,
    readonly: true,
    verbose: logger.debug,
  });
};

// export
module.exports = {
  cargoQuery,
  initWikiClient,
  initDatabaseClient,
};
