import express from 'express';
import { Request as ExpressRequest, Response as ExpressResponse} from 'express';
import cors from 'cors';
import { Eta } from 'eta';
const app = express();
import {
 issueToken, refreshToken, checkUserExists, registerNewUser, getUsersInfo, 
        checkUserByEmailExists, createAccountUIGet, createAccountUIPost,
        triggerRegEmail, resetPassword, resetPasswordUIGet, resetPasswordUIPost,
        triggerResolveConflicts, triggerDBCompact, authenticateJWT,
        updateUserInfo, logout, groceryAPIPort, isAvailable } from './apicalls';

import { dbStartup } from './dbstartup'
import { CheckUserExistsReqBody, NewUserReqBody, NewUserReponse, CheckUseEmailReqBody, IssueTokenBody, RefreshTokenBody, RefreshTokenResponse, IssueTokenResponse, CheckUserExistsResponse, CheckUserByEmailExistsResponse, GetUsersInfoResponse, GetUsersInfoRequestBody, UpdateUserInfoResponse, UserInfo, CreateAccountResponse, CreateAccountParams, TriggerRegEmailBody, ResetPasswordBody, ResetPasswordResponse } from './datatypes';
import path from 'path';


async function startup() {
        app.use(cors());
        app.use(express.json());
        app.use(express.urlencoded({extended: true}));
        
        let viewPath = path.join(__dirname,"../views");
        let eta = new Eta({ views: viewPath, cache: true });

//        app.engine("eta", eta.render);
        app.set("view engine","eta");
        app.post("/issuetoken", async (req: ExpressRequest<{},IssueTokenResponse,IssueTokenBody>,res: ExpressResponse<IssueTokenResponse>) => {res.send(await issueToken(req,res))})        
//        app.post('/issuetoken', async (req: Request<{}, IssueTokenBody>, res: Response) => res.send(await issueToken(req,res)));
        app.post('/refreshtoken', authenticateJWT, async (req: ExpressRequest<{},RefreshTokenResponse,RefreshTokenBody>,res: ExpressResponse<RefreshTokenResponse>) => 
                { const {status,response} = await refreshToken(req,res);
                  res.status(status).send(response); } );
        app.post('/logout', authenticateJWT, async (req: ExpressRequest,res: ExpressResponse) => 
                { await logout(req,res); res.send(); } );          
        app.post('/checkuserexists', authenticateJWT, async (req: ExpressRequest<{},CheckUserExistsResponse,CheckUserExistsReqBody>, res: ExpressResponse<CheckUserExistsResponse>) => {res.send(await checkUserExists(req,res))});
        app.post('/checkuserbyemailexists', authenticateJWT, async (req: ExpressRequest<{},CheckUserByEmailExistsResponse,CheckUseEmailReqBody>,res: ExpressResponse<CheckUserByEmailExistsResponse>) => {res.send(await checkUserByEmailExists(req,res))})
        app.post('/registernewuser', async (req: ExpressRequest<{},NewUserReponse,NewUserReqBody>, res: ExpressResponse<NewUserReponse>) => {res.send(await registerNewUser(req,res))});
        app.post('/getusersinfo', authenticateJWT, async (req: ExpressRequest<{},GetUsersInfoResponse,GetUsersInfoRequestBody>, res: ExpressResponse<GetUsersInfoResponse>) => {res.send(await getUsersInfo(req,res))});
        app.post('/updateuserinfo', authenticateJWT, async (req: ExpressRequest<{},UpdateUserInfoResponse,UserInfo>, res: ExpressResponse<UpdateUserInfoResponse>) => {res.send(await updateUserInfo(req,res))});
        app.get('/createaccountui', async (req: ExpressRequest<{},{},{},CreateAccountParams>,res: ExpressResponse) => {res.send(eta.render("createaccount",await createAccountUIGet(req)))});
        app.post('/createaccountui', async (req: ExpressRequest<{},{},CreateAccountResponse>,res: ExpressResponse) => {res.send(eta.render("createaccount",await createAccountUIPost(req)))});
        app.post('/triggerregemail', authenticateJWT, async (req: ExpressRequest<{},{},TriggerRegEmailBody>,res: ExpressResponse) => {res.send(await triggerRegEmail(req))});
        app.post('/resetpassword', async (req: ExpressRequest<{},ResetPasswordResponse,ResetPasswordBody>, res: ExpressResponse<ResetPasswordResponse>) => {res.send(await resetPassword(req))});
        app.get('/resetpasswordui', async(req: ExpressRequest,res: ExpressResponse) => res.send(eta.render("resetpassword", await resetPasswordUIGet(req,res))));
        app.post('/resetpasswordui', async(req: Request,res: Response) => res.send(eta.render("resetpassword", await resetPasswordUIPost(req,res))));
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