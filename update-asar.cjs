const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const asarPath = path.resolve('Farm-App/dist-electron/win-unpacked/resources/app.asar');
const tempDir = path.resolve('Farm-App/temp-asar-update');

console.log('Extracting asar from:', asarPath);
cp.execSync(`cmd.exe /c npx asar extract "${asarPath}" "${tempDir}"`, { cwd: path.resolve('Farm-App') });

console.log('Copying updated dist and electron into tempDir...');
cp.execSync(`powershell -Command "Copy-Item -Path 'Farm-App/dist' -Destination '${tempDir}' -Recurse -Force"`);
cp.execSync(`powershell -Command "Copy-Item -Path 'Farm-App/electron' -Destination '${tempDir}' -Recurse -Force"`);

console.log('Repacking asar to:', asarPath);
cp.execSync(`cmd.exe /c npx asar pack "${tempDir}" "${asarPath}"`, { cwd: path.resolve('Farm-App') });

console.log('Cleaning up tempDir...');
fs.rmSync(tempDir, { recursive: true, force: true });

console.log('SUCCESS: Standalone executable app.asar is now 100% updated!');
