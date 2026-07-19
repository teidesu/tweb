const path = require('path');

const UPSTREAM_ALIASES = [
  ['@appManagers', '@/lib/appManagers'],
  ['@richTextProcessor', '@/lib/richTextProcessor'],
  ['@customEmoji', '@/lib/customEmoji'],
  ['@rlottie', '@/lib/rlottie'],
  ['@components', '@/components'],
  ['@environment', '@/environment'],
  ['@helpers', '@/helpers'],
  ['@hooks', '@/hooks'],
  ['@stores', '@/stores'],
  ['@config', '@/config'],
  ['@vendor', '@/vendor'],
  ['@layer', '@/layer'],
  ['@types', '@/types'],
  ['@lib', '@/lib']
];

const SPECIFIER_OVERRIDES = new Map([
  ['@/helpers/string/classNames', 'clsx']
]);

function normalizeSpecifier(specifier, filePath, srcDir) {
  let result = specifier;

  for(const [from, to] of UPSTREAM_ALIASES) {
    if(result === from || result.startsWith(from + '/')) {
      result = to + result.slice(from.length);
      break;
    }
  }

  if(result.startsWith('../') && filePath && srcDir) {
    const resolved = path.resolve(path.dirname(filePath), result);
    const relative = path.relative(srcDir, resolved);
    if(!relative.startsWith('..') && !path.isAbsolute(relative)) {
      result = '@/' + relative.split(path.sep).join('/');
    }
  }

  return SPECIFIER_OVERRIDES.get(result) ?? result;
}

const SPECIFIER_PATTERNS = [
  /(\bfrom\s*)(['"])([^'"\n]+)\2/g,
  /(\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g,
  /(\brequire\s*\(\s*)(['"])([^'"\n]+)\2/g,
  /(^import\s+)(['"])([^'"\n]+)\2/gm
];

function normalizeFileContent(content, filePath, srcDir) {
  let result = content;
  for(const pattern of SPECIFIER_PATTERNS) {
    result = result.replace(pattern, (match, prefix, quote, specifier) => {
      return prefix + quote + normalizeSpecifier(specifier, filePath, srcDir) + quote;
    });
  }
  return result;
}

function getSrcDir(cwd) {
  const {execSync} = require('child_process');
  const root = execSync('git rev-parse --show-toplevel', {cwd, encoding: 'utf8'}).trim();
  return path.join(root, 'src');
}

module.exports = {normalizeSpecifier, normalizeFileContent, getSrcDir};
