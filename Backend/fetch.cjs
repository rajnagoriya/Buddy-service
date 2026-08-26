const http = require('http');

http.get('http://127.0.0.1:5000/api/v1/debug-user?phone=7724817688', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
