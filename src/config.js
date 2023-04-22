const os = require('os');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage')

const layers = [
  'forest',
  'shrub',
  'grass',
  'crop',
  'built',
  'bare',
  'snow',
  'water',
  'wetland',
  'mangroves',
  'moss',
];

const optionDefinitions = [
  {
    name: 'layers',
    description: `Comma-separated list of layers to include in the output. Available values are: ${layers.join(',')}.\nDefaults to all.`,
    type: (input) => {
      const parsedLayers = input.replace(/\s+/g, '').split(',');
      parsedLayers.forEach((layer) => {
        if (!layers.includes(layer)) {
          console.error(`Invalid layer: "${layer}". Must be at least one of: ${layers.join(', ')}`);
          process.exit(1);
        }
      });
      return parsedLayers.map((l) => l.toLowerCase());
    },
    defaultValue: layers,
  },
  {
    name: 'threshold',
    alias: 't',
    description: 'Threshold used for GDAL sieve operation (in pixels)',
    type: Number,
    defaultValue: 2048,
  },
  {
    name: 'simplify',
    alias: 's',
    description: 'Polygon simplification tolerance (in degrees)',
    type: Number,
    defaultValue: 0.01,
  },
  {
    name: 'parallel',
    alias: 'p',
    type: Number,
    description: 'Number of worker processes to run. Defaults to #CPUs / 2.',
    defaultValue: Math.floor(os.cpus().length / 2),
  },
  {
    name: 'verbose',
    alias: 'v',
    type: Boolean,
    description: 'More detailed logging.',
    defaultValue: true,
  },
  {
    name: 'debug',
    type: Boolean,
    description: 'Enable debug logging',
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display the usage guide.',
    defaultValue: false,
  },
]

const options = commandLineArgs(optionDefinitions);

if (options.help) {
  const usage = commandLineUsage([
    {
      header: 'Options',
      optionList: optionDefinitions,
    },
  ]);
  console.log(usage);
  process.exit(0);
}

module.exports = options;
