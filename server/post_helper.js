const http = require('http');
const data = JSON.stringify({ email:'james@client.com', password:'client123' });
const loginReq = http.request({ hostname:'localhost', port:5000, path:'/api/auth/login', method:'POST', headers:{'Content-Type':'application/json'} }, res => {
  let body=''; res.on('data',c=>body+=c); res.on('end', () => {
    const token = JSON.parse(body).token;
    const cdata = JSON.stringify({ content:'Hello from James' });
    const req = http.request({ hostname:'localhost', port:5000, path:'/api/requests/REQ-2024-00122/comments', method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'Content-Length':Buffer.byteLength(cdata)} }, res2 => {
      let b=''; res2.on('data',c=>b+=c); res2.on('end',()=>console.log('post status', res2.statusCode, b));
    });
    req.write(cdata); req.end();
  });
});
loginReq.write(data); loginReq.end();