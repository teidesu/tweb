#!/usr/bin/env node
// Auto-resolves merge conflict regions that consist purely of import statements:
// keeps ours, appends/unions theirs (with specifiers normalized to fork @/ style).
// Regions with anything but plain imports, or with real clashes (different default
// binding for the same module, identifier collisions), are left conflicted.
// Usage (from the sync worktree, during a conflicted cherry-pick):
//   node scripts/upstream-sync/resolve-import-conflicts.js [files...]
// With no args, processes all unmerged .ts/.tsx files. Fully resolved files are `git add`ed.

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const {normalizeSpecifier, getSrcDir} = require('./lib');

const cwd = process.cwd();
const srcDir = getSrcDir(cwd);

const NAME_RE = /^(?:type\s+)?[\w$]+(?:\s+as\s+[\w$]+)?$/;

function parseStatement(raw) {
  const sideEffect = raw.match(/^import\s*(['"])([^'"]+)\1;?\s*$/);
  if(sideEffect) {
    return {sideEffect: true, specifier: sideEffect[2]};
  }

  const m = raw.match(/^(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s*(['"])([^'"]+)\4;?\s*$/);
  if(!m) return null;

  const clause = m[3];
  const namespaceMatch = clause.match(/\*\s*as\s+([\w$]+)/);
  const namedMatch = clause.match(/\{([\s\S]*)\}/);

  const named = [];
  if(namedMatch) {
    for(const part of namedMatch[1].split(',')) {
      const name = part.trim().replace(/\s+/g, ' ');
      if(!name) continue;
      if(!NAME_RE.test(name)) return null;
      named.push(name);
    }
  }

  let rest = clause;
  if(namedMatch) rest = rest.replace(namedMatch[0], '');
  if(namespaceMatch) rest = rest.replace(namespaceMatch[0], '');
  rest = rest.replace(/,/g, ' ').trim();
  if(rest && !/^[\w$]+$/.test(rest)) return null;

  return {
    kind: m[1],
    typeOnly: !!m[2],
    defaultName: rest || null,
    namespaceName: namespaceMatch ? namespaceMatch[1] : null,
    named,
    specifier: m[5]
  };
}

function splitStatements(text) {
  const statements = [];
  let current = null;

  for(const line of text.split('\n')) {
    const trimmed = line.trim();
    if(current === null) {
      if(!trimmed) continue;
      if(!/^(import|export)\b/.test(trimmed)) return null;
      current = trimmed;
    } else {
      current += ' ' + trimmed;
    }

    if(/['"];?\s*$/.test(current)) {
      const parsed = parseStatement(current);
      if(!parsed) return null;
      statements.push(parsed);
      current = null;
    }
  }

  return current === null ? statements : null;
}

function getBoundNames(statement) {
  if(statement.sideEffect) return [];
  const names = [];
  if(statement.defaultName) names.push(statement.defaultName);
  if(statement.namespaceName) names.push(statement.namespaceName);
  for(const name of statement.named) {
    const asMatch = name.match(/\s+as\s+([\w$]+)$/);
    names.push(asMatch ? asMatch[1] : name.replace(/^type\s+/, ''));
  }
  return names;
}

function renderStatement(statement) {
  if(statement.sideEffect) {
    return `import '${statement.specifier}';`;
  }
  const parts = [];
  if(statement.defaultName) parts.push(statement.defaultName);
  if(statement.namespaceName) parts.push(`* as ${statement.namespaceName}`);
  if(statement.named.length) parts.push(`{${statement.named.join(', ')}}`);
  return `${statement.kind} ${statement.typeOnly ? 'type ' : ''}${parts.join(', ')} from '${statement.specifier}';`;
}

function mergeImportSides(oursText, theirsText, filePath) {
  const ours = splitStatements(oursText);
  const theirs = splitStatements(theirsText);
  if(!ours || !theirs) return null;

  for(const statement of [...ours, ...theirs]) {
    const normalized = normalizeSpecifier(statement.specifier, filePath, srcDir);
    if(normalized !== statement.specifier) {
      statement.specifier = normalized;
      statement.modified = true;
    }
  }

  const getKey = (s) => s.sideEffect ?
    `side|${s.specifier}` :
    `${s.kind}|${s.typeOnly ? 't' : 'v'}|${s.specifier}`;

  const oursByKey = new Map(ours.map((s) => [getKey(s), s]));
  const boundInOurs = new Set(ours.flatMap(getBoundNames));
  const appended = [];

  for(const theirStatement of theirs) {
    if(theirStatement.sideEffect) {
      if(!ours.some((s) => s.specifier === theirStatement.specifier)) {
        appended.push(theirStatement);
      }
      continue;
    }

    const ourStatement = oursByKey.get(getKey(theirStatement));
    if(!ourStatement) {
      for(const name of getBoundNames(theirStatement)) {
        if(boundInOurs.has(name)) return null;
      }
      getBoundNames(theirStatement).forEach((name) => boundInOurs.add(name));
      appended.push(theirStatement);
      continue;
    }

    for(const name of theirStatement.named) {
      if(ourStatement.named.includes(name)) continue;
      const bound = getBoundNames({named: [name]})[0];
      if(boundInOurs.has(bound)) return null;
      ourStatement.named.push(name);
      boundInOurs.add(bound);
      ourStatement.modified = true;
    }

    if(theirStatement.defaultName && theirStatement.defaultName !== ourStatement.defaultName) {
      if(boundInOurs.has(theirStatement.defaultName)) return null;
      boundInOurs.add(theirStatement.defaultName);
      if(!ourStatement.defaultName) {
        ourStatement.defaultName = theirStatement.defaultName;
        ourStatement.modified = true;
      } else {
        appended.push({...theirStatement, named: [], namespaceName: null});
      }
    }

    if(theirStatement.namespaceName && theirStatement.namespaceName !== ourStatement.namespaceName) {
      if(boundInOurs.has(theirStatement.namespaceName)) return null;
      boundInOurs.add(theirStatement.namespaceName);
      appended.push({...theirStatement, named: [], defaultName: null});
    }
  }

  if(ours.some((s) => s.modified)) {
    return [...ours, ...appended].map(renderStatement).join('\n');
  }
  const oursLines = oursText.split('\n').filter((line) => line.trim());
  return [...oursLines, ...appended.map(renderStatement)].join('\n');
}

function resolveFileConflicts(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const out = [];
  let resolved = 0;
  let left = 0;
  let i = 0;

  while(i < lines.length) {
    if(!/^<{7}(\s|$)/.test(lines[i])) {
      out.push(lines[i++]);
      continue;
    }

    const start = i++;
    const oursLines = [];
    while(i < lines.length && !/^(\|{7}|={7})(\s|$)/.test(lines[i])) oursLines.push(lines[i++]);
    if(/^\|{7}(\s|$)/.test(lines[i])) {
      while(i < lines.length && !/^={7}(\s|$)/.test(lines[i])) i++;
    }
    i++;
    const theirsLines = [];
    while(i < lines.length && !/^>{7}(\s|$)/.test(lines[i])) theirsLines.push(lines[i++]);
    const end = i++;

    if(end >= lines.length) {
      out.push(...lines.slice(start));
      break;
    }

    const merged = mergeImportSides(oursLines.join('\n'), theirsLines.join('\n'), filePath);
    if(merged !== null) {
      out.push(merged);
      resolved++;
    } else {
      out.push(...lines.slice(start, end + 1));
      left++;
    }
  }

  if(resolved) {
    fs.writeFileSync(filePath, out.join('\n'));
  }
  return {resolved, left};
}

let files = process.argv.slice(2);
if(!files.length) {
  files = execSync('git diff --name-only --diff-filter=U', {cwd, encoding: 'utf8'})
  .split('\n')
  .filter(Boolean);
}

let fullyResolved = 0;
for(const file of files) {
  if(!/\.tsx?$/.test(file)) continue;
  const abs = path.resolve(cwd, file);
  if(!fs.existsSync(abs)) continue;

  const {resolved, left} = resolveFileConflicts(abs);
  if(resolved && !left) {
    execSync(`git add ${JSON.stringify(file)}`, {cwd});
    fullyResolved++;
    console.log(`resolved + staged: ${file}`);
  } else if(resolved) {
    console.log(`partially resolved (${resolved} regions, ${left} left): ${file}`);
  } else if(left) {
    console.log(`untouched (${left} non-import conflicts): ${file}`);
  }
}

console.log(`${fullyResolved} files fully resolved`);
