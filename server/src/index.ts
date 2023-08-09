import express, { Request, Response } from 'express';
import cors from 'cors';
import eta from 'eta';
const app = express();
import {
 issueToken, refreshToken, checkUserExists, registerNewUser, getUsersInfo, 
        checkUserByEmailExists, createAccountUIGet, createAccountUIPost,
        triggerRegEmail, resetPassword, resetPasswordUIGet, resetPasswordUIPost,
        triggerResolveConflicts, triggerDBCompact, authenticateJWT,
        updateUserInfo, logout, groceryAPIPort, isAvailable } from './apicalls';

import { dbStartup } from './dbstartup'
import { CheckUserExistsReqBody, NewUserReqBody, CustomRequest, CheckUseEmailReqBody } from './datatypes';


async function startup() {
        app.use(cors());
        app.use(express.json());
        app.use(express.urlencoded({extended: true}));
        
        app.engine("eta", eta.renderFile);
        app.set("view engine","eta");
        app.set("views","./views");
        
        app.post('/issuetoken', async (req: Request, res: Response) => res.send(await issueToken(req,res)));
        app.post('/refreshtoken', authenticateJWT, async (req: Request,res: Response) => 
                { const {status,response} = await refreshToken(req,res);
                  res.status(status).send(response); } );
        app.post('/logout', authenticateJWT, async (req: Request,res: Response) => 
                { await logout(req,res); res.send(); } );          
        app.post('/checkuserexists', authenticateJWT, async (req: CustomRequest<CheckUserExistsReqBody>, res: Response) => res.send(await checkUserExists(req,res)));
        app.post('/checkuserbyemailexists', authenticateJWT, async (req: CustomRequest<CheckUseEmailReqBody>,res: Response) => res.send(await checkUserByEmailExists(req,res)))
        app.post('/registernewuser', async (req: CustomRequest<NewUserReqBody>, res: Response) => res.send(await registerNewUser(req,res)));
        app.post('/getusersinfo', authenticateJWT, async (req: Request, res: Response) => res.send(await getUsersInfo(req,res)));
        app.post('/updateuserinfo', authenticateJWT, async (req: Request, res: Response) => res.send(await updateUserInfo(req,res)));
        app.get('/createaccountui', async (req: Request,res: Response) => res.render("createaccount",await createAccountUIGet(req,res)))
        app.post('/createaccountui', async (req: Request,res: Response) => res.render("createaccount",await createAccountUIPost(req,res)));
        app.post('/triggerregemail', authenticateJWT, async (req: Request,res: Response) => res.send(await triggerRegEmail(req,res)));
        app.post('/resetpassword', async (req: Request, res: Response) => res.render("resetpassword",await resetPassword(req,res)));
        app.get('/resetpasswordui', async(req: Request,res: Response) => res.render("resetpassword", await resetPasswordUIGet(req,res)));
        app.post('/resetpasswordui', async(req: Request,res: Response) => res.render("resetpassword", await resetPasswordUIPost(req,res)));
        app.post('/triggerresolveconflicts', authenticateJWT, async (req: Request, res: Response) => res.send(await triggerResolveConflicts(req,res)));
        app.post('/triggerdbcompact', authenticateJWT, async (req: Request,res: Response) => res.send(await triggerDBCompact(req, res)));
        app.get('/isavailable', async (req: Request, res: Response) => res.send(await isAvailable(req,res)));
        let startupSuccess = await dbStartup();
        if (!startupSuccess) {
                console.log("---ERROR IN STARTUP--- EXITING BACKEND");
                process.exit(1)
        }
        app.listen(groceryAPIPort);
}

startup()