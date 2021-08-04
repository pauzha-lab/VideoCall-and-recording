const fs = require('fs');
const https = require('https');
const http = require('http');
const express = require('express');
const path = require('path');
const app = express();

const PROTOCOL = process.env.PROTOCOL || 'http'
const SERVER_PORT = process.env.SERVER_PORT || 5000

if (PROTOCOL.toLowerCase() === 'https') {
    const HTTPS_OPTIONS = Object.freeze({
        cert: fs.readFileSync(process.env.HTTPS_CERT_FULLCHAIN || `${__dirname}/certs/fullchain.pem`),
        key: fs.readFileSync(process.env.HTTPS_CERT_PRIVKEY || `${__dirname}/certs/privkey.pem`)
    });
    appServer = https.createServer(HTTPS_OPTIONS, app);
} else {
    appServer = http.createServer(app);
}


app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

appServer.listen(SERVER_PORT, () =>
    console.log('Web Server listening on port %d', SERVER_PORT)
);