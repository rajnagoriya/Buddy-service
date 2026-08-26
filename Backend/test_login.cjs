const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/taxi/users/otp-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("LOGIN RESPONSE:");
    console.log(data);
    const result = JSON.parse(data);
    
    if (result.token) {
      // NOW WE CAN QUERY /me
      const meOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/taxi/users/me',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${result.token}`
        }
      };
      const meReq = http.request(meOptions, meRes => {
        let meData = '';
        meRes.on('data', c => meData += c);
        meRes.on('end', () => {
          console.log("ME RESPONSE:");
          console.log(meData);
        });
      });
      meReq.end();
      
      const walletOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/taxi/users/wallet',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${result.token}`
        }
      };
      const wReq = http.request(walletOptions, wRes => {
        let wData = '';
        wRes.on('data', c => wData += c);
        wRes.on('end', () => {
          console.log("WALLET RESPONSE:");
          console.log(wData);
        });
      });
      wReq.end();
    }
  });
});

req.write(JSON.stringify({ phone: '7724817688' }));
req.end();
