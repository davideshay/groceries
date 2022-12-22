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
const couchStandardRole = "crud";
const couchAdminRole = "dbadmin";
const couchUserPrefix = "org.couchdb.user";
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
const dbAsAdmin = nanoAdmin(nanoAdminOpts)
let todosNanoAsAdmin = nanoAdmin(nanoAdminOpts);
let usersNanoAsAdmin = nanoAdmin(nanoAdminOpts);
let todosDBAsAdmin;
let usersDBAsAdmin;
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');

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
    let doesDBExist = false;
    const config = {
        method: 'get',
        url: couchdbUrl+"/"+couchDatabase,
        auth: {username: couchAdminUser, password: couchAdminPassword},
        validateStatus: function(status) { return true},
        responseType: 'json'
    }
    let retrieveError = false;
    let res = null;
    try { res = await axios(config)}
    catch(err) { retrieveError = true }
    if (retrieveError) {
        console.log("ERROR: could not retrieve database info.");
        return (false);
    }
    if (res.status == "200") {
        console.log("STATUS: Database "+ couchDatabase + " already exists");
        doesDBExist = true;};
    return (doesDBExist);
}

async function createDB() {
    const config = {
        method: 'put',
        url: couchdbUrl+"/"+couchDatabase,
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let createError = false;
    let res = null;
    try { res = await axios(config)}
    catch(err) {  createError = true }
    if (createError) return (false);
    if (res.status == "400"||res.status == "401"|| res.status=="412") {
        console.log("ERROR: Problem creating database "+couchDatabase);
        return(false);
    }
    if (typeof res.data?.ok == undefined) return(false);
    console.log("STATUS: Initiatialization, Database "+couchDatabase+" created.");
    return (res.data.ok);
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
        }
        let dbResp = await todosDBAsAdmin.insert(newDoc);
        console.log(dbResp);    
    }
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
}

async function getUserDoc(username) {
    const userResponse = {
        error: false,
        fullname: "",
        email: ""
    }
    const config = {
        method: 'get',
        url: couchdbUrl+"/_users/"+ encodeURI(couchUserPrefix+":"+username),
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { userResponse.error= true }
    if (!userResponse.error) {
        userResponse.email = res.data?.email;
        userResponse.fullname = res.data?.fullname;
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
    const config = {
        method: 'post',
        url: couchdbUrl+"/_users/_find",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: {selector: {"email": {"$eq": email}},
                fields: ["name", "email", "fullname"]},
        responseType: 'json'
    }
    let res = null;
    console.log("doing axios with config: ",config, " for email ",email);
    try { res = await axios(config)}
    catch(err) { console.log(err); userResponse.error= true }
    if (!userResponse.error && res.status == 200 && res.data.docs.length == 0) {
        userResponse.error = true;
    }
    console.log("response data is ",res.data);
    console.log("status : ", res.status, " data len ",res.data.docs.length);
    if (!userResponse.error) {
        if (res.status == 200 && res.data.docs.length > 0) {
            userResponse.username = res.data?.docs[0].name;
            userResponse.email = res.data?.docs[0].email;
            userResponse.fullname = res.data?.docs[0].fullname;
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
        loginJWT: "",
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
         response.loginJWT = await generateJWT(username);
     }
    return(response);

}

async function createNewUser(userObj) {
    const createResponse = {
        error: false,
        idCreated: ""
    }
    const config = {
        method: 'put',
        url: couchdbUrl+"/_users/"+ encodeURI(couchUserPrefix+":"+userObj.username),
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: {
            name: userObj.username,
            password: userObj.password,
            email: userObj.email,
            fullname: userObj.fullname,
            roles: [couchStandardRole],
            type: "user"
        },
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { createResponse.error= true }
    if (!createResponse.error) {
        createResponse.idCreated = res.data.id;
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
            doc.friendStatus = "PENDFROM1"
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
    const registerResponse = {
        invalidData: false,
        userAlreadyExists: false,
        createdSuccessfully: false,
        idCreated: "",
        jwt: "",
        couchdbUrl: process.env.COUCHDB_URL,
        couchdbDatabase: process.env.COUCHDB_DATABASE
    }
    const {username, password, email, fullname} = req.body;

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
//    console.log("req is:",{req});
    if (isNothing(req.body?.userIDs)) {getResponse.error=true; return (getResponse)}
    const requestData = { keys: [], include_docs: true }
    req.body.userIDs.forEach(uid => { requestData.keys.push(couchUserPrefix+":"+uid) });
    const config = {
        method: 'post',
        url: couchdbUrl+"/_users/_all_docs",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: requestData,
        responseType: 'json'
    }
    let userRes = null;
    try { userRes = await axios(config)}
    catch(err) { console.log(err); getResponse.error= true }
    if (!getResponse.error) {
        console.log(userRes.data.rows)
        userRes.data.rows.forEach(el => {
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
        return (respObj);
    } 
    if (req.body.username.length < 5 ) {
        respObj.formError = "Please enter a username 5 characters or longer";
        return (respObj);
    } 
    if (req.body.password.length < 5 ) {
        respObj.formError = "Please enter a password 5 characters or longer";
        return (respObj);
    } 
    if (req.body.password != req.body.passwordverify) {
        respObj.formError = "Passwords do not match";
        return (respObj);
    }
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
            doc.friendStatus = "PENDFROM1"
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

    if (isNothing(uuid)) {return (triggerResponse);}
    let foundFriendDoc = await getFriendDocByUUID(req.body.uuid);
    if (foundFriendDoc == undefined) {return triggerResponse;};
    let userDoc = await getUserDoc(foundFriendDoc.friendID1);
    if (userDoc.error) {return triggerResponse};
    
    let transport = nodemailer.createTransport(smtpOptions);
    transport.verify(function (error,success) {
        if (error) {return triggerResponse}
    })

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


module.exports = {
    issueToken,
    checkUserExists,
    checkUserByEmailExists,
    registerNewUser,
    dbStartup,
    getUsersInfo,
    createAccountUIGet,
    createAccountUIPost,
    triggerRegEmail

}