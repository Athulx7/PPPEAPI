const Express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectToDb } = require('./DB/db_Connection');
const router= require('./Router/route');

const PPPSERVER = Express();
PPPSERVER.use(Express.json());
PPPSERVER.use(cors())
PPPSERVER.use(router);

const PORT = 3000

connectToDb().then(() => {
    PPPSERVER.listen(PORT,() => {
        console.log(`🚀🚀🚀 PPP Server is running on port ${PORT} 🚀🚀🚀`)
    })
})

PPPSERVER.get('/', (req, res) => {
    res.send('Hello from express server of PPP !')
});
