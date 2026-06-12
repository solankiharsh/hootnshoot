'use strict';

const fs = require('node:fs');

const [, , event, level, message, extraJson] = process.argv;
if (!event || !level || !message) {
  console.error(
    'usage: node container-supervisor-log.cjs <event> <level> <message> [extra-json]'
  );
  process.exit(2);
}

let extra = {};
if (extraJson) {
  try {
    extra = JSON.parse(extraJson);
  } catch {
    extra = { extra_parse_error: true };
  }
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8').trim();
  } catch {
    return '';
  }
}

const cgroupRaw = {
  cgroup_memory_max_bytes: readFileSafe('/sys/fs/cgroup/memory.max'),
  cgroup_memory_current_bytes: readFileSafe('/sys/fs/cgroup/memory.current'),
  cgroup_memory_events: readFileSafe('/sys/fs/cgroup/memory.events'),
  cgroup_memory_high_bytes: readFileSafe('/sys/fs/cgroup/memory.high'),
};

const cgroup = Object.fromEntries(
  Object.entries(cgroupRaw).filter(([, v]) => v.length > 0)
);

const record = {
  timestamp: new Date().toISOString(),
  level,
  message,
  event,
  service: process.env.DD_SERVICE || 'hootnshoot',
  component: 'container-supervisor',
  'dd.service': process.env.DD_SERVICE || 'hootnshoot',
  'dd.source': 'container',
  'dd.env': process.env.DD_ENV || process.env.NODE_ENV || 'production',
  'dd.version': process.env.DD_VERSION || process.env.NEXT_PUBLIC_VERSION,
  ...cgroup,
  ...extra,
};

console.log(JSON.stringify(record));
