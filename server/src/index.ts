import express from 'express';
import cors from 'cors';
import eta from 'eta';
const app = express();
import {
 issueToken, refreshToken, checkUserExists, registerNewUser, getUsersInfo, 
        checkUserByEmailExists, createAccountUIGet, createAccountUIPost,
        triggerRegEmail, resetPassword, resetPasswordUIGet, resetPasswordUIPost,
        triggerResolveConflicts, triggerDBCompact, authenticateJWT, logout } from './apicalls';

import { dbStartup } from './dbstartup'

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.engine("eta", eta.renderFile);
app.set("view engine","eta");
app.set("views","./views");

app.post('/issuetoken', async (req, res) => res.send(await issueToken(req,res)));
app.post('/refreshtoken', authenticateJWT, async (req,res) => 
        { const {status,response} = await refreshToken(req,res);
          res.status(status).send(response); } );
app.post('/logout', authenticateJWT, async (req,res) => 
        { await logout(req,res); res.send(); } );          
app.post('/checkuserexists', authenticateJWT, async (req, res) => res.send(await checkUserExists(req,res)));
app.post('/checkuserbyemailexists', authenticateJWT, async (req,res) => res.send(await checkUserByEmailExists(req,res)))
app.post('/registernewuser', async (req, res) => res.send(await registerNewUser(req,res)));
app.post('/getusersinfo', authenticateJWT, async (req, res) => res.send(await getUsersInfo(req,res)));
app.get('/createaccountui', async (req,res) => res.render("createaccount",await createAccountUIGet(req,res)))
app.post('/createaccountui', async (req,res) => res.render("createaccount",await createAccountUIPost(req,res)));
app.post('/triggerregemail', authenticateJWT, async (req,res) => res.send(await triggerRegEmail(req,res)));
app.post('/resetpassword', async (req, res) => res.render("resetpassword",await resetPassword(req,res)));
app.get('/resetpasswordui', async(req,res) => res.render("resetpassword", await resetPasswordUIGet(req,res)));
app.post('/resetpasswordui', async(req,res) => res.render("resetpassword", await resetPasswordUIPost(req,res)));
app.post('/triggerresolveconflicts', authenticateJWT, async (req, res) => res.send(await triggerResolveConflicts(req,res)));
app.post('/triggerdbcompact', authenticateJWT, async (req,res) => res.send(await triggerDBCompact(req, res)));

//TODO setuserdata (including password)

dbStartup();

app.listen(process.env.GROCERY_API_PORT);