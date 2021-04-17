const { initWikiClient, initDatabaseClient } = require("../src/common");
const logger = require("../src/logger");

// Constants
const MODULE_NAME = "ObjectiveData";
const OBJECTIVE_QUERY = `
SELECT route.*, race_instance_id
FROM single_mode_route_race AS route
OUTER LEFT JOIN single_mode_program ON single_mode_program."id" = condition_id`;

// Globals
let wiki, db;
let dryRun = false;

// update pulls wiki page data and updates it
const update = async (data) => {
  logger.info(`==> Synchronizing objectives dump…`);

  const page = await wiki.page(`Module:${MODULE_NAME}`);
  const parsed = page.parse();
  const original = parsed.toString();

  // Just print result if dry-run
  if (dryRun) {
    logger.diff(original, data);
    logger.info("===> Dry-run mode; skipping edit!");
    return;
  }

  // Submit edit
  logger.info("===> Submitting changes…")
  wiki.edit(data, { bot: 1 });
  logger.info("===> … Done!")
}

// constructDump fetches the table data and structures into a dump
const constructDump = () => {
  const statement = db.prepare(OBJECTIVE_QUERY);
  let results = statement.all();

  results = results.map(res => {
    // Format data to "key = value," (including indentation)
    let objective = Object.keys(res).map(key => {
      return key = `		${key} = ${res[key] || 0},`;
    }).join("\n")

    // Encapsulate entry with brackets to form valid lua table entry
    return "	{\n" + objective + "\n	},";
  })

  // Combine whole module content
  const module = `local objectives = {
${results.join("\n")}
}

return objectives`;

  return module;
}

// handler processes the command parameters/flags and starts the update process
const handler = async (argv) => {
  db = await initDatabaseClient(argv.file);
  wiki = await initWikiClient();
  dryRun = argv.dryRun;

  update(constructDump());
}

// yargs command definition
module.exports = {
  handler,
  command: "objectives",
  aliases: "o",
  builder: {},
  desc: "",
};