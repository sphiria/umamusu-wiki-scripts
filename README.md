# Usage
You need to have `node` installed in your system (v15 at the time of writing).  
After installing the dependencies, you will need to:  
1. Put the bot credentials and wiki api host URL in [`.env`][.env.sample] file
2. Copy or symlink `master.mdb` in the project root (or specify with `--file` flag)
3. Run the `index.js` script:

```sh
$ npm install
added 206 packages, and audited 207 packages in 31s

21 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

```sh
$ echo WIKI_USERNAME=MyBotUsername > .env
$ echo WIKI_PASSWORD=MyBotPassword >> .env
$ echo WIKI_API_HOST=http://example.com/api.php >> .env
```

```sh
$ ./index.js

Usage: index.js <command> [options]

Commands:
  index.js character <id|all>                                       [aliases: c]
  index.js characterbio <id|all>                                   [aliases: cb]

Options:
      --version  Show version number                                   [boolean]
      --dry-run  Run without doing any updates        [boolean] [default: false]
  -f, --file     Path to master.mdb file        [string] [default: "master.mdb"]
  -q, --quiet    Sets log level to error              [boolean] [default: false]
  -v, --verbose  Sets log level to verbose            [boolean] [default: false]
      --debug    Sets log level to debug              [boolean] [default: false]
      --help     Show help                                             [boolean]

Examples:
  index.js character 1006   – Reads character id 1006 and syncs its wiki page
  index.js character all    – Synchronizes all character pages

```

```sh
$ ./index.js characterbio 1006 --verbose --dry-run

 => Initializing sqlitedb client…
 => Initializing wiki client…
 get_API_parameters: Set enwiki: path=query+siteinfo
 get_API_parameters: Set enwiki: path=query+siteinfo
 => Fetching id:page map from cargotable…
 => Talking to cargo…
 ==> Synchronizing character id 1006…
 ===> Found page "Oguri Cap" for id "1006"
 {{CharacterBiography
 |id=1006
 |name=Oguri Cap
…
 |ui_nameplate_color_2=87B7F8
 }}
 ===> Dry-run mode; skipping edit!
```

[.env.sample]: https://github.com/FabulousCupcake/umamusume-wiki-scripts/blob/master/.env.sample
