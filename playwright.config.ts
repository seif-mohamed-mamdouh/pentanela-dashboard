import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests', fullyParallel:true, workers:2, timeout:30000,
 expect:{ timeout:7000 }, reporter:[['list'],['html',{open:'never'}]],
 use:{ baseURL:'http://127.0.0.1:4300', viewport:{width:1440,height:1050}, trace:'retain-on-failure', screenshot:'only-on-failure' },
 webServer:{ command:'npm run start:http -- --host 127.0.0.1 --port 4300', url:'http://127.0.0.1:4300', reuseExistingServer:!process.env['CI'], timeout:60000 }
});

