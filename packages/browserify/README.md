# LavaMoat Browserify - a Browserify Plugin for creating LavaMoat-protected builds

> **Warning** experimental, under development, has not been audited, etc**

`lavamoat-browserify` is a [browserify][BrowserifyGithub]
plugin for generating app bundles protected by
[LavaMoat](https://github.com/LavaMoat/overview), where modules
are defined in [SES][SesGithub] containers. It aims to reduce
the risk of malicious code in the app dependency graph, known
as "software supplychain attacks".

> For an overview of LavaMoat tools see [the main README](https://github.com/LavaMoat/LavaMoat/tree/main/README.md).


[BrowserifyGithub]: https://github.com/browserify/browserify
[SesGithub]: https://github.com/agoric/SES

## Anatomy of a LavaMoat bundle

The `lavamoat-browserify` plugin replaces the last internal build step of the browserify [compiler pipeline](https://github.com/browserify/browserify-handbook#compiler-pipeline). This step takes all the modules and their metadata and outputs the final bundle content, including the LavaMoat kernel. It also generates the LavaMoat policy file.

LavaMoat builds differ from standard browserify builds in that they:

1. Uses `lockdown()` from [SES][SesGithub] to prevent tampering with the execution environment.
   Thanks to lockdown, prototype-pollution attacks are neutralized. It's also a prerequisite to code isolation. 
2. Uses SES Compartments to isolate each package's execution.
   Packages don't share references to anything unless explicitly passed in or allowed by policy. Custom LavaMoat kernel handles the `require()` calls in the resulting bundle. When required, a module is initialized, usually by evaluation inside a SES container.
3. Enforces the app-specified LavaMoat policy.
   The policy specifies what execution environment each package should run with, which means: what global/builtin APIs should it be exposed to, and what other packages can it require/import.

The result is a bundle that should work just as before, but provides some protection against supplychain attacks.

## Example

Create a file, `index.js` with some requires.

```
const foo = require('./foo.js');
const gamma = require('gamma');

const elem = document.getElementById('result');
const x = foo(100);
elem.textContent = x;
```

Now use the browserify command with lavamoat as a plugin to build a lavamoat-protected bundle starting at `index.js`:

```
$ browserify index.js --plugin [ lavamoat-browserify --autopolicy ]
```

All of the modules that `index.js` needs are included in the `bundle.js` as strings to be evaluated inside SES containers. A lavamoat policy object is generated from a recursive walk of the require() graph and injected into the bundle (via --autopolicy), which is also written to disk at `./lavamoat/browserify/policy.json`. Commit this policy file and regenerate it when your dependencies change and you agree with them. 

> **Note** You should review the diff in regenerated policy for suspicious changes, e.g. a simple maths package getting access to `fetch` or `document` 

> **Warning** Do not edit the autogenerated `policy.json` directly. It will be overwritten if a new bundle is created using LavaMoat. Instead, edit the `policy-override.json`.
>  
> See [Policy file explained](https://github.com/LavaMoat/LavaMoat/tree/main/docs/policy.md) for details on the policy file definition.

To use this bundle, just toss a <script src="bundle.js"></script> into your html, as per the official [browserify][BrowserifyGithub] documentation.

*Be sure to use the same Browserify configuration (eg. plugins and transforms like babelify) that you normally use, so that it can parse the code as it will appear in your final bundle.*

## Install

*Before you use lavamoat runtime protections, make sure you've set up allow-scripts and install dependencies using that setup.*

Use one of:
```
yarn add -D browserify lavamoat-browserify
npm i -D browserify lavamoat-browserify
npm i --ignore-scripts -g browserify lavamoat-browserify
```

## Usage

```
Usage: browserify [entry files] {BROWSERIFY OPTIONS} --plugin [ lavamoat-browserify {OPTIONS} ]

Options:

 --autopolicy, -a  Generate a `policy.json` and `policy-override.json` in the current
                   working directory. Overwrites any existing policy files. The override policy is for making manual policy changes and always takes precedence over the automatically generated policy.

     --policy, -p  Pass in policy. Accepts a policy object {} or a filepath string to the existing
                   policy. When used in conjunction with --autopolicy, specifies where to write the policy. Default: ./lavamoat/browserify/policy.json

   --override, -o  Pass in override policy. Accepts a policy object {} or a filepath string to the
                   existing override policy. Default: ./lavamoat/browserify/policy-override.json

Advanced Options:

    --prelude, -pr  Omit the lavamoat prelude from the bundle.

--prunepolicy, -pp Remove redundant package entries from the policy.

--debugpolicy, -dp Generate a `policy-debug.json` in the current working directory. Used for the
                   lavamoat visualisation tool.

      --debug, -d  Turn on extra logging for debugging.

       --help, -h  Show this message
```

## More Examples

### Run with Policy

This uses the existing policy files to generate a bundle.

```bash
$ browserify index.js --plugin [ lavamoat-browserify ]
```

Automatically searches for policy files inside `./lavamoat/browserify/`.

### Policy Override with Relative Path

This uses the override policy specified at `./policies/policy-override.json` to generate a new bundle.

```
$ browserify index.js --plugin [ lavamoat-browserify --override './policies/policy-override.json' ]
```

### browserify API

Create a browserify bundle with LavaMoat directly from the API and write it to `bundle.js`.

```javascript
const browserify = require('browserify')
const fs = require('fs')

const lavamoatOpts = {
  policy: '../../policy.json',
  override: '../../policy-override.json',
  writeAutoPolicyDebug: true,
  prunePolicy: true
}

const bundler = browserify(['./index.js'], {
  plugin: [
    ['lavamoat-browserify', lavamoatOpts]
  ]
})

bundler.bundle().pipe(fs.createWriteStream('./bundle.js'))
```

### Policy Formats

Policy as an `object`

```javascript
const lavamoatOpts = {
    policy: {
        resources: {
             'dependency-name': {
                 packages: {
                     react: true
                }
            }
        }
    }
}
```

Policy as a `function`, must return a file path or an `object`:

```javascript
const lavamoatOpts = {
    policy: () => "./lavamoat/policy.json"
}
```

OR

```javascript
const policyObject = {
    resources: {
        'dependency-name': {
            packages: {
                react: true
            }
        }
    }
}
const lavamoatOpts = {
    policy: () => policyObject
}
```

See [lavamoat-browserify examples](./examples/) for more usage examples.

See [Policy file explained](https://github.com/LavaMoat/LavaMoat/tree/main/docs/policy.md) for details on the policy file definition.

