const http = require('http');
http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        console.log('BROWSER LOG:', body);
        res.end('ok');
    });
}).listen(9998, () => console.log('Logger listening on 9998'));
