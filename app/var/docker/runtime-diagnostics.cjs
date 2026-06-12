#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const [service = 'unknown', entryFile] = process.argv.slice(2);
const cwd = process.cwd();
const distDir = path.join(cwd, 'dist');

process.env.TS_NODE_PROJECT ||= path.resolve(cwd, '../../tsconfig.base.json');
process.env.TS_NODE_BASEURL ||= distDir;

const prefix = `[runtime-diagnostics:${service}]`;
let failed = false;

const redactString = (value) =>
  value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, '[REDACTED]')
    .replace(/\b(sk|pk|ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{12,}\b/g, '[REDACTED]');

const errorFields = (error) => ({
  'error.kind': error?.name || 'Error',
  'error.message': redactString(error?.message || String(error)),
  'error.stack_top': error?.stack
    ? redactString(error.stack.split('\n').slice(0, 2).join('\n'))
    : undefined,
});

const structuredLog = (level, message, context = {}) => {
  const env = process.env.DD_ENV || process.env.NODE_ENV || 'production';
  const version = process.env.DD_VERSION || process.env.NEXT_PUBLIC_VERSION;
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    event: context.event,
    service,
    component: 'runtime-diagnostics',
    env,
    version,
    tags: [`service:${service}`, `env:${env}`, ...(version ? [`version:${version}`] : [])],
    'dd.service': service,
    'dd.source': 'nodejs',
    'dd.env': env,
    'dd.version': version,
    ...context,
  };
  const output = JSON.stringify(
    Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined)
    )
  );

  if (level === 'error' || level === 'fatal') {
    console.error(output);
    return;
  }

  console.log(output);
};

const formatResult = (result) => {
  if (!result) {
    return '';
  }

  if (typeof result === 'object') {
    return result.summary || JSON.stringify(result);
  }

  return result;
};

const log = (message) => {
  console.log(`${prefix} ${message}`);
};

const fail = (message, error) => {
  failed = true;
  console.error(`${prefix} FAIL ${message}`);
  if (error) {
    const fields = errorFields(error);
    console.error(`${prefix} ${fields['error.stack_top'] || fields['error.message']}`);
  }
};

const check = (label, fn) => {
  structuredLog('info', `Starting diagnostic check: ${label}`, {
    event: 'hootnshoot.startup.diagnostics.check.started',
    check: label,
    status: 'started',
  });

  try {
    const result = fn();
    const resultContext =
      result && typeof result === 'object' && !Array.isArray(result) ? result : {};
    const resultSummary = formatResult(result);
    const { event: resultEvent, ...safeResultContext } = resultContext;

    log(`OK ${label}${resultSummary ? ` -> ${resultSummary}` : ''}`);
    structuredLog('info', `Diagnostic check passed: ${label}`, {
      event: 'hootnshoot.startup.diagnostics.check.passed',
      check: label,
      status: 'passed',
      ...safeResultContext,
    });
    if (resultEvent) {
      structuredLog('info', `Diagnostic package compatibility checked: ${label}`, {
        event: resultEvent,
        check: label,
        status: 'passed',
        ...safeResultContext,
      });
    }
  } catch (error) {
    fail(label, error);
    structuredLog('error', `Diagnostic check failed: ${label}`, {
      event: 'hootnshoot.startup.diagnostics.check.failed',
      check: label,
      status: 'failed',
      ...errorFields(error),
    });
  }
};

const findPackageJson = (resolvedPath) => {
  let current = fs.statSync(resolvedPath).isDirectory()
    ? resolvedPath
    : path.dirname(resolvedPath);

  while (current !== path.dirname(current)) {
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      return packageJson;
    }
    current = path.dirname(current);
  }

  throw new Error(`Could not find package.json for ${resolvedPath}`);
};

const packageInfoFromResolvedPath = (resolvedPath) => {
  const packageJsonPath = findPackageJson(resolvedPath);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  return {
    name: packageJson.name,
    version: packageJson.version,
    packageJson,
    packageJsonPath,
    root: path.dirname(packageJsonPath),
    resolvedPath,
  };
};

const packageInfo = (packageName, options) =>
  packageInfoFromResolvedPath(require.resolve(packageName, options));

const resolveExpressLayerModule = () => {
  try {
    return require.resolve('express/lib/router/layer');
  } catch {
    return require.resolve('router/lib/layer');
  }
};

const getPathToRegexpCallable = (pathToRegexpModule) => {
  if (typeof pathToRegexpModule === 'function') {
    return pathToRegexpModule;
  }
  if (pathToRegexpModule && typeof pathToRegexpModule === 'object') {
    if (typeof pathToRegexpModule.pathToRegexp === 'function') {
      return pathToRegexpModule.pathToRegexp;
    }
    if (typeof pathToRegexpModule.default === 'function') {
      return pathToRegexpModule.default;
    }
  }
  return undefined;
};

log(`node=${process.version} platform=${process.platform} arch=${process.arch} cwd=${cwd}`);
structuredLog('info', 'Runtime diagnostics started', {
  event: 'hootnshoot.startup.diagnostics.started',
  status: 'started',
  'runtime.node.version': process.version,
  'runtime.platform': process.platform,
  'runtime.arch': process.arch,
  cwd,
});

if (!entryFile) {
  fail('entry file argument is required');
} else {
  check(`compiled entry exists: ${entryFile}`, () => {
    const absoluteEntry = path.resolve(cwd, entryFile);
    if (!fs.existsSync(absoluteEntry)) {
      throw new Error(`Missing compiled entry at ${absoluteEntry}`);
    }
    return { summary: absoluteEntry, 'entry.file': entryFile, 'entry.path': absoluteEntry };
  });
}

check('tsconfig-paths/register loads', () => {
  require('tsconfig-paths/register');
  return {
    summary: `baseUrl=${process.env.TS_NODE_BASEURL}`,
    'tsconfig.project': process.env.TS_NODE_PROJECT,
    'tsconfig.base_url': process.env.TS_NODE_BASEURL,
  };
});

check('bcrypt native binding loads', () => {
  const bcrypt = require('bcrypt');
  bcrypt.hashSync('diagnostic', 4);
  const bcryptInfo = packageInfo('bcrypt');

  return {
    summary: require.resolve('bcrypt'),
    'package.name': bcryptInfo.name,
    'package.version': bcryptInfo.version,
    'package.path': bcryptInfo.resolvedPath,
  };
});

check('Express middleware registration works', () => {
  const express = require('express');
  const app = express();
  app.use((_req, _res, next) => next());
  const expressInfo = packageInfo('express');

  return {
    summary: require.resolve('express'),
    'package.name': expressInfo.name,
    'package.version': expressInfo.version,
    'package.path': expressInfo.resolvedPath,
  };
});

check('package compatibility: express -> path-to-regexp', () => {
  const expressInfo = packageInfo('express');
  const expressLayer = resolveExpressLayerModule();
  const pathToRegexpPath = require.resolve('path-to-regexp', {
    paths: [path.dirname(expressLayer)],
  });
  const pathToRegexpInfo = packageInfoFromResolvedPath(pathToRegexpPath);
  const pathToRegexpMod = require(pathToRegexpPath);
  const pathToRegexpFn = getPathToRegexpCallable(pathToRegexpMod);

  if (typeof pathToRegexpFn !== 'function') {
    const modType = pathToRegexpMod === null ? 'null' : typeof pathToRegexpMod;
    const keys =
      pathToRegexpMod && typeof pathToRegexpMod === 'object'
        ? Object.keys(pathToRegexpMod).slice(0, 12).join(',')
        : '';
    throw new Error(
      `Express ${expressInfo.version} resolved path-to-regexp ${pathToRegexpInfo.version} at ${pathToRegexpPath}, but no pathToRegexp() callable export (module=${modType} keys=${keys}).`
    );
  }

  return {
    summary: `express=${expressInfo.version} path-to-regexp=${pathToRegexpInfo.version}`,
    event: 'hootnshoot.package.compatibility.checked',
    check: 'package compatibility: express -> path-to-regexp',
    'package.name': expressInfo.name,
    'package.version': expressInfo.version,
    'dependency.name': pathToRegexpInfo.name,
    'dependency.version': pathToRegexpInfo.version,
    'dependency.path': pathToRegexpPath,
  };
});

const aliasChecks = [
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
];

if (service === 'backend') {
  check('package compatibility: CopilotKit -> LangChain community', () => {
    const copilotInfo = packageInfo('@copilotkit/runtime');
    const copilotDist = path.dirname(require.resolve('@copilotkit/runtime'));
    let communityPath;
    try {
      communityPath = require.resolve('@langchain/community/llms/ollama', {
        paths: [copilotDist],
      });
    } catch {
      communityPath = require.resolve('@langchain/community', {
        paths: [copilotDist],
      });
    }
    const langchainCommunityInfo = packageInfoFromResolvedPath(communityPath);

    return {
      summary: `@copilotkit/runtime=${copilotInfo.version} @langchain/community=${langchainCommunityInfo.version}`,
      event: 'hootnshoot.package.compatibility.checked',
      check: 'package compatibility: CopilotKit -> LangChain community',
      'package.name': copilotInfo.name,
      'package.version': copilotInfo.version,
      'dependency.name': langchainCommunityInfo.name,
      'dependency.version': langchainCommunityInfo.version,
      'dependency.path': communityPath,
    };
  });

  check('CopilotKit runtime loads', () => {
    const runtime = require('@copilotkit/runtime');
    if (!runtime.CopilotRuntime) {
      throw new Error('CopilotRuntime export is missing');
    }
    const copilotInfo = packageInfo('@copilotkit/runtime');

    return {
      summary: require.resolve('@copilotkit/runtime'),
      'package.name': copilotInfo.name,
      'package.version': copilotInfo.version,
      'package.path': copilotInfo.resolvedPath,
    };
  });

  aliasChecks.push(
    '@gitroom/backend/services/auth/permissions/permission.exception.class'
  );
}

if (service === 'orchestrator') {
  aliasChecks.push(
    '@gitroom/orchestrator/app.module',
    '@gitroom/backend/services/auth/permissions/permission.exception.class'
  );
}

for (const moduleName of aliasChecks) {
  check(`module resolves: ${moduleName}`, () => {
    const resolvedPath = require.resolve(moduleName);

    return {
      summary: resolvedPath,
      'module.name': moduleName,
      'module.path': resolvedPath,
    };
  });
}

check('SWC circular import guard: IntegrationService loads', () => {
  const { IntegrationService } = require(
    '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service'
  );
  if (!IntegrationService) {
    throw new Error('IntegrationService export is empty');
  }
  return {
    summary: 'IntegrationService export available',
    'module.name':
      '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
    export: 'IntegrationService',
  };
});

if (failed) {
  console.error(`${prefix} startup diagnostics failed`);
  structuredLog('error', 'Runtime diagnostics failed', {
    event: 'hootnshoot.startup.diagnostics.completed',
    status: 'failed',
  });
  process.exit(1);
}

log('startup diagnostics passed');
structuredLog('info', 'Runtime diagnostics passed', {
  event: 'hootnshoot.startup.diagnostics.completed',
  status: 'passed',
});
process.exit(0);
