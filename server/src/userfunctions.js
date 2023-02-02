const couchdbUrl = process.env.COUCHDB_URL.endsWith("/") ? process.env.COUCHDB_URL.slice(0,-1): process.env.COUCHDB_URL;
const couchDatabase = process.env.COUCHDB_DATABASE;
const couchKey = process.env.COUCHDB_HMAC_KEY;
const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
const groceryUrl = process.env.GROCERY_URL.endsWith("/") ? process.env.GROCERY_URL.slice(0,-1): process.env.GROCERY_URL;
const groceryAPIUrl = process.env.GROCERY_API_URL.endsWith("/") ? process.env.GROCERY_API_URL.slice(0,-1): process.env.GROCERY_API_URL;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpSecure = Boolean(process.env.SMTP_SECURE);
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM;
const enableScheduling = Boolean(process.env.ENABLE_SCHEDULING);
const resolveConflictsFrequencyMinutes = (process.env.RESOLVE_CONFLICTS_FREQUENCY_MINUTES);
const couchStandardRole = "crud";
const couchAdminRole = "dbadmin";
const couchUserPrefix = "org.couchdb.user";
const conflictsViewID = "_conflicts_only_view_id";
const conflictsViewName = "conflicts_view";
const smtpOptions = {
    host: smtpHost, port: smtpPort, 
    auth: { user: smtpUser, pass: smtpPassword}
};
const nodemailer = require('nodemailer');
const jose = require('jose');
const axios = require('axios');
const nanoAdmin = require('nano');
const nanoAdminOpts = {
    url: couchdbUrl,
    requestDefaults: {
        headers: { Authorization: "Basic "+ Buffer.from(couchAdminUser+":"+couchAdminPassword).toString('base64') }
    }
}
let todosNanoAsAdmin = nanoAdmin(nanoAdminOpts);
let usersNanoAsAdmin = nanoAdmin(nanoAdminOpts);
let todosDBAsAdmin;
let usersDBAsAdmin;
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');
const { cloneDeep } = require('lodash');
const {  emailPatternValidation, usernamePatternValidation, fullnamePatternValidation } = require('./utilities')

async function couchLogin(username, password) {
    const loginResponse = {
        loginSuccessful: true,
        loginRoles: []
    }
    const config = {
        method: 'get',
        url: couchdbUrl+"/_session",
        auth: { username: username, password: password},
        responseType: 'json'
    }
    let res=null;
    try  {res = await axios(config)}
    catch(err) {loginResponse.loginSuccessful = false};
    if (loginResponse.loginSuccessful) {
        if (res.status != 200) {
            loginResponse.loginSuccessful = false;
        }
        if (loginResponse.loginSuccessful && (res.data?.ok != true)) {
            loginResponse.loginSuccessful = false;
        }
    }
    if (loginResponse.loginSuccessful) {
        loginResponse.loginRoles = res.data.userCtx.roles;
    }
    return(loginResponse);

}

function getNested(obj, ...args) {
    return args.reduce((obj, level) => obj && obj[level], obj)
  }

async function doesDBExist() {
    let retrieveError = false;
    let res = null;
    try { res = await todosNanoAsAdmin.db.get(couchDatabase)}
    catch(err) { retrieveError = true }
    if (retrieveError || res == null) {
        console.log("ERROR: could not retrieve database info.");
        return (false);
    } else {
        return (true)
    }
}

async function createDB() {
    let createError = false;
    try { await todosNanoAsAdmin.db.create(couchDatabase)}
    catch(err) {  createError = true }
    if (createError) return (false);
    console.log("STATUS: Initiatialization, Database "+couchDatabase+" created.");
    return (createError);
}

async function createDBIfNotExists() {
    let dbCreated=false
    if (!(await doesDBExist())) {
        dbCreated=await createDB()
    }
    return (dbCreated)
}

async function setDBSecurity() {
    errorSettingSecurity = false;
    let config = {
        method: 'get',
        url: couchdbUrl+"/"+couchDatabase+"/_security",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { console.log(err); errorSettingSecurity= true }
    if (errorSettingSecurity) return (!errorSettingSecurity);
    let newSecurity = _.cloneDeep(res.data);
    let securityNeedsUpdated = false;
    if ((getNested(res.data.members.roles.length) == 0) || (getNested(res.data.members.roles.length) == undefined)) {
        newSecurity.members.roles = [couchStandardRole];
        securityNeedsUpdated = true;
    } else {
        if (!res.data.members.roles.includes(couchStandardRole)) {
            newSecurity.members.roles.push(couchStandardRole);
            securityNeedsUpdated = true;
        }
    }
    if ((getNested(res.data.admins.roles.length) == 0) || (getNested(res.data.admins.roles.length) == undefined)) {
        newSecurity.admins.roles = [couchAdminRole];
        securityNeedsUpdated = true;
    } else {
        if (!res.data.admins.roles.includes(couchAdminRole)) {
            newSecurity.admins.roles.push(couchAdminRole);
            securityNeedsUpdated = true;
        }
    }
    if (!securityNeedsUpdated) {
        console.log("STATUS: Security roles set correctly");
        return (true);
    }
    config = {
        method: 'put',
        url: couchdbUrl+"/"+couchDatabase+"/_security",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json',
        data: newSecurity
    }
    errorSettingSecurity = false;
    try { res = await axios(config)}
    catch(err) { console.log("got error : ", err); errorSettingSecurity = true }
    if (errorSettingSecurity) {
        console.log("ERROR: Problem setting database security")
    } else {
        console.log("STATUS: Database security roles added");
    }
    return (!errorSettingSecurity);
}

async function addDBIdentifier() {
    const dbidq = {
        selector: { type: { "$eq": "dbuuid" }}
    }
    let foundIDDocs =  await todosDBAsAdmin.find(dbidq);
    let foundIDDoc = undefined;
    if (foundIDDocs.docs.length > 0) {foundIDDoc = foundIDDocs.docs[0]}
    if (foundIDDoc == undefined) {
        const newDoc = {
            type: "dbuuid",
            name: "Database UUID",
            "uuid": uuidv4(),
            "uomContentVersion": 0,
            updatedAt: (new Date()).toISOString()
        }
        let dbResp = null;
        try { dbResp = await todosDBAsAdmin.insert(newDoc) }
        catch(err) { console.log("ERROR: problem creating UUID:",err)};
        if (dbResp != null) {console.log("STATUS: UUID created in DB: ", newDoc.uuid)}  
    } else {
        if (!foundIDDoc.hasOwnProperty("uuid")) {
            console.log("ERROR: Database UUID doc exists without uuid. Please correct and restart.");
            return false;
        }
        if (!foundIDDoc.hasOwnProperty("uomContentVersion")) {
            foundIDDoc.uomContentVersion = 0;
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(foundIDDoc); console.log("STATUS: Updated UOM Content Version, was missing.") }
            catch(err) { console.log("ERROR: updating UUID record with uomContentVersion"); console.log(JSON.stringify(err));};
        }
    }
}

async function createConflictsView() {
    let viewFound=true; let existingView;
    try {existingView = await todosDBAsAdmin.get("_design/"+conflictsViewID)}
    catch(err) {viewFound = false;}
    if (!viewFound) {
        let viewCreated=true;
        try {
            await todosDBAsAdmin.insert({
                "views": { "conflicts_view" : {
                    "map": function(doc) { if (doc._conflicts) { emit (doc._conflicts, null)}
                }
            }}},"_design/"+conflictsViewID)
        }
        catch(err) {console.log("ERROR: View not created:",{err}); viewCreated=false;}
        console.log("STATUS: View created/ updated");
    }
}
function isInteger(str) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

async function dbStartup() {
    console.log("STATUS: Starting up auth server for couchdb...");
    console.log("STATUS: Database URL: ",couchdbUrl);
    console.log("STATUS: Using database: ",couchDatabase);
    await createDBIfNotExists();
    await setDBSecurity();
    todosDBAsAdmin = todosNanoAsAdmin.use(couchDatabase);
    usersDBAsAdmin = usersNanoAsAdmin.use("_users");
    await addDBIdentifier();
    await checkAndCreateContent();
    await createConflictsView();
    if (enableScheduling) {
        if(isInteger(resolveConflictsFrequencyMinutes)) {
            setInterval(() => {resolveConflicts()},60000*resolveConflictsFrequencyMinutes);
            console.log("STATUS: Conflict resolution scheduled every ",resolveConflictsFrequencyMinutes, " minutes.")
        } else {
            console.log("ERROR: Invalid environment variable for scheduling  -- not started.");
        }
    }
}

async function getUserDoc(username) {
    const userResponse = {
        error: false,
        fullname: "",
        email: "",
        fullDoc: {}
    }
    const config = {
        method: 'get',
        url: couchdbUrl+"/_users/"+ encodeURI(couchUserPrefix+":"+username),
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let res = null;
    try { res = await usersDBAsAdmin.get(couchUserPrefix+":"+username)}
    catch(err) { console.log("ERROR GETTING USER:",err); userResponse.error= true }
    if (!userResponse.error) {
        userResponse.email = res.email;
        userResponse.fullname = res.fullname;
        userResponse.fullDoc = res;
    }
    return (userResponse);
}

async function generateJWT(username) {
    const alg = "HS256";
    const secret = new TextEncoder().encode(couchKey)
    const jwt = await new jose.SignJWT({'sub': username, '_couchdb.roles': [couchStandardRole,couchAdminRole,"_admin"]})
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime("5s")
        .sign(secret);  
    return (jwt);
}

async function checkUserExists(req, res) {
    const { username } = req.body;
    let response = {
        username: username,
        userExists: false
    }
    let userResponse = await getUserDoc(username);
    response.userExists = !userResponse.error;
    return (response);
}

async function getUserByEmailDoc(email) {
    const userResponse = {
        error: false,
        username: null,
        fullname: null,
        email: email,
    }
    const query={selector: {"email": {"$eq": email}}};
    let res = null;
    try { res = await usersDBAsAdmin.find(query);}
    catch(err) { console.log(err); userResponse.error= true }
    console.log(res);
    if (!userResponse.error) {
        if (res.docs.length > 0) {
            userResponse.username = res.docs[0].name;
            userResponse.email = res.docs[0].email;
            userResponse.fullname = res.docs[0].fullname;
        } else {
            userResponse.error = true;
        }

    }
    return (userResponse);
}

async function checkUserByEmailExists(req, res) {
    const { email} = req.body;
    let response = {
        username: null,
        fullname: null,
        email: null,
        userExists: true
    }
    let userResponse = await getUserByEmailDoc(email);
    if (userResponse.error) { response.userExists = false;}
    else {
        response.username = userResponse.username;
        response.email = userResponse.email;
        response.fullname = userResponse.fullname;
    }
    return (response);
}


async function issueToken(req, res) {
    const { username, password } = req.body;
    let response = {
        loginSuccessful: false,
        email: "",
        fullname: "",
        loginRoles: [],
        jwt: "",
        couchdbUrl: process.env.COUCHDB_URL,
        couchdbDatabase: process.env.COUCHDB_DATABASE
    }
    let loginResponse = await couchLogin(username,password);
    if (!loginResponse.loginSuccessful) return (response);

    let userDoc = await getUserDoc(username);
    if (loginResponse.loginSuccessful && !(userDoc.error)) {
         response.loginSuccessful = loginResponse.loginSuccessful;
         response.loginRoles = loginResponse.loginRoles;
         response.email = userDoc.email;
         response.fullname = userDoc.fullname;
         response.jwt = await generateJWT(username);
     }
    return(response);

}

async function createNewUser(userObj) {
    const createResponse = {
        error: false,
        idCreated: ""
    }
    const newDoc = {
        name: userObj.username,
        password: userObj.password,
        email: userObj.email,
        fullname: userObj.fullname,
        roles: [couchStandardRole],
        type: "user"
    }
    let res = null;
    try { res = await usersDBAsAdmin.insert(newDoc,couchUserPrefix+":"+userObj.username); }
    catch(err) { console.log("ERROR: problem creating user: ",err); createResponse.error= true }
    console.log({res});
    if (!createResponse.error) {
        createResponse.idCreated = res.id;
    }
    return (createResponse);
}

async function updateUnregisteredFriends(email) {
    const emailq = {
        selector: { type: { "$eq": "friend" }, inviteEmail: { "$eq": email}}
    }
    foundFriendDocs =  await todosDBAsAdmin.find(emailq);
    console.log("updating unregistered friends..., full list:",{foundFriendDocs});
    foundFriendDoc = undefined;
//    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    foundFriendDocs.docs.forEach(async (doc) => {
        console.log("processing one friend:",{doc});
        if (doc.friendStatus == "WAITREGISTER") {
            doc.friendID2 = req.body.username;
            doc.friendStatus = "PENDFROM1";
            doc.updatedAt = (new Date()).toISOString();
            console.log("about to update record:", doc)
            update2Success=true;
            try { await todosDBAsAdmin.insert(doc);} 
            catch(e) {update2success = false;}
            console.log("update2success:",{update2Success})
        }
    });
}

function isNothing(obj) {
    if (obj == "" || obj == null || obj == undefined) {return (true)}
    else {return (false)};
}

async function registerNewUser(req, res) {
    const {username, password, email, fullname} = req.body;
    const registerResponse = {
        invalidData: false,
        userAlreadyExists: false,
        createdSuccessfully: false,
        idCreated: "",
        jwt: "",
        couchdbUrl: process.env.COUCHDB_URL,
        couchdbDatabase: process.env.COUCHDB_DATABASE,
        email: email,
        fullname: fullname
    }

    if (isNothing(username) || isNothing(password) || isNothing(email) || isNothing(fullname)) {
        registerResponse.invalidData = true;
        return (registerResponse);
    }

    let userDoc = await getUserDoc(username);
    if (!userDoc.error) {
        registerResponse.userAlreadyExists = true;
    } 
    if (!registerResponse.userAlreadyExists)  {
        let createResponse = await createNewUser({username: username, password: password, email: email, fullname: fullname})
        registerResponse.createdSuccessfully = !createResponse.error;
        registerResponse.idCreated = createResponse.idCreated;
        registerResponse.jwt = await generateJWT(username);
        let updateFriendResponse = await updateUnregisteredFriends(email)
    }
    return (registerResponse);
}

async function getUsersInfo(req, res) {
    // input - json list of userIDs : userIDs: ["username1","username2"] -- should be _users ids 
    //        without the org.couchdb.user prefix
    // return - json array of objects:
    //        [ {userID: "username1", email: "username1@gmail.com", fullName: "User 1"},
    //          {userID: "username2", email: "username2@yahoo.com", fullName: "User 2"}]

    const getResponse = {
        error: false,
        users: [],
    }
    if (isNothing(req.body?.userIDs)) {getResponse.error=true; return (getResponse)}
    const requestData = { keys: [], include_docs: true }
    req.body.userIDs.forEach(uid => { requestData.keys.push(couchUserPrefix+":"+uid) });
    let userRes = null;
    try { userRes = await usersDBAsAdmin.list(requestData);}
    catch(err) { console.log("ERROR: problem retrieving users: ",err); getResponse.error= true }
    if (!getResponse.error) {
        userRes.rows.forEach(el => {
            getResponse.users.push({name: el?.doc?.name, email: el?.doc?.email, fullname: el?.doc?.fullname})
        });
    }
    return(getResponse);
}

async function createAccountUIGet(req, res) {
    // input - query parameter - uuid
    // creates a form pre-filled with email address (cannot change), username,full name, and password
    // on submit (to different endpoint?),
    // check if username or email already exists, if so, error out,
    // otherwise reqister new user

    let respObj = {
        uuid: req.query.uuid,
        email: "testemail",
        fullname: "",
        username: "",
        password: "",
        passwordverify: "",
        formError: "",
        disableSubmit: false,
        createdSuccessfully: false
    }
       
    const uuidq = {
        selector: { type: { "$eq": "friend" }, inviteUUID: { "$eq": req.query.uuid}},
        fields: [ "friendID1","friendID2","inviteUUID","inviteEmail","friendStatus"]
    }
    let foundFriendDocs =  await todosDBAsAdmin.find(uuidq);
    let foundFriendDoc;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    else {
        respObj.formError = "Registration ID not found. Cannot complete registration process."
        respObj.disableSubmit = true;
        return (respObj);
    };
    respObj.email = foundFriendDoc.inviteEmail;

    if (foundFriendDoc.friendStatus != "WAITREGISTER") {
        respObj.formError = "Registration already completed. Please login to the app directly."
        respObj.disableSubmit = true;
        return (respObj);
    }

    return(respObj);

}

async function getFriendDocByUUID(uuid) {
    const uuidq = {
        selector: { type: { "$eq": "friend" }, inviteUUID: { "$eq": uuid}}
    }
    let foundFriendDocs =  await todosDBAsAdmin.find(uuidq);
    console.log("all docs found:",{foundFriendDocs});
    let foundFriendDoc;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    return(foundFriendDoc);
}


async function createAccountUIPost(req,res) {

    let respObj = {
        uuid: req.body.uuid,
        email: req.body.email,
        username: (req.body.username == undefined) ? "" : req.body.username,
        fullname: (req.body.fullname == undefined) ? "" : req.body.fullname,
        password: (req.body.password == undefined) ? "" : req.body.password,
        passwordverify: (req.body.passwordverify == undefined) ? "" : req.body.passwordverify,
        formError: "",
        disableSubmit: false,
        createdSuccessfully: false
    }

    if (req.body.fullname.length < 2 ) {
        respObj.formError = "Please enter a full name 3 characters or longer";
        return (respObj);} 
    if (!fullnamePatternValidation(req.body.fullname)) {
        respObj.formError = "Please enter a valid full name";
        return (respObj);}
    if (req.body.username.length < 5 ) {
        respObj.formError = "Please enter a username 5 characters or longer";
        return (respObj); } 
    if (!usernamePatternValidation(req.body.username)) {
        respObj.formError = "Please enter a valid username";
        return (respObj); }
    if (req.body.password.length < 5 ) {
        respObj.formError = "Please enter a password 5 characters or longer";
        return (respObj);} 
    if (req.body.password != req.body.passwordverify) {
        respObj.formError = "Passwords do not match";
        return (respObj);}
    let foundUserDoc; let userAlreadyExists=true;
    try {
        foundUserDoc =  await usersDBAsAdmin.get(couchUserPrefix+":"+req.body.username);}
    catch(e) { userAlreadyExists=false;}    
    if (userAlreadyExists) {
        respObj.formError = "Username already exists, plase choose a new one";
        return(respObj);
    }

    // create user doc
    const userObj = {
        username: req.body.username,
        fullname: req.body.fullname,
        email: req.body.email,
        password: req.body.password
    }

    console.log("about to create new user: ",{userObj});
    let userIDres = await createNewUser(userObj);

    // change friend doc to registered
    let foundFriendDoc = await getFriendDocByUUID(req.body.uuid);
    console.log("getting friend doc by uuid",{foundFriendDoc});
    if (foundFriendDoc!=undefined) {
        console.log("updating that friend doc to PENDFROM1");
        foundFriendDoc.friendID2 = req.body.username;
        foundFriendDoc.friendStatus = "PENDFROM1";
        foundFriendDoc.updatedAt = (new Date()).toISOString();
        updateSuccessful = true;
        console.log("about to update/insert:",{foundFriendDoc});
        try { await todosDBAsAdmin.insert(foundFriendDoc); }
        catch(e) {updateSuccessful = false;}
        console.log("update success:",{updateSuccessful});
    }

    console.log("checking other friend records by email now");
    const emailq = {
        selector: { type: { "$eq": "friend" }, inviteEmail: { "$eq": req.body.email}}
    }
    foundFriendDocs =  await todosDBAsAdmin.find(emailq);
    console.log("found complete list of friends to check:",{foundFriendDocs});
    foundFriendDoc = undefined;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    foundFriendDocs.docs.forEach(async (doc) => {
        console.log("checking for other, existing doc:",{doc});
        if ((doc.inviteUUID != req.body.uuid) && (doc.friendStatus == "WAITREGISTER")) {
            doc.friendID2 = req.body.username;
            doc.friendStatus = "PENDFROM1";
            doc.updatedAt = (new Date()).toISOString();
            update2Success=true;
            try { await todosDBAsAdmin.insert(doc);} 
            catch(e) {update2success = false;}
        }
    });

    respObj.createdSuccessfully = true;
    console.log("about to respond with :",{respObj});
    return(respObj);
}

async function triggerRegEmail(req, res) {
    const triggerResponse = {
        emailSent : false
    }
    const {uuid} = req.body;
    console.log("about to trigger reg email for uuid: ", uuid);

    if (isNothing(uuid)) {return (triggerResponse);}
    let foundFriendDoc = await getFriendDocByUUID(req.body.uuid);
    if (foundFriendDoc == undefined) {return triggerResponse;};
    console.log("Found Friend to trigger: ", {foundFriendDoc});
    let userDoc = await getUserDoc(foundFriendDoc.friendID1);
    if (userDoc.error) {return triggerResponse};
    console.log("Got user Doc:",{userDoc});
    
    let transport = nodemailer.createTransport(smtpOptions);
    transport.verify(function (error,success) {
        if (error) {return triggerResponse}
    })
    console.log("transport verified");

    let confURL = groceryAPIUrl + "/createaccountui?uuid="+foundFriendDoc.inviteUUID;

    const message = {
        from: smtpFrom,
        to: foundFriendDoc.inviteEmail,
        subject: "User Creation request from Groceries",
        text: userDoc.fullname+" has requested to share lists with you on the Groceries App. Please use the link to register for an account: "+confURL+ " . Once registered, visit "+groceryUrl+" to use the app."
    }

    console.log("about to send message:",{message});

    transport.sendMail(message, function (error, success) {
        if (!error) {return triggerResponse}
    });
    triggerResponse.emailSent = true;

    return (triggerResponse);
}

async function resetPassword(req, res) {
    const resetResponse = {
        emailSent : false
    }
    const {username} = req.body;

    let userDoc = await getUserDoc(username);
    if (userDoc.error) {return resetResponse};

    let transport = nodemailer.createTransport(smtpOptions);
    transport.verify(function (error,success) {
        if (error) {return triggerResponse}
    })

    let resetURL = groceryAPIUrl + "/resetpasswordui?username="+encodeURIComponent(username);
    const message = {
        from: smtpFrom,
        to: userDoc.email,
        subject: "Password Reset Request from Groceries",
        text: userDoc.fullname+" has requested to reset their password. If you did not request this reset, please validate the security of this account. Please use the link to reset your password: "+resetURL+ " . Once reset, visit "+groceryUrl+" to use the app or login on your mobile device.."
    }

    transport.sendMail(message, function (error, success) {
        if (!error) {return resetResponse}
    });
    resetResponse.emailSent = true;
    return resetResponse;
}    

async function resetPasswordUIGet(req, res) {
    let respObj = {
        email: "",
        username: req.query.username,
        password: "",
        passwordverify: "",
        formError: "",
        disableSubmit: false,
        resetSuccessfully: false
    }
    
    let userDoc = await getUserDoc(req.query.username);
    if (userDoc.error) {
        respObj.formError = "Cannot locate user name "+username;
        respObj.disableSubmit = true;
        return respObj
    }
    respObj.email = userDoc.email;
    return respObj;
}

async function resetPasswordUIPost(req, res) {
    let respObj = {
        username: req.body.username,
        password: (req.body.password == undefined) ? "" : req.body.password,
        passwordverify: (req.body.passwordverify == undefined) ? "" : req.body.passwordverify,
        email: (req.body.email),
        formError: "",
        disableSubmit: false,
        resetSuccessfully: false
    }
    if (req.body.password.length < 5 ) {
        respObj.formError = "Please enter a password 5 characters or longer";
        return (respObj);
    } 
    if (req.body.password != req.body.passwordverify) {
        respObj.formError = "Passwords do not match";
        return (respObj);
    }

    let userDoc = await getUserDoc(req.body.username);
    if (!userDoc.error) {
        let newDoc=cloneDeep(userDoc.fullDoc);
        newDoc.password=req.body.password;
        let newDocFiltered = _.pick(newDoc,['_id','_rev','name','email','fullname','roles','type','password']);
        console.log(newDocFiltered)
        let docupdate = await usersDBAsAdmin.insert(newDocFiltered);
        console.log(docupdate);
    }
    respObj.resetSuccessfully = true;
    // do actual password update
    console.log("password updated to ",req.body.password);
    return(respObj);
}

async function resolveConflicts() {
    const conflicts = await todosDBAsAdmin.view(conflictsViewID,conflictsViewName);
    console.log("STATUS: Resolving all conflicts started...");
    let resolveFailure=false;
    if (conflicts.rows?.length <= 0) {console.log("STATUS: no conflicts found"); return};
    outerloop: for (let i = 0; i < conflicts.rows.length; i++) {
        const conflict = conflicts.rows[i];
        console.log(conflict);
        console.log(conflict.id);
        let curWinner;
        try { curWinner = await todosDBAsAdmin.get(conflict.id, {conflicts: true});}
        catch(err) { resolveFailure = true;}
        if (resolveFailure) {continue};
        console.log(curWinner,resolveFailure);
        let latestDocTime = curWinner.updatedAt; 
        let latestIsCurrentWinner = true;
        let latestDoc = curWinner
        let bulkObj = { docs: []};
        let logObj = { type: "conflictlog", docType: curWinner.type, winner: {}, losers: []};
        console.log({latestDocTime,latestIsCurrentWinner,latestDoc});
        console.log
        for (let j = 0; j < curWinner._conflicts.length; j++) {
            const losingRev = curWinner._conflicts[j];
            let curLoser;
            try { curLoser = await todosDBAsAdmin.get(conflict.id,{ rev: losingRev})}
            catch(err) {resolveFailure=true;}
            if (resolveFailure) {continue outerloop};
            console.log({curLoser});
            if (curLoser.updatedAt >= latestDocTime) {
                latestIsCurrentWinner = false;
                latestDocTime = curLoser.updatedAt;
                latestDoc = curLoser;
            } else {
                bulkObj.docs.push({_id: curLoser._id, _rev: losingRev ,_deleted: true})
                logObj.losers.push(curLoser);
            }
        }
        let resolvedTime = (new Date()).toISOString();
        latestDoc.updatedAt = resolvedTime;
        logObj.updatedAt = resolvedTime;
        bulkObj.docs.push(latestDoc);
        logObj.winner = latestDoc;
        if (!latestIsCurrentWinner) {
            bulkObj.docs.push({_id: curWinner._id, _rev: curWinner._rev, _deleted: true});
            logObj.losers.push(curWinner);
        }
        console.log("LogObj:",JSON.stringify(logObj));
        console.log("BulkObj:", JSON.stringify(bulkObj));
        let bulkResult;
        try { bulkResult = await todosDBAsAdmin.bulk(bulkObj) }
        catch(err) {console.log("ERROR: Error updating bulk docs on conflict resolve"); resolveFailure=true;}
        console.log("STATUS: Bulk Update to resolve doc id : ",conflict.id, " succeeded");
        let logResult;
        try { logResult = await todosDBAsAdmin.insert(logObj)}
        catch(err) { console.log("ERROR: creating conflict log document failed: ",err)};
        console.log(bulkResult);
    }
}

async function triggerResolveConflicts(req,res) {
    let respObj = {
        triggered: true
    };
    resolveConflicts()
    return respObj;
}

async function compactDB() {
    todosNanoAsAdmin.db.compact(couchDatabase);
}

async function triggerDBCompact(req,res) {
    let respObj = {
        triggered: true
    };
    compactDB();
    return respObj;
}

module.exports = {
    issueToken,
    checkUserExists,
    checkUserByEmailExists,
    registerNewUser,
    dbStartup,
    getUsersInfo,
    createAccountUIGet,
    createAccountUIPost,
    triggerRegEmail,
    resetPassword,
    resetPasswordUIGet,
    resetPasswordUIPost,
    triggerResolveConflicts,
    triggerDBCompact

}