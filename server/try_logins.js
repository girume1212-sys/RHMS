const emails = ["maria@client.com","sarah@client.com","robert@client.com","lisa@client.com","james@client.com","david@client.com"];
const http = require('http');
async function tryLogin(email) {
  return new Promise(resolve => {
    const data = JSON.stringify({ email, password: 'client123' });
    const req = http.request({ hostname:'localhost', port:5000, path:'/api/auth/login', method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} }, res => {
      let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({email,status:res.statusCode,body}));
    });
    req.on('error',e=>resolve({email,error:e.message}));
    req.write(data); req.end();
  });
}
(async () => {
  for (const e of emails) console.log(await tryLogin(e));
})();