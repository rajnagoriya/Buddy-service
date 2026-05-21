import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');
const ALIASES = {
  '@food/api/axios': path.resolve(SRC_DIR, 'services/api/axios.js'),
  '@food/api/config': path.resolve(SRC_DIR, 'services/api/config.js'),
  '@food/api': path.resolve(SRC_DIR, 'services/api'),
  '@food': path.resolve(SRC_DIR, 'modules/Food'),
  '@delivery': path.resolve(SRC_DIR, 'modules/DeliveryV2'),
  '@qc': path.resolve(SRC_DIR, 'modules/quickCommerce'),
  '@core': path.resolve(SRC_DIR, 'modules/quickCommerce/core'),
  '@shared': path.resolve(SRC_DIR, 'modules/quickCommerce/shared'),
  '@modules': path.resolve(SRC_DIR, 'modules/quickCommerce/modules'),
  '@assets': path.resolve(SRC_DIR, 'modules/quickCommerce/assets'),
  '@styles': path.resolve(SRC_DIR, 'modules/quickCommerce/styles'),
  '@': path.resolve(SRC_DIR)
};

const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

function getExactCasePath(dir, target) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.toLowerCase() === target.toLowerCase()) {
        return file;
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}

function resolveImportPath(currentFilePath, importPath) {
  let absolutePath = '';
  
  // Find matching alias
  let matchedAlias = null;
  for (const alias of Object.keys(ALIASES)) {
    if (importPath.startsWith(alias + '/') || importPath === alias) {
      // Pick the longest matching alias
      if (!matchedAlias || alias.length > matchedAlias.length) {
        matchedAlias = alias;
      }
    }
  }

  if (matchedAlias) {
    const remainder = importPath.substring(matchedAlias.length);
    absolutePath = path.join(ALIASES[matchedAlias], remainder);
  } else if (importPath.startsWith('.')) {
    absolutePath = path.join(path.dirname(currentFilePath), importPath);
  } else {
    // Node module or other alias
    return null; 
  }

  // Now verify casing
  const parts = absolutePath.split(path.sep);
  let currentResolvedDir = path.parse(absolutePath).root;
  // If windows, start from drive letter
  if (process.platform === 'win32') {
     const splitAbsolute = absolutePath.split(path.sep);
     currentResolvedDir = splitAbsolute[0] + path.sep;
     parts.splice(0, 1);
  }

  let mismatch = false;
  let correctedPath = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const actualName = getExactCasePath(currentResolvedDir, part);
    
    if (actualName) {
      if (actualName !== part) {
        mismatch = true;
      }
      currentResolvedDir = path.join(currentResolvedDir, actualName);
    } else {
       // Could be missing extension
       if (i === parts.length - 1) {
         let foundWithExt = false;
         for (const ext of EXTENSIONS) {
           const actualNameWithExt = getExactCasePath(currentResolvedDir, part + ext);
           if (actualNameWithExt) {
             const baseName = actualNameWithExt.slice(0, -ext.length);
             if (baseName !== part) {
               mismatch = true;
             }
             currentResolvedDir = path.join(currentResolvedDir, actualNameWithExt);
             foundWithExt = true;
             // Don't append extension to the corrected import if it wasn't there
             parts[i] = baseName;
             break;
           }
         }
         
         if (!foundWithExt) {
            // maybe it's a directory and there is an index.js
            const actualDirName = getExactCasePath(currentResolvedDir, part);
            if(actualDirName) {
                if(actualDirName !== part) mismatch = true;
            } else {
               // completely not found
               return { status: 'not_found' };
            }
         }
       } else {
         return { status: 'not_found' };
       }
    }
  }

  if (mismatch) {
    // Reconstruct the corrected import path
    let newImportPath = importPath;
    
    if (matchedAlias) {
        let rel = path.relative(ALIASES[matchedAlias], currentResolvedDir);
        // rel might have extension if we resolved it, but let's strip it if original didn't have it
        const originalExt = path.extname(importPath);
        if (!originalExt) {
            const relExt = path.extname(rel);
            if (EXTENSIONS.includes(relExt)) {
                rel = rel.slice(0, -relExt.length);
            }
        }
        newImportPath = matchedAlias + '/' + rel.split(path.sep).join('/');
    } else {
        let rel = path.relative(path.dirname(currentFilePath), currentResolvedDir);
        const originalExt = path.extname(importPath);
        if (!originalExt) {
            const relExt = path.extname(rel);
            if (EXTENSIONS.includes(relExt)) {
                rel = rel.slice(0, -relExt.length);
            }
        }
        rel = rel.split(path.sep).join('/');
        if (!rel.startsWith('.')) {
            rel = './' + rel;
        }
        newImportPath = rel;
    }
    
    return { status: 'mismatch', corrected: newImportPath };
  }

  return { status: 'ok' };
}

function scanDir(dir, results) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        scanDir(fullPath, results);
      }
    } else if (EXTENSIONS.includes(path.extname(fullPath))) {
      checkFile(fullPath, results);
    }
  }
}

function checkFile(filePath, results) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Regex to match imports: import ... from '...' or "..."
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const exportRegex = /export\s+.*from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    processImport(filePath, match[1], results);
  }
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    processImport(filePath, match[1], results);
  }
  while ((match = exportRegex.exec(content)) !== null) {
    processImport(filePath, match[1], results);
  }
}

function processImport(filePath, importPath, results) {
  if (!importPath.startsWith('.') && !importPath.startsWith('@')) {
    return; // Node modules or other aliases
  }

  const res = resolveImportPath(filePath, importPath);
  if (res && res.status === 'mismatch') {
    results.push({
      file: filePath,
      oldImport: importPath,
      newImport: res.corrected
    });
  } else if (res && res.status === 'not_found') {
     results.push({
      file: filePath,
      oldImport: importPath,
      newImport: 'NOT_FOUND'
    });
  }
}

const results = [];
scanDir(SRC_DIR, results);

fs.writeFileSync('scan_results.json', JSON.stringify(results, null, 2), 'utf8');
