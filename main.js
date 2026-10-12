const { app, BrowserWindow } = require('electron');
const path = require('path');
function createWindow() {
  const win = new BrowserWindow({ width: 520, height: 900, minWidth: 380, minHeight: 640, backgroundColor: '#1b1f3b', autoHideMenuBar: true,
    webPreferences: { autoplayPolicy: 'no-user-gesture-required' } });
  win.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
