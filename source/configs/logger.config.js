const { createLogger, format, transports } = require('winston');

// Define custom format to include level and message with data
const myFormat = format.printf(({ level, message, ...args }) => {
    let dataString = '';
    if (Object.keys(args).length > 0) {
        dataString = ' ' + JSON.stringify(args, null, 2);
    }
    return `${level}: ${message}${dataString}`;
});

// Create a logger instance
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.colorize(),
        myFormat
    ),
    transports: [
        new transports.Console()
    ]
});

module.exports = logger;