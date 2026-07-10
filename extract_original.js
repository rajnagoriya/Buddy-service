import fs from 'fs';
import path from 'path';

const logFilePath = '/Users/rajnagoriya/.gemini/antigravity-ide/brain/226b0fb8-2134-414e-92ac-db232890cae0/.system_generated/logs/transcript_full.jsonl';
const targetFilePath = '/Users/rajnagoriya/code/appzeto/buddy/Buddy-service/Frontend/src/modules/Food/pages/admin/DeliveryBoyCommission.jsx';

// Read the log file
const logs = fs.readFileSync(logFilePath, 'utf8').split('\n');

let viewFileResponses = [];

for (const log of logs) {
  if (!log.trim()) continue;
  try {
    const obj = JSON.parse(log);
    
    // Check if it's a response message containing the file content
    if (obj.source === 'SYSTEM' && obj.content && obj.content.includes('File Path: `file:///Users/rajnagoriya/code/appzeto/buddy/Buddy-service/Frontend/src/modules/Food/pages/admin/DeliveryBoyCommission.jsx`')) {
      viewFileResponses.push(obj.content);
    }
  } catch (err) {
    // Ignore invalid JSON lines
  }
}

console.log('Total view_file system responses found:', viewFileResponses.length);

if (viewFileResponses.length < 2) {
  console.error('Error: Could not find both view_file outputs in the log.');
  process.exit(1);
}

// We need to parse each response, extract lines, and sort them to form the full file.
const allLines = new Map(); // map of line_number -> content

for (const response of viewFileResponses) {
  const fileLines = response.split('\n');
  const isSecondChunk = response.includes('Showing lines 800 to 1446');
  for (const line of fileLines) {
    const match = line.match(/^(\d+): (.*)$/);
    if (match) {
      let lineNum = parseInt(match[1], 10);
      const content = match[2];
      if (isSecondChunk && lineNum >= 800) {
        lineNum += 1;
      }
      allLines.set(lineNum, content);
    } else {
      const matchEmpty = line.match(/^(\d+):$/);
      if (matchEmpty) {
        let lineNum = parseInt(matchEmpty[1], 10);
        if (isSecondChunk && lineNum >= 800) {
          lineNum += 1;
        }
        allLines.set(lineNum, '');
      }
    }
  }
}

// Find max line number
let maxLine = 0;
for (const lineNum of allLines.keys()) {
  if (lineNum > maxLine) maxLine = lineNum;
}

console.log('Max line number found:', maxLine);

if (maxLine === 0) {
  console.error('Error: Extracted 0 lines.');
  process.exit(1);
}

// Reconstruct the file content line by line
const fileContentLines = [];
for (let i = 1; i <= maxLine; i++) {
  if (allLines.has(i)) {
    fileContentLines.push(allLines.get(i));
  } else {
    console.warn(`Warning: Missing line number ${i}, putting empty string`);
    fileContentLines.push('');
  }
}

const reconstructedContent = fileContentLines.join('\n');

// Write the reconstructed content back
fs.writeFileSync(targetFilePath, reconstructedContent, 'utf8');
console.log('Successfully restored original file contents of DeliveryBoyCommission.jsx!');
