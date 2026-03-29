const Express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectToDb } = require('./DB/db_Connection');
const router = require('./Router/route');
const setupSocket = require('./Chats/setupSocket');

const app = Express();
app.use(Express.json());
app.use(cors());
app.use(router);

const http = require('http');
const server = http.createServer(app);

setupSocket(server);

const PORT = 3000;

connectToDb().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 PPP Server is running on port ${PORT}`);
    });
});

app.get('/', (req, res) => {
    res.send('Hello from express server of PPP!');
});
