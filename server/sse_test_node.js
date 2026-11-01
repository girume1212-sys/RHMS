const http = require('http');
const { exec } = require('child_process');
http.get('http://localhost:5000/api/auth/login', () => {}).on('error',()=>{});
// login
const data = JSON.stringify({ email:'dev@rhms.com', password:'dev123' });
const loginReq = http.request({ hostname:'localhost', port:5000, path:'/api/auth/login', method:'POST', headers:{'Content-Type':'application/json'} }, res => {
  let body=''; res.on('data',c=>body+=c); res.on('end', () => {
    const token = JSON.parse(body).token;
    console.log('logged in');
    const sse = http.get('http://localhost:5000/api/notifications/stream?token='+token, res2 => {
      res2.setEncoding('utf8');
      res2.on('data', chunk => { console.log('SSE CHUNK:', chunk.trim()); });
    });
    // after 2s post comment
    setTimeout(() => {
      exec('node post_helper.js', (err,stdout,stderr) => { console.log('post:', stdout, stderr); });
    }, 2000);
    // close after 8s
    setTimeout(() => { sse.destroy(); process.exit(0); }, 8000);
  });
});
loginReq.write(data); loginReq.end();