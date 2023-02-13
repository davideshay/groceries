const express = require('express');
const cors = require('cors');
const eta = require('eta');
const app = express();
const { issueToken, refreshToken, checkUserExists, registerNewUser, dbStartup, getUsersInfo, 
        checkUserByEmailExists, createAccountUIGet, createAccountUIPost,
        triggerRegEmail, resetPassword, resetPasswordUIGet, resetPasswordUIPost,
        triggerResolveConflicts, triggerDBCompact } = require('./userfunctions');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.engine("eta", eta.renderFile);
app.set("view engine","eta");
app.set("views","./views");

app.post('/issuetoken', async (req, res) => res.send(await issueToken(req,res)));
app.post('/refreshtoken', async (req,res) => 
        { const {status,response} = await refreshToken(req,res);
        console.log("in refresh token, returning:",{status},{response});
          res.status(status).send(response); } );
app.post('/checkuserexists', async (req, res) => res.send(await checkUserExists(req,res)));
app.post('/checkuserbyemailexists', async (req,res) => res.send(await checkUserByEmailExists(req,res)))
app.post('/registernewuser', async (req, res) => res.send(await registerNewUser(req,res)));
app.post('/getusersinfo', async (req, res) => res.send(await getUsersInfo(req,res)));
app.get('/createaccountui', async (req,res) => res.render("createaccount",await createAccountUIGet(req,res)))
app.post('/createaccountui', async (req,res) => res.render("createaccount",await createAccountUIPost(req,res)));
app.post('/triggerregemail', async (req,res) => res.send(await triggerRegEmail(req,res)));
app.post('/resetpassword', async (req, res) => res.render("resetpassword",await resetPassword(req,res)));
app.get('/resetpasswordui', async(req,res) => res.render("resetpassword", await resetPasswordUIGet(req,res)));
app.post('/resetpasswordui', async(req,res) => res.render("resetpassword", await resetPasswordUIPost(req,res)));
app.post('/triggerresolveconflicts', async (req, res) => res.send(await triggerResolveConflicts(req,res)));
app.post('/triggerdbcompact', async (req,res) => res.send(await triggerDBCompact(req, res)));

//TODO refreshtoken
//TODO setuserdata (including password)

dbStartup();

app.listen(process.env.GROCERY_API_PORT);