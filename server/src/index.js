const express = require('express');
const cors = require('cors');
const app = express();
const { issueToken, checkUserExists, registerNewUser, dbStartup, getUsersInfo } = require('./userfunctions');

app.use(cors());
app.use(express.json());

app.post('/issuetoken', async (req, res) => res.send(await issueToken(req,res)));
app.post('/checkuserexists', async (req, res) => res.send(await checkUserExists(req,res)));
app.post('/registernewuser', async (req, res) => res.send(await registerNewUser(req,res)));
app.post('/getusersinfo', async (req, res) => res.send(await getUsersInfo(req,res)));

//TODO refreshtoken
//TODO separate getuserinfo ?
//TODO setuserdata (including password)

dbStartup();

app.listen(process.env.COUCHDB_API_PORT);