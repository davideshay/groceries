const express = require('express');
const app = express();
const { issueToken, checkUserExists, registerNewUser } = require('./userfunctions');

app.use(express.json());

app.get('/issuetoken', async (req, res) => res.send(await issueToken(req,res)));
app.get('/checkuserexists', async (req, res) => res.send(await checkUserExists(req,res)));
app.put('/registernewuser', async (req, res) => res.send(await registerNewUser(req,res)));

const port = 3333;

app.listen(port);