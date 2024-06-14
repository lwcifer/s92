import { createLogger, format as _format, transports as _transports } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const logDir = 'logs';
if (!existsSync(logDir)) {
  mkdirSync(logDir);
}

const logFile = join(logDir, 'app.log');
const logger = createLogger({
  level: 'info',
  format: _format.combine(
    _format.timestamp(),
    _format.json()
  ),
  transports: [
    new _transports.File({ filename: logFile }),
    new _transports.Console()
  ]
});

export default logger;
