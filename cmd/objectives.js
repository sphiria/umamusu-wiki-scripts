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
  const results = statement.all();
  const dumpData = [];

  for (let i = 0; i < results.length; i++) {
    let dumpEntry = `	{
		id = ${results[i].id},
		race_set_id = ${results[i].race_set_id},
		target_type = ${results[i].target_type},
		sort_id = ${results[i].sort_id},
		turn = ${results[i].turn},
		race_type = ${results[i].race_type},
		condition_type = ${results[i].condition_type},
		condition_id = ${results[i].condition_id},
		condition_value_1 = ${results[i].condition_value_1},
		condition_value_2 = ${results[i].condition_value_2},
		determine_race = ${results[i].determine_race},
		determine_race_flag = ${results[i].determine_race_flag},
		race_instance_id = ${results[i].race_instance_id || 0},
	},`;


    dumpData.push(dumpEntry);
  }

  const dumpModule = `local objectives = {
${dumpData.join("\n")}
}

return objectives
`;

  return dumpModule;
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